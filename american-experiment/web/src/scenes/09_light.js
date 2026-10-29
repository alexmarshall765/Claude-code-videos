// OBS 09 · ACT III — LIGHT & INVENTION, 1876–1900.
//   53.1  an exploded-view filament lamp ignites, and its parts close up
//   53.4  the camera pulls back from Menlo Park onto a darkened map
//   54.1  the grid spreads: 24 cities light, one per 16th
//   55.1  a telephone circuit, 1876   56.1  the patent odometer runs to 640,167

import { scene } from './common.js';
import { rgba } from '../theme.js';
import { ease, clamp, lerp, sub, span, TAU } from '../engine.js';
import { stroke, circle, arcPts, glow, dot } from '../draw/paths.js';
import { card, text, rollingNumber } from '../draw/type.js';
import { mapView, outline, borders, schematic, CITY } from '../draw/map.js';
import { bulb } from '../draw/icons.js';
import { gear, meshRot } from '../draw/gears.js';

const V = mapView(140, 300, 980);
const MENLO = V.P(-74.36, 40.56);
const BULB_S = 26, BULB = [MENLO[0], MENLO[1] - 0.25 * BULB_S];
const Z0 = 9;
// The largest cities of 1900, lit outward from the first station.
const ORDER = ['NYC', 'PHL', 'BOS', 'BAL', 'WAS', 'PVD', 'PIT', 'BUF', 'ROC', 'CLE', 'DET', 'TOL', 'CMH', 'CVG', 'IND', 'SDF', 'CHI', 'MKE', 'MSP', 'STL', 'MKC', 'MSY', 'DEN', 'SFO'];
const NODES = (() => {
  const pts = ORDER.map(c => V.P(...CITY[c])), out = [];
  pts.forEach((p, i) => {
    let par = MENLO, best = Math.hypot(p[0] - MENLO[0], p[1] - MENLO[1]);
    for (let j = 0; j < i; j++) { const d = Math.hypot(p[0] - pts[j][0], p[1] - pts[j][1]); if (d < best) { best = d; par = pts[j]; } }
    out.push({ p, par });
  });
  return out;
})();

function cam(t) {
  const e = span(t, 1.4, 2.15, ease.inOut);
  const z = Math.exp(lerp(Math.log(Z0), Math.log(1), e)) * (1 + 0.025 * span(t, 2.15, 8, ease.sineInOut));
  // Keep the lamp centred while zoomed in, easing to the plate's centre.
  const fx = lerp(BULB[0], 960, e), fy = lerp(BULB[1] - 0.2 * BULB_S, 600, e);
  return { x: fx, y: fy, zoom: z };
}

