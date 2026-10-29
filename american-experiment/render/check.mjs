#!/usr/bin/env node
// make check: the acceptance checks that can be proven by machine.
//
//   node render/check.mjs                 timeline, cards, facts, fonts, audio, safe area, determinism
//   node render/check.mjs --video FILE    also verify a rendered MP4's length and frame count
//   node render/check.mjs --motion        also prove nothing holds still for more than 1 s (slow)
//   node render/check.mjs --stride 30     sample every 30th frame for the on-screen text checks
//
// Exit code 1 if any check fails.

import { readFileSync, existsSync, readdirSync, openSync, readSync, closeSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Timeline } from '../web/src/timeline.js';
import { ROOT } from './serve.mjs';
import { launch, openFilm, close } from './browser.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const flag = k => argv.includes(`--${k}`);

const tlJson = JSON.parse(readFileSync(join(ROOT, 'timeline.json'), 'utf8'));
const facts = JSON.parse(readFileSync(join(ROOT, 'data/facts.json'), 'utf8'));
const tl = new Timeline(tlJson);
const SAFE = { x0: 96, y0: 54, x1: 1824, y1: 1026 };

let failures = 0, warnings = 0;
const ok = msg => console.log(`  ✓ ${msg}`);
const fail = msg => { failures++; console.log(`  ✗ ${msg}`); };
const warn = msg => { warnings++; console.log(`  ! ${msg}`); };
const section = s => console.log(`\n${s}`);
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const factKnown = f => {
  if (!f) return false;
  if (Array.isArray(f)) return f.every(factKnown);
  if (f.startsWith('structural:')) return f.slice(11) in facts.structural;
  return f in facts.facts;
};

// ---------------------------------------------------------------------------
section('Timeline');
near(tl.duration, 296) ? ok(`${tl.totalBars} bars at ${tl.bpm} BPM = ${tl.duration.toFixed(3)} s`) : fail(`duration ${tl.duration} s, expected 296.000`);
tl.frames === 17760 ? ok(`${tl.frames} frames at ${tl.fps} fps`) : fail(`${tl.frames} frames, expected 17,760`);
const offGrid = tl.scenes.filter(s => !Number.isInteger(s.startBar) || s.bars % 4 !== 0);
offGrid.length ? fail(`scenes off the 4-bar phrase grid: ${offGrid.map(s => s.id).join(', ')}`) : ok('every scene starts on a downbeat and runs 4, 8 or 12 bars');
let cueCount = 0, strays = [];
for (const s of tl.scenes) for (const c of Object.values(s.cueMap)) for (const h of c.hits) {
  cueCount++;
  if (h.t0 < s.start - 1e-9 || h.t0 > s.end + 1e-9) strays.push(`${s.id}/${c.name}@${tl.label(h.t0)}`);
}
strays.length ? fail(`cue hits outside their scene: ${strays.slice(0, 8).join(', ')}`) : ok(`${cueCount} cue hits, each inside its own scene`);

section('Cards');
let cards = 0;
const failsBeforeCards = failures;
for (const s of tl.scenes) for (const c of Object.values(s.cueMap)) {
  if (!c.card) continue;
  cards++;
  const h = c.hits[0], hold = h.t1 - h.t0;
  const words = c.card.text.split(/\s+/).filter(w => /[A-Z0-9∞]/i.test(w)).length;
  const isStatement = c.card.voice !== 'data';
  const maxWords = c.card.quote ? 9 : 7;
  if (isStatement && words > maxWords) fail(`${s.id}/${c.name}: ${words} words (max ${maxWords})`);
  const need = c.card.quote ? 2 : Math.max(2, 1.2 + 0.25 * words);
  if (hold + 1e-9 < need) fail(`${s.id}/${c.name}: holds ${hold.toFixed(2)} s, needs ${need.toFixed(2)} s`);
  const onBeat = near((h.t0 / tl.beat) % 1, 0, 1e-6) || near((h.t0 / tl.beat) % 1, 1, 1e-6);
  if (!onBeat) fail(`${s.id}/${c.name}: enters off the beat at ${tl.label(h.t0)}`);
  if (/\d/.test(c.card.text) && !factKnown(c.card.fact)) fail(`${s.id}/${c.name}: "${c.card.text}" has a number but no fact`);
}
if (failures === failsBeforeCards) ok(`${cards} cards: word counts, holds of at least 2 s (and 1.2 s + 0.25 s per word), entries on the beat, numbers sourced`);

