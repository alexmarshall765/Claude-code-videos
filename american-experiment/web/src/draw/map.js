// The map plate: the contiguous states from us-atlas, baked by tools/build_map.mjs into
// one Albers frame 1000 units wide. A view places that frame on the plate; places go
// through the same projection, so cities, routes and outlines line up. Schematic.

import { US } from '../data/us_map.js';
import { albers } from './projection.js';
import { rgba } from '../theme.js';
import { clamp, lerp } from '../engine.js';
import { stroke, pen } from './paths.js';
import { text } from './type.js';

export { US };

/** Longitude, latitude → map units. */
export function mapXY(lon, lat) {
  const [x, y] = albers(lon, lat), b = US.bounds;
  return [(x - b.x0) * b.k, (y - b.y0) * b.k];
}

/** Place the map with its top-left corner at (x, y), w px wide. */
export function mapView(x, y, w) {
  const s = w / US.width;
  const M = ([u, v]) => [x + u * s, y + v * s];
  return {
    x, y, w, h: US.height * s, s, M,
    P: (lon, lat) => M(mapXY(lon, lat)),
    pts: arr => arr.map(M),
    route: lonlats => lonlats.map(([lo, la]) => M(mapXY(lo, la))),
  };
}

// Places the film visits, as [longitude, latitude].
export const CITY = {
  NYC: [-74.006, 40.713], BOS: [-71.059, 42.36], PHL: [-75.165, 39.953], BAL: [-76.612, 39.29], WAS: [-77.037, 38.907],
  RIC: [-77.436, 37.541], RAL: [-78.639, 35.78], ILM: [-77.945, 34.226], CHS: [-79.931, 32.776], SAV: [-81.099, 32.081],
  JAX: [-81.656, 30.332], MIA: [-80.192, 25.762], TPA: [-82.458, 27.951], ATL: [-84.388, 33.749], CHA: [-85.309, 35.046],
  KNX: [-83.921, 35.961], BNA: [-86.781, 36.163], MEM: [-90.049, 35.15], LIT: [-92.29, 34.746], BHM: [-86.802, 33.521],
  MOB: [-88.04, 30.695], MSY: [-90.072, 29.951], BTR: [-91.187, 30.452], HOU: [-95.37, 29.76], SAT: [-98.494, 29.424],
  AUS: [-97.743, 30.267], DAL: [-96.797, 32.777], OKC: [-97.516, 35.468], AMA: [-101.831, 35.222], ABQ: [-106.651, 35.084],
  ELP: [-106.485, 31.762], TUS: [-110.974, 32.222], PHX: [-112.074, 33.448], FLG: [-111.651, 35.198], BAR: [-117.017, 34.896],
  LAX: [-118.244, 34.052], SAN: [-117.161, 32.716], LAS: [-115.14, 36.17], SFO: [-122.419, 37.775], SAC: [-121.494, 38.582],
  RNO: [-119.813, 39.53], SLC: [-111.891, 40.761], PDX: [-122.676, 45.523], SEA: [-122.332, 47.606], GEG: [-117.426, 47.659],
  BOI: [-116.202, 43.615], BIL: [-108.501, 45.784], BTM: [-112.535, 46.004], MSO: [-113.994, 46.872], CYS: [-104.82, 41.14],
  DEN: [-104.99, 39.739], MKC: [-94.579, 39.1], STL: [-90.199, 38.627], OMA: [-95.934, 41.257], DSM: [-93.609, 41.587],
  MSP: [-93.265, 44.978], CHI: [-87.63, 41.878], MKE: [-87.906, 43.039], DET: [-83.046, 42.331], CLE: [-81.694, 41.499],
  TOL: [-83.538, 41.654], CMH: [-82.999, 39.961], IND: [-86.158, 39.768], SDF: [-85.759, 38.253], CVG: [-84.512, 39.103],
  PIT: [-79.996, 40.441], BUF: [-78.879, 42.887], ALB: [-73.756, 42.653], PVD: [-71.413, 41.824], ROC: [-77.611, 43.157],
  SYR: [-76.147, 43.049], FAR: [-96.79, 46.877], FSD: [-96.731, 43.546], DLH: [-92.101, 46.787], LRD: [-99.507, 27.531],
  ICT: [-97.336, 37.687], TUL: [-95.993, 36.154], JAN: [-90.185, 32.299], SHV: [-93.75, 32.525], LEX: [-84.504, 38.04],
  CLT: [-80.843, 35.227], CAE: [-81.035, 34.0], GSO: [-79.792, 36.073], GTF: [-111.3, 47.5], IDA: [-112.034, 43.492],
  EUG: [-123.087, 44.052], RDD: [-122.392, 40.587], BFL: [-119.019, 35.373], RAP: [-103.231, 44.08], BIS: [-100.783, 46.808],
  PWM: [-70.255, 43.661], BGR: [-68.772, 44.801], MGM: [-86.3, 32.367], TLH: [-84.281, 30.438], COV: [-112.58, 38.6],
  BUFWY: [-106.7, 44.35], MFR: [-122.873, 42.327], SUX: [-96.4, 42.5], HFD: [-72.685, 41.764], NHV: [-72.928, 41.308],
  MKG: [-90.0, 38.8], SBA: [-119.698, 34.42], MLO: [-122.182, 37.453],
};

