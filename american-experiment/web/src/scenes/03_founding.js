// OBS 03 · ACT I · THE HYPOTHESIS — FOUNDING, 1776.
//   9.1   parchment; a golden-ratio plate constructs itself, a division per beat
//   10.1  a quill engraves WE HOLD THESE TRUTHS, rules it, then writes the body
//   11.1  56 signatures link into a constellation, one per 32nd;
//         ALL MEN ARE CREATED EQUAL is planted small at the foot (paid off in OBS 07)
//   12.1  the CRIMSON 1776 seal stamps at the eye of the golden spiral
//   12.3  THE HYPOTHESIS:  the camera settles on the seal
//   13.1  13 stars ring it, one per quarter note;  14.1  FREE PEOPLE CAN GOVERN THEMSELVES.

import { scene } from './common.js';
import { ease, clamp, lerp, sub, span } from '../engine.js';
import { stroke, arcPts, glow, dot, circle } from '../draw/paths.js';
import { thirteen, starPts } from '../draw/motif.js';
import { card, text, textWidth } from '../draw/type.js';
import { quill, scriptLine, drawScript, seal } from '../draw/icons.js';

// The plate: a golden rectangle, subdivided square by square toward the spiral's eye.
const PX = 313, PY = 130, PW = 1294, PH = 800;
const EYE = [1249.5, 709]; // where the diagonals of the plate and of its first remainder cross
const SEAL_R = 46, RING_R = 150;

const DIV = (() => {
  let x = PX, y = PY, w = PW, h = PH;
  const out = [];
  for (let i = 0; i < 9; i++) {
    const side = ['left', 'top', 'right', 'bottom'][i % 4];
    if (side === 'left') { const s = h; out.push({ line: [[x + s, y], [x + s, y + h]], arc: [x + s, y + s, s, Math.PI, 1.5 * Math.PI] }); x += s; w -= s; }
    else if (side === 'top') { const s = w; out.push({ line: [[x, y + s], [x + w, y + s]], arc: [x, y + s, s, 1.5 * Math.PI, 2 * Math.PI] }); y += s; h -= s; }
    else if (side === 'right') { const s = h; out.push({ line: [[x + w - s, y], [x + w - s, y + h]], arc: [x + w - s, y, s, 0, 0.5 * Math.PI] }); w -= s; }
    else { const s = w; out.push({ line: [[x, y + h - s], [x + w, y + h - s]], arc: [x + w, y + h - s, s, 0.5 * Math.PI, Math.PI] }); h -= s; }
  }
  return out;
})();
const SPIRAL = DIV.flatMap(d => arcPts(d.arc[0], d.arc[1], d.arc[2], d.arc[3], d.arc[4], 64));

// Statement lines, set in the plate's upper band and engraved by the quill.
const LINES = [{ text: 'WE HOLD THESE TRUTHS', y: 300 }, { text: 'TO BE SELF-EVIDENT', y: 410 }];
const SIZE = 94;
const UNDER = [[640, 470], [1280, 470]];
const BODY = [572, 607, 642, 677].map((y, i) => scriptLine(400, y, 640, 31 + i * 7, { h: 10 }));

// 56 signatures in six loose columns, as on the engrossed Declaration.
const SIGS = (() => {
  const cols = [7, 9, 10, 11, 10, 9], out = [];
  let seed = 7;
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  cols.forEach((n, j) => {
    for (let i = 0; i < n; i++) out.push({ x: 430 + j * 118 + (r() - 0.5) * 46, y: 724 + (i / (n - 1)) * 134 + (r() - 0.5) * 10, col: j, prev: i ? out.length - 1 : -1 });
  });
  return out;
})();

