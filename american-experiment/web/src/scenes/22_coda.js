// OBS 22 · CODA — THE EXPERIMENT CONTINUES, 1776–∞.
//   141.1–144.3  the rewind: the film's sixteen symbols in reverse order, one per beat
//          (the last two share 144.3 as eighths), each flying in and snapping into the
//          centre circle while the cursor races back to 1776
//   144.4  one beat of black and silence
//   145.1  the final chord: everything collapses into the torch and the circle becomes
//          its halo, as in the title; THE EXPERIMENT CONTINUES. then ONWARD., the only
//          white type in the film (?final=WORD swaps it)
//   146.1  the ruler runs on off the right edge; black for the last second

import { scene, MOTIF, zoomAbout } from './common.js';
import { rgba } from '../theme.js';
import { ease, clamp, lerp, span, TAU, mulberry32 } from '../engine.js';
import { stroke, circle, glow, dot, arcPts, ellipsePts, bezierPts, hatch } from '../draw/paths.js';
import { card } from '../draw/type.js';
import { sunDisc, thirteen, starPts, globe } from '../draw/motif.js';
import { torch } from '../draw/torch.js';
import { quill, bulb, scriptLine, drawScript } from '../draw/icons.js';
import { chassis } from '../draw/conveyor.js';
import { flyer, flyerProjector, FLYER_PARTS } from '../draw/flyer.js';
import { camera3d, saturnV } from '../draw/wireframe3d.js';
import { mapView, outline, borders } from '../draw/map.js';
import { dome } from './04_constitution.js';
import { bomber } from './12_arsenal.js';
import { booster } from './18_rockets.js';

const { cx: CX, cy: CY, r: R } = MOTIF;
const BLACK = 7.5, CHORD = 8.0;
const pen = (c, a, w) => ({ pen: { color: c, alpha: a, width: w }, tip: false });
const box = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const MAP = mapView(-180, -112, 360);
const INK = scriptLine(-196, 136, 104, 1776, { h: 7 });
const FLYER = flyerProjector({ cx: 0, cy: 18, k: 7.2, yaw: -0.55, pitch: 0.32, D: 160 });
const ALL_PARTS = FLYER_PARTS.map(() => 1);

/**
 * The film's symbols, newest first, each drawn about (0, 0) inside the circle. Every one
 * is redrawn by the same code its own observation used.
 */
