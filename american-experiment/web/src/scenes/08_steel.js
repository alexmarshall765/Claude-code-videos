// OBS 08 · ACT III · THE APPARATUS — STEEL & RAILS, 1869–1883. The first full drop.
//   45.1  two railroads race across the map, from Sacramento east and from Omaha west
//   47.1  they meet at Promontory Summit: in the loupe, the golden spike strikes
//   48.1  the Brooklyn Bridge in elevation: the towers rise from their caissons
//   49.1  the main cables hang as catenaries   49.3  24 suspenders fall, one per 16th,
//         and the deck hangs from them   50.1  MAIN SPAN 1,595.5 FT   51.1  the stays
//   51.3  a Bessemer converter in section, blowing   52.1  the steel-output curve climbs

import { scene } from './common.js';
import { rgba } from '../theme.js';
import { ease, clamp, lerp, sub, span, TAU, noise1 } from '../engine.js';
import { stroke, circle, arcPts, glow, dot, hatch, dimension } from '../draw/paths.js';
import { card, text } from '../draw/type.js';
import { mapView, outline, borders, schematic } from '../draw/map.js';
import { gear, catenary, catenaryParam } from '../draw/gears.js';
import { sparks, flameCone } from '../draw/particles.js';
import { scales, axes, series } from '../draw/charts.js';

// --- Shot A: the race to Promontory ------------------------------------------
const V = mapView(250, 330, 960);
const CP = [[-121.49, 38.58], [-121.08, 38.9], [-120.33, 39.32], [-119.81, 39.53], [-118.47, 40.18], [-117.74, 40.97], [-116.93, 40.64], [-115.76, 40.83], [-114.96, 41.11], [-114.19, 41.26], [-113.13, 41.74], [-112.55, 41.62]];
const UP = [[-95.94, 41.26], [-97.37, 41.43], [-98.34, 40.92], [-99.08, 40.7], [-100.77, 41.12], [-102.26, 40.99], [-102.98, 41.14], [-104.82, 41.14], [-105.59, 41.31], [-107.24, 41.79], [-109.47, 41.53], [-110.96, 41.27], [-111.97, 41.22], [-112.55, 41.62]];
const CPP = V.route(CP), UPP = V.route(UP), PROM = V.P(-112.55, 41.62);
const LOUPE = { x: 1430, y: 560, r: 200 };
const MEET = 4.0;

// --- Shot B: the Brooklyn Bridge, 0.8 px per foot ------------------------------
const FT = 0.8, WATER = 840, TX = [322, 1598], TOP = WATER - 276.5 * FT;
const deckY = x => WATER - FT * (119 + 16 * (1 - Math.min(1, ((x - 960) / 638) ** 2)));
const A_CAT = catenaryParam(638, 128 * FT);
const MAIN = catenary(TX[0], TOP, TX[1], TOP, A_CAT, 96);
const SIDES = [catenary(TX[0] - 930 * FT, WATER - 80 * FT, TX[0], TOP, A_CAT, 60), catenary(TX[1], TOP, TX[1] + 930 * FT, WATER - 80 * FT, A_CAT, 60)];
const SUSP = Array.from({ length: 24 }, (_, i) => TX[0] + (1276 * (i + 0.5)) / 24);
const SUSP_ORDER = Array.from({ length: 24 }, (_, k) => (k % 2 ? 23 - Math.floor(k / 2) : Math.floor(k / 2)));

// --- Shot C: converter and curve -------------------------------------------------
const CONV = { x: 560, y: 700 };
const STEEL = [[1870, 69], [1880, 1247], [1890, 4277], [1900, 10188], [1910, 26095]];
const CHART = scales({ x: 1060, y: 470, w: 660, h: 360 }, [1870, 1910], [0, 27000]);

