// OBS 12 · ACT IV · THE PROOF — ARSENAL OF DEMOCRACY, 1941–1945. Production, not combat.
// A beat-locked montage: a new wireframe slams in every two beats (16 slams), with
// CRIMSON accents.
//   69–70  a Liberty ship's hull blocks stack from the keel up
//   71–72  it launches, then multiplies into a fleet: 2,710 LIBERTY SHIPS
//   73–74  a four-engine bomber assembles and rolls off the line, a clock hand turning
//          once per bomber: ≈ 300,000 AIRCRAFT
//   75–76  sawtooth factory roofs multiply across the map. WE BUILT IT.

import { scene } from './common.js';
import { rgba } from '../theme.js';
import { ease, clamp, lerp, span, mulberry32 } from '../engine.js';
import { stroke, circle, glow, dot, hatch } from '../draw/paths.js';
import { card } from '../draw/type.js';
import { mapView, outline, borders, schematic, US } from '../draw/map.js';
import { billows } from '../draw/particles.js';

const SLAM = k => k; // slam k lands at k seconds (every half note)
const pop = (t, k) => (t >= SLAM(k) ? ease.expoOut(clamp((t - SLAM(k)) / 0.14)) : 0);
const flashK = (t, k) => (t >= SLAM(k) ? Math.exp(-(t - SLAM(k)) / 0.16) : 0);
const commas = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// --- The Liberty ship, side elevation, bow to the right (px; y up is negative) -------
const L = 900;
const deckY = x => -112 - 14 * ((x - L / 2) / (L / 2)) ** 2;
const HULL = [[34, 0], [866, 0], [900, deckY(900) + 4], [906, deckY(906)]].concat(Array.from({ length: 21 }, (_, i) => { const x = 906 - (i / 20) * 906; return [x, deckY(x)]; })).concat([[0, deckY(0) + 30], [10, -40], [34, 0]]);
const BOTTOM = Array.from({ length: 6 }, (_, i) => [60 + i * 130, 0, 60 + (i + 1) * 130, -50]);
const SIDE = Array.from({ length: 6 }, (_, i) => [60 + i * 130, -50, 60 + (i + 1) * 130, null]);

function ship(g, ox, oy, sc, stage, t, o = {}) {
  const P = ([x, y]) => [ox + x * sc, oy + y * sc];
  const a = o.alpha ?? 1, lw = o.lw ?? 1;
  const pen = (c, al, w) => ({ color: c, alpha: al * a, width: w * lw });
  stroke(g, [P([10, 0]), P([890, 0])], 1, { pen: pen('GOLD_HOT', 1, 2.6), tip: false });
  const block = ([x0, y0, x1, y1], k) => {
    const y1v = y1 ?? Math.min(deckY(x0), deckY(x1));
    const poly = [P([x0, y0]), P([x1, y0]), P([x1, y1v]), P([x0, y1v])];
    const f = o.flash?.(k) ?? 0;
    stroke(g, poly, 1, { pen: pen(f > 0.2 ? 'GOLD_HOT' : 'GOLD', 0.95, 1.4), closed: true, tip: false });
    hatch(g, poly, 1, { angle: Math.PI / 4, gap: Math.max(4, 7 * sc), alpha: 0.3 * a, pen: { color: f > 0.15 ? 'CRIMSON' : 'GOLD', alpha: (0.3 + 0.6 * f) * a, width: lw } });
  };
  if (stage >= 1) BOTTOM.forEach(b => block(b, 1));
  if (stage >= 2) { SIDE.forEach(b => block(b, 2)); stroke(g, HULL.map(P), 1, { pen: pen('GOLD_HOT', 1, 2), tip: false }); }
  if (stage >= 3) {
    const house = [[380, deckY(380)], [530, deckY(530)], [530, -200], [380, -200]];
    stroke(g, house.map(P), 1, { pen: pen('GOLD', 1, 1.6), closed: true, tip: false });
    for (let i = 0; i < 5; i++) stroke(g, [P([395 + i * 26, -180]), P([410 + i * 26, -180])], 1, { pen: pen('GOLD_HOT', 0.9, 2), tip: false });
    stroke(g, [P([470, -200]), P([470, -258]), P([500, -258]), P([500, -200])], 1, { pen: pen('GOLD', 1, 1.6), tip: false });
    for (const [mx, h] of [[190, -300], [660, -290], [790, -250]]) {
      stroke(g, [P([mx, deckY(mx)]), P([mx, h])], 1, { pen: pen('GOLD', 0.95, 1.6), tip: false });
      stroke(g, [P([mx, deckY(mx) - 30]), P([mx + 90, deckY(mx) - 4])], 1, { pen: pen('GOLD', 0.7, 1.1), tip: false });
      stroke(g, [P([mx, deckY(mx) - 30]), P([mx - 90, deckY(mx) - 4])], 1, { pen: pen('GOLD', 0.7, 1.1), tip: false });
    }
  }
}

