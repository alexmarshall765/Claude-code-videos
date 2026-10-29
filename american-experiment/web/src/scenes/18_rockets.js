// OBS 18 · ACT V — THE ROCKETS COME BACK, 2015–2024; and the code of life.
//   113.1  a booster flies its landing burn down a guide arc onto a pad; the landing
//          crosshair converges and locks as it touches down on 114.1
//   115.1  a far larger booster descends beside a tower; on 116.1 the tower's arms close
//          and catch it (all archetypal, unbranded)
//   118.1  a DNA helix zips together rung by rung, one per 16th; it unzips, and an
//          mRNA strand is read off beside it

import { scene } from './common.js';
import { rgba } from '../theme.js';
import { ease, clamp, lerp, sub, span, TAU, noise1 } from '../engine.js';
import { stroke, circle, glow, hatch, ellipsePts } from '../draw/paths.js';
import { card, text } from '../draw/type.js';
import { flameCone, billows, sparks } from '../draw/particles.js';

const PAD = { x: 960, y: 860, rx: 170, ry: 40 };
const TOWER = { x: 1110, top: 340, base: 900, w: 74, arm: 452 };
const MRNA = 'AUGGCCAUUGUAAUGGGCCGCUGAAAGGGUGCCCGAUAG';

/** A booster in elevation, base centre at (x, y), tilted by a. w = width, h = height. */
function booster(g, x, y, w, h, a, o = {}) {
  const c = Math.cos(a), s = Math.sin(a);
  const P = (u, v) => [x + u * c + v * s, y + u * s - v * c]; // u across, v up
  const A = o.alpha ?? 1;
  const pen = (col, al, wd) => ({ color: col, alpha: al * A, width: wd });
  const body = [P(-w / 2, 0), P(w / 2, 0), P(w / 2, h), P(-w / 2, h)];
  stroke(g, body, 1, { pen: pen('GOLD_HOT', 1, 2.2), closed: true, tip: false });
  hatch(g, [P(w * 0.18, 0), P(w / 2, 0), P(w / 2, h), P(w * 0.18, h)], 1, { angle: Math.PI / 2 + a, gap: 6, alpha: 0.35 * A });
  for (let k = 1; k < (o.rings ?? 6); k++) { const v = (k / (o.rings ?? 6)) * h; stroke(g, [P(-w / 2, v), P(w / 2, v)], 1, { pen: pen('GOLD', 0.5, 1), tip: false }); }
  // Grid fins near the top
  for (const sd of [-1, 1]) {
    const f = [P(sd * w / 2, h - 18), P(sd * (w / 2 + w * 0.45), h - 22), P(sd * (w / 2 + w * 0.45), h - 22 - w * 0.5), P(sd * w / 2, h - 18 - w * 0.5)];
    stroke(g, f, o.fins ?? 1, { pen: pen('GOLD', 0.9, 1.4), closed: true, tip: false });
    hatch(g, f, o.fins ?? 1, { angle: Math.PI / 4, gap: 5, alpha: 0.6 * A });
  }
  // Engine bells
  const n = o.engines ?? 3;
  for (let i = 0; i < n; i++) {
    const u = (i - (n - 1) / 2) * (w / n);
    stroke(g, [P(u - w / n * 0.35, 0), P(u - w / n * 0.45, -14), P(u + w / n * 0.45, -14), P(u + w / n * 0.35, 0)], 1, { pen: pen('GOLD', 0.9, 1.2), tip: false });
  }
  // Landing legs unfold from the sides.
  if ((o.legs ?? 0) > 0) for (const sd of [-1, 1]) {
    const k = o.legs, foot = P(sd * (w / 2 + 46 * k), -16 * k);
    stroke(g, [P(sd * w / 2, 64), foot], 1, { pen: pen('GOLD_HOT', 1, 2), tip: false });
    stroke(g, [P(sd * w / 2, 10), foot], 1, { pen: pen('GOLD', 0.8, 1.2), tip: false });
  }
  return { nozzle: P(0, -14), axis: a };
}

