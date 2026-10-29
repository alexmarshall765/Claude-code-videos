// Charts in the film's line language: axes that draw on, data curves that grow from
// their first point, and a tip that readouts can ride. Labels are data type (24 px+)
// on the annotation layer and always cite their fact.

import { clamp, lerp } from '../engine.js';
import { stroke, penTip, glow, pointAt } from './paths.js';
import { text } from './type.js';

/** Scales for a chart box {x, y, w, h}: X(v) and Y(v), y optionally logarithmic. */
export function scales(box, xDom, yDom, o = {}) {
  const ly = o.log ? v => Math.log10(Math.max(v, 1e-12)) : v => v;
  const [y0, y1] = [ly(yDom[0]), ly(yDom[1])];
  return {
    box,
    X: v => box.x + ((v - xDom[0]) / (xDom[1] - xDom[0])) * box.w,
    Y: v => box.y + box.h - ((ly(v) - y0) / (y1 - y0)) * box.h,
  };
}

/** L-shaped axes with optional ticks at x values (and their labels). */
export function axes(s, g, sc, p, o = {}) {
  if (p <= 0) return;
  const { x, y, w, h } = sc.box;
  const P = o.pen || { color: 'GOLD', alpha: 0.7, width: 1.5 };
  stroke(g, [[x, y], [x, y + h]], clamp(p * 2), { pen: P, tip: false });
  stroke(g, [[x, y + h], [x + w, y + h]], clamp(p * 2 - 0.5), { pen: P, tip: false });
  const lp = clamp(p * 2 - 1);
  for (const v of o.xTicks || []) {
    const tx = sc.X(v);
    stroke(g, [[tx, y + h], [tx, y + h + 8]], lp, { pen: P, tip: false });
    if (o.xLabels !== false) text(s.ui, o.format ? o.format(v) : String(v), tx, y + h + 28, { voice: 'data', size: 24, alpha: 0.75 * lp * (o.alpha ?? 1), fact: o.fact, scale: s.S });
  }
  for (const v of o.yGrid || []) {
    const ty = sc.Y(v);
    stroke(g, [[x, ty], [x + w, ty]], lp, { pen: { color: 'GOLD', alpha: 0.18, width: 1 }, tip: false, dash: [4, 6] });
  }
  if (o.title) text(s.ui, o.title, x, y - 26, { voice: 'data', size: 24, align: 'left', alpha: 0.85 * lp * (o.alpha ?? 1), fact: o.titleFact, scale: s.S });
}

/** Smooth a data series with a Catmull–Rom spline sampled n times per segment. */
export function smooth(pts, n = 10) {
  if (pts.length < 3) return pts;
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let j = 0; j < n; j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(k => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/**
 * Draw a series [[x, y], ...] up to fraction p of its x range (not its length, so
 * time moves at a steady rate along the axis). Returns the tip [x, y].
 */
export function series(g, sc, data, p, o = {}) {
  if (p <= 0) return null;
  const pts = data.map(([u, v]) => [sc.X(u), sc.Y(v)]);
  const path = o.smooth === false ? pts : smooth(pts, o.n || 10);
  const xEnd = lerp(path[0][0], path[path.length - 1][0], clamp(p));
  const cut = [];
  for (let i = 0; i < path.length; i++) {
    if (path[i][0] <= xEnd) { cut.push(path[i]); continue; }
    const a = path[i - 1], b = path[i], f = (xEnd - a[0]) / (b[0] - a[0] || 1);
    cut.push([xEnd, lerp(a[1], b[1], f)]);
    break;
  }
  if (cut.length < 2) cut.push(cut[0]);
  if (o.area) {
    // Engraved area under the curve: vertical rules down to the axis.
    g.strokeStyle = o.areaStyle; g.lineWidth = 1;
    g.beginPath();
    const base = sc.box.y + sc.box.h, step = o.areaGap || 8;
    for (let x = cut[0][0]; x <= cut[cut.length - 1][0]; x += step) {
      const yv = yAt(cut, x);
      g.moveTo(x, base); g.lineTo(x, yv);
    }
    g.stroke();
  }
  stroke(g, cut, 1, { pen: o.pen || { color: 'GOLD_HOT', alpha: 1, width: 3 }, tip: false, dash: o.dash });
  const tip = cut[cut.length - 1];
  if (p < 1 && o.tip !== false) { penTip(g, tip[0], tip[1], 1.2); glow(g, tip[0], tip[1], 26, 'GOLD_HOT', 0.35); }
  return tip;
}

/** y of a polyline (sorted by x) at x. */
export function yAt(pts, x) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (pts[i][0] >= x) {
    const a = pts[i - 1], b = pts[i], f = (x - a[0]) / (b[0] - a[0] || 1);
    return lerp(a[1], b[1], f);
  }
  return pts[pts.length - 1][1];
}

export { pointAt };
