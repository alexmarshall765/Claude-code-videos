// OBS 16 · ACT V — THE INTERNET, 1969–2025. The other launch.
//   101.1  "LO" crosses from Los Angeles to Menlo Park; the G never arrives
//   102.1  the four nodes of December 1969; then the network doubles on every downbeat
//          while packets fly on 16ths. A message splits into packets that take
//          different routes and reassemble.
//   104.1  four protocol layers slide in and lock: one language for every network
//   105.1  the application layer opens into a 1993 browser window
//   107.1  pull back: the globe, wrapped in great circles and undersea cables. ≈ 6 BILLION

import { scene, MATCH } from './common.js';
import { rgba } from '../theme.js';
import { ease, clamp, lerp, sub, span, TAU, mulberry32 } from '../engine.js';
import { stroke, circle, glow, dot, arcPts } from '../draw/paths.js';
import { card, text } from '../draw/type.js';
import { mapView, outline, borders, schematic, CITY } from '../draw/map.js';
import { globe } from '../draw/motif.js';

const V = mapView(100, 330, 860);
const ORIGINAL = [['LAX', 'LOS ANGELES'], ['MLO', 'MENLO PARK'], ['SBA', 'SANTA BARBARA'], ['SLC', 'SALT LAKE CITY']];
const MORE = ['BOS', 'WAS', 'CHI', 'PIT', 'DEN', 'SEA', 'NYC', 'ATL', 'DAL', 'STL', 'MSP', 'PHX', 'MIA', 'DET', 'HOU', 'PDX', 'CLE', 'KNX', 'OKC', 'ABQ', 'MKC', 'BNA', 'CVG', 'RAL', 'BOI', 'OMA', 'IND', 'MEM', 'BUF', 'ELP', 'SAT', 'LIT', 'JAX', 'BIL', 'FAR', 'ALB', 'MSY', 'TUL', 'CHS', 'SDF', 'BHM', 'GEG', 'DSM', 'RNO', 'SFO', 'SAN', 'PVD', 'RIC', 'TPA', 'MKE', 'ICT', 'AMA', 'CYS', 'LAS', 'FSD', 'BIS', 'MGM', 'JAN', 'SHV', 'TLH'];
const NODES = ORIGINAL.map(([c]) => c).concat(MORE).map(c => V.P(...CITY[c]));
// Each node links to its two nearest earlier nodes.
const EDGES = (() => {
  const out = [[0, 1], [0, 2], [1, 3], [2, 1]];
  for (let i = 4; i < NODES.length; i++) {
    const d = NODES.slice(0, i).map((p, j) => [Math.hypot(p[0] - NODES[i][0], p[1] - NODES[i][1]), j]).sort((a, b) => a[0] - b[0]);
    out.push([d[0][1], i], [d[1][1], i]);
  }
  return out;
})();
const countAt = (s, t) => { const n = s.count('nodes'); return t < s.at('2.1') ? 2 : [4, 8, 16, 32, 64][Math.min(4, n - 1)]; };

const LAYERS = ['APPLICATION', 'TRANSPORT', 'INTERNET', 'LINK'];
const STACK = { x: 1390, w: 500, y: [656, 714, 772, 830], h: 50 };