export default scene('09_light', {
  camera: s => cam(s.t),

  draw(ctx, s) {
    const t = s.t, z = s.cam.zoom, lw = 1 / z;
    s.bloom = 0.5;
    s.flash = 0.35 * Math.exp(-t / 0.1);
    const pull = span(t, 1.4, 2.15, ease.inOut);

    // The darkened map surfaces as the camera pulls back.
    const ma = span(t, 1.5, 2.2);
    if (ma > 0) {
      outline(ctx, V, 1, { pen: { color: 'GOLD', alpha: 0.32 * ma, width: 1.4 * lw }, tip: false });
      borders(ctx, V, 1, { pen: { color: 'GOLD', alpha: 0.1 * ma, width: lw } });
      if (z < 1.2) schematic(s, V, ma * (1 - span(t, 5.6, 6.0)), { x: V.x + V.w, y: V.y + V.h + 8 });
    }
    // The lamp: exploded, lit on the downbeat, closing up; then it becomes the first node.
    const la = 1 - span(t, 1.9, 2.3);
    if (la > 0) {
      const explode = 1 - span(t, 0.25, 0.95, ease.inOut);
      const lit = Math.min(1, ease.expoOut(clamp(t / 0.12))) * (0.9 + 0.1 * Math.sin(t * 31));
      bulb(ctx, BULB[0], BULB[1], BULB_S, { explode, lit, lw, alpha: la });
      // Thirteen rays and the halo: the circle as light
      const rk = span(t, 0.1, 0.8, ease.out) * la;
      if (rk > 0) {
        circle(ctx, BULB[0], BULB[1] - 0.45 * BULB_S, 1.15 * BULB_S, rk, { pen: { color: 'GOLD', alpha: 0.6 * la, width: 1.4 * lw }, tip: false });
        for (let i = 0; i < 13; i++) {
          const a = (i / 13) * TAU + t * 0.25, r0 = 1.3 * BULB_S, r1 = (1.3 + 0.9 * rk) * BULB_S;
          stroke(ctx, [[BULB[0] + Math.cos(a) * r0, BULB[1] - 0.45 * BULB_S + Math.sin(a) * r0], [BULB[0] + Math.cos(a) * r1, BULB[1] - 0.45 * BULB_S + Math.sin(a) * r1]], 1, { pen: { color: 'GOLD_HOT', alpha: 0.55 * rk, width: 1.6 * lw }, tip: false });
        }
      }
    }
    // The first station keeps glowing once the lamp has gone.
    if (t > 1.6) { dot(ctx, MENLO[0], MENLO[1], 4, 'GOLD_HOT', 1); glow(ctx, MENLO[0], MENLO[1], 30, 'GOLD_HOT', 0.5); }

    // The grid spreads, a city per 16th.
    s.hits('cities').forEach((h, i) => {
      const { p, par } = NODES[i];
      const lineK = span(t, h.t0 - 0.14, h.t0, ease.out);
      if (lineK <= 0) return;
      stroke(ctx, [par, [lerp(par[0], p[0], lineK), lerp(par[1], p[1], lineK)]], 1, { pen: { color: 'GOLD', alpha: 0.7, width: 1.3 }, tip: false });
      if (t < h.t0) return;
      const age = t - h.t0, fl = Math.exp(-age / 0.2);
      dot(ctx, p[0], p[1], 3.5 + 2 * fl, 'GOLD_HOT', 1);
      glow(ctx, p[0], p[1], 22 + 30 * fl, 'GOLD_HOT', 0.45 + 0.4 * fl);
      if (fl > 0.05) circle(ctx, p[0], p[1], 8 + 26 * (1 - fl), 1, { pen: { color: 'GOLD_HOT', alpha: 0.7 * fl, width: 1.4 }, tip: false });
    });

    telephone(ctx, s, t);
    odometer(ctx, s, t);
    s.screen(() => {
      text(s.ui, 'CARBON FILAMENT LAMP · 1879', 960, 900, { voice: 'data', size: 26, alpha: 0.85 * span(t, 0.2, 0.5) * (1 - span(t, 2.3, 2.6)), fact: 'lightbulb_1879', scale: s.S });
      card(s, 'card_night', { x: 960, y: 196, size: 100 });
    });
    card(s, 'data_patent', { x: 1500, y: 846, size: 28, voice: 'dataBold' });
  },
});

