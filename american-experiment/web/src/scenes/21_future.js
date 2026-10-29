// OBS 21 · ACT V — THE OPEN FUTURE, 2026–. Four two-bar plates, one per plate hit, while
// the ruler runs on past 2026 as a dashed NEXT (the HUD draws that from Act V on). The
// circle carries across the plates: plasma ring → loop → Moon → Mars limb → gauge dial.
//   133.1  ABUNDANT ENERGY: a tokamak cut away, its plasma lit and its field line
//          flowing; energy per person flattening for 50 years, then bending up past 2026
//   135.1  DISCOVERY AT MACHINE SPEED: HYPOTHESIS → EXPERIMENT → RESULT as a loop that
//          spins faster, and fills with runners, once a machine joins it at the centre
//   137.1  A SECOND WORLD: the Moon turns to its south pole and swells into a horizon
//          with a base on it; then Mars rises, a settlement grid on its CRIMSON limb
//   139.1  THE CURVE BENDS UP: the Kardashev gauge, its needle rising from 0.73 toward
//          1.0 on the riser, the curve behind it steepening

import { scene } from './common.js';
import { ease, clamp, lerp, sub, span, TAU, mulberry32 } from '../engine.js';
import { stroke, circle, glow, dot, arcPts, ellipsePts, hatch } from '../draw/paths.js';
import { card, text } from '../draw/type.js';
import { scales, axes, series } from '../draw/charts.js';

const PLATE = 4; // seconds per plate
/** A plate's own fade: whole until its last 0.45 s, gone just before the next plate hit. */
const plateOut = (t, k) => 1 - span(t, (k + 1) * PLATE - 0.45, (k + 1) * PLATE - 0.05, ease.in);

/** Ellipse arc between two placements of the circle while it changes role. */
function morphRing(ctx, t, A, B, t0, t1, o = {}) {
  if (t < t0 || t >= t1) return;
  const e = ease.inOut((t - t0) / (t1 - t0));
  const m = k => lerp(A[k], B[k], e);
  const pts = ellipsePts(m('x'), m('y'), m('rx'), m('ry'), 0, 0, TAU, 160);
  if (o.from && o.to) {
    stroke(ctx, pts, 1, { pen: { color: o.from, alpha: 1 - e, width: lerp(A.w ?? 2.6, B.w ?? 2.6, e) }, tip: false });
    stroke(ctx, pts, 1, { pen: { color: o.to, alpha: e, width: lerp(A.w ?? 2.6, B.w ?? 2.6, e) }, tip: false });
  } else stroke(ctx, pts, 1, { pen: { color: 'GOLD_HOT', alpha: 1, width: lerp(A.w ?? 2.6, B.w ?? 2.6, e) }, tip: false });
  glow(ctx, m('x'), m('y') - m('ry'), 50, 'GOLD_HOT', 0.25 * Math.sin(Math.PI * e));
}

// ---------------------------------------------------------------------------
// Plate I · energy. A tokamak cut away along its vertical plane: the far half in
// perspective (X across, Y toward the viewer, Z up, seen from 31° above) and the two cut
// faces square on, each showing the poloidal section: field coil, vessel wall, the nested
// D-shaped surfaces of the plasma, and the divertor under it.
// ---------------------------------------------------------------------------
const TK = { x: 600, y: 610, R: 196, a: 66 };
const SE = Math.sin(0.55), CE = Math.cos(0.55);
const TP = (X, Y, Z) => [TK.x + X, TK.y + Y * SE - Z * CE];
/** Point of a D-shaped section (minor radius a, elongation k, triangularity d) as [R, Z]. */
const dAt = (a, k, d, shift, th) => [TK.R + shift + a * Math.cos(th + d * Math.sin(th)), k * a * Math.sin(th)];
const dShape = (a, k, d, shift = 0, n = 72) => Array.from({ length: n + 1 }, (_, i) => dAt(a, k, d, shift, (i / n) * TAU));
/** Flux surface r (0 at the magnetic axis, 1 at the edge), with its outward shift. */
const fluxAt = (r, th) => dAt(TK.a * r, 1.7, 0.33 * r, 0.12 * TK.a * (1 - r * r), th);
const FLUX = [1, 0.76, 0.52, 0.28].map(r => Array.from({ length: 73 }, (_, i) => fluxAt(r, (i / 72) * TAU)));
const AXIS = fluxAt(0, 0);
const WALL = [dShape(TK.a * 1.2, 1.64, 0.3), dShape(TK.a * 1.34, 1.6, 0.3)];
const COIL = dShape(TK.a * 1.9, 1.48, 0.42, -0.08 * TK.a);
const PF = [[2.08, 1.02], [2.08, -1.02], [0.95, 2.12], [0.95, -2.12]].map(([dr, z]) => [TK.R + dr * TK.a, z * TK.a]);
const DIVERTOR = [[[-0.3, -1.68], [-0.66, -2.2]], [[0.2, -1.68], [0.5, -2.2]]].map(leg => leg.map(([dr, z]) => [TK.R + dr * TK.a, z * TK.a]));
const SOL = { w: 34, z: 1.55 * TK.a };
/** A section point on the left (side −1) or right (+1) cut face. */
const onFace = (side, [R, Z]) => TP(side * R, 0, Z);
/** A section point revolved to toroidal angle u (the far half is u = π … 2π). */
const revolve = (u, [R, Z]) => TP(R * Math.cos(u), R * Math.sin(u), Z);
const farRing = q => Array.from({ length: 61 }, (_, i) => revolve(Math.PI * (1 + i / 60), q));
const FAR_LINES = [0, 18, 36, 54].map(i => farRing(WALL[1][i])).concat([farRing(COIL[18]), farRing(COIL[54])]);
const FAR_COILS = [1, 2, 3, 4, 5].map(k => COIL.map(q => revolve(Math.PI * (1 + k / 6), q)));
const FAR_PLASMA = [farRing(FLUX[0][18]), farRing(FLUX[0][54]), farRing(FLUX[0][0])];

