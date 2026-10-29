// OBS 20 · ACT V — 250, 1776–2026.
//   129.1  the timeline ruler rises to the centre of the screen; the cursor holds on 2026
//   129.3  every event dot lights at once: the constellation of achievements
//   130.1  the numerals 250 grow up out of the ruler as its own ticks; starbursts
//   131.1  Artemis II's free-return loop around the Moon; the distance ticker passes
//          Apollo 13's record and stops at 252,756 MI

import { scene } from './common.js';
import { ease, clamp, lerp, sub, span, TAU } from '../engine.js';
import { stroke, circle, glow, dot } from '../draw/paths.js';
import { card, text, engraved, cardEnvelope } from '../draw/type.js';
import { globe } from '../draw/motif.js';

const RISE_Y = 600;
const EARTH = { x: 400, y: 660, r: 78 }, MOON = { x: 1380, y: 640, r: 44 };
// The free-return figure eight: out to the Moon's near side, around its far side, and
// home across the outbound leg. Cubic legs meet the far-side loop on its tangents.
const bez = (p0, p1, p2, p3, n) => Array.from({ length: n + 1 }, (_, i) => {
  const u = i / n, v = 1 - u;
  return [0, 1].map(k => v * v * v * p0[k] + 3 * v * v * u * p1[k] + 3 * v * u * u * p2[k] + u * u * u * p3[k]);
});
const PATH = (() => {
  const RL = 96, A0 = 2.35;
  const at = a => [MOON.x + Math.cos(a) * RL, MOON.y + Math.sin(a) * RL];
  const P1 = at(A0), P2 = at(-A0);
  const out = bez([EARTH.x + 56, EARTH.y - 56], [760, 470], [P1[0] - 150, P1[1] + 150], P1, 120);
  const loop = Array.from({ length: 61 }, (_, i) => at(A0 - (i / 60) * 2 * A0)).slice(1);
  const back = bez(P2, [P2[0] - 150, P2[1] + 150], [760, 830], [EARTH.x + 66, EARTH.y + 44], 120).slice(1);
  return out.concat(loop, back);
})();
const MAX_U = 150 / (PATH.length - 1); // the far side of the loop, where the distance peaks

const BURSTS = [[520, 360, 0], [1400, 360, 1], [EARTH.x, EARTH.y, 2]]; // the last one marks the launch

