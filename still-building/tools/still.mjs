#!/usr/bin/env node
/* Review stills.   node tools/still.mjs <t|shot[+local]>... [--scale 0.5] [--sheet name]
 *   node tools/still.mjs 4 12.5 statue+6            → out/stills/<name>.png each
 *   node tools/still.mjs --sheet act1 dawn+1 dawn+6 → one contact sheet PNG
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const here = join(dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright');
const args = process.argv.slice(2);
const take = n => { const i = args.indexOf(`--${n}`); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const scale = Number(take('scale') || 0.5), sheet = take('sheet');
const dir = join(here, 'out', 'stills'); mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1920 * scale, height: 1080 * scale } });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
await page.goto(pathToFileURL(join(here, 'index.html')).href + `?render&scale=${scale}`);
await page.waitForFunction(() => window.FILM, null, { timeout: 15000 }).catch(() => {});
if (errs.length) { console.error(errs.join('\n')); }
await page.evaluate(() => FILM.ready);
const files = [];
for (const a of args) {
  const r = await page.evaluate(a => {
    let t;
    if (/^[0-9.]+$/.test(a)) t = parseFloat(a);
    else { const [id, off] = a.split('+'); const sh = FILM.shots.find(s => s.id === id); if (!sh) return { err: 'no shot ' + id }; t = sh.t0 + parseFloat(off || 0); }
    const t0 = performance.now();
    try { FILM.renderAt(t); } catch (e) { return { err: e.stack || e.message }; }
    return { ms: Math.round(performance.now() - t0), png: FILM.canvas.toDataURL('image/png').slice(22) };
  }, a);
  if (r.err) { console.error(a, 'ERROR', r.err); continue; }
  const f = join(dir, `${a.replace(/[+.]/g, '_')}.png`);
  writeFileSync(f, Buffer.from(r.png, 'base64')); files.push(f);
  console.log(a, r.ms + 'ms');
}
if (errs.length) console.error([...new Set(errs)].join('\n'));
await browser.close();
if (sheet && files.length) {
  const cols = files.length <= 2 ? files.length : files.length <= 4 ? 2 : 3;
  const o = join(dir, `sheet_${sheet}.png`);
  const inputs = files.flatMap(f => ['-i', f]);
  const rows = Math.ceil(files.length / cols);
  const layout = files.map((_, i) => `${(i % cols) ? Array.from({ length: i % cols }, (_, k) => `w${k}`).join('+') : 0}_${Math.floor(i / cols) ? Array.from({ length: Math.floor(i / cols) }, (_, k) => `h${k * cols}`).join('+') : 0}`).join('|');
  const sc = files.map((_, i) => `[${i}:v]scale=640:360[s${i}]`).join(';');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex',
    `${sc};${files.map((_, i) => `[s${i}]`).join('')}xstack=inputs=${files.length}:layout=${layout}:fill=black[o]`, '-map', '[o]', '-frames:v', '1', o]);
  console.log('sheet', o, `${cols}x${rows}`);
}