section('Facts');
const missingSrc = Object.entries(facts.facts).filter(([, f]) => !/^https?:\/\//.test(f.source || ''));
missingSrc.length ? fail(`facts without a source URL: ${missingSrc.map(([k]) => k).join(', ')}`) : ok(`${Object.keys(facts.facts).length} facts, each with a source URL`);
const sceneFiles = readdirSync(join(ROOT, 'web/src/scenes')).filter(f => /^\d\d_/.test(f));
const built = new Set(sceneFiles.map(f => f.replace(/\.js$/, '')));
const used = new Set();
for (const s of tl.scenes) {
  for (const c of Object.values(s.cueMap)) if (c.card && c.card.fact) [].concat(c.card.fact).forEach(f => used.add(`${s.id}|${f}`));
  if (s.hud.coordsFact) used.add(`${s.id}|${s.hud.coordsFact}`);
  if (Array.isArray(s.hud.coords)) s.hud.coords.forEach(k => used.add(`${s.id}|${k.fact}`));
}
const unverified = [...used].filter(u => { const [sid, f] = u.split('|'); return built.has(sid) && !f.startsWith('structural:') && facts.facts[f] && !facts.facts[f].verified; });
unverified.length ? fail(`built scenes show unverified facts: ${unverified.join(', ')}`) : ok(`every fact shown by a built scene (${[...built].join(', ')}) is verified`);
const pending = [...used].filter(u => { const [sid, f] = u.split('|'); return !built.has(sid) && facts.facts[f] && !facts.facts[f].verified; });
if (pending.length) warn(`${pending.length} facts for scenes still to be built are not yet verified`);

section('Palette');
const srcFiles = [];
const walk = d => readdirSync(d, { withFileTypes: true }).forEach(e => e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.js') && srcFiles.push(join(d, e.name)));
walk(join(ROOT, 'web/src'));
const colorLits = [];
for (const f of srcFiles) {
  if (f.endsWith('theme.js')) continue;
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    if (/debugOverlay|rgba\(255,0,255/.test(l)) return; // the ?debug overlay is not part of the film
    if (/#[0-9a-fA-F]{6}\b|['"`]rgba?\(\s*\d/.test(l)) colorLits.push(`${f.replace(ROOT + '/', '')}:${i + 1}`);
  });
}
colorLits.length ? fail(`colours outside the palette tokens: ${colorLits.join(', ')}`) : ok('every colour comes from the palette tokens in theme.js');
const crimson = sceneFiles.filter(f => readFileSync(join(ROOT, 'web/src/scenes', f), 'utf8').includes("'CRIMSON'"));
const crimsonTl = tl.scenes.filter(s => s.bg && s.bg.crimson).map(s => s.id);
const crimsonScenes = new Set([...crimson.map(f => f.replace('.js', '')), ...crimsonTl]);
crimsonScenes.size <= 4 ? ok(`CRIMSON appears in ${crimsonScenes.size} scenes (max 4): ${[...crimsonScenes].join(', ') || 'none yet'}`) : fail(`CRIMSON in ${crimsonScenes.size} scenes`);

section('Audio');
const wav = join(ROOT, 'audio/score.wav');
if (!existsSync(wav)) fail('audio/score.wav is missing (make audio)');
else {
  const fd = openSync(wav, 'r'), head = Buffer.alloc(64);
  readSync(fd, head, 0, 64, 0); closeSync(fd);
  const ch = head.readUInt16LE(22), sr = head.readUInt32LE(24), bits = head.readUInt16LE(34);
  let off = 12, dataBytes = 0;
  const buf = readFileSync(wav);
  while (off < buf.length - 8) { const id = buf.toString('ascii', off, off + 4), size = buf.readUInt32LE(off + 4); if (id === 'data') { dataBytes = size; break; } off += 8 + size; }
  const secs = dataBytes / (ch * (bits / 8) * sr);
  (sr === 48000 && bits === 24 && ch === 2) ? ok('48 kHz, 24-bit, stereo') : fail(`format ${sr} Hz, ${bits}-bit, ${ch} ch`);
  near(secs, tl.duration, 1e-9) ? ok(`score.wav is exactly ${secs.toFixed(3)} s`) : fail(`score.wav is ${secs} s`);
  const stems = ['drums', 'bass', 'arps', 'pads', 'lead', 'fx'].filter(s => !existsSync(join(ROOT, `audio/stems/${s}.wav`)));
  stems.length ? fail(`missing stems: ${stems.join(', ')}`) : ok('stems: drums, bass, arps, pads, lead, fx');
}

if (opt('video')) {
  section('Video');
  const f = opt('video');
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'stream=codec_type,nb_read_frames,duration,r_frame_rate', '-of', 'json', f]).toString());
  const v = probe.streams.find(s => s.codec_type === 'video'), a = probe.streams.find(s => s.codec_type === 'audio');
  const expectFrames = Number(opt('frames', tl.frames));
  Number(v.nb_read_frames) === expectFrames ? ok(`${v.nb_read_frames} video frames`) : fail(`${v.nb_read_frames} video frames, expected ${expectFrames}`);
  const vd = Number(v.nb_read_frames) / 60;
  near(vd, expectFrames / 60, 1e-9) ? ok(`video is ${vd.toFixed(3)} s`) : fail(`video is ${vd} s`);
  if (a) near(Number(a.duration), expectFrames / 60, 0.03) ? ok(`audio stream is ${Number(a.duration).toFixed(3)} s`) : fail(`audio stream is ${a.duration} s`);
}

