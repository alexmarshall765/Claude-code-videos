// Wireframe 3D by hand: rotate points about the vertical axis, divide by depth.
// Front lines are drawn bright and back lines dim, so the solids read without a renderer.

import { TAU, clamp, lerp, sub } from '../engine.js';
import { stroke } from './paths.js';

/**
 * Camera looking along +z at a vertical object. Units are the model's (feet).
 * cx, by: screen position of the model origin; k: px per unit at the axis;
 * yc: eye height; D: eye distance; yaw: rotation of the model.
 */
export function camera3d({ cx, by, k, yc = 120, D = 1100, yaw = 0 }) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return {
    cx, by, k, yc, D,
    project(x, y, z) {
      const xr = x * c - z * s, zr = x * s + z * c;
      const f = D / (D + zr);
      return [cx + xr * k * f, by - (yc + (y - yc) * f) * k, zr];
    },
  };
}

function drawSplit(g, pts, p, front, back, width, color = 'GOLD') {
  const n = Math.max(2, Math.ceil(pts.length * clamp(p)));
  let run = [], side = null;
  const flush = () => {
    if (run.length > 1) stroke(g, run, 1, { pen: { color: side ? color : 'GOLD', alpha: side ? front : back, width: side ? width : width * 0.6 }, tip: false });
  };
  for (let i = 0; i < n; i++) {
    const f = pts[i][2] <= 0;
    if (side === null) side = f;
    if (f !== side) { run.push(pts[i]); flush(); run = [pts[i]]; side = f; } else run.push(pts[i]);
  }
  flush();
}

/** Horizontal ring of radius r at height y around (ox, oz). */
export function ring(g, cam, y, r, p = 1, o = {}) {
  if (p <= 0 || r <= 0) return;
  const n = o.n || 56, a0 = o.a0 ?? -Math.PI / 2, pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * TAU;
    pts.push(cam.project((o.ox || 0) + Math.cos(a) * r, y, (o.oz || 0) + Math.sin(a) * r));
  }
  drawSplit(g, pts, p, o.front ?? 0.95, o.back ?? 0.22, o.width ?? 1.6, o.color);
}

/** Meridian lines of a (possibly tapering) section from y0/r0 to y1/r1. */
export function meridians(g, cam, y0, r0, y1, r1, n, p = 1, o = {}) {
  if (p <= 0) return;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + (o.a0 || 0);
    const q = sub(p, (i / n) * 0.35, (i / n) * 0.35 + 0.65);
    if (q <= 0) continue;
    const A = cam.project((o.ox || 0) + Math.cos(a) * r0, y0, (o.oz || 0) + Math.sin(a) * r0);
    const B = cam.project((o.ox || 0) + Math.cos(a) * r1, y1, (o.oz || 0) + Math.sin(a) * r1);
    const front = (A[2] + B[2]) / 2 <= 0;
    // Meridians crowd together toward the silhouette, so they are drawn lighter there.
    const side = Math.abs(Math.sin(a + (o.yaw || 0)));
    const alpha = front ? (o.front ?? 0.75) * (0.55 + 0.45 * side) : (o.back ?? 0.16);
    stroke(g, [A, [lerp(A[0], B[0], q), lerp(A[1], B[1], q)]], 1, { pen: { color: 'GOLD', alpha, width: front ? (o.width ?? 1.2) : 0.8 }, tip: false });
  }
}

/** Engraved bands: short horizontal arcs across [a0, a1], front side only. */
export function hatchBand(g, cam, y0, y1, r, a0, a1, p = 1, o = {}) {
  if (p <= 0) return;
  const step = o.step ?? 2.6;
  for (let y = y0; y <= y1; y += step) {
    if ((y - y0) / (y1 - y0 || 1) > p) break;
    const pts = [];
    for (let i = 0; i <= 10; i++) { const a = lerp(a0, a1, i / 10); pts.push(cam.project(Math.cos(a) * r * 1.002, y, Math.sin(a) * r * 1.002)); }
    if (pts.every(q => q[2] > 0)) continue;
    const vis = pts.filter(q => q[2] <= 0);
    if (vis.length > 1) stroke(g, vis, 1, { pen: { color: 'GOLD', alpha: o.alpha ?? 0.4, width: 1 }, tip: false });
  }
}

