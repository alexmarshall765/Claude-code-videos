/* =============================================================================
 *  STILL BUILDING — core: constants, math, deterministic randomness, colour.
 *  Everything in the film is a pure function of time, so a frame can be rendered
 *  in isolation (scrubbing, parallel chunk rendering) and always looks the same.
 * ========================================================================== */
'use strict';
const W = 1920, H = 1080;
const TAU = Math.PI * 2, D2R = Math.PI / 180;
/** Scene registry: SCENES[id](S) draws one frame of that shot (see film.js). */
const SCENES = {};

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const E = {
  lin: x => x,
  in: x => x * x * x,
  out: x => 1 - Math.pow(1 - x, 3),
  io: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  sine: x => 0.5 - 0.5 * Math.cos(Math.PI * x),
  expo: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  quadIn: x => x * x,
  quadOut: x => 1 - (1 - x) * (1 - x),
};
/** Eased progress of t through [a, b]. */
const seg = (t, a, b, e = E.io) => e(clamp((t - a) / (b - a)));
/** Fade envelope: 0 → 1 over [a, a+fi], hold, 1 → 0 over [b-fo, b]. */
const env = (t, a, b, fi = 0.6, fo = 0.6) => Math.min(smooth(a, a + fi, t), 1 - smooth(b - fo, b, t));

/** Deterministic PRNG (mulberry32). */
function rng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Stateless hash → [0,1). */
function h1(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function h2(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
/** 1-D smooth value noise. */
function n1(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(h1(i + seed * 57.3), h1(i + 1 + seed * 57.3), u);
}
/** Fractal 1-D noise in [0,1]. */
function fb1(x, seed = 0, oct = 4) {
  let a = 0.5, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += a * n1(x, seed + i * 13); n += a; x *= 2.03; a *= 0.5; }
  return s / n;
}

// ---- colour -----------------------------------------------------------------
/** "#rrggbb" → [r,g,b] in 0..1 (for shader uniforms). */
function hex(s) {
  const n = parseInt(s.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
/** [r,g,b] 0..1 (+ alpha) → css colour. */
const css = (c, a = 1) => `rgba(${Math.round(clamp(c[0]) * 255)},${Math.round(clamp(c[1]) * 255)},${Math.round(clamp(c[2]) * 255)},${a})`;
/** Mix two hex colours, return css. */
const mixHex = (a, b, t, al = 1) => css(mix3(hex(a), hex(b), t), al);

// ---- canvas helpers ---------------------------------------------------------
function poly(g, pts, close = true) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  if (close) g.closePath();
}
function fillPoly(g, pts) { poly(g, pts); g.fill(); }
function line(g, x0, y0, x1, y1, w) {
  if (w) g.lineWidth = w;
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
}
function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
function ellipse(g, x, y, rx, ry, rot = 0) { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); g.fill(); }
function rrect(g, x, y, w, h, r = 0) { g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); }
/** Soft radial glow (additive). */
function glow(g, x, y, r, col, a = 1, op = 'lighter') {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  for (let i = 0; i <= 12; i++) { const u = i / 12; gr.addColorStop(u, css(col, a * Math.exp(-u * 3.6) * (1 - u * u))); }   // smooth falloff: no visible rings
  g.save(); g.globalCompositeOperation = op; g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
}
/** Vertical linear gradient fill style. */
function vgrad(g, y0, y1, stops) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([p, c]) => gr.addColorStop(p, c));
  return gr;
}
/** A rolling ridge line (hills / dunes / mountains) as a filled silhouette. */
function ridge(g, { y, amp, freq, seed = 0, x0 = -100, x1 = W + 100, base = H + 50, off = 0, oct = 4, sharp = 0, step = 8 }) {
  g.beginPath(); g.moveTo(x0, base);
  for (let x = x0; x <= x1; x += step) {
    let n = fb1((x + off) * freq, seed, oct);
    if (sharp) n = 1 - Math.abs(2 * n - 1) * sharp - (1 - sharp) * (1 - n);
    g.lineTo(x, y - (n - 0.5) * 2 * amp);
  }
  g.lineTo(x1, base); g.closePath(); g.fill();
}
function ridgeY({ y, amp, freq, seed = 0, off = 0, oct = 4, sharp = 0 }, x) {
  let n = fb1((x + off) * freq, seed, oct);
  if (sharp) n = 1 - Math.abs(2 * n - 1) * sharp - (1 - sharp) * (1 - n);
  return y - (n - 0.5) * 2 * amp;
}
