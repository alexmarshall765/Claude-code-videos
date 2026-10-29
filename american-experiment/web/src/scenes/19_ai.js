// OBS 19 · ACT V — GENERATIVE AI, 2017–2026. The second peak.
//   121.1  an isometric data hall: rack rows light in waves, cooling loops pulse
//   122.1  into the network: word tokens as gold tiles; attention arcs leap between them,
//          their weight the attention's strength (2017). The tiles are the founding words.
//   124.1  layers stack   124.3  new tokens arrive one per 16th
//   125.1  THEN WE TAUGHT IT TO THINK. The outputs become drawings in the film's own line:
//          a molecule, a circuit, a blueprint, a line of code — and once, the film's torch
//   127.1  training compute rises over the chip curve, far steeper

import { scene } from './common.js';
import { rgba } from '../theme.js';
import { ease, clamp, lerp, sub, span, TAU, mulberry32 } from '../engine.js';
import { stroke, circle, glow, dot, hatch, arcPts, dimension } from '../draw/paths.js';
import { card, text } from '../draw/type.js';
import { torch } from '../draw/torch.js';
import { gear } from '../draw/gears.js';
import { scales, axes } from '../draw/charts.js';

const WORDS = ['WE', 'HOLD', 'THESE', 'TRUTHS', 'TO', 'BE', 'SELF-', 'EVIDENT'];
const TILE = { y: 720, w: 176, h: 58, gap: 24 };
const tileX = i => 960 + (i - 3.5) * (TILE.w + TILE.gap);
const WEIGHTS = (() => { const R = mulberry32(2017); return WORDS.map(() => WORDS.map(() => Math.pow(R(), 2.2))); })();

// The data hall, isometric
const ISO = (x, y, z) => [960 + (x - y) * 52 * 0.866, 560 + (x + y) * 52 * 0.5 - z * 52];

function rack(g, x, y, k, lights, a) {
  const w = 0.8, d = 0.5, h = 1.9;
  const P = ([px, py, pz]) => ISO(x + px, y + py, pz);
  const top = [[0, 0, h], [w, 0, h], [w, d, h], [0, d, h]].map(P);
  const front = [[0, d, 0], [w, d, 0], [w, d, h], [0, d, h]].map(P);
  const side = [[w, 0, 0], [w, d, 0], [w, d, h], [w, 0, h]].map(P);
  stroke(g, top, k, { pen: { color: 'GOLD', alpha: 0.8 * a, width: 1.2 }, closed: true, tip: false });
  stroke(g, front, k, { pen: { color: 'GOLD', alpha: 0.9 * a, width: 1.3 }, closed: true, tip: false });
  stroke(g, side, k, { pen: { color: 'GOLD', alpha: 0.5 * a, width: 1 }, closed: true, tip: false });
  if (k >= 1) for (let j = 0; j < 6; j++) {
    const [lx, ly] = P([w * 0.5, d, h * (0.15 + j * 0.14)]);
    dot(g, lx, ly, 2.2, lights[j] > 0.5 ? 'GOLD_HOT' : 'GOLD', a * (0.3 + 0.7 * lights[j]));
  }
}

function hall(ctx, s, t) {
  const a = 1 - span(t, 1.7, 2.1);
  if (a <= 0) return;
  for (let r = 0; r < 6; r++) for (let c = 0; c < 10; c++) {
    const x = c * 1.0 - 5, y = r * 1.6 - 4.5;
    const k = span(t, (r + c) * 0.03, 0.3 + (r + c) * 0.03, ease.out);
    const lights = Array.from({ length: 6 }, (_, j) => 0.5 + 0.5 * Math.sin((c - t * 9 + r * 0.7 + j * 0.4)));
    rack(ctx, x, y, k, lights, a);
  }
  // Cooling loops along the aisles, with pulses
  for (let r = 0; r < 6; r++) {
    const pts = [ISO(-5.2, r * 1.6 - 3.8, 0.02), ISO(5.2, r * 1.6 - 3.8, 0.02)];
    stroke(ctx, pts, span(t, 0.2, 0.9), { pen: { color: 'GOLD_HOT', alpha: 0.5 * a, width: 1.4 }, tip: false });
    const u = (t * 0.8 + r * 0.17) % 1;
    const [px, py] = [lerp(pts[0][0], pts[1][0], u), lerp(pts[0][1], pts[1][1], u)];
    glow(ctx, px, py, 16, 'GOLD_HOT', 0.7 * a); dot(ctx, px, py, 2.5, 'WHITE', a);
  }
}