/** Where the quill's nib is: writing a stroke, or hopping between strokes. */
function nib(s) {
  const t = s.t, b = s.beatDur;
  const strokes = [];
  LINES.forEach((ln, i) => {
    const w = textWidth(s.lineCtx, ln.text, { voice: 'statement', size: SIZE });
    const x0 = 960 - w / 2 - SIZE, x1 = 960 + w / 2 + SIZE;
    strokes.push({ t0: 2 + i * b, t1: 2 + (i + 1) * b, at: u => [lerp(x0, x1, ease.inOut(u)), ln.y + SIZE * 0.3] });
  });
  strokes.push({ t0: 3, t1: 3.5, at: u => [lerp(UNDER[0][0], UNDER[1][0], ease.inOut(u)), UNDER[0][1]] });
  strokes.push({ t0: 3.5, t1: 4, at: u => flourish(ease.inOut(u)) });
  BODY.forEach((words, i) => strokes.push({ t0: 4 + i * b, t1: 4 + (i + 1) * b, at: u => [lerp(400, 1040, u), 572 + i * 35] }));
  for (let i = 0; i < strokes.length; i++) {
    const st = strokes[i];
    if (t >= st.t0 && t < st.t1) {
      const u = (t - st.t0) / (st.t1 - st.t0);
      const hop = i ? clamp((t - st.t0) / 0.09) : 1;
      const [x, y] = st.at(u);
      if (hop < 1) { const [px, py] = strokes[i - 1].at(1); const e = ease.inOut(hop); return [lerp(px, x, e), lerp(py, y, e) - 26 * Math.sin(Math.PI * e)]; }
      return [x, y];
    }
  }
  if (t < 2) { const e = ease.out(clamp((t - 1.3) / 0.7)); const [x, y] = strokes[0].at(0); return [lerp(x + 520, x, e), lerp(y - 260, y, e)]; }
  const [x, y] = strokes[strokes.length - 1].at(1), e = ease.in(clamp((t - 6) / 0.6));
  return [x + 420 * e, y - 300 * e];
}
const FLOURISH = [[1280, 470], [1330, 472], [1356, 492], [1336, 506], [1312, 516], [1300, 494], [1330, 486], [1372, 488]];
function flourish(u) {
  const i = Math.min(FLOURISH.length - 2, Math.floor(u * (FLOURISH.length - 1))), f = u * (FLOURISH.length - 1) - i;
  return [lerp(FLOURISH[i][0], FLOURISH[i + 1][0], f), lerp(FLOURISH[i][1], FLOURISH[i + 1][1], f)];
}