function tower(g, p, armK) {
  const { x, top, base, w } = TOWER;
  const P = { color: 'GOLD', alpha: 0.95, width: 1.8 };
  stroke(g, [[x - w / 2, base], [x - w / 2, lerp(base, top, p)]], 1, { pen: P, tip: false });
  stroke(g, [[x + w / 2, base], [x + w / 2, lerp(base, top, p)]], 1, { pen: P, tip: false });
  g.strokeStyle = rgba('GOLD', 0.4); g.lineWidth = 1; g.beginPath();
  for (let y = base; y > lerp(base, top, p); y -= 34) { g.moveTo(x - w / 2, y); g.lineTo(x + w / 2, y - 34); g.moveTo(x + w / 2, y); g.lineTo(x - w / 2, y - 34); g.moveTo(x - w / 2, y); g.lineTo(x + w / 2, y); }
  g.stroke();
  if (p < 1) return;
  // The two arms: open wide, then they swing shut on the catch.
  const ay = TOWER.arm, pivot = [x - w / 2, ay];
  for (const sd of [-1, 1]) {
    const ang = Math.PI + sd * lerp(0.42, 0.115, armK);
    const L = 250, tip = [pivot[0] + Math.cos(ang) * L, pivot[1] + Math.sin(ang) * L];
    stroke(g, [pivot, tip], 1, { pen: { color: 'GOLD_HOT', alpha: 1, width: 3 }, tip: false });
    stroke(g, [[pivot[0], pivot[1] + sd * 14], [tip[0] + 20, tip[1] + sd * 6]], 1, { pen: { color: 'GOLD', alpha: 0.6, width: 1.2 }, tip: false });
  }
  stroke(g, [[x - w / 2 - 8, ay - 24], [x - w / 2 - 8, ay + 24]], 1, { pen: { color: 'GOLD_HOT', alpha: 1, width: 4 }, tip: false });
}

export default scene('18_rockets', {
  camera(s) {
    const t = s.t;
    const shake = t > 6 && t < 6.6 ? 5 * Math.exp(-(t - 6) / 0.14) * noise1(t * 40, 4) : 0;
    if (t < 4) return { x: 960, y: 560, zoom: 1 + 0.03 * span(t, 0, 4) };
    if (t < 9.6) return { x: 980 + shake, y: 560, zoom: 1 + 0.04 * span(t, 6, 9.6) };
    return { x: 960, y: 560, zoom: 1 };
  },

  draw(ctx, s) {
    const t = s.t;
    s.bloom = 0.5;
    if (t < 4.0) shotA(ctx, s, t);
    else if (t < 9.8) shotB(ctx, s, t);
    if (t >= 9.4) shotC(ctx, s, t);
    s.screen(() => {
      card(s, 'card_back', { x: 960, y: 196, size: 100 });
      card(s, 'data_landings', { x: 960, y: 284, size: 28, voice: 'dataBold' });
      card(s, 'card_code', { x: 960, y: 196, size: 100 });
      card(s, 'data_genome', { x: 960, y: 930, size: 28, voice: 'dataBold' });
    });
  },
});