export default scene('08_steel', {
  camera(s) {
    const t = s.t;
    const shake = t > MEET && t < MEET + 0.6 ? 6 * Math.exp(-(t - MEET) / 0.15) * noise1(t * 40, 3) : 0;
    if (t < 6) return { x: 960 + shake, y: 600 + shake * 0.6, zoom: 1 + 0.03 * span(t, 0, 6) };
    if (t < 13) return { x: 960, y: 660, zoom: 1.08 + 0.05 * span(t, 6, 13, ease.sineInOut) };
    return { x: 960, y: 560, zoom: 1 + 0.03 * span(t, 13, 16) };
  },

  draw(ctx, s) {
    const t = s.t;
    s.bloom = 0.46;
    s.flash = t >= MEET ? 0.5 * Math.exp(-(t - MEET) / 0.12) : 0;
    const aA = 1 - span(t, 5.75, 6.0), aB = span(t, 5.9, 6.1) * (1 - span(t, 12.85, 13.0)), aC = span(t, 12.95, 13.1);
    if (aA > 0) { ctx.globalAlpha = aA; s.ui.globalAlpha = aA; shotA(ctx, s, t); ctx.globalAlpha = 1; s.ui.globalAlpha = 1; }
    if (aB > 0) { ctx.globalAlpha = aB; s.ui.globalAlpha = aB; shotB(ctx, s, t); ctx.globalAlpha = 1; s.ui.globalAlpha = 1; }
    if (aC > 0) { ctx.globalAlpha = aC; s.ui.globalAlpha = aC; shotC(ctx, s, t); ctx.globalAlpha = 1; s.ui.globalAlpha = 1; }
    s.screen(() => {
      card(s, 'card_one_line', { x: 960, y: 196, size: 100 });
      card(s, 'card_steel', { x: 960, y: 210, size: 140 });
      card(s, 'card_joined', { x: 960, y: 196, size: 100 });
    });
  },
});

