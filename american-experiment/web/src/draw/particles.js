// Stateless particles. Particle i is born at t0 + i / rate with its own seeded
// randomness, so its position at any time is a closed-form function: no simulation
// state, and any frame can be rendered on its own.

import { rgba } from '../theme.js';
import { TAU, mulberry32, clamp } from '../engine.js';

/**
 * Visit every live particle of an emitter at time t.
 * spec: { seed, rate, t0, t1 (stop emitting), life: [min, max] }
 * visit(i, born, age, u, R) where u = age / life and R() is that particle's PRNG.
 */
export function eachParticle(spec, t, visit) {
  const { seed, rate, t0, t1 = Infinity, life } = spec;
  if (t < t0) return;
  const tEnd = Math.min(t, t1);
  const iMax = Math.floor((tEnd - t0) * rate);
  const iMin = Math.max(0, Math.floor((t - t0 - life[1]) * rate));
  for (let i = iMin; i <= iMax; i++) {
    const born = t0 + i / rate;
    if (born > t) break;
    const R = mulberry32((seed * 2654435761) ^ (i * 40503 + 0x5bd1e995));
    const L = life[0] + (life[1] - life[0]) * R();
    const age = t - born;
    if (age > L) continue;
    visit(i, born, age, age / L, R);
  }
}

/** Distance travelled under linear drag k after `age` seconds at initial speed v. */
export const dragged = (v, k, age) => (k > 0 ? (v * (1 - Math.exp(-k * age))) / k : v * age);

/**
 * Rocket exhaust: a white-cored, gold-edged plume streaming from nozzle(born).
 * nozzle(t) -> [x, y] screen position at emission time; dir is the plume direction (radians).
 */
export function plume(g, t, o) {
  const prev = g.globalCompositeOperation;
  g.globalCompositeOperation = 'lighter';
  eachParticle({ seed: o.seed, rate: o.rate, t0: o.t0, t1: o.t1, life: o.life || [0.35, 0.9] }, t, (i, born, age, u, R) => {
    const [nx, ny] = o.nozzle(born, i);
    const spread = (R() - 0.5) * (o.spread ?? 0.5) * (0.4 + u);
    const speed = (o.speed ?? 900) * (0.6 + 0.5 * R());
    const a = (o.dir ?? Math.PI / 2) + spread;
    const d = dragged(speed, o.drag ?? 2.2, age);
    const x = nx + Math.cos(a) * d + (R() - 0.5) * 6;
    const y = ny + Math.sin(a) * d + (o.gravity ?? 0) * age * age;
    const size = (o.size ?? 3) * (0.6 + 1.6 * u) * (0.6 + 0.8 * R()) * (o.scale ?? 1);
    const core = u < (o.coreU ?? 0.18);
    const fade = (1 - u) * (1 - u) * (o.alpha ?? 1);
    g.fillStyle = core ? rgba('WHITE', 0.8 * fade) : rgba(u < 0.45 ? 'GOLD_HOT' : 'GOLD', 0.55 * fade);
    g.beginPath(); g.arc(x, y, size, 0, TAU); g.fill();
  });
  g.globalCompositeOperation = prev;
}

/**
 * Billows: expanding line-art rings (a ground cloud, dust, vapour). Each particle is a
 * stroked circle that grows and fades, so clouds stay in the film's line language.
 */
export function billows(g, t, o) {
  eachParticle({ seed: o.seed, rate: o.rate, t0: o.t0, t1: o.t1, life: o.life || [1.2, 2.4] }, t, (i, born, age, u, R) => {
    const [sx, sy] = o.source(born, i, R);
    const a = (o.dir ?? 0) + (R() - 0.5) * (o.spread ?? TAU);
    const speed = (o.speed ?? 200) * (0.4 + 0.8 * R());
    const d = dragged(speed, o.drag ?? 1.6, age);
    const x = sx + Math.cos(a) * d, y = sy + Math.sin(a) * d - (o.rise ?? 0) * age;
    const r = (o.r0 ?? 6) + (o.grow ?? 40) * (1 - Math.exp(-2 * age)) * (0.5 + R());
    g.strokeStyle = rgba(o.color || 'GOLD', (o.alpha ?? 0.5) * (1 - u) * clamp(age * 6));
    g.lineWidth = o.width ?? 1.2;
    // o.scallop draws only the upper arc, so overlapping billows read as a cloud bank.
    g.beginPath();
    if (o.scallop) g.arc(x, y, r, Math.PI * 1.08, Math.PI * 1.92); else g.arc(x, y, r, 0, TAU);
    g.stroke();
  });
}

/** Sparks: short bright streaks along their velocity, falling under gravity. */
export function sparks(g, t, o) {
  const prev = g.globalCompositeOperation;
  g.globalCompositeOperation = 'lighter';
  eachParticle({ seed: o.seed, rate: o.rate, t0: o.t0, t1: o.t1, life: o.life || [0.3, 0.9] }, t, (i, born, age, u, R) => {
    const [sx, sy] = o.source(born, i, R);
    const a = (o.dir ?? -Math.PI / 2) + (R() - 0.5) * (o.spread ?? 2.4);
    const v = (o.speed ?? 600) * (0.4 + 0.8 * R());
    const k = o.drag ?? 2.5, gr = o.gravity ?? 900;
    const pos = tt => [sx + Math.cos(a) * dragged(v, k, tt), sy + Math.sin(a) * dragged(v, k, tt) + 0.5 * gr * tt * tt];
    const [x1, y1] = pos(age), [x0, y0] = pos(Math.max(0, age - 0.035));
    g.strokeStyle = rgba(u < 0.3 ? 'WHITE' : 'GOLD_HOT', (1 - u) * (o.alpha ?? 1));
    g.lineWidth = o.width ?? 1.6;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  });
  g.globalCompositeOperation = prev;
}

/**
 * A rocket engine's flame: a tapered cone, white at the nozzle, gold along the body,
 * fading out. dir is the direction it streams (radians).
 */
export function flameCone(g, x, y, len, w0, w1, k, dir = Math.PI / 2) {
  if (k <= 0 || len <= 0) return;
  const prev = g.globalCompositeOperation;
  g.globalCompositeOperation = 'lighter';
  g.save();
  g.translate(x, y); g.rotate(dir - Math.PI / 2);
  const gr = g.createLinearGradient(0, 0, 0, len);
  gr.addColorStop(0, rgba('WHITE', 0.95 * k));
  gr.addColorStop(0.16, rgba('GOLD_HOT', 0.8 * k));
  gr.addColorStop(0.5, rgba('GOLD', 0.32 * k));
  gr.addColorStop(1, rgba('GOLD', 0));
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(-w0, 0);
  g.quadraticCurveTo(-w1 * 1.15, len * 0.42, 0, len);
  g.quadraticCurveTo(w1 * 1.15, len * 0.42, w0, 0);
  g.closePath(); g.fill();
  // White-hot inner core
  const gc = g.createLinearGradient(0, 0, 0, len * 0.35);
  gc.addColorStop(0, rgba('WHITE', 0.9 * k)); gc.addColorStop(1, rgba('WHITE', 0));
  g.fillStyle = gc;
  g.beginPath(); g.moveTo(-w0 * 0.55, 0); g.quadraticCurveTo(-w0 * 0.7, len * 0.18, 0, len * 0.35); g.quadraticCurveTo(w0 * 0.7, len * 0.18, w0 * 0.55, 0); g.closePath(); g.fill();
  g.restore();
  g.globalCompositeOperation = prev;
}