export default scene('03_founding', {
  camera(s) {
    const t = s.t, push = 1 + 0.025 * span(t, 0, 7);
    const m = span(t, 7, 8.6, ease.inOut);
    const z = lerp(push, 1.3, m) * (1 + 0.04 * span(t, 8.6, 16, ease.sineInOut));
    return { x: lerp(960, EYE[0], m), y: lerp(540, EYE[1] - 108, m), zoom: z };
  },

  draw(ctx, s) {
    const t = s.t;
    s.bloom = 0.36;
    s.bg = { parchment: 0.13 * s.cue('parchment', ease.out) };
    const dimPage = 1 - 0.55 * span(t, 7, 8.6);

    // The plate constructs itself: frame and diagonals, then the golden divisions and the spiral.
    const g0 = s.cue('page_grid', ease.inOut, 0), g1 = s.cue('page_grid', ease.inOut, 1);
    const g2 = s.cue('page_grid', ease.inOut, 2), g3 = s.cue('page_grid', ease.inOut, 3);
    const C = { color: 'GOLD', alpha: 0.32 * dimPage, width: 1 };
    stroke(ctx, [[PX, PY], [PX + PW, PY], [PX + PW, PY + PH], [PX, PY + PH]], g0, { pen: { color: 'GOLD', alpha: 0.75 * dimPage, width: 1.6 }, closed: true });
    stroke(ctx, [[PX, PY], [PX + PW, PY + PH]], g0, { pen: C, tip: false, dash: [5, 7] });
    stroke(ctx, [[DIV[0].line[0][0], PY + PH], [PX + PW, PY]], g0, { pen: C, tip: false, dash: [5, 7] });
    DIV.forEach((d, i) => {
      const q = i < 2 ? sub(g1, i * 0.4, i * 0.4 + 0.6) : i < 5 ? sub(g2, (i - 2) * 0.3, (i - 2) * 0.3 + 0.55) : sub(g3, (i - 5) * 0.2, (i - 5) * 0.2 + 0.5);
      stroke(ctx, d.line, q, { pen: C, tip: false });
    });
    const sp = clamp(g1 * 0.45 + g2 * 0.35 + g3 * 0.2);
    stroke(ctx, SPIRAL, sp, { pen: { color: 'GOLD', alpha: 0.5 * dimPage, width: 1.3 }, tip: sp < 1 });
    // Margins: the text block's rules
    const rules = sub(g3, 0.3, 1);
    for (const y of [548, 702, 876]) stroke(ctx, [[PX + 48, y], [PX + 800 - 48, y]], rules, { pen: { color: 'GOLD', alpha: 0.16 * dimPage, width: 1 }, tip: false });

    // The quill engraves the statement, rules it, flourishes, then writes the body.
    card(s, 'card_truths', { text: LINES[0].text, x: 960, y: LINES[0].y, size: SIZE, style: 'wipe' });
    card(s, 'card_truths', { text: LINES[1].text, x: 960, y: LINES[1].y, size: SIZE, style: 'wipe', delay: s.beatDur });
    card(s, 'attrib_declaration', { x: 960, y: 524, size: 26, alpha: 0.85 });
    const fade = 1 - span(t, 6.4, 7.4);
    stroke(ctx, UNDER, span(t, 3, 3.5, ease.inOut), { pen: { color: 'GOLD_HOT', alpha: 0.85 * fade * dimPage, width: 1.8 }, tip: false });
    stroke(ctx, FLOURISH, span(t, 3.5, 4, ease.inOut), { pen: { color: 'GOLD', alpha: 0.8 * fade * dimPage, width: 1.5 }, tip: false });
    BODY.forEach((words, i) => drawScript(ctx, words, span(t, 4 + i * 0.5, 4.5 + i * 0.5, ease.linear), { color: 'GOLD', alpha: 0.7 * dimPage, width: 1.2 }));
    const qa = clamp((t - 1.3) / 0.4) * (1 - clamp((t - 6.1) / 0.5));
    if (qa > 0) { const [nx, ny] = nib(s); quill(ctx, nx, ny, -1.08, 0.9, qa); glow(ctx, nx, ny, 16, 'GOLD_HOT', 0.4 * qa); }

    // Fifty-six signatures spark into a constellation.
    const sigHits = s.hits('signatures');
    SIGS.forEach((sg, i) => {
      const h = sigHits[i];
      if (!h || t < h.t0) return;
      const age = t - h.t0, e = ease.expoOut(clamp(age / 0.25));
      const a = dimPage * (1 - 0.6 * span(t, 7.2, 8.4));
      if (sg.prev >= 0) { const p = SIGS[sg.prev]; stroke(ctx, [[p.x, p.y], [sg.x, sg.y]], e, { pen: { color: 'GOLD', alpha: 0.45 * a, width: 1 }, tip: false }); }
      if (sg.col > 0 && i % 3 === 0) {
        const left = SIGS.filter(q => q.col === sg.col - 1).reduce((b, q) => (Math.abs(q.y - sg.y) < Math.abs(b.y - sg.y) ? q : b));
        stroke(ctx, [[left.x, left.y], [sg.x, sg.y]], e, { pen: { color: 'GOLD', alpha: 0.22 * a, width: 1 }, tip: false });
      }
      dot(ctx, sg.x, sg.y, 2.6 + 1.6 * Math.exp(-age / 0.12), 'GOLD_HOT', 0.95 * a);
      glow(ctx, sg.x, sg.y, 12 + 16 * Math.exp(-age / 0.15), 'GOLD_HOT', 0.35 * a);
    });

    // Planted small at the foot of the page, for the callback in OBS 07.
    const eq = s.cue('equal_small', ease.out);
    if (eq > 0) {
      const ea = 1 - span(t, 7.0, 7.5);
      text(s.ui, 'ALL MEN ARE CREATED EQUAL', 713, 896, { voice: 'data', size: 26, alpha: 0.85 * ea, scale: s.S, reveal: i => ease.expoOut(clamp((t - s.at('3.3') - i * 0.03) / 0.4)) });
      stroke(ctx, [[713 - 210 * eq, 918], [713 + 210 * eq, 918]], 1, { pen: { color: 'GOLD', alpha: 0.45 * ea, width: 1 }, tip: false });
    }

    // The CRIMSON 1776 seal stamps at the spiral's eye.
    const st = s.cue('population', ease.expoOut);
    seal(s, ctx, EYE[0], EYE[1], SEAL_R, st, { wax: 'CRIMSON', label: '1776', fact: 'date_declaration', labelSize: 28, labelColor: 'GOLD_HOT' });
    card(s, 'data_population', { x: EYE[0], y: EYE[1] + RING_R + 42, size: 28 });

    // Thirteen stars ring the seal, one per quarter note; the ring closes as they land.
    const stars = thirteen(EYE[0], EYE[1], RING_R);
    const hits = s.hits('stars');
    hits.forEach((h, k) => {
      if (t < h.t0) return;
      const age = t - h.t0, e = ease.expoOut(clamp(age / 0.3));
      const [x, y] = stars[k];
      const prevA = stars[k][2] - (2 * Math.PI) / 13;
      stroke(ctx, arcPts(EYE[0], EYE[1], RING_R, prevA, prevA + ((2 * Math.PI) / 13) * ease.inOut(clamp(age / 0.45)), 24), 1, { pen: { color: 'GOLD', alpha: 0.55, width: 1.3 }, tip: false });
      glow(ctx, x, y, 26 * e * (1 + 0.8 * Math.exp(-age / 0.15)), 'GOLD_HOT', 0.4 * e);
      stroke(ctx, starPts(x, y, 13 * e), 1, { pen: { color: 'GOLD_HOT', alpha: 0.95, width: 1.5 }, closed: true, tip: false });
    });
    if (s.count('stars') >= 13) circle(ctx, EYE[0], EYE[1], RING_R + 18, span(t, s.at('8.1'), s.at('8.4')), { pen: { color: 'GOLD', alpha: 0.3, width: 1 }, tip: false });

    s.screen(() => {
      card(s, 'card_hypothesis', { x: 960, y: 236, size: 104 });
      card(s, 'card_free', { lines: ['FREE PEOPLE CAN', 'GOVERN THEMSELVES.'], x: 960, y: 262, size: 100 });
    });
  },
});