// ---------------------------------------------------------------------------
// Saturn V, in feet: y = 0 at the F-1 nozzle exits, 363 at the escape-tower tip.
// Six stacking groups so the vehicle can be assembled stage by stage.
// ---------------------------------------------------------------------------
export const SATURN_GROUPS = [
  { name: 'S-IC · FIRST STAGE', labelY: 80, r: 16.5 },
  { name: 'S-II · SECOND STAGE', labelY: 175, r: 16.5 },
  { name: 'S-IVB · THIRD STAGE', labelY: 250, r: 10.85 },
  { name: 'INSTRUMENT UNIT', labelY: 284, r: 10.85 },
  { name: 'COMMAND & SERVICE MODULE', labelY: 318, r: 6.4 },
  { name: 'LAUNCH ESCAPE SYSTEM', labelY: 350, r: 1.6 },
];
export const SATURN_BASE = { 0: 0, 1: 138, 2: 212, 3: 278, 4: 309, 5: 330 };
const F1 = [[0, 0], [9, 9], [-9, 9], [9, -9], [-9, -9]].map(([x, z]) => [x * 0.75, z * 0.75]);

/**
 * Draw the vehicle. gp[i] = draw-on progress of group i, dy[i] = its lift (ft) above
 * its seat while it is lowered into place. skip = { below: y } hides everything under a
 * height (after staging), and `drop` = { y, dy, tilt } draws the separated stage falling away.
 */