/** A schematic Interstate network, each route through the cities it serves. */
export const INTERSTATES = [
  ['SAN', 'LAX', 'BFL', 'SAC', 'RDD', 'MFR', 'EUG', 'PDX', 'SEA'],
  ['LAX', 'PHX', 'TUS', 'ELP', 'SAT', 'HOU', 'BTR', 'MSY', 'MOB', 'TLH', 'JAX'],
  ['SAN', 'BAR', 'LAS', 'SLC', 'IDA', 'BTM', 'GTF'],
  ['ELP', 'ABQ', 'DEN', 'CYS', 'BUFWY'],
  ['LRD', 'SAT', 'AUS', 'DAL', 'OKC', 'ICT', 'MKC', 'DSM', 'MSP', 'DLH'],
  ['BAR', 'FLG', 'ABQ', 'AMA', 'OKC', 'LIT', 'MEM', 'BNA', 'KNX', 'GSO', 'RAL', 'ILM'],
  ['MSY', 'JAN', 'MEM', 'STL', 'CHI'],
  ['MOB', 'BHM', 'BNA', 'SDF', 'IND', 'CHI'],
  ['COV', 'DEN', 'MKC', 'STL', 'IND', 'CMH', 'PIT', 'BAL'],
  ['MIA', 'TPA', 'ATL', 'CHA', 'KNX', 'LEX', 'CVG', 'TOL', 'DET'],
  ['SFO', 'SAC', 'RNO', 'SLC', 'CYS', 'OMA', 'DSM', 'CHI', 'TOL', 'CLE', 'NYC'],
  ['SEA', 'GEG', 'MSO', 'BTM', 'BIL', 'RAP', 'FSD', 'CHI', 'TOL', 'CLE', 'BUF', 'ROC', 'SYR', 'ALB', 'BOS'],
  ['BIL', 'BIS', 'FAR', 'MSP', 'MKE', 'CHI', 'DET'],
  ['MIA', 'JAX', 'SAV', 'RIC', 'WAS', 'BAL', 'PHL', 'NYC', 'NHV', 'PVD', 'BOS', 'PWM', 'BGR'],
  ['DAL', 'SHV', 'JAN', 'BHM', 'ATL', 'CAE'],
  ['MGM', 'ATL', 'CLT', 'GSO', 'RIC'],
  ['PDX', 'BOI', 'SLC'],
  ['MKC', 'OMA', 'SUX', 'FSD', 'FAR'],
  ['OKC', 'TUL', 'STL'],
];
export const routePts = (view, codes) => codes.map(c => view.P(...CITY[c]));

function tracePath(g, view, rings) {
  for (const ring of rings) {
    const [x0, y0] = view.M(ring[0]);
    g.moveTo(x0, y0);
    for (let i = 1; i < ring.length; i++) { const [x, y] = view.M(ring[i]); g.lineTo(x, y); }
    g.closePath();
  }
}

/** Path of every ring of the given states (for clipping and fills). */
export function statesPath(g, view, ids) {
  g.beginPath();
  for (const id of ids) tracePath(g, view, US.states[id].rings);
}

/** The national outline, drawn on by length. */
export function outline(g, view, p, o = {}) {
  for (const ring of US.nation) stroke(g, view.pts(ring), p, { pen: o.pen || { color: 'GOLD', alpha: 0.9, width: 2 }, closed: true, tip: o.tip ?? p < 1 });
}

