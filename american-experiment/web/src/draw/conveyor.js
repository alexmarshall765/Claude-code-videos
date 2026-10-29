// The moving assembly line in side elevation, shared by OBS 11 (1913) and its callback
// in OBS 17 (a century later). Everything moves linearly: it is a machine. The line runs
// at 640 px/s with chassis every 320 px, and the stations stand 400 px apart, so each
// station closes on a chassis exactly on its own 16th of every beat.

import { rgba } from '../theme.js';
import { clamp, lerp } from '../engine.js';
import { stroke, circle, glow } from './paths.js';
import { gear, wheel } from './gears.js';
import { text } from './type.js';

export const LINE = { y: 600, x0: 200, x1: 1760, speed: 640, pitch: 320, sprocket: 50, floor: 760 };
export const STATIONS = [440, 840, 1240, 1640];
export const STATION_NAMES = ['AXLES', 'ENGINE', 'BODY', 'WHEELS'];

/** Chassis k's centre x at time t (local seconds since the line started). */
export const chassisX = (k, t) => STATIONS[0] + LINE.speed * t - LINE.pitch * k;

/** One chassis at (x, y = belt top). stage: parts fitted so far (0..4); kind '1913' or 'ev'. */
export function chassis(g, x, y, stage, o = {}) {
  const a = o.alpha ?? 1, lw = o.lw ?? 1;
  const P = (c, al = 1, w = 1.6) => ({ color: c, alpha: a * al, width: w * lw });
  stroke(g, [[x - 120, y - 46], [x + 120, y - 46], [x + 120, y - 36], [x - 120, y - 36]], 1, { pen: P('GOLD', 0.95, 1.6), closed: true, tip: false });
  for (const dx of [-60, 0, 60]) stroke(g, [[x + dx, y - 46], [x + dx, y - 36]], 1, { pen: P('GOLD', 0.6, 1), tip: false });
  // Until its wheels go on, the chassis rides on two trestles.
  if (stage < 4) for (const dx of [-60, 60]) stroke(g, [[x + dx - 14, y], [x + dx, y - 36], [x + dx + 14, y]], 1, { pen: P('GOLD', 0.7, 1.2), tip: false });
  if (stage >= 1) for (const dx of [-80, 85]) {
    circle(g, x + dx, y - 34, 7, 1, { pen: P('GOLD_HOT', 1, 1.6), tip: false });
    stroke(g, [[x + dx - 26, y - 48], [x + dx, y - 54], [x + dx + 26, y - 48]], 1, { pen: P('GOLD', 0.8, 1.2), tip: false });
  }
  if (o.kind === 'ev') {
    if (stage >= 2) {
      // The flat battery platform between the axles, its cells in rows
      stroke(g, [[x - 104, y - 34], [x + 104, y - 34], [x + 104, y - 14], [x - 104, y - 14]], 1, { pen: P('GOLD_HOT', 1, 1.6), closed: true, tip: false });
      for (let cx = x - 96; cx <= x + 96; cx += 12) circle(g, cx, y - 24, 4, 1, { pen: P(o.cellsLit ? 'GOLD_HOT' : 'GOLD', o.cellsLit ?? 0.6, 1), tip: false });
    }
    if (stage >= 3) for (const dx of [-80, 85]) circle(g, x + dx, y - 34, 16, 1, { pen: P('GOLD', 0.9, 1.4), tip: false });
  } else {
    if (stage >= 2) {
      stroke(g, [[x + 58, y - 46], [x + 58, y - 92], [x + 116, y - 92], [x + 116, y - 46]], 1, { pen: P('GOLD_HOT', 1, 1.6), tip: false });
      for (let k = 0; k < 4; k++) stroke(g, [[x + 66 + k * 13, y - 88], [x + 66 + k * 13, y - 52]], 1, { pen: P('GOLD', 0.6, 1), tip: false });
      stroke(g, [[x + 116, y - 100], [x + 126, y - 100], [x + 126, y - 46], [x + 116, y - 46]], 1, { pen: P('GOLD', 0.9, 1.4), closed: true, tip: false });
    }
    if (stage >= 3) {
      stroke(g, [[x - 112, y - 46], [x - 112, y - 100], [x + 50, y - 100], [x + 116, y - 100]], 1, { pen: P('GOLD_HOT', 1, 1.8), tip: false });
      stroke(g, [[x - 112, y - 100], [x - 104, y - 124], [x - 70, y - 124], [x - 64, y - 100]], 1, { pen: P('GOLD', 0.9, 1.4), tip: false });
      stroke(g, [[x + 48, y - 100], [x + 40, y - 156]], 1, { pen: P('GOLD', 0.9, 1.4), tip: false });
      stroke(g, [[x - 108, y - 156], [x + 44, y - 156]], 1, { pen: P('GOLD', 0.9, 1.6), tip: false });
      for (const dx of [-100, -30, 36]) stroke(g, [[x + dx, y - 156], [x + dx - 4, y - 100]], 1, { pen: P('GOLD', 0.55, 1), tip: false });
    }
  }
  if (stage >= 4) for (const dx of [-80, 85]) wheel(g, x + dx, y - 34, 34, o.spin ?? 0, 1, { spokes: o.kind === 'ev' ? 5 : 10, pen: P('GOLD_HOT', 1, 2) });
}

