// Hero objects that more than one observation draws: the quill, manuscript script,
// the wax seal. The coda's rewind replays the film's symbols through these too.

import { rgba } from '../theme.js';
import { TAU, clamp, lerp, mulberry32 } from '../engine.js';
import { stroke, circle, bezierPts, glow, arcPts } from './paths.js';
import { text } from './type.js';

/** Map local quill coordinates (along the shaft, across it) to the plate. */
const frame = (x, y, ang) => (u, v) => [x + u * Math.cos(ang) - v * Math.sin(ang), y + u * Math.sin(ang) + v * Math.cos(ang)];

/** A feather quill with its nib at (x, y), the shaft leaving at angle ang. */
export function quill(g, x, y, ang, s = 1, alpha = 1) {
  if (alpha <= 0) return;
  const F = frame(x, y, ang), P = (u, v) => F(u * s, v * s);
  const A = (a, w = 1.4) => ({ color: 'GOLD', alpha: a * alpha, width: w });
  // Nib and barrel
  stroke(g, [P(0, 0), P(22, -4.5), P(64, -4.2)], 1, { pen: A(1, 1.6), tip: false });
  stroke(g, [P(0, 0), P(22, 4.5), P(64, 4.2)], 1, { pen: A(1, 1.6), tip: false });
  stroke(g, [P(3, 0), P(15, 0)], 1, { pen: A(0.8, 1), tip: false });
  // Rachis
  stroke(g, [P(64, 0), P(330, 2)], 1, { pen: { color: 'GOLD_HOT', alpha: 0.9 * alpha, width: 1.6 }, tip: false });
  // Vane: wider on one side, curling to a tip
  const left = bezierPts(P(70, -4), P(130, -40), P(260, -44), P(336, -6), 30);
  const right = bezierPts(P(80, 4), P(150, 24), P(270, 26), P(336, -6), 30);
  stroke(g, left, 1, { pen: A(0.95, 1.4), tip: false });
  stroke(g, right, 1, { pen: A(0.8, 1.2), tip: false });
  // Barbs
  g.strokeStyle = rgba('GOLD', 0.45 * alpha); g.lineWidth = 0.9;
  g.beginPath();
  for (let u = 84; u < 326; u += 7) {
    const f = (u - 70) / 266, wl = 42 * Math.sin(Math.PI * Math.min(1, f * 1.08)), wr = 24 * Math.sin(Math.PI * Math.min(1, f * 1.04));
    const [a1, b1] = P(u, -1.5), [a2, b2] = P(u + 12, -wl), [c1, d1] = P(u, 1.5), [c2, d2] = P(u + 10, wr);
    g.moveTo(a1, b1); g.lineTo(a2, b2); g.moveTo(c1, d1); g.lineTo(c2, d2);
  }
  g.stroke();
}

/**
 * A line of manuscript: words of looping cursive as separate strokes.
 * Returns [{pts, u0, u1}] where u0..u1 is each word's share of the line's progress.
 */
export function scriptLine(x0, y, len, seed, o = {}) {
  const R = mulberry32(seed), words = [];
  let x = x0;
  const h = o.h ?? 9;
  while (x < x0 + len - 30) {
    const wl = Math.min(x0 + len - x, 40 + R() * 90), pts = [];
    const loops = Math.max(2, Math.round(wl / 11));
    for (let i = 0; i <= loops * 10; i++) {
      const u = i / (loops * 10), ph = u * loops * TAU;
      const amp = h * (0.55 + 0.45 * Math.sin(seed + i * 0.37 + R() * 0.3));
      pts.push([x + u * wl - Math.sin(ph) * 3.2, y - (1 - Math.cos(ph)) * 0.5 * amp + (R() - 0.5) * 0.8]);
    }
    words.push({ pts, x0: x, x1: x + wl });
    x += wl + 14 + R() * 10;
  }
  const L = x - x0;
  return words.map(w => ({ pts: w.pts, u0: (w.x0 - x0) / L, u1: (w.x1 - x0) / L }));
}

/** Draw a script line to progress p, returning the pen position. */
export function drawScript(g, words, p, pen = { color: 'GOLD', alpha: 0.8, width: 1.3 }) {
  let tip = null;
  for (const w of words) {
    const q = clamp((p - w.u0) / (w.u1 - w.u0));
    if (q <= 0) continue;
    const r = stroke(g, w.pts, q, { pen, tip: false });
    if (q < 1) { const i = Math.max(1, Math.floor(w.pts.length * q)); tip = w.pts[Math.min(w.pts.length - 1, i)]; }
    if (r) tip = r;
  }
  return tip;
}

