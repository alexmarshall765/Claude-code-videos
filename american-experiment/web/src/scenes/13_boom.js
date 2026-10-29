// OBS 13 · ACT IV — THE POSTWAR BOOM, 1945–1965.
//   77.1  the Interstate network draws across the map: 1956 · 41,000 MI PLANNED
//   78.1  PROSPERITY, AT SCALE. The map slides left; a loupe opens on a suburb's
//         curving street grid; three charts grow, one per downbeat: life expectancy,
//         real family income, homes with television
//   79.3  a tiny transistor, 1947, is planted in the corner for OBS 15

import { scene, SEED } from './common.js';
import { rgba } from '../theme.js';
import { ease, clamp, lerp, sub, span, TAU, mulberry32 } from '../engine.js';
import { stroke, circle, arcPts, glow } from '../draw/paths.js';
import { card, text } from '../draw/type.js';
import { mapView, outline, borders, schematic, INTERSTATES, routePts } from '../draw/map.js';
import { scales, axes, series } from '../draw/charts.js';
import { transistor } from '../draw/icons.js';

const LOUPE = { x: 330, y: 790, r: 128 };
const CHARTS = [
  { title: 'LIFE EXPECTANCY · 1900–1960', fact: 'life_expectancy', x: [1900, 1960], y: [40, 75], data: [[1900, 47.3], [1910, 50.0], [1920, 54.1], [1930, 59.7], [1940, 62.9], [1950, 68.2], [1960, 69.7]] },
  { title: 'REAL FAMILY INCOME · 1947–1964', fact: 'real_income', x: [1947, 1964], y: [3000, 7000], data: [[1947, 4200], [1964, 6600]] },
  { title: 'HOMES WITH TELEVISION · 1950–1960', fact: 'tv_households', x: [1950, 1960], y: [0, 100], data: [[1950, 12], [1955, 67.2], [1958, 83], [1960, 87]] },
].map((c, i) => ({ ...c, sc: scales({ x: 1060, y: 360 + i * 210, w: 700, h: 108 }, c.x, c.y) }));

// A suburb: curving streets of identical houses, as from the air
const STREETS = [0, 1, 2, 3, 4].map(k => ({ r: 50 + k * 34, a0: -2.6 + k * 0.1, a1: 0.2 + k * 0.05 }));
const HOUSES = (() => {
  const out = [], R = mulberry32(1947);
  STREETS.forEach((st, k) => {
    for (let a = st.a0 + 0.12; a < st.a1; a += 34 / st.r / 1.0) out.push({ k, a, r: st.r + 14, u: R() });
  });
  return out;
})();