function telephone(ctx, s, t) {
  const p = s.cue('telephone', ease.inOut), fade = 1 - span(t, 5.9, 6.2);
  if (p <= 0 || fade <= 0) return;
  const A = { color: 'GOLD', alpha: 0.95 * fade, width: 1.8 };
  const L = [1290, 560], R = [1710, 560];
  // Transmitter and receiver: horn, diaphragm, electromagnet
  for (const [x, y, dir] of [[L[0], L[1], -1], [R[0], R[1], 1]]) {
    const q = sub(p, dir < 0 ? 0 : 0.15, dir < 0 ? 0.45 : 0.6);
    stroke(ctx, [[x + dir * 70, y - 52], [x + dir * 14, y - 18], [x + dir * 14, y + 18], [x + dir * 70, y + 52]], q, { pen: A, tip: false });
    stroke(ctx, [[x + dir * 8, y - 44], [x + dir * 8, y + 44]], q, { pen: { ...A, color: 'GOLD_HOT', width: 2.4 }, tip: false });
    stroke(ctx, [[x - dir * 6, y - 14], [x - dir * 60, y - 14], [x - dir * 60, y + 14], [x - dir * 6, y + 14]], q, { pen: A, closed: true, tip: false });
    for (let k = 0; k < 6; k++) stroke(ctx, [[x - dir * (12 + k * 8), y - 20], [x - dir * (16 + k * 8), y + 20]], q, { pen: { ...A, width: 1.1, alpha: 0.7 * fade }, tip: false });
  }
  // The line: out on the top wire, back through the battery on the bottom wire
  const wq = sub(p, 0.3, 0.8);
  const top = [[L[0] + 60, L[1] - 14], [L[0] + 60, 440], [R[0] - 60, 440], [R[0] - 60, R[1] - 14]];
  const bot = [[L[0] + 60, L[1] + 14], [L[0] + 60, 680], [R[0] - 60, 680], [R[0] - 60, R[1] + 14]];
  stroke(ctx, top, wq, { pen: A, tip: false });
  stroke(ctx, bot, wq, { pen: A, tip: false });
  const bx = 1500;
  if (wq > 0.6) {
    ctx.fillStyle = rgba('INK', fade); ctx.fillRect(bx - 16, 668, 32, 24);
    stroke(ctx, [[bx - 10, 660], [bx - 10, 700]], 1, { pen: { ...A, width: 2.4 }, tip: false });
    stroke(ctx, [[bx + 10, 670], [bx + 10, 690]], 1, { pen: { ...A, width: 2.4 }, tip: false });
  }
  // Sound in, sound out; current runs around the loop.
  if (p > 0.5) {
    for (let k = 0; k < 3; k++) {
      const ph = (t * 1.8 + k / 3) % 1;
      stroke(ctx, arcPts(L[0] - 70 - 90 * (1 - ph), L[1], 30 + 30 * (1 - ph), -0.6, 0.6, 12), 1, { pen: { color: 'GOLD_HOT', alpha: 0.7 * ph * fade, width: 1.4 }, tip: false });
      stroke(ctx, arcPts(R[0] + 70 + 90 * ph - 120, R[1], 30 + 30 * ph, -0.6, 0.6, 12).map(([x, y]) => [2 * (R[0] + 70) - x + 0, y]), 1, { pen: { color: 'GOLD_HOT', alpha: 0.7 * (1 - ph) * fade, width: 1.4 }, tip: false });
    }
    const loop = top.concat(bot.slice().reverse());
    for (let k = 0; k < 4; k++) {
      const u = (t * 0.6 + k / 4) % 1, n = loop.length - 1, f = u * n, i = Math.floor(f);
      const a = loop[i], b = loop[Math.min(n, i + 1)];
      const x = lerp(a[0], b[0], f - i), y = lerp(a[1], b[1], f - i);
      glow(ctx, x, y, 14, 'GOLD_HOT', 0.8 * fade); dot(ctx, x, y, 2.6, 'WHITE', fade);
    }
  }
  text(s.ui, 'TELEPHONE · 1876', 1500, 400, { voice: 'data', size: 26, alpha: 0.85 * sub(p, 0.1, 0.4) * fade, fact: 'telephone_1876', scale: s.S });
}

function odometer(ctx, s, t) {
  const p = s.env('4.1', '4.2', ease.inOut);
  if (p <= 0) return;
  const cx = 1500, cy = 600, w = 300, h = 74;
  stroke(ctx, [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]], p, { pen: { color: 'GOLD_HOT', alpha: 1, width: 2.2 }, closed: true });
  for (let i = 1; i < 6; i++) stroke(ctx, [[cx - w / 2 + (i * w) / 6, cy - h / 2 + 6], [cx - w / 2 + (i * w) / 6, cy + h / 2 - 6]], p, { pen: { color: 'GOLD', alpha: 0.4, width: 1 }, tip: false });
  // The count: from the first patent to the first of 1900, slowing as it lands.
  const v = 1 + 640166 * span(t, 6.2, 7.5, ease.out);
  if (p >= 1) rollingNumber(s.ui, v, cx, cy, { size: 34, digits: 6, track: 0.75, fact: 'patent_1900', scale: s.S });
  // The gear train that drives the drums turns fast, then stops.
  const rot = 1 - Math.exp(-Math.max(0, t - 6.2) * 1.6);
  const r1 = rot * 26;
  gear(ctx, cx - w / 2 - 70, cy, 46, 16, r1, p, { depth: 8, holes: 4, pen: { color: 'GOLD_HOT', alpha: 0.9, width: 1.8 } });
  gear(ctx, cx - w / 2 - 70 + 35, cy + 61, 24, 8, meshRot(r1, 16, 8, Math.atan2(61, 35)), p, { depth: 7, holes: 0, pen: { color: 'GOLD', alpha: 0.9, width: 1.6 } });
  text(s.ui, 'PATENTS ISSUED', cx, cy - 74, { voice: 'marker', size: 24, alpha: 0.85 * p, scale: s.S });
}

