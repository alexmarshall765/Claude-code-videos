// OBS 07 · ACT II — LIBERTY EXTENDED, 1863–1965. The breakdown.
//   37.1  ALL MEN ARE CREATED EQUAL returns from OBS 03, centred, written again by the pen
//   38.1–43.1  a ring ripples out from it on every downbeat, stamped with its date:
//         1865 · XIII, 1868 · XIV, 1870 · XV, 1920 · XIX, 1964 · CIVIL RIGHTS ACT,
//         1965 · VOTING RIGHTS ACT (the bell rings the next note of the theme)
//   43–44 the riser; the rings outgrow the frame and the cursor springs back to 1869

import { scene, zoomAbout } from './common.js';
import { rgba } from '../theme.js';
import { ease, clamp, lerp, span, TAU } from '../engine.js';
import { stroke, circle, glow, penTip } from '../draw/paths.js';
import { card, text, textWidth } from '../draw/type.js';

const C = [960, 640];
const LINE = 'ALL MEN ARE CREATED EQUAL';
const RINGS = [
  { label: '1865 · XIII', r: 280, th: -0.2 },
  { label: '1868 · XIV', r: 340, th: Math.PI + 0.2 },
  { label: '1870 · XV', r: 400, th: 0 },
  { label: '1920 · XIX', r: 460, th: Math.PI },
  { label: '1964 · CIVIL RIGHTS ACT', r: 520, th: 0.2 },
  { label: '1965 · VOTING RIGHTS ACT', r: 580, th: Math.PI - 0.2 },
];

export default scene('07_liberty', {
  camera: s => zoomAbout(C[0], C[1], 1 + 0.04 * span(s.t, 0, 16, ease.sineInOut)),

  draw(ctx, s) {
    const t = s.t;
    s.bloom = 0.48;
    const riser = s.env('7.1', 'end', ease.in);
    const out = span(t, s.at('8.3'), 16.4, ease.in);
    const grow = 1 + 0.9 * out;

    // The line returns, written by the pen, then ruled.
    const w = textWidth(s.ui, LINE, { voice: 'dataBold', size: 32 });
    const wr = s.cue('equal_returns', ease.inOut);
    const lineA = 1 - 0.7 * out;
    text(s.ui, LINE, C[0], C[1], { voice: 'dataBold', size: 32, alpha: lineA, scale: s.S, mask: wr, color: 'GOLD_HOT' });
    if (wr > 0 && wr < 1) penTip(ctx, C[0] - w / 2 - 32 + (w + 64) * wr, C[1] + 10, 1.2);
    stroke(ctx, [[C[0] - w / 2, C[1] + 30], [C[0] + w / 2, C[1] + 30]], span(t, 1.2, 2.0, ease.inOut), { pen: { color: 'GOLD', alpha: 0.7 * lineA, width: 1.2 } });
    glow(ctx, C[0], C[1], 300, 'GOLD_HOT', (0.08 + 0.1 * riser) * wr);

    // Rings ripple out from the line, one per downbeat, each stamped with its date.
    s.hits('rings').forEach((h, k) => {
      if (t < h.t0) return;
      const R = RINGS[k], age = t - h.t0;
      const e = ease.expoOut(clamp(age / 1.4));
      const r = lerp(w / 2 + 20, R.r, e) * grow;
      const front = Math.exp(-age / 0.5);
      circle(ctx, C[0], C[1], r, 1, { pen: { color: front > 0.25 ? 'GOLD_HOT' : 'GOLD', alpha: 0.75 + 0.25 * front + 0.2 * riser, width: 1.5 + 2.5 * front }, tip: false });
      // A fainter echo trails each wave.
      if (age < 2.5) circle(ctx, C[0], C[1], r * (1 - 0.06 * (1 - e)) - 14 * (1 - e), 1, { pen: { color: 'GOLD', alpha: 0.3 * (1 - age / 2.5), width: 1 }, tip: false });
      // Degree ticks on the ring, turning slowly
      ctx.strokeStyle = rgba('GOLD', 0.35 * e); ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * TAU + (k % 2 ? -1 : 1) * t * 0.03;
        ctx.moveTo(C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r);
        ctx.lineTo(C[0] + Math.cos(a) * (r + (i % 6 ? 4 : 9)), C[1] + Math.sin(a) * (r + (i % 6 ? 4 : 9)));
      }
      ctx.stroke();
      // The date stamp rides the ring.
      const la = ease.out(clamp((age - 0.25) / 0.4)) * (1 - span(t, 15.0, 15.5));
      if (la > 0) {
        const x = C[0] + Math.cos(R.th) * r, y = C[1] + Math.sin(R.th) * r;
        const lw = textWidth(s.ui, R.label, { voice: 'data', size: 26 });
        s.ui.fillStyle = rgba('INK', 0.85 * la);
        s.ui.fillRect(x - lw / 2 - 12, y - 20, lw + 24, 40);
        stroke(s.ui, [[x - lw / 2 - 12, y - 20], [x + lw / 2 + 12, y - 20], [x + lw / 2 + 12, y + 20], [x - lw / 2 - 12, y + 20]], 1, { pen: { color: 'GOLD', alpha: 0.6 * la, width: 1 }, closed: true, tip: false });
        text(s.ui, R.label, x, y, { voice: front > 0.3 ? 'dataBold' : 'data', size: 26, alpha: la, fact: 'amendments', scale: s.S, color: front > 0.3 ? 'GOLD_HOT' : 'GOLD' });
        if (front > 0.05) glow(ctx, x, y, 60, 'GOLD_HOT', 0.4 * front);
      }
    });

    s.screen(() => {
      card(s, 'card_birth', { x: 960, y: 418, size: 100 });
      card(s, 'attrib_lincoln', { x: 960, y: 506, size: 26, alpha: 0.85 });
      card(s, 'card_corrects', { lines: ['THE EXPERIMENT', 'CORRECTS ITSELF.'], x: 960, y: 296, size: 100, lineHeight: 108 });
      card(s, 'card_widened', { x: 960, y: 296, size: 100 });
    });
  },
});