/**
 * A stamped seal: scalloped rim, inner rings, a legend in data type. k is the stamp
 * (it lands from 1.35× with an expo-out); color is the wax.
 */
export function seal(s, g, cx, cy, r, k, o = {}) {
  if (k <= 0) return;
  const sc = lerp(1.35, 1, k), a = clamp(k * 3) * (o.alpha ?? 1);
  const R = r * sc;
  const rim = [];
  for (let i = 0; i <= 120; i++) { const t = (i / 120) * TAU; rim.push([cx + Math.cos(t) * R * (1 + 0.045 * Math.sin(t * 18)), cy + Math.sin(t) * R * (1 + 0.045 * Math.sin(t * 18))]); }
  if (o.wax) {
    g.fillStyle = rgba(o.wax, 0.88 * a);
    g.beginPath(); rim.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
  }
  stroke(g, rim, 1, { pen: { color: 'GOLD', alpha: 0.9 * a, width: 1.6 }, closed: true, tip: false });
  circle(g, cx, cy, R * 0.8, 1, { pen: { color: 'GOLD_HOT', alpha: 0.9 * a, width: 1.8 }, tip: false });
  circle(g, cx, cy, R * 0.72, 1, { pen: { color: 'GOLD', alpha: 0.6 * a, width: 1 }, tip: false });
  if (o.label) text(o.labelCtx || s.ui, o.label, cx, cy, { voice: 'dataBold', size: (o.labelSize ?? 30) * sc, alpha: a, fact: o.fact, scale: s.S, color: o.labelColor });
  // The stamp's shock ring
  const ring = 1 - k;
  if (ring > 0.01 && ring < 0.99) circle(g, cx, cy, R * (1.1 + 0.9 * (1 - ring)), 1, { pen: { color: 'GOLD_HOT', alpha: 0.6 * ring, width: 2 }, tip: false });
  if (k < 1) glow(g, cx, cy, R * 1.6, 'GOLD_HOT', 0.25 * (1 - k));
}


/**
 * The carbon-filament lamp, base at the bottom, at scale s (px per unit; the lamp is
 * about 1.6 units tall). o.explode (0..1) separates its parts along the axis like an
 * exploded view; o.lit (0..1) lights the filament; o.lw scales line widths.
 */
export function bulb(g, cx, cy, s, o = {}) {
  const ex = o.explode ?? 0, lit = o.lit ?? 0, lw = o.lw ?? 1, A = o.alpha ?? 1;
  if (A <= 0) return;
  const P = (x, y, dy = 0) => [cx + x * s, cy + (y + dy) * s];
  const pen = (a, w, c = 'GOLD') => ({ color: c, alpha: a * A, width: w * lw });
  const dEnv = -0.55 * ex, dStem = 0.22 * ex, dBase = 0.5 * ex;
  // Axis and alignment marks while exploded
  if (ex > 0.02) stroke(g, [P(0, -1.5), P(0, 1.4)], 1, { pen: pen(0.3 * ex, 1), tip: false, dash: [5 * lw, 6 * lw] });
  // Envelope: a sphere drawn down into the neck
  const env = [];
  for (let i = 0; i <= 48; i++) { const a = Math.PI * 0.62 + (i / 48) * Math.PI * 1.76; env.push(P(Math.cos(a) * 0.55, -0.55 + Math.sin(a) * 0.55, dEnv)); }
  const neckL = [env[0], P(-0.22, 0.2, dEnv), P(-0.2, 0.3, dEnv)], neckR = [env[env.length - 1], P(0.22, 0.2, dEnv), P(0.2, 0.3, dEnv)];
  stroke(g, env, 1, { pen: pen(0.95, 2.2, 'GOLD_HOT'), tip: false });
  stroke(g, neckL, 1, { pen: pen(0.9, 2), tip: false });
  stroke(g, neckR, 1, { pen: pen(0.9, 2), tip: false });
  // Highlight on the glass
  stroke(g, arcPts(cx - 0.2 * s, cy + (-0.72 + dEnv) * s, 0.26 * s, Math.PI * 1.05, Math.PI * 1.45, 12), 1, { pen: pen(0.6, 1.4), tip: false });
  // Filament (a carbon hairpin) on its lead-in wires, with the glass stem
  const fil = [P(-0.1, 0.05), P(-0.1, -0.5)].concat(arcPts(cx, cy - 0.5 * s, 0.1 * s, Math.PI, 2 * Math.PI, 16)).concat([P(0.1, -0.5), P(0.1, 0.05)]);
  if (lit > 0) {
    glow(g, cx, cy - 0.45 * s, 1.6 * s * (0.6 + 0.4 * lit), 'GOLD_HOT', 0.55 * lit * A);
    stroke(g, fil, 1, { pen: { color: 'WHITE', alpha: 0.9 * lit * A, width: 4 * lw }, tip: false });
  }
  stroke(g, fil, 1, { pen: pen(1, 1.6, lit > 0.2 ? 'GOLD_HOT' : 'GOLD'), tip: false });
  for (const sx of [-1, 1]) stroke(g, [P(sx * 0.1, 0.05), P(sx * 0.06, 0.3, dStem), P(sx * 0.06, 0.5, dBase)], 1, { pen: pen(0.8, 1.1), tip: false });
  stroke(g, [P(-0.12, 0.08, dStem), P(0.12, 0.08, dStem), P(0.07, 0.3, dStem), P(-0.07, 0.3, dStem)], 1, { pen: pen(0.8, 1.2), closed: true, tip: false });
  // Screw base with its thread, and the foot contact
  const b0 = 0.32;
  stroke(g, [P(-0.21, b0, dBase), P(0.21, b0, dBase), P(0.19, b0 + 0.42, dBase), P(-0.19, b0 + 0.42, dBase)], 1, { pen: pen(0.95, 1.8), closed: true, tip: false });
  for (let k = 0; k < 5; k++) stroke(g, [P(-0.21, b0 + 0.06 + k * 0.075, dBase), P(0.21, b0 + 0.1 + k * 0.075, dBase)], 1, { pen: pen(0.6, 1.1), tip: false });
  stroke(g, [P(-0.1, b0 + 0.42, dBase), P(-0.06, b0 + 0.52, dBase), P(0.06, b0 + 0.52, dBase), P(0.1, b0 + 0.42, dBase)], 1, { pen: pen(0.9, 1.4), tip: false });
}

