// OBS 04 · ACT I — CONSTITUTION, 1787–1791.
//   17.1  WE THE PEOPLE in engraved caps; the seven Articles rule themselves in on the left
//   18.1  three branches, and the loop of arrows that checks and balances them
//   19.1  LIMITED GOVERNMENT. UNLIMITED AMBITION.
//   20.3  the Bill of Rights: ten ruled lines light, one per quarter note
//   21.1  the triangle settles into a pediment and a wireframe dome rises from it
//   23.1  the camera pulls back; Art. I §8 lights GOLD_HOT on the bell
//   23.3  a seal stamps PATENT ACT · 1790

import { scene } from './common.js';
import { ease, clamp, lerp, sub, span, TAU, logText } from '../engine.js';
import { stroke, circle, arcPts, glow, dot } from '../draw/paths.js';
import { starPts } from '../draw/motif.js';
import { card, text, engraved, cardEnvelope } from '../draw/type.js';
import { camera3d, ring } from '../draw/wireframe3d.js';
import { scriptLine, drawScript, seal } from '../draw/icons.js';

const ARTS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const AMENDS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const LEFT = { x0: 150, x1: 600, y0: 430, y1: 876 }, RIGHT = { x0: 1320, x1: 1770, y0: 430, y1: 876 };
const ART_Y = i => 512 + i * 53, AM_Y = i => 510 + i * 37;
const ART_SCRIPT = ARTS.map((_, i) => scriptLine(318, ART_Y(i) + 2, 250, 90 + i, { h: 8 }));
const AM_SCRIPT = AMENDS.map((_, i) => scriptLine(1450, AM_Y(i) + 2, 290, 140 + i, { h: 7 }));

// The three branches; the triangle later settles into the portico's pediment.
const NODES0 = [[960, 520], [1150, 820], [770, 820]]; // legislative, judicial, executive
const NODES1 = [[960, 690], [1230, 780], [690, 780]];
const LABELS = ['LEGISLATIVE', 'JUDICIAL', 'EXECUTIVE'];

function nodeIcon(g, i, x, y, a) {
  const P = { color: 'GOLD_HOT', alpha: a, width: 1.6 };
  if (i === 0) for (const dy of [-12, 0, 12]) stroke(g, [[x - 16, y + dy], [x + 16, y + dy]], 1, { pen: P, tip: false });
  if (i === 2) stroke(g, starPts(x, y, 17), 1, { pen: P, closed: true, tip: false });
  if (i === 1) {
    stroke(g, [[x, y - 18], [x, y + 16]], 1, { pen: P, tip: false });
    stroke(g, [[x - 20, y - 12], [x + 20, y - 12]], 1, { pen: P, tip: false });
    for (const sx of [-1, 1]) stroke(g, arcPts(x + sx * 20, y - 2, 9, 0, Math.PI, 12), 1, { pen: P, tip: false });
    stroke(g, [[x - 10, y + 16], [x + 10, y + 16]], 1, { pen: P, tip: false });
  }
}

/** A curved arrow from a to b bulging by `bend` (signed), drawn to p, with its head. */
function arrowArc(g, a, b, bend, p, alpha) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
  const c = [mx - (dy / L) * bend, my + (dx / L) * bend];
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const u = 0.17 + 0.66 * (i / 40), v = 1 - u;
    pts.push([v * v * a[0] + 2 * v * u * c[0] + u * u * b[0], v * v * a[1] + 2 * v * u * c[1] + u * u * b[1]]);
  }
  stroke(g, pts, p, { pen: { color: 'GOLD', alpha: 0.85 * alpha, width: 1.6 }, tip: false });
  if (p >= 1) {
    const [x, y] = pts[pts.length - 1], [px, py] = pts[pts.length - 3], ang = Math.atan2(y - py, x - px);
    stroke(g, [[x + Math.cos(ang + 2.6) * 12, y + Math.sin(ang + 2.6) * 12], [x, y], [x + Math.cos(ang - 2.6) * 12, y + Math.sin(ang - 2.6) * 12]], 1, { pen: { color: 'GOLD_HOT', alpha: alpha, width: 1.8 }, tip: false });
  }
  return pts;
}

