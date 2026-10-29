// Shared scene plumbing: the exported scene contract and the motif circle's home.

import { W, H } from '../theme.js';

/**
 * A scene module exports { id, startBar, bars, draw(ctx, s) } plus an optional camera(s).
 * startBar and bars are filled in from timeline.json when the film loads, so a scene's
 * length lives in exactly one place.
 */
export function scene(id, def) {
  return { id, startBar: null, bars: null, ...def };
}

/** Camera that zooms by z while keeping world point (px, py) fixed on screen. */
export function zoomAbout(px, py, z, dx = 0, dy = 0) {
  return { x: px + (W / 2 - px) / z + dx, y: py + (H / 2 - py) / z + dy, zoom: z };
}

/** Where the motif circle lives in the prologue and title, so the two cut on its geometry. */
export const MOTIF = {
  cx: 960, cy: 380, r: 220,
  zoomAbout: z => zoomAbout(960, 380, z),
};