function browser(g, s, p, t) {
  if (p <= 0) return;
  const x0 = STACK.x - 270, x1 = STACK.x + 270, y1 = STACK.y[0] + STACK.h / 2, y0 = lerp(y1 - STACK.h, 350, ease.out(p));
  const P = (al, w = 1.6, c = 'GOLD') => ({ color: c, alpha: al, width: w });
  stroke(g, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], 1, { pen: P(1, 2.2, 'GOLD_HOT'), closed: true, tip: false });
  const q = sub(p, 0.4, 1);
  if (q <= 0) return;
  stroke(g, [[x0, y0 + 30], [x1, y0 + 30]], q, { pen: P(0.8), tip: false });
  stroke(g, [[x0, y0 + 74], [x1, y0 + 74]], q, { pen: P(0.6, 1), tip: false });
  // back and forward, the address field, a spinning globe where a logo would be
  stroke(g, [[x0 + 30, y0 + 52], [x0 + 18, y0 + 52], [x0 + 24, y0 + 45]], q, { pen: P(0.9), tip: false });
  stroke(g, [[x0 + 44, y0 + 52], [x0 + 56, y0 + 52], [x0 + 50, y0 + 45]], q, { pen: P(0.9), tip: false });
  stroke(g, [[x0 + 74, y0 + 40], [x1 - 70, y0 + 40], [x1 - 70, y0 + 64], [x0 + 74, y0 + 64]], q, { pen: P(0.8, 1.2), closed: true, tip: false });
  text(s.ui, 'http://', x0 + 86, y0 + 53, { voice: 'data', size: 24, align: 'left', alpha: 0.85 * q, scale: s.S });
  circle(g, x1 - 38, y0 + 52, 13, q, { pen: P(0.9, 1.2, 'GOLD_HOT'), tip: false });
  stroke(g, arcPts(x1 - 38, y0 + 52, 13, -Math.PI / 2, Math.PI / 2, 12).map(([x, y]) => [x1 - 38 + (x - x1 + 38) * Math.cos(t * 3), y]), q, { pen: P(0.8, 1), tip: false });
  // The page: a heading, an image, text and two links
  const cy = y0 + 104;
  if (y1 - cy > 60) {
    stroke(g, [[x0 + 30, cy], [x0 + 260, cy]], q, { pen: P(1, 5, 'GOLD_HOT'), tip: false });
    const ib = [[x0 + 30, cy + 26], [x0 + 200, cy + 26], [x0 + 200, cy + 136], [x0 + 30, cy + 136]];
    stroke(g, ib, q, { pen: P(0.8, 1.2), closed: true, tip: false });
    stroke(g, [ib[0], ib[2]], q, { pen: P(0.4, 1), tip: false });
    stroke(g, [ib[1], ib[3]], q, { pen: P(0.4, 1), tip: false });
    for (let i = 0; i < 6; i++) {
      const y = cy + 34 + i * 20, w = i === 2 || i === 4 ? 120 : 270 - (i * 37) % 80;
      stroke(g, [[x0 + 226, y], [x0 + 226 + w, y]], sub(q, i * 0.08, 0.5 + i * 0.08), { pen: P(i === 2 || i === 4 ? 1 : 0.55, i === 2 || i === 4 ? 2 : 1.4, i === 2 || i === 4 ? 'GOLD_HOT' : 'GOLD'), tip: false });
      if (i === 2 || i === 4) stroke(g, [[x0 + 226, y + 6], [x0 + 346, y + 6]], q, { pen: P(0.9, 1, 'GOLD_HOT'), tip: false });
    }
  }
}