const SYMBOLS = [
  // OBS 19: tokens and their attention arcs
  (g, t) => {
    const n = 6, w = 46, gap = 12, x0 = -(n * w + (n - 1) * gap) / 2, y = 70, xc = i => x0 + i * (w + gap) + w / 2;
    for (let i = 0; i < n; i++) stroke(g, box(xc(i) - w / 2, y - 16, xc(i) + w / 2, y + 16), 1, { ...pen(i === 5 ? 'GOLD_HOT' : 'GOLD', 0.95, 1.6), closed: true });
    for (const [a, b, k] of [[5, 0, 0.9], [5, 2, 0.55], [5, 3, 1], [5, 4, 0.4], [4, 1, 0.5], [3, 0, 0.7], [2, 1, 0.35]]) {
      const xa = xc(a), xb = xc(b), h = Math.min(170, Math.abs(xa - xb) * 0.6);
      stroke(g, bezierPts([xa, y - 18], [xa, y - 18 - h], [xb, y - 18 - h], [xb, y - 18], 24), 1, pen('GOLD_HOT', k, 0.8 + 1.8 * k));
    }
  },
  // OBS 17: a battery pack, its cells lit in a wave
  (g, t) => {
    stroke(g, box(-172, -92, 172, 92), 1, { ...pen('GOLD_HOT', 1, 2), closed: true });
    for (let r = 0; r < 5; r++) for (let c = 0; c < 10; c++) {
      const x = -148 + c * 33, y = -66 + r * 33, lit = 0.6 + 0.4 * Math.sin(c * 0.6 - t * 9);
      g.beginPath(); g.arc(x, y, 12, 0, TAU);
      g.fillStyle = rgba('GOLD_HOT', 0.28 * lit); g.fill();
      g.strokeStyle = rgba('GOLD_HOT', 0.85); g.lineWidth = 1.2; g.stroke();
    }
  },
  // OBS 18: the booster, legs out
  (g, t) => { booster(g, 0, 146, 46, 282, 0, { legs: 1, rings: 6 }); },
  // OBS 16: the globe and its packets
  (g, t) => {
    globe(g, 0, 0, 150, 1, t * 0.6, { tilt: 0.35 });
    [[[-120, -30], [40, 70]], [[-60, 80], [110, -50]], [[-20, -110], [120, 40]]].forEach(([a, b], k) => {
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 90];
      const arc = bezierPts(a, [lerp(a[0], mid[0], 0.6), mid[1]], [lerp(b[0], mid[0], 0.6), mid[1]], b, 24);
      stroke(g, arc, 1, pen('GOLD_HOT', 0.9, 1.6));
      const q = arc[Math.floor((((t * 2.2 + k / 3) % 1) + 1) % 1 * 24)];
      dot(g, q[0], q[1], 3.4, 'WHITE', 1);
      dot(g, a[0], a[1], 3, 'GOLD_HOT', 1); dot(g, b[0], b[1], 3, 'GOLD_HOT', 1);
    });
  },
  // OBS 15: the chip
  (g, t) => {
    const die = box(-64, -64, 64, 64);
    stroke(g, box(-112, -112, 112, 112), 1, { ...pen('GOLD_HOT', 1, 2.2), closed: true });
    stroke(g, die, 1, { ...pen('GOLD', 0.95, 1.4), closed: true });
    hatch(g, die, 1, { angle: 0, gap: 9, alpha: 0.35 });
    hatch(g, die, 1, { angle: Math.PI / 2, gap: 9, alpha: 0.35 });
    for (let i = 0; i < 9; i++) {
      const u = -88 + i * 22;
      for (const [x0, y0, x1, y1] of [[u, -112, u, -140], [u, 112, u, 140], [-112, u, -140, u], [112, u, 140, u]]) stroke(g, [[x0, y0], [x1, y1]], 1, pen('GOLD', 0.9, 2));
      stroke(g, [[u * 0.7, -64], [u, -100]], 1, pen('GOLD', 0.4, 0.8));
    }
    glow(g, 0, 0, 60, 'GOLD_HOT', 0.3 + 0.2 * Math.sin(t * 12));
  },
  // OBS 14: Earthrise over the lunar limb
  (g, t) => {
    globe(g, 0, -58, 92, 1, t * 0.3, { tilt: 0.4, night: 0.85, sun: 0, phase: 0.1 });
    stroke(g, arcPts(0, 560, 520, -Math.PI / 2 - 0.36, -Math.PI / 2 + 0.36, 60), 1, pen('GOLD_HOT', 1, 2.4));
    for (const [x, y, w] of [[-110, 70, 40], [40, 64, 26], [120, 92, 34], [-30, 104, 50]]) stroke(g, ellipsePts(x, y, w, w * 0.16, 0, 0, TAU, 24), 1, pen('GOLD', 0.4, 1));
  },
  // OBS 14: the Saturn V, turning
  (g, t) => {
    const yaw = t * 0.8;
    saturnV(g, camera3d({ cx: 0, by: 176, k: 0.96, yc: 180, D: 2400, yaw }), [1, 1, 1, 1, 1, 1], [], { yaw, edge: 1 });
  },
  // OBS 12: the bomber in plan
  (g, t) => { bomber(g, 0, 0, 0.62, 3); },
  // OBS 11: the 1913 chassis, wheels on
  (g, t) => { g.save(); g.scale(1.2, 1.2); chassis(g, 0, 70, 4, { kind: '1913', spin: -t * 8 }); g.restore(); },
  // OBS 10: the Flyer, propellers turning
  (g, t) => { flyer(g, FLYER, ALL_PARTS, { prop: t * 30, spin: 0.7, depthCue: true }); },
  // OBS 09: the lamp, lit
  (g, t) => { bulb(g, 0, 24, 150, { lit: 0.85 + 0.15 * Math.sin(t * 23) }); },
  // OBS 08: the bridge
  (g, t) => {
    const deck = 70, tw = 96, top = -110;
    const sag = x => top + 6 + (deck - 14 - (top + 6)) * (1 - (x / tw) ** 2);
    stroke(g, [[-196, deck], [196, deck]], 1, pen('GOLD_HOT', 1, 2.4));
    stroke(g, [[-196, deck + 12], [196, deck + 12]], 1, pen('GOLD', 0.7, 1.2));
    for (let x = -tw + 12; x < tw; x += 12) stroke(g, [[x, sag(x)], [x, deck]], 1, pen('GOLD', 0.5, 1));
    for (const sx of [-1, 1]) {
      const x = sx * tw;
      for (let k = 1; k <= 4; k++) stroke(g, [[x, top + 10], [x - sx * k * 18, deck]], 1, pen('GOLD', 0.35, 1));
      stroke(g, bezierPts([x, top + 6], [sx * (tw + 40), top + 70], [sx * 172, deck - 30], [sx * 196, deck], 20), 1, pen('GOLD_HOT', 1, 2));
      stroke(g, box(x - 16, top, x + 16, deck + 60), 1, { ...pen('GOLD', 1, 1.8), closed: true });
      for (const dx of [-8, 8]) stroke(g, [[x + dx - 4, deck - 10], [x + dx - 4, top + 40], [x + dx, top + 30], [x + dx + 4, top + 40], [x + dx + 4, deck - 10]], 1, pen('GOLD', 0.6, 1));
    }
    stroke(g, Array.from({ length: 41 }, (_, i) => { const x = -tw + (2 * tw * i) / 40; return [x, sag(x)]; }), 1, pen('GOLD_HOT', 1, 2));
  },
  // OBS 07: the six rings
  (g, t) => {
    for (let k = 0; k < 6; k++) {
      const r = 40 + k * 27, a = -0.4 + k * 1.1;
      circle(g, 0, 0, r, 1, { pen: { color: k % 2 ? 'GOLD' : 'GOLD_HOT', alpha: 0.95 - k * 0.08, width: 2.2 - k * 0.2 }, tip: false });
      dot(g, Math.cos(a) * r, Math.sin(a) * r, 3.2, 'GOLD_HOT', 1);
    }
  },
  // OBS 05: the continent
  (g, t) => {
    borders(g, MAP, 1, { pen: { color: 'GOLD', alpha: 0.3, width: 0.8 } });
    outline(g, MAP, 1, { pen: { color: 'GOLD_HOT', alpha: 0.95, width: 1.8 }, tip: false });
  },
  // OBS 04: the dome, turning
  (g, t) => { dome(g, 0, 152, 1, t * 0.4, 1); },
  // OBS 03: the quill and its first line
  (g, t) => {
    quill(g, -86, 122, -0.95, 0.85, 1);
    drawScript(g, INK, 1, { color: 'GOLD_HOT', alpha: 0.85, width: 1.4 });
  },
];

