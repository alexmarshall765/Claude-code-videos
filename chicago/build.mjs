// Bundles src/main.js + three.js + data/city.json into one self-contained HTML file.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const result = await build({
  entryPoints: [join(here, 'src/main.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  write: false,
  legalComments: 'none',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const data = readFileSync(join(here, 'data/city.json'), 'utf8').replace(/</g, '\\u003c');
const html = readFileSync(join(here, 'src/template.html'), 'utf8')
  .replace('/*__CITY_DATA__*/', () => data)
  .replace('/*__APP_JS__*/', () => js);
const out = join(here, 'chicago-3d.html');
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1048576).toFixed(2)} MB)`);
