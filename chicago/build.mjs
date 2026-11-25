// Bundles src/main.js + three.js + the map data into one self-contained HTML file.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const common = { bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, legalComments: 'none' };
// the tile builder runs in a Web Worker created from this string
const worker = (await build({ ...common, entryPoints: [join(here, 'src/worker.js')] })).outputFiles[0].text;
const result = await build({ ...common, entryPoints: [join(here, 'src/main.js')], define: { __METRO_WORKER__: JSON.stringify(worker) } });
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const data = readFileSync(join(here, 'data/city.json'), 'utf8').replace(/</g, '\\u003c');

// Chicagoland: tiled buildings/roads (gzip) and ground textures, embedded as base64
const M = join(here, 'data/metro');
let metro = '';
if (existsSync(join(M, 'metro.json'))) {
  const b64 = (f) => readFileSync(join(M, f)).toString('base64');
  metro += `<script id="metro-head" type="application/json">${readFileSync(join(M, 'metro.json'), 'utf8').replace(/</g, '\\u003c')}</script>\n`;
  metro += `<script id="metro-bin" type="text/plain">${b64('metro.bin.gz')}</script>\n`;
  metro += `<script id="metro-color" type="text/plain">${b64('color.webp')}</script>\n`;
  metro += `<script id="metro-lights" type="text/plain">${b64('lights.webp')}</script>\n`;
  for (const i of [0, 1]) for (const j of [0, 1]) metro += `<script id="metro-mask-${i}${j}" type="text/plain">${b64(`mask_${i}${j}.webp`)}</script>\n`;
}
const html = readFileSync(join(here, 'src/template.html'), 'utf8')
  .replace('<!--__METRO__-->', () => metro)
  .replace('/*__CITY_DATA__*/', () => data)
  .replace('/*__APP_JS__*/', () => js);
const out = join(here, 'chicago-3d.html');
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1048576).toFixed(2)} MB)`);