// ---------------------------------------------------------------------------
section('Rendered frames');
const ctx = await launch();
const page = await openFilm(ctx, { flags: '&notexture' });
const fonts = await page.evaluate(() => window.fontStatus());
const badFonts = fonts.filter(f => f.status !== 'loaded');
badFonts.length ? fail(`fonts not loaded: ${badFonts.map(f => f.family + ' ' + f.weight).join(', ')}`) : ok(`${fonts.length} font faces loaded`);

const stride = Number(opt('stride', 15));
const sizeBad = new Map(), safeBad = new Map(), factBad = new Map(), factUnverified = new Map(), holdBad = new Map();
let texts = 0;
// Holds: every text stays up for at least 2 s. A run of samples spanning `span` frames
// was visible for less than span + 2·stride, so only runs that must be short are failed.
// Live readouts keep one key while their digits change; the ruler and the countdown are
// readouts by design.
const runs = new Map();
const holdKey = tx => `${tx.voice}|${tx.text.replace(/\d[\d,.]*/g, '#')}`;
const holdExempt = tx => [].concat(tx.fact || []).some(f => f === 'structural:ruler' || f === 'structural:countdown');
const closeRun = (key, r) => {
  const span = (r.last - r.first) / tl.fps;
  if (span + (2 * stride) / tl.fps < 2 - 1e-9 && !holdBad.has(key)) holdBad.set(key, `≤ ${(span + (2 * stride) / tl.fps).toFixed(2)} s from f${r.first}`);
};
const t0 = Date.now();
for (let n = 0; n < tl.frames; n += stride) {
  const res = await page.evaluate(k => { const r = window.renderFrame(k); return r.texts; }, n);
  const seen = new Set();
  for (const tx of res) {
    if (tx.alpha < 0.05) continue;
    texts++;
    if (!holdExempt(tx)) {
      const key = holdKey(tx);
      if (!seen.has(key)) {
        seen.add(key);
        const r = runs.get(key);
        if (r && n - r.last <= stride) r.last = n;
        else { if (r) closeRun(key, r); runs.set(key, { first: n, last: n }); }
      }
    }
    const key = `${tx.text}`;
    const [x0, y0, x1, y1] = tx.box;
    if (tx.px < 24 - 0.5) sizeBad.set(key, `${tx.px.toFixed(1)} px at f${n}`);
    if (x0 < SAFE.x0 - 0.5 || y0 < SAFE.y0 - 0.5 || x1 > SAFE.x1 + 0.5 || y1 > SAFE.y1 + 0.5) safeBad.set(key, `[${tx.box.map(v => v.toFixed(0)).join(', ')}] at f${n}`);
    if (/\d/.test(tx.text) && !factKnown(tx.fact)) factBad.set(key, `f${n}`);
    for (const f of [].concat(tx.fact || [])) if (facts.facts[f] && !facts.facts[f].verified) factUnverified.set(key, `${f} at f${n}`);
  }
  if (n % (stride * 200) === 0) process.stdout.write(`\r    sampled frame ${n}/${tl.frames}   `);
}
process.stdout.write('\r' + ' '.repeat(60) + '\r');
// A text still up at the last frame ends with the film, so its run is not cut short.
for (const [key, r] of runs) if (r.last + stride < tl.frames) closeRun(key, r);
const report = (m, label) => { if (!m.size) return true; fail(`${label}: ${[...m].slice(0, 6).map(([k, v]) => `"${k}" ${v}`).join('; ')}${m.size > 6 ? ` (+${m.size - 6} more)` : ''}`); return false; };
const a1 = report(sizeBad, 'text smaller than 24 px');
const a2 = report(safeBad, 'text outside the 90 % safe area');
const a3 = report(factBad, 'numbers on screen without a fact');
const a4 = report(factUnverified, 'text citing an unverified fact');
const a5 = report(holdBad, 'text held for less than 2 s');
if (a1 && a2 && a3 && a4 && a5) ok(`${texts} text draws in ${Math.ceil(tl.frames / stride)} sampled frames: all ≥ 24 px, inside the safe area, held at least 2 s, every number sourced and verified (${((Date.now() - t0) / 1000).toFixed(0)} s)`);

