// Web Worker entry: decompresses the Chicagoland data and builds tiles off the main thread.
import { createCore, transferables } from './metro-core.js';

let core = null;
self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'init') {
      const stream = new Blob([m.gz]).stream().pipeThrough(new DecompressionStream('gzip'));
      const buf = new Uint8Array(await new Response(stream).arrayBuffer());
      core = createCore(m.head, buf, m.downtown);
      const g = core.globals();
      self.postMessage({ type: 'ready', g }, transferables(g));
    } else if (m.type === 'tile') {
      const t = core.tile(m.id, m.trees);
      self.postMessage({ type: 'tile', id: m.id, t }, transferables(t));
    } else if (m.type === 'trees') {
      const tr = core.trees(m.id);
      self.postMessage({ type: 'trees', id: m.id, tr }, [tr.buffer]);
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: m.id, msg: String(err && err.stack || err) });
  }
};