// --- A four-engine bomber in plan view, nose to the right -----------------------------
function bomber(g, ox, oy, sc, stage, o = {}) {
  const a = o.alpha ?? 1, lw = o.lw ?? 1;
  const P = (x, y) => [ox + x * sc, oy + y * sc];
  const pen = (c, al, w) => ({ color: c, alpha: al * a, width: w * lw });
  if (stage >= 1) {
    stroke(g, [P(-170, -10), P(120, -14), P(160, -8), P(170, 0), P(160, 8), P(120, 14), P(-170, 10)], 1, { pen: pen('GOLD_HOT', 1, 2), closed: true, tip: false });
    stroke(g, [P(30, -260), P(80, -260), P(95, 0), P(80, 260), P(30, 260), P(10, 0)], 1, { pen: pen('GOLD', 1, 1.8), closed: true, tip: false });
    for (let y = -230; y <= 230; y += 46) stroke(g, [P(14 + Math.abs(y) * 0.06, y), P(92 - Math.abs(y) * 0.05, y)], 1, { pen: pen('GOLD', 0.5, 1), tip: false });
  }
  if (stage >= 2) for (const y of [-180, -92, 92, 180]) {
    stroke(g, [P(40, y - 12), P(122, y - 9), P(122, y + 9), P(40, y + 12)], 1, { pen: pen('GOLD', 1, 1.5), closed: true, tip: false });
    stroke(g, [P(126, y - 40), P(126, y + 40)], 1, { pen: pen('GOLD_HOT', 0.95, 2.2), tip: false });
    dot(g, ...P(126, y), 3 * lw, 'GOLD_HOT', a);
  }
  if (stage >= 3) {
    stroke(g, [P(-175, -80), P(-140, -80), P(-130, 0), P(-140, 80), P(-175, 80), P(-168, 0)], 1, { pen: pen('GOLD', 1, 1.6), closed: true, tip: false });
    stroke(g, [P(-180, 0), P(-120, 0)], 1, { pen: pen('GOLD_HOT', 1, 2.4), tip: false });
  }
}

function factory(g, x, y, s, a) {
  const pen = (c, al, w) => ({ color: c, alpha: al * a, width: w });
  stroke(g, [[x - 16 * s, y], [x + 16 * s, y], [x + 16 * s, y - 8 * s], [x - 16 * s, y - 8 * s]], 1, { pen: pen('GOLD', 0.9, 1.1), closed: true, tip: false });
  const roof = [];
  for (let i = 0; i < 4; i++) roof.push([x - 16 * s + i * 8 * s, y - 8 * s], [x - 16 * s + i * 8 * s, y - 16 * s], [x - 8 * s + i * 8 * s, y - 8 * s]);
  stroke(g, roof, 1, { pen: pen('CRIMSON', 1, 1.4), tip: false });
  stroke(g, [[x + 12 * s, y - 8 * s], [x + 12 * s, y - 22 * s]], 1, { pen: pen('GOLD', 0.8, 1), tip: false });
}

