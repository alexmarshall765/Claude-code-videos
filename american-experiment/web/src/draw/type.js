// Typography: two voices. Statements are monumental serif caps on the line layer
// (they bloom); data is small monospace on the annotation layer (it never blooms).
// Cards take their words and timing from timeline.json; scenes only place them.

import { FONT, WEIGHT, TRACK, rgba } from '../theme.js';
import { logText, edgeFade, ease, clamp, span } from '../engine.js';

const layoutCache = new Map();

export function setFont(g, size, face, weight) {
  g.font = `${weight} ${size}px ${face}`;
  g.letterSpacing = '0px';
}

/** Glyph x offsets with tracking; prefix measurement keeps the font's kerning. */
export function layout(g, str, size, face, weight, track) {
  const key = `${str}|${size}|${face}|${weight}|${track}`;
  let L = layoutCache.get(key);
  if (L) return L;
  setFont(g, size, face, weight);
  const chars = [...str], xs = [];
  let prefix = '';
  for (let i = 0; i < chars.length; i++) {
    xs.push(g.measureText(prefix).width + i * track * size);
    prefix += chars[i];
  }
  const width = g.measureText(str).width + Math.max(0, chars.length - 1) * track * size;
  L = { chars, xs, width };
  layoutCache.set(key, L);
  return L;
}

const VOICE = {
  statement: { face: FONT.statement, weight: WEIGHT.statement, track: TRACK.statement, color: 'GOLD_HOT' },
  title: { face: FONT.statement, weight: WEIGHT.title, track: 0.06, color: 'GOLD_HOT' },
  final: { face: FONT.statement, weight: WEIGHT.title, track: 0.18, color: 'WHITE' },
  marker: { face: FONT.marker, weight: WEIGHT.marker, track: TRACK.marker, color: 'GOLD' },
  data: { face: FONT.data, weight: WEIGHT.data, track: TRACK.data, color: 'GOLD' },
  dataBold: { face: FONT.data, weight: WEIGHT.dataBold, track: TRACK.data, color: 'GOLD_HOT' },
};
export const voiceOf = v => VOICE[v] || VOICE.data;

/**
 * Draw one line of text. `reveal(i, n)` returns 0..1 per glyph for staggered entrances.
 * o.edge fades a label that rides the camera toward the frame edge before it leaves the
 * safe area. Every call is logged (screen box, effective size, fact) for `make check`.
 */
export function text(g, str, x, y, o = {}) {
  const v = voiceOf(o.voice || 'data');
  const size = o.size || 26, face = o.face || v.face, weight = o.weight || v.weight;
  const track = o.track ?? v.track, color = o.color || v.color;
  let alpha = o.alpha ?? 1;
  if (alpha <= 0.002 || !str) return 0;
  const L = layout(g, str, size, face, weight, track);
  const align = o.align || 'center';
  const x0 = align === 'center' ? x - L.width / 2 : align === 'right' ? x - L.width : x;
  if (o.edge) alpha *= edgeFade(g, o.scale || 1, x0, y - size / 2, x0 + L.width, y + size / 2);
  if (alpha <= 0.002) return L.width;
  setFont(g, size, face, weight);
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  if (!o.reveal && !o.mask) {
    g.fillStyle = rgba(color, alpha);
    for (let i = 0; i < L.chars.length; i++) g.fillText(L.chars[i], x0 + L.xs[i], y);
  } else {
    const n = L.chars.length;
    if (o.mask != null) { // masked wipe, left to right
      g.save();
      g.beginPath(); g.rect(x0 - size, y - size, (L.width + size * 2) * clamp(o.mask), size * 2); g.clip();
    }
    for (let i = 0; i < n; i++) {
      const k = o.reveal ? o.reveal(i, n) : 1;
      if (k <= 0) continue;
      g.fillStyle = rgba(color, alpha * k);
      g.fillText(L.chars[i], x0 + L.xs[i], y + (1 - k) * size * (o.rise ?? 0.18));
    }
    if (o.mask != null) g.restore();
  }
  if (o.log !== false) {
    logText(g, o.scale || 1, {
      text: str, voice: o.voice || 'data', fact: o.fact, size, alpha,
      x0, x1: x0 + L.width, y0: y - size * 0.5, y1: y + size * 0.5,
    });
  }
  return L.width;
}

export const textWidth = (g, str, o = {}) => {
  const v = voiceOf(o.voice || 'data');
  return layout(g, str, o.size || 26, o.face || v.face, o.weight || v.weight, o.track ?? v.track).width;
};

/** Envelope of a card: staggered entrance on its downbeat, fade plus 8 px drift on exit. */
export function cardEnvelope(t, tin, tout, n, style = 'stagger') {
  const exit = span(t, tout, tout + 0.35, ease.out);
  return {
    visible: t >= tin && exit < 1,
    alpha: 1 - exit,
    drift: -8 * exit,
    reveal: style === 'stagger'
      ? (i) => ease.expoOut(clamp((t - tin - i * 0.03) / 0.42))
      : null,
    mask: style === 'wipe' ? ease.inOut(clamp((t - tin) / 0.5)) : null,
  };
}

/**
 * Place a card from the timeline. Statements go on the bloom layer, data on the
 * annotation layer. o.lines splits the words across lines; o.text overrides the
 * words (for live readouts) while keeping the card's timing and fact.
 */
