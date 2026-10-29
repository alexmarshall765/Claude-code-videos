// OBS 10 · ACT III — FLIGHT, 1903.
//   57.1  the flying machine assembles as a three-view blueprint, a part per 16th, and
//         its side view turns to three-quarter
//   58.1  liftoff. The flight plays in real time: a 0–120 ft ruler and a 12-second
//         stopwatch run for exactly six bars against the headwind
//   64.1  touchdown; the flight path stretches into a great circle around the globe

import { scene, MATCH } from './common.js';
import { rgba } from '../theme.js';
import { ease, clamp, lerp, span, TAU, noise1 } from '../engine.js';
import { stroke, circle, glow, dot } from '../draw/paths.js';
import { card, text } from '../draw/type.js';
import { flyer, flyerProjector, views, FLYER_PARTS } from '../draw/flyer.js';
import { globe } from '../draw/motif.js';
import { billows } from '../draw/particles.js';

const K = 12.5, GROUND = 760, X0 = 220, LIFT = 2, LAND = 14;
const PLATE = { x0: 160, y0: 300, x1: 1760, y1: 900 };
const WATCH = { x: 1620, y: 420, r: 84 };

const flightU = t => clamp((t - LIFT) / (LAND - LIFT));
// Height (ft) above the sand: it rose to about ten feet, pitching up and down.
const alt = u => (u <= 0 || u >= 1 ? 0 : Math.max(0, 10 * Math.pow(Math.sin(Math.PI * u), 0.55) + 1.4 * Math.sin(TAU * 2.3 * u) * Math.sin(Math.PI * u)));
const originAt = u => [X0 + 120 * u * K, GROUND - (2.4 - 0.8 * u + alt(u)) * K];
const attitude = u => (u <= 0 || u >= 1 ? 0 : 0.07 * Math.cos(TAU * 2.3 * u + 0.6) * Math.sin(Math.PI * u));

// The great circle the path becomes
const GC = { tilt: -0.32, b: 0.38 };
const gcPt = a => {
  const x = Math.cos(a) * MATCH.r, y = Math.sin(a) * MATCH.r * GC.b;
  return [MATCH.cx + x * Math.cos(GC.tilt) - y * Math.sin(GC.tilt), MATCH.cy + x * Math.sin(GC.tilt) + y * Math.cos(GC.tilt)];
};