const V = mapView(560, 320, 800);
const FACTORIES = (() => {
  const R = mulberry32(1941), out = [];
  const ids = ['26', '39', '18', '17', '55', '42', '36', '34', '06', '53', '48', '20', '29', '27', '24', '51', '37', '13', '01', '47', '21', '19', '41', '08', '40', '22', '09', '25'];
  for (let i = 0; i < 80; i++) {
    const st = US.states[ids[Math.floor(Math.pow(R(), 1.4) * ids.length)]];
    const [cx, cy] = st.c;
    out.push(V.M([cx + (R() - 0.5) * 40, cy + (R() - 0.5) * 26]));
  }
  return out;
})();

export default scene('12_arsenal', {
  camera(s) {
    const t = s.t, k = Math.floor(t);
    const punch = 1 + 0.025 * Math.exp(-(t - k) / 0.12);
    return { x: 960, y: 560, zoom: punch };
  },

  draw(ctx, s) {
    const t = s.t;
    s.bloom = 0.5;
    const k = Math.floor(t);
    s.flash = 0.18 * Math.exp(-(t - k) / 0.1);
    // A CRIMSON frame flashes on every slam.
    const fr = Math.exp(-(t - k) / 0.18);
    s.screen(() => stroke(ctx, [[60, 60], [1860, 60], [1860, 1020], [60, 1020]], 1, { pen: { color: 'CRIMSON', alpha: 0.7 * fr, width: 4 }, closed: true, tip: false }));

    // Sequence A: the hull stacks from the keel up (slams 0–3), launches (4) and multiplies (5–7)
    if (t < 8) {
      const launch = span(t, 4, 4.9, ease.in);
      const shrink = span(t, 5, 5.4, ease.inOut);
      const ox = lerp(510, 290, launch), oy = lerp(760, 820, launch);
      const stage = t < 1 ? 0 : t < 2 ? 1 : t < 3 ? 2 : 3;
      if (shrink < 1) {
        // The building ways, inclined toward the water on the left
        const wa = (1 - launch) * pop(t, 0);
        stroke(ctx, [[400, 790], [1500, 760]], 1, { pen: { color: 'GOLD', alpha: 0.6 * wa, width: 2 }, tip: false });
        for (let x = 430; x < 1500; x += 60) stroke(ctx, [[x, 790 - (x - 400) * 0.027], [x, 900]], 1, { pen: { color: 'GOLD', alpha: 0.25 * wa, width: 1 }, tip: false });
        stroke(ctx, [[120, 860], [430, 860]], 1, { pen: { color: 'GOLD', alpha: 0.5 * pop(t, 0), width: 1.4 }, tip: false });
        ship(ctx, ox, oy, lerp(1, 0.25, shrink) * Math.max(0.001, pop(t, 0)), stage, t, { alpha: 1 - shrink, flash: kk => flashK(t, kk) });
        if (t >= 4.6) billows(ctx, t, { seed: 12, rate: 70, t0: 4.6, t1: 5.1, life: [0.8, 1.6], source: () => [300, 860], dir: -Math.PI / 2, spread: 2.4, speed: 260, rise: 20, r0: 6, grow: 40, alpha: 0.6, scallop: true });
      }
      // The fleet: 1, 4, 16, 64 ships on slams 5–7
      const n = t < 5 ? 0 : t < 6 ? 4 : t < 7 ? 16 : 64;
      if (n > 0) {
        const cols = Math.sqrt(n) * 2, rows = n / cols, w = 1500 / cols, h = Math.min(120, 520 / rows);
        for (let i = 0; i < n; i++) {
          const c = i % cols, r = Math.floor(i / cols);
          const x = 210 + c * w, y = 400 + (r + 0.8) * h;
          const sc = Math.min(w / 1000, h / 340);
          ship(ctx, x, y, sc, 3, t, { lw: 0.8, alpha: pop(t, k) * (i < n / 4 ? 1 : 0.85), flash: () => 0 });
        }
      }
    }
    // Sequence B: the bomber assembles (slams 8–10), then the line rolls (11)
    if (t >= 8 && t < 12) {
      const stage = t < 9 ? 1 : t < 10 ? 2 : 3;
      const roll = span(t, 11, 12, ease.linear);
      if (t < 11) bomber(ctx, 960, 600, 1.15 * pop(t, 8), stage);
      else {
        // The line: bombers nose to tail, one leaving through the door each hour
        for (let i = -1; i < 4; i++) {
          const x = 1260 - i * 390 + roll * 390;
          bomber(ctx, x, 600, 0.68, 3, { alpha: clamp((1700 - x) / 160) });
        }
        stroke(ctx, [[1560, 380], [1560, 820]], 1, { pen: { color: 'CRIMSON', alpha: 0.9, width: 3 }, tip: false });
      }
      // The clock: its hand turns once per bomber
      const cx = 1660, cy = 330, r = 64;
      circle(ctx, cx, cy, r, pop(t, 8), { pen: { color: 'GOLD_HOT', alpha: 0.95, width: 2.2 }, tip: false });
      ctx.strokeStyle = rgba('GOLD', 0.7); ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.lineTo(cx + Math.cos(a) * (r - 10), cy + Math.sin(a) * (r - 10)); }
      ctx.stroke();
      const ha = -Math.PI / 2 + (t - 8) * Math.PI * 2 / 4 + roll * Math.PI * 2;
      stroke(ctx, [[cx, cy], [cx + Math.cos(ha) * (r - 12), cy + Math.sin(ha) * (r - 12)]], 1, { pen: { color: 'CRIMSON', alpha: 1, width: 3 }, tip: false });
      dot(ctx, cx, cy, 4, 'GOLD_HOT', 1);
    }
    // Sequence C: sawtooth roofs multiply across the map (slams 12–15)
    if (t >= 12) {
      const ma = pop(t, 12);
      outline(ctx, V, ma, { pen: { color: 'GOLD', alpha: 0.6, width: 1.4 }, tip: false });
      borders(ctx, V, ma, { pen: { color: 'GOLD', alpha: 0.15, width: 1 } });
      schematic(s, V, ma);
      const n = t < 13 ? 6 : t < 14 ? 18 : t < 15 ? 40 : 80;
      for (let i = 0; i < n; i++) {
        const [x, y] = FACTORIES[i];
        const born = i < 6 ? 12 : i < 18 ? 13 : i < 40 ? 14 : 15;
        factory(ctx, x, y, 0.9, pop(t, born));
        if (t - born < 0.3) glow(ctx, x, y - 8, 20, 'GOLD_HOT', 0.6 * (1 - (t - born) / 0.3));
      }
    }

    // The counters tick on 16ths.
    const q = Math.floor(t * 8) / 8;
    const ships = 2710 * ease.out(span(q, 6, 12, ease.linear));
    const planes = Math.round((300000 * ease.out(span(q, 8, 14, ease.linear))) / 1000) * 1000;
    s.screen(() => {
      card(s, 'card_arsenal', { lines: ['THE GREAT ARSENAL', 'OF DEMOCRACY.'], x: 960, y: 236, size: 100 });
      card(s, 'attrib_fdr', { x: 960, y: 376, size: 26, alpha: 0.85 });
      card(s, 'card_built', { x: 960, y: 196, size: 120 });
      card(s, 'data_ships', { x: 620, y: 900, size: 32, voice: 'dataBold', text: `${commas(ships)} LIBERTY SHIPS` });
      card(s, 'data_aircraft', { x: 1310, y: 900, size: 32, voice: 'dataBold', text: `≈ ${commas(planes)} AIRCRAFT` });
    });
  },
});
