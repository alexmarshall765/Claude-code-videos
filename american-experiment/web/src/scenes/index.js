// Scene registry: one module per observation. Unbuilt observations run as slates.

import prologue from './01_prologue.js';
import title from './02_title.js';
import apollo from './14_apollo.js';
import { placeholder } from './placeholder.js';

const built = [prologue, title, apollo];

export function sceneModules(timeline) {
  const byId = Object.fromEntries(built.map(m => [m.id, m]));
  return Object.fromEntries(timeline.scenes.map(sc => [sc.id, byId[sc.id] || placeholder(sc.id)]));
}