// U.S. primary energy per person, normalised to its 1979 peak (EIA Annual Energy Review,
// Appendix E for 1850–1945, Monthly Energy Review table 1.7 after). Drawn as a schematic:
// the plate shows its shape, never its values. The dashed run past 2026 is the hope.
const EN = scales({ x: 1060, y: 400, w: 640, h: 330 }, [1850, 2060], [0, 1.8]);
const EN_PAST = [[1850, 0.29], [1870, 0.29], [1890, 0.31], [1900, 0.35], [1910, 0.45], [1920, 0.52], [1930, 0.5], [1940, 0.5], [1950, 0.63], [1960, 0.7], [1970, 0.92], [1979, 1], [1985, 0.89], [2000, 0.97], [2007, 0.94], [2013, 0.86], [2020, 0.78], [2026, 0.78]];
const EN_NEXT = [[2026, 0.78], [2034, 0.84], [2042, 0.98], [2049, 1.2], [2055, 1.48], [2060, 1.8]];

function plateEnergy(ctx, s, t) {
  const A = plateOut(t, 0);
  if (A <= 0) return;
  const p = span(t, 0, 1.1);
  const pen = (c, a, w) => ({ pen: { color: c, alpha: a, width: w }, tip: false });
  ctx.globalAlpha = A;
  // The far half, in perspective
  FAR_COILS.forEach((c, k) => stroke(ctx, c, sub(p, k * 0.05, 0.4 + k * 0.05), pen('GOLD', 0.28, 1.2)));
  FAR_LINES.forEach((ln, i) => stroke(ctx, ln, sub(p, 0.1 + i * 0.04, 0.5 + i * 0.04), pen('GOLD', i < 4 ? 0.45 : 0.3, 1.1)));
  // Central solenoid in section, with its windings
  const sp = sub(p, 0.3, 0.65);
  const sol = [TP(-SOL.w, 0, SOL.z), TP(SOL.w, 0, SOL.z), TP(SOL.w, 0, -SOL.z), TP(-SOL.w, 0, -SOL.z)];
  stroke(ctx, sol, sp, { ...pen('GOLD', 0.95, 1.8), closed: true });
  if (sp >= 1) hatch(ctx, sol, 1, { angle: 0, gap: 7, alpha: 0.4 });
  stroke(ctx, farRing([SOL.w, SOL.z]), sp, pen('GOLD', 0.6, 1.1));
  // The two cut faces: coil, wall, poloidal-field coils, divertor
  for (const side of [-1, 1]) {
    const F = q => onFace(side, q);
    stroke(ctx, COIL.map(F), sub(p, 0.05, 0.4), pen('GOLD', 0.95, 2.4));
    stroke(ctx, WALL[0].map(F), sub(p, 0.2, 0.55), pen('GOLD_HOT', 0.95, 2));
    stroke(ctx, WALL[1].map(F), sub(p, 0.25, 0.6), pen('GOLD', 0.7, 1.2));
    PF.forEach((q, k) => {
      const [x, y] = F(q), h = 0.17 * TK.a, sq = [[x - h, y - h], [x + h, y - h], [x + h, y + h], [x - h, y + h]];
      const qq = sub(p, 0.4 + k * 0.05, 0.6 + k * 0.05);
      stroke(ctx, sq, qq, { ...pen('GOLD', 0.95, 1.6), closed: true });
      if (qq >= 1) hatch(ctx, sq, 1, { angle: Math.PI / 4, gap: 4, alpha: 0.6 });
    });
    DIVERTOR.forEach(([a, b]) => {
      stroke(ctx, [F(a), F(b)], sub(p, 0.55, 0.8), pen('GOLD', 0.8, 1.4));
      const [bx, by] = F(b);
      stroke(ctx, [[bx - 12, by], [bx + 12, by]], sub(p, 0.7, 0.85), pen('GOLD_HOT', 1, 3));
    });
  }
  // The plasma: nested surfaces light from the axis outward and the particles circulate
  const ig = t >= 0.9 ? ease.expoOut(clamp((t - 0.9) / 0.35)) : 0;
  if (ig > 0) {
    const flash = Math.exp(-(t - 0.9) / 0.18);
    FAR_PLASMA.forEach((ln, i) => stroke(ctx, ln, ig, pen('GOLD_HOT', i === 2 ? 0.75 : 0.35, i === 2 ? 2 : 1.2)));
    stroke(ctx, farRing(AXIS), 1, pen('GOLD_HOT', 0.14 * ig, 16));
    const phase = -t * 5, helix = [];
    for (let i = 0; i <= 240; i++) { const u = Math.PI * (1 + i / 240); helix.push(revolve(u, fluxAt(0.6, 6 * u + phase))); }
    stroke(ctx, helix, ig, pen('GOLD_HOT', 0.5, 1.2));
    for (const side of [-1, 1]) {
      const F = q => onFace(side, q);
      FLUX.forEach((sf, k) => stroke(ctx, sf.map(F), sub(ig, (3 - k) * 0.12, (3 - k) * 0.12 + 0.5), pen('GOLD_HOT', 0.5 + 0.17 * k, 1.3 + 0.25 * k)));
      const [ax, ay] = F(AXIS);
      glow(ctx, ax, ay, 80, 'GOLD_HOT', 0.35 * ig + 0.6 * flash);
      dot(ctx, ax, ay, 3.5, 'WHITE', ig);
      for (const r of [0.4, 0.64, 0.88]) for (let j = 0; j < 5; j++) {
        const [x, y] = F(fluxAt(r, (j / 5) * TAU + side * t * (2.6 - r)));
        dot(ctx, x, y, 2.2, 'GOLD_HOT', 0.9 * ig);
      }
    }
  }
  text(s.ui, 'FUSION REACTOR · SCHEMATIC', TK.x, 836, { voice: 'marker', size: 24, alpha: 0.75 * A * span(t, 0.5, 0.9), scale: s.S });

  // Energy per person: the century of growth, the long flat, then the bend
  axes(s, ctx, EN, span(t, 0.3, 1.1), { xTicks: [1900, 1950, 2000], fact: 'structural:ruler', title: 'ENERGY PER PERSON · SCHEMATIC', alpha: A });
  const past = span(t, 0.9, 2.5, ease.inOut);
  series(ctx, EN, EN_PAST, past, { pen: { color: 'GOLD_HOT', alpha: 1, width: 2.6 } });
  const x26 = EN.X(2026);
  let next = 0;
  if (past >= 1) {
    stroke(ctx, [[x26, EN.box.y + EN.box.h], [x26, EN.Y(0.78) + 10]], span(t, 2.5, 2.7), { pen: { color: 'GOLD', alpha: 0.5, width: 1 }, tip: false, dash: [3, 5] });
    next = span(t, 2.55, 3.4, ease.in);
    const tip = series(ctx, EN, EN_NEXT, next, { pen: { color: 'GOLD_HOT', alpha: 1, width: 2.6 }, dash: [10, 8] });
    if (tip && next > 0) glow(ctx, tip[0], tip[1], 40, 'GOLD_HOT', 0.5);
  }
  ctx.globalAlpha = 1;
  // NEXT sits to the left of the bend, clear of the dashed line
  text(s.ui, 'NEXT', EN.X(2047) - 22, EN.Y(1.35), { voice: 'marker', size: 24, align: 'right', alpha: 0.85 * A * clamp(next * 3 - 0.5), scale: s.S });
}