function shotA(ctx, s, t) {
  const m = span(t, 0, 0.8, ease.out);
  outline(ctx, V, m, { pen: { color: 'GOLD', alpha: 0.5, width: 1.4 }, tip: false });
  borders(ctx, V, m, { pen: { color: 'GOLD', alpha: 0.16, width: 1 } });
  schematic(s, V, m);
  // The race: both lines accelerate toward Promontory and arrive together.
  const p = ease.in(clamp((t - 0.2) / (MEET - 0.35)));
  for (const [pts, seed] of [[CPP, 1], [UPP, 2]]) {
    const tip = stroke(ctx, pts, p, { pen: { color: 'GOLD_HOT', alpha: 1, width: 3 }, tipK: 1.4 });
    // Ties tick past behind the head.
    if (tip && p < 1) glow(ctx, tip[0], tip[1], 30, 'GOLD_HOT', 0.5);
    if (p > 0) stroke(ctx, pts, p, { pen: { color: 'GOLD', alpha: 0.6, width: 9 }, tip: false, dash: [1.5, 6] });
  }
  if (p >= 1) { circle(ctx, PROM[0], PROM[1], 10 + 30 * s.pulse(MEET, 0.4), 1, { pen: { color: 'GOLD_HOT', alpha: 0.9, width: 2 }, tip: false }); dot(ctx, PROM[0], PROM[1], 4, 'GOLD_HOT', 1); }
  // The loupe: the last rails meet and the golden spike strikes.
  const lp = span(t, 2.6, 3.3, ease.inOut);
  if (lp <= 0) return;
  const { x: lx, y: ly, r } = LOUPE;
  const ang = Math.atan2(PROM[1] - ly, PROM[0] - lx);
  stroke(ctx, [[PROM[0], PROM[1]], [lx + Math.cos(ang) * r, ly + Math.sin(ang) * r]], lp, { pen: { color: 'GOLD', alpha: 0.6, width: 1 }, tip: false, dash: [4, 5] });
  circle(ctx, lx, ly, r, lp, { pen: { color: 'GOLD_HOT', alpha: 0.95, width: 2.6 }, tip: false, a0: ang });
  circle(ctx, lx, ly, r + 10, lp, { pen: { color: 'GOLD', alpha: 0.4, width: 1 }, tip: false, a0: ang });
  ctx.save();
  ctx.beginPath(); ctx.arc(lx, ly, r - 2, 0, TAU); ctx.clip();
  ctx.fillStyle = rgba('INK', 0.85 * lp); ctx.fillRect(lx - r, ly - r, 2 * r, 2 * r);
  const meet = span(t, 2.8, MEET, ease.out);
  const gauge = 34;
  for (const side of [-1, 1]) {
    const x0 = lx + side * (r + 40), x1 = lerp(x0, lx + side * 6, meet);
    for (const dy of [-gauge / 2, gauge / 2]) stroke(ctx, [[x0, ly + dy], [x1, ly + dy]], 1, { pen: { color: 'GOLD_HOT', alpha: 0.95, width: 3 }, tip: false });
    for (let x = x0; side < 0 ? x < x1 : x > x1; x -= side * 26) stroke(ctx, [[x, ly - gauge], [x, ly + gauge]], 1, { pen: { color: 'GOLD', alpha: 0.7, width: 5 }, tip: false });
  }
  // The last tie, then the spike
  if (meet >= 1) stroke(ctx, [[lx, ly - gauge - 4], [lx, ly + gauge + 4]], 1, { pen: { color: 'GOLD_HOT', alpha: 1, width: 8 }, tip: false });
  const drop = span(t, MEET - 0.22, MEET, ease.in);
  if (drop > 0) {
    const sy = lerp(ly - 230, ly - gauge / 2 - 2, drop);
    const spike = [[lx - 9, sy - 70], [lx + 9, sy - 70], [lx + 5, sy - 6], [lx, sy], [lx - 5, sy - 6]];
    stroke(ctx, spike, 1, { pen: { color: 'GOLD_HOT', alpha: 1, width: 2.4 }, closed: true, tip: false });
    stroke(ctx, [[lx - 16, sy - 70], [lx + 16, sy - 70], [lx + 16, sy - 80], [lx - 16, sy - 80]], 1, { pen: { color: 'GOLD_HOT', alpha: 1, width: 2.4 }, closed: true, tip: false });
    hatch(ctx, spike, 1, { angle: Math.PI / 4, gap: 4, alpha: 0.6, pen: { color: 'GOLD_HOT', alpha: 0.6, width: 1 } });
  }
  if (t >= MEET) {
    const age = t - MEET;
    sparks(ctx, t, { seed: 47, rate: 420, t0: MEET, t1: MEET + 0.12, life: [0.3, 0.8], source: () => [lx, ly - gauge / 2], dir: -Math.PI / 2, spread: 3.4, speed: 760, gravity: 1100, width: 1.8 });
    circle(ctx, lx, ly, 20 + 300 * ease.expoOut(clamp(age / 0.6)), 1, { pen: { color: 'GOLD_HOT', alpha: 0.8 * (1 - clamp(age / 0.6)), width: 3 }, tip: false });
    glow(ctx, lx, ly, 160, 'GOLD_HOT', 0.6 * Math.exp(-age / 0.25));
  }
  ctx.restore();
  card(s, 'data_1869', { x: lx, y: ly + r + 46, size: 28 });
}

