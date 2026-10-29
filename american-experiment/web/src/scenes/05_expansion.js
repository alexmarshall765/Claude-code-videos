// OBS 05 · ACT II · THE FRONTIER — EXPANSION, 1785–1848.
//   25.1  the continent's outline draws (us-atlas, schematic)
//   26.1  the original states fill
//   27.1  a surveyor's crosshair leads the 1785 township grid west across the 1783 lands
//   29.1  the Louisiana Purchase fills: THE NATION DOUBLES.  29.3 the Corps of Discovery's
//         route draws to the Pacific and back, with a day counter
//   30.1  Florida   31.1 Texas   31.3 Oregon   32.1 the 1848 cession; contours rise over the Rockies

import { scene, zoomAbout } from './common.js';
import { rgba } from '../theme.js';
import { ease, clamp, lerp, sub, span, TAU, noise1 } from '../engine.js';
import { stroke, circle, glow, dot } from '../draw/paths.js';
import { card, text, textWidth } from '../draw/type.js';
import { US, mapView, outline, borders, fillStates, groupOutline, statesPath, schematic } from '../draw/map.js';

const V = mapView(445, 300, 1030);

const FILLS = [
  { group: 'original', dir: 'south', angle: -Math.PI / 4, gap: 6, label: 'ORIGINAL STATES', at: [1496, 600], align: 'left', leader: [-77.5, 37.8] },
  { group: 'louisiana', dir: 'west', angle: Math.PI / 4, gap: 7 },
  { group: 'florida', dir: 'south', angle: -Math.PI / 4, gap: 6, label: 'FLORIDA · 1819', at: [1404, 884], align: 'left' },
  { group: 'texas', dir: 'west', angle: 0, gap: 6, label: 'TEXAS · 1845', at: [930, 822], align: 'center' },
  { group: 'oregon', dir: 'west', angle: Math.PI / 2, gap: 7, label: 'OREGON · 1846', at: [432, 368], align: 'right' },
  { group: 'cession', dir: 'west', angle: -Math.PI / 3, gap: 7, label: 'CESSION · 1848', at: [432, 690], align: 'right' },
];

// The Corps of Discovery: waypoints with the day of the expedition (from May 14, 1804).
const ROUTE = [
  [-90.10, 38.80, 0], [-90.48, 38.78, 7], [-94.58, 39.10, 43], [-95.93, 41.26, 81], [-96.40, 42.50, 98],
  [-100.35, 44.37, 134], [-101.00, 47.30, 172], [-101.0, 47.31, 328], [-104.00, 48.00, 346], [-111.30, 47.50, 395],
  [-111.55, 45.90, 439], [-113.45, 44.97, 455], [-114.58, 46.63, 487], [-117.02, 46.42, 514], [-121.18, 45.60, 529],
  [-123.88, 46.13, 572],
];
const RPTS = V.route(ROUTE.map(([lo, la]) => [lo, la]));
// Progress along the route is shared out by length, plus a pause for the winter at Fort Mandan.
const RU = (() => {
  const L = [0];
  for (let i = 1; i < RPTS.length; i++) L.push(L[i - 1] + Math.hypot(RPTS[i][0] - RPTS[i - 1][0], RPTS[i][1] - RPTS[i - 1][1]) + (ROUTE[i][2] - ROUTE[i - 1][2] > 100 ? 70 : 0));
  return L.map(v => v / L[L.length - 1]);
})();
/** Route drawn to progress u: the visible polyline, the head and the day of the expedition. */
function routeAt(u) {
  let j = 1;
  while (j < RU.length - 1 && RU[j] < u) j++;
  const f = clamp((u - RU[j - 1]) / (RU[j] - RU[j - 1] || 1));
  const head = [lerp(RPTS[j - 1][0], RPTS[j][0], f), lerp(RPTS[j - 1][1], RPTS[j][1], f)];
  return { pts: RPTS.slice(0, j).concat([head]), head, day: lerp(ROUTE[j - 1][2], ROUTE[j][2], f) };
}

// The 1785 survey starts at the Point of Beginning on the Ohio River.
const POB = V.P(-80.52, 40.64), MISS = V.P(-91.0, 39.4);

// Rocky Mountain peaks for the contours.
const PEAKS = [[-105.6, 40.3, 1], [-110.8, 43.7, 0.9], [-106.4, 38.8, 0.95], [-109.6, 43.0, 0.8], [-114.6, 45.2, 0.85], [-110.3, 40.7, 0.7], [-113.8, 48.4, 0.8], [-107.5, 37.6, 0.75]];