/** The Capitol's dome as a wireframe: drum and peristyle, ribbed dome, lantern. p builds it upward. */
function dome(g, cx, by, p, yaw, alpha) {
  if (p <= 0) return;
  const cam = camera3d({ cx, by, k: 1, yc: 260, D: 1500, yaw });
  const R = (y, r, q, o = {}) => ring(g, cam, y, r, q, { front: 0.95 * alpha, back: 0.22 * alpha, width: 1.6, n: 72, ...o });
  const col = (r, y0, y1, n, q, w = 1.2) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, A = cam.project(Math.cos(a) * r, y0, Math.sin(a) * r), B = cam.project(Math.cos(a) * r, y1, Math.sin(a) * r);
      const qq = sub(q, (i / n) * 0.3, (i / n) * 0.3 + 0.7);
      if (qq > 0) stroke(g, [A, [lerp(A[0], B[0], qq), lerp(A[1], B[1], qq)]], 1, { pen: { color: 'GOLD', alpha: (A[2] <= 0 ? 0.85 : 0.18) * alpha, width: A[2] <= 0 ? w : 0.8 }, tip: false });
    }
  };
  // Drum with its peristyle of columns, then the attic
  R(0, 150, sub(p, 0, 0.12), { width: 2 });
  R(10, 150, sub(p, 0.03, 0.15));
  col(150, 10, 62, 28, sub(p, 0.08, 0.3));
  R(62, 150, sub(p, 0.2, 0.32));
  R(72, 138, sub(p, 0.25, 0.36), { width: 2 });
  col(138, 72, 88, 40, sub(p, 0.3, 0.42), 0.8);
  R(88, 132, sub(p, 0.36, 0.46), { width: 2 });
  // Dome: parallels and ribs
  const H = 140, RD = 132, y0 = 88;
  for (let j = 1; j <= 5; j++) {
    const phi = (j / 6) * Math.PI / 2;
    R(y0 + H * Math.sin(phi), RD * Math.cos(phi), sub(p, 0.42 + j * 0.05, 0.6 + j * 0.05), { width: 1.2 });
  }
  const ribs = 16, rp = sub(p, 0.45, 0.85);
  for (let i = 0; i < ribs; i++) {
    const a = (i / ribs) * TAU, pts = [];
    for (let k = 0; k <= 24; k++) { const phi = (k / 24) * Math.PI / 2 * 0.86; pts.push(cam.project(Math.cos(a) * RD * Math.cos(phi), y0 + H * Math.sin(phi), Math.sin(a) * RD * Math.cos(phi))); }
    const front = pts[6][2] <= 0;
    stroke(g, pts, rp, { pen: { color: front ? 'GOLD_HOT' : 'GOLD', alpha: (front ? 0.8 : 0.16) * alpha, width: front ? 1.3 : 0.8 }, tip: false });
  }
  // Lantern, cap and finial
  const ly = y0 + H * Math.sin(Math.PI / 2 * 0.86);
  R(ly, 26, sub(p, 0.8, 0.88), { n: 32 });
  col(26, ly, ly + 32, 10, sub(p, 0.82, 0.92), 1);
  R(ly + 32, 26, sub(p, 0.86, 0.94), { n: 32 });
  const top = cam.project(0, ly + 32, 0), tip = cam.project(0, ly + 84, 0);
  stroke(g, arcPts(top[0], top[1], 26, Math.PI, TAU, 24), sub(p, 0.88, 0.96), { pen: { color: 'GOLD', alpha: 0.9 * alpha, width: 1.4 }, tip: false });
  stroke(g, [[top[0], top[1] - 26], tip], sub(p, 0.92, 1), { pen: { color: 'GOLD_HOT', alpha: alpha, width: 1.8 }, tip: false });
  if (p >= 1) glow(g, tip[0], tip[1], 18, 'GOLD_HOT', 0.4 * alpha);
}

/** Characters set around a circle (a seal's legend), logged as one line of text. */
function ringText(s, g, str, cx, cy, r, o = {}) {
  const chars = [...str], step = o.step ?? 0.17, a0 = -Math.PI / 2 - ((chars.length - 1) * step) / 2;
  chars.forEach((ch, i) => {
    const a = a0 + i * step;
    g.save(); g.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.rotate(a + Math.PI / 2);
    text(g, ch, 0, 0, { voice: 'dataBold', size: o.size ?? 24, alpha: o.alpha ?? 1, log: false });
    g.restore();
  });
  const size = o.size ?? 24, span0 = ((chars.length - 1) * step) / 2;
  logText(g, s.S, { text: str, voice: 'data', fact: o.fact, size, alpha: o.alpha ?? 1,
    x0: cx - Math.sin(span0) * r - size / 2, x1: cx + Math.sin(span0) * r + size / 2, y0: cy - r - size / 2, y1: cy - Math.cos(span0) * r + size / 2 });
}