function shotB(ctx, s, t) {
  // Water and caissons
  const w = [];
  for (let x = -120; x <= 2040; x += 10) w.push([x, WATER + 2 * Math.sin(x / 23 + t * 2.2)]);
  stroke(ctx, w, span(t, 6, 6.6), { pen: { color: 'GOLD', alpha: 0.6, width: 1.3 }, tip: false });
  for (let k = 1; k <= 3; k++) {
    const ww = [];
    for (let x = -120; x <= 2040; x += 14) ww.push([x, WATER + k * 22 + 1.5 * Math.sin(x / 31 - t * 1.6 + k)]);
    stroke(ctx, ww, span(t, 6, 6.6), { pen: { color: 'GOLD', alpha: 0.18 / k, width: 1 }, tip: false });
  }
  // Towers rise from their caissons.
  const tw = s.cue('towers', ease.inOut);
  TX.forEach((x, i) => {
    const q = sub(tw, i * 0.12, 0.88 + i * 0.12);
    if (q <= 0) return;
    const cais = [[x - 38, WATER], [x + 38, WATER], [x + 38, WATER + 92], [x - 38, WATER + 92]];
    stroke(ctx, cais, sub(q, 0, 0.3), { pen: { color: 'GOLD', alpha: 0.8, width: 1.5 }, closed: true, tip: false });
    hatch(ctx, cais, sub(q, 0.1, 0.4), { angle: Math.PI / 4, gap: 7, alpha: 0.3 });
    const h = lerp(WATER, TOP, ease.out(sub(q, 0.2, 1)));
    const body = [[x - 27, WATER], [x - 22.5, h], [x + 22.5, h], [x + 27, WATER]];
    stroke(ctx, body, 1, { pen: { color: 'GOLD_HOT', alpha: 1, width: 2.4 }, tip: false });
    ctx.save(); ctx.beginPath(); body.forEach(([a, b], j) => (j ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.closePath(); ctx.clip();
    ctx.strokeStyle = rgba('GOLD', 0.4); ctx.lineWidth = 1; ctx.beginPath();
    for (let y = WATER - 12; y > h; y -= 12) { ctx.moveTo(x - 30, y); ctx.lineTo(x + 30, y); }
    ctx.stroke(); ctx.restore();
    if (q >= 1) {
      stroke(ctx, [[x - 31, TOP + 12], [x + 31, TOP + 12], [x + 31, TOP], [x - 31, TOP]], 1, { pen: { color: 'GOLD_HOT', alpha: 1, width: 2 }, closed: true, tip: false });
      stroke(ctx, arcPts(x, TOP, 10, Math.PI, TAU, 10), 1, { pen: { color: 'GOLD_HOT', alpha: 1, width: 2 }, tip: false });
    }
  });
  // Main cables hang as catenaries, then the side spans run off to the anchorages.
  const cb = s.cue('cables', ease.inOut);
  if (cb > 0) {
    const half = MAIN.pts.length >> 1;
    stroke(ctx, MAIN.pts.slice(0, half + 1), cb, { pen: { color: 'GOLD_HOT', alpha: 1, width: 3 } });
    stroke(ctx, MAIN.pts.slice(half).reverse(), cb, { pen: { color: 'GOLD_HOT', alpha: 1, width: 3 } });
    stroke(ctx, SIDES[0].pts.slice().reverse(), cb, { pen: { color: 'GOLD_HOT', alpha: 0.9, width: 2.6 }, tip: false });
    stroke(ctx, SIDES[1].pts, cb, { pen: { color: 'GOLD_HOT', alpha: 0.9, width: 2.6 }, tip: false });
  }
  // Suspenders fall like rain; the deck hangs from each as it lands.
  const hits = s.hits('suspenders');
  const landed = new Array(24).fill(0);
  hits.forEach((h, k) => {
    const i = SUSP_ORDER[k], x = SUSP[i];
    const q = clamp((t - h.t0) / 0.16);
    if (q <= 0) return;
    landed[i] = q;
    const yc = MAIN.y(x), yd = deckY(x);
    stroke(ctx, [[x, yc], [x, lerp(yc, yd, ease.in(q))]], 1, { pen: { color: 'GOLD', alpha: 0.9, width: 1.4 }, tip: false });
    if (q >= 1) { const age = t - h.t0 - 0.16; if (age < 0.4) glow(ctx, x, yd, 18, 'GOLD_HOT', 0.7 * (1 - age / 0.4)); }
  });
  const deckAll = span(t, s.at('7.1'), s.at('7.2'));
  for (let i = 0; i < 24; i++) {
    const k = Math.max(landed[i] >= 1 ? 1 : 0, deckAll);
    if (k <= 0) continue;
    const x0 = TX[0] + (1276 * i) / 24, x1 = TX[0] + (1276 * (i + 1)) / 24;
    const pts = [0, 0.5, 1].map(f => [lerp(x0, x1, f), deckY(lerp(x0, x1, f))]);
    stroke(ctx, pts, 1, { pen: { color: 'GOLD_HOT', alpha: 0.95, width: 2.2 }, tip: false });
    stroke(ctx, pts.map(([a, b]) => [a, b + 14]), 1, { pen: { color: 'GOLD', alpha: 0.8, width: 1.3 }, tip: false });
    stroke(ctx, [[x0, deckY(x0)], [(x0 + x1) / 2, deckY((x0 + x1) / 2) + 14], [x1, deckY(x1)]], 1, { pen: { color: 'GOLD', alpha: 0.55, width: 1 }, tip: false });
  }
  // Approach decks through the towers to the frame edges
  if (deckAll > 0) for (const [a, b] of [[-120, TX[0]], [TX[1], 2040]]) {
    stroke(ctx, [[a, deckY(TX[0])], [b, deckY(TX[0])]], deckAll, { pen: { color: 'GOLD_HOT', alpha: 0.9, width: 2 }, tip: false });
    stroke(ctx, [[a, deckY(TX[0]) + 14], [b, deckY(TX[0]) + 14]], deckAll, { pen: { color: 'GOLD', alpha: 0.7, width: 1.2 }, tip: false });
  }
  // Diagonal stays fan from the tower tops: the bridge's web.
  const st = s.cue('stays', ease.inOut);
  if (st > 0) TX.forEach(x => {
    for (const dir of [-1, 1]) for (let j = 0; j < 9; j++) {
      const dx = x + dir * (44 + j * 36), q = sub(st, j * 0.05, 0.55 + j * 0.05);
      stroke(ctx, [[x, TOP + 6], [dx, deckY(clamp(dx, TX[0], TX[1]))]], q, { pen: { color: 'GOLD', alpha: 0.7, width: 1.1 }, tip: false });
    }
  });
  // The dimension over the main span
  const dp = s.env('6.1', '6.3', ease.inOut);
  if (dp > 0) dimension(ctx, s.ui, TX[0], TOP - 70, TX[1], TOP - 70, dp, { ext: 14, alpha: 0.85 });
  card(s, 'data_span', { x: 960, y: TOP - 104, size: 30, voice: 'dataBold' });
}

function shotC(ctx, s, t) {
  const cp = s.cue('bessemer', ease.inOut);
  const { x, y } = CONV, tilt = 0.12;
  const P = (u, v) => [x + u * Math.cos(tilt) - v * Math.sin(tilt), y + u * Math.sin(tilt) + v * Math.cos(tilt)];
  // The vessel in section: shell, refractory lining, the molten bath, tuyeres below.
  const shell = [[-46, -210], [-58, -170], [-128, -40], [-136, 40], [-120, 140], [-80, 180], [80, 180], [120, 140], [136, 40], [128, -40], [58, -170], [46, -210]].map(([u, v]) => P(u, v));
  const lining = [[-34, -200], [-44, -164], [-108, -38], [-115, 38], [-101, 124], [-66, 158], [66, 158], [101, 124], [115, 38], [108, -38], [44, -164], [34, -200]].map(([u, v]) => P(u, v));
  stroke(ctx, shell, sub(cp, 0, 0.5), { pen: { color: 'GOLD_HOT', alpha: 1, width: 2.6 } });
  stroke(ctx, lining, sub(cp, 0.1, 0.6), { pen: { color: 'GOLD', alpha: 0.85, width: 1.4 }, tip: false });
  if (cp > 0.4) {
    ctx.save();
    ctx.beginPath(); shell.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); lining.slice().reverse().forEach(([a, b]) => ctx.lineTo(a, b)); ctx.closePath(); ctx.clip('evenodd');
    hatch(ctx, shell, sub(cp, 0.4, 0.8), { angle: Math.PI / 4, gap: 6, alpha: 0.45 });
    ctx.restore();
    // Molten bath
    const surf = P(0, 60)[1];
    ctx.save(); ctx.beginPath(); lining.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.closePath(); ctx.clip();
    ctx.fillStyle = rgba('GOLD_HOT', 0.16 * sub(cp, 0.4, 0.8)); ctx.fillRect(x - 140, surf, 280, 200);
    ctx.strokeStyle = rgba('GOLD_HOT', 0.5 * sub(cp, 0.4, 0.8)); ctx.lineWidth = 1; ctx.beginPath();
    for (let yy = surf + 6; yy < y + 200; yy += 8) { ctx.moveTo(x - 140, yy); ctx.lineTo(x + 140, yy); }
    ctx.stroke();
    // Air from the tuyeres bubbles up through the iron.
    for (let i = 0; i < 26; i++) {
      const ph = (t * 1.6 + i * 0.137) % 1, bx = x - 80 + ((i * 37) % 160) + 6 * Math.sin(t * 5 + i), by = lerp(y + 175, surf, ph);
      circle(ctx, bx, by, 2 + 3 * ph, 1, { pen: { color: 'WHITE', alpha: 0.6 * (1 - ph) * sub(cp, 0.5, 0.9), width: 1 }, tip: false });
    }
    ctx.restore();
    for (let i = -2; i <= 2; i++) { const [a, b] = P(i * 30, 180); stroke(ctx, [[a, b], [a, b + 26]], sub(cp, 0.5, 0.8), { pen: { color: 'GOLD', alpha: 0.8, width: 1.4 }, tip: false }); }
  }
  // Trunnions on their stands; the tilting gear is the circle again.
  for (const side of [-1, 1]) {
    const [a, b] = P(side * 146, 0);
    circle(ctx, a, b, 22, sub(cp, 0.3, 0.6), { pen: { color: 'GOLD', alpha: 0.9, width: 1.8 }, tip: false });
    stroke(ctx, [[a - 24, 930], [a - 12, b + 20], [a + 12, b + 20], [a + 24, 930]], sub(cp, 0.3, 0.7), { pen: { color: 'GOLD', alpha: 0.8, width: 1.5 }, tip: false });
  }
  const [gx, gy] = P(146, 0);
  gear(ctx, gx + 70, gy - 10, 46, 18, t * 0.8, sub(cp, 0.45, 1), { depth: 8, holes: 4, pen: { color: 'GOLD_HOT', alpha: 0.9, width: 1.8 } });
  // The blow: flame and sparks from the mouth
  const blow = sub(cp, 0.55, 1);
  if (blow > 0) {
    const [mx, my] = P(0, -210);
    flameCone(ctx, mx, my, 150 * blow * (1 + 0.08 * Math.sin(t * 23)), 34, 62, 0.85 * blow, -Math.PI / 2 + tilt);
    sparks(ctx, t, { seed: 83, rate: 140, t0: s.at('7.4'), life: [0.4, 1.0], source: () => [mx, my - 30], dir: -Math.PI / 2 + tilt, spread: 1.6, speed: 520, gravity: 700, alpha: 0.9 });
    glow(ctx, mx, my - 80, 160, 'GOLD_HOT', 0.35 * blow);
  }
  stroke(ctx, [[180, 930], [940, 930]], sub(cp, 0, 0.4), { pen: { color: 'GOLD', alpha: 0.6, width: 1.3 }, tip: false });
  // Steel output, 1870–1910
  const sc = s.cue('steel_curve', ease.inOut);
  axes(s, ctx, CHART, span(t, 13.2, 14.0), { xTicks: [1870, 1910], fact: 'steel_output', title: 'U.S. STEEL OUTPUT', alpha: 1 });
  series(ctx, CHART, STEEL, sc, { area: true, areaStyle: rgba('GOLD', 0.22), areaGap: 7, pen: { color: 'GOLD_HOT', alpha: 1, width: 3.4 } });
}