export default scene('16_internet', {
  camera(s) {
    const t = s.t;
    // Start in California; pull back as the network doubles.
    const ca = V.P(-120.5, 35.6), mid = [960, 540];
    const e1 = span(t, 1.9, 2.7, ease.inOut), e2 = span(t, 3.8, 5.2, ease.inOut);
    const z = Math.exp(lerp(lerp(Math.log(3.2), Math.log(1.9), e1), 0, e2));
    const fx = lerp(lerp(ca[0], ca[0] + 60, e1), mid[0], e2), fy = lerp(lerp(ca[1], ca[1] - 30, e1), mid[1], e2);
    return { x: fx, y: fy, zoom: z };
  },

  draw(ctx, s) {
    const t = s.t, z = s.cam.zoom, lw = 1 / z;
    s.bloom = 0.48;
    const mapA = 1 - span(t, 12.0, 12.6);
    if (mapA > 0) {
      outline(ctx, V, span(t, 0, 0.5) * mapA, { pen: { color: 'GOLD', alpha: 0.4 * mapA, width: 1.3 * lw }, tip: false });
      borders(ctx, V, mapA, { pen: { color: 'GOLD', alpha: 0.1 * mapA, width: lw } });
      if (z < 1.2) schematic(s, V, mapA * span(t, 5.2, 5.6));
      // The network: nodes and links appear as it doubles.
      const n = countAt(s, t), hit = s.count('nodes') > 0 ? s.hits('nodes')[s.count('nodes') - 1].t0 : 0;
      const grow = clamp((t - hit) / 0.5);
      EDGES.forEach(([a, b]) => {
        if (b >= n) return;
        const fresh = b >= n / 2 && n > 2 ? ease.out(grow) : 1;
        stroke(ctx, [NODES[a], [lerp(NODES[a][0], NODES[b][0], fresh), lerp(NODES[a][1], NODES[b][1], fresh)]], 1, { pen: { color: 'GOLD', alpha: 0.55 * mapA, width: 1.3 * lw }, tip: false });
      });
      for (let i = 0; i < n; i++) {
        const fresh = i >= n / 2 && n > 2 ? ease.expoOut(grow) : 1;
        dot(ctx, NODES[i][0], NODES[i][1], (i < 4 ? 5 : 3.4) * lw * fresh, 'GOLD_HOT', mapA);
        if (i < 4) circle(ctx, NODES[i][0], NODES[i][1], 11 * lw, 1, { pen: { color: 'GOLD_HOT', alpha: 0.8 * mapA, width: 1.4 * lw }, tip: false });
        if (fresh < 1) glow(ctx, NODES[i][0], NODES[i][1], 24 * lw, 'GOLD_HOT', 0.6 * (1 - fresh) * mapA);
      }
      // Packets: one per 16th, each racing along a link of the network as it stands
      const R = mulberry32(1969);
      s.hits('packets').forEach(h => {
        const pick = R(), dir = R() < 0.5;
        const age = t - h.t0;
        if (age < 0 || age > 0.45) return;
        const live = EDGES.filter(([, b]) => b < countAt(s, h.t0));
        const [a, b] = live[Math.floor(pick * live.length)];
        const A = NODES[dir ? a : b], B = NODES[dir ? b : a], u = ease.inOut(age / 0.45);
        const x = lerp(A[0], B[0], u), y = lerp(A[1], B[1], u);
        stroke(ctx, [[lerp(A[0], B[0], Math.max(0, u - 0.18)), lerp(A[1], B[1], Math.max(0, u - 0.18))], [x, y]], 1, { pen: { color: 'GOLD_HOT', alpha: 0.9 * mapA, width: 2 * lw }, tip: false });
        dot(ctx, x, y, 2.6 * lw, 'WHITE', mapA);
      });
      // LO: two letters cross, the third breaks
      const L0 = NODES[0], L1 = NODES[1];
      for (const [i, ch] of [[0, 'L'], [1, 'O']]) {
        const u = span(t, 0.1 + i * 0.5, 0.75 + i * 0.5, ease.inOut);
        if (u <= 0 || t > 3.2) continue;
        const x = lerp(L0[0], L1[0], u), y = lerp(L0[1], L1[1], u);
        s.screen(() => {
          const [sx, sy] = s.project(x, y);
          stroke(ctx, [[sx - 20, sy - 20], [sx + 20, sy - 20], [sx + 20, sy + 20], [sx - 20, sy + 20]], 1, { pen: { color: 'GOLD_HOT', alpha: 1, width: 2 }, closed: true, tip: false });
          text(s.ui, ch, sx, sy, { voice: 'dataBold', size: 28, alpha: 1, scale: s.S });
        });
      }
      stroke(ctx, [L0, L1], span(t, 0.05, 0.4), { pen: { color: 'GOLD_HOT', alpha: 0.9 * mapA, width: 1.8 * lw }, tip: false });
      const crash = span(t, 1.15, 1.35);
      if (crash > 0 && t < 2.2) {
        const x = lerp(L0[0], L1[0], 0.35), y = lerp(L0[1], L1[1], 0.35);
        s.screen(() => {
          const [sx, sy] = s.project(x, y), k = 16 * crash;
          stroke(ctx, [[sx - k, sy - k], [sx + k, sy + k]], 1, { pen: { color: 'GOLD', alpha: 0.9 * (1 - span(t, 1.8, 2.2)), width: 3 }, tip: false });
          stroke(ctx, [[sx + k, sy - k], [sx - k, sy + k]], 1, { pen: { color: 'GOLD', alpha: 0.9 * (1 - span(t, 1.8, 2.2)), width: 3 }, tip: false });
        });
      }
      // The original four, named
      if (t < 5.6) s.screen(() => ORIGINAL.forEach(([, name], i) => {
        if (i >= countAt(s, t)) return;
        const [sx, sy] = s.project(...NODES[i]);
        const dx = [-1, 1, -1, 1][i];
        text(s.ui, name, sx + dx * 22, sy + [20, -18, -20, -18][i], { voice: 'marker', size: 24, align: dx < 0 ? 'right' : 'left', alpha: 0.85 * (1 - span(t, 5.0, 5.5)) * clamp((t - (i < 2 ? 0 : 2)) / 0.4), scale: s.S });
      }));
      // Packet switching: one message, four routes, reassembled
      const ps = span(t, 4.2, 6.2, ease.linear);
      if (ps > 0 && ps < 1) {
        const A = V.P(...CITY.LAX), B = V.P(...CITY.NYC), vias = ['SLC', 'DEN', 'DAL', 'CHI'].map(c => V.P(...CITY[c]));
        vias.forEach((m, i) => {
          const u = clamp((ps - i * 0.06) / 0.8), route = [A, m, B];
          const f = u * 2, seg = Math.min(1, Math.floor(f)), w = f - seg;
          const P0 = route[seg], P1 = route[seg + 1];
          const x = lerp(P0[0], P1[0], w), y = lerp(P0[1], P1[1], w);
          if (u < 1) { stroke(ctx, route, 1, { pen: { color: 'GOLD_HOT', alpha: 0.35, width: lw }, tip: false, dash: [3 * lw, 4 * lw] }); s.screen(() => { const [sx, sy] = s.project(x, y); stroke(ctx, [[sx - 7, sy - 7], [sx + 7, sy - 7], [sx + 7, sy + 7], [sx - 7, sy + 7]], 1, { pen: { color: 'GOLD_HOT', alpha: 1, width: 2 }, closed: true, tip: false }); }); }
        });
        if (ps > 0.86) s.screen(() => { const [sx, sy] = s.project(...B); stroke(ctx, [[sx - 16, sy - 16], [sx + 16, sy - 16], [sx + 16, sy + 16], [sx - 16, sy + 16]], 1, { pen: { color: 'GOLD_HOT', alpha: 1, width: 2.4 }, closed: true, tip: false }); glow(ctx, sx, sy, 40, 'GOLD_HOT', 0.6); });
      }
    }

    // The protocol stack locks; its application layer opens into a browser.
    const sk = s.cue('stack', ease.inOut);
    const stA = 1 - span(t, 12.0, 12.5);
    if (sk > 0 && stA > 0) {
      LAYERS.forEach((name, i) => {
        const q = ease.expoOut(sub(sk, i * 0.15, 0.55 + i * 0.15));
        if (q <= 0) return;
        const from = (i % 2 ? 1 : -1) * 700 * (1 - q);
        const x = STACK.x + from, y = STACK.y[3 - i];
        if (i === 3 && s.cue('browser') > 0) return;
        stroke(ctx, [[x - STACK.w / 2, y - STACK.h / 2], [x + STACK.w / 2, y - STACK.h / 2], [x + STACK.w / 2, y + STACK.h / 2], [x - STACK.w / 2, y + STACK.h / 2]], 1, { pen: { color: q >= 1 ? 'GOLD_HOT' : 'GOLD', alpha: stA, width: 2 }, closed: true, tip: false });
        text(s.ui, LAYERS[3 - i], x, y, { voice: 'marker', size: 24, alpha: 0.9 * stA * q, scale: s.S });
      });
      if (sk >= 1) { const lock = Math.exp(-(t - s.at('4.3')) / 0.2); if (lock > 0.02 && t > s.at('4.3')) glow(ctx, STACK.x, 740, 300, 'GOLD_HOT', 0.25 * lock); }
      ctx.globalAlpha = stA; s.ui.globalAlpha = stA;
      browser(ctx, s, s.cue('browser', ease.inOut), t);
      ctx.globalAlpha = 1; s.ui.globalAlpha = 1;
    }

    // The globe, wrapped in great circles and undersea cables
    const gl = s.env('7.1', '7.4', ease.inOut);
    if (gl > 0) {
      const { cx, cy, r } = MATCH;
      globe(ctx, cx, cy, r, gl, t * 0.18, { tilt: 0.35, sym: true });
      const R2 = mulberry32(2025);
      for (let k = 0; k < 9; k++) {
        const tilt = (R2() - 0.5) * 1.6, b = 0.15 + R2() * 0.6, a0 = R2() * TAU, len = 1.2 + R2() * 2.2;
        const q = sub(gl, 0.25 + k * 0.05, 0.7 + k * 0.05), pts = [];
        for (let i = 0; i <= 50; i++) {
          const a = a0 + (i / 50) * len, x = Math.cos(a) * r * 1.0, y = Math.sin(a) * r * b;
          pts.push([cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)]);
        }
        stroke(ctx, pts, q, { pen: { color: k % 3 ? 'GOLD' : 'GOLD_HOT', alpha: 0.75, width: k % 3 ? 1.2 : 1.8 }, tip: q < 1 });
        if (q >= 1) { const u = (t * 0.35 + k * 0.13) % 1, p = pts[Math.floor(u * 50)]; dot(ctx, p[0], p[1], 2.5, 'WHITE', 1); glow(ctx, p[0], p[1], 12, 'GOLD_HOT', 0.6); }
      }
    }
    const online = 6 * ease.out(span(t, 12.2, 14.4, ease.linear));
    s.screen(() => {
      card(s, 'card_launch', { x: 960, y: 196, size: 100 });
      card(s, 'data_lo', { x: 960, y: 284, size: 30, voice: 'dataBold' });
      card(s, 'card_language', { lines: ['ONE LANGUAGE FOR', 'EVERY NETWORK'], x: 960, y: 234, size: 100 });
      card(s, 'data_1983', { x: STACK.x, y: 900, size: 28, voice: 'dataBold' });
      card(s, 'card_world', { x: 960, y: 196, size: 100 });
      card(s, 'data_online', { x: 960, y: 880, size: 32, voice: 'dataBold', text: online >= 5.995 ? '≈ 6 BILLION ONLINE' : `≈ ${online.toFixed(1)} BILLION ONLINE` });
    });
  },
});