function drawPlate(ctx, x, y, w, h, p) {
  stroke(ctx, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], clamp(p * 3), { pen: { color: 'GOLD', alpha: 0.6, width: 1.2 }, closed: true, tip: false });
}

export default scene('19_ai', {
  camera(s) {
    const t = s.t;
    // Push into one rack, then cut into the network.
    const dive = span(t, 1.3, 2.0, ease.in);
    const [rx, ry] = ISO(0.4, 0.3, 1);
    if (t < 2) return { x: lerp(960, rx, dive), y: lerp(540, ry, dive), zoom: Math.exp(Math.log(4) * dive) };
    const pulse = t > 8 && t < 8.5 ? 1 + 0.03 * Math.exp(-(t - 8) / 0.1) : 1;
    return { x: 960, y: 540, zoom: pulse };
  },

  draw(ctx, s) {
    const t = s.t;
    s.bloom = 0.5;
    s.flash = t >= 8 ? 0.5 * Math.exp(-(t - 8) / 0.12) : 0;
    hall(ctx, s, t);
    if (t < 2) return;

    // Shrink the network to the left once it starts producing.
    const shr = span(t, 8.0, 8.6, ease.inOut);
    const netA = 1 - span(t, 12.0, 12.4);
    const K = lerp(1, 0.42, shr), OX = lerp(960, 430, shr), OY = lerp(0, 120, shr);
    const T = ([x, y]) => [OX + (x - 960) * K, 540 + (y - 540) * K + OY];
    // Tiles
    const ti = span(t, 2.0, 2.4, ease.out);
    WORDS.forEach((w, i) => {
      const [x, y] = T([tileX(i), TILE.y]), hw = (TILE.w / 2) * K, hh = (TILE.h / 2) * K;
      const q = clamp(ti * 1.6 - i * 0.08);
      if (q <= 0) return;
      const isQ = t < 6 && Math.floor((t - 2) * 2) % 8 === i;
      stroke(ctx, [[x - hw, y - hh], [x + hw, y - hh], [x + hw, y + hh], [x - hw, y + hh]], 1, { pen: { color: isQ ? 'GOLD_HOT' : 'GOLD', alpha: netA * q, width: isQ ? 2.6 : 1.6 }, closed: true, tip: false });
      if (isQ) glow(ctx, x, y, 70 * K, 'GOLD_HOT', 0.3 * netA);
      text(s.ui, w, x, y, { voice: isQ ? 'dataBold' : 'data', size: 26, alpha: q * netA * (1 - span(t, 7.8, 8.2)), scale: s.S, color: isQ ? 'GOLD_HOT' : 'GOLD' });
    });
    // Attention: from the query token (one per beat), arcs to every other token
    const att = s.env('2.1', '4.1') > 0 && t < 6.4 ? 1 - span(t, 6.0, 6.4) : 0;
    if (att > 0) {
      const qi = Math.floor((t - 2) * 2) % 8, beatP = ((t - 2) * 2) % 1;
      WORDS.forEach((_, k) => {
        if (k === qi) return;
        const w = WEIGHTS[qi][k];
        const [x0, y0] = T([tileX(qi), TILE.y - TILE.h / 2]), [x1] = T([tileX(k), TILE.y - TILE.h / 2]);
        const mx = (x0 + x1) / 2, rr = Math.abs(x1 - x0) / 2;
        const hgt = Math.min(rr * 0.85, 280);
        const pts = arcPts(mx, y0, rr, Math.PI, 2 * Math.PI, 40).map(([x, y]) => [x, y0 - ((y0 - y) / rr) * hgt]);
        const ordered = x1 < x0 ? pts : pts.slice().reverse();
        stroke(ctx, ordered, ease.out(clamp(beatP * 2.5)), { pen: { color: w > 0.4 ? 'GOLD_HOT' : 'GOLD', alpha: (0.25 + 0.75 * w) * att, width: 0.8 + 5 * w }, tip: false });
      });
    }
    // Layers stack above the tokens, a beat apart.
    const LAYERS = 4;
    for (let L = 0; L < LAYERS; L++) {
      const q = span(t, 6.0 + L * 0.5, 6.4 + L * 0.5, ease.expoOut) * netA;
      if (q <= 0) continue;
      const yL = TILE.y - 90 - L * 70;
      const R = mulberry32(31 + L);
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
        const w = R();
        if (w < 0.55) continue;
        const a = T([tileX(i), yL + 35]), b = T([tileX(j), yL - 35 + 70 * (1 - q)]);
        stroke(ctx, [a, b], 1, { pen: { color: 'GOLD', alpha: 0.25 * w * q, width: 1 }, tip: false });
      }
      for (let i = 0; i < 8; i++) {
        const [x, y] = T([tileX(i), yL - 35 + 70 * (1 - q)]);
        circle(ctx, x, y, 9 * K, 1, { pen: { color: 'GOLD_HOT', alpha: q, width: 1.6 }, tip: false });
      }
    }
    // Generated tokens: one per 16th, flowing from the top of the stack to the plates
    const out = T([tileX(7) + 120, TILE.y - 90 - 3 * 70 - 35]);
    s.hits('tokens').forEach((h, k) => {
      const age = t - h.t0;
      if (age < 0 || age > 0.6) return;
      const tgt = PLATES[Math.min(PLATES.length - 1, Math.floor(k / 8))];
      const u = ease.inOut(clamp(age / 0.6));
      const x = lerp(out[0], tgt.x + tgt.w / 2, u), y = lerp(out[1], tgt.y + tgt.h / 2, u) - Math.sin(Math.PI * u) * 80;
      const sz = 8;
      stroke(ctx, [[x - sz, y - sz], [x + sz, y - sz], [x + sz, y + sz], [x - sz, y + sz]], 1, { pen: { color: 'GOLD_HOT', alpha: 1 - u * 0.5, width: 1.6 }, closed: true, tip: false });
    });
    plates(ctx, s, t);
    computeChart(ctx, s, t);
    s.screen(() => {
      card(s, 'card_attention', { x: 960, y: 196, size: 110 });
      card(s, 'data_2017', { x: 960, y: 290, size: 30, voice: 'dataBold' });
      card(s, 'card_machines', { lines: ['MACHINES THAT WRITE,', 'DRAW AND CODE.'], x: 960, y: 234, size: 100 });
      card(s, 'card_think', { lines: ['THEN WE TAUGHT IT', 'TO THINK.'], x: 960, y: 234, size: 108 });
      card(s, 'data_compute', { x: 960, y: 906, size: 30, voice: 'dataBold' });
    });
  },
});

