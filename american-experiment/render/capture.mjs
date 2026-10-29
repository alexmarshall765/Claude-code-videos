#!/usr/bin/env node
// Frame capture: headless Chrome renders each frame with window.renderFrame(n) and the
// frames stream straight into FFmpeg, so no image sequence ever lands on disk.
//
//   node render/capture.mjs --out out/preview.mp4 --preset preview
//   node render/capture.mjs --out out/the_american_experiment_1080p60.mp4 --preset master
//   node render/capture.mjs --from 9600 --to 11040 --out out/apollo.mp4      (frames, [from, to))
//   node render/capture.mjs --segments 0-960,9600-11040 --out out/slice.mp4 (joined ranges)
//   node render/capture.mjs --stills 0,480,10320                             (PNGs in out/stills)
//
// Options: --pages N (parallel browser pages, default 3), --scale 2 (supersampled, scaled
// down with lanczos), --audio FILE (default audio/score.wav; --audio none for silent),
// --format png|raw (PNG bytes from the canvas into -f image2pipe by default; raw streams
// RGBA over HTTP, which measured several times slower in headless Chrome).

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { once } from 'node:events';
import { launch, openFilm, close } from './browser.mjs';
import { ROOT } from './serve.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const scale = Number(opt('scale', 1));
const pagesN = Math.max(1, Number(opt('pages', 3)));
const format = opt('format', 'png');
const preset = opt('preset', 'preview');
const audioArg = opt('audio', join(ROOT, 'audio/score.wav'));
const audio = audioArg === 'none' || !existsSync(resolve(audioArg)) ? null : resolve(audioArg);

const frames = {};
const waiting = new Map();
const ctx = await launch({
  onFrame: (n, buf) => { const w = waiting.get(n); if (w) { waiting.delete(n); w(buf); } else frames[n] = buf; },
});
const pages = [];
for (let i = 0; i < pagesN; i++) pages.push(await openFilm(ctx, { scale }));
const info = await pages[0].evaluate(() => window.filmInfo);
const fps = info.fps;

async function grab(page, n) {
  if (format === 'png') {
    const url = await page.evaluate(k => window.framePNG(k), n);
    return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
  }
  const got = new Promise(ok => { if (frames[n]) { ok(frames[n]); delete frames[n]; } else waiting.set(n, ok); });
  await page.evaluate((k, u) => window.captureFrame(k, u), n, `/frame/${n}`);
  return got;
}

// --- stills ----------------------------------------------------------------
if (opt('stills')) {
  const dir = resolve(opt('dir', join(ROOT, 'out/stills')));
  mkdirSync(dir, { recursive: true });
  for (const n of opt('stills').split(',').map(Number)) {
    const url = await pages[0].evaluate(k => window.framePNG(k), n);
    const f = join(dir, `f${String(n).padStart(5, '0')}.png`);
    writeFileSync(f, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
    console.log('wrote', f);
  }
  if (pages[0].filmErrors.length) console.error('page errors:', pages[0].filmErrors);
  await close(ctx);
  process.exit(0);
}

// --- video -----------------------------------------------------------------
const ranges = opt('segments')
  ? opt('segments').split(',').map(r => r.split('-').map(Number))
  : [[Number(opt('from', 0)), Number(opt('to', info.frames))]];
const list = ranges.flatMap(([a, b]) => Array.from({ length: b - a }, (_, i) => a + i));
const out = resolve(opt('out', join(ROOT, 'out/preview.mp4')));
mkdirSync(dirname(out), { recursive: true });

const W = info.width, H = info.height;
const ff = ['-y', '-hide_banner', '-loglevel', 'error', '-stats_period', '5'];
if (format === 'png') ff.push('-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-');
else ff.push('-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-framerate', String(fps), '-i', '-');
if (audio) ff.push('-i', audio);
// RGB → BT.709 YUV explicitly (swscale would otherwise assume BT.601), and downscale a
// supersampled capture with lanczos.
const vf = `${scale > 1 ? 'scale=1920:1080:flags=lanczos:' : 'scale=1920:1080:'}out_color_matrix=bt709:out_range=tv`;
const filters = [`[0:v]${vf}[v]`];
if (audio) {
  const parts = ranges.map(([a, b], i) => {
    const t0 = a / fps, t1 = b / fps, d = t1 - t0;
    const fades = ranges.length > 1 ? `,afade=t=in:st=0:d=0.02,afade=t=out:st=${(d - 0.04).toFixed(3)}:d=0.04` : '';
    return `[1:a]atrim=start=${t0.toFixed(6)}:end=${t1.toFixed(6)},asetpts=PTS-STARTPTS${fades}[a${i}]`;
  });
  filters.push(...parts);
  filters.push(`${ranges.map((_, i) => `[a${i}]`).join('')}concat=n=${ranges.length}:v=0:a=1[aout]`);
}
ff.push('-filter_complex', filters.join(';'), '-map', '[v]');
if (audio) ff.push('-map', '[aout]');
const PRESETS = {
  preview: ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p'],
  master: ['-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-tune', 'animation', '-pix_fmt', 'yuv420p'],
  prores: ['-c:v', 'prores_ks', '-profile:v', '3', '-pix_fmt', 'yuv422p10le'],
};
if (!PRESETS[preset]) throw new Error(`unknown preset ${preset}`);
ff.push(...PRESETS[preset], '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv');
if (audio) ff.push(...(preset === 'prores' ? ['-c:a', 'pcm_s24le'] : ['-c:a', 'aac', '-b:a', preset === 'master' ? '320k' : '256k']));
if (!out.endsWith('.mov')) ff.push('-movflags', '+faststart');
ff.push('-r', String(fps), out);

const proc = spawn('ffmpeg', ff, { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((ok, fail) => proc.on('close', c => (c ? fail(new Error(`ffmpeg exited ${c}`)) : ok())));

// Round-robin across pages; frames are written strictly in order.
const ready = new Map();
let next = 0, written = 0;
const t0 = Date.now();
let wake = null;
async function flush() {
  while (ready.has(next)) {
    const buf = ready.get(next);
    ready.delete(next);
    next++;
    if (!proc.stdin.write(buf)) await once(proc.stdin, 'drain');
    written++;
    if (written % 60 === 0 || written === list.length) {
      const el = (Date.now() - t0) / 1000, rate = written / el;
      process.stdout.write(`\r  ${written}/${list.length} frames  ${rate.toFixed(1)} fps  eta ${((list.length - written) / rate).toFixed(0)} s   `);
    }
    if (wake) { const w = wake; wake = null; w(); }
  }
}
let flushing = Promise.resolve();
async function worker(k) {
  const page = pages[k];
  for (let j = k; j < list.length; j += pagesN) {
    while (j - next > pagesN * 3) await new Promise(ok => { const prev = wake; wake = () => { if (prev) prev(); ok(); }; });
    const buf = await grab(page, list[j]);
    if (buf.length !== W * H * 4 && format === 'raw') throw new Error(`frame ${list[j]}: got ${buf.length} bytes`);
    ready.set(j, buf);
    flushing = flushing.then(flush);
    await flushing;
  }
}
await Promise.all(pages.map((_, k) => worker(k)));
proc.stdin.end();
await done;
const errs = pages.flatMap(p => p.filmErrors);
await close(ctx);
console.log(`\nwrote ${out}  (${list.length} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
if (errs.length) { console.error('page errors:', errs.slice(0, 5)); process.exit(1); }
