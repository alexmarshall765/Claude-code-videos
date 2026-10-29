// OBS 06 · ACT II — ROADS, CANALS, WIRES, 1811–1844. One line runs east through it all.
//   33.1  the National Road draws over the hills and a stone arch; a wagon wheel rolls it
//   34.1  the line becomes a canal: a lock fills and lifts a boat to the upper level
//   34.3  a paddlewheel's gear train turns on the upper level
//   35.3  the line climbs a pole and becomes the wire: Morse "USA" races from Washington
//         to Baltimore, where a register prints it on paper tape
//   36.1  WHAT HATH GOD WROUGHT

import { scene } from './common.js';
import { rgba } from '../theme.js';
import { ease, clamp, lerp, sub, span, TAU } from '../engine.js';
import { stroke, circle, arcPts, glow, dot, hatch, pathLength, pointAt } from '../draw/paths.js';
import { card, text } from '../draw/type.js';
import { gear, gearPts, meshRot, wheel, catenary, catenaryParam, rivets } from '../draw/gears.js';
import { sparks } from '../draw/particles.js';

const ROAD_Y = 760, LOW = 760, HIGH = 660, WIRE_Y = 470, GROUND2 = 780;
const roadY = x => ROAD_Y + 14 * Math.sin(x / 260) * (1 - bridgeK(x));
const bridgeK = x => clamp(1 - Math.abs(x - 1150) / 210) ** 0.5;
const groundY = x => {
  const hills = 805 + 26 * Math.sin(x / 170) + 14 * Math.sin(x / 67 + 1);
  const creek = Math.exp(-(((x - 1150) / 150) ** 4));
  return lerp(hills, 905, creek);
};
const ROAD = Array.from({ length: 191 }, (_, i) => { const x = i * 10; return [x, roadY(x)]; });
const GROUND = Array.from({ length: 201 }, (_, i) => { const x = -50 + i * 10; return [x, groundY(x)]; });
const RIDGES = [0, 1].map(k => Array.from({ length: 101 }, (_, i) => { const x = -60 + i * 20; return [x, 640 - k * 40 + 34 * Math.sin(x / (240 + k * 70) + k * 2) + 16 * Math.sin(x / 90 + k)]; }));
// A segmental stone arch over the creek
const ARCH = { cx: 1150, cy: 942.8, r: 157.8, a0: Math.PI + 1.09, a1: TAU - 1.09 };
const MILES = [200, 520, 840, 1460, 1780];

// The lock
const LG = 2640, UG = 3060, FLOOR = 900, SILL = 800, COPE = 630;
// The wire
const POLES = [3900, 4170, 4440, 4710, 4980, 5250];
const SPAN_A = catenaryParam(135, 22);
const WIRE = POLES.slice(1).flatMap((x, i) => catenary(POLES[i], WIRE_Y, x, WIRE_Y, SPAN_A, 30).pts.slice(i ? 1 : 0));
const WIRE_LEN = pathLength(WIRE);

// Morse "USA" on the synth's grid: 16th-note units from 35.3; dot = 1 unit, dash = 3.
const MORSE = (() => {
  const code = { U: '..-', S: '...', A: '.-' }, out = [];
  let u = 0;
  for (const ch of 'USA') {
    for (const sym of code[ch]) { const n = sym === '.' ? 1 : 3; out.push({ u, n }); u += n + 1; }
    u += 2;
  }
  return out;
})();
const SPEED = 2000;

/** Three framings: tight on the road, medium on the lock, wide on the wire; quick pans between. */
function cam(t) {
  const A = { x: lerp(740, 1250, span(t, 0, 1.7, ease.linear)), y: 700, zoom: 1.3 };
  const B = { x: lerp(2900, 3020, span(t, 2.4, 4.4)), y: 690, zoom: 1.15 };
  const C = { x: lerp(4590, 4620, span(t, 5.2, 8.5)), y: 600, zoom: 1.1 };
  const ab = span(t, 1.7, 2.4, ease.inOut), bc = span(t, 4.4, 5.2, ease.inOut);
  const mix = (P, Q, k) => ({ x: lerp(P.x, Q.x, k), y: lerp(P.y, Q.y, k), zoom: Math.exp(lerp(Math.log(P.zoom), Math.log(Q.zoom), k)) });
  return mix(mix(A, B, ab), C, bc);
}

