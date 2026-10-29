// The surveyor's plate: corner registration marks, the act/chapter marker,
// the observation line and the 1776–2026 timeline ruler along the bottom.

import { W, H, rgba } from './theme.js';
import { clamp, lerp, span, ease, TAU } from './engine.js';
import { text, textWidth, rollingNumber } from './draw/type.js';
import { stroke, glow } from './draw/paths.js';

export const RULER = { y0: 1776, y1: 2026, x0: 200, x1: 1640, y: 984, next: 1768 };
export const rulerX = yr => RULER.x0 + ((yr - RULER.y0) / (RULER.y1 - RULER.y0)) * (RULER.x1 - RULER.x0);
const OMEGA = 7; // critically damped cursor: settles in about 0.7 s
const LABELS = [1776, 1800, 1850, 1900, 1950, 2000, 2026];
const pad2 = n => String(n).padStart(2, '0');

export class Hud {
  constructor(film) {
    this.film = film;
    const tl = film.tl;
    const keys = tl.scenes.flatMap(sc => sc.yearKeys).sort((a, b) => a.t - b.t);
    let prev = RULER.y0;
    this.steps = keys.map(k => { const d = k.year - prev; prev = k.year; return { t: k.t, d }; });
    this.events = tl.scenes.flatMap(sc => sc.eventKeys.map(e => ({ ...e, scene: sc.id })));
    const rc = tl.byId['02_title'].cueMap.ruler.hits[0];
    this.rulerT0 = rc.t0; this.rulerT1 = rc.t1;
    this.nextT0 = (tl.scenes.find(s => s.act === 'V') || { start: Infinity }).start;
    this.cuts = tl.scenes.map(s => s.start).slice(1);
  }

  /** Cursor year: a sum of critically damped step responses, so it is a pure function of time. */
  year(T) {
    let y = RULER.y0;
    for (const st of this.steps) {
      const tau = T - st.t;
      if (tau <= 0) break;
      y += st.d * (1 - (1 + OMEGA * tau) * Math.exp(-OMEGA * tau));
    }
    return y;
  }

  draw(g, T, { cur, prev, s }) {
    const S = this.film.S, o = s.hud || {};
    const A = o.alpha ?? 1;
    if (A <= 0) return;
    g.setTransform(S, 0, 0, S, 0, 0);
    g.globalAlpha = 1;

    // Corner registration marks
    const ca = span(T, 0.4, 1.6) * A;
    if (ca > 0) {
      const m = 40, L = 26;
      for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) {
        stroke(g, [[x, y + sy * L], [x, y], [x + sx * L, y]], 1, { pen: { color: 'GOLD', alpha: 0.55 * ca, width: 1.2 }, tip: false });
        g.strokeStyle = rgba('GOLD', 0.35 * ca); g.lineWidth = 1;
        g.beginPath(); g.arc(x + sx * 9, y + sy * 9, 3, 0, TAU); g.stroke();
      }
    }

    // The 12-column grid surfaces around each cut.
    let near = 1e9;
    for (const c of this.cuts) near = Math.min(near, Math.abs(T - c));
    const gridA = (1 - clamp(near / 0.55)) * 0.13 * A;
    if (gridA > 0.002) {
      const x0 = W * 0.05, w = W * 0.9;
      g.strokeStyle = rgba('GOLD', gridA); g.lineWidth = 1;
      g.beginPath();
      for (let i = 0; i <= 12; i++) { const x = Math.round(x0 + (w * i) / 12) + 0.5; g.moveTo(x, H * 0.05); g.lineTo(x, H * 0.95); }
      g.stroke();
    }

    // Act and chapter marker, top left; observation line, top right.
    const ta = span(T, 1.2, 2.4) * A * (o.topAlpha ?? 1);
    if (ta > 0) {
      const changed = !prev || prev.marker !== cur.marker;
      const since = T - Math.max(cur.start, 1.2);
      const reveal = changed ? (i => ease.out(clamp((since - i * 0.012) / 0.28))) : null;
      text(g, cur.marker, 104, 82, { voice: 'marker', size: 24, align: 'left', alpha: 0.9 * ta, reveal, rise: 0.3, scale: S, fact: cur.chapterFact });
      const coord = cur.coordKeys.filter(k => T >= k.t - 1e-6).pop() || cur.coordKeys[0];
      const date = cur.dateKeys.filter(k => T >= k.t - 1e-6).pop() || cur.dateKeys[0];
      const ck = clamp((T - coord.t) / 0.3);
      const obs = `OBS. ${pad2(cur.obs)} · ${date.text} · `;
      const coordW = textWidth(g, coord.text, { voice: 'data', size: 24 });
      text(g, obs, 1816 - coordW, 82, {
        voice: 'data', size: 24, align: 'right', alpha: 0.85 * ta, scale: S,
        fact: ['structural:obs', 'structural:dates'],
        reveal: changed ? (i => ease.out(clamp((since - 0.1 - i * 0.012) / 0.25))) : null,
      });
      text(g, coord.text, 1816, 82, {
        voice: 'data', size: 24, align: 'right', alpha: 0.85 * ta * (coord.t > cur.start + 1e-6 ? ck : 1), scale: S,
        fact: coord.fact,
        reveal: changed ? (i => ease.out(clamp((since - 0.2 - i * 0.012) / 0.25))) : null,
      });
    }

