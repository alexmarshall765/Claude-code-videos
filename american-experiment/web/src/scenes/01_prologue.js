// OBS 01 · PROLOGUE. Black. One gold point ignites; a compass arm swings out from it
// and draws a perfect circle, the film's first construction line; 13 faint stars
// resolve on its rim. Washington's words for the experiment.

import { scene, MOTIF } from './common.js';
import { ease, clamp, lerp, TAU } from '../engine.js';
import { stroke, circle, glow, dot } from '../draw/paths.js';
import { compassTool, thirteen, starPts } from '../draw/motif.js';
import { card } from '../draw/type.js';

const { cx: CX, cy: CY, r: R } = MOTIF;

export default scene('01_prologue', {
  camera: s => MOTIF.zoomAbout(1 + 0.04 * ease.inOut(s.p)),
  draw(ctx, s) {
    s.bloom = 0.5;
    const t = s.t;
    // The point ignites, breathing faintly.
    const ig = s.cue('ignite', ease.expoOut);
    if (ig > 0) {
      const breathe = 1 + 0.12 * Math.sin(t * 3.1);
      glow(ctx, CX, CY, 46 * ig * breathe, 'GOLD_HOT', 0.5 * ig);
      dot(ctx, CX, CY, 3.2 * ig, 'GOLD_HOT', ig);
    }
    // Thirteen equal divisions, laid out in construction before the arm swings.
    const div = s.env('1.4', '2.2', ease.out) * (1 - 0.8 * s.env('3.2', '4.4'));
    if (div > 0) {
      for (const [, , a] of thirteen(CX, CY, R)) {
        stroke(ctx, [[CX + Math.cos(a) * (R - 18), CY + Math.sin(a) * (R - 18)], [CX + Math.cos(a) * (R + 18), CY + Math.sin(a) * (R + 18)]], div,
          { pen: 'construction', tip: false });
      }
    }
    // The compass: opens (1.4 → 2.2), sweeps the circle (2.2 → 3.2), lifts away.
    const open = s.cue('compass_open', ease.inOut);
    const sweep = s.cue('circle', ease.inOut);
    const a0 = -Math.PI / 2;
    const away = s.env('3.2', '3.4', ease.in);
    const d = R * open;
    if (open > 0 && away < 1) {
      const a = a0 + sweep * TAU;
      compassTool(ctx, CX, CY, d, a, 1 - away, 262 + 60 * away);
    }
    if (sweep > 0) {
      const p = sweep;
      const settle = s.env('3.2', '4.2');
      // The construction line: fine at first, settling to structure weight.
      circle(ctx, CX, CY, R, p, { pen: { color: 'GOLD', alpha: lerp(0.9, 0.85, settle), width: lerp(1.3, 2.2, settle) }, a0, tip: p < 1 });
      // Radius construction line while drawing
      if (p < 1) {
        const a = a0 + p * TAU;
        stroke(ctx, [[CX, CY], [CX + Math.cos(a) * R, CY + Math.sin(a) * R]], 1, { pen: 'construction', tip: false, dash: [5, 6] });
      }
    }
    // Thirteen faint stars resolve on the rim, one per eighth note.
    s.hits('stars').forEach((h, k) => {
      const q = clamp((t - h.t0) / (h.t1 - h.t0));
      if (q <= 0) return;
      const [x, y] = thirteen(CX, CY, R)[k];
      const e = ease.expoOut(q);
      glow(ctx, x, y, 22 * e * (1 + 0.6 * Math.exp(-(t - h.t0) / 0.15)), 'GOLD_HOT', 0.35 * e);
      stroke(ctx, starPts(x, y, 11 * e), q, { pen: { color: 'GOLD_HOT', alpha: 0.85, width: 1.3 }, closed: true, tip: false });
    });
    // Words
    card(s, 'card_staked', { x: 960, y: 724, size: 96 });
    card(s, 'card_entrusted', { x: 960, y: 818, size: 28 });
    card(s, 'attrib_washington', { x: 960, y: 866, size: 24, alpha: 0.8 });
    // The reverse swell gathers the light toward the centre before the title.
    const sw = s.cue('swell', ease.in);
    if (sw > 0) glow(ctx, CX, CY, R * (0.4 + 0.7 * sw), 'GOLD_HOT', 0.18 * sw);
  },
});