/** Interior state borders. sweep sets the order they appear in: 'west' starts in the east. */
export function borders(g, view, p, o = {}) {
  if (p <= 0) return;
  const P = o.pen || { color: 'GOLD', alpha: 0.32, width: 1 };
  for (const arc of US.borders) {
    const u = arc[0][0] / US.width;
    const start = (o.sweep === 'west' ? 1 - u : u) * 0.6;
    const q = clamp((p - start) / 0.4);
    if (q > 0) stroke(g, view.pts(arc), q, { pen: P, tip: false });
  }
}

/** Outline of an acquisition group. */
export function groupOutline(g, view, name, p, o = {}) {
  for (const ring of US.groups[name].outline) stroke(g, view.pts(ring), p, { pen: o.pen || { color: 'GOLD_HOT', alpha: 0.9, width: 2.2 }, closed: true, tip: o.tip ?? false });
}

/**
 * Engraved fill of a set of states: a faint wash and hatching anchored to the plate,
 * so neighbouring fills line up. k reveals it as a front sweeping across in `dir`
 * ('east', 'west', 'north', 'south').
 */
export function fillStates(g, view, ids, k, o = {}) {
  if (k <= 0) return;
  const rings = ids.flatMap(id => US.states[id].rings);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rings) for (const q of r) { const [x, y] = view.M(q); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  g.save();
  g.beginPath(); tracePath(g, view, rings); g.clip();
  // The reveal front
  const dir = o.dir || 'east', kk = clamp(k);
  if (kk < 1) {
    g.beginPath();
    if (dir === 'east') g.rect(x0 - 2, y0 - 2, (x1 - x0 + 4) * kk, y1 - y0 + 4);
    else if (dir === 'west') g.rect(x1 + 2 - (x1 - x0 + 4) * kk, y0 - 2, (x1 - x0 + 4) * kk, y1 - y0 + 4);
    else if (dir === 'south') g.rect(x0 - 2, y0 - 2, x1 - x0 + 4, (y1 - y0 + 4) * kk);
    else g.rect(x0 - 2, y1 + 2 - (y1 - y0 + 4) * kk, x1 - x0 + 4, (y1 - y0 + 4) * kk);
    g.clip();
  }
  if (o.tint) { g.fillStyle = rgba(o.color || 'GOLD', o.tint); g.fillRect(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4); }
  const angle = o.angle ?? -Math.PI / 4, gap = o.gap ?? 7;
  pen(g, { color: o.color || 'GOLD', alpha: o.alpha ?? 0.4, width: o.width ?? 1 });
  const c = Math.cos(angle), s = Math.sin(angle);
  // Lines c·y − s·x = d for d on a grid anchored at the map's origin.
  const ds = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => c * (y - view.y) - s * (x - view.x));
  const dMin = Math.floor(Math.min(...ds) / gap) * gap, dMax = Math.max(...ds);
  const L = Math.hypot(x1 - x0, y1 - y0) + 10, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  g.beginPath();
  for (let d = dMin; d <= dMax; d += gap) {
    // Point on the line nearest the box centre, then extend both ways.
    const t0 = c * (my - view.y) - s * (mx - view.x) - d;
    const px = mx + s * t0, py = my - c * t0;
    g.moveTo(px - c * L, py - s * L); g.lineTo(px + c * L, py + s * L);
  }
  g.stroke();
  g.restore();
  // The leading edge glows while the front is moving.
  if (kk < 1 && o.edge !== false) {
    let ex, ey0 = y0, ey1 = y1, ex0 = x0, ex1 = x1;
    if (dir === 'east') ex = lerp(x0, x1, kk); else if (dir === 'west') ex = lerp(x1, x0, kk);
    if (ex != null) {
      g.save(); g.beginPath(); tracePath(g, view, rings); g.clip();
      stroke(g, [[ex, ey0], [ex, ey1]], 1, { pen: { color: 'GOLD_HOT', alpha: 0.7, width: 1.6 }, tip: false });
      g.restore();
    } else {
      const ey = dir === 'south' ? lerp(y0, y1, kk) : lerp(y1, y0, kk);
      g.save(); g.beginPath(); tracePath(g, view, rings); g.clip();
      stroke(g, [[ex0, ey], [ex1, ey]], 1, { pen: { color: 'GOLD_HOT', alpha: 0.7, width: 1.6 }, tip: false });
      g.restore();
    }
  }
}

/** The plate's SCHEMATIC label, in small mono type at the map's lower right. */
export function schematic(s, view, alpha = 1, o = {}) {
  text(s.ui, 'SCHEMATIC', o.x ?? view.x + view.w, o.y ?? view.y + view.h + 6, { voice: 'data', size: 24, align: 'right', alpha: 0.6 * alpha, scale: s.S });
}