// ---------------------------------------------------------------------------
// Plate II · the method as a loop
// ---------------------------------------------------------------------------
const LOOP = { x: 960, y: 640, r: 190 };
const NODES = [
  { a: -Math.PI / 2, label: 'HYPOTHESIS', dx: 0, dy: -50, align: 'center' },
  { a: Math.PI / 6, label: 'EXPERIMENT', dx: 40, dy: 4, align: 'left' },
  { a: (5 * Math.PI) / 6, label: 'RESULT', dx: -40, dy: 4, align: 'right' },
];
/** Laps of the loop τ s into its plate: 0.5 rev/s, accelerating to 4 rev/s. */
const laps = tau => 0.5 * tau + (3.5 * tau * tau * tau) / 48;
const lapRate = tau => 0.5 + (3.5 * tau * tau) / 16;
/** Runners on the loop: one, then two when the machine joins, then four, then eight. */
const RUNNERS = [[0, 1], [1.5, 2], [2.5, 4], [3.1, 8]];

function plateLoop(ctx, s, t) {
  const tau = t - PLATE, A = plateOut(t, 1);
  if (tau < 0 || A <= 0) return;
  const { x: cx, y: cy, r } = LOOP;
  const P = a => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  ctx.globalAlpha = A;
  if (tau >= 0.1) circle(ctx, cx, cy, r, 1, { pen: { color: 'GOLD_HOT', alpha: 0.9, width: 2.6 }, tip: false });
  // Outer scale ring turning with the loop
  const th = laps(tau) * TAU;
  circle(ctx, cx, cy, r + 26, span(tau, 0.1, 0.7), { pen: { color: 'GOLD', alpha: 0.3, width: 1 }, tip: false });
  const tk = span(tau, 0.3, 0.8);
  if (tk > 0) {
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * TAU + th * 0.12, l = i % 5 === 0 ? 10 : 5;
      stroke(ctx, [[cx + Math.cos(a) * (r + 26), cy + Math.sin(a) * (r + 26)], [cx + Math.cos(a) * (r + 26 + l), cy + Math.sin(a) * (r + 26 + l)]], 1, { pen: { color: 'GOLD', alpha: 0.4 * tk, width: 1 }, tip: false });
    }
  }
  // Arrowheads between the nodes, clockwise
  for (const a of [-Math.PI / 6, Math.PI / 2, (7 * Math.PI) / 6]) {
    const [x, y] = P(a), dx = -Math.sin(a), dy = Math.cos(a), nx = Math.cos(a), ny = Math.sin(a);
    stroke(ctx, [[x - dx * 14 + nx * 9, y - dy * 14 + ny * 9], [x, y], [x - dx * 14 - nx * 9, y - dy * 14 - ny * 9]], span(tau, 0.4, 0.7), { pen: { color: 'GOLD_HOT', alpha: 0.9, width: 2 }, tip: false });
  }
  // The machine joins at the centre: tiles, as in OBS 19, wired to every node
  const join = span(tau, 1.4, 1.9, ease.out);
  if (join > 0) {
    for (let i = 0; i < 9; i++) {
      const x = cx - 39 + (i % 3) * 28, y = cy - 39 + Math.floor(i / 3) * 28;
      const lit = 0.5 + 0.5 * Math.sin(t * 9 + i * 1.3);
      stroke(ctx, [[x, y], [x + 22, y], [x + 22, y + 22], [x, y + 22]], join, { pen: { color: lit > 0.7 ? 'GOLD_HOT' : 'GOLD', alpha: 0.9, width: 1.4 }, closed: true, tip: false });
    }
    NODES.forEach(({ a }, k) => {
      const [x, y] = P(a), x0 = cx + Math.cos(a) * 58, y0 = cy + Math.sin(a) * 58;
      stroke(ctx, [[x0, y0], [lerp(x0, x, join), lerp(y0, y, join)]], 1, { pen: { color: 'GOLD', alpha: 0.55, width: 1.2 }, tip: false, dash: [4, 6] });
      // Pulses running out along the spokes, faster as the loop speeds up
      for (let q = 0; q < 2; q++) {
        const u = (tau * lapRate(tau) * 0.9 + q * 0.5 + k / 3) % 1;
        dot(ctx, lerp(x0, x, u), lerp(y0, y, u), 2.6, 'GOLD_HOT', join * Math.sin(Math.PI * u));
      }
    });
    glow(ctx, cx, cy, 90, 'GOLD_HOT', 0.25 * join);
  }
  // Runners: comets whose tails stretch with the speed until the loop reads as a blur
  const n = RUNNERS.filter(([t0]) => tau >= t0).pop()[1];
  const tail = clamp(lapRate(tau) * TAU * 0.07, 0.25, 1.9);
  const heads = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + th + (i * TAU) / n;
    const fresh = n > 1 && i % 2 === 1 ? clamp((tau - RUNNERS.find(([, k]) => k === n)[0]) / 0.25) : 1;
    heads.push(a);
    for (let j = 0; j < 6; j++) {
      const a1 = a - (tail * j) / 6, a0 = a - (tail * (j + 1)) / 6;
      stroke(ctx, arcPts(cx, cy, r, a0, a1, 12), 1, { pen: { color: 'GOLD_HOT', alpha: 0.85 * (1 - j / 6) * fresh, width: 4 - j * 0.5 }, tip: false });
    }
    const [hx, hy] = P(a);
    glow(ctx, hx, hy, 26, 'GOLD_HOT', 0.7 * fresh);
    dot(ctx, hx, hy, 4, 'WHITE', fresh);
  }
  // Nodes flash as runners pass them
  NODES.forEach(({ a }) => {
    let fl = 0;
    for (const h of heads) { const d = (((h - a) % TAU) + TAU) % TAU; fl = Math.max(fl, Math.exp(-d / 0.18)); }
    const [x, y] = P(a);
    circle(ctx, x, y, 15, span(tau, 0.2, 0.5), { pen: { color: 'GOLD_HOT', alpha: 1, width: 2.2 }, tip: false });
    dot(ctx, x, y, 6, 'GOLD_HOT', 0.4 + 0.6 * fl);
    if (fl > 0.05) glow(ctx, x, y, 44, 'GOLD_HOT', 0.6 * fl);
  });
  ctx.globalAlpha = 1;
  NODES.forEach(({ a, label, dx, dy, align }, k) => {
    const [x, y] = P(a);
    text(s.ui, label, x + dx, y + dy, { voice: 'marker', size: 28, align, alpha: 0.9 * A * span(tau, 0.3 + k * 0.1, 0.6 + k * 0.1), scale: s.S });
  });
}

