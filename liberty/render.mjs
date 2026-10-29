#!/usr/bin/env node
/**
 * Offline renderer for LIBERTY.
 *
 * Drives index.html in headless Chromium, calls LIBERTY.renderAt(t) for every
 * frame (deterministic — never real time), and either writes numbered PNGs or
 * pipes them straight into FFmpeg. Frames are split across several browser
 * pages in parallel, encoded as segments and joined without re-encoding.
 * The score (out/liberty-score.wav from `node score.mjs`, or the bundled
 * audio/liberty-score.mp3) is muxed in automatically, already mastered to picture.
 *
 *   node render.mjs                         # -> out/liberty.mp4 (1080p30 + score)
 *   node render.mjs --workers 4             # parallel pages (default: CPU count, max 6)
 *   node render.mjs --fps 60                # 60 fps master
 *   node render.mjs --audio song.wav        # use another track instead (trimmed, faded to picture)
 *   node render.mjs --no-audio              # picture only
 *   node render.mjs --frames                # PNG sequence in out/frames/ instead of MP4
 *   node render.mjs --start 80 --end 92     # render a slice (e.g. just Apollo), audio included
 *   node render.mjs --stills 4,13,30,95     # single PNG stills for review
 *   node render.mjs --theme parchment       # aged-parchment variant
 *   node render.mjs --scale 2               # 3840×2160 (4K UHD) master
 *
 * Requires: Node 18+, `npm i playwright` (or a preinstalled Playwright), ffmpeg on PATH.
 * Set CHROMIUM_PATH to use a specific Chromium/Chrome binary.
 */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// createRequire also resolves a globally installed Playwright (NODE_PATH).
const { chromium } = createRequire(import.meta.url)('playwright');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const flag = name => args.includes(`--${name}`);

const fps = Number(opt('fps', 30));
const outDir = resolve(opt('out', join(here, 'out')));
const theme = opt('theme', 'black');
const stills = opt('stills', null);
const crf = opt('crf', '14');
const scale = Number(opt('scale', 1));
const workers = Math.max(1, Number(opt('workers', Math.min(6, cpus().length))));
mkdirSync(outDir, { recursive: true });

// Music: an explicit --audio track is trimmed and faded to picture; the generated score is used as is.
let audio = null, fade = false;
if (!flag('no-audio')) {
  if (opt('audio', null)) { audio = resolve(opt('audio')); fade = true; }
  else audio = [join(here, 'out', 'liberty-score.wav'), join(here, 'audio', 'liberty-score.mp3')].find(existsSync) || null;
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--force-color-profile=srgb', '--disable-gpu-vsync'],
});
const url = pathToFileURL(join(here, 'index.html')).href + `?render&theme=${theme}&scale=${scale}`;
async function openPage() {
  const page = await browser.newPage({ viewport: { width: 1920 * scale, height: 1080 * scale }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('[page error]', e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.LIBERTY);
  await page.evaluate(() => window.LIBERTY.ready);
  return page;
}
/** Render time t on a page and return PNG bytes. */
async function frame(page, t) {
  const b64 = await page.evaluate(t => {
    window.LIBERTY.renderAt(t);
    return document.getElementById('c').toDataURL('image/png').slice(22);
  }, t);
  return Buffer.from(b64, 'base64');
}
/** Run ffmpeg with the given arguments; resolves when it exits cleanly. */
function ffmpeg(ff, stdin = 'ignore') {
  const proc = spawn('ffmpeg', ff, { stdio: [stdin, 'inherit', 'inherit'] });
  proc.done = new Promise((ok, fail) => proc.on('close', c => (c ? fail(new Error(`ffmpeg exited ${c}`)) : ok())));
  return proc;
}

const first = await openPage();
const DURATION = await first.evaluate(() => window.LIBERTY.DURATION);

if (stills) {
  for (const s of stills.split(',').map(Number)) {
    const f = join(outDir, `still_${String(s).replace('.', '_')}s.png`);
    writeFileSync(f, await frame(first, s));
    console.log('wrote', f);
  }
  await browser.close();
  process.exit(0);
}

const start = Number(opt('start', 0));
const end = Math.min(Number(opt('end', DURATION)), DURATION);
const total = Math.round((end - start) * fps);
const n = Math.min(workers, total);
// Contiguous frame ranges, one per worker page.
const chunks = Array.from({ length: n }, (_, k) => [Math.round((k * total) / n), Math.round(((k + 1) * total) / n)]);
const pages = [first, ...(await Promise.all(chunks.slice(1).map(() => openPage())))];
const t0 = Date.now();
let done = 0;
const tick = () => {
  if (++done % fps) return;
  const el = (Date.now() - t0) / 1000, eta = (el / done) * (total - done);
  process.stdout.write(`\r  frame ${done}/${total}  ${(100 * done / total).toFixed(1)}%  eta ${eta.toFixed(0)}s   `);
};
console.log(`rendering ${total} frames on ${n} page${n > 1 ? 's' : ''}${audio ? ` · audio: ${audio}` : ''}`);

if (flag('frames')) {
  const dir = join(outDir, 'frames');
  mkdirSync(dir, { recursive: true });
  await Promise.all(chunks.map(async ([a, b], k) => {
    for (let i = a; i < b; i++) {
      writeFileSync(join(dir, `f_${String(i).padStart(5, '0')}.png`), await frame(pages[k], start + i / fps));
      tick();
    }
  }));
  console.log(`\nPNG sequence in ${dir}`);
} else {
  // Encode each chunk as its own segment. Canvas pixels are sRGB/full range; convert with
  // the BT.709 matrix the stream is tagged with, so the gold stays the same hue in players.
  const encode = file => ['-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-tune', 'animation',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', file];
  const segs = await Promise.all(chunks.map(async ([a, b], k) => {
    const file = join(outDir, `.segment_${k}.mp4`);
    const proc = ffmpeg(encode(file), 'pipe');
    for (let i = a; i < b; i++) {
      const png = await frame(pages[k], start + i / fps);
      if (!proc.stdin.write(png)) await new Promise(r => proc.stdin.once('drain', r));
      tick();
    }
    proc.stdin.end();
    await proc.done;
    return file;
  }));
  // Join the segments (no re-encode) and lay the music under them.
  const list = join(outDir, '.segments.txt');
  writeFileSync(list, segs.map(f => `file '${f}'`).join('\n'));
  const mp4 = join(outDir, opt('name', 'liberty.mp4'));
  const len = end - start;
  const ff = ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list];
  if (audio) ff.push('-ss', String(start), '-i', audio);
  ff.push('-map', '0:v', '-c:v', 'copy');
  if (audio) {
    ff.push('-map', '1:a', '-c:a', 'aac', '-b:a', '320k', '-t', String(len));
    if (fade) ff.push('-af', `afade=t=in:d=0.5,afade=t=out:st=${Math.max(0, len - 3)}:d=3`);
  }
  ff.push('-movflags', '+faststart', mp4);
  await ffmpeg(ff).done;
  [...segs, list].forEach(f => rmSync(f, { force: true }));
  console.log(`\nwrote ${mp4}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
await browser.close();