export default scene('06_roads', {
  camera: s => cam(s.t),

  draw(ctx, s) {
    const t = s.t;
    s.bloom = 0.42;
    road(ctx, s, t);
    lock(ctx, s, t);
    paddle(ctx, s, t);
    wire(ctx, s, t);
    s.screen(() => {
      card(s, 'card_roads', { x: 960, y: 196, size: 100 });
      card(s, 'card_canals', { lines: ['THEN THE CANALS.', 'THEN THE WIRES.'], x: 960, y: 222, size: 100 });
      card(s, 'card_wrought', { x: 960, y: 196, size: 100 });
      card(s, 'attrib_telegraph', { x: 960, y: 296, size: 26, alpha: 0.85 });
    });
  },
});

function road(ctx, s, t) {
  if (t > 3.2) return;
  const rp = s.cue('road', ease.inOut);
  RIDGES.forEach((r, k) => stroke(ctx, r, span(t, 0, 1.4), { pen: { color: 'GOLD', alpha: 0.16 - k * 0.05, width: 1 }, tip: false }));
  stroke(ctx, GROUND, span(t, 0, 1.2), { pen: { color: 'GOLD', alpha: 0.45, width: 1.2 }, tip: false });
  stroke(ctx, [[0, ROAD_Y], [1900, ROAD_Y]], span(t, 0, 0.5), { pen: 'construction', tip: false, dash: [6, 8] });
  // The road: a double line, drawn on, with milestones as the head passes them
  stroke(ctx, ROAD, rp, { pen: { color: 'GOLD_HOT', alpha: 1, width: 2.4 } });
  stroke(ctx, ROAD.map(([x, y]) => [x, y + 9]), rp, { pen: { color: 'GOLD', alpha: 0.75, width: 1.2 }, tip: false });
  const head = 1900 * rp;
  for (const mx of MILES) {
    const q = clamp((head - mx) / 120);
    if (q <= 0) continue;
    const y = roadY(mx) - 2;
    stroke(ctx, [[mx - 7, y], [mx - 7, y - 30 * q], [mx + 7, y - 30 * q], [mx + 7, y]], 1, { pen: { color: 'GOLD', alpha: 0.85, width: 1.3 }, tip: false });
    stroke(ctx, arcPts(mx, y - 30 * q, 7, Math.PI, TAU, 10), 1, { pen: { color: 'GOLD', alpha: 0.85 * q, width: 1.3 }, tip: false });
  }
  // Stone arch: intrados, extrados, voussoirs, spandrels, creek
  const ap = sub(rp, 0.45, 0.8);
  if (ap > 0) {
    stroke(ctx, arcPts(ARCH.cx, ARCH.cy, ARCH.r, ARCH.a0, ARCH.a1, 40), ap, { pen: 'structure', tip: false });
    stroke(ctx, arcPts(ARCH.cx, ARCH.cy, ARCH.r + 26, ARCH.a0 - 0.02, ARCH.a1 + 0.02, 40), ap, { pen: { color: 'GOLD', alpha: 0.8, width: 1.4 }, tip: false });
    for (let a = ARCH.a0; a <= ARCH.a1 + 1e-6; a += (ARCH.a1 - ARCH.a0) / 14) {
      const q = clamp(ap * 1.3 - (a - ARCH.a0) / (ARCH.a1 - ARCH.a0));
      stroke(ctx, [[ARCH.cx + Math.cos(a) * ARCH.r, ARCH.cy + Math.sin(a) * ARCH.r], [ARCH.cx + Math.cos(a) * (ARCH.r + 26), ARCH.cy + Math.sin(a) * (ARCH.r + 26)]], q, { pen: { color: 'GOLD', alpha: 0.7, width: 1.1 }, tip: false });
    }
    const base = 872;
    for (const sx of [-1, 1]) stroke(ctx, [[1150 + sx * 140, base], [1150 + sx * 175, ROAD_Y - 12], [1150 + sx * 178, ROAD_Y - 22]], ap, { pen: { color: 'GOLD', alpha: 0.8, width: 1.4 }, tip: false });
    stroke(ctx, [[968, ROAD_Y - 22], [1332, ROAD_Y - 22]], ap, { pen: { color: 'GOLD', alpha: 0.8, width: 1.4 }, tip: false });
    hatch(ctx, [[1010, ROAD_Y - 20], [1290, ROAD_Y - 20], [1290, 820], [1010, 820]], ap * 0.8, { angle: Math.PI / 2, gap: 16, alpha: 0.12 });
    const wv = [];
    for (let x = 1000; x <= 1300; x += 6) wv.push([x, 882 + 2.5 * Math.sin(x / 14 + t * 5)]);
    stroke(ctx, wv, ap, { pen: { color: 'GOLD', alpha: 0.6, width: 1.1 }, tip: false });
  }
  // The wheel rolls the road behind the drawing head (linear: a machine).
  const wx = lerp(-90, 1820, span(t, 0.3, 2.5, ease.linear)), wr = 62;
  if (t > 0.3) {
    const fade = 1 - span(t, 2.4, 2.8);
    wheel(ctx, wx, roadY(wx) - wr - 3, wr, wx / wr, 1, { spokes: 12, pen: { color: 'GOLD_HOT', alpha: 0.95 * fade, width: 2.4 } });
    glow(ctx, wx, roadY(wx) - wr - 3, 22, 'GOLD_HOT', 0.25 * fade);
  }
  s.screen(() => text(s.ui, 'NATIONAL ROAD · 1811', 960, 892, { voice: 'data', size: 26, alpha: 0.85 * span(t, 0.2, 0.6) * (1 - span(t, 2.3, 2.6)), fact: 'national_road_1811', scale: s.S }));
}

