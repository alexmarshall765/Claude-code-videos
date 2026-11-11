/* =============================================================================
 *  ODE — drawing engine
 *  Light, atmosphere, silhouettes and type helpers shared by every scene.
 *
 *  Everything draws into "the current context" (ODE.use(ctx)), in a 1920×804
 *  picture space (2.39:1). film.js letterboxes that into the 1920×1080 frame.
 *  All randomness is seeded and every helper is a pure function of its
 *  arguments, so a frame depends only on its timestamp.
 * ========================================================================== */
(() => {
  'use strict';

  const W = 1920, H = 804;
  const TAU = Math.PI * 2;
  const O = (window.ODE = { W, H, TAU, shots: {} });
  let ctx = null;
  let BLUR = 1; // canvas scale; filter/shadow blur ignore transforms, so they are scaled by hand
  O.use = (c, scale = 1) => { ctx = c; BLUR = scale; };
  O.ctx = () => ctx;

  // ---------------------------------------------------------------------------
  // Math
  // ---------------------------------------------------------------------------
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const E = {
    lin: x => x,
    out: x => 1 - Math.pow(1 - x, 3),
    in: x => x * x * x,
    io: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    sine: x => 0.5 - 0.5 * Math.cos(Math.PI * x),
    expo: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    back: x => 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2),
  };
  /** Eased progress of t through the window [a, b]. */
  const seg = (t, a, b, e = E.io) => e(clamp((t - a) / (b - a)));
  /** 1 inside [a, b], with fades of length f at both ends. */
  const win = (t, a, b, f = 0.4) => clamp((t - a) / f) * clamp((b - t) / f);

  /** Deterministic PRNG (mulberry32). */
  function rng(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hash = (n, seed = 0) => {
    let x = Math.imul((n | 0) ^ (seed * 374761393), 668265263);
    x = Math.imul(x ^ (x >>> 13), 1274126177);
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  };
  /** Smooth 1-D value noise in 0..1. */
  function n1(x, seed = 0) {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return lerp(hash(i, seed), hash(i + 1, seed), u);
  }
  /** Fractal 1-D noise in 0..1. */
  function fbm(x, seed = 0, oct = 3) {
    let v = 0, a = 0.5, s = 0;
    for (let o = 0; o < oct; o++) { v += a * n1(x, seed + o * 17); s += a; x *= 2.03; a *= 0.5; }
    return v / s;
  }
  /** Candle-like flicker around 1. */
  const flicker = (t, seed = 0, amt = 0.12) => 1 - amt + amt * 2 * (0.6 * n1(t * 9, seed) + 0.4 * n1(t * 23, seed + 5));

  // ---------------------------------------------------------------------------
  // Colour & gradients
  // ---------------------------------------------------------------------------
  const hexCache = new Map();
  function rgb(hex) {
    let v = hexCache.get(hex);
    if (!v) {
      const h = hex.replace('#', '');
      const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
      v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      hexCache.set(hex, v);
    }
    return v;
  }
  /** '#rrggbb' + alpha -> css colour. */
  const col = (hex, a = 1) => { const c = rgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${clamp(a)})`; };
  /** Mix two hex colours. */
  function mix(h1, h2, t, a = 1) {
    const p = rgb(h1), q = rgb(h2);
    return `rgba(${Math.round(lerp(p[0], q[0], t))},${Math.round(lerp(p[1], q[1], t))},${Math.round(lerp(p[2], q[2], t))},${clamp(a)})`;
  }
  function lin(x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    for (const [o, c] of stops) g.addColorStop(clamp(o), c);
    return g;
  }
  function rad(x, y, r0, r1, stops) {
    const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
    for (const [o, c] of stops) g.addColorStop(clamp(o), c);
    return g;
  }

  // ---------------------------------------------------------------------------
  // Camera — slow push-ins with parallax. depth 0 = sky, 1 = subject, >1 = foreground.
  // ---------------------------------------------------------------------------
  function camera(p, { z0 = 1, z1 = 1.08, fx = W / 2, fy = H / 2, dx = 0, dy = 0, ease = E.lin } = {}) {
    const e = ease(clamp(p, 0, 1.25));
    return (depth, fn) => {
      const z = 1 + (lerp(z0, z1, e) - 1) * depth;
      ctx.save();
      ctx.translate(fx, fy);
      ctx.scale(z, z);
      ctx.translate(-fx + dx * e * depth, -fy + dy * e * depth);
      fn();
      ctx.restore();
    };
  }

  // ---------------------------------------------------------------------------
  // Light & atmosphere
  // ---------------------------------------------------------------------------
  /** Vertical gradient backdrop, oversized so camera moves never show an edge. */
  function sky(stops, y0 = 0, y1 = H) {
    ctx.fillStyle = lin(0, y0, 0, y1, stops);
    ctx.fillRect(-400, y0 - 400, W + 800, y1 - y0 + 800);
  }
  /** Soft additive glow. */
  function glow(x, y, r, hex, a = 1, mode = 'lighter') {
    if (a <= 0 || r <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = mode;
    ctx.fillStyle = rad(x, y, 0, r, [[0, col(hex, a)], [0.2, col(hex, a * 0.6)], [0.45, col(hex, a * 0.26)], [0.7, col(hex, a * 0.08)], [1, col(hex, 0)]]);
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }
  /** Anamorphic lens streak: a long horizontal flare through a bright source. */
  function flare(x, y, len, hex = '#9fd0ff', a = 0.5, thick = 5) {
    if (a <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y);
    ctx.scale(len / thick, 1);
    ctx.fillStyle = rad(0, 0, 0, thick, [[0, col(hex, a)], [0.3, col(hex, a * 0.4)], [1, col(hex, 0)]]);
    ctx.fillRect(-thick, -thick, thick * 2, thick * 2);
    ctx.restore();
  }
  /** A shaft of light from (x0,y0), width w0, to (x1,y1), width w1. */
  function beam(x0, y0, w0, x1, y1, w1, hex, a0 = 0.4, a1 = 0, layers = 3) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = lin(x0, y0, x1, y1, [[0, col(hex, a0 / layers)], [1, col(hex, a1 / layers)]]);
    for (let i = 0; i < layers; i++) {
      const k = 1 - i * (0.6 / layers);
      ctx.beginPath();
      ctx.moveTo(x0 + nx * w0 * k / 2, y0 + ny * w0 * k / 2);
      ctx.lineTo(x1 + nx * w1 * k / 2, y1 + ny * w1 * k / 2);
      ctx.lineTo(x1 - nx * w1 * k / 2, y1 - ny * w1 * k / 2);
      ctx.lineTo(x0 - nx * w0 * k / 2, y0 - ny * w0 * k / 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  /** Fan of volumetric rays from a point (god rays). */
  function rays(x, y, { n = 16, a0 = 0, a1 = TAU, len = 1400, hex = '#ffd98a', alpha = 0.16, t = 0, seed = 1, width = 0.6 } = {}) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const R = rng(seed);
    for (let i = 0; i < n; i++) {
      const base = lerp(a0, a1, (i + R() * 0.8) / n) + Math.sin(t * 0.13 + i) * 0.012;
      const w = ((a1 - a0) / n) * width * (0.35 + R() * 0.9);
      const a = alpha * (0.35 + 0.65 * n1(t * 0.35 + i * 3.7, seed)) * (0.5 + R() * 0.5);
      const l = len * (0.6 + R() * 0.4);
      ctx.fillStyle = rad(x, y, 0, l, [[0, col(hex, a)], [0.5, col(hex, a * 0.45)], [1, col(hex, 0)]]);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(base - w) * l, y + Math.sin(base - w) * l);
      ctx.lineTo(x + Math.cos(base + w) * l, y + Math.sin(base + w) * l);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  /** Dust motes drifting in light. `mask(x, y)` (0..1) can confine them to a beam. */
  function motes({ n = 80, x = 0, y = 0, w = W, h = H, seed = 7, t = 0, hex = '#ffe9b8', size = 2.2, speed = 1, alpha = 0.8, mask = null } = {}) {
    const R = rng(seed);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const bx = R(), by = R(), ph = R() * TAU, sp = (0.3 + R() * 0.7) * speed, sz = size * (0.35 + R() * R() * 1.6), tw = R() * 10;
      const px = x + ((bx + 0.012 * sp * t + 0.02 * Math.sin(t * 0.4 * sp + ph)) % 1) * w;
      const py = y + ((by + 1 - 0.01 * sp * t + 0.025 * Math.sin(t * 0.3 * sp + ph * 2)) % 1) * h;
      let a = alpha * (0.35 + 0.65 * Math.pow(n1(t * 0.9 + tw, seed + i), 2));
      if (mask) a *= mask(px, py);
      if (a < 0.02) continue;
      ctx.fillStyle = rad(px, py, 0, sz * 2.4, [[0, col(hex, a)], [0.4, col(hex, a * 0.35)], [1, col(hex, 0)]]);
      ctx.fillRect(px - sz * 2.4, py - sz * 2.4, sz * 4.8, sz * 4.8);
    }
    ctx.restore();
  }
  /** Horizontal band of mist. */
  function haze(y0, y1, hex, a0, a1 = 0) {
    ctx.fillStyle = lin(0, y0, 0, y1, [[0, col(hex, a0)], [1, col(hex, a1)]]);
    ctx.fillRect(-400, Math.min(y0, y1), W + 800, Math.abs(y1 - y0));
  }
  /** Twinkling star field. */
  function stars({ n = 300, seed = 3, t = 0, alpha = 1, x = -200, y = -200, w = W + 400, h = H + 200, hex = '#ffffff', size = 1.5 } = {}) {
    if (alpha <= 0) return;
    const R = rng(seed);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const px = x + R() * w, py = y + R() * h, m = Math.pow(R(), 3), tw = R() * 50;
      const a = alpha * (0.25 + 0.75 * m) * (0.7 + 0.3 * Math.sin(t * (1 + R() * 2) + tw));
      const r = size * (0.5 + m * 1.6);
      ctx.fillStyle = col(hex, a);
      ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill();
      if (m > 0.6) {
        ctx.fillStyle = rad(px, py, 0, r * 6, [[0, col(hex, a * 0.35)], [1, col(hex, 0)]]);
        ctx.fillRect(px - r * 6, py - r * 6, r * 12, r * 12);
      }
    }
    ctx.restore();
  }
  /** Soft cloud bank built from overlapping blobs along a noise line. */
  function clouds({ y = 200, amp = 60, n = 40, seed = 11, t = 0, hex = '#ffffff', alpha = 0.25, r = 150, drift = 6, mode = 'source-over', x0 = -300, x1 = W + 300 } = {}) {
    const R = rng(seed);
    ctx.save();
    ctx.globalCompositeOperation = mode;
    for (let i = 0; i < n; i++) {
      const span = x1 - x0;
      const px = x0 + ((R() * span + t * drift * (0.5 + R())) % span + span) % span;
      const py = y + (R() - 0.5) * 2 * amp, rr = r * (0.5 + R());
      const a = alpha * (0.4 + 0.6 * R());
      ctx.save();
      ctx.translate(px, py); ctx.scale(1.9, 1);
      ctx.fillStyle = rad(0, 0, 0, rr, [[0, col(hex, a)], [0.5, col(hex, a * 0.5)], [1, col(hex, 0)]]);
      ctx.fillRect(-rr, -rr, rr * 2, rr * 2);
      ctx.restore();
    }
    ctx.restore();
  }
  /** Rolling ridge line filled to the bottom of frame. */
  function hills(y, amp, freq, seed, fill, { x0 = -400, x1 = W + 400, yb = H + 400, oct = 3, off = 0, step = 16 } = {}) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x0, yb);
    for (let x = x0; x <= x1; x += step) ctx.lineTo(x, y - amp * (fbm((x + off) * freq, seed, oct) - 0.5) * 2);
    ctx.lineTo(x1, yb);
    ctx.closePath();
    ctx.fill();
  }
  const ridgeY = (x, y, amp, freq, seed, oct = 3, off = 0) => y - amp * (fbm((x + off) * freq, seed, oct) - 0.5) * 2;

  // ---------------------------------------------------------------------------
  // Shapes
  // ---------------------------------------------------------------------------
  function poly(pts, fill, stroke = null, lw = 1) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }
  function rect(x, y, w, h, fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }
  function rrect(x, y, w, h, r, fill, stroke = null, lw = 1) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }
  function circle(x, y, r, fill, stroke = null, lw = 1) {
    ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }
  function ellipse(x, y, rx, ry, fill, stroke = null, lw = 1, rot = 0) {
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }
  function line(x0, y0, x1, y1, stroke, lw = 1, cap = 'round') {
    ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineCap = cap;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  /** Stroke a polyline up to fraction p of its length; returns the pen tip. */
  function strokeP(pts, p, stroke, lw = 2) {
    if (p <= 0 || pts.length < 2) return pts[0];
    let total = 0; const L = [];
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(d); total += d; }
    let rem = total * clamp(p), end = pts[0];
    ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const d = L[i - 1];
      if (rem >= d) { ctx.lineTo(pts[i][0], pts[i][1]); rem -= d; end = pts[i]; }
      else { const f = d ? rem / d : 0; end = [lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)]; ctx.lineTo(end[0], end[1]); break; }
    }
    ctx.stroke();
    return end;
  }
  /** Tapered, round-ended limb. */
  function limb(x0, y0, x1, y1, w0, w1, fill) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    if (fill) ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x0 + nx * w0, y0 + ny * w0); ctx.lineTo(x1 + nx * w1, y1 + ny * w1);
    ctx.lineTo(x1 - nx * w1, y1 - ny * w1); ctx.lineTo(x0 - nx * w0, y0 - ny * w0);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(x0, y0, w0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x1, y1, w1, 0, TAU); ctx.fill();
  }
  /** Sample fn(u) -> [x, y] into n + 1 points. */
  const sample = (fn, n = 48) => { const a = []; for (let i = 0; i <= n; i++) a.push(fn(i / n)); return a; };
  function bez(p0, p1, p2, p3, u) {
    const v = 1 - u;
    return [v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
      v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]];
  }

  /** Fluted classical column: shaft with entasis, capital and base. (x = centre, yb = floor.) */
  function column(x, yb, w, h, { fill = '#2a1c12', lit = null, side = 1, flutes = 0, cap = true } = {}) {
    const top = yb - h, capH = cap ? w * 0.42 : 0, wt = w * 0.82;
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(x - w / 2, yb);
      ctx.quadraticCurveTo(x - w * 0.52, yb - h * 0.45, x - wt / 2, top + capH);
      if (cap) {
        ctx.lineTo(x - w * 0.58, top + capH * 0.45); ctx.lineTo(x - w * 0.66, top + capH * 0.38);
        ctx.lineTo(x - w * 0.66, top); ctx.lineTo(x + w * 0.66, top);
        ctx.lineTo(x + w * 0.66, top + capH * 0.38); ctx.lineTo(x + w * 0.58, top + capH * 0.45);
      }
      ctx.lineTo(x + wt / 2, top + capH);
      ctx.quadraticCurveTo(x + w * 0.52, yb - h * 0.45, x + w / 2, yb);
      ctx.closePath();
    };
    body();
    if (lit) {
      const a = side > 0 ? x + w / 2 : x - w / 2, b = side > 0 ? x - w / 2 : x + w / 2;
      ctx.fillStyle = lin(a, 0, b, 0, [[0, lit], [0.28, mix2(lit, fill, 0.55)], [0.7, fill], [1, fill]]);
    } else ctx.fillStyle = fill;
    ctx.fill();
    if (flutes > 0) {
      ctx.save(); body(); ctx.clip();
      for (let i = 1; i < flutes; i++) {
        const u = i / flutes, px = x - w / 2 + w * (0.5 - 0.5 * Math.cos(Math.PI * u));
        ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = Math.max(1, w * 0.018);
        ctx.beginPath(); ctx.moveTo(px, yb); ctx.lineTo(lerp(px, x, 0.16), top + capH); ctx.stroke();
      }
      ctx.restore();
    }
  }
  // css-colour mix for gradients whose endpoints may already be rgba strings
  function mix2(a, b, t) { return `color-mix(in srgb, ${a} ${Math.round((1 - t) * 100)}%, ${b})`; }

  /** Round or pointed (gothic) arch path between x0..x1 springing at ys, with legs down to yb. */
  function archPath(x0, x1, ys, yb, pointed = false, rise = null) {
    const w = x1 - x0, cx = (x0 + x1) / 2;
    ctx.moveTo(x0, yb); ctx.lineTo(x0, ys);
    if (pointed) {
      const r = rise ?? w * 0.95;
      ctx.quadraticCurveTo(x0 + w * 0.04, ys - r * 0.62, cx, ys - r);
      ctx.quadraticCurveTo(x1 - w * 0.04, ys - r * 0.62, x1, ys);
    } else ctx.arc(cx, ys, w / 2, Math.PI, 0);
    ctx.lineTo(x1, yb);
  }

  // ---------------------------------------------------------------------------
  // Figures — stylised, back-lit people. Feet at (x, y), total height h.
  // ---------------------------------------------------------------------------
  /**
   * opt: face (1 right / -1 left), fill, rim (colour), light (-1/1 screen side the rim light comes from),
   *      robe (bool), sit (bool), bend (radians, forward lean of the torso), lean (whole body),
   *      armF/armB: [shoulder, elbow] angles — 0 hangs down, PI/2 points forward, PI points up,
   *      head: 'plain'|'bald'|'beard'|'wild'|'hood'|'long'|'cap'|'tricorn'|'tophat'|'straw'|'bun',
   *      child (bool: larger head), stride (0..1 leg spread), tails (bool: tailcoat).
   * Returns the hand positions [[xF, yF], [xB, yB]] and head centre in screen space.
   */
  function figure(x, y, h, opt = {}) {
    const { face = 1, fill = '#1a110b', rim = null, light = 1, robe = true, sit = false, bend = 0, lean = 0,
      armF = [0.1, 0.1], armB = [-0.1, 0.1], head = 'plain', child = false, stride = 0.25, tails = false, nod = 0 } = opt;
    const hipY = sit ? -0.3 : -0.47, hr = child ? 0.1 : 0.068, torso = child ? 0.3 : 0.36;
    const shY = hipY - torso, sw = child ? 0.1 : 0.115, aw = child ? 0.045 : 0.05;
    const out = { hands: [], head: null };
    const M0i = ctx.getTransform().inverse();
    ctx.save();
    ctx.translate(x, y); ctx.scale(h * face, h); ctx.rotate(lean);
    const lf = light * face; // light side in local space
    const body = rim
      ? lin(lf * 0.24, 0, -lf * 0.2, 0, [[0, rim], [0.13, mix2(rim, fill, 0.45)], [0.36, fill], [1, fill]])
      : fill;
    ctx.fillStyle = sit ? fill : body; // seated legs reach far forward: keep them out of the rim light
    const limb = (x0, y0, x1, y1, w0, w1) => {
      const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      ctx.beginPath();
      ctx.moveTo(x0 + nx * w0, y0 + ny * w0); ctx.lineTo(x1 + nx * w1, y1 + ny * w1);
      ctx.lineTo(x1 - nx * w1, y1 - ny * w1); ctx.lineTo(x0 - nx * w0, y0 - ny * w0);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(x0, y0, w0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(x1, y1, w1, 0, TAU); ctx.fill();
    };
    // --- lower body
    if (sit) {
      limb(0, hipY, 0.24, hipY + 0.01, 0.075, 0.062);
      limb(0.24, hipY + 0.01, 0.26, -0.02, 0.058, 0.045);
      if (robe) { ctx.beginPath(); ctx.moveTo(-0.1, hipY - 0.04); ctx.lineTo(0.3, hipY - 0.05); ctx.lineTo(0.34, 0); ctx.lineTo(0.12, 0); ctx.lineTo(0.08, hipY + 0.09); ctx.lineTo(-0.1, hipY + 0.09); ctx.closePath(); ctx.fill(); }
      limb(0.26, -0.015, 0.33, -0.012, 0.03, 0.024);
    } else if (robe) {
      ctx.beginPath();
      ctx.moveTo(-0.115, hipY - 0.03);
      ctx.quadraticCurveTo(-0.14, -0.2, -0.16, 0);
      ctx.lineTo(0.17, 0);
      ctx.quadraticCurveTo(0.14, -0.2, 0.115, hipY - 0.03);
      ctx.closePath(); ctx.fill();
    } else {
      const s = stride * 0.2;
      limb(0, hipY, s, -0.24, 0.07, 0.05); limb(s, -0.24, s * 1.25, -0.02, 0.05, 0.038); limb(s * 1.25, -0.015, s * 1.25 + 0.06, -0.012, 0.03, 0.024);
      limb(0, hipY, -s, -0.24, 0.07, 0.05); limb(-s, -0.24, -s * 1.5, -0.02, 0.05, 0.038); limb(-s * 1.5, -0.015, -s * 1.5 + 0.06, -0.012, 0.03, 0.024);
      if (tails) { ctx.beginPath(); ctx.moveTo(-0.11, hipY - 0.05); ctx.quadraticCurveTo(-0.17, hipY + 0.12, -0.13, hipY + 0.24); ctx.lineTo(-0.03, hipY + 0.05); ctx.closePath(); ctx.fill(); }
    }
    // --- upper body, rotated about the hips
    ctx.translate(0, hipY); ctx.rotate(bend); ctx.translate(0, -hipY);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-sw, shY + 0.02);
    ctx.quadraticCurveTo(-sw - 0.012, shY - 0.03, -0.04, shY - 0.045);
    ctx.lineTo(0.04, shY - 0.045);
    ctx.quadraticCurveTo(sw + 0.012, shY - 0.03, sw, shY + 0.02);
    ctx.lineTo(robe ? 0.12 : 0.085, hipY + 0.02); ctx.lineTo(robe ? -0.12 : -0.085, hipY + 0.02);
    ctx.closePath(); ctx.fill();
    // arms
    const arm = (a, sx, reach) => {
      const ua = child ? 0.13 : 0.165, fa = child ? 0.125 : 0.16;
      if (reach) { // two-bone IK toward a point given in the caller's space
        const q = new DOMPoint(reach[0], reach[1]).matrixTransform(ctx.getTransform().inverse().multiply(M0i.inverse()));
        const dx = q.x - sx, dy = q.y - (shY + 0.03), dd = clamp(Math.hypot(dx, dy), Math.abs(ua - fa) + 0.01, ua + fa - 0.004);
        const al = Math.acos(clamp((ua * ua + dd * dd - fa * fa) / (2 * ua * dd), -1, 1)), be = Math.acos(clamp((ua * ua + fa * fa - dd * dd) / (2 * ua * fa), -1, 1));
        a = [Math.atan2(dx, dy) - al, Math.PI - be];
      }
      const ex = sx + Math.sin(a[0]) * ua, ey = shY + 0.03 + Math.cos(a[0]) * ua;
      const hx = ex + Math.sin(a[0] + a[1]) * fa, hy = ey + Math.cos(a[0] + a[1]) * fa;
      limb(sx, shY + 0.03, ex, ey, aw, aw * 0.85); limb(ex, ey, hx, hy, aw * 0.85, aw * 0.62);
      ctx.beginPath(); ctx.arc(hx, hy, aw * 0.8, 0, TAU); ctx.fill();
      return [hx, hy];
    };
    const hB = arm(armB, -sw * 0.55, opt.reachB), hF = arm(armF, sw * 0.55, opt.reachF);
    // head
    const hx = 0.012, hy = shY - 0.045 - hr * 0.95;
    ctx.translate(hx, hy + hr); ctx.rotate(nod); ctx.translate(-hx, -hy - hr);
    limb(0, shY - 0.03, hx, hy, 0.034, 0.034);
    ctx.beginPath(); ctx.ellipse(hx, hy, hr * 0.9, hr, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hx + hr * 0.8, hy - hr * 0.2); ctx.lineTo(hx + hr * 1.14, hy + hr * 0.22); ctx.lineTo(hx + hr * 0.8, hy + hr * 0.4); ctx.closePath(); ctx.fill(); // nose
    const blob = pts => { ctx.beginPath(); ctx.moveTo(hx + pts[0][0] * hr, hy + pts[0][1] * hr); for (let i = 1; i < pts.length; i++) ctx.lineTo(hx + pts[i][0] * hr, hy + pts[i][1] * hr); ctx.closePath(); ctx.fill(); };
    if (head === 'beard' || head === 'cap') blob([[0.95, 0.25], [1.0, 0.9], [0.6, 1.75], [0.05, 1.5], [-0.5, 0.9], [-0.3, 0.2]]);
    if (head === 'wild') {
      const R = rng(41); ctx.beginPath();
      for (let i = 0; i <= 22; i++) { const a = Math.PI * (0.92 + 1.3 * i / 22), r = hr * (i % 2 ? 1.32 + R() * 0.5 : 1.08); ctx.lineTo(hx - 0.01 + Math.cos(a) * r, hy + Math.sin(a) * r * 1.05); }
      ctx.closePath(); ctx.fill();
    }
    if (head === 'hood') blob([[1.05, -0.5], [0.5, -1.25], [-0.5, -1.3], [-1.25, -0.4], [-1.6, 1.3], [-0.2, 1.9], [0.9, 1.5], [0.75, 0.6]]);
    if (head === 'long' || head === 'bun') blob([[0.7, -0.95], [-0.2, -1.2], [-1.05, -0.7], [-1.3, 0.4], [-1.15, 1.9], [-0.35, 1.7], [-0.5, 0.2], [0.2, -0.75]]);
    if (head === 'bun') { ctx.beginPath(); ctx.arc(hx - hr * 1.15, hy - hr * 0.75, hr * 0.5, 0, TAU); ctx.fill(); }
    if (head === 'cap') blob([[1.3, -0.5], [0.9, -1.1], [0, -1.3], [-1.0, -1.0], [-1.25, -0.3], [-0.2, -0.55]]);
    if (head === 'tricorn') blob([[1.9, -0.5], [0.7, -1.25], [0, -1.5], [-0.9, -1.2], [-1.8, -0.35], [-0.6, -0.7], [0.5, -0.72]]);
    if (head === 'tophat') { blob([[1.6, -0.62], [-1.5, -0.62], [-1.5, -0.82], [1.6, -0.82]]); blob([[0.95, -0.8], [0.9, -2.3], [-0.9, -2.3], [-0.95, -0.8]]); }
    if (head === 'straw') blob([[2.3, -0.35], [1.0, -0.75], [0.6, -1.5], [-0.6, -1.5], [-1.0, -0.75], [-2.3, -0.35], [0, -0.6]]);
    // report anchor points in screen space
    const m = M0i.multiply(ctx.getTransform());
    const toScreen = (px, py) => { const q = new DOMPoint(px, py).matrixTransform(m); return [q.x, q.y]; };
    out.hands = [toScreen(hF[0], hF[1]), toScreen(hB[0], hB[1])];
    out.head = toScreen(hx, hy);
    ctx.restore();
    return out;
  }

  /** A packed crowd seen from behind/afar: rows of heads and shoulders. */
  function crowd({ x0 = 0, x1 = W, y = H, rows = 4, h = 90, seed = 5, fill = '#120c08', fill2 = null, density = 1, raise = 0.2, t = 0, hats = 0.3, sway = 1, depth = 0.82, rowGap = 0.36 } = {}) {
    const R = rng(seed);
    for (let r = rows - 1; r >= 0; r--) {
      const k = Math.pow(depth, r), hh = h * k, yy = y - r * h * rowGap * (0.6 + 0.4 * k);
      const step = hh * 0.52;
      ctx.fillStyle = fill2 ? mix2(fill2, fill, 1 - r / Math.max(1, rows - 1)) : fill;
      for (let px = x0 + R() * step; px < x1; px += step * (0.75 + R() * 0.5)) {
        const a = R(), b = R(), c = R(), d = R();
        if (a > density) continue;
        const bob = Math.sin(t * (1.5 + b * 2) + b * 20) * hh * 0.025 * sway, top = yy - hh * (0.85 + c * 0.25) + bob;
        const hr = hh * 0.16;
        ctx.beginPath(); ctx.ellipse(px, top + hr, hr * 0.9, hr, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.roundRect(px - hh * 0.26, top + hr * 1.9, hh * 0.52, hh * 1.4, hh * 0.16); ctx.fill();
        if (d < hats) { ctx.beginPath(); ctx.ellipse(px, top + hr * 0.35, hr * 1.7, hr * 0.32, 0, 0, TAU); ctx.fill(); ctx.fillRect(px - hr * 0.85, top - hr * 0.55, hr * 1.7, hr * 0.9); }
        if (b < raise) {
          const wv = Math.sin(t * (3 + c * 3) + a * 30) * 0.25 * sway, s = c < 0.5 ? -1 : 1;
          ctx.save(); ctx.translate(px + s * hh * 0.2, top + hr * 2.4); ctx.rotate(s * (0.35 + wv));
          ctx.beginPath(); ctx.roundRect(-hh * 0.05, -hh * 0.62, hh * 0.1, hh * 0.66, hh * 0.05); ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Type
  // ---------------------------------------------------------------------------
  const F = {
    display: '"Cinzel", "Trajan Pro", Georgia, serif',
    serif: '"Cormorant Garamond", Garamond, Georgia, serif',
    mono: '"IBM Plex Mono", "DejaVu Sans Mono", monospace',
    greek: '"GFS Didot", "DejaVu Serif", serif',
    black: '"UnifrakturMaguntia", "Cinzel", serif',
    script: '"Pinyon Script", "Cormorant Garamond", cursive',
  };
  function txt(s, x, y, o = {}) {
    const { size = 16, font = F.serif, weight = 400, italic = false, align = 'center', color = '#ffffff', a = 1, track = 0, base = 'middle', blur = 0, glowColor = null } = o;
    if (a <= 0) return 0;
    ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${font}`;
    ctx.letterSpacing = `${track}px`;
    ctx.textAlign = align; ctx.textBaseline = base;
    ctx.fillStyle = color.startsWith('#') ? col(color, a) : color;
    if (blur) { ctx.shadowColor = glowColor ? col(glowColor, a) : ctx.fillStyle; ctx.shadowBlur = blur * BLUR; }
    const dx = align === 'center' ? track / 2 : align === 'right' ? track : 0;
    ctx.fillText(s, x + dx, y);
    const w = ctx.measureText(s).width;
    ctx.letterSpacing = '0px'; ctx.shadowBlur = 0;
    return w;
  }

  Object.assign(O, {
    clamp, lerp, E, seg, win, rng, hash, n1, fbm, flicker,
    rgb, col, mix, mix2, lin, rad,
    camera, sky, glow, flare, beam, rays, motes, haze, stars, clouds, hills, ridgeY,
    poly, rect, rrect, circle, ellipse, line, limb, strokeP, sample, bez, column, archPath,
    figure, crowd, F, txt,
    blurPx: px => px * BLUR,
  });
})();
