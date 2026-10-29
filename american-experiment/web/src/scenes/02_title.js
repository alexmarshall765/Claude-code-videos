// OBS 02 · TITLE. The compass circle becomes a sun disc; a torch draws inside it,
// its flame layered Bézier tongues on seeded noise; 13 rays turn behind.

import { scene, MOTIF } from './common.js';
import { ease } from '../engine.js';
import { glow, stroke } from '../draw/paths.js';
import { sunDisc, thirteen, starPts } from '../draw/motif.js';
import { torch } from '../draw/torch.js';
import { card } from '../draw/type.js';

const { cx: CX, cy: CY, r: R } = MOTIF;

export default scene('02_title', {
  camera: s => MOTIF.zoomAbout(1.04 + 0.03 * ease.inOut(s.p)),
  draw(ctx, s) {
    const t = s.t;
    const hit = Math.exp(-t / 0.35);
    s.bloom = 0.42 + 0.25 * hit;
    s.glow = 0.55 * hit;
    const rot = t * 0.035;
    // Impact: the construction circle flares into the hero ring of a sun disc.
    const rays = s.cue('rays', ease.expoOut);
    sunDisc(ctx, CX, CY, R, 1, rays, rot, { hot: 0.6 + 0.4 * hit, rayLen: 330, downFade: 1 });
    glow(ctx, CX, CY, R * 1.35, 'GOLD_HOT', 0.22 * hit + 0.05);
    // The 13 stars ride the rays' roots.
    thirteen(CX, CY, R, rot).forEach(([x, y]) => {
      stroke(ctx, starPts(x, y, 10 + 3 * hit), 1, { pen: { color: 'GOLD_HOT', alpha: 0.85, width: 1.3 }, closed: true, tip: false });
    });
    // The torch, construction first; the flame lights on 6.3.
    const tp = s.cue('torch', ease.inOut);
    const fl = s.cue('flame', ease.out);
    torch(ctx, CX, CY + 18, 0.7, tp, s.T, fl * (1 + 0.04 * Math.sin(t * 7)));
    // Title, tagline and dates
    card(s, 'card_title', { text: 'THE AMERICAN', x: 960, y: 704, size: 96, track: 0.12 });
    card(s, 'card_title', { text: 'EXPERIMENT', x: 960, y: 826, size: 156, voice: 'title', delay: 0.25 });
    card(s, 'card_tagline', { lines: ['A NATION CONCEIVED', 'IN LIBERTY.'], x: 960, y: 760, size: 96 });
    card(s, 'card_dates', { x: 960, y: 900, size: 34, voice: 'dataBold' });
  },
});
