// Palette tokens, type faces and pen weights: the film's whole visual vocabulary.
// Every colour on screen comes from PALETTE through rgba(); nothing else names a colour.

export const W = 1920, H = 1080;

export const PALETTE = {
  INK: [7, 8, 11],            // #07080B background for most scenes
  PARCHMENT: [232, 220, 192], // #E8DCC0 Act I only, aged texture at 10–15 % under the ink
  GOLD: [212, 175, 55],       // #D4AF37 primary line work
  GOLD_HOT: [246, 215, 122],  // #F6D77A highlights, glow cores, the active element
  CRIMSON: [158, 27, 27],     // #9E1B1B rare accents
  WHITE: [244, 241, 234],     // #F4F1EA stars, exhaust cores, the final word
  NAVY: [11, 22, 38],         // #0B1626 radial glow behind space scenes only
};
// GOLD_DIM is GOLD at 25 % alpha: grids, construction lines, inactive data.
export const GOLD_DIM_ALPHA = 0.25;

export function rgba(token, a = 1) {
  const c = PALETTE[token];
  if (!c) throw new Error(`unknown palette token ${token}`);
  return `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a))})`;
}
export const dim = (a = 1) => rgba('GOLD', GOLD_DIM_ALPHA * a);

export const FONT = {
  statement: '"Cormorant Garamond", serif', // caps, +4 % tracking, 96–160 px
  marker: '"Jost", sans-serif',             // act/chapter markers, +25 % tracking, 22–28 px
  data: '"JetBrains Mono", monospace',      // data, dates, coordinates, 24–34 px
};
export const WEIGHT = { statement: 600, title: 700, marker: 500, data: 400, dataBold: 600 };
export const TRACK = { statement: 0.04, marker: 0.25, data: 0.06 };
export const MIN_TEXT_PX = 24;

// Three line weights. Hero lines get the brightest colour, so the bloom pass picks them out.
export const PEN = {
  construction: { color: 'GOLD', alpha: GOLD_DIM_ALPHA, width: 1 },
  structure: { color: 'GOLD', alpha: 1, width: 2.5 },
  hero: { color: 'GOLD_HOT', alpha: 1, width: 5 },
};

// The 90 % title-safe area every text box must stay inside.
export const SAFE = { x0: W * 0.05, y0: H * 0.05, x1: W * 0.95, y1: H * 0.95 };
