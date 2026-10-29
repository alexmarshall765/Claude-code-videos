#!/usr/bin/env node
// Bakes web/src/data/us_map.js from the us-atlas TopoJSON (states-10m.json, which
// is derived from public-domain Census Bureau boundaries). Keeps the 48 contiguous
// states and DC, projects them with the film's Albers projection into a map 1000
// units wide, simplifies every arc with Douglas–Peucker (shared arcs stay shared),
// then stitches the national outline, the interior state borders and the outline
// of each historical acquisition group.
//
//   node tools/build_map.mjs path/to/us-atlas/states-10m.json > web/src/data/us_map.js

import { readFileSync } from 'node:fs';
import { albers } from '../web/src/draw/projection.js';

const topo = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const WIDTH = 1000, TOL = 0.45, MIN_RING = 7;

// Present-day states grouped into the acquisitions of 1783–1848. Schematic: a state goes
// with the acquisition that holds most of it.
const GROUPS = {
  original: ['09', '10', '11', '13', '23', '24', '25', '33', '34', '36', '37', '42', '44', '45', '50', '51', '54'],
  treaty1783: ['01', '17', '18', '21', '26', '28', '39', '47', '55'],
  louisiana: ['05', '08', '19', '20', '22', '27', '29', '30', '31', '38', '40', '46', '56'],
  florida: ['12'],
  texas: ['48'],
  oregon: ['16', '41', '53'],
  cession: ['04', '06', '32', '35', '49'],
};
const ABBR = { '01': 'AL', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', 10: 'DE', 11: 'DC', 12: 'FL', 13: 'GA', 16: 'ID', 17: 'IL', 18: 'IN', 19: 'IA', 20: 'KS', 21: 'KY', 22: 'LA', 23: 'ME', 24: 'MD', 25: 'MA', 26: 'MI', 27: 'MN', 28: 'MS', 29: 'MO', 30: 'MT', 31: 'NE', 32: 'NV', 33: 'NH', 34: 'NJ', 35: 'NM', 36: 'NY', 37: 'NC', 38: 'ND', 39: 'OH', 40: 'OK', 41: 'OR', 42: 'PA', 44: 'RI', 45: 'SC', 46: 'SD', 47: 'TN', 48: 'TX', 49: 'UT', 50: 'VT', 51: 'VA', 53: 'WA', 54: 'WV', 55: 'WI', 56: 'WY' };
const KEEP = new Set(Object.keys(ABBR).map(k => String(k).padStart(2, '0')));

// --- decode the quantized, delta-encoded arcs to lon/lat, then project -----------
const { scale: [sx, sy], translate: [tx, ty] } = topo.transform;
const lonlat = topo.arcs.map(arc => { let x = 0, y = 0; return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; }); });
const states = topo.objects.states.geometries.filter(g => KEEP.has(g.id));
const used = new Set();
for (const g of states) for (const poly of g.type === 'Polygon' ? [g.arcs] : g.arcs) for (const ring of poly) for (const a of ring) used.add(a < 0 ? ~a : a);
const raw = lonlat.map(arc => arc.map(([lo, la]) => albers(lo, la)));
let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
for (const i of used) for (const [x, y] of raw[i]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
const k = WIDTH / (x1 - x0);
const norm = ([x, y]) => [(x - x0) * k, (y - y0) * k];

function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b], L = Math.hypot(bx - ax, by - ay) || 1e-9;
    let best = -1, bi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / L;
      if (d > best) { best = d; bi = i; }
    }
    if (best > tol) { keep[bi] = 1; stack.push([a, bi], [bi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const arcs = raw.map((arc, i) => (used.has(i) ? simplify(arc.map(norm), TOL) : null));
const arcPts = a => (a < 0 ? arcs[~a].slice().reverse() : arcs[a]);
const key = ([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`;
const r1 = v => Math.round(v * 10) / 10;
const pack = pts => pts.map(([x, y]) => [r1(x), r1(y)]);
const ringLen = pts => pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
const area = pts => pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;

/** Arcs used exactly once by a set of states form its outline; chain them into rings. */
function outline(ids) {
  const count = new Map(), uses = [];
  for (const g of states) {
    if (!ids.has(g.id)) continue;
    for (const poly of g.type === 'Polygon' ? [g.arcs] : g.arcs) for (const ring of poly) for (const a of ring) {
      const i = a < 0 ? ~a : a;
      count.set(i, (count.get(i) || 0) + 1);
      uses.push(a);
    }
  }
  const edges = uses.filter(a => count.get(a < 0 ? ~a : a) === 1).map(a => arcPts(a));
  const byStart = new Map();
  edges.forEach((e, j) => { const kk = key(e[0]); if (!byStart.has(kk)) byStart.set(kk, []); byStart.get(kk).push(j); });
  const done = new Uint8Array(edges.length), rings = [];
  for (let j = 0; j < edges.length; j++) {
    if (done[j]) continue;
    let ring = edges[j].slice(), cur = j; done[j] = 1;
    for (;;) {
      const next = (byStart.get(key(edges[cur][edges[cur].length - 1])) || []).find(m => !done[m]);
      if (next == null) break;
      done[next] = 1; ring = ring.concat(edges[next].slice(1)); cur = next;
    }
    if (ringLen(ring) >= MIN_RING) rings.push(pack(ring));
  }
  return rings.sort((a, b) => ringLen(b) - ringLen(a));
}

const all = new Set(states.map(g => g.id));
const nation = outline(all);
const borderCount = new Map();
for (const g of states) for (const poly of g.type === 'Polygon' ? [g.arcs] : g.arcs) for (const ring of poly) for (const a of ring) { const i = a < 0 ? ~a : a; borderCount.set(i, (borderCount.get(i) || 0) + 1); }
const borders = [...borderCount].filter(([, c]) => c === 2).map(([i]) => pack(arcs[i]));
const stateOut = {};
for (const g of states) {
  let rings = (g.type === 'Polygon' ? [g.arcs] : g.arcs).map(poly => poly[0].flatMap((a, j) => (j ? arcPts(a).slice(1) : arcPts(a))));
  rings.sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)));
  rings = rings.filter((r, j) => j === 0 || (r.length > 3 && ringLen(r) >= MIN_RING));
  const main = rings[0], A = area(main);
  let cx = 0, cy = 0;
  main.forEach((p, i) => { const q = main[(i + 1) % main.length], c = p[0] * q[1] - q[0] * p[1]; cx += (p[0] + q[0]) * c; cy += (p[1] + q[1]) * c; });
  stateOut[g.id] = { abbr: ABBR[Number(g.id)] || ABBR[g.id], name: g.properties.name, c: [r1(cx / (6 * A)), r1(cy / (6 * A))], rings: rings.map(pack) };
}
const groups = Object.fromEntries(Object.entries(GROUPS).map(([name, ids]) => [name, { states: ids, outline: outline(new Set(ids)) }]));
const missing = Object.values(GROUPS).flat().filter(id => !stateOut[id]);
if (missing.length) throw new Error(`unknown states in groups: ${missing}`);

const pts = nation.flat().length + borders.flat().length;
const out = {
  about: 'Contiguous United States from us-atlas 3.0.1 states-10m (Census Bureau boundaries, public domain; package ISC, Mike Bostock), Albers equal-area conic, simplified. Schematic.',
  width: WIDTH, height: r1((y1 - y0) * k), bounds: { x0, y0, k },
  nation, borders, states: stateOut, groups,
};
process.stdout.write(`// Generated by tools/build_map.mjs. Do not edit by hand.\n// ${out.about}\nexport const US = ${JSON.stringify(out)};\n`);
process.stderr.write(`map: ${Object.keys(stateOut).length} states, ${nation.length} outline rings, ${borders.length} borders, ${pts} outline points, ${out.width}×${out.height}\n`);