// ---------------------------------------------------------------------------
// Plate III · a second world
// ---------------------------------------------------------------------------
const MOON = { x: 960, y: 600, r: 210 };
const CRATERS = (() => {
  const R = mulberry32(2026), out = [];
  while (out.length < 18) out.push({ rr: Math.sqrt(R()) * 0.8, a: R() * TAU, s: 0.05 + R() * 0.1, sq: 0.8 + R() * 0.2 });
  return out;
})();
const MARS_R = 1200, MARS_TOP = 560;

/** A frame on a limb: u along the surface from the top of the circle, v up out of it. */
const limbFrame = (cx, cy, r) => (u, v) => {
  const a = -Math.PI / 2 + u / r, c = Math.cos(a), sn = Math.sin(a);
  return [cx + c * (r + v), cy + sn * (r + v)];
};

function lunarBase(ctx, F, p, t) {
  if (p <= 0) return;
  const pen = (c, a, w) => ({ pen: { color: c, alpha: a, width: w }, tip: false });
  const box = (u0, u1, v0, v1) => [F(u0, v0), F(u1, v0), F(u1, v1), F(u0, v1)];
  // Lander on its four legs
  const lq = sub(p, 0, 0.35);
  stroke(ctx, box(-372, -300, 46, 92), lq, { ...pen('GOLD_HOT', 1, 1.8), closed: true });
  stroke(ctx, [F(-360, 92), F(-352, 118), F(-320, 118), F(-312, 92)], lq, pen('GOLD', 0.9, 1.4));
  for (const [a, b] of [[-372, -404], [-300, -268]]) stroke(ctx, [F(a, 52), F(b, 0)], lq, pen('GOLD', 0.9, 1.4));
  stroke(ctx, [F(-344, 46), F(-350, 30), F(-322, 30), F(-328, 46)], lq, pen('GOLD', 0.8, 1.2));
  // Two habitat cylinders lying on the regolith, ribbed
  for (const [u0, u1, h] of [[-226, -92, 54], [-70, 66, 48]]) {
    const q = sub(p, 0.15, 0.55);
    stroke(ctx, box(u0, u1, 0, h), q, { ...pen('GOLD_HOT', 1, 2), closed: true });
    for (let u = u0 + 22; u < u1; u += 22) stroke(ctx, [F(u, 0), F(u, h)], q, pen('GOLD', 0.45, 1));
    const [ex, ey] = F(u0, h / 2), [fx, fy] = F(u1, h / 2);
    stroke(ctx, ellipsePts(ex, ey, 9, h / 2, 0, Math.PI / 2, (3 * Math.PI) / 2, 20), q, pen('GOLD', 0.8, 1.2));
    stroke(ctx, ellipsePts(fx, fy, 9, h / 2, 0, -Math.PI / 2, Math.PI / 2, 20), q, pen('GOLD', 0.8, 1.2));
    const blink = 0.5 + 0.5 * Math.sin(t * 6 + u0);
    dot(ctx, ...F((u0 + u1) / 2, h + 6), 2.6, 'GOLD_HOT', blink * q);
  }
  // Connecting tunnel
  stroke(ctx, box(-92, -70, 12, 36), sub(p, 0.4, 0.6), { ...pen('GOLD', 0.8, 1.2), closed: true });
  // Inflatable dome with its gores
  const dq = sub(p, 0.3, 0.7), [dx, dy] = F(150, 0);
  stroke(ctx, arcPts(dx, dy, 62, Math.PI, TAU, 40), dq, pen('GOLD_HOT', 1, 2));
  for (const k of [0.35, 0.7]) stroke(ctx, ellipsePts(dx, dy, 62 * k, 62, 0, Math.PI, TAU, 30), dq, pen('GOLD', 0.5, 1));
  stroke(ctx, ellipsePts(dx, dy - 26, 56, 10, 0, 0, TAU, 30), dq, pen('GOLD', 0.4, 1));
  // Tall solar arrays, standing upright to catch a Sun that never climbs
  for (const [u, hgt] of [[268, 230], [340, 196], [404, 168]]) {
    const q = sub(p, 0.45, 0.85);
    stroke(ctx, [F(u, 0), F(u, hgt)], q, pen('GOLD', 0.9, 1.6));
    const panel = box(u - 22, u + 22, hgt - 96, hgt);
    stroke(ctx, panel, q, { ...pen('GOLD_HOT', 1, 1.6), closed: true });
    if (q >= 1) hatch(ctx, panel, 1, { angle: Math.PI / 2, gap: 6, alpha: 0.5 });
  }
  // Antenna dish
  const aq = sub(p, 0.6, 0.9), [ax, ay] = F(222, 64);
  stroke(ctx, [F(222, 0), F(222, 60)], aq, pen('GOLD', 0.9, 1.4));
  stroke(ctx, arcPts(ax - 14, ay - 14, 26, -0.2, 1.75, 16), aq, pen('GOLD_HOT', 1, 1.6));
  // Rover tracks between the lander and the habitats
  stroke(ctx, [F(-292, -10), F(-200, -16), F(-110, -12)], sub(p, 0.6, 1), { ...pen('GOLD', 0.4, 1), dash: [3, 6] });
}

