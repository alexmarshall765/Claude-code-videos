// The torch: construction lines first, then the form, then a flame of layered
// Bézier tongues flickering on seeded noise.

import { rgba } from '../theme.js';
import { sub, lerp, noise1, clamp } from '../engine.js';
import { stroke, bezierPts, ellipsePts, glow, circle } from './paths.js';

/** Flame tongues above the cup rim at (cx, cy). k = 0..1 ignition, t = time for flicker. */
export function flame(g, cx, cy, s, k, t, seed = 3) {
  if (k <= 0) return;
  glow(g, cx, cy - 80 * s * k, 190 * s * k, 'GOLD_HOT', 0.22 * k);
  const tongues = [[56, 218, 'GOLD', 2.6, 0.95], [38, 160, 'GOLD_HOT', 2.2, 1], [21, 104, 'GOLD_HOT', 1.7, 1]];
  tongues.forEach(([w0, h0, color, width, a], j) => {
    const w = w0 * s * (0.55 + 0.45 * k);
    const h = h0 * s * k * (1 + 0.07 * noise1(t * 2.3, seed + j * 11));
    const tx = (noise1(t * 1.4, seed + j * 5) * 12 + noise1(t * 3.6, seed + 40 + j) * 5) * s;
    const lean = noise1(t * 0.9, seed + 77 + j) * 0.18;
    const b = cy - 4 * s;
    const left = bezierPts([cx - w, b], [cx - w * 1.4, b - h * 0.42], [cx + tx - w * (0.3 + lean), b - h * 0.8], [cx + tx, b - h], 26);
    const right = bezierPts([cx + tx, b - h], [cx + tx + w * (0.3 - lean), b - h * 0.76], [cx + w * 1.35, b - h * 0.4], [cx + w, b], 26);
    stroke(g, left.concat(right), clamp(k * 1.6 - j * 0.2), { pen: { color, alpha: a, width: width * Math.max(0.8, s) }, tip: false });
  });
  // A thin inner wisp that licks upward
  const wisp = bezierPts([cx - 4 * s, cy - 10 * s], [cx - 14 * s, cy - 60 * s * k], [cx + noise1(t * 2.7, seed + 9) * 16 * s, cy - 90 * s * k], [cx + noise1(t * 1.9, seed + 3) * 10 * s, cy - 132 * s * k], 20);
  stroke(g, wisp, clamp(k * 1.3 - 0.3), { pen: { color: 'GOLD_HOT', alpha: 0.7, width: 1.2 }, tip: false });
}

/**
 * The torch, anchored at the centre of the cup rim. p draws it on (construction,
 * then form, then the construction fades to 20 %); fl lights the flame.
 */
export function torch(g, cx, cy, s, p, t, fl = 0, o = {}) {
  const M = (x, y) => [cx + x * s, cy + y * s];
  const hw = y => 15 + ((230 - y) / 170) * 10;
  // Construction: axis, cup circle, handle taper guides.
  const cIn = sub(p, 0, 0.18), cFade = 1 - 0.8 * sub(p, 0.75, 1);
  const C = { color: 'GOLD', alpha: 0.25 * cFade, width: 1 };
  stroke(g, [M(0, 275), M(0, -250)], cIn, { pen: C, tip: false, dash: [6, 6] });
  circle(g, ...M(0, -20), 70 * s, sub(p, 0.05, 0.25), { pen: C, tip: false });
  stroke(g, [M(-30, 60), M(-14, 236)], sub(p, 0.08, 0.22), { pen: C, tip: false });
  stroke(g, [M(30, 60), M(14, 236)], sub(p, 0.08, 0.22), { pen: C, tip: false });
  // Form
  const S = { color: 'GOLD', alpha: 1, width: 2.4 };
  stroke(g, [M(-14, 230), M(14, 230), M(24, 60), M(-24, 60)], sub(p, 0.18, 0.42), { pen: S, closed: true });
  [200, 168, 132, 96].forEach((y, i) => stroke(g, [M(-hw(y), y), M(hw(y), y)], sub(p, 0.3 + i * 0.03, 0.42 + i * 0.03), { pen: { color: 'GOLD', alpha: 0.75, width: 1.4 }, tip: false }));
  circle(g, ...M(0, 246), 15 * s, sub(p, 0.32, 0.44), { pen: S, tip: false });
  stroke(g, [M(-34, 40), M(34, 40), M(34, 60), M(-34, 60)], sub(p, 0.4, 0.52), { pen: S, closed: true });
  stroke(g, [M(-34, 40), M(34, 40), M(66, -20), M(-66, -20)], sub(p, 0.48, 0.66), { pen: { color: 'GOLD_HOT', alpha: 1, width: 2.8 }, closed: true });
  for (let f = -3; f <= 3; f++) stroke(g, [M(f * 10, 40), M(f * 19.5, -20)], sub(p, 0.56 + (f + 3) * 0.012, 0.7 + (f + 3) * 0.012), { pen: { color: 'GOLD', alpha: 0.6, width: 1.1 }, tip: false });
  stroke(g, ellipsePts(cx, cy - 20 * s, 66 * s, 12 * s, 0, Math.PI, Math.PI * 3, 64), sub(p, 0.62, 0.8), { pen: { color: 'GOLD_HOT', alpha: 1, width: 2.4 }, tip: false });
  if (o.engrave !== false) {
    // Engraved shading on the left of the handle and cup
    const hq = sub(p, 0.7, 0.95);
    if (hq > 0) {
      g.strokeStyle = rgba('GOLD', 0.35 * hq); g.lineWidth = 1;
      g.beginPath();
      for (let y = 66; y < 226; y += 7) { const x0 = -hw(y) * 0.95, x1 = x0 + 8; g.moveTo(...M(x0, y)); g.lineTo(...M(x1, y - 4)); }
      for (let y = -14; y < 36; y += 6) { const f = (40 - y) / 60, x0 = -lerp(34, 66, f) * 0.95; g.moveTo(...M(x0, y)); g.lineTo(...M(x0 + 12, y - 5)); }
      g.stroke();
    }
  }
  flame(g, cx, cy - 22 * s, s, fl, t, o.seed ?? 3);
}

