#!/usr/bin/env node
/**
 * Offline renderer for STILL BUILDING.
 *
 * Drives index.html in headless Chromium and calls FILM.renderAt(t) for every frame
 * (deterministic, never real time). The frame range is split across worker browsers,
 * each piping frames into its own FFmpeg; the parts are then joined, encoded to the
 * delivery H.264 and muxed with the score.
 *
 *   node render.mjs                        # -> out/still-building.mp4 (1080p30 + out/score.wav)
 *   node render.mjs --workers 4            # parallel browsers (default: CPU count, max 6)
 *   node render.mjs --start 60 --end 75    # a slice
 *   node render.mjs --redo 36-64           # re-draw only the chunks touching 36s–64s, reuse the rest
 *   node render.mjs --fresh                # ignore the chunk cache in out/parts/
 *   node render.mjs --scale 0.5 --name preview.mp4
 *   node render.mjs --crf 18 --no-audio
 *   node render.mjs --mbps 3.3             # two-pass at a fixed bitrate (the committed MP4 uses this)
 *
 * Requires Node 18+, Playwright with Chromium, and ffmpeg on PATH.
 */
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, rmSync, renameSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(import.meta.url)('playwright');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const flag = n => args.includes(`--${n}`);

const fps = Number(opt('fps', 30)), scale = Number(opt('scale', 1));
const workers = Number(opt('workers', Math.min(6, cpus().length)));
const outDir = resolve(opt('out', join(here, 'out')));
const name = opt('name', 'still-building.mp4'), crf = opt('crf', '19');
const audio = flag('no-audio') ? null : resolve(opt('audio', join(outDir, 'score.wav')));
const parts = join(outDir, 'parts'); mkdirSync(parts, { recursive: true });
const W = Math.round(1920 * scale / 2) * 2, H = Math.round(1080 * scale / 2) * 2;

async function open() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--force-color-profile=srgb', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'],
  });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('[page error]', e.message));
  await page.goto(pathToFileURL(join(here, 'index.html')).href + `?render&scale=${scale}`);
  await page.waitForFunction(() => window.FILM);
  await page.evaluate(() => FILM.ready);
  return { browser, page };
}

const probe = await open();
const DURATION = await probe.page.evaluate(() => FILM.DURATION);
await probe.browser.close();
const start = Number(opt('start', 0)), end = Math.min(Number(opt('end', DURATION)), DURATION);
const f0 = Math.round(start * fps), f1 = Math.round(end * fps), total = f1 - f0;
console.log(`rendering ${total} frames (${start.toFixed(2)}s–${end.toFixed(2)}s) at ${W}×${H}, ${fps} fps, ${workers} workers`);

// The range is cut into fixed chunks that are cached in out/parts/, so after changing a
// scene only the chunks it touches need rendering again:  --redo 36-64  (seconds)
const CH = Number(opt('chunk', 6)) * fps, tag = `${W}x${H}_${fps}`;
const chunkFile = i => join(parts, `${tag}_${String(i).padStart(4, '0')}.mp4`);
const chunks = [];
for (let i = Math.floor(f0 / CH); i * CH < f1; i++) chunks.push(i);
const redo = opt('redo', null);
if (redo) for (const r of redo.split(',')) { const [a, b] = r.split('-').map(Number); for (const i of chunks) if ((i + 1) * CH > a * fps && i * CH < b * fps) rmSync(chunkFile(i), { force: true }); }
if (flag('fresh')) for (const i of chunks) rmSync(chunkFile(i), { force: true });
const maxF = Math.round(DURATION * fps);
const queue = chunks.filter(i => !existsSync(chunkFile(i)));
const todo = queue.reduce((n, i) => n + Math.min(maxF, (i + 1) * CH) - i * CH, 0);
console.log(`${chunks.length - queue.length} of ${chunks.length} chunks cached; ${todo} frames to draw`);

let done = 0; const t0 = Date.now();
const tick = setInterval(() => {
  const el = (Date.now() - t0) / 1000, eta = done ? el / done * (todo - done) : 0;
  process.stdout.write(`  ${done}/${todo}  ${(100 * done / Math.max(todo, 1)).toFixed(1)}%  eta ${Math.round(eta)}s\n`);
}, 60000);

async function work() {
  if (!queue.length) return;
  const { browser, page } = await open();
  while (queue.length) {
    const i = queue.shift(), a = i * CH, b = Math.min(maxF, (i + 1) * CH), tmp = chunkFile(i) + '.tmp.mp4';
    const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '10', '-pix_fmt', 'yuv420p', '-g', String(fps), tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
    const closed = new Promise((ok, fail) => ff.on('close', c => (c ? fail(new Error(`ffmpeg exited ${c}`)) : ok())));
    for (let f = a; f < b; f++) {
      const b64 = await page.evaluate(t => { FILM.renderAt(t); return FILM.canvas.toDataURL('image/jpeg', 0.97).slice(23); }, (f + 0.5) / fps);
      if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
      done++;
    }
    ff.stdin.end(); await closed; renameSync(tmp, chunkFile(i));
  }
  await browser.close();
}
await Promise.all(Array.from({ length: workers }, work));
clearInterval(tick);
console.log(`frames done in ${Math.round((Date.now() - t0) / 1000)}s; encoding…`);
const files = chunks.map(chunkFile);
const lead = (f0 - chunks[0] * CH) / fps;      // the first chunk may start before --start

const list = join(parts, 'list.txt');
writeFileSync(list, files.map(f => `file '${f}'`).join('\n'));
const mp4 = join(outDir, name);
const ff = ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list];
const vf = lead > 0 ? ['-ss', String(lead)] : [];
const useAudio = audio && existsSync(audio);
if (useAudio) ff.push('-ss', String(start), '-i', audio);
const mbps = opt('mbps', null);          // --mbps 3.3 → two-pass at a fixed size instead of constant quality
const enc = pass => {
  const a = [...ff, ...vf, '-t', String(end - start), '-map', '0:v', '-c:v', 'libx264', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.1',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-aq-mode', '3'];
  if (mbps) a.push('-b:v', `${mbps}M`, '-maxrate', `${mbps * 2.2}M`, '-bufsize', `${mbps * 4}M`, '-pass', String(pass), '-passlogfile', join(parts, 'x264pass'));
  else a.push('-crf', crf);
  if (pass === 1) a.push('-an', '-f', 'null', '-');
  else { if (useAudio) a.push('-map', '1:a', '-c:a', 'aac', '-b:a', '224k'); a.push('-movflags', '+faststart', mp4); }
  execFileSync('ffmpeg', a, { stdio: 'inherit' });
};
if (mbps) enc(1);
enc(2);
console.log(`wrote ${mp4}${useAudio ? ' (with score)' : ' (silent: no out/score.wav found)'}`);
