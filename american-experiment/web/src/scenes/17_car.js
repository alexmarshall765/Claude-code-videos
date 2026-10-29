// OBS 17 · ACT V — THE CAR, REINVENTED, 2008–2025. A century after OBS 11.
//   109.1  match: the globe's circle grows teeth and drives OBS 11's line again; the
//          1913 chassis morph into flat battery platforms
//   109.3  one platform turns to plan: thousands of cylindrical cells light in waves,
//          a 16th at a time, while a motor's stator and rotor spin up with the whine
//   111.1  impact: chargers spread along the Interstates of OBS 13, outward from Detroit

import { scene, MATCH } from './common.js';
import { rgba } from '../theme.js';
import { ease, clamp, lerp, sub, span, TAU } from '../engine.js';
import { stroke, circle, glow, dot, arcPts, hatch, pathLength, pointAt } from '../draw/paths.js';
import { card } from '../draw/type.js';
import { gearPts, gear } from '../draw/gears.js';
import { assemblyLine, LINE } from '../draw/conveyor.js';
import { mapView, outline, borders, schematic, INTERSTATES, routePts, CITY } from '../draw/map.js';

const PACK = { x0: 470, y0: 418, cols: 84, rows: 25, sp: 15 };
const MOTOR = { x: 300, y: 600, r: 112 };
const V = mapView(560, 300, 800);
const DET = V.P(...CITY.DET);
const CHARGERS = (() => {
  const out = [];
  for (const codes of INTERSTATES) {
    const pts = routePts(V, codes), L = pathLength(pts);
    for (let d = 10; d < L; d += 30) { const [x, y] = pointAt(pts, d / L); out.push({ x, y, k: Math.hypot(x - DET[0], y - DET[1]) }); }
  }
  const kMax = Math.max(...out.map(c => c.k));
  return out.map(c => ({ ...c, at: 4.15 + 3.2 * (c.k / kMax) }));
})();

/** Motor angle: it spins up with the whine (integral of a rising speed). */
const motorAngle = t => { const u = clamp((t - 1.5) / 2.5); return 2 * Math.max(0, t - 1.5) + (40 * 2.5 * u * u * u) / 3 + (t > 4 ? 40 * (t - 4) : 0); };

