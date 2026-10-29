#!/usr/bin/env node
// Static server for the project. ES modules and fetch() need http://, not file://.
//   node render/serve.mjs [--port 8080]   then open http://localhost:8080/web/?preview
// capture.mjs reuses startServer() and receives frames on POST /frame/<n>.

import { createServer } from 'node:http';
import { createReadStream, statSync, existsSync } from 'node:fs';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.mp4': 'video/mp4',
  '.png': 'image/png', '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
};

/** Start the server. onFrame(n, buffer) receives captured frames. Resolves to { port, close }. */
export function startServer({ port = 0, root = ROOT, onFrame = null, quiet = true } = {}) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'POST' && url.pathname.startsWith('/frame/') && onFrame) {
      const n = parseInt(url.pathname.slice(7), 10);
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => { onFrame(n, Buffer.concat(chunks)); res.writeHead(204); res.end(); });
      return;
    }
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(root, path));
    if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    const size = statSync(file).size, type = TYPES[extname(file)] || 'application/octet-stream';
    const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
    if (range) { // the <audio> element seeks with range requests
      const start = range[1] ? parseInt(range[1], 10) : 0, end = range[2] ? parseInt(range[2], 10) : size - 1;
      res.writeHead(206, { 'content-type': type, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes', 'content-length': end - start + 1, 'cache-control': 'no-store' });
      createReadStream(file, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, { 'content-type': type, 'content-length': size, 'accept-ranges': 'bytes', 'cache-control': 'no-store' });
    createReadStream(file).pipe(res);
    if (!quiet) console.log(req.method, path);
  });
  return new Promise(ok => server.listen(port, '127.0.0.1', () => ok({ port: server.address().port, close: () => server.close() })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--port');
  const { port } = await startServer({ port: i > 0 ? Number(process.argv[i + 1]) : 8080, quiet: false });
  console.log(`serving ${ROOT}\n  preview: http://localhost:${port}/web/?preview\n  debug:   http://localhost:${port}/web/?preview&debug`);
}
