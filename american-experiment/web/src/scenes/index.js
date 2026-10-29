// Scene registry: one module per observation. Unbuilt observations run as slates.

import prologue from './01_prologue.js';
import title from './02_title.js';
import founding from './03_founding.js';
import constitution from './04_constitution.js';
import expansion from './05_expansion.js';
import roads from './06_roads.js';
import liberty from './07_liberty.js';
import steel from './08_steel.js';
import light from './09_light.js';
import flight from './10_flight.js';
import assembly from './11_assembly.js';
import arsenal from './12_arsenal.js';
import boom from './13_boom.js';
import apollo from './14_apollo.js';
import silicon from './15_silicon.js';
import { placeholder } from './placeholder.js';

const built = [prologue, title, founding, constitution, expansion, roads, liberty, steel, light, flight, assembly, arsenal, boom, apollo, silicon];

export function sceneModules(timeline) {
  const byId = Object.fromEntries(built.map(m => [m.id, m]));
  return Object.fromEntries(timeline.scenes.map(sc => [sc.id, byId[sc.id] || placeholder(sc.id)]));
}