// The plates the outputs draw themselves on
const PLATES = [
  { x: 880, y: 372, w: 330, h: 214, t0: 8.1 },
  { x: 1250, y: 372, w: 330, h: 214, t0: 8.8 },
  { x: 880, y: 612, w: 330, h: 214, t0: 9.5 },
  { x: 1250, y: 612, w: 330, h: 214, t0: 10.2 },
];

function plates(ctx, s, t) {
  const a = 1 - span(t, 12.0, 12.5);
  if (t < 8 || a <= 0) return;
  ctx.globalAlpha = a; s.ui.globalAlpha = a;
  PLATES.forEach((P, i) => {
    const p = span(t, P.t0, P.t0 + 1.1, ease.inOut);
    if (p <= 0) return;
    drawPlate(ctx, P.x, P.y, P.w, P.h, p);
    const cx = P.x + P.w / 2, cy = P.y + P.h / 2;
    if (i === 0) {
      // A molecule: two fused rings and their substituents
      const hex = (x, y, r, rot) => Array.from({ length: 7 }, (_, k) => [x + Math.cos(rot + (k * TAU) / 6) * r, y + Math.sin(rot + (k * TAU) / 6) * r]);
      stroke(ctx, hex(cx - 34, cy, 38, Math.PI / 6), sub(p, 0.1, 0.5), { pen: { color: 'GOLD_HOT', alpha: 1, width: 2 }, tip: false });
      stroke(ctx, hex(cx + 32, cy, 38, Math.PI / 6), sub(p, 0.3, 0.7), { pen: { color: 'GOLD_HOT', alpha: 1, width: 2 }, tip: false });
      for (const [x, y, dx, dy] of [[cx - 67, cy - 19, -40, -22], [cx + 65, cy + 19, 40, 22], [cx - 34, cy + 38, 0, 40], [cx + 32, cy - 38, 0, -40]]) {
        stroke(ctx, [[x, y], [x + dx, y + dy]], sub(p, 0.6, 0.9), { pen: { color: 'GOLD', alpha: 0.9, width: 1.6 }, tip: false });
        circle(ctx, x + dx, y + dy, 7, sub(p, 0.8, 1), { pen: { color: 'GOLD', alpha: 0.9, width: 1.4 }, tip: false });
      }
      circle(ctx, cx - 34, cy, 22, sub(p, 0.5, 0.8), { pen: { color: 'GOLD', alpha: 0.6, width: 1 }, tip: false });
    } else if (i === 1) {
      // A circuit: a chip, a resistor and a capacitor on their traces
      stroke(ctx, [[cx - 40, cy - 34], [cx + 40, cy - 34], [cx + 40, cy + 34], [cx - 40, cy + 34]], sub(p, 0.05, 0.35), { pen: { color: 'GOLD_HOT', alpha: 1, width: 2 }, closed: true, tip: false });
      for (let k = 0; k < 4; k++) for (const sd of [-1, 1]) stroke(ctx, [[cx + sd * 40, cy - 24 + k * 16], [cx + sd * 64, cy - 24 + k * 16]], sub(p, 0.3, 0.5), { pen: { color: 'GOLD', alpha: 0.9, width: 1.3 }, tip: false });
      const zz = [[cx - 150, cy - 70], [cx - 120, cy - 70]];
      for (let k = 0; k < 6; k++) zz.push([cx - 112 + k * 8, cy - 70 + (k % 2 ? 9 : -9)]);
      zz.push([cx - 60, cy - 70], [cx - 64, cy - 70], [cx - 64, cy - 24]);
      stroke(ctx, zz, sub(p, 0.4, 0.75), { pen: { color: 'GOLD', alpha: 0.9, width: 1.5 }, tip: false });
      stroke(ctx, [[cx + 64, cy + 24], [cx + 110, cy + 24], [cx + 110, cy + 60], [cx + 90, cy + 60]], sub(p, 0.5, 0.8), { pen: { color: 'GOLD', alpha: 0.9, width: 1.5 }, tip: false });
      stroke(ctx, [[cx + 90, cy + 48], [cx + 90, cy + 72]], sub(p, 0.75, 0.9), { pen: { color: 'GOLD_HOT', alpha: 1, width: 2.2 }, tip: false });
      stroke(ctx, [[cx + 80, cy + 48], [cx + 80, cy + 72]], sub(p, 0.8, 0.95), { pen: { color: 'GOLD_HOT', alpha: 1, width: 2.2 }, tip: false });
      stroke(ctx, [[cx + 80, cy + 60], [cx + 40, cy + 60], [cx + 40, cy + 34]], sub(p, 0.85, 1), { pen: { color: 'GOLD', alpha: 0.9, width: 1.5 }, tip: false });
    } else if (i === 2) {
      // A blueprint: a geared bracket with its dimension
      gear(ctx, cx - 50, cy + 6, 54, 16, t * 0.6, p, { depth: 9, holes: 4, pen: { color: 'GOLD_HOT', alpha: 1, width: 1.8 } });
      stroke(ctx, [[cx + 20, cy + 70], [cx + 140, cy + 70], [cx + 140, cy - 40], [cx + 100, cy - 40], [cx + 100, cy + 30], [cx + 20, cy + 30]], sub(p, 0.3, 0.8), { pen: { color: 'GOLD', alpha: 0.9, width: 1.6 }, closed: true, tip: false });
      hatch(ctx, [[cx + 100, cy + 30], [cx + 140, cy + 30], [cx + 140, cy + 70], [cx + 100, cy + 70]], sub(p, 0.6, 1), { gap: 5, alpha: 0.5 });
      dimension(ctx, s.ui, cx + 20, cy + 92, cx + 140, cy + 92, sub(p, 0.7, 1), { ext: 8, alpha: 0.8 });
    } else {
      // Once, the film's own torch: machines helped draw this film.
      torch(ctx, cx, cy + 8, 0.36, p, s.T, span(t, P.t0 + 0.9, P.t0 + 1.4), { engrave: false, seed: 11 });
    }
  });
  // A line of code, typed a token at a time
  const code = 'while experiment: build()';
  const n = Math.floor(clamp((t - 9.9) / 0.9) * code.length);
  if (n > 0) {
    text(s.ui, code, 880, 866, { voice: 'dataBold', size: 28, align: 'left', alpha: 1, scale: s.S, reveal: i => (i < n ? 1 : 0) });
    if (Math.floor(t * 4) % 2 === 0 || n < code.length) {
      const w = n * 0.66 * 28;
      ctx.fillStyle = rgba('GOLD_HOT', 0.9); ctx.fillRect(884 + w, 852, 12, 28);
    }
  }
  ctx.globalAlpha = 1; s.ui.globalAlpha = 1;
}

