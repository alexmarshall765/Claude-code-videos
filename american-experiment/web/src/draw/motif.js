// The one recurring shape: the circle. Compass circle → sun disc → gear → wheel →
// globe → Earthrise → torch halo. Every act draws it through these forms.

import { rgba } from '../theme.js';
import { TAU, clamp, sub } from '../engine.js';
import { stroke, circle, arcPts, dot, hatch } from './paths.js';

/** Five-pointed star outline at (x, y). */
export function starPts(x, y, r, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5, rr = i % 2 ? r * 0.42 : r;
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  return pts;
}

/** Positions of the 13 stars around a circle, starting at twelve o'clock. */
export const thirteen = (cx, cy, r, rot = 0) =>
  Array.from({ length: 13 }, (_, k) => { const a = -Math.PI / 2 + rot + (k * TAU) / 13; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, a]; });

/** A drafting compass: needle at (cx, cy), pencil at angle a on radius d. */
export function compassTool(g, cx, cy, d, a, alpha = 1, legLen = 250) {
  if (alpha <= 0) return;
  const px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d;
  const mx = (cx + px) / 2, my = (cy + py) / 2;
  const h = Math.sqrt(Math.max(0, legLen * legLen - (d / 2) * (d / 2)));
  // Hinge sits off the chord, always on the outer side of the sweep.
  const nx = -Math.sin(a), ny = Math.cos(a);
  const hx = mx - nx * h, hy = my - ny * h;
  const P = { color: 'GOLD', alpha: 0.9 * alpha, width: 2.4 };
  stroke(g, [[cx, cy], [hx, hy]], 1, { pen: P, tip: false });
  stroke(g, [[px, py], [hx, hy]], 1, { pen: P, tip: false });
  // Handle and hinge
  const ux = (hx - mx) / (h || 1), uy = (hy - my) / (h || 1);
  stroke(g, [[hx, hy], [hx + ux * 46, hy + uy * 46]], 1, { pen: { color: 'GOLD', alpha: 0.9 * alpha, width: 3.2 }, tip: false });
  g.strokeStyle = rgba('GOLD_HOT', 0.9 * alpha); g.lineWidth = 2;
  g.beginPath(); g.arc(hx, hy, 7, 0, TAU); g.stroke();
  // Knurled grip
  for (let k = 0; k < 4; k++) {
    const q = 14 + k * 8;
    stroke(g, [[hx + ux * q - uy * 5, hy + uy * q + ux * 5], [hx + ux * q + uy * 5, hy + uy * q - ux * 5]], 1, { pen: { color: 'GOLD', alpha: 0.6 * alpha, width: 1.2 }, tip: false });
  }
  dot(g, px, py, 2.6, 'GOLD_HOT', alpha);
}

/**
 * Sun disc: hero ring, inner and outer rings, and 13 tapered rays turning slowly.
 * p draws it on; rays (0..1) grows the rays; rot turns them.
 */
export function sunDisc(g, cx, cy, r, p, rays, rot, o = {}) {
  const hot = o.hot ?? 1;
  circle(g, cx, cy, r, p, { pen: { color: 'GOLD_HOT', alpha: 0.95, width: 3.4 + 1.6 * hot }, tip: false });
  circle(g, cx, cy, r - 16, sub(p, 0.2, 1), { pen: { color: 'GOLD', alpha: 0.55, width: 1.2 }, tip: false, a0: Math.PI / 2 });
  circle(g, cx, cy, r + 14, sub(p, 0.35, 1), { pen: { color: 'GOLD', alpha: 0.4, width: 1 }, tip: false, a0: -Math.PI / 2, dir: -1 });
  // Fine degree ticks between the outer rings
  const tk = sub(p, 0.5, 1);
  if (tk > 0) {
    g.strokeStyle = rgba('GOLD', 0.35 * tk); g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i < 104; i++) {
      const a = (i / 104) * TAU + rot * 0.25, l = i % 8 === 0 ? 10 : 5;
      g.moveTo(cx + Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2));
      g.lineTo(cx + Math.cos(a) * (r + 2 + l), cy + Math.sin(a) * (r + 2 + l));
    }
    g.stroke();
  }
  if (rays > 0) {
    for (const [, , a] of thirteen(cx, cy, r + 20, rot)) {
      // Rays pointing down into the title block are shorter and fainter.
      const down = clamp(Math.sin(a) * (o.downFade ?? 0));
      const len = (o.rayLen ?? 300) * rays * (1 - 0.5 * down);
      const r1 = r + 22, r2 = r1 + len;
      const w = 9;
      const gr = g.createLinearGradient(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      gr.addColorStop(0, rgba('GOLD_HOT', 0.55 * rays * (1 - 0.65 * down))); gr.addColorStop(1, rgba('GOLD', 0));
      g.fillStyle = gr;
      const px = -Math.sin(a), py = Math.cos(a);
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r1 + px * w, cy + Math.sin(a) * r1 + py * w);
      g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      g.lineTo(cx + Math.cos(a) * r1 - px * w, cy + Math.sin(a) * r1 - py * w);
      g.closePath(); g.fill();
      // Between each pair of rays, a fine construction ray
      const b = a + Math.PI / 13;
      g.strokeStyle = rgba('GOLD', 0.16 * rays * (1 - 0.7 * down)); g.lineWidth = 1;
      g.beginPath(); g.moveTo(cx + Math.cos(b) * r1, cy + Math.sin(b) * r1); g.lineTo(cx + Math.cos(b) * (r1 + len * 0.6), cy + Math.sin(b) * (r1 + len * 0.6)); g.stroke();
    }
  }
}