/**
 * The 1947 point-contact transistor in elevation: a germanium block on its base, a
 * plastic wedge with two gold contacts pressed onto it, a spring above, three leads.
 * s ≈ 1 is about 200 px tall; centred on (cx, cy).
 */
export function transistor(g, cx, cy, s, o = {}) {
  const a = o.alpha ?? 1, lw = o.lw ?? 1, p = o.p ?? 1;
  if (a <= 0 || p <= 0) return;
  const P = (x, y) => [cx + x * s, cy + y * s];
  const pen = (c, al, w) => ({ color: c, alpha: al * a, width: w * lw });
  const q = k => Math.max(0, Math.min(1, p * 5 - k));
  // Base and germanium block
  stroke(g, [P(-90, 70), P(90, 70), P(90, 96), P(-90, 96)], q(0), { pen: pen('GOLD', 0.9, 1.6), closed: true, tip: false });
  stroke(g, [P(-46, 70), P(46, 70), P(46, 30), P(-46, 30)], q(0.5), { pen: pen('GOLD_HOT', 1, 2), closed: true, tip: false });
  // The wedge, point down on the germanium, with its gold foil contacts
  stroke(g, [P(-44, -60), P(44, -60), P(2, 28), P(-2, 28)], q(1.5), { pen: pen('GOLD', 0.95, 1.8), closed: true, tip: false });
  stroke(g, [P(-30, -60), P(-1, 28)], q(2), { pen: pen('GOLD_HOT', 1, 2.4), tip: false });
  stroke(g, [P(30, -60), P(1, 28)], q(2), { pen: pen('GOLD_HOT', 1, 2.4), tip: false });
  // Spring pressing the wedge down
  const spring = [];
  for (let i = 0; i <= 40; i++) spring.push(P(8 * Math.sin(i * 0.95), -64 - i * 1.6));
  stroke(g, spring, q(2.8), { pen: pen('GOLD', 0.8, 1.2), tip: false });
  stroke(g, [P(-30, -132), P(30, -132)], q(3), { pen: pen('GOLD', 0.9, 1.6), tip: false });
  // Leads: emitter, collector, base
  stroke(g, [P(-30, -60), P(-70, -100), P(-70, -150)], q(3.5), { pen: pen('GOLD', 0.85, 1.4), tip: false });
  stroke(g, [P(30, -60), P(70, -100), P(70, -150)], q(3.5), { pen: pen('GOLD', 0.85, 1.4), tip: false });
  stroke(g, [P(0, 96), P(0, 140)], q(3.8), { pen: pen('GOLD', 0.85, 1.4), tip: false });
  if (o.glint) glow(g, cx, cy + 28 * s, 30 * s + 10, 'GOLD_HOT', 0.6 * o.glint * a);
}
