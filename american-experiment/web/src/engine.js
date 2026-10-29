// Frame clock, easing, seeded randomness, camera, layers, bloom and the scene manager.
// A frame is a pure function of its number: t = frame / fps. Nothing here reads the
// wall clock or Math.random, so any frame renders identically in preview, capture and check.

import { W, H, PALETTE, rgba, SAFE } from './theme.js';

export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => clamp((x - a) / (b - a));

export const ease = {
  linear: x => x,
  inOut: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2), // draws
  out: x => 1 - Math.pow(1 - x, 3),
  in: x => x * x * x,
  expoOut: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)), // impacts
  expoIn: x => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
  sineInOut: x => -(Math.cos(Math.PI * x) - 1) / 2,
  // HUD spring: settles with one small overshoot.
  spring: x => (x >= 1 ? 1 : 1 - Math.exp(-6.5 * x) * Math.cos(7.5 * x)),
};
/** Eased progress of t through [a, b]. */
export const span = (t, a, b, e = ease.inOut) => e(clamp((t - a) / (b - a)));
/** Linear sub-progress of p through [a, b]: stages the parts of one drawing. */
export const sub = (p, a, b) => clamp((p - a) / (b - a));

/** mulberry32: the film's only source of randomness. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
/** Smooth 1D value noise in [-1, 1], seeded; used for flame flicker and drift. */
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const r = k => (mulberry32((Math.imul(k, 374761393) ^ Math.imul(seed + 1, 668265263)) >>> 0)() * 2 - 1);
  const u = f * f * (3 - 2 * f);
  return lerp(r(i), r(i + 1), u);
}
export const fbm1 = (x, seed = 0) => noise1(x, seed) * 0.6 + noise1(x * 2.1, seed + 7) * 0.3 + noise1(x * 4.3, seed + 13) * 0.1;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// ---------------------------------------------------------------------------
// Text log: every text draw records its screen box so `make check` can test
// size, safe area and sourcing without parsing pixels.
// ---------------------------------------------------------------------------
export const textLog = [];
export function logText(ctx, scale, entry) {
  const m = ctx.getTransform();
  const pts = [[entry.x0, entry.y0], [entry.x1, entry.y0], [entry.x0, entry.y1], [entry.x1, entry.y1]]
    .map(([x, y]) => [(m.a * x + m.c * y + m.e) / scale, (m.b * x + m.d * y + m.f) / scale]);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const k = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) / scale;
  textLog.push({
    text: entry.text, voice: entry.voice, fact: entry.fact || null, alpha: entry.alpha,
    box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], px: entry.size * k,
  });
}

// ---------------------------------------------------------------------------
// Static textures, generated once from fixed seeds.
// ---------------------------------------------------------------------------
function noiseTile(size, seed, amp, mean) {
  const c = canvas(size, size), g = c.getContext('2d');
  const img = g.createImageData(size, size), r = mulberry32(seed);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = mean + (r() - 0.5) * 2 * amp;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

function valueNoise2(seed) {
  const r = mulberry32(seed), N = 256, tab = new Float32Array(N * N);
  for (let i = 0; i < tab.length; i++) tab[i] = r();
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const at = (a, b) => tab[((b & 255) << 8) | (a & 255)];
    return lerp(lerp(at(xi, yi), at(xi + 1, yi), u), lerp(at(xi, yi + 1), at(xi + 1, yi + 1), u), v);
  };
}

