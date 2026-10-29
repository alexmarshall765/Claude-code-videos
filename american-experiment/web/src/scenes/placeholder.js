// Storyboard slate for observations that are not drawn yet. It runs the scene's real
// cards on their real cues over a slowly turning circle that ticks on every cue hit,
// so the whole film can be previewed against the score before every scene exists.

import { scene } from './common.js';
import { ease, TAU } from '../engine.js';
import { circle, stroke, glow } from '../draw/paths.js';
import { card, text, textWidth } from '../draw/type.js';

function split(g, str, size) {
  if (textWidth(g, str, { voice: 'statement', size }) < 1560) return [str];
  const words = str.split(' ');
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
    const w = Math.max(textWidth(g, a, { voice: 'statement', size }), textWidth(g, b, { voice: 'statement', size }));
    if (!best || w < best.w) best = { w, lines: [a, b] };
  }
  return best.lines;
}

export function placeholder(id) {
  return scene(id, {
    placeholder: true,
    draw(ctx, s) {
      const sc = s.scene, t = s.t;
      s.bloom = 0.45;
      const cx = 960, cy = 470, r = 300;
      const intro = s.env(0, 0.6, ease.out);
      circle(ctx, cx, cy, r, intro, { pen: { color: 'GOLD', alpha: 0.35, width: 1.2 }, tip: false, a0: -Math.PI / 2 + t * 0.05 });
      circle(ctx, cx, cy, r - 14, intro, { pen: 'construction', tip: false, a0: Math.PI / 2 - t * 0.03 });
      // One tick per cue hit, flaring as it lands.
      const hits = Object.values(sc.cueMap).filter(c => !c.card).flatMap(c => c.hits);
      for (const h of hits) {
        const lt = h.t0 - sc.start, a = -Math.PI / 2 + (lt / sc.dur) * TAU;
        const age = t - lt;
        const on = age >= 0;
        const flare = on ? Math.exp(-age / 0.25) : 0;
        const x0 = cx + Math.cos(a) * (r + 6), y0 = cy + Math.sin(a) * (r + 6);
        stroke(ctx, [[x0, y0], [cx + Math.cos(a) * (r + 18 + 14 * flare), cy + Math.sin(a) * (r + 18 + 14 * flare)]], intro,
          { pen: { color: on ? 'GOLD_HOT' : 'GOLD', alpha: on ? 0.9 : 0.3, width: on ? 2 : 1 }, tip: false });
        if (flare > 0.02) glow(ctx, x0, y0, 30 * flare, 'GOLD_HOT', 0.5 * flare);
      }
      // Playhead
      const a = -Math.PI / 2 + s.p * TAU;
      stroke(ctx, [[cx + Math.cos(a) * (r - 24), cy + Math.sin(a) * (r - 24)], [cx + Math.cos(a) * (r + 30), cy + Math.sin(a) * (r + 30)]], intro,
        { pen: { color: 'GOLD_HOT', alpha: 0.9, width: 2.4 }, tip: false });
      // Slate line
      s.screen(() => {
        text(s.ui, `SLATE · OBS. ${String(sc.obs).padStart(2, '0')} · ${sc.dates} · IN PRODUCTION`, 960, 168,
          { voice: 'data', size: 26, alpha: 0.75 * intro, fact: ['structural:obs', 'structural:dates'], scale: s.S });
      });
      // The scene's own cards, on their own cues
      let dataRow = 0;
      for (const c of Object.values(sc.cueMap)) {
        if (!c.card) continue;
        const live = s.t >= c.hits[0].t0 - sc.start && s.t <= c.hits[0].t1 - sc.start + 0.4;
        if (c.card.voice === 'data') {
          if (live) card(s, c.name, { x: 960, y: 760 + 46 * (dataRow % 3), size: 28 });
          if (live) dataRow++;
        } else {
          card(s, c.name, { lines: split(s.lineCtx, c.card.text, 104), x: 960, y: 470, size: 104 });
        }
      }
    },
  });
}