/**
 * The line: drive sprocket, chain, rollers, idler, gantries, and the chassis passing
 * through. t is seconds since the line started moving; build (0..1) draws it on;
 * hits(j) = time of the j-th station 16th; o.kind picks the era.
 */
export function assemblyLine(g, s, t, o = {}) {
  const build = o.build ?? 1, a = o.alpha ?? 1, Y = LINE.y, R = LINE.sprocket;
  if (build <= 0 || a <= 0) return;
  const rot = (LINE.speed * t) / R;
  const P = (al, w = 1.6, c = 'GOLD') => ({ color: c, alpha: al * a, width: w });
  // Chain: top run, sprockets, return run
  stroke(g, [[LINE.x0, Y], [LINE.x1, Y]], clamp(build * 1.4), { pen: P(0.95, 2.2, 'GOLD_HOT') });
  const rb = clamp(build * 1.4 - 0.4);
  if (rb > 0) {
    stroke(g, [[LINE.x0, Y + 2 * R], [LINE.x1, Y + 2 * R]], rb, { pen: P(0.6, 1.4), tip: false });
    gear(g, LINE.x1, Y + R, R, 14, rot, rb, { depth: 10, holes: 4, pen: P(0.9, 1.8) });
    g.strokeStyle = rgba('GOLD', 0.5 * a * rb); g.lineWidth = 1; g.beginPath();
    const off = (LINE.speed * t) % 24;
    for (let x = LINE.x0 + off; x < LINE.x1; x += 24) { g.moveTo(x, Y - 4); g.lineTo(x, Y + 4); }
    for (let x = LINE.x1 - off; x > LINE.x0; x -= 24) { g.moveTo(x, Y + 2 * R - 4); g.lineTo(x, Y + 2 * R + 4); }
    g.stroke();
    for (let x = LINE.x0 + 120; x < LINE.x1 - 60; x += 120) {
      circle(g, x, Y + 18, 12, rb, { pen: P(0.6, 1.2), tip: false });
      const ra = rot * (R / 12);
      stroke(g, [[x, Y + 18], [x + Math.cos(ra) * 12, Y + 18 + Math.sin(ra) * 12]], rb, { pen: P(0.6, 1), tip: false });
    }
    stroke(g, [[LINE.x0 - 80, LINE.floor], [LINE.x1 + 120, LINE.floor]], rb, { pen: P(0.5, 1.2), tip: false });
  }
  if (!o.noDrive) gear(g, LINE.x0, Y + R, R, 14, rot, 1, { depth: 10, holes: 4, pen: P(1, 2, 'GOLD_HOT') });
  // Gantries with their tools
  STATIONS.forEach((x, i) => {
    const q = clamp(build * 2.2 - 1 - i * 0.15);
    if (q <= 0) return;
    stroke(g, [[x - 110, LINE.floor], [x - 110, 330], [x + 110, 330], [x + 110, LINE.floor]], q, { pen: P(0.75, 1.6), tip: false });
    stroke(g, [[x - 110, 346], [x + 110, 346]], q, { pen: P(0.5, 1), tip: false });
    // The tool drops on this station's 16th of each beat.
    let drop = 0;
    if (o.hitAt) {
      const ph = ((t - o.hitAt(i)) % 0.5 + 0.5) % 0.5;
      drop = ph < 0.125 ? 1 - Math.abs(ph / 0.0625 - 1) : 0;
    }
    const ty = lerp(400, 470, drop);
    stroke(g, [[x, 346], [x, ty]], q, { pen: P(0.8, 1.2), tip: false });
    stroke(g, [[x - 26, ty], [x + 26, ty], [x + 20, ty + 14], [x - 20, ty + 14]], q, { pen: P(0.95, 1.6, drop > 0.5 ? 'GOLD_HOT' : 'GOLD'), closed: true, tip: false });
    if (drop > 0.6) glow(g, x, ty + 30, 40, 'GOLD_HOT', 0.5 * drop * a);
    if (o.labels) text(s.ui, (o.names || STATION_NAMES)[i], x, 300, { voice: 'marker', size: 24, alpha: 0.85 * q * o.labels, scale: s.S });
  });
  // The chassis, fitted with each station's part as they pass it
  const kMax = Math.ceil((LINE.speed * Math.max(0, t) + STATIONS[0] - LINE.x0) / LINE.pitch) + 1;
  for (let k = 0; k <= kMax; k++) {
    const x = chassisX(k, t);
    if (x < LINE.x0 + 40 || x > LINE.x1 - 40) continue;
    const edge = clamp((x - LINE.x0 - 40) / 80) * clamp((LINE.x1 - 40 - x) / 80);
    let stage = 0;
    STATIONS.forEach((sx, i) => { if (x >= sx) stage = i + 1; });
    chassis(g, x, Y, stage, { alpha: a * edge * clamp(build * 2 - 1), kind: o.kind, cellsLit: o.cellsLit });
  }
}
