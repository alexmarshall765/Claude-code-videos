#!/usr/bin/env node
/**
 * Offline renderer for ODE.
 *
 * Drives index.html in headless Chromium, calls ODE.renderAt(t) for every frame
 * (deterministic — never real time) and pipes the frames into FFmpeg. Frames are
 * rendered by several browser pages in parallel, one chunk each, then joined.
 *
 *   node render.mjs                          # -> out/ode.mp4 (1920×1080, 24 fps, with audio/soundtrack.m4a)
 *   node render.mjs --jobs 4                 # number of parallel pages (default: CPU count, max 6)
 *   node render.mjs --no-audio               # picture only
 *   node render.mjs --audio other.wav        # a different soundtrack
 *   node render.mjs --start 47 --end 62      # render a slice
 *   node render.mjs --stills 4,22.5,131      # single PNG stills
 *   node render.mjs --sheet                  # one still per shot, tiled into contact sheets
 *   node render.mjs --cues                   # write audio/cues.json (timings for the score and narration)
 *   node render.mjs --scale 2                # 3840×2160 master
 *   node render.mjs --crf 16                 # quality (lower = better/larger; default 23)
 *   node render.mjs --nosubs --nocaps        # without narration subtitles / chapter captions
 *
 * Requires: Node 18+, Playwright (with Chromium) and ffmpeg on PATH.
 * Set CHROMIUM_PATH to use a specific Chromium/Chrome binary.
 */
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(import.meta.url)('playwright');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const flag = name => args.includes(`--${name}`);

const scale = Number(opt('scale', 1));
const outDir = resolve(opt('out', join(here, 'out')));
const crf = opt('crf', '23');
const defaultAudio = join(here, 'audio', 'soundtrack.m4a');
const audio = flag('no-audio') ? null : opt('audio', existsSync(defaultAudio) ? defaultAudio : null);
mkdirSync(outDir, { recursive: true });

const query = ['render', `scale=${scale}`, ...['nosubs', 'nocaps', 'nograin', 'nobloom'].filter(flag)].join('&');
const url = pathToFileURL(join(here, 'index.html')).href + '?' + query;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--force-color-profile=srgb', '--disable-gpu-vsync', '--allow-file-access-from-files'],
});