/**
 * Wireframe globe. rot turns it about its axis, tilt leans the axis toward the
 * viewer, p draws it on. Back lines are dimmer than front lines. o.night (0..1)
 * hatches the night side behind a terminator at o.sun (radians, 0 = lit from the right).
 */
export function globe(g, cx, cy, r, p, rot, o = {}) {
  const tilt = o.tilt ?? 0.38, alpha = o.alpha ?? 1;
  const ct = Math.cos(tilt), stt = Math.sin(tilt);
  const proj = (lat, lon) => {
    const x = Math.cos(lat) * Math.sin(lon), y = Math.sin(lat), z = Math.cos(lat) * Math.cos(lon);
    const y2 = y * ct - z * stt, z2 = y * stt + z * ct;
    return [cx + x * r, cy - y2 * r, z2];
  };
  const P = sub(p, 0.15, 1);
  const drawCurve = (pts, prog, front, back) => {
    // Split into runs of front-facing and back-facing points.
    let run = [], side = null;
    const n = Math.max(2, Math.floor(pts.length * clamp(prog)));
    const flush = () => {
      if (run.length > 1) stroke(g, run, 1, { pen: { color: 'GOLD', alpha: (side ? front : back) * alpha, width: side ? 1.3 : 1 }, tip: false });
    };
    for (let i = 0; i < n; i++) {
      const f = pts[i][2] >= 0;
      if (side === null) side = f;
      if (f !== side) { run.push([pts[i][0], pts[i][1]]); flush(); run = [[pts[i][0], pts[i][1]]]; side = f; }
      else run.push([pts[i][0], pts[i][1]]);
    }
    flush();
  };
  if (P > 0) {
    const nMer = o.meridians ?? 12;
    for (let k = 0; k < nMer; k++) {
      const lon = rot + (k * TAU) / nMer, pts = [];
      for (let i = 0; i <= 64; i++) pts.push(proj(-Math.PI / 2 + (i / 64) * Math.PI, lon));
      drawCurve(pts, sub(P, (k / nMer) * 0.5, (k / nMer) * 0.5 + 0.5), 0.6, 0.16);
    }
    for (let j = -3; j <= 3; j++) {
      const lat = (j * Math.PI) / 8, pts = [];
      for (let i = 0; i <= 96; i++) pts.push(proj(lat, (i / 96) * TAU));
      drawCurve(pts, sub(P, 0.3 + (j + 3) * 0.05, 0.75 + (j + 3) * 0.04), j === 0 ? 0.75 : 0.5, 0.14);
    }
  }
  // Night side, engraved. o.sun is the direction of the light in the image plane;
  // o.phase runs from 1 (all dark) through 0 (half lit) to -1 (fully lit).
  if ((o.night ?? 0) > 0 && p > 0.5) {
    const sun = o.sun ?? 0, e = o.phase ?? 0.1;
    const k = o.night * sub(p, 0.5, 1);
    g.save();
    g.beginPath();
    g.arc(cx, cy, r - 0.5, sun + Math.PI / 2, sun + (3 * Math.PI) / 2, false);
    if (e >= 0) g.ellipse(cx, cy, Math.max(0.01, e * r), r, sun, -Math.PI / 2, Math.PI / 2, false);
    else g.ellipse(cx, cy, Math.max(0.01, -e * r), r, sun, -Math.PI / 2, (-3 * Math.PI) / 2, true);
    g.closePath();
    g.fillStyle = rgba('INK', 0.8 * k); g.fill();
    g.clip();
    hatch(g, [[cx - r, cy - r], [cx + r, cy - r], [cx + r, cy + r], [cx - r, cy + r]], 1, { angle: -Math.PI / 3, gap: o.hatchGap ?? 6, alpha: 0.3 * k });
    g.restore();
  }
  // Limb (o.sym draws it both ways from a0, so it closes on the far side)
  const LP = { color: 'GOLD_HOT', alpha: 0.95 * alpha, width: o.limb ?? 2.6 };
  if (o.sym && p < 1) {
    const a0 = o.a0 ?? -Math.PI / 2;
    stroke(g, arcPts(cx, cy, r, a0, a0 + Math.PI * p, 96), 1, { pen: LP, tip: false });
    stroke(g, arcPts(cx, cy, r, a0, a0 - Math.PI * p, 96), 1, { pen: LP, tip: false });
  } else circle(g, cx, cy, r, p, { pen: LP, tip: p < 1, a0: o.a0 ?? -Math.PI / 2 });
}

