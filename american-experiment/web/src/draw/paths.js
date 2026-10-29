// Line work. Every shape is a path that draws on with a length-based dash reveal,
// tipped by a bright drafting-pen head while it is still moving.

import { PEN, rgba } from '../theme.js';
import { TAU, clamp, lerp } from '../engine.js';

export function pathLength(pts, closed = false) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  if (closed && pts.length > 1) L += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
  return L;
}

/** Point at fraction p of a polyline's length. */
export function pointAt(pts, p, closed = false) {
  const P = closed ? pts.concat([pts[0]]) : pts;
  const total = pathLength(P);
  let rem = total * clamp(p);
  for (let i = 1; i < P.length; i++) {
    const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    if (rem <= d) { const f = d ? rem / d : 0; return [lerp(P[i - 1][0], P[i][0], f), lerp(P[i - 1][1], P[i][1], f), Math.atan2(P[i][1] - P[i - 1][1], P[i][0] - P[i - 1][0])]; }
    rem -= d;
  }
  const a = P[P.length - 1], b = P[Math.max(0, P.length - 2)];
  return [a[0], a[1], Math.atan2(a[1] - b[1], a[0] - b[0])];
}

/** Resolve a pen: a PEN name, or an object {color, alpha, width}. */
export function pen(g, p = 'structure', alphaMul = 1) {
  const P = typeof p === 'string' ? PEN[p] : { ...PEN.structure, ...p };
  g.strokeStyle = rgba(P.color, P.alpha * alphaMul);
  g.lineWidth = P.width;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  return P;
}

/** The drafting pen's head: a hot point with a small halo. */
export function penTip(g, x, y, k = 1, color = 'GOLD_HOT') {
  if (k <= 0) return;
  const r = 9 * k;
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, rgba(color, 0.95 * k)); gr.addColorStop(0.35, rgba(color, 0.45 * k)); gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr;
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}

/** The first fraction p (by length) of a polyline. */
export function cutPath(pts, p, closed = false) {
  const P = closed ? pts.concat([pts[0]]) : pts;
  if (p >= 1) return P;
  let rem = pathLength(P) * clamp(p);
  const out = [P[0]];
  for (let i = 1; i < P.length; i++) {
    const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    if (rem >= d) { out.push(P[i]); rem -= d; continue; }
    const f = d ? rem / d : 0;
    out.push([lerp(P[i - 1][0], P[i][0], f), lerp(P[i - 1][1], P[i][1], f)]);
    break;
  }
  return out;
}

/**
 * Stroke a polyline up to fraction p of its length.
 * o: { pen, alpha, width, closed, tip (default true while drawing), dash: [on, off] }
 */
export function stroke(g, pts, p = 1, o = {}) {
  if (p <= 0 || pts.length < 2) return null;
  pen(g, o.pen || 'structure', o.alpha ?? 1);
  if (o.width) g.lineWidth = o.width;
  const closed = !!o.closed;
  const P = p < 1 ? cutPath(pts, p, closed) : pts;
  if (P.length < 2) return null;
  g.beginPath();
  g.moveTo(P[0][0], P[0][1]);
  for (let i = 1; i < P.length; i++) g.lineTo(P[i][0], P[i][1]);
  if (closed && p >= 1) g.closePath();
  if (o.dash) g.setLineDash(o.dash);
  g.stroke();
  if (o.dash) g.setLineDash([]);
  if (p < 1 && o.tip !== false) {
    const [x, y] = P[P.length - 1];
    penTip(g, x, y, o.tipK ?? 1);
    return [x, y];
  }
  return null;
}

export function line(g, x1, y1, x2, y2, p = 1, o = {}) {
  return stroke(g, [[x1, y1], [x2, y2]], p, o);
}

export function arcPts(cx, cy, r, a0, a1, n = 96) {
  const pts = [];
  const steps = Math.max(2, Math.ceil(n * Math.abs(a1 - a0) / TAU));
  for (let i = 0; i <= steps; i++) {
    const a = lerp(a0, a1, i / steps);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

export function circle(g, cx, cy, r, p = 1, o = {}) {
  if (p <= 0) return null;
  const a0 = o.a0 ?? -Math.PI / 2, a1 = a0 + (o.dir ?? 1) * TAU * clamp(p);
  stroke(g, arcPts(cx, cy, r, a0, a1, o.n || 160), 1, { ...o, tip: false });
  if (p < 1 && o.tip !== false) {
    const x = cx + Math.cos(a1) * r, y = cy + Math.sin(a1) * r;
    penTip(g, x, y, o.tipK ?? 1);
    return [x, y];
  }
  return null;
}

export function ellipsePts(cx, cy, rx, ry, rot = 0, a0 = 0, a1 = TAU, n = 96) {
  const pts = [], c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i <= n; i++) {
    const a = lerp(a0, a1, i / n), x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    pts.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return pts;
}

export function bezierPts(p0, p1, p2, p3, n = 32) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, v = 1 - u;
    pts.push([
      v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
      v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1],
    ]);
  }
  return pts;
}