export function saturnV(g, cam, gp, dy = [], o = {}) {
  const yaw = o.yaw || 0;
  const pr = i => gp[i] || 0, off = i => dy[i] || 0;
  const RING = (y, r, q, i, extra = {}) => ring(g, cam, y + off(i), r, q, { front: 0.95, back: 0.2, width: 1.7, ...extra });
  const MER = (y0, r0, y1, r1, n, q, i, extra = {}) => meridians(g, cam, y0 + off(i), r0, y1 + off(i), r1, n, q, { yaw, ...extra });
  const hidden = i => (o.hide || []).includes(i);

  // 0: F-1 engines, S-IC, fins
  if (pr(0) > 0 && !hidden(0)) {
    const p0 = pr(0);
    F1.forEach(([ex, ez], j) => {
      const q = sub(p0, 0.02 * j, 0.3 + 0.02 * j);
      ring(g, cam, 0 + off(0), 5.6, q, { ox: ex, oz: ez, n: 28, width: 1.4, front: 0.9, back: 0.25 });
      ring(g, cam, 17 + off(0), 2.6, q, { ox: ex, oz: ez, n: 20, width: 1.1, front: 0.8, back: 0.2 });
      meridians(g, cam, 0 + off(0), 5.6, 17 + off(0), 2.6, 6, q, { ox: ex, oz: ez, yaw, front: 0.7, back: 0.14 });
    });
    [19, 46, 60, 100, 120, 138].forEach((y, j) => RING(y, 16.5, sub(p0, 0.15 + j * 0.06, 0.45 + j * 0.06), 0, { width: j === 0 || j === 5 ? 2.2 : 1.4 }));
    MER(19, 16.5, 138, 16.5, 16, sub(p0, 0.3, 0.95), 0);
    // Fins and engine fairings
    for (let j = 0; j < 4; j++) {
      const a = Math.PI / 4 + (j * Math.PI) / 2, ca = Math.cos(a), sa = Math.sin(a);
      const P = (rad, y) => cam.project(ca * rad, y + off(0), sa * rad);
      const pts = [P(16.5, 46), P(25.5, 22), P(25.5, 9), P(16.5, 19)];
      const front = pts.reduce((s, q) => s + q[2], 0) <= 0;
      stroke(g, pts, sub(p0, 0.55, 0.85), { pen: { color: 'GOLD', alpha: front ? 0.95 : 0.25, width: front ? 1.8 : 1 }, tip: false });
    }
    hatchBand(g, cam, 19 + off(0), 58 + off(0), 16.5, -0.1, Math.PI / 2 - 0.1, sub(p0, 0.7, 1), { alpha: 0.42 });
    hatchBand(g, cam, 19 + off(0), 58 + off(0), 16.5, Math.PI - 0.1, 1.5 * Math.PI - 0.1, sub(p0, 0.7, 1), { alpha: 0.42 });
    hatchBand(g, cam, 102 + off(0), 136 + off(0), 16.5, Math.PI / 2 - 0.1, Math.PI - 0.1, sub(p0, 0.75, 1), { alpha: 0.42 });
  }
  // 1: S-II (+ interstage skirt)
  if (pr(1) > 0 && !hidden(1)) {
    const p1 = pr(1);
    [138, 150, 175, 196, 212].forEach((y, j) => RING(y, 16.5, sub(p1, j * 0.08, 0.4 + j * 0.08), 1, { width: j === 0 || j === 4 ? 2.1 : 1.3 }));
    MER(138, 16.5, 212, 16.5, 16, sub(p1, 0.25, 0.95), 1);
    hatchBand(g, cam, 140 + off(1), 150 + off(1), 16.5, Math.PI / 2 - 0.1, Math.PI - 0.1, sub(p1, 0.7, 1), { alpha: 0.42 });
  }
  // 2: interstage taper + S-IVB
  if (pr(2) > 0 && !hidden(2)) {
    const p2 = pr(2);
    RING(212, 16.5, sub(p2, 0, 0.35), 2, { width: 1.6 });
    MER(212, 16.5, 222, 10.85, 16, sub(p2, 0.1, 0.5), 2);
    [222, 236, 254, 278].forEach((y, j) => RING(y, 10.85, sub(p2, 0.2 + j * 0.08, 0.55 + j * 0.08), 2, { width: j === 0 || j === 3 ? 2 : 1.3 }));
    MER(222, 10.85, 278, 10.85, 12, sub(p2, 0.4, 0.95), 2);
    hatchBand(g, cam, 224 + off(2), 246 + off(2), 10.85, -0.1, Math.PI / 2 - 0.1, sub(p2, 0.7, 1), { alpha: 0.42, step: 2.2 });
  }
  // 3: instrument unit + spacecraft adapter
  if (pr(3) > 0 && !hidden(3)) {
    const p3 = pr(3);
    RING(281, 10.85, sub(p3, 0, 0.4), 3, { width: 2 });
    MER(278, 10.85, 281, 10.85, 24, sub(p3, 0, 0.4), 3, { front: 0.5 });
    MER(281, 10.85, 309, 6.4, 12, sub(p3, 0.3, 0.9), 3);
    RING(309, 6.4, sub(p3, 0.6, 1), 3, { width: 1.8 });
  }
  // 4: service module + command module
  if (pr(4) > 0 && !hidden(4)) {
    const p4 = pr(4);
    MER(309, 6.4, 319, 6.4, 10, sub(p4, 0, 0.5), 4);
    RING(319, 6.4, sub(p4, 0.2, 0.6), 4, { width: 1.8 });
    MER(319, 6.4, 330, 1.6, 10, sub(p4, 0.4, 0.95), 4);
    RING(330, 1.6, sub(p4, 0.7, 1), 4, { n: 20 });
  }
  // 5: launch escape tower, motor and nose
  if (pr(5) > 0 && !hidden(5)) {
    const p5 = pr(5);
    for (let j = 0; j < 4; j++) {
      const a = (j * Math.PI) / 2 + Math.PI / 4;
      const A = cam.project(Math.cos(a) * 1.6, 330 + off(5), Math.sin(a) * 1.6), B = cam.project(Math.cos(a) * 1.0, 345 + off(5), Math.sin(a) * 1.0);
      stroke(g, [A, B], sub(p5, 0, 0.5), { pen: { color: 'GOLD', alpha: A[2] <= 0 ? 0.9 : 0.3, width: 1.1 }, tip: false });
    }
    MER(345, 1.4, 358, 1.4, 6, sub(p5, 0.35, 0.8), 5, { width: 1.3 });
    RING(345, 1.4, sub(p5, 0.3, 0.6), 5, { n: 16, width: 1.3 });
    MER(358, 1.4, 363, 0.05, 6, sub(p5, 0.65, 1), 5, { width: 1.3 });
  }
  // Highlights: a hot silhouette along the lit edge once each group is complete.
  if (o.edge) {
    const edgeA = o.edge;
    const prof = [[0, 16.5, 19, 138], [1, 16.5, 138, 212], [2, 10.85, 222, 278]];
    for (const [i, r, y0, y1] of prof) {
      if (pr(i) < 1 || hidden(i)) continue;
      for (const sd of [-1, 1]) {
        const a = sd > 0 ? -yaw : Math.PI - yaw;
        const A = cam.project(Math.cos(a) * r, y0 + off(i), Math.sin(a) * r), B = cam.project(Math.cos(a) * r, y1 + off(i), Math.sin(a) * r);
        stroke(g, [A, B], 1, { pen: { color: 'GOLD_HOT', alpha: 0.85 * edgeA, width: 2.2 }, tip: false });
      }
    }
  }
}

/** Screen positions of the five F-1 nozzle centres (for the exhaust plume). */
export const nozzles = (cam, y = 0) => F1.map(([x, z]) => cam.project(x, y, z));