/** Aged parchment: mottled fibre texture in PARCHMENT, shown at 10–15 % under the ink in Act I. */
function parchmentTexture() {
  const w = 960, h = 540, c = canvas(w, h), g = c.getContext('2d');
  const img = g.createImageData(w, h), n1 = valueNoise2(17), n2 = valueNoise2(29);
  const [pr, pg, pb] = PALETTE.PARCHMENT;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const f = 0.5 * n1(x / 90, y / 90) + 0.3 * n1(x / 30, y / 30) + 0.2 * n2(x / 8, y / 11);
    const stain = Math.max(0, n2(x / 160 + 9, y / 160 + 3) - 0.62) * 1.6;
    const ex = Math.min(x, w - x) / w, ey = Math.min(y, h - y) / h;
    const edge = Math.min(1, Math.min(ex, ey) * 7);
    const k = (0.45 + 0.55 * f) * (0.55 + 0.45 * edge) * (1 - stain * 0.5);
    const i = (y * w + x) * 4;
    img.data[i] = pr * k; img.data[i + 1] = pg * k; img.data[i + 2] = pb * k; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // Laid-paper fibres
  const r = mulberry32(41);
  g.globalAlpha = 0.18;
  g.strokeStyle = rgba('PARCHMENT', 1);
  g.lineWidth = 0.6;
  for (let k = 0; k < 900; k++) {
    const x = r() * w, y = r() * h, a = (r() - 0.5) * 0.5, l = 6 + r() * 30;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  g.globalAlpha = 1;
  return c;
}

const STARS = (() => {
  const r = mulberry32(1776);
  return Array.from({ length: 420 }, () => ({
    x: r() * W * 1.3 - W * 0.15, y: r() * H * 1.3 - H * 0.15,
    rad: 0.5 + Math.pow(r(), 3) * 1.6, a: 0.25 + r() * 0.75, ph: r() * TAU, f: 0.6 + r() * 1.8,
  }));
})();

// ---------------------------------------------------------------------------
// The film
// ---------------------------------------------------------------------------
export class Film {
  constructor({ el, timeline, modules, facts, scale = 1, debug = false, noTexture = false }) {
    this.el = el;
    this.tl = timeline;
    this.facts = facts;
    this.S = scale;
    this.debug = debug;
    this.noTexture = noTexture;
    el.width = W * scale; el.height = H * scale;
    this.ctx = el.getContext('2d', { alpha: false });
    const layer = () => {
      const line = canvas(W * scale, H * scale), ui = canvas(W * scale, H * scale);
      return { line, ui, lineCtx: line.getContext('2d'), uiCtx: ui.getContext('2d') };
    };
    this.layers = [layer(), layer()];
    this.mix = layer();
    this.bloomSmall = canvas(W * scale / 4, H * scale / 4);
    this.bloomBlur = canvas(W * scale / 4, H * scale / 4);
    this.glowSmall = canvas(W * scale / 16, H * scale / 16);
    this.glowBlur = canvas(W * scale / 16, H * scale / 16);
    this.modules = modules; // id -> { draw, camera?, setup? }
    for (const sc of timeline.scenes) {
      const m = modules[sc.id];
      if (!m) throw new Error(`no scene module for ${sc.id}`);
      m.startBar = sc.startBar; m.bars = sc.bars; // the exported { id, startBar, bars, draw } contract
      if (m.setup) m.setup(this, sc);
    }
    this.parchment = parchmentTexture();
    this.grainTile = noiseTile(512, 7, 70, 128);
    this.ditherTiles = [0, 1, 2, 3].map(k => noiseTile(256, 101 + k, 1.6, 1.6));
    this.vignette = (() => {
      const c = canvas(W, H), g = c.getContext('2d');
      const v = g.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 1.02);
      v.addColorStop(0, rgba('INK', 0)); v.addColorStop(1, rgba('INK', 0.78));
      g.fillStyle = v; g.fillRect(0, 0, W, H);
      return c;
    })();
    this.hud = null; // attached by main.js
  }

  /** Per-scene timing state handed to draw(ctx, s). */
  state(sc, T, n, layer) {
    const tl = this.tl, t = T - sc.start, S = this.S;
    const pos = tl.position(T);
    const film = this;
    const cueOf = name => {
      const c = sc.cueMap[name];
      if (!c) throw new Error(`${sc.id}: no cue named ${name}`);
      return c;
    };
    const local = a => (typeof a === 'number' ? a : tl.time(a, sc) - sc.start);
    const s = {
      film, scene: sc, id: sc.id, t, T, frame: n, dur: sc.dur, p: clamp(t / sc.dur),
      bar: pos.bar, beat: pos.beat, beatPhase: pos.beatPhase,
      lbar: Math.floor(t / tl.bar) + 1, beatDur: tl.beat, barDur: tl.bar,
      ui: layer.uiCtx, lineCtx: layer.lineCtx, S,
      bloom: 0.42, flash: 0, hud: {},
      at: local,
      /** Hits of a cue in local seconds. */
      hits: name => cueOf(name).hits.map((h, i) => ({ t0: h.t0 - sc.start, t1: h.t1 - sc.start, i })),
      /** Eased 0..1 envelope of a cue (hit i, default 0). */
      cue: (name, e = ease.inOut, i = 0) => {
        const h = cueOf(name).hits[i];
        return e(clamp((T - h.t0) / Math.max(1e-6, h.t1 - h.t0)));
      },
      /** How many hits of a cue have started. */
      count: name => cueOf(name).hits.reduce((k, h) => k + (T >= h.t0 ? 1 : 0), 0),
      env: (a, b, e = ease.inOut) => { const A = local(a), B = local(b); return e(clamp((t - A) / (B - A))); },
      since: a => t - local(a),
      /** 1 at the address, decaying exponentially after it. */
      pulse: (a, decay = 0.35) => { const d = t - local(a); return d < 0 ? 0 : Math.exp(-d / decay); },
      rng: seed => mulberry32(hash(sc.id) ^ seed),
      cardOf: name => {
        const c = cueOf(name);
        if (!c.card) throw new Error(`${sc.id}: cue ${name} is not a card`);
        return { ...c.card, in: c.hits[0].t0 - sc.start, out: c.hits[0].t1 - sc.start, name };
      },
      /** Draw with another parallax factor (0 = fixed to screen, 1 = the camera, >1 = foreground). */
      parallax(f, fn) {
        film.applyCamera(layer, s.cam, f);
        fn();
        film.applyCamera(layer, s.cam, 1);
      },
      screen(fn) { s.parallax(0, fn); },
    };
    return s;
  }

  applyCamera(layer, cam, f = 1) {
    const S = this.S;
    const z = 1 + (cam.zoom - 1) * f;
    const cx = cam.x * f + (W / 2) * (1 - f), cy = cam.y * f + (H / 2) * (1 - f);
    const r = (cam.rot || 0) * f, c = Math.cos(r) * z * S, sn = Math.sin(r) * z * S;
    // screen = R·Z·(world − c) + centre
    const e = S * W / 2 - (c * cx - sn * cy), fy = S * H / 2 - (sn * cx + c * cy);
    for (const g of [layer.lineCtx, layer.uiCtx]) g.setTransform(c, sn, -sn, c, e, fy);
  }

  drawScene(sc, T, n, layer) {
    const S = this.S, mod = this.modules[sc.id];
    for (const g of [layer.lineCtx, layer.uiCtx]) {
      g.setTransform(S, 0, 0, S, 0, 0);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, W, H);
    }
    const s = this.state(sc, T, n, layer);
    s.cam = mod.camera ? mod.camera(s) : { x: W / 2, y: H / 2, zoom: 1 + 0.03 * ease.inOut(s.p) };
    this.applyCamera(layer, s.cam, 1);
    layer.lineCtx.save(); layer.uiCtx.save();
    mod.draw(layer.lineCtx, s);
    layer.lineCtx.restore(); layer.uiCtx.restore();
    for (const g of [layer.lineCtx, layer.uiCtx]) { g.setLineDash([]); g.shadowBlur = 0; g.filter = 'none'; }
    return s;
  }

  background(g, bgA, bgB, k, cam) {
    const S = this.S;
    const mixv = key => lerp((bgB && bgB[key]) || 0, (bgA && bgA[key]) || 0, bgB ? k : 1);
    g.setTransform(S, 0, 0, S, 0, 0);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.fillStyle = rgba('INK'); g.fillRect(0, 0, W, H);
    const parch = mixv('parchment');
    if (parch > 0.001) { g.globalAlpha = parch; g.drawImage(this.parchment, 0, 0, W, H); g.globalAlpha = 1; }
    const navy = mixv('navy');
    if (navy > 0.001) {
      const gr = g.createRadialGradient(W / 2, H * 0.48, 0, W / 2, H * 0.48, H * 0.95);
      gr.addColorStop(0, rgba('NAVY', navy)); gr.addColorStop(1, rgba('NAVY', 0));
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    const stars = mixv('stars');
    if (stars > 0.001) {
      // Far parallax layer: drifts at 15 % of the camera.
      const f = 0.15, z = 1 + (cam.zoom - 1) * f;
      const ox = (cam.x - W / 2) * f, oy = (cam.y - H / 2) * f;
      for (const st of STARS) {
        const x = (st.x - W / 2 - ox) * z + W / 2, y = (st.y - H / 2 - oy) * z + H / 2;
        if (x < -4 || x > W + 4 || y < -4 || y > H + 4) continue;
        const tw = 0.65 + 0.35 * Math.sin(this.T * st.f + st.ph);
        g.fillStyle = rgba('WHITE', st.a * tw * stars);
        g.beginPath(); g.arc(x, y, st.rad, 0, TAU); g.fill();
      }
    }
  }

  bloom(g, src, amount, wide) {
    const S = this.S;
    if (amount > 0) {
      const sm = this.bloomSmall.getContext('2d'), bl = this.bloomBlur.getContext('2d');
      const w = this.bloomSmall.width, h = this.bloomSmall.height;
      sm.globalCompositeOperation = 'copy'; sm.imageSmoothingQuality = 'high';
      sm.drawImage(src, 0, 0, w, h);
      bl.globalCompositeOperation = 'copy'; bl.filter = `blur(${3 * S}px)`;
      bl.drawImage(this.bloomSmall, 0, 0);
      bl.filter = 'none';
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = clamp(amount);
      g.imageSmoothingQuality = 'high';
      g.drawImage(this.bloomBlur, 0, 0, W * S, H * S);
    }
    if (wide > 0) {
      const sm = this.glowSmall.getContext('2d'), bl = this.glowBlur.getContext('2d');
      const w = this.glowSmall.width, h = this.glowSmall.height;
      sm.globalCompositeOperation = 'copy'; sm.drawImage(this.bloomSmall, 0, 0, w, h);
      bl.globalCompositeOperation = 'copy'; bl.filter = `blur(${2.5 * S}px)`;
      bl.drawImage(this.glowSmall, 0, 0); bl.filter = 'none';
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = clamp(wide);
      g.drawImage(this.glowBlur, 0, 0, W * S, H * S);
    }
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  }

  /** Composite the incoming scene over the outgoing one according to the incoming transition. */
  transitionMask(g, tr, k, drawFn) {
    const S = this.S;
    if (tr.type === 'dissolve') { g.globalAlpha = k; drawFn(); g.globalAlpha = 1; return; }
    if (tr.type === 'wipe') {
      const e = ease.inOut(k);
      g.save(); g.setTransform(S, 0, 0, S, 0, 0); g.beginPath();
      if (tr.dir === 'west') g.rect(W * (1 - e) - 2, 0, W * e + 4, H);
      else if (tr.dir === 'up') g.rect(0, H * (1 - e) - 2, W, H * e + 4);
      else g.rect(-2, 0, W * e + 4, H);
      g.clip(); drawFn(); g.restore();
      return;
    }
    drawFn();
  }

  wipeLine(g, tr, k) {
    if (tr.type !== 'wipe' || k <= 0 || k >= 1) return;
    const S = this.S, e = ease.inOut(k);
    g.setTransform(S, 0, 0, S, 0, 0);
    g.strokeStyle = rgba('GOLD_HOT', 0.9); g.lineWidth = 2;
    g.beginPath();
    if (tr.dir === 'west') { g.moveTo(W * (1 - e), 0); g.lineTo(W * (1 - e), H); }
    else if (tr.dir === 'up') { g.moveTo(0, H * (1 - e)); g.lineTo(W, H * (1 - e)); }
    else { g.moveTo(W * e, 0); g.lineTo(W * e, H); }
    g.stroke();
  }

  renderFrame(n) {
    const tl = this.tl, S = this.S, g = this.ctx;
    const T = n / tl.fps;
    this.T = T;
    textLog.length = 0;
    const i = tl.sceneIndexAt(T);
    const cur = tl.scenes[i], prev = i > 0 ? tl.scenes[i - 1] : null;
    const tr = cur.transition || { type: 'cut' };
    const trDur = (tr.beats ?? 0) * tl.beat;
    const inTr = prev && tr.type !== 'cut' && tr.type !== 'match' && trDur > 0 && T < cur.start + trDur;
    const k = inTr ? (T - cur.start) / trDur : 1;

    const sCur = this.drawScene(cur, T, n, this.layers[0]);
    let sPrev = null;
    if (inTr) sPrev = this.drawScene(prev, T, n, this.layers[1]);

    // Background (a scene may override its timeline background per frame through s.bg)
    const bgCur = { ...(cur.bg || {}), ...(sCur.bg || {}) };
    const bgPrev = inTr ? { ...(prev.bg || {}), ...(sPrev.bg || {}) } : null;
    this.background(g, bgCur, bgPrev, k, sCur.cam);

    // Line work (+ bloom) and annotations
    let lineSrc = this.layers[0].line, uiSrc = this.layers[0].ui;
    if (inTr) {
      const m = this.mix;
      for (const [dst, a, b] of [[m.lineCtx, this.layers[1].line, this.layers[0].line], [m.uiCtx, this.layers[1].ui, this.layers[0].ui]]) {
        dst.setTransform(1, 0, 0, 1, 0, 0); dst.globalAlpha = 1; dst.globalCompositeOperation = 'source-over';
        dst.clearRect(0, 0, W * S, H * S);
        dst.globalAlpha = tr.type === 'dissolve' ? 1 - k : 1;
        dst.drawImage(a, 0, 0); dst.globalAlpha = 1;
        if (tr.type === 'wipe') { // erase the outgoing plate behind the wipe edge
          dst.save(); dst.globalCompositeOperation = 'destination-out';
          this.transitionMask(dst, tr, k, () => { dst.setTransform(1, 0, 0, 1, 0, 0); dst.fillRect(0, 0, W * S, H * S); });
          dst.restore();
        }
        this.transitionMask(dst, tr, k, () => { dst.setTransform(1, 0, 0, 1, 0, 0); dst.drawImage(b, 0, 0); });
      }
      lineSrc = m.line; uiSrc = m.ui;
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(lineSrc, 0, 0);
    const bloomAmt = inTr ? lerp(sPrev.bloom, sCur.bloom, k) : sCur.bloom;
    this.bloom(g, lineSrc, bloomAmt, (sCur.glow || 0) + 0.12);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(uiSrc, 0, 0);
    if (inTr) this.wipeLine(g, tr, k);

    // Cut flash on the downbeat
    let flash = sCur.flash || 0;
    if (tr.flash && T - cur.start < 0.6) flash += tr.flash * Math.exp(-(T - cur.start) / 0.12);
    if (flash > 0.002) {
      g.setTransform(S, 0, 0, S, 0, 0);
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.6);
      gr.addColorStop(0, rgba('GOLD_HOT', clamp(flash))); gr.addColorStop(1, rgba('GOLD_HOT', 0));
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
    }

    // Vignette, HUD, texture
    g.setTransform(S, 0, 0, S, 0, 0);
    g.drawImage(this.vignette, 0, 0, W, H);
    if (this.hud) this.hud.draw(g, T, { cur, prev, inTr, k, s: sCur });
    if (!this.noTexture) this.texture(g, n);

    // Global fades: the beat of black and the final second.
    const black = sCur.black || 0;
    if (black > 0) {
      g.setTransform(S, 0, 0, S, 0, 0);
      g.fillStyle = rgba('INK', clamp(black)); g.fillRect(0, 0, W, H);
    }
    if (this.debug) this.debugOverlay(g, T, cur, sCur);
    return { T, scene: cur.id, texts: textLog.slice() };
  }

  texture(g, n) {
    const S = this.S;
    g.setTransform(S, 0, 0, S, 0, 0);
    // Paper grain at 5 %, fixed to the plate.
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.05;
    for (let x = 0; x < W; x += 512) for (let y = 0; y < H; y += 512) g.drawImage(this.grainTile, x, y);
    // Moving dither (≈ 1.5 %) so H.264 does not band the dark gradients.
    const r = mulberry32(n * 2654435761 >>> 0), tile = this.ditherTiles[n % 4];
    const ox = Math.floor(r() * 256), oy = Math.floor(r() * 256);
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1;
    g.setTransform(1, 0, 0, 1, 0, 0);
    for (let x = -ox; x < W * S; x += 256) for (let y = -oy; y < H * S; y += 256) g.drawImage(tile, x, y);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  }

  debugOverlay(g, T, cur, s) {
    const S = this.S, tl = this.tl;
    g.setTransform(S, 0, 0, S, 0, 0);
    g.strokeStyle = 'rgba(255,0,255,0.6)'; g.lineWidth = 1; g.setLineDash([6, 6]);
    g.strokeRect(SAFE.x0, SAFE.y0, SAFE.x1 - SAFE.x0, SAFE.y1 - SAFE.y0);
    g.setLineDash([]);
    g.font = '600 22px "JetBrains Mono", monospace'; g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillStyle = 'rgba(255,0,255,0.95)';
    const fr = Math.round(T * tl.fps);
    g.fillText(`${tl.label(T)}  f${fr}  ${T.toFixed(3)}s  ${cur.id}  local ${(T - cur.start).toFixed(2)}`, 110, 120);
    let y = 150;
    for (const [name, c] of Object.entries(cur.cueMap)) {
      const live = c.hits.some(h => T >= h.t0 && T < Math.max(h.t1, h.t0 + 0.12));
      if (!live) continue;
      g.fillText(`▸ ${name}`, 110, y); y += 26;
    }
    const ph = (T % tl.beat) / tl.beat;
    if (ph < 0.12) { g.fillStyle = `rgba(255,0,255,${0.6 * (1 - ph / 0.12)})`; g.fillRect(W - 140, 120, 30, 30); }
  }
}