function shotA(ctx, s, t) {
  const fade = 1 - span(t, 3.75, 4.0);
  ctx.globalAlpha = fade;
  // Ground and pad, with the landing crosshair
  stroke(ctx, [[-50, PAD.y + 30], [1970, PAD.y + 30]], span(t, 0, 0.5), { pen: { color: 'GOLD', alpha: 0.5, width: 1.2 }, tip: false });
  stroke(ctx, ellipsePts(PAD.x, PAD.y, PAD.rx, PAD.ry, 0, 0, TAU, 80), span(t, 0, 0.6), { pen: { color: 'GOLD', alpha: 0.9, width: 1.8 }, tip: false });
  stroke(ctx, ellipsePts(PAD.x, PAD.y, PAD.rx * 0.62, PAD.ry * 0.62, 0, 0, TAU, 60), span(t, 0.2, 0.8), { pen: { color: 'GOLD', alpha: 0.6, width: 1.2 }, tip: false });
  const lock = span(t, 1.2, 2.0, ease.inOut);
  const sq = lerp(2.4, 1, lock);
  for (const sd of [-1, 1]) {
    stroke(ctx, [[PAD.x + sd * 30 * sq, PAD.y], [PAD.x + sd * PAD.rx * 1.25 * sq, PAD.y]], 1, { pen: { color: 'GOLD_HOT', alpha: 0.4 + 0.6 * lock, width: 1.6 }, tip: false });
    stroke(ctx, [[PAD.x, PAD.y + sd * 8 * sq], [PAD.x, PAD.y + sd * PAD.ry * 1.25 * sq]], 1, { pen: { color: 'GOLD_HOT', alpha: 0.4 + 0.6 * lock, width: 1.6 }, tip: false });
  }
  if (lock >= 1) { const age = t - 2.0; if (age < 0.6) stroke(ctx, ellipsePts(PAD.x, PAD.y, PAD.rx * (1 + age), PAD.ry * (1 + age), 0, 0, TAU, 80), 1, { pen: { color: 'GOLD_HOT', alpha: 0.8 * (1 - age / 0.6), width: 2 }, tip: false }); }
  // The planned arc, then the booster riding it down on its landing burn
  const arc = [];
  for (let i = 0; i <= 40; i++) { const u = i / 40, e = ease.out(u); arc.push([lerp(1500, PAD.x, e), lerp(-120, PAD.y - 6, 1 - (1 - u) ** 2)]); }
  stroke(ctx, arc, span(t, 0, 0.6), { pen: { color: 'GOLD', alpha: 0.45, width: 1.2 }, tip: false, dash: [5, 7] });
  const u = clamp(t / 2.0), e = 1 - (1 - u) ** 2;
  const bx = lerp(1500, PAD.x, ease.out(u)), by = lerp(-120, PAD.y - 6, e);
  const tilt = lerp(-0.38, 0, ease.out(u));
  const b = booster(ctx, bx, by, 40, 430, tilt, { legs: span(t, 1.1, 1.6, ease.out), engines: 3 });
  if (t < 2.0) {
    const thrust = 0.6 + 0.4 * span(t, 0.6, 1.4);
    flameCone(ctx, b.nozzle[0], b.nozzle[1], 150 * thrust * (1 + 0.1 * noise1(t * 30, 2)), 12, 26, 0.95, Math.PI / 2 + tilt);
    glow(ctx, b.nozzle[0], b.nozzle[1] + 40, 90, 'GOLD_HOT', 0.5);
    if (t > 1.5) sparks(ctx, t, { seed: 18, rate: 120, t0: 1.5, t1: 2.0, life: [0.3, 0.7], source: () => [PAD.x, PAD.y], dir: -Math.PI / 2, spread: 2.8, speed: 420, gravity: 700, alpha: 0.8 });
  }
  if (t >= 2.0) billows(ctx, t, { seed: 21, rate: 80, t0: 2.0, t1: 2.35, life: [1.0, 2.0], source: (bb, i) => [PAD.x + (i % 2 ? 1 : -1) * 40, PAD.y], dir: 0, spread: TAU, speed: 340, rise: 18, r0: 8, grow: 46, alpha: 0.55, scallop: true });
  ctx.globalAlpha = 1;
}

function shotB(ctx, s, t) {
  const fade = span(t, 4.0, 4.3) * (1 - span(t, 9.3, 9.8));
  ctx.globalAlpha = fade;
  stroke(ctx, [[-50, TOWER.base], [1970, TOWER.base]], 1, { pen: { color: 'GOLD', alpha: 0.5, width: 1.2 }, tip: false });
  // The launch mount the booster is caught above
  stroke(ctx, [[820, TOWER.base], [840, 852], [1000, 852], [1020, TOWER.base]], 1, { pen: { color: 'GOLD', alpha: 0.85, width: 1.6 }, tip: false });
  hatch(ctx, [[830, 852], [1010, 852], [1020, TOWER.base], [820, TOWER.base]], 1, { angle: Math.PI / 4, gap: 8, alpha: 0.3 });
  const armK = span(t, 5.82, 6.0, ease.in);
  tower(ctx, span(t, 4.0, 4.8, ease.inOut), armK);
  // The descent: fast, then slowing hard into the arms
  const u = clamp((t - 4.0) / 2.0), dip = t > 6 ? 8 * Math.exp(-(t - 6) / 0.12) * Math.sin((t - 6) * 30) : 0;
  const topY = lerp(-700, 420, 1 - (1 - u) ** 2.4) + dip;
  const H = 432, W = 86;
  const b = booster(ctx, 920, topY + H, W, H, 0, { engines: 7, rings: 8, fins: 1 });
  if (t < 6.0) {
    flameCone(ctx, b.nozzle[0], b.nozzle[1], 240 * (0.7 + 0.3 * span(t, 4.8, 5.6)) * (1 + 0.08 * noise1(t * 28, 5)), 30, 60, 1, Math.PI / 2);
    glow(ctx, b.nozzle[0], b.nozzle[1] + 60, 160, 'GOLD_HOT', 0.5);
  } else {
    const age = t - 6.0;
    if (age < 0.7) glow(ctx, 920, TOWER.arm, 260, 'GOLD_HOT', 0.6 * Math.exp(-age / 0.2));
    if (age < 0.8) circle(ctx, 920, TOWER.arm, 40 + 420 * ease.expoOut(age / 0.8), 1, { pen: { color: 'GOLD_HOT', alpha: 0.7 * (1 - age / 0.8), width: 3 }, tip: false });
    billows(ctx, t, { seed: 33, rate: 50, t0: 6.0, t1: 6.6, life: [1.2, 2.4], source: () => [920, topY + H], dir: Math.PI / 2, spread: 2.2, speed: 160, rise: -10, r0: 10, grow: 50, alpha: 0.45, scallop: true });
  }
  ctx.globalAlpha = 1;
}