export default scene('04_constitution', {
  camera(s) {
    const t = s.t;
    const z0 = 1 + 0.03 * span(t, 0, 8) - 0.03 * span(t, 8, 11);
    const m = span(t, 11, 12.2, ease.inOut);
    return { x: 960, y: lerp(540, 458, m), zoom: lerp(z0, 0.92, m) + 0.025 * span(t, 12.2, 16, ease.sineInOut) };
  },

  draw(ctx, s) {
    const t = s.t;
    s.bloom = 0.42;
    s.bg = { parchment: 0.11 * (1 - 0.3 * span(t, 8, 12)) };

    // WE THE PEOPLE, engraved
    const c = s.cardOf('card_people');
    const env = cardEnvelope(t, c.in, c.out, 0);
    if (env.visible) engraved(ctx, 'WE THE PEOPLE', 960, 250 + env.drift, { size: 168, alpha: env.alpha, reveal: i => env.reveal(i), scale: s.S, gap: 3.6 });
    card(s, 'attrib_constitution', { x: 960, y: 372, size: 27, alpha: 0.85 });
    s.screen(() => card(s, 'card_limited', { lines: ['LIMITED GOVERNMENT.', 'UNLIMITED AMBITION.'], x: 960, y: 262, size: 100 }));

    // The seven Articles (left) and the ten amendments (right)
    const lp = span(t, 0.4, 2.4, ease.inOut);
    const panel = (P, q, title, ty) => {
      stroke(ctx, [[P.x0, P.y0], [P.x1, P.y0], [P.x1, P.y1], [P.x0, P.y1]], q, { pen: { color: 'GOLD', alpha: 0.55, width: 1.3 }, closed: true, tip: q < 1 });
      text(s.ui, title, (P.x0 + P.x1) / 2, ty, { voice: 'marker', size: 28, alpha: 0.75 * sub(q, 0.4, 1), scale: s.S });
    };
    panel(LEFT, lp, 'THE ARTICLES', 466);
    const patent = s.cue('patent', ease.out);
    ARTS.forEach((a, i) => {
      const q = sub(lp, 0.25 + i * 0.08, 0.55 + i * 0.08);
      if (q <= 0) return;
      const hot = i === 0 ? patent : 0;
      const y = ART_Y(i);
      text(s.ui, `ART. ${a}`, 172, y, { voice: hot > 0 ? 'dataBold' : 'data', size: 28, align: 'left', alpha: (0.55 + 0.45 * hot) * q, color: hot > 0.05 ? 'GOLD_HOT' : 'GOLD', scale: s.S });
      drawScript(ctx, ART_SCRIPT[i], q, { color: hot > 0.05 ? 'GOLD_HOT' : 'GOLD', alpha: 0.35 + 0.5 * hot, width: 1.1 });
      stroke(ctx, [[318, y + 16], [575, y + 16]], q, { pen: { color: 'GOLD', alpha: 0.25 + 0.5 * hot, width: 1 }, tip: false });
    });
    if (patent > 0) {
      text(s.ui, '§8', 172 + 128, ART_Y(0), { voice: 'dataBold', size: 28, align: 'left', alpha: patent, color: 'GOLD_HOT', fact: 'patent_act_1790', scale: s.S, reveal: i => ease.expoOut(clamp((t - s.at('7.1') - i * 0.06) / 0.3)) });
      const [x0, y0] = [LEFT.x0 + 8, ART_Y(0) - 24], [x1, y1] = [LEFT.x1 - 8, ART_Y(0) + 26];
      stroke(ctx, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], patent, { pen: { color: 'GOLD_HOT', alpha: 0.9, width: 2 }, closed: true });
      glow(ctx, 230, ART_Y(0), 120 * patent, 'GOLD_HOT', 0.22 * patent * (1 + Math.exp(-s.since('7.1') / 0.3)));
    }
    const rp = span(t, s.at('4.2'), s.at('4.3'), ease.inOut);
    panel(RIGHT, rp, 'AMENDMENTS I–X', 466);
    const bills = s.hits('bill_of_rights');
    AMENDS.forEach((a, i) => {
      const h = bills[i];
      const q = clamp((t - h.t0) / 0.3);
      const y = AM_Y(i);
      const flash = t >= h.t0 ? Math.exp(-(t - h.t0) / 0.25) : 0;
      text(s.ui, a, 1408, y, { voice: 'data', size: 28, align: 'right', alpha: rp * (0.3 + 0.6 * ease.out(q) + 0.1 * flash), color: flash > 0.3 ? 'GOLD_HOT' : 'GOLD', scale: s.S });
      if (q > 0) {
        drawScript(ctx, AM_SCRIPT[i], ease.out(q), { color: flash > 0.3 ? 'GOLD_HOT' : 'GOLD', alpha: 0.55 + 0.4 * flash, width: 1.2 });
        stroke(ctx, [[1430, y + 14], [1745, y + 14]], ease.out(q), { pen: { color: 'GOLD_HOT', alpha: 0.4 + 0.5 * flash, width: 1.2 }, tip: false });
        if (flash > 0.02) glow(ctx, 1380, y, 40, 'GOLD_HOT', 0.4 * flash);
      }
    });

    // Three branches, checks and balances; then the pediment.
    const br = s.cue('branches', ease.inOut);
    const ped = span(t, 8, 9.2, ease.inOut);
    const N = NODES0.map((n, i) => [lerp(n[0], NODES1[i][0], ped), lerp(n[1], NODES1[i][1], ped)]);
    const nodeA = 1 - span(t, 8, 8.6);
    stroke(ctx, [N[0], N[1], N[2]], sub(br, 0, 0.35), { pen: { color: 'GOLD', alpha: lerp(0.28, 0.95, ped), width: lerp(1, 2.4, ped) }, closed: true, tip: false });
    N.forEach(([x, y], i) => {
      const q = sub(br, 0.05 + i * 0.08, 0.3 + i * 0.08);
      if (q <= 0 || nodeA <= 0) return;
      circle(ctx, x, y, 44, q, { pen: { color: 'GOLD_HOT', alpha: 0.95 * nodeA, width: 2.2 } });
      if (q >= 1) nodeIcon(ctx, i, x, y, nodeA);
      text(s.ui, LABELS[i], x, i === 0 ? y - 74 : y + 76, { voice: 'marker', size: 24, alpha: 0.85 * sub(br, 0.3, 0.5) * nodeA, scale: s.S });
    });
    if (nodeA > 0) {
      const pairs = [[0, 1], [1, 2], [2, 0]];
      pairs.forEach(([a, b], k) => {
        const outer = arrowArc(ctx, N[a], N[b], -70, sub(br, 0.4 + k * 0.1, 0.6 + k * 0.1), nodeA);
        arrowArc(ctx, N[b], N[a], -26, sub(br, 0.65 + k * 0.1, 0.85 + k * 0.1), 0.55 * nodeA);
        // Pulses circulate the loop once it is closed.
        if (br >= 1) {
          const u = (t * 0.7 + k / 3) % 1, i = Math.floor(u * (outer.length - 1));
          dot(ctx, outer[i][0], outer[i][1], 3, 'GOLD_HOT', nodeA);
          glow(ctx, outer[i][0], outer[i][1], 12, 'GOLD_HOT', 0.5 * nodeA);
        }
      });
    }
    // Portico: entablature, columns, steps
    const por = span(t, 8.6, 9.8, ease.inOut);
    if (por > 0) {
      const xL = NODES1[2][0], xR = NODES1[1][0];
      stroke(ctx, [[xL, 780], [xR, 780], [xR, 800], [xL, 800]], sub(por, 0, 0.4), { pen: 'structure', closed: true, tip: false });
      for (let i = 0; i < 8; i++) {
        const x = lerp(xL + 28, xR - 28, i / 7), q = sub(por, 0.2 + i * 0.04, 0.6 + i * 0.04);
        stroke(ctx, [[x - 9, 800], [x - 9, lerp(800, 884, q)]], 1, { pen: { color: 'GOLD', alpha: q > 0 ? 0.9 : 0, width: 1.5 }, tip: false });
        stroke(ctx, [[x + 9, 800], [x + 9, lerp(800, 884, q)]], 1, { pen: { color: 'GOLD', alpha: q > 0 ? 0.9 : 0, width: 1.5 }, tip: false });
        if (q > 0) stroke(ctx, [[x - 14, 806], [x + 14, 806]], q, { pen: { color: 'GOLD', alpha: 0.9, width: 1.5 }, tip: false });
      }
      for (const [y, ext] of [[884, 10], [894, 24], [904, 38]]) stroke(ctx, [[xL - ext, y], [xR + ext, y]], sub(por, 0.5, 1), { pen: { color: 'GOLD', alpha: 0.85, width: 1.4 }, tip: false });
    }
    // The dome rises from the pediment's apex.
    const dp = s.cue('dome', ease.inOut);
    dome(ctx, 960, 676 + 40 * (1 - dp), dp, 0.4 + t * 0.06, 1);

    // The patent seal stamps on the Articles.
    const st = s.cue('seal_stamp', ease.expoOut);
    if (st > 0) {
      s.screen(() => {
        const [sx, sy] = s.project(500, 640);
        seal(s, ctx, sx, sy, 100, st, { wax: null });
        ringText(s, s.ui, 'PATENT ACT', sx, sy, 58 * lerp(1.35, 1, st), { size: 24, alpha: clamp(st * 3), step: 0.28 });
        text(s.ui, '1790', sx, sy + 12, { voice: 'dataBold', size: 30 * lerp(1.35, 1, st), alpha: clamp(st * 3), fact: 'patent_act_1790', scale: s.S });
      });
    }
    s.screen(() => {
      card(s, 'card_progress', { lines: ['TO PROMOTE THE PROGRESS', 'OF SCIENCE AND USEFUL ARTS'], x: 960, y: 238, size: 92 });
      card(s, 'attrib_patent', { x: 960, y: 396, size: 26, alpha: 0.85 });
    });
  },
});