/** Cursor year in the coda: races back to 1776, waits in the dark, springs to 2026 on the chord. */
function cursorYear(t, last) {
  if (t < last) { const u = t / last; return 2026 - 250 * (0.35 * u + 0.65 * u * u); }
  if (t < CHORD) return 1776;
  const tau = t - CHORD, w = 7;
  return 1776 + 250 * (1 - (1 + w * tau) * Math.exp(-w * tau));
}

const STREAKS = (() => { const r = mulberry32(141); return Array.from({ length: 22 }, () => ({ y: CY + (r() - 0.5) * 560, x: r() * 2200, l: 60 + r() * 220, v: 1800 + r() * 1600, a: 0.06 + r() * 0.1 })); })();

function rewind(ctx, s, t) {
  const hits = s.hits('rewind').map(h => h.t0);
  const last = hits[hits.length - 1];
  // The circle: rim, a tick ring turning backward faster and faster, stars on the rim
  const back = -(t * 0.5 + t * t * 0.09);
  let pulse = 0;
  for (const h of hits) if (t >= h) pulse = Math.max(pulse, Math.exp(-(t - h) / 0.12));
  circle(ctx, CX, CY, R, 1, { pen: { color: 'GOLD_HOT', alpha: 0.95, width: 2.6 + 2 * pulse }, tip: false });
  circle(ctx, CX, CY, R + 14, 1, { pen: { color: 'GOLD', alpha: 0.4, width: 1 }, tip: false });
  ctx.strokeStyle = rgba('GOLD', 0.4); ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 104; i++) {
    const a = (i / 104) * TAU + back, l = i % 8 === 0 ? 10 : 5;
    ctx.moveTo(CX + Math.cos(a) * (R + 2), CY + Math.sin(a) * (R + 2));
    ctx.lineTo(CX + Math.cos(a) * (R + 2 + l), CY + Math.sin(a) * (R + 2 + l));
  }
  ctx.stroke();
  thirteen(CX, CY, R, back * 0.6).forEach(([x, y]) => stroke(ctx, starPts(x, y, 9), 1, { ...pen('GOLD_HOT', 0.8, 1.2), closed: true }));
  glow(ctx, CX, CY, R * 1.3, 'GOLD_HOT', 0.05 + 0.2 * pulse);
  // Tape streaks running backward
  for (const st of STREAKS) {
    const x = 1960 - ((st.x + t * st.v) % 2200);
    stroke(ctx, [[x, st.y], [x + st.l, st.y]], 1, pen('GOLD', st.a * span(t, 0, 0.4), 1));
  }
  // The symbols: each flies in from the right and snaps into the circle on its hit,
  // then is drawn down into the centre as the next one arrives.
  hits.forEach((h, k) => {
    const next = k + 1 < hits.length ? hits[k + 1] : BLACK;
    if (t < h - 0.14 || t >= next) return;
    const u = clamp((t - (h - 0.14)) / 0.14), arrive = ease.out(u);
    const leave = clamp((t - (next - 0.12)) / 0.12);
    const pop = t >= h ? 1 + 0.07 * Math.exp(-(t - h) / 0.08) : 1;
    const draw = (dx, a) => {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(CX + dx, CY);
      ctx.rotate(-0.3 * (1 - arrive));
      const sc = lerp(0.75, 1, arrive) * pop * (1 - 0.5 * ease.in(leave));
      ctx.scale(sc, sc);
      SYMBOLS[k](ctx, t);
      ctx.restore();
    };
    if (arrive < 1) for (const [lag, a] of [[0.5, 0.18], [0.25, 0.35]]) draw(620 * (1 - ease.out(Math.max(0, u - lag))), a);
    draw(620 * (1 - arrive), 1 - leave);
  });
  s.hud.cursorYear = cursorYear(t, last);
}