async function openPage() {
  const page = await browser.newPage({ viewport: { width: Math.round(1920 * scale), height: Math.round(1080 * scale) }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('\n[page error]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('\n[console]', m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.ODE && window.ODE.ready);
  await page.evaluate(() => window.ODE.ready);
  return page;
}
async function frame(page, t, type = 'image/png') {
  const b64 = await page.evaluate(([t, type]) => {
    window.ODE.renderAt(t);
    const u = document.getElementById('c').toDataURL(type, 0.95);
    return u.slice(u.indexOf(',') + 1);
  }, [t, type]);
  return Buffer.from(b64, 'base64');
}

const first = await openPage();
const { DURATION, FPS, SHOTS } = await first.evaluate(() => ({ DURATION: ODE.DURATION, FPS: ODE.FPS, SHOTS: ODE.SHOTS.map(s => ({ id: s.id, start: s.start, dur: s.dur })) }));
const fps = Number(opt('fps', FPS));

// ---- cue sheet for the audio scripts ------------------------------------------
if (flag('cues')) {
  const cues = await first.evaluate(() => ({
    duration: ODE.DURATION, fps: ODE.FPS,
    sections: ODE.SECTIONS.map(s => ({ id: s.id, start: s.start, end: s.end, bpm: s.bpm })),
    shots: ODE.SHOTS.map(s => ({ id: s.id, section: s.section, start: s.start, dur: s.dur })),
    narration: ODE.NARRATION.map(n => ({ id: n.id, start: n.start, hold: n.hold, text: n.text })),
  }));
  const f = join(here, 'audio', 'cues.json');
  writeFileSync(f, JSON.stringify(cues, null, 1) + '\n');
  console.log('wrote', f);
  await browser.close();
  process.exit(0);
}
// ---- stills ----------------------------------------------------------------
if (opt('stills', null)) {
  for (const s of opt('stills').split(',').map(Number)) {
    const f = join(outDir, `still_${s.toFixed(2).replace('.', '_')}s.png`);
    writeFileSync(f, await frame(first, s));
    console.log('wrote', f);
  }
  await browser.close();
  process.exit(0);
}
// ---- contact sheets: one still per shot (at `--at` of its length, default 0.6) ----
if (flag('sheet')) {
  const at = Number(opt('at', 0.6)), only = opt('only', null)?.split(',');
  const dir = join(outDir, 'sheet');
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const list = SHOTS.filter(s => !only || only.includes(s.id));
  for (let i = 0; i < list.length; i++) {
    writeFileSync(join(dir, `s_${String(i).padStart(3, '0')}.png`), await frame(first, list[i].start + list[i].dur * at));
  }
  const cols = Number(opt('cols', 2)), rows = Number(opt('rows', 3));
  spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', '1', '-i', join(dir, 's_%03d.png'),
    '-vf', `tile=${cols}x${rows}:padding=6:color=0x202020`, join(outDir, 'sheet_%02d.png')], { stdio: 'inherit' });
  console.log(`contact sheets in ${outDir}/sheet_NN.png (${list.length} shots: ${list.map(s => s.id).join(', ')})`);
  await browser.close();
  process.exit(0);
}

// ---- film -------------------------------------------------------------------
const start = Number(opt('start', 0));
const end = Math.min(Number(opt('end', DURATION)), DURATION);
const total = Math.round((end - start) * fps);
const jobs = Math.max(1, Math.min(Number(opt('jobs', Math.min(6, cpus().length))), total));
const tmp = join(outDir, 'chunks');
rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
const t0 = Date.now();
let done = 0;
const tick = setInterval(() => {
  const el = (Date.now() - t0) / 1000, eta = done ? (el / done) * (total - done) : 0;
  process.stdout.write(`\r  frame ${done}/${total}  ${(100 * done / total).toFixed(1)}%  elapsed ${el.toFixed(0)}s  eta ${eta.toFixed(0)}s   `);
}, 2000);

const x264 = ['-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-pix_fmt', 'yuv420p', '-tune', 'film',
  '-g', String(fps * 2), '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709'];

async function chunk(k) {
  const a = Math.floor((total * k) / jobs), b = Math.floor((total * (k + 1)) / jobs);
  const file = join(tmp, `chunk_${String(k).padStart(2, '0')}.mp4`);
  const page = k === 0 ? first : await openPage();
  const proc = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-', ...x264, file],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const closed = new Promise((ok, fail) => proc.on('close', c => (c ? fail(new Error(`ffmpeg exited ${c}`)) : ok())));
  for (let i = a; i < b; i++) {
    const png = await frame(page, start + i / fps);
    if (!proc.stdin.write(png)) await new Promise(r => proc.stdin.once('drain', r));
    done++;
  }
  proc.stdin.end();
  await closed;
  return file;
}
const files = await Promise.all(Array.from({ length: jobs }, (_, k) => chunk(k)));
clearInterval(tick);
await browser.close();

const list = join(tmp, 'list.txt');
writeFileSync(list, files.map(f => `file '${f}'`).join('\n'));
const mp4 = join(outDir, opt('name', 'ode.mp4'));
const ff = ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list];
if (audio) ff.push('-ss', String(start), '-i', resolve(audio), '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '256k', '-t', String(end - start));
ff.push('-c:v', 'copy', '-movflags', '+faststart', mp4);
const r = spawnSync('ffmpeg', ff, { stdio: 'inherit' });
if (r.status) process.exit(r.status);
rmSync(tmp, { recursive: true, force: true });
console.log(`\nwrote ${mp4}  (${total} frames, ${((Date.now() - t0) / 1000).toFixed(0)}s${audio ? ', with audio' : ', no audio'})`);