function marsSettlement(ctx, cx, cy, p, t) {
  if (p <= 0) return;
  const F = limbFrame(cx, cy, MARS_R);
  const pen = (c, a, w) => ({ pen: { color: c, alpha: a, width: w }, tip: false });
  // Street grid on the near slope, foreshortened toward the limb
  for (const [k, d] of [6, 18, 36, 62, 98].entries()) {
    const pts = arcPts(cx, cy, MARS_R - d, -Math.PI / 2 - 0.26, -Math.PI / 2 + 0.26, 60);
    stroke(ctx, pts, sub(p, k * 0.08, 0.5 + k * 0.08), pen('GOLD', 0.7 - k * 0.08, 1.2));
  }
  for (let j = -6; j <= 6; j++) {
    const a = -Math.PI / 2 + j * 0.043;
    stroke(ctx, [[cx + Math.cos(a) * MARS_R, cy + Math.sin(a) * MARS_R], [cx + Math.cos(a) * (MARS_R - 98), cy + Math.sin(a) * (MARS_R - 98)]], sub(p, 0.15 + Math.abs(j) * 0.03, 0.6 + Math.abs(j) * 0.03), pen('GOLD', 0.55, 1.1));
  }
  // Domes and long greenhouses along the limb, lights coming on
  [[-290, 34], [-180, 52], [-50, 70], [96, 46], [214, 38]].forEach(([u, rad], k) => {
    const q = sub(p, 0.3 + k * 0.08, 0.65 + k * 0.08), [x, y] = F(u, 0);
    stroke(ctx, arcPts(x, y, rad, Math.PI, TAU, 30), q, pen('GOLD_HOT', 1, 2));
    stroke(ctx, ellipsePts(x, y, rad * 0.5, rad, 0, Math.PI, TAU, 24), q, pen('GOLD', 0.5, 1));
    if (q >= 1) { const on = 0.6 + 0.4 * Math.sin(t * 5 + k * 2); dot(ctx, x, y - rad * 0.5, 3, 'GOLD_HOT', on); glow(ctx, x, y - rad * 0.5, 30, 'GOLD_HOT', 0.35 * on); }
  });
  for (const [u0, u1] of [[-140, -90], [140, 186]]) {
    const q = sub(p, 0.5, 0.85), pts = [];
    for (let i = 0; i <= 12; i++) { const u = lerp(u0, u1, i / 12); pts.push(F(u, 16 * Math.sin((Math.PI * i) / 12))); }
    stroke(ctx, pts, q, pen('GOLD', 0.9, 1.4));
  }
  // Landing pad and a tower with a ship on it, generic
  const q = sub(p, 0.6, 1), [px, py] = F(320, 0);
  stroke(ctx, ellipsePts(px, py + 6, 44, 9, 0, 0, TAU, 30), q, pen('GOLD', 0.8, 1.2));
  stroke(ctx, [F(300, 0), F(300, 170)], q, pen('GOLD', 0.9, 1.6));
  stroke(ctx, [F(320, 8), F(320, 136), F(326, 150), F(332, 136), F(332, 8)], q, pen('GOLD_HOT', 1, 1.6));
}