export default scene('13_boom', {
  camera: s => ({ x: 960, y: 540, zoom: 1 + 0.02 * span(s.t, 0, 8) }),

  draw(ctx, s) {
    const t = s.t;
    s.bloom = 0.44;
    // The map: large while the Interstates draw, then it slides left.
    const m = span(t, 2.0, 2.6, ease.inOut);
    const V = mapView(lerp(480, 110, m), lerp(310, 340, m), lerp(960, 760, m));
    outline(ctx, V, span(t, 0, 0.6), { pen: { color: 'GOLD', alpha: 0.6, width: 1.4 }, tip: false });
    borders(ctx, V, span(t, 0, 0.6), { pen: { color: 'GOLD', alpha: 0.14, width: 1 } });
    schematic(s, V, span(t, 0, 0.6) * (1 - span(t, 1.8, 2.1) + span(t, 2.6, 2.9)));
    const ip = s.cue('interstate', ease.inOut);
    INTERSTATES.forEach((codes, i) => {
      const q = sub(ip, (i % 7) * 0.05, (i % 7) * 0.05 + 0.65);
      if (q > 0) stroke(ctx, routePts(V, codes), q, { pen: { color: 'GOLD_HOT', alpha: 0.9, width: 2 }, tipK: 0.8 });
    });

    // The suburb, in a loupe over Levittown
    const sp = s.cue('suburb', ease.inOut);
    if (sp > 0) {
      const lev = V.P(-73.51, 40.73), { x, y, r } = LOUPE;
      const ang = Math.atan2(lev[1] - y, lev[0] - x);
      stroke(ctx, [lev, [x + Math.cos(ang) * r, y + Math.sin(ang) * r]], sub(sp, 0, 0.3), { pen: { color: 'GOLD', alpha: 0.6, width: 1 }, tip: false, dash: [4, 5] });
      circle(ctx, lev[0], lev[1], 6, sub(sp, 0, 0.2), { pen: { color: 'GOLD_HOT', alpha: 1, width: 1.6 }, tip: false });
      circle(ctx, x, y, r, sub(sp, 0.05, 0.4), { pen: { color: 'GOLD_HOT', alpha: 0.95, width: 2.4 }, tip: false, a0: ang });
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, r - 2, 0, TAU); ctx.clip();
      ctx.fillStyle = rgba('INK', 0.88 * sub(sp, 0.05, 0.3)); ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
      const cx = x - 10, cy = y + 112;
      STREETS.forEach((st, k) => stroke(ctx, arcPts(cx, cy, st.r, st.a0, st.a1, 40), sub(sp, 0.15 + k * 0.05, 0.55 + k * 0.05), { pen: { color: 'GOLD', alpha: 0.7, width: 3 }, tip: false }));
      HOUSES.forEach(h => {
        const q = sub(sp, 0.35 + h.u * 0.5, 0.45 + h.u * 0.5);
        if (q <= 0) return;
        const hx = cx + Math.cos(h.a) * h.r, hy = cy + Math.sin(h.a) * h.r, rot = h.a + Math.PI / 2;
        const c = Math.cos(rot), si = Math.sin(rot), w = 8 * q, d = 6 * q;
        const P = (u, v) => [hx + u * c - v * si, hy + u * si + v * c];
        stroke(ctx, [P(-w, -d), P(w, -d), P(w, d), P(-w, d)], 1, { pen: { color: 'GOLD_HOT', alpha: 0.9, width: 1.2 }, closed: true, tip: false });
        stroke(ctx, [P(-w, 0), P(w, 0)], 1, { pen: { color: 'GOLD', alpha: 0.7, width: 1 }, tip: false });
      });
      ctx.restore();
    }

    // Three charts grow on the downbeats.
    s.hits('charts').forEach((h, i) => {
      const c = CHARTS[i], q = clamp((t - h.t0) / (h.t1 - h.t0));
      if (q <= 0) return;
      axes(s, ctx, c.sc, ease.out(clamp(q * 2.5)), { xTicks: c.x, fact: c.fact, title: c.title, titleFact: c.fact });
      series(ctx, c.sc, c.data, ease.inOut(clamp(q * 1.2)), { smooth: c.data.length > 2, area: true, areaStyle: rgba('GOLD', 0.2), areaGap: 8, pen: { color: 'GOLD_HOT', alpha: 1, width: 3 } });
    });

    // The seed: a tiny transistor, planted for later
    const tp = s.env('3.3', '4.1', ease.out);
    if (tp > 0) {
      transistor(ctx, SEED.x, SEED.y, SEED.s, { p: tp, glint: Math.exp(-s.since('3.3') / 0.4) });
      text(s.ui, '1947', SEED.x - 38, SEED.y + 34, { voice: 'data', size: 24, align: 'right', alpha: 0.8 * clamp(tp * 2), fact: 'transistor_1947', scale: s.S });
      if (s.since('3.3') < 0.6) glow(ctx, SEED.x, SEED.y, 40, 'GOLD_HOT', 0.5 * (1 - s.since('3.3') / 0.6));
    }

    s.screen(() => {
      card(s, 'card_prosperity', { x: 960, y: 196, size: 100 });
      card(s, 'data_interstate', { x: 960, y: 272, size: 30, voice: 'dataBold' });
      card(s, 'data_life', { x: 490, y: 300, size: 28, voice: 'dataBold' });
    });
  },
});