export function dot(g, x, y, r, color = 'GOLD_HOT', a = 1) {
  if (a <= 0) return;
  g.fillStyle = rgba(color, a);
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}

/** Soft radial glow, additive. */
export function glow(g, x, y, r, color = 'GOLD_HOT', a = 1) {
  if (a <= 0 || r <= 0) return;
  const prev = g.globalCompositeOperation;
  g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, rgba(color, a)); gr.addColorStop(0.4, rgba(color, a * 0.35)); gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr;
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.globalCompositeOperation = prev;
}

/** Engraved hatching inside a polygon instead of a flat fill. */
export function hatch(g, poly, p = 1, o = {}) {
  if (p <= 0) return;
  const angle = o.angle ?? Math.PI / 4, gap = o.gap ?? 7;
  const xs = poly.map(q => q[0]), ys = poly.map(q => q[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const R = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 + 2;
  g.save();
  g.beginPath(); poly.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.clip();
  pen(g, o.pen || { color: 'GOLD', alpha: o.alpha ?? 0.45, width: o.width ?? 1 });
  const c = Math.cos(angle), s = Math.sin(angle);
  g.beginPath();
  for (let d = -R; d <= -R + 2 * R * clamp(p); d += gap) {
    g.moveTo(cx + c * d - s * R, cy + s * d + c * R);
    g.lineTo(cx + c * d + s * R, cy + s * d - c * R);
  }
  g.stroke();
  g.restore();
}

/**
 * Blueprint dimension arrow between two points, with its label set in the
 * data voice on the annotation layer `ui`.
 */
export function dimension(g, ui, x1, y1, x2, y2, p, o = {}) {
  if (p <= 0) return;
  const ang = Math.atan2(y2 - y1, x2 - x1), nx = -Math.sin(ang), ny = Math.cos(ang);
  const P = { color: 'GOLD', alpha: o.alpha ?? 0.8, width: 1.2 };
  const ext = o.ext ?? 10;
  stroke(g, [[x1 - nx * ext, y1 - ny * ext], [x1 + nx * ext, y1 + ny * ext]], 1, { pen: P, tip: false });
  const mid = [lerp(x1, x2, 0.5), lerp(y1, y2, 0.5)];
  // Draw from the middle outwards so both arrowheads arrive together.
  const q = clamp(p);
  stroke(g, [mid, [lerp(mid[0], x1, q), lerp(mid[1], y1, q)]], 1, { pen: P, tip: false });
  stroke(g, [mid, [lerp(mid[0], x2, q), lerp(mid[1], y2, q)]], 1, { pen: P, tip: false });
  const head = (x, y, a) => stroke(g, [[x + Math.cos(a + 0.4) * 12, y + Math.sin(a + 0.4) * 12], [x, y], [x + Math.cos(a - 0.4) * 12, y + Math.sin(a - 0.4) * 12]], 1, { pen: P, tip: false });
  if (q >= 1) {
    stroke(g, [[x2 - nx * ext, y2 - ny * ext], [x2 + nx * ext, y2 + ny * ext]], 1, { pen: P, tip: false });
    head(x1, y1, ang); head(x2, y2, ang + Math.PI);
  }
}

/** A quarter-tone ruler of tick marks along a segment (for scales and gauges). */
export function ticks(g, x1, y1, x2, y2, n, len, p = 1, o = {}) {
  const ang = Math.atan2(y2 - y1, x2 - x1), nx = -Math.sin(ang), ny = Math.cos(ang);
  pen(g, o.pen || 'construction', o.alpha ?? 1);
  g.beginPath();
  const m = Math.floor(n * clamp(p));
  for (let i = 0; i <= m; i++) {
    const u = i / n, x = lerp(x1, x2, u), y = lerp(y1, y2, u), l = (o.major && i % o.major === 0) ? len * 1.8 : len;
    g.moveTo(x, y); g.lineTo(x + nx * l, y + ny * l);
  }
  g.stroke();
}