function plateWorld(ctx, s, t) {
  const tau = t - 2 * PLATE, A = plateOut(t, 2);
  if (tau < 0 || A <= 0) return;
  ctx.globalAlpha = A;
  // The Moon turns its south pole up and swells into a horizon
  const zoom = span(tau, 0.5, 1.35, ease.inOut), sink = span(tau, 2.0, 2.6, ease.in);
  const mcy = lerp(MOON.y, 1740, zoom) + 1100 * sink, mr = lerp(MOON.r, 1180, zoom), rot = Math.PI * zoom;
  const moonA = 1 - span(tau, 2.2, 2.6);
  if (moonA > 0) {
    ctx.globalAlpha = A * moonA;
    if (tau >= 0.1) circle(ctx, MOON.x, mcy, mr, 1, { pen: { color: 'GOLD_HOT', alpha: 0.95, width: 2.4 }, tip: false });
    // Craters ride the turning disc, fading as it becomes ground
    const ca = (1 - zoom) * span(tau, 0.05, 0.45);
    if (ca > 0) {
      ctx.save(); ctx.beginPath(); ctx.arc(MOON.x, mcy, mr - 1, 0, TAU); ctx.clip();
      CRATERS.forEach((c, k) => {
        const a = c.a + rot, x = MOON.x + Math.cos(a) * c.rr * mr, y = mcy + Math.sin(a) * c.rr * mr;
        stroke(ctx, ellipsePts(x, y, c.s * mr, c.s * mr * c.sq, a, 0, TAU, 24), sub(ca, k * 0.03, 0.4 + k * 0.03), { pen: { color: 'GOLD', alpha: 0.55, width: 1.2 }, tip: false });
      });
      ctx.restore();
      // The south pole, marked, comes round to the top
      const a = Math.PI / 2 + rot;
      const [x, y] = [MOON.x + Math.cos(a) * mr, mcy + Math.sin(a) * mr];
      glow(ctx, x, y, 34, 'GOLD_HOT', 0.6 * ca);
      dot(ctx, x, y, 4, 'GOLD_HOT', ca);
    }
    // Ground detail: shallow craters near the horizon, and the base
    const gd = span(tau, 1.0, 1.4);
    if (gd > 0) {
      const F = limbFrame(MOON.x, mcy, mr);
      [[-470, -18, 70], [-160, -36, 90], [250, -24, 60], [470, -48, 110], [-330, -70, 120]].forEach(([u, v, w]) => {
        const [x, y] = F(u, v);
        stroke(ctx, ellipsePts(x, y, w, w * 0.12, 0, 0, TAU, 30), gd, { pen: { color: 'GOLD', alpha: 0.35, width: 1 }, tip: false });
      });
      lunarBase(ctx, F, span(tau, 1.0, 1.9), t);
      // A Sun on the horizon, low, as it always is at the pole
      const [sx, sy] = F(-640, 6);
      glow(ctx, sx, sy, 90, 'GOLD_HOT', 0.5 * gd);
      dot(ctx, sx, sy, 5, 'WHITE', gd);
    }
  }
  // Mars rises: the CRIMSON limb, its settlement grid
  const rise = span(tau, 2.05, 2.75, ease.out);
  if (rise > 0) {
    const cy = lerp(MARS_TOP + MARS_R + 1100, MARS_TOP + MARS_R, rise);
    ctx.save();
    ctx.beginPath(); ctx.arc(960, cy, MARS_R, 0, TAU); ctx.clip();
    hatch(ctx, [[0, cy - MARS_R], [1920, cy - MARS_R], [1920, 1080], [0, 1080]], 1, { angle: -Math.PI / 3, gap: 7, pen: { color: 'CRIMSON', alpha: 0.5, width: 1 } });
    ctx.restore();
    circle(ctx, 960, cy, MARS_R, 1, { pen: { color: 'CRIMSON', alpha: 1, width: 3.2 }, tip: false });
    stroke(ctx, arcPts(960, cy, MARS_R + 12, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5, 90), 1, { pen: { color: 'CRIMSON', alpha: 0.35, width: 7 }, tip: false });
    marsSettlement(ctx, 960, cy, span(tau, 2.45, 3.45), t);
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Plate IV · the gauge
// ---------------------------------------------------------------------------
const DIAL = { x: 960, y: 720, r: 250, a0: Math.PI + 0.2, a1: TAU - 0.2 };
const dialA = v => lerp(DIAL.a0, DIAL.a1, (v - 0.5) / 0.5);
/** Needle: swings up to today's 0.73, then climbs with the riser toward 1.0. */
const needle = tau => {
  const settle = tau < 1.0 ? lerp(0.5, 0.73, ease.spring(clamp((tau - 0.45) / 0.55))) : 0.73;
  return settle + 0.245 * ease.in(clamp((tau - 1.0) / 3.0)) + (tau > 1 ? 0.0025 * Math.sin(tau * 37) : 0);
};
const BEND = Array.from({ length: 121 }, (_, i) => { const u = i / 120; return [140 + 1640 * u, 840 - 620 * Math.pow(u, 5)]; });

function plateGauge(ctx, s, t) {
  const tau = t - 3 * PLATE;
  if (tau < 0) return;
  const { x, y, r, a0, a1 } = DIAL;
  // The curve behind the gauge, bending up as the riser builds
  const bp = span(tau, 0.2, 3.9, ease.linear);
  if (bp > 0) {
    const n = Math.max(2, Math.ceil(BEND.length * bp));
    stroke(ctx, BEND.slice(0, n), 1, { pen: { color: 'GOLD', alpha: 0.3, width: 1.6 }, tip: false, dash: [8, 8] });
    const [tx, ty] = BEND[n - 1];
    glow(ctx, tx, ty, 36, 'GOLD_HOT', 0.45);
    dot(ctx, tx, ty, 3, 'GOLD_HOT', 0.9);
  }
  // Dial: rim, inner rim, ticks
  if (tau >= 0.1) stroke(ctx, arcPts(x, y, r, a0, a1, 120), 1, { pen: { color: 'GOLD_HOT', alpha: 0.95, width: 2.6 }, tip: false });
  stroke(ctx, arcPts(x, y, r - 30, a0, a1, 120), span(tau, 0.15, 0.6), { pen: { color: 'GOLD', alpha: 0.6, width: 1.2 }, tip: false });
  const tk = span(tau, 0.2, 0.7);
  for (let i = 0; i <= 50; i++) {
    const v = 0.5 + i * 0.01, a = dialA(v), major = i % 10 === 0, mid = i % 5 === 0;
    if (i / 50 > tk) break;
    const l = major ? 22 : mid ? 14 : 7;
    stroke(ctx, [[x + Math.cos(a) * r, y + Math.sin(a) * r], [x + Math.cos(a) * (r - l), y + Math.sin(a) * (r - l)]], 1, { pen: { color: major ? 'GOLD_HOT' : 'GOLD', alpha: major ? 0.95 : 0.55, width: major ? 2 : 1 }, tip: false });
  }
  // Filled arc up to the needle
  const v = needle(tau), av = dialA(Math.max(0.5, v));
  if (tau > 0.45) stroke(ctx, arcPts(x, y, r - 15, a0, av, 90), 1, { pen: { color: 'GOLD_HOT', alpha: 0.4, width: 18 }, tip: false });
  // Today's mark and the target
  const a73 = dialA(0.73), aT = dialA(1.0);
  const mk = span(tau, 0.9, 1.2);
  if (mk > 0) stroke(ctx, [[x + Math.cos(a73) * (r + 6), y + Math.sin(a73) * (r + 6)], [x + Math.cos(a73 - 0.03) * (r + 20), y + Math.sin(a73 - 0.03) * (r + 20)], [x + Math.cos(a73 + 0.03) * (r + 20), y + Math.sin(a73 + 0.03) * (r + 20)]], mk, { pen: { color: 'GOLD_HOT', alpha: 1, width: 1.8 }, closed: true, tip: false });
  const pulse = 0.5 + 0.5 * Math.sin(tau * 6);
  if (tau > 0.6) {
    const [tx, ty] = [x + Math.cos(aT) * r, y + Math.sin(aT) * r];
    circle(ctx, tx, ty, 12 + 4 * pulse, 1, { pen: { color: 'GOLD_HOT', alpha: 0.9, width: 1.8 }, tip: false });
    glow(ctx, tx, ty, 60, 'GOLD_HOT', 0.25 + 0.25 * pulse * span(tau, 1, 4));
  }
  // Needle, counterweight and hub
  if (tau > 0.4) {
    const c = Math.cos(av), sn = Math.sin(av), na = span(tau, 0.4, 0.6);
    stroke(ctx, [[x - c * 40, y - sn * 40], [x + c * (r - 36), y + sn * (r - 36)]], na, { pen: { color: 'GOLD_HOT', alpha: 1, width: 3 }, tip: false });
    glow(ctx, x + c * (r - 40), y + sn * (r - 40), 30, 'GOLD_HOT', 0.6 * na);
    circle(ctx, x, y, 16, na, { pen: { color: 'GOLD_HOT', alpha: 1, width: 2.4 }, tip: false });
    dot(ctx, x, y, 5, 'GOLD_HOT', na);
  }
  // Scale labels, cited to the Kardashev entry
  for (let k = 0; k <= 5; k++) {
    const val = 0.5 + k * 0.1, a = dialA(val);
    text(s.ui, val.toFixed(1), x + Math.cos(a) * (r + 40), y + Math.sin(a) * (r + 40), { voice: 'data', size: 24, alpha: 0.75 * span(tau, 0.4 + k * 0.05, 0.7 + k * 0.05), fact: 'kardashev', scale: s.S });
  }
  text(s.ui, 'TYPE I', x + Math.cos(aT) * (r + 40) + 16, y + Math.sin(aT) * (r + 40) + 40, { voice: 'marker', size: 24, alpha: 0.85 * span(tau, 0.8, 1.1), scale: s.S });
}

export default scene('21_future', {
  camera: s => ({ x: 960, y: 560, zoom: 1 + 0.025 * span(s.t, 0, 16, ease.sineInOut) }),

  draw(ctx, s) {
    const t = s.t;
    s.bloom = 0.5;
    // Each plate lands with a small flash.
    const lastHit = s.hits('plates').filter(h => t >= h.t0).pop();
    s.flash = lastHit ? 0.22 * Math.exp(-(t - lastHit.t0) / 0.12) : 0;

    plateEnergy(ctx, s, t);
    plateLoop(ctx, s, t);
    plateWorld(ctx, s, t);
    plateGauge(ctx, s, t);

    // The circle changes role between plates.
    morphRing(ctx, t, { x: TK.x, y: TK.y, rx: AXIS[0], ry: AXIS[0] * SE }, { x: LOOP.x, y: LOOP.y, rx: LOOP.r, ry: LOOP.r }, 3.55, 4.1);
    morphRing(ctx, t, { x: LOOP.x, y: LOOP.y, rx: LOOP.r, ry: LOOP.r }, { x: MOON.x, y: MOON.y, rx: MOON.r, ry: MOON.r }, 7.55, 8.1);
    morphRing(ctx, t, { x: 960, y: MARS_TOP + MARS_R, rx: MARS_R, ry: MARS_R, w: 3.2 }, { x: DIAL.x, y: DIAL.y, rx: DIAL.r, ry: DIAL.r }, 11.55, 12.1, { from: 'CRIMSON', to: 'GOLD_HOT' });

    s.screen(() => {
      card(s, 'card_energy', { x: 960, y: 196, size: 100 });
      card(s, 'card_discovery', { lines: ['DISCOVERY AT', 'MACHINE SPEED.'], x: 960, y: 222, size: 96, lineHeight: 104 });
      card(s, 'card_world', { x: 960, y: 196, size: 100 });
      card(s, 'card_curve', { x: 960, y: 196, size: 100 });
      card(s, 'data_kardashev', { x: 960, y: 880, size: 30, voice: 'dataBold' });
    });
  },
});