export default scene('20_250', {
  camera: s => ({ x: 960, y: 540, zoom: 1 + 0.02 * span(s.t, 0, 8) }),

  draw(ctx, s) {
    const t = s.t;
    s.bloom = 0.5;
    // The ruler rises, every dot lights, and the ruler later returns to its place.
    const lift = s.cue('ruler_rises', ease.inOut) * (1 - span(t, 4.0, 4.8, ease.inOut));
    const dots = s.cue('all_dots', ease.out) * (1 - span(t, 4.0, 4.8));
    s.hud = { rulerLift: lift, rulerY: RISE_Y, allDots: dots };

    // 250, built from the ruler's own ticks: vertical hatching that grows up out of it
    const c = s.cardOf('card_250');
    const env = cardEnvelope(t, c.in, c.out, 0);
    if (env.visible) {
      const grow = span(t, c.in, c.in + 1.2, ease.inOut);
      const top = lerp(RISE_Y, 120, grow);
      ctx.save();
      ctx.beginPath(); ctx.rect(0, top, 1920, RISE_Y - top - 6); ctx.clip();
      engraved(ctx, '250', 960, 392 + env.drift, { size: 520, alpha: env.alpha, vertical: true, gap: 6, fillAlpha: 0.95, outline: 2.4, fact: 'structural:anniversary', scale: s.S });
      ctx.restore();
      // The tick tips glow as they climb.
      if (grow < 1) for (let x = 560; x <= 1360; x += 6) glow(ctx, x, top, 8, 'GOLD_HOT', 0.12);
    }
    card(s, 'card_250', { text: 'YEARS.', x: 960, y: 716, size: 110 });

    // Geometric starbursts on the downbeats
    s.hits('starbursts').forEach((h, k) => {
      const age = t - h.t0;
      if (age < 0 || age > 2.0) return;
      const [x, y] = BURSTS[k], e = ease.expoOut(clamp(age / 0.6)), fade = 1 - clamp((age - 0.6) / 1.4);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU + k * 0.2, r0 = 14 + 30 * e, r1 = r0 + (i % 2 ? 60 : 110) * e;
        stroke(ctx, [[x + Math.cos(a) * r0, y + Math.sin(a) * r0], [x + Math.cos(a) * r1, y + Math.sin(a) * r1]], 1, { pen: { color: i % 2 ? 'GOLD' : 'GOLD_HOT', alpha: fade, width: i % 2 ? 1.2 : 2 }, tip: false });
      }
      circle(ctx, x, y, 40 * e, 1, { pen: { color: 'GOLD_HOT', alpha: 0.8 * fade, width: 1.6 }, tip: false });
      glow(ctx, x, y, 60 * e, 'GOLD_HOT', 0.5 * fade);
    });

    // Artemis II: the free return around the Moon, with the distance ticker
    const ap = s.env('3.1', 'end');
    if (ap > 0) {
      const da = span(t, 4.2, 4.8);
      globe(ctx, EARTH.x, EARTH.y, EARTH.r, da, t * 0.2, { tilt: 0.35, sym: true, night: 0.7, sun: 0.4, phase: 0.1 });
      circle(ctx, MOON.x, MOON.y, MOON.r, da, { pen: { color: 'GOLD_HOT', alpha: 1, width: 2 }, tip: false });
      for (let i = 0; i < 5; i++) circle(ctx, MOON.x + (i - 2) * 14, MOON.y + ((i * 7) % 5 - 2) * 9, 4 + (i % 3), da, { pen: { color: 'GOLD', alpha: 0.6, width: 1 }, tip: false });
      const fly = span(t, 4.4, 7.2, ease.inOut);
      const n = Math.max(2, Math.floor(fly * (PATH.length - 1)));
      stroke(ctx, PATH.slice(0, n + 1), 1, { pen: { color: 'GOLD_HOT', alpha: 0.9, width: 2.2 }, tip: false });
      stroke(ctx, PATH, da, { pen: { color: 'GOLD', alpha: 0.25, width: 1 }, tip: false, dash: [4, 8] });
      const head = PATH[n];
      glow(ctx, head[0], head[1], 30, 'GOLD_HOT', 0.8); dot(ctx, head[0], head[1], 4, 'WHITE', 1);
      // Distance from Earth: climbs to the far point, then holds the record.
      const u = n / (PATH.length - 1);
      const miles = Math.round(252756 * ease.out(clamp(u / MAX_U)));
      const ta = span(t, 4.4, 4.8);
      text(s.ui, 'DISTANCE FROM EARTH', MOON.x, 396, { voice: 'marker', size: 24, alpha: 0.85 * ta, scale: s.S });
      text(s.ui, `${String(miles).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} MI`, MOON.x, 434, { voice: 'dataBold', size: 32, alpha: ta, fact: 'artemis2_distance', scale: s.S, color: miles >= 248655 ? 'GOLD_HOT' : 'GOLD' });
      if (miles >= 248655) {
        text(s.ui, 'APOLLO 13 · 248,655 MI', MOON.x, 472, { voice: 'data', size: 24, alpha: 0.85 * clamp((t - recordAt()) / 0.3), fact: 'apollo13_distance', scale: s.S });
      }
    }
    s.screen(() => {
      card(s, 'card_farther', { lines: ['FARTHER THAN ANY', 'HUMANS, EVER.'], x: 960, y: 234, size: 100 });
      card(s, 'data_artemis', { x: 960, y: 880, size: 30, voice: 'dataBold' });
    });
  },
});

/** Local time at which the ticker passes Apollo 13's record (solved once, cached). */
let recordCache = null;
function recordAt() {
  if (recordCache != null) return recordCache;
  for (let tt = 4.4; tt < 8; tt += 0.005) {
    const fly = ease.inOut(clamp((tt - 4.4) / 2.8)), u = Math.max(2, Math.floor(fly * (PATH.length - 1))) / (PATH.length - 1);
    if (252756 * ease.out(clamp(u / MAX_U)) >= 248655) { recordCache = tt; break; }
  }
  return recordCache ?? 6;
}