function finale(ctx, s, t) {
  const tau = t - CHORD;
  const hit = Math.exp(-tau / 0.35);
  s.bloom = 0.45 + 0.25 * hit;
  s.glow = 0.55 * hit;
  s.flash = 0.4 * Math.exp(-tau / 0.14);
  const rot = tau * 0.035;
  // The circle becomes the torch's halo: the title's sun disc again, its rays out.
  const rays = ease.expoOut(clamp(tau / 0.8));
  sunDisc(ctx, CX, CY, R, 1, rays, rot, { hot: 0.6 + 0.4 * hit, rayLen: 330, downFade: 1 });
  glow(ctx, CX, CY, R * 1.35, 'GOLD_HOT', 0.22 * hit + 0.06);
  thirteen(CX, CY, R, rot).forEach(([x, y]) => stroke(ctx, starPts(x, y, 10 + 3 * hit), 1, { ...pen('GOLD_HOT', 0.85, 1.3), closed: true }));
  // Everything collapses into the flame: the symbols spiral in, oldest first.
  let feed = 0;
  ctx.save();
  ctx.beginPath(); ctx.rect(-600, 124, 3120, 2000); ctx.clip(); // clear of the HUD's top line
  SYMBOLS.forEach((sym, k) => {
    const j = SYMBOLS.length - 1 - k, ta = 0.12 + 0.09 * j;
    if (tau >= ta) { feed += Math.exp(-(tau - ta) / 0.12); return; }
    const q = Math.pow(clamp(tau / ta), 2), rho = 760 * (1 - q);
    const a0 = -Math.PI + 0.15 + (k * (Math.PI - 0.3)) / 15, a = a0 + 0.9 * q;
    ctx.save();
    ctx.globalAlpha = clamp(rho / 80) * clamp(tau / 0.1);
    ctx.translate(CX + Math.cos(a) * rho, CY - 22 + Math.sin(a) * rho);
    ctx.rotate(1.2 * q);
    const sc = 0.42 * (0.25 + 0.75 * (1 - q));
    ctx.scale(sc, sc);
    sym(ctx, t);
    ctx.restore();
  });
  ctx.restore();
  const fl = ease.out(clamp(tau / 0.5)) * (1 + 0.04 * Math.sin(t * 7)) + 0.12 * Math.min(1.5, feed);
  torch(ctx, CX, CY + 18, 0.7, 1, s.T, fl);
  if (feed > 0) glow(ctx, CX, CY - 60, 110, 'GOLD_HOT', 0.3 * Math.min(1, feed));
  s.hud.cursorYear = cursorYear(t, 0);
  s.hud.runoff = s.cue('runoff', ease.inOut);
}

export default scene('22_coda', {
  // The rewind plays large in the middle of the frame; the beat of black hides the move
  // back to the title's framing for the finale.
  camera: s => (s.t < BLACK ? { x: CX, y: CY, zoom: 1.18 + 0.06 * span(s.t, 0, BLACK) } : zoomAbout(CX, CY, 1.04 + 0.03 * span(s.t, CHORD, 16))),

  draw(ctx, s) {
    const t = s.t;
    s.bloom = 0.48;
    if (t < BLACK) rewind(ctx, s, t);
    else if (t >= CHORD) finale(ctx, s, t);
    else s.hud.cursorYear = 1776;
    // The beat of black, and black again for the last second
    s.black = Math.max(t >= BLACK && t < CHORD ? 1 : 0, span(t, 14.4, 15.0, ease.inOut));

    card(s, 'card_continues', { x: 960, y: 724, size: 96 });
    card(s, 'card_onward', { x: 960, y: 760, size: 156, text: s.film.finalWord || undefined });
    card(s, 'data_signoff', { x: 960, y: 902, size: 30, voice: 'dataBold' });
  },
});
