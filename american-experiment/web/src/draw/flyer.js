// The 1903 flying machine as a wireframe, in feet: x runs nose-forward, y up, z along
// the span (40 ft 4 in), with the lower wing's centre at the origin. Drawn either as a
// three-view blueprint (orthographic) or in perspective at any yaw and pitch.

import { TAU, clamp } from '../engine.js';
import { stroke } from './paths.js';

const rect = (x0, x1, y0, y1, z0, z1) => [[x0, y0, z0], [x1, y0, z0], [x1, y1, z1], [x0, y1, z1], [x0, y0, z0]];
const STATIONS = [-19.5, -15, -10.5, -6, -2, 2, 6, 10.5, 15, 19.5];

function wing(y) {
  const out = [{ pts: [[3.25, y, -20.2], [3.25, y, 20.2], [-3.25, y, 20.2], [-3.25, y, -20.2], [3.25, y, -20.2]], w: 1.8 }];
  for (let z = -18; z <= 18; z += 4) {
    const rib = [];
    for (let i = 0; i <= 8; i++) { const x = 3.25 - (i / 8) * 6.5; rib.push([x, y + 0.35 * Math.sin(Math.PI * Math.pow(i / 8, 0.7)), z]); }
    out.push({ pts: rib, w: 1, a: 0.6 });
  }
  return out;
}

/** Parts in assembly order (one per blueprint hit). Each is a list of polylines. */
export const FLYER_PARTS = [
  wing(0),
  wing(6),
  STATIONS.flatMap(z => [{ pts: [[3.0, 0, z], [3.0, 6, z]], w: 1.2 }, { pts: [[-3.0, 0, z], [-3.0, 6, z]], w: 1.2 }]),
  STATIONS.slice(1).flatMap((z, i) => [{ pts: [[3.0, 0, STATIONS[i]], [3.0, 6, z]], w: 0.8, a: 0.45 }, { pts: [[3.0, 6, STATIONS[i]], [3.0, 0, z]], w: 0.8, a: 0.45 }]),
  [{ pts: [[9.5, 1.5, -7.5], [12.25, 1.5, -7.5], [12.25, 1.5, 7.5], [9.5, 1.5, 7.5], [9.5, 1.5, -7.5]], w: 1.6 }],
  [{ pts: [[9.5, 4.5, -7.5], [12.25, 4.5, -7.5], [12.25, 4.5, 7.5], [9.5, 4.5, 7.5], [9.5, 4.5, -7.5]], w: 1.6 }],
  [-2, 2].flatMap(z => [{ pts: [[3.25, 0, z], [9.5, 1.5, z]], w: 1.1 }, { pts: [[3.25, 6, z], [9.5, 4.5, z]], w: 1.1 }, { pts: [[10.8, 1.5, z], [10.8, 4.5, z]], w: 1.1 }]),
  [{ pts: rect(-10.6, -9.0, 0.6, 6.2, -1, -1).map(([x, y]) => [x, y, -1]), w: 1.6 }],
  [{ pts: rect(-10.6, -9.0, 0.6, 6.2, 1, 1).map(([x, y]) => [x, y, 1]), w: 1.6 }],
  [-2, 2].flatMap(z => [{ pts: [[-3.25, 0, z], [-9.0, 0.8, z / 2]], w: 1.1 }, { pts: [[-3.25, 6, z], [-9.0, 6.0, z / 2]], w: 1.1 }]),
  'propL',
  'propR',
  [{ pts: rect(-0.8, 1.0, 0, 1.6, 0.5, 0.5).map(([x, y]) => [x, y, 0.5]), w: 1.4 }, { pts: rect(-0.8, 1.0, 0, 1.6, 2.6, 2.6).map(([x, y]) => [x, y, 2.6]), w: 1.4 }, { pts: [[1.0, 1.6, 0.5], [1.0, 1.6, 2.6]], w: 1 }],
  [-5.5, 5.5].flatMap(z => [{ pts: [[0, 1.3, 1.5], [-3.7, 3.4, z]], w: 0.9, a: 0.7 }, { pts: [[0, 0.9, 1.5], [-3.7, 3.0, z]], w: 0.9, a: 0.7 }]),
  [-2, 2].flatMap(z => [{ pts: [[-6, -1.6, z], [9, -1.6, z], [11.5, -1.0, z], [12.4, 0.2, z]], w: 1.4 }, { pts: [[2.6, 0, z], [2.6, -1.6, z]], w: 1 }, { pts: [[-2.6, 0, z], [-2.6, -1.6, z]], w: 1 }]),
];
const HUB = z => [-3.7, 3.2, z];

/** Project with yaw (about y), pitch (about x) and perspective: returns [sx, sy, depth]. */
export function flyerProjector({ cx, cy, k, yaw = 0, pitch = 0, D = 160, att = 0 }) {
  const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), ca = Math.cos(att), sa = Math.sin(att);
  return ([x0, y0, z]) => {
    // The machine's own pitch attitude first (about the span axis), then the view.
    const x = x0 * ca - y0 * sa, y = x0 * sa + y0 * ca;
    const x1 = x * cyw - z * syw, z1 = x * syw + z * cyw;
    const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
    const f = D / (D + z2);
    return [cx + x1 * k * f, cy - y2 * k * f, z2];
  };
}

/**
 * Draw parts 0..n (fractional progress per part in prog[i]) with projector P.
 * prop: propeller angle; spin (0..1) blends the blades into a disc.
 */
export function flyer(g, P, prog, o = {}) {
  const alpha = o.alpha ?? 1, lw = o.lw ?? 1, prop = o.prop ?? 0, spin = o.spin ?? 0;
  FLYER_PARTS.forEach((part, i) => {
    const q = prog[i] ?? 0;
    if (q <= 0) return;
    if (typeof part === 'string') {
      const z = part === 'propL' ? -5.5 : 5.5, h = HUB(z);
      for (const sgn of [1, -1]) {
        const a = prop + (sgn > 0 ? 0 : Math.PI) + (z > 0 ? 0.5 : 0);
        const tip = [h[0], h[1] + Math.sin(a) * 4.25 * q, h[2] + Math.cos(a) * 4.25 * q];
        stroke(g, [P(h), P(tip)], 1, { pen: { color: 'GOLD_HOT', alpha: alpha * (1 - 0.6 * spin), width: 2.2 * lw }, tip: false });
      }
      if (spin > 0) {
        const disc = [];
        for (let j = 0; j <= 40; j++) { const a = (j / 40) * TAU; disc.push(P([h[0], h[1] + Math.sin(a) * 4.25, h[2] + Math.cos(a) * 4.25])); }
        stroke(g, disc, 1, { pen: { color: 'GOLD', alpha: 0.45 * spin * alpha, width: 1 * lw }, tip: false });
      }
      return;
    }
    for (const ln of part) {
      const pts = ln.pts.map(P);
      const front = pts.reduce((sum, p) => sum + p[2], 0) / pts.length <= 0;
      stroke(g, pts.map(p => [p[0], p[1]]), clamp(q), { pen: { color: o.color || 'GOLD', alpha: (ln.a ?? 1) * alpha * (o.depthCue && !front ? 0.55 : 1), width: (ln.w ?? 1.2) * lw }, tip: false });
    }
  });
}

/** Orthographic projectors for the three views (plan with the nose up, front, side). */
export const views = {
  plan: (cx, cy, k) => ([x, , z]) => [cx + z * k, cy - x * k, 0],
  front: (cx, cy, k) => ([, y, z]) => [cx + z * k, cy - y * k, 0],
  side: (cx, cy, k) => ([x, y]) => [cx + x * k, cy - y * k, 0],
};
