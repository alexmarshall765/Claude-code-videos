// Gears, wheels and catenaries: the motif circle in its machine forms, and the curve a
// hanging cable makes. Machines move linearly, so callers drive rot with plain time.

import { rgba } from '../theme.js';
import { TAU, lerp, sub } from '../engine.js';
import { stroke, circle } from './paths.js';

/** Outline of a spur gear: pitch radius r, n teeth, tooth depth d, turned by rot. */
export function gearPts(cx, cy, r, n, rot = 0, d = r * 0.14) {
  const pts = [], ro = r + d / 2, ri = r - d / 2, pitch = TAU / n;
  for (let i = 0; i < n; i++) {
    const a = rot + i * pitch;
    // root, flank up, tip land, flank down (tooth tips narrower than roots)
    const q = [[a - pitch * 0.5, ri], [a - pitch * 0.24, ri], [a - pitch * 0.14, ro], [a + pitch * 0.14, ro], [a + pitch * 0.24, ri]];
    for (const [ang, rad] of q) pts.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad]);
  }
  pts.push(pts[0]);
  return pts;
}

/**
 * A spur gear with hub, bore and lightening holes. p draws it on: construction
 * circles first, then the teeth, then the hub.
 */
export function gear(g, cx, cy, r, n, rot, p = 1, o = {}) {
  if (p <= 0) return;
  const d = o.depth ?? r * 0.14;
  const cons = sub(p, 0, 0.3) * (1 - 0.8 * sub(p, 0.7, 1));
  if (cons > 0) {
    circle(g, cx, cy, r, cons, { pen: 'construction', tip: false, dash: [5, 6] });
    stroke(g, [[cx - r * 1.15, cy], [cx + r * 1.15, cy]], cons, { pen: 'construction', tip: false });
    stroke(g, [[cx, cy - r * 1.15], [cx, cy + r * 1.15]], cons, { pen: 'construction', tip: false });
  }
  stroke(g, gearPts(cx, cy, r, n, rot, d), sub(p, 0.15, 0.8), { pen: o.pen || { color: 'GOLD', alpha: 1, width: 2.2 }, tip: p < 0.8 });
  const hp = sub(p, 0.5, 1);
  if (hp > 0) {
    const hub = o.hub ?? r * 0.26;
    circle(g, cx, cy, hub, hp, { pen: { color: 'GOLD', alpha: 0.9, width: 1.8 }, tip: false, a0: rot });
    circle(g, cx, cy, hub * 0.4, hp, { pen: { color: 'GOLD_HOT', alpha: 0.9, width: 1.6 }, tip: false, a0: rot });
    circle(g, cx, cy, r - d * 1.1, hp, { pen: { color: 'GOLD', alpha: 0.45, width: 1 }, tip: false, a0: rot });
    const holes = o.holes ?? 6;
    for (let i = 0; i < holes; i++) {
      const a = rot + (i + 0.5) * TAU / holes, rr = lerp(hub, r - d * 1.1, 0.5);
      circle(g, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, (r - d * 1.1 - hub) * 0.3, hp, { pen: { color: 'GOLD', alpha: 0.6, width: 1.2 }, tip: false, a0: rot });
    }
    // Keyway mark turns with the gear so its motion reads.
    stroke(g, [[cx + Math.cos(rot) * hub * 0.4, cy + Math.sin(rot) * hub * 0.4], [cx + Math.cos(rot) * hub, cy + Math.sin(rot) * hub]], hp, { pen: { color: 'GOLD_HOT', alpha: 0.9, width: 2 }, tip: false });
  }
}

/**
 * Rotation of a gear with n2 teeth meshing with one of n1 teeth turned by rot1, its
 * centre in direction a from the first: a tooth facing it always meets a gap.
 */
export const meshRot = (rot1, n1, n2, a = 0) => -(rot1 - a) * (n1 / n2) + a + Math.PI - Math.PI / n2;

/** A spoked wheel (rim, tyre, hub, spokes). */
export function wheel(g, cx, cy, r, rot, p = 1, o = {}) {
  if (p <= 0) return;
  const P = o.pen || { color: 'GOLD', alpha: 1, width: 2 };
  circle(g, cx, cy, r, sub(p, 0, 0.5), { pen: P, tip: false, a0: rot });
  circle(g, cx, cy, r * 0.84, sub(p, 0.15, 0.6), { pen: { ...P, width: 1.2, alpha: (P.alpha ?? 1) * 0.7 }, tip: false, a0: rot });
  circle(g, cx, cy, r * 0.16, sub(p, 0.4, 0.7), { pen: P, tip: false });
  const n = o.spokes ?? 10, sp = sub(p, 0.5, 1);
  for (let i = 0; i < n; i++) {
    const a = rot + (i * TAU) / n;
    stroke(g, [[cx + Math.cos(a) * r * 0.16, cy + Math.sin(a) * r * 0.16], [cx + Math.cos(a) * r * 0.84, cy + Math.sin(a) * r * 0.84]], sp, { pen: { color: 'GOLD', alpha: 0.75 * (P.alpha ?? 1), width: 1.2 }, tip: false });
  }
}

/**
 * Catenary through (x0, y0) and (x1, y1) with parameter a (screen y points down, so the
 * cable hangs toward larger y). Returns n + 1 points.
 */
export function catenary(x0, y0, x1, y1, a, n = 64) {
  // Vertex x solves y0 − y1 = a·(cosh((x1 − xv)/a) − cosh((x0 − xv)/a)); the right side
  // falls as xv grows, so bisect.
  const f = xv => a * (Math.cosh((x1 - xv) / a) - Math.cosh((x0 - xv) / a)) - (y0 - y1);
  let lo = Math.min(x0, x1) - 20 * a, hi = Math.max(x0, x1) + 20 * a;
  for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (f(m) > 0) lo = m; else hi = m; }
  const xv = (lo + hi) / 2, yv = y0 + a * (Math.cosh((x0 - xv) / a) - 1);
  const pts = [];
  for (let i = 0; i <= n; i++) { const x = lerp(x0, x1, i / n); pts.push([x, yv - a * (Math.cosh((x - xv) / a) - 1)]); }
  return { pts, xv, yv, y: x => yv - a * (Math.cosh((x - xv) / a) - 1) };
}

/** Catenary parameter for a level span of half-width `half` that sags by `sag`. */
export function catenaryParam(half, sag) {
  let lo = half / 50, hi = half * 200;
  for (let i = 0; i < 80; i++) { const m = Math.sqrt(lo * hi); if (m * (Math.cosh(half / m) - 1) > sag) lo = m; else hi = m; }
  return Math.sqrt(lo * hi);
}

/** Rivet row: small circles along a segment (engraved plating). */
export function rivets(g, x0, y0, x1, y1, n, r = 2, a = 0.6) {
  g.strokeStyle = rgba('GOLD', a); g.lineWidth = 1;
  g.beginPath();
  for (let i = 0; i <= n; i++) { const x = lerp(x0, x1, i / n), y = lerp(y0, y1, i / n); g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); }
  g.stroke();
}

