#!/usr/bin/env node
/**
 * Offline renderer for LIBERTY.
 *
 * Drives index.html in headless Chromium, calls LIBERTY.renderAt(t) for every
 * frame (deterministic — never real time), and either writes numbered PNGs or
 * pipes them straight into FFmpeg.
 *
 *   node render.mjs                         # -> out/liberty.mp4 (1080p30, no audio)
 *   node render.mjs --fps 60                # 60 fps master
 *   node render.mjs --audio score.wav       # mux a music track (trimmed/faded to picture)
 *   node render.mjs --frames                # PNG sequence in out/frames/ instead of MP4
 *   node render.mjs --start 82 --end 92     # render a slice (e.g. just Apollo)
 *   node render.mjs --stills 4,13,30,95     # single PNG stills for review
 *   node render.mjs --theme parchment       # aged-parchment variant
 *   node render.mjs --scale 2               # 3840×2160 (4K UHD) master
 *
 * Requires: Node 18+, `npm i playwright` (or a preinstalled Playwright), ffmpeg on PATH.
 * Set CHROMIUM_PATH to use a specific Chromium/Chrome binary.
 */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
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
const audio = opt('audio', null);
const stills = opt('stills', null);
const crf = opt('crf', '14');
const scale = Number(opt('scale', 1));
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--force-color-profile=srgb', '--disable-gpu-vsync'],
});
const page = await browser.newPage({ viewport: { width: 1920 * scale, height: 1080 * scale }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.error('[page error]', e.message));
const url = pathToFileURL(join(here, 'index.html')).href + `?render&theme=${theme}&scale=${scale}`;
await page.goto(url);
await page.waitForFunction(() => window.LIBERTY);
await page.evaluate(() => window.LIBERTY.ready);
const DURATION = await page.evaluate(() => window.LIBERTY.DURATION);

/** Render time t and return PNG bytes. */
async function frame(t) {
  const b64 = await page.evaluate(t => {
    window.LIBERTY.renderAt(t);
    return document.getElementById('c').toDataURL('image/png').slice(22);
  }, t);
  return Buffer.from(b64, 'base64');
}

if (stills) {
  for (const s of stills.split(',').map(Number)) {
    const f = join(outDir, `still_${String(s).replace('.', '_')}s.png`);
    writeFileSync(f, await frame(s));
    console.log('wrote', f);
  }
  await browser.close();
  process.exit(0);
}

const start = Number(opt('start', 0));
const end = Math.min(Number(opt('end', DURATION)), DURATION);
const total = Math.round((end - start) * fps);
const t0 = Date.now();
const progress = i => {
  if (i % fps) return;
  const el = (Date.now() - t0) / 1000, eta = (el / (i + 1)) * (total - i);
  process.stdout.write(`\r  frame ${i}/${total}  ${(100 * i / total).toFixed(1)}%  eta ${eta.toFixed(0)}s   `);
};

if (flag('frames')) {
  const dir = join(outDir, 'frames');
  mkdirSync(dir, { recursive: true });
  for (let i = 0; i < total; i++) {
    writeFileSync(join(dir, `f_${String(i).padStart(5, '0')}.png`), await frame(start + i / fps));
    progress(i);
  }
  console.log(`\nPNG sequence in ${dir}`);
} else {
  const mp4 = join(outDir, opt('name', 'liberty.mp4'));
  const ff = [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
  ];
  if (audio) ff.push('-i', resolve(audio));
  ff.push('-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-pix_fmt', 'yuv420p',
    '-tune', 'animation', '-movflags', '+faststart', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709');
  if (audio) {
    const len = end - start;
    ff.push('-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '320k',
      '-af', `afade=t=in:d=0.5,afade=t=out:st=${Math.max(0, len - 3)}:d=3`, '-t', String(len));
  }
  ff.push(mp4);
  const proc = spawn('ffmpeg', ff, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((ok, fail) => proc.on('close', c => (c ? fail(new Error(`ffmpeg exited ${c}`)) : ok())));
  for (let i = 0; i < total; i++) {
    const png = await frame(start + i / fps);
    if (!proc.stdin.write(png)) await new Promise(r => proc.stdin.once('drain', r));
    progress(i);
  }
  proc.stdin.end();
  await done;
  console.log(`\nwrote ${mp4}`);
}
await browser.close();