// Determinism: frame 9000 from two separate pages must be byte-identical.
const page2 = await openFilm(ctx);
const page3 = await openFilm(ctx);
await page2.evaluate(() => window.renderFrame(4321));
const h = async p => createHash('sha256').update(Buffer.from((await p.evaluate(() => window.framePNG(9000))).split(',')[1], 'base64')).digest('hex');
const [ha, hb] = [await h(page2), await h(page3)];
ha === hb ? ok(`frame 9,000 renders byte-identically twice (sha256 ${ha.slice(0, 12)}…)`) : fail('frame 9,000 differs between renders');

if (flag('motion')) {
  // Something is always drawing: sample every 0.25 s without grain or dither and look
  // for runs of identical frames lasting 1 s or more.
  let run = 0, prev = null, worst = 0, at = 0;
  for (let n = 0; n < tl.frames; n += 15) {
    const png = await page.evaluate(k => window.framePNG(k), n);
    const hsh = createHash('sha1').update(png).digest('hex');
    run = hsh === prev ? run + 15 : 0;
    if (run > worst) { worst = run; at = n; }
    prev = hsh;
  }
  worst < 60 ? ok(`no static hold of 1 s or more (longest ${(worst / 60).toFixed(2)} s)`) : fail(`static for ${(worst / 60).toFixed(2)} s ending at frame ${at}`);
}
const errs = [page, page2, page3].flatMap(p => p.filmErrors).filter(e => !/404/.test(e));
errs.length ? fail(`page errors: ${errs.slice(0, 3).join(' | ')}`) : ok('no page errors');
await close(ctx);

console.log(`\n${failures ? `✗ ${failures} check(s) failed` : '✓ all checks passed'}${warnings ? `, ${warnings} warning(s)` : ''}`);
process.exit(failures ? 1 : 0);