export function card(s, name, o = {}) {
  const c = s.cardOf(name);
  const voice = o.voice || (c.voice === 'final' ? 'final' : c.voice === 'statement' ? 'statement' : 'data');
  const env = cardEnvelope(s.t, c.in + (o.delay || 0), c.out, 0, o.style || 'stagger');
  if (!env.visible) return null;
  const g = voice === 'data' || voice === 'dataBold' ? s.ui : s.lineCtx;
  const lines = o.lines || [o.text ?? c.text];
  const size = o.size || (voice === 'data' ? 28 : 112);
  const lh = o.lineHeight || size * (voice === 'data' ? 1.45 : 1.08);
  const y0 = (o.y ?? 540) - ((lines.length - 1) * lh) / 2 + env.drift;
  let offset = 0;
  lines.forEach((ln, li) => {
    const base = offset;
    text(g, ln, o.x ?? 960, y0 + li * lh, {
      voice, size, align: o.align || 'center', alpha: env.alpha * (o.alpha ?? 1), color: o.color,
      fact: c.fact, scale: s.S, track: o.track, weight: o.weight,
      reveal: env.reveal ? (i, n) => env.reveal(base + i) : null, mask: env.mask, rise: o.rise,
    });
    offset += [...ln].length;
  });
  return { alpha: env.alpha, in: c.in, out: c.out };
}

/** Odometer digits: each place rolls into the next as the value passes through it. */
export function rollingNumber(g, value, x, y, o = {}) {
  const v = voiceOf(o.voice || 'dataBold');
  const size = o.size || 28, digits = o.digits || 4;
  const face = v.face, weight = v.weight;
  setFont(g, size, face, weight);
  const adv = layout(g, '0', size, face, weight, 0).width + (o.track ?? 0.04) * size;
  const total = adv * digits - (o.track ?? 0.04) * size;
  const x0 = (o.align || 'center') === 'center' ? x - total / 2 : x;
  g.textAlign = 'left'; g.textBaseline = 'middle';
  g.save();
  g.beginPath(); g.rect(x0 - 4, y - size * 0.62, total + 8, size * 1.24); g.clip();
  for (let p = 0; p < digits; p++) {
    const place = Math.pow(10, digits - 1 - p);
    const lower = value % place, whole = Math.floor(value / place);
    const roll = place === 1 ? value - Math.floor(value) : Math.max(0, lower - (place - 1));
    const d = ((whole % 10) + 10) % 10, f = clamp(roll);
    const cx = x0 + p * adv;
    g.fillStyle = rgba(o.color || v.color, (o.alpha ?? 1));
    g.fillText(String(d), cx, y - f * size * 1.1);
    if (f > 0.001) g.fillText(String((d + 1) % 10), cx, y + (1 - f) * size * 1.1);
  }
  g.restore();
  logText(g, o.scale || 1, {
    text: String(Math.round(value)), voice: 'data', fact: o.fact || 'structural:ruler', size, alpha: o.alpha ?? 1,
    x0, x1: x0 + total, y0: y - size / 2, y1: y + size / 2,
  });
}

// Engraved caps: glyphs filled with fine diagonal hatching and outlined, like letters
// cut into a plate. Patterns are cached per context.
const hatchPatterns = new WeakMap();
function hatchPattern(g, color, gap, vertical = false) {
  let byKey = hatchPatterns.get(g);
  if (!byKey) { byKey = new Map(); hatchPatterns.set(g, byKey); }
  const key = `${color}|${gap}|${vertical}`;
  if (byKey.has(key)) return byKey.get(key);
  const T = Math.max(3, Math.round(vertical ? gap : gap * Math.SQRT2));
  const c = document.createElement('canvas');
  c.width = c.height = T;
  const t = c.getContext('2d');
  t.strokeStyle = rgba(color, 1); t.lineWidth = 1.1;
  t.beginPath();
  if (vertical) { t.moveTo(T / 2, 0); t.lineTo(T / 2, T); }
  else for (const k of [-T, 0, T]) { t.moveTo(k - 1, T + 1); t.lineTo(k + T + 1, -1); }
  t.stroke();
  const pat = g.createPattern(c, 'repeat');
  byKey.set(key, pat);
  return pat;
}

/** Engraved display caps (statement face): hatched fill plus an outline, logged like text(). */
export function engraved(g, str, x, y, o = {}) {
  const v = voiceOf(o.voice || 'title');
  const size = o.size || 160, face = v.face, weight = o.weight || v.weight, track = o.track ?? v.track;
  const alpha = o.alpha ?? 1;
  if (alpha <= 0.002) return 0;
  const L = layout(g, str, size, face, weight, track);
  const x0 = (o.align || 'center') === 'center' ? x - L.width / 2 : x;
  setFont(g, size, face, weight);
  g.textAlign = 'left'; g.textBaseline = 'middle';
  const pat = hatchPattern(g, o.hatchColor || 'GOLD', o.gap ?? 4, !!o.vertical);
  g.lineJoin = 'round';
  for (let i = 0; i < L.chars.length; i++) {
    const k = o.reveal ? o.reveal(i, L.chars.length) : 1;
    if (k <= 0) continue;
    const gx = x0 + L.xs[i], gy = y + (1 - k) * size * (o.rise ?? 0.12);
    g.globalAlpha = alpha * k * (o.fillAlpha ?? 0.8);
    g.fillStyle = pat;
    g.fillText(L.chars[i], gx, gy);
    g.globalAlpha = 1;
    g.strokeStyle = rgba(o.color || 'GOLD_HOT', alpha * k);
    g.lineWidth = o.outline ?? 1.8;
    g.strokeText(L.chars[i], gx, gy);
  }
  if (o.log !== false) {
    logText(g, o.scale || 1, { text: str, voice: 'statement', fact: o.fact, size, alpha, x0, x1: x0 + L.width, y0: y - size * 0.5, y1: y + size * 0.5 });
  }
  return L.width;
}