function label(s, str, x, y, a, o = {}) {
  if (a <= 0) return;
  const size = o.size || 24, w = textWidth(s.ui, str, { voice: o.voice || 'data', size });
  const x0 = o.align === 'left' ? x : o.align === 'right' ? x - w : x - w / 2;
  s.ui.fillStyle = rgba('INK', 0.72 * a);
  s.ui.fillRect(x0 - 8, y - size * 0.75, w + 16, size * 1.5);
  text(s.ui, str, x, y, { voice: o.voice || 'data', size, align: o.align || 'center', alpha: a, fact: o.fact, scale: s.S, color: o.color });
}

export default scene('05_expansion', {
  camera: s => zoomAbout(960, 620, 1 + 0.035 * span(s.t, 0, 16, ease.sineInOut)),

  draw(ctx, s) {
    const t = s.t;
    s.bloom = 0.4;
    const cont = s.cue('continent', ease.inOut);
    outline(ctx, V, cont, { pen: { color: 'GOLD', alpha: 0.95, width: 2 } });
    borders(ctx, V, sub(cont, 0.35, 1), { pen: { color: 'GOLD', alpha: 0.26, width: 1 }, sweep: 'west' });

    // The township grid sweeps west behind the survey crosshair.
    const sv = s.env('3.1', '4.4', ease.inOut);
    const svA = s.env('3.1', '3.2', ease.out);
    if (svA > 0) {
      const cx = lerp(POB[0], MISS[0], sv), cy = lerp(POB[1], MISS[1], sv);
      ctx.save();
      statesPath(ctx, V, US.groups.treaty1783.states); ctx.clip();
      ctx.strokeStyle = rgba('GOLD', 0.38); ctx.lineWidth = 1;
      ctx.beginPath();
      const gap = 9.5;
      for (let x = Math.floor((cx - V.x) / gap) * gap + V.x; x <= V.x + V.w; x += gap) { ctx.moveTo(x, V.y); ctx.lineTo(x, V.y + V.h); }
      for (let y = V.y; y <= V.y + V.h; y += gap) { ctx.moveTo(cx, y); ctx.lineTo(V.x + V.w, y); }
      ctx.stroke();
      ctx.fillStyle = rgba('GOLD', 0.05); ctx.fillRect(cx, V.y, V.x + V.w - cx, V.h);
      ctx.restore();
      if (sv >= 1) groupOutline(ctx, V, 'treaty1783', 1, { pen: { color: 'GOLD', alpha: 0.55, width: 1.4 } });
      // Crosshair, hairlines and the meridian it lays down
      const ca = svA * (1 - s.env('4.4', '5.2'));
      stroke(ctx, [[cx, V.y - 10], [cx, V.y + V.h + 10]], 1, { pen: { color: 'GOLD_HOT', alpha: 0.35 * ca, width: 1 }, tip: false, dash: [3, 6] });
      stroke(ctx, [[V.x - 10, cy], [V.x + V.w + 10, cy]], 1, { pen: { color: 'GOLD_HOT', alpha: 0.35 * ca, width: 1 }, tip: false, dash: [3, 6] });
      circle(ctx, cx, cy, 22, 1, { pen: { color: 'GOLD_HOT', alpha: ca, width: 1.8 }, tip: false });
      circle(ctx, cx, cy, 34, 1, { pen: { color: 'GOLD_HOT', alpha: 0.5 * ca, width: 1 }, tip: false, a0: t * 1.4 });
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) stroke(ctx, [[cx + dx * 10, cy + dy * 10], [cx + dx * 44, cy + dy * 44]], 1, { pen: { color: 'GOLD_HOT', alpha: ca, width: 1.6 }, tip: false });
      glow(ctx, cx, cy, 30, 'GOLD_HOT', 0.35 * ca);
      label(s, '1785 · TOWNSHIPS 6 MI SQUARE', 1010, 330, svA * (1 - s.env('5.1', '5.3')), { fact: 'land_ordinance_1785' });
    }

    // The acquisitions fill on their downbeats.
    const fills = s.hits('fill');
    FILLS.forEach((f, i) => {
      const h = fills[i], k = clamp((t - h.t0) / 0.9);
      if (k <= 0) return;
      fillStates(ctx, V, US.groups[f.group].states, ease.inOut(k), { dir: f.dir, angle: f.angle, gap: f.gap, tint: 0.05, alpha: 0.42 });
      const flash = Math.exp(-(t - h.t0 - 0.6) / 0.35);
      groupOutline(ctx, V, f.group, ease.inOut(clamp(k * 1.4)), { pen: { color: flash > 0.2 && t > h.t0 + 0.6 ? 'GOLD_HOT' : 'GOLD', alpha: 0.6 + 0.4 * clamp(flash), width: 1.6 + clamp(flash) } });
      if (f.label) {
        const la = ease.out(clamp((t - h.t0 - 0.3) / 0.4));
        label(s, f.label, f.at[0], f.at[1], la, { align: f.align, fact: f.group === 'original' ? undefined : 'acquisitions' });
        if (f.leader) {
          const [lx, ly] = V.P(...f.leader);
          stroke(ctx, [[f.at[0] - 10, f.at[1]], [lx, ly]], la, { pen: { color: 'GOLD', alpha: 0.6, width: 1 }, tip: false });
          dot(ctx, lx, ly, 3, 'GOLD_HOT', la);
        }
      }
    });
    // Louisiana: the purchase that doubled the nation
    const lou = clamp((t - fills[1].t0 - 0.3) / 0.4);
    if (lou > 0) {
      const louA = ease.out(lou) * (1 - span(t, s.at('7.1'), s.at('7.1') + 0.35));
      label(s, 'LOUISIANA PURCHASE', 800, 636, louA, { voice: 'marker', size: 24 });
    }
    card(s, 'data_1803', { x: 800, y: 680, size: 28, voice: 'dataBold' });

    // The Corps of Discovery: out to the Pacific and back, the day counter running.
    const lc0 = s.at('5.3'), lcOut = lc0 + 2.3, lcHold = lcOut + 0.35, lcEnd = s.at('6.4') + 0.5;
    if (t >= lc0) {
      const r = routeAt(span(t, lc0, lcOut, ease.inOut));
      let day = r.day, [px, py] = r.head;
      const ra = 1 - span(t, 14.2, 15.2);
      stroke(ctx, r.pts, 1, { pen: { color: 'GOLD_HOT', alpha: 0.95 * ra, width: 2.2 }, tip: false, dash: [2, 7] });
      if (t > lcOut) {
        day = t < lcHold ? lerp(572, 678, (t - lcOut) / (lcHold - lcOut)) : lerp(678, 862, span(t, lcHold, lcEnd, ease.inOut));
        [px, py] = routeAt(1 - span(t, lcHold, lcEnd, ease.inOut)).head;
      }
      if (ra > 0) {
        dot(ctx, px, py, 4.5, 'GOLD_HOT', ra);
        glow(ctx, px, py, 24, 'GOLD_HOT', 0.5 * ra);
        const la = ease.out(clamp((t - lc0) / 0.3)) * ra;
        label(s, 'CORPS OF DISCOVERY', 432, 504, la, { voice: 'marker', size: 24, align: 'right' });
        label(s, `DAY ${Math.round(day)}`, 432, 544, la, { voice: 'dataBold', size: 28, align: 'right', fact: 'corps_of_discovery' });
        const [sx, sy] = RPTS[0];
        circle(ctx, sx, sy, 7, la, { pen: { color: 'GOLD_HOT', alpha: la, width: 1.6 }, tip: false });
      }
    }

    // Contour lines rise over the Rockies.
    const ct = s.cue('contours', ease.inOut);
    if (ct > 0) {
      PEAKS.forEach(([lo, la, h], pi) => {
        const [x, y] = V.P(lo, la);
        for (let k = 0; k < 4; k++) {
          const q = sub(ct, k * 0.14 + pi * 0.03, k * 0.14 + pi * 0.03 + 0.42);
          if (q <= 0) continue;
          const r0 = (40 - k * 9) * h, pts = [];
          for (let i = 0; i <= 48; i++) {
            const a = (i / 48) * TAU;
            const rr = r0 * (1 + 0.16 * noise1(Math.cos(a) * 1.4 + 3, pi * 13) + 0.1 * noise1(Math.sin(a) * 1.9 + 7, pi * 7 + k));
            pts.push([x + Math.cos(a) * rr * 1.3, y + Math.sin(a) * rr * 0.78 - k * 4 * q]);
          }
          stroke(ctx, pts, q, { pen: { color: k === 3 ? 'GOLD_HOT' : 'GOLD', alpha: 0.4 + k * 0.15, width: 1 + k * 0.2 }, tip: false, closed: q >= 1 });
        }
      });
    }

    schematic(s, V, cont, { x: 1548, y: 942 });
    s.screen(() => {
      card(s, 'card_surveyed', { x: 960, y: 196, size: 100 });
      card(s, 'card_doubles', { x: 960, y: 196, size: 100 });
    });
  },
});