export default scene('17_car', {
  camera: s => ({ x: 960, y: 560, zoom: 1 + 0.02 * span(s.t, 4, 8) }),

  draw(ctx, s) {
    const t = s.t;
    s.bloom = 0.5;
    s.flash = 0.45 * Math.exp(-Math.max(0, t - 4) / 0.12) * (t >= 4 ? 1 : 0);
    // The globe's circle grows teeth and becomes the drive gear of the line.
    const grow = span(t, 0.05, 0.4, ease.inOut), move = span(t, 0.35, 0.95, ease.inOut);
    const lineA = 1 - span(t, 1.3, 1.7);
    if (lineA > 0) {
      const cx = lerp(MATCH.cx, LINE.x0, move), cy = lerp(MATCH.cy, LINE.y + LINE.sprocket, move), r = lerp(MATCH.r, LINE.sprocket, move);
      const rot = (LINE.speed * t) / LINE.sprocket;
      if (move < 1) stroke(ctx, gearPts(cx, cy, r, 14, rot, r * 0.2 * grow), 1, { pen: { color: 'GOLD_HOT', alpha: lineA, width: 2.4 }, tip: false });
      else gear(ctx, cx, cy, r, 14, rot, 1, { depth: 10, holes: 4, pen: { color: 'GOLD_HOT', alpha: lineA, width: 2 } });
      const build = span(t, 0.4, 0.9, ease.inOut), m = span(t, 0.7, 1.2, ease.inOut);
      ctx.globalAlpha = lineA;
      assemblyLine(ctx, s, t + 2, { build, alpha: 1 - m, hitAt: i => i * 0.125, noDrive: true, kind: '1913' });
      assemblyLine(ctx, s, t + 2, { build, alpha: m, hitAt: i => i * 0.125, noDrive: true, kind: 'ev', cellsLit: 0.8 });
      ctx.globalAlpha = 1;
    }

    // One platform in plan: the pack's cells and the motor
    const flip = span(t, 1.25, 1.85, ease.inOut);
    const packA = 1 - span(t, 3.95, 4.05);
    if (flip > 0 && packA > 0) {
      const W = PACK.cols * PACK.sp, H = PACK.rows * PACK.sp, cy0 = PACK.y0 + H / 2;
      const sy = lerp(0.06, 1, flip);
      const Y = y => cy0 + (y - cy0) * sy;
      ctx.globalAlpha = packA;
      // Frame of the skateboard and its wheels
      stroke(ctx, [[PACK.x0 - 20, Y(PACK.y0 - 20)], [PACK.x0 + W + 20, Y(PACK.y0 - 20)], [PACK.x0 + W + 20, Y(PACK.y0 + H + 20)], [PACK.x0 - 20, Y(PACK.y0 + H + 20)]], 1, { pen: { color: 'GOLD_HOT', alpha: 1, width: 2.4 }, closed: true, tip: false });
      for (const [wx, wy] of [[PACK.x0 + 60, PACK.y0 - 70], [PACK.x0 + 60, PACK.y0 + H + 70], [PACK.x0 + W - 60, PACK.y0 - 70], [PACK.x0 + W - 60, PACK.y0 + H + 70]]) {
        const poly = [[wx - 70, Y(wy - 24)], [wx + 70, Y(wy - 24)], [wx + 70, Y(wy + 24)], [wx - 70, Y(wy + 24)]];
        stroke(ctx, poly, 1, { pen: { color: 'GOLD', alpha: 0.9, width: 1.8 }, closed: true, tip: false });
        hatch(ctx, poly, flip, { angle: Math.PI / 2, gap: 10, alpha: 0.35 });
      }
      // Cells: dim until their 16th, then lit, the wave still shimmering behind
      const lit = s.count('cells'), hits = s.hits('cells');
      for (let c = 0; c < PACK.cols; c++) {
        const k = Math.floor((c * 24) / PACK.cols), on = k < lit;
        const age = on ? t - hits[k].t0 : 0, fl = on ? Math.exp(-age / 0.2) : 0;
        const shimmer = on ? 0.75 + 0.25 * Math.sin(c * 0.35 - t * 9) : 0;
        ctx.strokeStyle = rgba(fl > 0.3 ? 'WHITE' : on ? 'GOLD_HOT' : 'GOLD', on ? 0.7 * shimmer + 0.3 * fl : 0.2);
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        for (let r = 0; r < PACK.rows; r++) {
          const x = PACK.x0 + c * PACK.sp + 7, y = Y(PACK.y0 + r * PACK.sp + 7);
          ctx.moveTo(x + 5.6, y); ctx.ellipse(x, y, 5.6, 5.6 * sy, 0, 0, TAU);
        }
        if (on) { ctx.fillStyle = rgba('GOLD_HOT', 0.22 * shimmer + 0.5 * fl); ctx.fill(); }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // The motor in section: stator teeth and windings, rotor magnets, shaft
      const mp = span(t, 1.5, 2.1, ease.inOut) * packA;
      if (mp > 0) {
        const { x, y, r } = MOTOR, th = motorAngle(t);
        circle(ctx, x, y, r, mp, { pen: { color: 'GOLD_HOT', alpha: 1, width: 2.4 }, tip: false });
        circle(ctx, x, y, r * 0.66, mp, { pen: { color: 'GOLD', alpha: 0.9, width: 1.4 }, tip: false });
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * TAU, a2 = a + TAU / 48;
          stroke(ctx, [[x + Math.cos(a) * r * 0.66, y + Math.sin(a) * r * 0.66], [x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9]], mp, { pen: { color: 'GOLD', alpha: 0.8, width: 1.2 }, tip: false });
          stroke(ctx, arcPts(x, y, r * 0.78, a + 0.03, a2 + 0.06, 6), mp, { pen: { color: 'GOLD_HOT', alpha: 0.6, width: 3 }, tip: false });
        }
        circle(ctx, x, y, r * 0.58, mp, { pen: { color: 'GOLD_HOT', alpha: 1, width: 2 }, tip: false, a0: th });
        for (let k = 0; k < 4; k++) {
          const a0 = th + (k * TAU) / 4 + 0.2, a1 = a0 + TAU / 4 - 0.4;
          const poly = arcPts(x, y, r * 0.56, a0, a1, 10).concat(arcPts(x, y, r * 0.4, a1, a0, 10));
          stroke(ctx, poly, mp, { pen: { color: 'GOLD', alpha: 0.9, width: 1.4 }, closed: true, tip: false });
          hatch(ctx, poly, mp, { angle: th + (k % 2 ? 0.8 : -0.8), gap: 5, alpha: 0.5 });
        }
        circle(ctx, x, y, 12, mp, { pen: { color: 'GOLD_HOT', alpha: 1, width: 2 }, tip: false });
        stroke(ctx, [[x, y], [x + Math.cos(th) * 12, y + Math.sin(th) * 12]], mp, { pen: { color: 'GOLD_HOT', alpha: 1, width: 2 }, tip: false });
        stroke(ctx, [[x + r, y], [PACK.x0 - 20, y]], mp, { pen: { color: 'GOLD', alpha: 0.7, width: 2 }, tip: false, dash: [6, 5] });
        const sp = clamp((t - 1.5) / 2.5);
        if (sp > 0) glow(ctx, x, y, r * 1.2, 'GOLD_HOT', 0.2 * sp);
      }
    }

    // Chargers along the Interstates, spreading out from Detroit
    if (t >= 4) {
      const ma = span(t, 4, 4.4);
      outline(ctx, V, ma, { pen: { color: 'GOLD', alpha: 0.55, width: 1.3 }, tip: false });
      borders(ctx, V, ma, { pen: { color: 'GOLD', alpha: 0.12, width: 1 } });
      schematic(s, V, ma);
      INTERSTATES.forEach(codes => stroke(ctx, routePts(V, codes), ma, { pen: { color: 'GOLD', alpha: 0.5, width: 1.4 }, tip: false }));
      for (const c of CHARGERS) {
        if (t < c.at) continue;
        const age = t - c.at, fl = Math.exp(-age / 0.25);
        dot(ctx, c.x, c.y, 2.8 + 2 * fl, 'GOLD_HOT', 1);
        if (fl > 0.05) glow(ctx, c.x, c.y, 14 + 10 * fl, 'GOLD_HOT', 0.6 * fl);
      }
      dot(ctx, DET[0], DET[1], 5, 'WHITE', ma);
      glow(ctx, DET[0], DET[1], 40, 'GOLD_HOT', 0.5 * ma);
    }

    s.screen(() => {
      card(s, 'card_reinvented', { x: 960, y: 196, size: 100 });
      card(s, 'card_electric', { x: 960, y: 196, size: 100 });
      card(s, 'data_ev', { x: 960, y: 880, size: 28, voice: 'dataBold' });
    });
  },
});