function shotC(ctx, s, t) {
  const fade = span(t, 9.4, 10.0);
  const cx = 1040, y0 = 900, y1 = 330, R = 74, N = 48;
  const hits = s.hits('helix');
  // The first 24 sixteenths zip two rungs each; the last 24 unzip two each and read a base.
  const zipK = k => clamp((t - hits[Math.floor(k / 2)].t0) / 0.12);
  const openK = k => clamp((t - hits[24 + Math.floor(k / 2)].t0) / 0.2);
  const rot = t * 0.9;
  const strand = (sd, k) => {
    const kk = Math.max(0, Math.min(N - 1, k));
    const th = kk * 0.42 + rot + (sd > 0 ? Math.PI : 0);
    const o0 = openK(Math.floor(kk)), o1 = openK(Math.min(N - 1, Math.floor(kk) + 1)), f = kk - Math.floor(kk);
    return [cx + Math.sin(th) * R + sd * lerp(o0, o1, f) * 110, lerp(y0, y1, kk / (N - 1)), Math.cos(th)];
  };
  ctx.globalAlpha = fade;
  // Backbones draw up first, then the rungs zip in.
  const bb = span(t, 9.8, 10.8, ease.inOut) * (N - 1);
  for (const sd of [-1, 1]) {
    let prev = strand(sd, 0);
    for (let k = 0.25; k <= bb; k += 0.25) {
      const p = strand(sd, k);
      stroke(ctx, [prev, p], 1, { pen: { color: sd < 0 ? 'GOLD_HOT' : 'GOLD', alpha: p[2] > 0 ? 1 : 0.35, width: p[2] > 0 ? 2.6 : 1.4 }, tip: false });
      prev = p;
    }
  }
  for (let k = 0; k < N; k++) {
    const z = zipK(k), o = openK(k);
    if (z <= 0 || o >= 1) continue;
    const a = strand(-1, k), b = strand(1, k), mid = (a[0] + b[0]) / 2;
    const reach = z * (1 - o);
    stroke(ctx, [a, [lerp(a[0], mid, reach), a[1]]], 1, { pen: { color: 'GOLD', alpha: 0.8, width: 1.4 }, tip: false });
    stroke(ctx, [b, [lerp(b[0], mid, reach), b[1]]], 1, { pen: { color: 'GOLD', alpha: 0.8, width: 1.4 }, tip: false });
    if (z < 1) glow(ctx, mid, a[1], 16, 'GOLD_HOT', 0.7 * (1 - z));
  }
  // The mRNA strand, read off the opened template a base per 16th
  const read = Math.max(0, s.count('helix') - 24);
  if (read > 0) {
    const pts = [];
    for (let k = 0; k <= Math.min(N - 1, read * 2); k += 0.5) { const a = strand(-1, k); pts.push([a[0] - 64, a[1]]); }
    if (pts.length > 1) stroke(ctx, pts, 1, { pen: { color: 'GOLD_HOT', alpha: 1, width: 2.4 }, tip: false });
    for (let j = 0; j < read; j++) {
      const p = pts[Math.min(pts.length - 1, j * 4)];
      text(s.ui, MRNA[j % MRNA.length], p[0] - 30, p[1], { voice: 'dataBold', size: 24, alpha: fade, scale: s.S });
    }
    text(s.ui, 'mRNA', cx - 250, y1 - 20, { voice: 'marker', size: 24, alpha: fade * clamp((t - hits[24].t0) / 0.4), scale: s.S });
  }
  text(s.ui, 'DNA', cx + 150, y1 - 20, { voice: 'marker', size: 24, alpha: 0.9 * fade * clamp((t - 10) / 0.5), scale: s.S });
  ctx.globalAlpha = 1;
}