    this.ruler(g, T, o, A);
  }

  ruler(g, T, o, A) {
    const S = this.film.S;
    const draw = span(T, this.rulerT0, this.rulerT1, ease.inOut);
    if (draw <= 0) return;
    const lift = o.rulerLift || 0;
    const y = lerp(RULER.y, o.rulerY ?? 600, ease.inOut(lift));
    const ra = A * (o.rulerAlpha ?? 1);
    const xEnd = lerp(RULER.x0, RULER.x1, draw);
    // Spine and ticks
    stroke(g, [[RULER.x0, y], [xEnd, y]], 1, { pen: { color: 'GOLD', alpha: 0.5 * ra, width: 1.5 }, tip: false });
    g.strokeStyle = rgba('GOLD', 0.5 * ra); g.lineWidth = 1;
    g.beginPath();
    for (let yr = 1780; yr <= 2025; yr += 5) {
      const x = rulerX(yr);
      if (x > xEnd) break;
      const h = yr % 50 === 0 ? 12 : yr % 25 === 0 ? 8 : 4;
      g.moveTo(x, y); g.lineTo(x, y - h);
    }
    for (const yr of [1776, 2026]) { const x = rulerX(yr); if (x <= xEnd + 0.5) { g.moveTo(x, y); g.lineTo(x, y - 14); } }
    g.stroke();
    for (const yr of LABELS) {
      const x = rulerX(yr);
      const la = draw >= 1 ? 1 : clamp((xEnd - x) / 40 + 0.5);
      if (la <= 0) continue;
      text(g, String(yr), x, y + 24, { voice: 'data', size: 24, alpha: 0.62 * la * ra, fact: 'structural:ruler', scale: S });
    }

    // NEXT: the ruler runs on past 2026 in Act V, and off the frame at the very end.
    const nextP = T >= this.nextT0 ? span(T, this.nextT0, this.nextT0 + 1.0) : 0;
    const runoff = o.runoff || 0;
    if (nextP > 0) {
      const xn = lerp(RULER.x1, lerp(RULER.next, W + 80, ease.inOut(runoff)), nextP);
      stroke(g, [[RULER.x1, y], [xn, y]], 1, { pen: { color: 'GOLD', alpha: 0.55 * ra, width: 1.5 }, tip: false, dash: [7, 7] });
      text(g, 'NEXT', lerp(RULER.next - 20, W + 40, ease.inOut(runoff)), y - 26, { voice: 'marker', size: 24, alpha: 0.8 * nextP * ra * (1 - runoff), scale: S });
    }

    // Event dots: the constellation of achievements.
    const all = o.allDots || 0;
    for (const e of this.events) {
      if (T < e.t) continue;
      const x = rulerX(e.year), age = T - e.t;
      const pop = Math.exp(-age / 0.18);
      if (age < 0.6) {
        g.strokeStyle = rgba('GOLD_HOT', 0.6 * (1 - age / 0.6) * ra); g.lineWidth = 1.2;
        g.beginPath(); g.arc(x, y, 4 + age * 30, 0, TAU); g.stroke();
      }
      const hot = Math.max(pop, all);
      g.fillStyle = rgba(hot > 0.05 ? 'GOLD_HOT' : 'GOLD', (0.85 + 0.15 * hot) * ra);
      g.beginPath(); g.arc(x, y, 3.4 * (1 + 0.8 * pop + 0.5 * all), 0, TAU); g.fill();
      if (all > 0) glow(g, x, y, 16 * all, 'GOLD_HOT', 0.5 * all * ra);
    }

    // Cursor and its rolling year counter
    const yr = o.cursorYear ?? this.year(T);
    const cx = rulerX(yr), ca = clamp((xEnd - RULER.x0) / 60) * ra;
    stroke(g, [[RULER.x0, y], [Math.min(cx, xEnd), y]], 1, { pen: { color: 'GOLD_HOT', alpha: 0.9 * ca, width: 2.2 }, tip: false });
    g.fillStyle = rgba('GOLD_HOT', ca);
    g.beginPath(); g.moveTo(cx, y - 7); g.lineTo(cx + 6, y); g.lineTo(cx, y + 7); g.lineTo(cx - 6, y); g.closePath(); g.fill();
    glow(g, cx, y, 18, 'GOLD_HOT', 0.35 * ca);
    if (o.counterText) text(g, o.counterText, cx, y - 34, { voice: 'dataBold', size: 28, alpha: ca, fact: 'structural:ruler', scale: S });
    else rollingNumber(g, Math.abs(yr - Math.round(yr)) < 0.002 ? Math.round(yr) : yr, cx, y - 34, { size: 28, alpha: ca, scale: S });
  }
}
