// OBS 11 · ACT III — THE ASSEMBLY LINE, 1913.
//   65.1  match cut: the flying machine's propeller, spinning on the globe's circle,
//         grows teeth and becomes the line's drive gear
//   65.2  the line runs out from it; four stations fit axles, engine, body and wheels,
//         each on its own 16th, while the chassis move strictly linearly
//   66.1  ABUNDANCE, BY DESIGN.  12 H 30 M → 1 H 33 M PER CAR
//   67.3  pull back: the lines multiply, the cars become a field of dots. ≈ 15 MILLION

import { scene, MATCH } from './common.js';
import { rgba } from '../theme.js';
import { ease, clamp, lerp, span } from '../engine.js';
import { stroke, circle, glow, dot } from '../draw/paths.js';
import { card, text } from '../draw/type.js';
import { gearPts, gear } from '../draw/gears.js';
import { assemblyLine, chassis, chassisX, LINE } from '../draw/conveyor.js';

const PROP_R = MATCH.r;
const ROWS = [-3, -2, -1, 1, 2, 3, 4];
const ROW_DY = 250;

export default scene('11_assembly', {
  camera(s) {
    const t = s.t;
    const z = Math.exp(lerp(0, Math.log(0.3), span(t, 5.0, 5.9, ease.inOut)));
    return { x: 960, y: lerp(540, 560, span(t, 5.0, 5.9)), zoom: z * (1 - 0.04 * span(t, 6, 8)) };
  },

  draw(ctx, s) {
    const t = s.t;
    s.bloom = 0.46;
    s.flash = 0.4 * Math.exp(-t / 0.12);
    const z = s.cam.zoom, lw = 1 / Math.max(z, 0.3);

    // The propeller on the globe's circle grows teeth and shrinks onto the drive sprocket.
    const grow = span(t, 0.12, 0.6, ease.inOut), move = span(t, 0.55, 1.3, ease.inOut);
    const cx = lerp(MATCH.cx, LINE.x0, move), cy = lerp(MATCH.cy, LINE.y + LINE.sprocket, move);
    const r = lerp(PROP_R, LINE.sprocket, move);
    const rot = t * 9 * (1 - 0.6 * move) + (LINE.speed * t) / LINE.sprocket * move;
    const blades = 1 - span(t, 0.1, 0.45);
    if (blades > 0) {
      for (const a of [rot, rot + Math.PI]) {
        const tip = [cx + Math.cos(a) * r * 0.96, cy + Math.sin(a) * r * 0.96];
        const side = [Math.cos(a + Math.PI / 2), Math.sin(a + Math.PI / 2)];
        stroke(ctx, [[cx, cy], [lerp(cx, tip[0], 0.45) + side[0] * 22, lerp(cy, tip[1], 0.45) + side[1] * 22], tip, [lerp(cx, tip[0], 0.5) - side[0] * 10, lerp(cy, tip[1], 0.5) - side[1] * 10], [cx, cy]], 1, { pen: { color: 'GOLD_HOT', alpha: blades, width: 2.4 }, tip: false });
      }
      circle(ctx, cx, cy, r, 1, { pen: { color: 'GOLD', alpha: 0.5 * blades, width: 1.2 }, tip: false });
    }
    if (grow > 0 && move < 1) {
      stroke(ctx, gearPts(cx, cy, r, 14, rot, r * 0.2 * grow), 1, { pen: { color: 'GOLD_HOT', alpha: 1, width: 2.6 }, tip: false });
      circle(ctx, cx, cy, r * 0.26, grow, { pen: { color: 'GOLD_HOT', alpha: 0.9, width: 2 }, tip: false });
    }
    const field0 = span(t, 5.8, 6.6, ease.inOut);
    if (move >= 1 && field0 < 1) gear(ctx, cx, cy, r, 14, rot, 1, { depth: 10, holes: 4, pen: { color: 'GOLD_HOT', alpha: 1 - field0, width: 2 } });

    // The line itself
    const build = span(t, 0.8, 1.8, ease.inOut);
    const field = span(t, 5.8, 6.6, ease.inOut);
    assemblyLine(ctx, s, t, { build, alpha: 1 - field, hitAt: i => i * 0.125, labels: 1 - span(t, 4.6, 5.0), noDrive: true, kind: '1913' });
    // Pulling back: more lines, the same rhythm, then every car becomes a dot.
    const rowsA = 0.6 * span(t, 5.1, 5.7) * (1 - field);
    if (rowsA > 0) for (const k of ROWS) {
      const dy = k * ROW_DY, ph = (k * 0.37) % 1;
      stroke(ctx, [[LINE.x0 - 2600, LINE.y + dy], [LINE.x1 + 2600, LINE.y + dy]], 1, { pen: { color: 'GOLD', alpha: 0.7 * rowsA, width: 1.6 * lw }, tip: false });
      for (let j = -9; j <= 14; j++) {
        const x = chassisX(j, t + ph) - 1300;
        chassis(ctx, x, LINE.y + dy, 4, { alpha: rowsA * 0.85, lw });
      }
    }
    if (field > 0) {
      s.screen(() => {
        // A field of dots: one per car, too many to draw, so the field stands in for them.
        const sp = 12, x0 = 108, x1 = 1812, y0 = 344, y1 = 920;
        const R = Math.hypot(960, 540) * field;
        for (let y = y0; y <= y1; y += sp) for (let x = x0; x <= x1; x += sp) {
          const d = Math.hypot(x - 960, y - 610);
          if (d > R) continue;
          const wave = 0.55 + 0.45 * Math.sin(d / 40 - t * 6);
          ctx.fillStyle = rgba(d > R - 40 ? 'GOLD_HOT' : 'GOLD', (0.35 + 0.5 * wave) * clamp((R - d) / 60));
          ctx.fillRect(x - 1.6, y - 1.6, 3.2, 3.2);
        }
        if (field < 1) glow(ctx, 960, 610, R * 0.3, 'GOLD_HOT', 0.2 * (1 - field));
      });
    }

    // Time per car: a dial sweeping down from twelve and a half hours to ninety-three minutes
    const ga = s.env('2.1', '2.2') * (1 - span(t, 4.8, 5.1));
    if (ga > 0) s.screen(() => {
      const gx = 1590, gy = 860, gr = 58;
      circle(ctx, gx, gy, gr, ga, { pen: { color: 'GOLD_HOT', alpha: ga, width: 2 }, tip: false, a0: Math.PI * 0.75 });
      ctx.strokeStyle = rgba('GOLD', 0.7 * ga); ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i <= 13; i++) { const a = Math.PI * 0.75 + (i / 13) * Math.PI * 1.5; ctx.moveTo(gx + Math.cos(a) * gr, gy + Math.sin(a) * gr); ctx.lineTo(gx + Math.cos(a) * (gr - 9), gy + Math.sin(a) * (gr - 9)); }
      ctx.stroke();
      const mins = lerp(750, 93, span(t, 2.2, 4.6, ease.inOut));
      const a = Math.PI * 0.75 + (mins / 60 / 13) * Math.PI * 1.5;
      stroke(ctx, [[gx, gy], [gx + Math.cos(a) * (gr - 6), gy + Math.sin(a) * (gr - 6)]], 1, { pen: { color: 'GOLD_HOT', alpha: ga, width: 2.4 }, tip: false });
      dot(ctx, gx, gy, 3.5, 'GOLD_HOT', ga);
      text(s.ui, 'TIME PER CAR', gx, gy - gr - 22, { voice: 'marker', size: 24, alpha: 0.85 * ga, scale: s.S });
    });
    s.screen(() => {
      card(s, 'card_design', { x: 960, y: 196, size: 100 });
      card(s, 'data_time', { x: 960, y: 860, size: 30, voice: 'dataBold' });
      card(s, 'data_built', { x: 960, y: 300, size: 34, voice: 'dataBold' });
    });
  },
});

