#!/usr/bin/env node
// Print the resolved cue sheet: every scene and cue with global bar.beat addresses and timecodes.
//   node render/cues.mjs [scene-id]

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Timeline } from '../web/src/timeline.js';
import { ROOT } from './serve.mjs';

const tl = new Timeline(JSON.parse(readFileSync(join(ROOT, 'timeline.json'), 'utf8')));
const only = process.argv[2];
const tc = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;
for (const s of tl.scenes) {
  if (only && !s.id.includes(only)) continue;
  console.log(`\nOBS ${String(s.obs).padStart(2, '0')}  ${s.marker}  ·  bars ${s.startBar}–${s.startBar + s.bars - 1}  ·  ${tc(s.start)}–${tc(s.end)}`);
  for (const c of Object.values(s.cueMap)) {
    const h = c.hits, first = h[0];
    const where = h.length > 1 ? `${tl.label(first.t0)} ×${h.length}` : `${tl.label(first.t0)}${c.to ? ` → ${tl.label(first.t1)}` : ''}`;
    const what = c.card ? `"${c.card.text}"` : c.audio ? `♪ ${c.audio.type}` : '';
    console.log(`  ${tc(first.t0)}  ${where.padEnd(16)} ${c.name.padEnd(20)} ${what}`);
  }
}
