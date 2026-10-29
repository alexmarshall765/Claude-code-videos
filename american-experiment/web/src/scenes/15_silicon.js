// OBS 15 · ACT V · THE ACCELERATION — SILICON, 1947–2023.
//   93.1  the transistor planted in OBS 13 flies out of its corner and fills the frame
//   95.1  it tiles into an integrated circuit (1958)
//   97.1  then the 1971 microprocessor die: 2,300 transistors in gold rectilinear patterns
//   98.1  a log-scale curve climbs past 100 billion transistors per chip
//   99.3  a 32nd-note stutter   99.4  the die pulls back to a wafer, then a computer
//   Every two bars a doubling marker pulses (the arp steps up with it).

import { scene, SEED } from './common.js';
import { rgba } from '../theme.js';
import { ease, clamp, lerp, sub, span, TAU, mulberry32 } from '../engine.js';
import { stroke, circle } from '../draw/paths.js';
import { card, text } from '../draw/type.js';
import { transistor } from '../draw/icons.js';
import { scales, axes, series } from '../draw/charts.js';

const CHIP = [[1971, 2300], [1974, 4500], [1978, 29000], [1982, 134000], [1985, 275000], [1989, 1180000], [1993, 3100000], [1997, 7500000], [2000, 42000000], [2003, 410000000], [2006, 1720000000], [2010, 2300000000], [2012, 5000000000], [2015, 10000000000], [2017, 19200000000], [2019, 39540000000], [2021, 57000000000], [2022, 114000000000], [2023, 134000000000]];
const SC = scales({ x: 900, y: 360, w: 860, h: 470 }, [1971, 2023], [1e3, 1e12], { log: true });

// The 1971 die: 16 bond pads, blocks of gates, metal routing; 2,300 gate marks in all.
const DIE = { w: 400, h: 520 };
const GATES = (() => {
  const R = mulberry32(4004), blocks = [], gates = [];
  const cols = 4, rows = 5;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    if (R() < 0.12) continue;
    const bw = DIE.w / cols, bh = DIE.h / rows;
    blocks.push({ x: -DIE.w / 2 + i * bw + 14, y: -DIE.h / 2 + j * bh + 14, w: bw - 28, h: bh - 28 });
  }
  let k = 0;
  while (gates.length < 2300 && k < 20000) {
    const b = blocks[k % blocks.length], n = Math.floor(k / blocks.length);
    const per = Math.floor(b.w / 6), r = Math.floor(n / per), c = n % per;
    if (r * 5 < b.h - 4) gates.push([b.x + c * 6, b.y + r * 5]);
    k++;
  }
  const wires = [];
  for (let i = 0; i < 60; i++) {
    const x = -DIE.w / 2 + 20 + R() * (DIE.w - 40), y = -DIE.h / 2 + 20 + R() * (DIE.h - 40);
    wires.push(R() < 0.5 ? [[x, y], [x + (R() - 0.5) * 220, y]] : [[x, y], [x, y + (R() - 0.5) * 260]]);
  }
  return { blocks, gates, wires };
})();

function die(g, cx, cy, s, p, a = 1) {
  if (p <= 0 || a <= 0) return;
  const P = (x, y) => [cx + x * s, cy + y * s];
  stroke(g, [P(-DIE.w / 2, -DIE.h / 2), P(DIE.w / 2, -DIE.h / 2), P(DIE.w / 2, DIE.h / 2), P(-DIE.w / 2, DIE.h / 2)], clamp(p * 3), { pen: { color: 'GOLD_HOT', alpha: a, width: 2 }, closed: true, tip: false });
  for (let i = 0; i < 16; i++) {
    const side = i < 8 ? -1 : 1, k = i % 8;
    const [x, y] = P(side * (DIE.w / 2 - 14), -DIE.h / 2 + 40 + k * ((DIE.h - 80) / 7));
    stroke(g, [[x - 7 * s, y - 7 * s], [x + 7 * s, y - 7 * s], [x + 7 * s, y + 7 * s], [x - 7 * s, y + 7 * s]], clamp(p * 3 - 0.5), { pen: { color: 'GOLD', alpha: a, width: 1.2 }, closed: true, tip: false });
  }
  const scan = -DIE.h / 2 + DIE.h * clamp(p * 1.25 - 0.1);
  for (const b of GATES.blocks) {
    if (b.y > scan) continue;
    stroke(g, [P(b.x - 4, b.y - 4), P(b.x + b.w, b.y - 4), P(b.x + b.w, b.y + b.h), P(b.x - 4, b.y + b.h)], 1, { pen: { color: 'GOLD', alpha: 0.45 * a, width: 1 }, closed: true, tip: false });
  }
  g.fillStyle = rgba('GOLD', 0.75 * a);
  for (const [x, y] of GATES.gates) if (y < scan) { const [px, py] = P(x, y); g.fillRect(px, py, 4 * s, 2.6 * s); }
  for (const w of GATES.wires) if (w[0][1] < scan) stroke(g, w.map(([x, y]) => P(x, y)), 1, { pen: { color: 'GOLD_HOT', alpha: 0.55 * a, width: 1.2 }, tip: false });
  if (p < 1) stroke(g, [P(-DIE.w / 2 - 20, scan), P(DIE.w / 2 + 20, scan)], 1, { pen: { color: 'GOLD_HOT', alpha: 0.8 * a, width: 1.6 }, tip: false });
}