function lock(ctx, s, t) {
  if (t < 1.4) return;
  const k = span(t, 1.4, 2.1, ease.inOut);
  const rise = s.cue('lock_rise', ease.inOut);
  const open = span(t, 3.7, 4.1, ease.inOut);
  const A = { color: 'GOLD', alpha: 0.9, width: 2.2 };
  // The road meets the towpath; the line becomes water.
  const wl = [];
  for (let x = 1900; x <= LG; x += 8) wl.push([x, LOW + 2 * Math.sin(x / 19 - t * 4)]);
  stroke(ctx, [[1830, roadY(1830)], [1900, LOW]], k, { pen: { color: 'GOLD_HOT', alpha: 1, width: 2.4 }, tip: false });
  stroke(ctx, wl, k, { pen: { color: 'GOLD_HOT', alpha: 0.95, width: 2 }, tip: false });
  stroke(ctx, [[1900, LOW + 30], [1960, FLOOR], [LG, FLOOR]], k, { pen: { color: 'GOLD', alpha: 0.5, width: 1.2 }, tip: false });
  // Chamber walls and coping, masonry courses behind
  const wk = span(t, 1.6, 2.3, ease.inOut);
  stroke(ctx, [[LG - 20, COPE], [UG + 20, COPE]], wk, { pen: A, tip: false });
  stroke(ctx, [[LG, FLOOR], [UG, FLOOR], [UG, SILL], [3800, SILL]], wk, { pen: A, tip: false });
  ctx.strokeStyle = rgba('GOLD', 0.14 * wk); ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = COPE + 24, row = 0; y < FLOOR; y += 24, row++) {
    ctx.moveTo(LG, y); ctx.lineTo(UG, y);
    for (let x = LG + (row % 2) * 40; x < UG; x += 80) { ctx.moveTo(x, y - 24); ctx.lineTo(x, y); }
  }
  ctx.stroke();
  // Water in the chamber rises from the lower level to the upper.
  const yc = lerp(LOW, HIGH, rise);
  ctx.strokeStyle = rgba('GOLD', 0.3 * wk); ctx.beginPath();
  for (let y = yc + 10; y < FLOOR; y += 9) { ctx.moveTo(LG + 4, y); ctx.lineTo(UG - 4, y); }
  ctx.stroke();
  const cw = [];
  for (let x = LG; x <= UG; x += 8) cw.push([x, yc + 2.5 * Math.sin(x / 17 + t * 5) * (0.4 + rise * (1 - rise) * 2)]);
  stroke(ctx, cw, wk, { pen: { color: 'GOLD_HOT', alpha: 0.95, width: 2 }, tip: false });
  // Upper level water
  const uw = [];
  for (let x = UG; x <= 3800; x += 8) uw.push([x, HIGH + 2 * Math.sin(x / 21 - t * 3.5)]);
  stroke(ctx, uw, wk, { pen: { color: 'GOLD_HOT', alpha: 0.95, width: 2 }, tip: false });
  ctx.strokeStyle = rgba('GOLD', 0.22 * wk); ctx.beginPath();
  for (let y = HIGH + 12; y < SILL; y += 9) { ctx.moveTo(UG + 4, y); ctx.lineTo(3790, y); }
  ctx.stroke();
  // Gates: the lower one stays shut; the upper one swings open once the levels meet.
  const gate = (x, y1, w, beam, a) => {
    stroke(ctx, [[x - w / 2, COPE + 6], [x + w / 2, COPE + 6], [x + w / 2, y1], [x - w / 2, y1]], wk, { pen: { color: 'GOLD', alpha: a, width: 1.6 }, closed: true, tip: false });
    for (let y = COPE + 30; y < y1; y += 34) stroke(ctx, [[x - w / 2, y], [x + w / 2, y]], wk, { pen: { color: 'GOLD', alpha: 0.6 * a, width: 1 }, tip: false });
    stroke(ctx, [[x, COPE - 8], [x + beam, COPE - 8]], wk, { pen: { color: 'GOLD', alpha: a, width: 3 }, tip: false });
  };
  gate(LG, FLOOR, 20, -90, 0.9);
  gate(UG, SILL, lerp(20, 4, open), lerp(90, 18, open), 0.9);
  // The rush through the upper sluices when the lock starts to fill
  sparks(ctx, t, { seed: 61, rate: 90, t0: 2.0, t1: 3.4, life: [0.25, 0.6], source: () => [UG - 12, lerp(SILL - 20, yc + 30, 0.5)], dir: Math.PI + 0.25, spread: 0.6, speed: 520, gravity: 900, alpha: 0.5, width: 1.2 });
  // The boat rises with the water, then moves out onto the upper level.
  const bx = 2730 + 560 * span(t, 4.0, 5.4, ease.inOut), by = yc;
  const hull = [[bx, by - 22], [bx + 240, by - 22], [bx + 226, by + 12], [bx + 18, by + 12]];
  stroke(ctx, hull, wk, { pen: { color: 'GOLD_HOT', alpha: 1, width: 2.2 }, closed: true, tip: false });
  stroke(ctx, [[bx + 70, by - 22], [bx + 70, by - 48], [bx + 170, by - 48], [bx + 170, by - 22]], wk, { pen: { color: 'GOLD', alpha: 0.9, width: 1.6 }, tip: false });
  for (let i = 0; i < 3; i++) stroke(ctx, [[bx + 86 + i * 30, by - 40], [bx + 104 + i * 30, by - 40], [bx + 104 + i * 30, by - 30], [bx + 86 + i * 30, by - 30]], wk, { pen: { color: 'GOLD', alpha: 0.7, width: 1 }, closed: true, tip: false });
  hatch(ctx, hull, wk, { angle: Math.PI / 4, gap: 7, alpha: 0.3 });
  text(s.ui, 'ERIE CANAL · 1825', 2850, 944, { voice: 'data', size: 26, alpha: 0.85 * span(t, 2.0, 2.5) * (1 - span(t, 5.0, 5.4)), fact: 'erie_canal_1825', scale: s.S });
}