export default scene('10_flight', {
  camera(s) {
    const t = s.t;
    const shake = t > LAND && t < LAND + 0.5 ? 4 * Math.exp(-(t - LAND) / 0.12) * noise1(t * 40, 9) : 0;
    return { x: 960 + shake, y: 540, zoom: 1 };
  },

  draw(ctx, s) {
    const t = s.t;
    s.bloom = 0.44;
    const out = span(t, 14.3, 14.9);
    const keep = 1 - out;

    // Blueprint plate (bar 57), fading as the side view turns to three-quarter
    const plateA = span(t, 0, 0.3) * (1 - span(t, 1.45, 1.85));
    if (plateA > 0) {
      stroke(ctx, [[PLATE.x0, PLATE.y0], [PLATE.x1, PLATE.y0], [PLATE.x1, PLATE.y1], [PLATE.x0, PLATE.y1]], span(t, 0, 0.35), { pen: { color: 'GOLD', alpha: 0.7 * plateA, width: 1.4 }, closed: true });
      ctx.strokeStyle = rgba('GOLD', 0.07 * plateA); ctx.lineWidth = 1; ctx.beginPath();
      for (let x = PLATE.x0 + 40; x < PLATE.x1; x += 40) { ctx.moveTo(x, PLATE.y0); ctx.lineTo(x, PLATE.y1); }
      for (let y = PLATE.y0 + 40; y < PLATE.y1; y += 40) { ctx.moveTo(PLATE.x0, y); ctx.lineTo(PLATE.x1, y); }
      ctx.stroke();
      const prog = FLYER_PARTS.map((_, i) => clamp((t - i * 0.125) / 0.25));
      flyer(ctx, views.plan(1240, 485, 14), prog, { alpha: plateA, prop: 0.3 });
      flyer(ctx, views.front(1240, 800, 14), prog, { alpha: plateA, prop: Math.PI / 2 });
      text(s.ui, 'PLAN', 1580, 330, { voice: 'marker', size: 24, alpha: 0.8 * plateA, scale: s.S });
      text(s.ui, 'FRONT', 1580, 700, { voice: 'marker', size: 24, alpha: 0.8 * plateA, scale: s.S });
      text(s.ui, 'SIDE', 230, 560, { voice: 'marker', size: 24, alpha: 0.8 * plateA, scale: s.S });
      text(s.ui, 'FLYING MACHINE · 1903', 190, 866, { voice: 'data', size: 24, align: 'left', alpha: 0.8 * plateA, fact: 'wright_flight', scale: s.S });
    }

    // The ground, the launching rail and the 0–120 ft ruler
    const ga = span(t, 1.4, 1.9) * keep;
    stroke(ctx, [[-60, GROUND], [1980, GROUND]], ga, { pen: { color: 'GOLD', alpha: 0.6, width: 1.3 }, tip: false });
    for (let x = -40; x < 1980; x += 26) stroke(ctx, [[x, GROUND + 4], [x - 8, GROUND + 14]], ga, { pen: { color: 'GOLD', alpha: 0.18, width: 1 }, tip: false });
    stroke(ctx, [[-100, GROUND - 0.6 * K], [X0 + 6 * K, GROUND - 0.6 * K]], ga, { pen: { color: 'GOLD', alpha: 0.85, width: 2.2 }, tip: false });
    const rk = span(t, 1.7, 2.5, ease.inOut) * keep;
    if (rk > 0) {
      const ry = GROUND + 36;
      stroke(ctx, [[X0, ry], [X0 + 120 * K, ry]], rk, { pen: { color: 'GOLD', alpha: 0.8, width: 1.4 }, tip: false });
      for (let f = 0; f <= 120; f += 5) {
        if (f / 120 > rk) break;
        const x = X0 + f * K, h = f % 40 === 0 ? 14 : f % 10 === 0 ? 9 : 5;
        stroke(ctx, [[x, ry], [x, ry - h]], 1, { pen: { color: 'GOLD', alpha: 0.8, width: 1 }, tip: false });
        if (f % 40 === 0) text(s.ui, f === 120 ? '120 FT' : String(f), x, ry + 24, { voice: 'data', size: 24, alpha: 0.8 * keep, fact: 'wright_flight', scale: s.S });
      }
    }

    // The machine: side view in the blueprint, turning to three-quarter, then flying.
    const u = flightU(t);
    const turn = span(t, 1.45, 2.0, ease.inOut);
    const [ox, oy] = originAt(u);
    const P = flyerProjector({ cx: ox, cy: oy, k: K, yaw: lerp(0, -0.55, turn), pitch: lerp(0, -0.2, turn), D: Math.exp(lerp(Math.log(4000), Math.log(160), turn)), att: attitude(u) });
    const prog = FLYER_PARTS.map((_, i) => clamp((t - i * 0.125) / 0.25));
    const spin = span(t, 1.8, 2.4);
    const fa = 1 - span(t, 14.3, 14.8);
    if (fa > 0) flyer(ctx, P, prog, { prop: t * 38, spin, alpha: fa, color: t > LIFT ? 'GOLD_HOT' : 'GOLD', depthCue: turn > 0.5 });

    // The flight: its trace, the ruler marker and the stopwatch, against the headwind
    if (t >= LIFT) {
      const trace = [];
      for (let k = 0; k <= 60; k++) trace.push(originAt(u * (k / 60)));
      const morph = span(t, 14.3, 15.3, ease.inOut);
      const arcA0 = Math.PI * 0.85;
      const shaped = trace.map((p, k) => {
        const q = gcPt(arcA0 + (k / 60) * Math.PI * 0.62);
        return [lerp(p[0], q[0], morph), lerp(p[1] + 1.6 * K, q[1], morph)];
      });
      stroke(ctx, shaped, 1, { pen: { color: 'GOLD_HOT', alpha: 0.85, width: 1.8 + 0.8 * morph }, tip: false, dash: morph > 0.5 ? undefined : [6, 7] });
      // The great circle closes around the globe.
      if (morph > 0) {
        const close = span(t, 15.0, 16.0, ease.inOut);
        const pts = [];
        for (let k = 0; k <= 90; k++) pts.push(gcPt(arcA0 + Math.PI * 0.62 + (k / 90) * Math.PI * 1.38 * close));
        if (close > 0) stroke(ctx, pts, 1, { pen: { color: 'GOLD_HOT', alpha: 0.9, width: 2.4 }, tip: false });
        const head = close > 0 ? pts[pts.length - 1] : shaped[shaped.length - 1];
        glow(ctx, head[0], head[1], 26, 'GOLD_HOT', 0.7 * morph);
        dot(ctx, head[0], head[1], 3.5, 'WHITE', morph);
      }
      if (keep > 0) {
        const mx = X0 + 120 * u * K, ry = GROUND + 36;
        stroke(ctx, [[mx - 8, ry + 10], [mx, ry + 1], [mx + 8, ry + 10]], 1, { pen: { color: 'GOLD_HOT', alpha: keep, width: 2 }, tip: false });
        stroke(ctx, [[X0, ry], [mx, ry]], 1, { pen: { color: 'GOLD_HOT', alpha: keep, width: 2.4 }, tip: false });
      }
      // Headwind streamlines, quickening with the build
      if (keep > 0) {
        const speed = 300 + 600 * u * u;
        ctx.strokeStyle = rgba('GOLD', 0.16 * keep); ctx.lineWidth = 1; ctx.beginPath();
        for (let j = 0; j < 12; j++) {
          const y = 330 + j * 32, off = ((t - LIFT) * speed * (0.8 + 0.4 * ((j * 7) % 5) / 5) + j * 137) % 220;
          for (let x = 1960 - off; x > -40; x -= 220) { ctx.moveTo(x, y); ctx.lineTo(x - 90, y); }
        }
        ctx.stroke();
      }
    }
    // Stopwatch: a dial that turns once in twelve seconds
    const wa = span(t, 1.8, 2.3) * keep;
    if (wa > 0) {
      const { x, y, r } = WATCH, el = clamp(t - LIFT, 0, 12);
      circle(ctx, x, y, r, wa, { pen: { color: 'GOLD_HOT', alpha: 0.95, width: 2.4 }, tip: false });
      circle(ctx, x, y, r + 8, wa, { pen: { color: 'GOLD', alpha: 0.4, width: 1 }, tip: false });
      stroke(ctx, [[x - 10, y - r - 8], [x + 10, y - r - 8], [x + 10, y - r - 20], [x - 10, y - r - 20]], wa, { pen: { color: 'GOLD', alpha: 0.9, width: 1.6 }, closed: true, tip: false });
      ctx.strokeStyle = rgba('GOLD', 0.8 * wa); ctx.lineWidth = 1.2; ctx.beginPath();
      for (let i = 0; i < 48; i++) { const a = -Math.PI / 2 + (i / 48) * TAU, l = i % 4 === 0 ? 12 : 6; ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.lineTo(x + Math.cos(a) * (r - l), y + Math.sin(a) * (r - l)); }
      ctx.stroke();
      [0, 3, 6, 9].forEach(v => { const a = -Math.PI / 2 + (v / 12) * TAU; text(s.ui, String(v), x + Math.cos(a) * (r - 28), y + Math.sin(a) * (r - 28), { voice: 'data', size: 24, alpha: 0.8 * wa, fact: 'wright_flight', scale: s.S }); });
      const ha = -Math.PI / 2 + (el / 12) * TAU;
      if (el > 0) stroke(ctx, Array.from({ length: 49 }, (_, i) => { const a = -Math.PI / 2 + (i / 48) * (ha + Math.PI / 2); return [x + Math.cos(a) * (r - 46), y + Math.sin(a) * (r - 46)]; }), 1, { pen: { color: 'GOLD', alpha: 0.3 * wa, width: 6 }, tip: false });
      stroke(ctx, [[x, y], [x + Math.cos(ha) * (r - 10), y + Math.sin(ha) * (r - 10)]], 1, { pen: { color: 'GOLD_HOT', alpha: wa, width: 2.4 }, tip: false });
      dot(ctx, x, y, 4, 'GOLD_HOT', wa);
      text(s.ui, `${el.toFixed(1).padStart(4, '0')} S`, x, y + r + 40, { voice: 'dataBold', size: 30, alpha: wa, fact: 'wright_flight', scale: s.S });
      text(s.ui, `${String(Math.round(120 * flightU(t))).padStart(3, '0')} FT`, x, y + r + 82, { voice: 'dataBold', size: 30, alpha: wa, fact: 'wright_flight', scale: s.S });
    }
    // Touchdown: sand kicks up under the skids.
    if (t >= LAND) {
      const [lx] = originAt(1);
      billows(ctx, t, { seed: 31, rate: 60, t0: LAND, t1: LAND + 0.3, life: [0.8, 1.6], source: (b, i) => [lx + (i % 2 ? 40 : -60), GROUND - 4], dir: -Math.PI / 2, spread: 2.6, speed: 90, rise: 12, r0: 4, grow: 26, alpha: 0.5 * keep, scallop: true });
      glow(ctx, lx, GROUND, 90, 'GOLD_HOT', 0.4 * Math.exp(-(t - LAND) / 0.2) * keep);
    }
    // The globe the path wraps
    const gp = span(t, 14.6, 15.7, ease.inOut);
    if (gp > 0) globe(ctx, MATCH.cx, MATCH.cy, MATCH.r, gp, t * 0.12, { tilt: 0.3, sym: true, night: 0.6, sun: -0.6, phase: 0.2 });

    s.screen(() => {
      card(s, 'data_flight', { x: 960, y: 900, size: 28, voice: 'dataBold' });
      card(s, 'card_air', { x: 960, y: 196, size: 100 });
    });
  },
});