function computer(g, cx, cy, p, t) {
  if (p <= 0) return;
  const P = { color: 'GOLD', alpha: 0.95, width: 2 };
  stroke(g, [[cx - 170, cy - 230], [cx + 170, cy - 230], [cx + 170, cy + 10], [cx - 170, cy + 10]], sub(p, 0, 0.4), { pen: { ...P, color: 'GOLD_HOT' }, closed: true });
  stroke(g, [[cx - 146, cy - 206], [cx + 146, cy - 206], [cx + 146, cy - 14], [cx - 146, cy - 14]], sub(p, 0.15, 0.5), { pen: P, closed: true, tip: false });
  stroke(g, [[cx - 40, cy + 10], [cx - 60, cy + 56], [cx + 60, cy + 56], [cx + 40, cy + 10]], sub(p, 0.3, 0.6), { pen: P, tip: false });
  stroke(g, [[cx - 210, cy + 80], [cx + 210, cy + 80], [cx + 240, cy + 140], [cx - 240, cy + 140]], sub(p, 0.4, 0.75), { pen: P, closed: true, tip: false });
  const kq = sub(p, 0.6, 1);
  if (kq > 0) {
    g.strokeStyle = rgba('GOLD', 0.55 * kq); g.lineWidth = 1; g.beginPath();
    for (let r = 0; r < 4; r++) for (let c = 0; c < 15; c++) {
      const y = cy + 90 + r * 12, x = cx - 200 + c * 27 + r * 8;
      g.rect(x, y, 20, 8);
    }
    g.stroke();
    // A prompt on the screen
    text(g, '>', cx - 120, cy - 170, { voice: 'dataBold', size: 28, align: 'left', alpha: kq, log: false });
    if (Math.floor(t * 2.5) % 2 === 0) g.fillRect(cx - 98, cy - 182, 14, 24);
  }
}