function paddle(ctx, s, t) {
  const p = s.cue('paddle', ease.inOut);
  if (p <= 0) return;
  const C = [3380, 640], R = 80, rot = (t - 3) * 2.2;
  const fade = 1 - span(t, 6.0, 6.6);
  // Paddlewheel: rim, spokes, blades dipping into the water
  wheel(ctx, C[0], C[1], R, rot, sub(p, 0, 0.7), { spokes: 12, pen: { color: 'GOLD', alpha: fade, width: 2 } });
  if (p > 0.5) {
    for (let i = 0; i < 12; i++) {
      const a = rot + (i * TAU) / 12, ca = Math.cos(a), sa = Math.sin(a);
      const P = (r, w) => [C[0] + ca * r - sa * w, C[1] + sa * r + ca * w];
      stroke(ctx, [P(R - 4, -7), P(R + 26, -7), P(R + 26, 7), P(R - 4, 7)], sub(p, 0.5, 0.9), { pen: { color: 'GOLD_HOT', alpha: 0.9 * fade, width: 1.5 }, closed: true, tip: false });
    }
  }
  // Gear train from the engine: a pinion drives the wheel's gear
  const ang = -0.75, n1 = 24, n2 = 12, r1 = 50, r2 = 25;
  const P2 = [C[0] + Math.cos(ang) * (r1 + r2), C[1] + Math.sin(ang) * (r1 + r2)];
  const g1 = sub(p, 0.15, 0.85), g2 = sub(p, 0.3, 1);
  if (g1 > 0) stroke(ctx, gearPts(C[0], C[1], r1, n1, rot, 9), g1, { pen: { color: 'GOLD_HOT', alpha: 0.95 * fade, width: 1.8 }, tip: false });
  const rot2 = meshRot(rot, n1, n2, ang);
  if (g2 > 0) gear(ctx, P2[0], P2[1], r2, n2, rot2, g2, { depth: 9, holes: 0, pen: { color: 'GOLD_HOT', alpha: 0.95 * fade, width: 1.8 } });
  // Crank and piston: the engine's linear stroke turns the pinion.
  const crank = 20, cx2 = P2[0] + Math.cos(rot2) * crank, cy2 = P2[1] + Math.sin(rot2) * crank;
  const cylY = P2[1] - 6, rod = 130;
  const px = cx2 + Math.sqrt(Math.max(0, rod * rod - (cy2 - cylY) ** 2));
  const ep = sub(p, 0.5, 1) * fade;
  if (ep > 0) {
    stroke(ctx, [[P2[0] + 150, cylY - 20], [P2[0] + 250, cylY - 20], [P2[0] + 250, cylY + 20], [P2[0] + 150, cylY + 20]], ep, { pen: { color: 'GOLD', alpha: 0.9, width: 1.6 }, closed: true, tip: false });
    stroke(ctx, [[cx2, cy2], [px, cylY]], ep, { pen: { color: 'GOLD', alpha: 0.9, width: 1.6 }, tip: false });
    stroke(ctx, [[px, cylY], [Math.min(px + 60, P2[0] + 236), cylY]], ep, { pen: { color: 'GOLD', alpha: 0.9, width: 2.2 }, tip: false });
    stroke(ctx, [[Math.min(px + 60, P2[0] + 236), cylY - 16], [Math.min(px + 60, P2[0] + 236), cylY + 16]], ep, { pen: { color: 'GOLD_HOT', alpha: 0.9, width: 3 }, tip: false });
    dot(ctx, cx2, cy2, 3.5, 'GOLD_HOT', ep);
    rivets(ctx, P2[0] + 160, cylY - 20, P2[0] + 240, cylY - 20, 6, 2, 0.5 * ep);
  }
}