// Growth since 2010 on a log scale: transistors per chip (data) and frontier training
// compute (Epoch AI's fitted trend, about 4.1× a year).
const CH = scales({ x: 420, y: 380, w: 1080, h: 420 }, [2010, 2025], [0, 9.5]);
const CHIPS = [[2010, 2.3e9], [2012, 5e9], [2015, 1e10], [2017, 1.92e10], [2019, 3.954e10], [2021, 5.7e10], [2022, 1.14e11], [2023, 1.34e11]].map(([y, v]) => [y, Math.log10(v / 2.3e9)]);
const AI = Array.from({ length: 16 }, (_, i) => [2010 + i, i * Math.log10(4.1)]);

function computeChart(ctx, s, t) {
  const p = s.env('7.1', 'end');
  if (p <= 0) return;
  axes(s, ctx, CH, clamp(p * 4), { xTicks: [2010, 2025], fact: 'ai_compute_growth', title: 'GROWTH SINCE 2010 · LOG SCALE', titleFact: 'ai_compute_growth' });
  const draw = (data, q, pen) => {
    if (q <= 0) return null;
    const pts = data.map(([x, y]) => [CH.X(x), CH.Y(y)]);
    const xe = lerp(pts[0][0], pts[pts.length - 1][0], q), cut = pts.filter(([x]) => x <= xe);
    const last = pts.find(([x]) => x > xe);
    if (last && cut.length) { const a = cut[cut.length - 1], f = (xe - a[0]) / (last[0] - a[0]); cut.push([xe, lerp(a[1], last[1], f)]); }
    stroke(ctx, cut, 1, { pen, tip: false });
    return cut[cut.length - 1];
  };
  const c1 = draw(CHIPS, span(t, 12.2, 13.2), { color: 'GOLD', alpha: 0.85, width: 2.4 });
  const c2 = draw(AI, span(t, 12.8, 14.6, ease.inOut), { color: 'GOLD_HOT', alpha: 1, width: 4 });
  if (c1 && t > 13.0) text(s.ui, 'TRANSISTORS PER CHIP', c1[0] - 10, c1[1] - 26, { voice: 'data', size: 24, align: 'right', alpha: span(t, 13.0, 13.4), fact: 'chip_curve', scale: s.S });
  if (c2) {
    glow(ctx, c2[0], c2[1], 40, 'GOLD_HOT', 0.6);
    if (t > 13.7) text(s.ui, 'AI TRAINING COMPUTE', c2[0] - 16, c2[1] + 4, { voice: 'dataBold', size: 24, align: 'right', alpha: span(t, 13.7, 14.0), fact: 'ai_compute_growth', scale: s.S });
  }
}