export default scene('15_silicon', {
  camera(s) {
    const t = s.t;
    const glitch = t > 13 && t < 13.5 ? (Math.floor(t * 16) % 2 ? 1 : -1) * 6 : 0;
    return { x: 960 + glitch, y: 540, zoom: 1 };
  },

  draw(ctx, s) {
    const t = s.t;
    s.bloom = 0.48;
    s.flash = 0.25 * Math.exp(-t / 0.12);
    // Doubling markers: a pulse every two bars
    s.hits('doubling').forEach(h => {
      const age = t - h.t0;
      if (age < 0 || age > 0.8) return;
      s.screen(() => circle(ctx, 960, 580, 60 + 520 * ease.expoOut(age / 0.8), 1, { pen: { color: 'GOLD_HOT', alpha: 0.25 * (1 - age / 0.8), width: 2 }, tip: false }));
    });

    // The transistor flies out of its corner and fills the frame, then tiles.
    const fly = span(t, 0, 1.4, ease.inOut);
    const tile = span(t, 4.0, 5.2, ease.inOut);
    const ta = 1 - span(t, 7.6, 8.1);
    if (ta > 0) {
      const big = 1.9, small = 0.34;
      const scl = lerp(lerp(SEED.s, big, fly), small, tile);
      const cx = lerp(SEED.x, 960, fly), cy = lerp(SEED.y, 600, fly);
      const n = tile > 0 ? (t < 6 ? 2 : 4) : 1;
      const pitch = 270 * small;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const ox = (i - (n - 1) / 2) * 270 * scl, oy = (j - (n - 1) / 2) * 270 * scl;
        const born = i === 0 && j === 0 ? 0 : t < 6 ? 4.4 : 6.0;
        transistor(ctx, cx + ox, cy + oy, scl, { alpha: ta * clamp((t - born) / 0.25 + (n === 1 ? 1 : 0)), glint: Math.exp(-t / 0.5) });
      }
      // The slab and the gold wires of the first integrated circuit
      if (tile > 0) {
        const half = (n * pitch) / 2 + 30;
        stroke(ctx, [[cx - half, cy - half], [cx + half, cy - half], [cx + half, cy + half], [cx - half, cy + half]], tile, { pen: { color: 'GOLD_HOT', alpha: ta, width: 2 }, closed: true });
        for (let i = 0; i < n * 2; i++) {
          const y = cy - half + 20 + (i * (2 * half - 40)) / (n * 2 - 1);
          stroke(ctx, [[cx - half - 40, y], [cx - half, y], [cx - half + 30, y + 14]], tile, { pen: { color: 'GOLD', alpha: 0.7 * ta, width: 1.2 }, tip: false });
        }
        text(s.ui, 'INTEGRATED CIRCUIT · 1958', 960, 920, { voice: 'data', size: 26, alpha: 0.85 * s.env('3.1', '3.2') * ta, fact: 'ic_1958', scale: s.S });
      }
    }

    // The 1971 die, scanned in; then it moves left as the curve climbs, and pulls back to a wafer.
    const dp = s.cue('die', ease.inOut);
    const toLeft = span(t, 10.0, 10.8, ease.inOut), pull = span(t, 13.5, 14.8, ease.inOut), pc = span(t, 14.8, 16, ease.inOut);
    const dx = lerp(960, 420, toLeft), dy = lerp(600, 600, toLeft), dsc = lerp(1, 0.78, toLeft) * lerp(1, 0.09, pull);
    die(ctx, dx, dy, dsc, dp, 1 - pc);
    if (pull > 0) {
      // The wafer: a disc of dies with its flat, the one we came from still glowing
      const wr = 260 * pull * (1 - 0.45 * pc), wx = lerp(dx, 420, pc), wy = lerp(dy, 470, pc);
      ctx.save(); ctx.beginPath(); ctx.arc(wx, wy, wr, 0, TAU); ctx.clip();
      g_grid(ctx, wx, wy, wr, DIE.w * dsc, DIE.h * dsc, pull * (1 - pc));
      ctx.restore();
      circle(ctx, wx, wy, wr, pull, { pen: { color: 'GOLD_HOT', alpha: 1 - pc, width: 2.4 }, tip: false });
      stroke(ctx, [[wx - wr * 0.4, wy + wr * 0.92], [wx + wr * 0.4, wy + wr * 0.92]], pull, { pen: { color: 'GOLD_HOT', alpha: 1 - pc, width: 2.4 }, tip: false });
    }
    computer(ctx, 420, 640, pc, t);
    card(s, 'data_4004', { x: 960, y: 900, size: 30, voice: 'dataBold' });

    // Transistors per chip, on a log scale: past 100 billion
    const cp = s.env('6.1', '8.3', ease.inOut);
    if (cp > 0) {
      axes(s, ctx, SC, clamp(cp * 3), { xTicks: [1971, 2023], fact: 'chip_curve', title: 'TRANSISTORS PER CHIP · LOG SCALE', titleFact: 'chip_curve', yGrid: [1e3, 1e5, 1e7, 1e9, 1e11] });
      const yb = SC.Y(1e11);
      const tip = series(ctx, SC, CHIP, clamp(cp * 1.1 - 0.05), { pen: { color: 'GOLD_HOT', alpha: 1, width: 3.2 }, n: 6 });
      const crossed = tip && tip[1] <= yb;
      stroke(ctx, [[SC.box.x, yb], [SC.box.x + SC.box.w, yb]], clamp(cp * 3), { pen: { color: crossed ? 'GOLD_HOT' : 'GOLD', alpha: crossed ? 0.9 : 0.35, width: crossed ? 1.6 : 1 }, tip: false, dash: [8, 6] });
      text(s.ui, '100 BILLION', SC.box.x + SC.box.w, yb - 22, { voice: crossed ? 'dataBold' : 'data', size: 24, align: 'right', alpha: 0.9 * clamp(cp * 3), fact: 'chip_curve', scale: s.S });
      text(s.ui, '2,300', SC.box.x + 12, SC.Y(2300) - 22, { voice: 'data', size: 24, align: 'left', alpha: 0.8 * clamp(cp * 3), fact: 'chip_curve', scale: s.S });
      // The stutter on 99.3: the curve's tip judders in 32nds.
      if (t > 13 && t < 13.5 && tip) for (let k = 1; k <= 2; k++) stroke(ctx, [[tip[0] - 60, tip[1] + k * 6], [tip[0], tip[1] + k * 6]], 1, { pen: { color: 'GOLD_HOT', alpha: 0.5, width: 2 }, tip: false });
    }

    s.screen(() => {
      card(s, 'card_transistor', { x: 960, y: 196, size: 100 });
      card(s, 'data_transistor', { x: 960, y: 286, size: 30, voice: 'dataBold' });
      card(s, 'card_sand', { x: 960, y: 196, size: 100 });
    });
  },
});

/** The grid of dies on a wafer. */
function g_grid(g, cx, cy, r, w, h, a) {
  if (a <= 0) return;
  g.strokeStyle = rgba('GOLD', 0.5 * a); g.lineWidth = 1; g.beginPath();
  for (let x = cx - w / 2 - Math.ceil(r / w) * w; x < cx + r; x += w) { g.moveTo(x, cy - r); g.lineTo(x, cy + r); }
  for (let y = cy - h / 2 - Math.ceil(r / h) * h; y < cy + r; y += h) { g.moveTo(cx - r, y); g.lineTo(cx + r, y); }
  g.stroke();
  g.fillStyle = rgba('GOLD', 0.12 * a);
  g.fillRect(cx - w / 2, cy - h / 2, w, h);
}