function wire(ctx, s, t) {
  if (t < 3.8) return;
  const k = span(t, 3.8, 5.0, ease.inOut);
  // The upper level ends at the bank; the line climbs the first pole and becomes the wire.
  stroke(ctx, [[3800, HIGH], [3830, GROUND2], [5700, GROUND2]], k, { pen: { color: 'GOLD', alpha: 0.55, width: 1.2 }, tip: false });
  stroke(ctx, [[3800, HIGH], [POLES[0] - 10, HIGH], [POLES[0] - 10, WIRE_Y + 6], [POLES[0], WIRE_Y]], k, { pen: { color: 'GOLD_HOT', alpha: 0.9, width: 2 }, tip: false });
  POLES.forEach((x, i) => {
    const q = sub(k, i * 0.08, 0.4 + i * 0.08);
    stroke(ctx, [[x, GROUND2], [x, lerp(GROUND2, WIRE_Y - 16, q)]], 1, { pen: { color: 'GOLD', alpha: q > 0 ? 0.9 : 0, width: 2.2 }, tip: false });
    if (q >= 1) {
      stroke(ctx, [[x - 26, WIRE_Y - 4], [x + 26, WIRE_Y - 4]], 1, { pen: { color: 'GOLD', alpha: 0.9, width: 2 }, tip: false });
      stroke(ctx, arcPts(x, WIRE_Y - 2, 5, Math.PI, TAU, 8), 1, { pen: { color: 'GOLD_HOT', alpha: 0.9, width: 1.4 }, tip: false });
    }
  });
  stroke(ctx, WIRE, sub(k, 0.3, 1), { pen: { color: 'GOLD', alpha: 0.9, width: 1.6 } });
  const la = sub(k, 0.4, 1);
  text(s.ui, 'WASHINGTON', POLES[0], GROUND2 + 40, { voice: 'marker', size: 24, alpha: 0.85 * la, scale: s.S });
  text(s.ui, 'BALTIMORE', POLES[POLES.length - 1], GROUND2 + 40, { voice: 'marker', size: 24, alpha: 0.85 * la, scale: s.S });

  // The key at Washington and the register at Baltimore
  const t0 = s.at('3.3'), unit = s.beatDur / 4;
  const keyDown = MORSE.some(m => t >= t0 + m.u * unit && t < t0 + (m.u + m.n * 0.92) * unit);
  const kx = POLES[0] - 110, ky = GROUND2 - 30;
  if (la > 0) {
    stroke(ctx, [[kx - 50, ky + 12], [kx + 50, ky + 12]], la, { pen: { color: 'GOLD', alpha: 0.9, width: 2.4 }, tip: false });
    const knobY = ky - 16 + (keyDown ? 10 : 0);
    stroke(ctx, [[kx - 36, ky - 2], [kx + 40, knobY]], la, { pen: { color: 'GOLD_HOT', alpha: 0.95, width: 2.6 }, tip: false });
    circle(ctx, kx + 40, knobY - 8, 9, la, { pen: { color: 'GOLD_HOT', alpha: 0.95, width: 2 }, tip: false });
    stroke(ctx, [[kx - 36, ky - 2], [kx - 36, ky + 12]], la, { pen: { color: 'GOLD', alpha: 0.9, width: 2 }, tip: false });
    stroke(ctx, [[kx + 50, ky + 12], [POLES[0], ky + 12], [POLES[0], GROUND2]], la, { pen: { color: 'GOLD', alpha: 0.5, width: 1 }, tip: false });
    if (keyDown) glow(ctx, kx + 40, ky, 26, 'GOLD_HOT', 0.5);
  }
  const rx = POLES[POLES.length - 1] + 50, ry = GROUND2 - 70;
  if (la > 0) {
    stroke(ctx, [[rx, ry - 30], [rx + 92, ry - 30], [rx + 92, ry + 40], [rx, ry + 40]], la, { pen: { color: 'GOLD', alpha: 0.9, width: 1.6 }, closed: true, tip: false });
    circle(ctx, rx + 28, ry + 8, 14, la, { pen: { color: 'GOLD_HOT', alpha: 0.9, width: 1.6 }, tip: false, a0: t * 3 });
    stroke(ctx, [[rx + 60, ry - 30], [rx + 60, WIRE_Y + 30], [POLES[POLES.length - 1], WIRE_Y + 30], [POLES[POLES.length - 1], WIRE_Y]], la, { pen: { color: 'GOLD', alpha: 0.45, width: 1 }, tip: false });
    // Paper tape feeding left from the stylus
    stroke(ctx, [[rx + 14, ry - 6], [rx - 380, ry - 6]], la, { pen: { color: 'GOLD', alpha: 0.7, width: 1.2 }, tip: false });
    stroke(ctx, [[rx + 14, ry + 22], [rx - 380, ry + 22]], la, { pen: { color: 'GOLD', alpha: 0.7, width: 1.2 }, tip: false });
  }
  // Pulses race along the wire; each prints on the tape when it arrives.
  const feed = 110;
  for (const m of MORSE) {
    const te = t0 + m.u * unit, len = m.n === 1 ? 36 : 110;
    if (t < te) continue;
    const d = (t - te) * SPEED;
    if (d < WIRE_LEN + len) {
      const a = clamp(d / WIRE_LEN), b = clamp((d - len) / WIRE_LEN);
      const seg = [];
      for (let i = 0; i <= 8; i++) seg.push(pointAt(WIRE, lerp(b, a, i / 8)));
      stroke(ctx, seg.map(q => [q[0], q[1]]), 1, { pen: { color: 'WHITE', alpha: 0.95, width: 3 }, tip: false });
      const [hx, hy] = pointAt(WIRE, a);
      glow(ctx, hx, hy, 30, 'GOLD_HOT', 0.7);
    }
    const ta = te + WIRE_LEN / SPEED;
    if (t >= ta) {
      const x1 = rx + 14 - (t - ta) * feed, w = m.n === 1 ? 12 : 38;
      if (x1 - w > rx - 380) stroke(ctx, [[x1 - w, ry + 8], [x1, ry + 8]], 1, { pen: { color: 'GOLD_HOT', alpha: 1, width: 6 }, tip: false });
    }
  }
}
