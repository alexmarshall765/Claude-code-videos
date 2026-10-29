/* =============================================================================
 *  LIBERTY — synth.mjs
 *  A small, dependency-free synthesis toolkit for the score.
 *
 *  - Band-limited (polyBLEP) oscillators, Simper/Zavalishin state-variable
 *    filters, FM bells, supersaws, formant choir, additive organ.
 *  - Drums and cinematic FX built from oscillators and seeded noise.
 *  - Mix tools: FDN hall reverb, ping-pong delay, kick sidechain, tape stop,
 *    a true-peak-aware lookahead limiter and an ITU-R BS.1770 loudness meter.
 *
 *  Every voice renders straight into a Track (a pair of Float32Arrays the
 *  length of the film). All noise is seeded, so renders are bit-identical.
 * ========================================================================== */
import { writeFileSync } from 'node:fs';

export const SR = 48000;
const TAU = Math.PI * 2;

export const hz = m => 440 * Math.pow(2, (m - 69) / 12);
export const dB = x => Math.pow(10, x / 20);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smooth = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** Deterministic PRNG (mulberry32), same as the picture's. */
export function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let SEED = 1;
/** A fresh noise source per voice, so no two hits are identical. */
const noiseSrc = () => { const r = rng(SEED++ * 7919); return () => r() * 2 - 1; };

/** A stereo track the length of the film. */
export class Track {
  constructor(seconds, name = '') {
    this.n = Math.ceil(seconds * SR);
    this.L = new Float32Array(this.n);
    this.R = new Float32Array(this.n);
    this.name = name;
  }
}
/** Balance pan: centre = unity on both sides. */
const panL = p => Math.min(1, 1 - p);
const panR = p => Math.min(1, 1 + p);
/** Sample range [i0, i1) of a voice starting at t0 lasting len seconds, clipped to the track. */
function span(tr, t0, len) {
  const n0 = Math.round(t0 * SR);
  return [n0, Math.max(n0, Math.min(tr.n, n0 + Math.ceil(len * SR)))];
}

// -----------------------------------------------------------------------------
// Building blocks
// -----------------------------------------------------------------------------
/** polyBLEP residual: subtracts the aliasing step from naive saw/square edges. */
function blep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}
const saw = (ph, dt) => 2 * ph - 1 - blep(ph, dt);
function square(ph, dt, pw = 0.5) {
  let v = ph < pw ? 1 : -1;
  v += blep(ph, dt);
  let p2 = ph + 1 - pw; if (p2 >= 1) p2 -= 1;
  return v - blep(p2, dt);
}

/** Topology-preserving state-variable filter (Andrew Simper's formulation). */
export class SVF {
  constructor(fc = 1000, q = 0.707) { this.ic1 = 0; this.ic2 = 0; this.set(fc, q); }
  set(fc, q = 0.707) {
    const g = Math.tan((Math.PI * clamp(fc, 10, SR * 0.47)) / SR);
    this.k = 1 / q;
    this.a1 = 1 / (1 + g * (g + this.k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
  }
  tick(v0) {
    const v3 = v0 - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.band = v1;
    this.low = v2;
    return v2;
  }
  lp(v) { return this.tick(v); }
  bp(v) { this.tick(v); return this.band * this.k; } // unity gain at the centre frequency
  hp(v) { this.tick(v); return v - this.k * this.band - this.low; }
}
/** One-pole high-pass (DC/mud removal). */
class HP1 {
  constructor(fc) { this.a = Math.exp((-TAU * fc) / SR); this.x = 0; this.y = 0; }
  tick(x) { this.y = this.a * (this.y + x - this.x); this.x = x; return this.y; }
}

/** ADSR with a smooth attack and exponential decay/release. dur = gate length. */
export function adsr(t, dur, a, d, s, r) {
  if (t < 0) return 0;
  const held = tt => (tt < a ? smooth(tt / a) : s + (1 - s) * Math.exp(-(tt - a) / d));
  return t <= dur ? held(t) : held(dur) * Math.exp(-(t - dur) / r);
}

/**
 * Trance gate: a 16-step on/off pattern clocked from t0. Each open step has a
 * 3 ms attack and closes over its last 30 %, so the chord chops cleanly.
 */
export function gate16(pattern, t0, step) {
  return t => {
    const u = (t - t0) / step;
    if (u < 0) return 1;
    const i = Math.floor(u), ph = u - i;
    if (!pattern[i % pattern.length]) return 0;
    const at = Math.min(1, (ph * step) / 0.003);
    return at * (ph < 0.7 ? 1 : 1 - (ph - 0.7) / 0.3);
  };
}

// -----------------------------------------------------------------------------
// Tonal voices
// -----------------------------------------------------------------------------
// JP-8000 supersaw voice spread (Adam Szabo's measurements), normalised to ±1.
const SSAW = [-1, -0.5716, -0.1775, 0, 0.181, 0.565, 0.9767];

/**
 * Supersaw: `voices` detuned polyBLEP saws per note, random phases, spread
 * across the stereo field, through one resonant low-pass per channel.
 * `cutoff` may be a number or a function of absolute time (automation).
 * `gate` is an optional amplitude function of absolute time (trance gate).
 */
export function supersaw(tr, t0, notes, dur, o = {}) {
  const { gain = 0.1, voices = 7, detune = 22, spread = 0.85, a = 0.01, d = 0.4, s = 0.85, r = 0.35,
    cutoff = 6000, res = 0.75, env = 0, envDecay = 0.25, gate = null, hpHz = 140, bend = 0, bendTime = 0.08 } = o;
  const [i0, i1] = span(tr, t0, dur + 5 * r);
  const R = rng(Math.round(t0 * 997) + notes.length * 31 + (notes[0] | 0));
  const offs = voices === 7 ? SSAW : Array.from({ length: voices }, (_, v) => (voices > 1 ? (2 * v) / (voices - 1) - 1 : 0));
  const osc = [];
  notes.forEach((m, ni) => {
    offs.forEach((off, v) => {
      const p = voices > 1 ? ((v + ni) % voices) / (voices - 1) * 2 - 1 : 0;
      osc.push({ dt: (hz(m) * Math.pow(2, (off * detune) / 1200)) / SR, ph: R(), l: panL(p * spread), r: panR(p * spread), w: off === 0 ? 1 : 0.85 });
    });
  });
  const norm = 1 / Math.sqrt(voices);
  const fL = new SVF(), fR = new SVF(), hL = new HP1(hpHz), hR = new HP1(hpHz);
  const cut = typeof cutoff === 'function' ? cutoff : () => cutoff;
  for (let i = i0; i < i1; i++) {
    const t = (i - i0) / SR;
    if ((i - i0) % 32 === 0) {
      const fc = cut(t0 + t) * (1 + env * Math.exp(-t / envDecay));
      fL.set(fc, res); fR.set(fc, res);
    }
    const e = adsr(t, dur, a, d, s, r);
    if (t > dur && e < 1e-4) break;
    const pb = bend ? Math.pow(2, (bend * Math.exp(-t / bendTime)) / 12) : 1;
    let sl = 0, sr = 0;
    for (let k = 0; k < osc.length; k++) {
      const o2 = osc[k], dt = o2.dt * pb;
      const v = saw(o2.ph, dt) * o2.w;
      o2.ph += dt; if (o2.ph >= 1) o2.ph -= 1;
      sl += v * o2.l; sr += v * o2.r;
    }
    const g = gain * norm * e * (gate ? gate(t0 + t) : 1);
    tr.L[i] += fL.lp(hL.tick(sl)) * g;
    tr.R[i] += fR.lp(hR.tick(sr)) * g;
  }
}

/** Plucked synth: two detuned oscillators through a snappy filter envelope. */
export function pluck(tr, t0, m, o = {}) {
  const { gain = 0.1, dur = 0.2, cutoff = 300, peak = 4000, decay = 0.1, res = 1.1, detune = 9,
    wave = 'saw', pw = 0.5, pan = 0, r = 0.08, sub = 0, sustain = 0.25 } = o;
  const [i0, i1] = span(tr, t0, dur + 5 * r);
  const f = hz(m), d1 = (f * Math.pow(2, detune / 2400)) / SR, d2 = (f * Math.pow(2, -detune / 2400)) / SR;
  let p1 = 0.13, p2 = 0.61, ps = 0;
  const fl = new SVF();
  const gl = gain * panL(pan), gr = gain * panR(pan);
  for (let i = i0; i < i1; i++) {
    const t = (i - i0) / SR;
    if ((i - i0) % 16 === 0) fl.set(cutoff + (peak - cutoff) * Math.exp(-t / decay), res);
    const e = adsr(t, dur, 0.002, decay * 2.5, sustain, r);
    if (t > dur && e < 1e-4) break;
    let v = wave === 'square' ? square(p1, d1, pw) + square(p2, d2, pw) : saw(p1, d1) + saw(p2, d2);
    if (sub) v += sub * Math.sin(TAU * ps);
    p1 += d1; if (p1 >= 1) p1 -= 1;
    p2 += d2; if (p2 >= 1) p2 -= 1;
    ps += f / 2 / SR; if (ps >= 1) ps -= 1;
    const y = fl.lp(v * 0.5) * e;
    tr.L[i] += y * gl; tr.R[i] += y * gr;
  }
}

/** FM bell / glass chime. ratio 3.5 gives a bright celestial glass tone. */
export function bell(tr, t0, m, o = {}) {
  const { gain = 0.1, dur = 3, ratio = 3.5, index = 2.6, idecay = 0.5, pan = 0, detune = 4, reverse = false } = o;
  const len = dur;
  const [i0, i1] = span(tr, t0, len);
  const N = i1 - i0, f = hz(m);
  for (let c = 0; c < 2; c++) {
    const fc = f * Math.pow(2, ((c ? 1 : -1) * detune) / 2400), fm = fc * ratio;
    const out = c ? tr.R : tr.L, g = gain * (c ? panR(pan) : panL(pan));
    for (let j = 0; j < N; j++) {
      const t = (reverse ? N - 1 - j : j) / SR;
      const I = index * Math.exp(-t / idecay);
      const e = Math.min(1, t / 0.002) * Math.exp(-t / (len * 0.28));
      const v = Math.sin(TAU * fc * t + I * Math.sin(TAU * fm * t)) + 0.25 * Math.sin(TAU * 2 * fc * t) * Math.exp(-t / 0.4);
      // A reversed bell swells in and is cut right at the hit.
      const tail = reverse ? Math.min(1, (N - 1 - j) / (0.004 * SR)) : 1;
      out[i0 + j] += v * e * g * tail;
    }
  }
}

/** Marimba-like mallet: fundamental plus the bar's 4x and 10x modes. */
export function mallet(tr, t0, m, o = {}) {
  const { gain = 0.1, decay = 0.35, pan = 0 } = o;
  const [i0, i1] = span(tr, t0, decay * 5);
  const f = hz(m), gl = gain * panL(pan), gr = gain * panR(pan), nz = noiseSrc();
  for (let i = i0; i < i1; i++) {
    const t = (i - i0) / SR;
    const v = Math.sin(TAU * f * t) * Math.exp(-t / decay)
      + 0.35 * Math.sin(TAU * 3.99 * f * t) * Math.exp(-t / (decay * 0.18))
      + 0.08 * Math.sin(TAU * 9.9 * f * t) * Math.exp(-t / 0.012)
      + 0.15 * nz() * Math.exp(-t / 0.0015);
    const y = v * Math.min(1, t / 0.0008);
    tr.L[i] += y * gl; tr.R[i] += y * gr;
  }
}

/** Additive drawbar organ with a slow, stereo tremolo. bars = [[ratio, level], ...] */
export function organ(tr, t0, notes, dur, o = {}) {
  const { gain = 0.05, a = 0.08, d = 1, s = 1, r = 0.5, trem = 0.15, tremHz = 0.7,
    bars = [[0.5, 0.6], [1, 1], [1.5, 0.35], [2, 0.55], [3, 0.22], [4, 0.28], [8, 0.07]] } = o;
  const [i0, i1] = span(tr, t0, dur + 5 * r);
  const parts = [];
  notes.forEach(m => bars.forEach(([k, l]) => { const f = hz(m) * k; if (f < 9000) parts.push([TAU * f, l]); }));
  for (let i = i0; i < i1; i++) {
    const t = (i - i0) / SR;
    const e = adsr(t, dur, a, d, s, r);
    if (t > dur && e < 1e-4) break;
    let v = 0;
    for (let k = 0; k < parts.length; k++) v += Math.sin(parts[k][0] * t) * parts[k][1];
    const tl = 1 - trem * (0.5 + 0.5 * Math.sin(TAU * tremHz * t));
    const tr2 = 1 - trem * (0.5 + 0.5 * Math.sin(TAU * tremHz * t + 2.1));
    tr.L[i] += v * e * gain * tl; tr.R[i] += v * e * gain * tr2;
  }
}

// Formants (Hz, gain, bandwidth) for sung vowels.
const VOWELS = {
  ah: [[800, 1, 80], [1150, 0.5, 90], [2900, 0.3, 120]],
  oo: [[350, 1, 60], [600, 0.35, 70], [2700, 0.12, 120]],
};
/** Wordless choir: detuned saws with vibrato through three formant band-passes. */
export function choir(tr, t0, notes, dur, o = {}) {
  const { gain = 0.08, a = 0.7, r = 1.2, vowel = 'ah', voices = 3, detune = 12, vib = 0.18, vibHz = 5.3, breath = 0.05 } = o;
  const [i0, i1] = span(tr, t0, dur + 5 * r);
  const F = VOWELS[vowel];
  const R = rng(Math.round(t0 * 101) + 7);
  for (let c = 0; c < 2; c++) {
    const out = c ? tr.R : tr.L;
    const osc = [];
    notes.forEach(m => { for (let v = 0; v < voices; v++) osc.push({ f: hz(m) * Math.pow(2, ((v - (voices - 1) / 2) * detune + (c ? 3 : -3)) / 1200), ph: R(), vp: R() * TAU }); });
    const fs = F.map(([f, , bw]) => new SVF(f, f / bw));
    const nz = noiseSrc();
    for (let i = i0; i < i1; i++) {
      const t = (i - i0) / SR;
      const e = adsr(t, dur, a, 1, 1, r);
      if (t > dur && e < 1e-4) break;
      const ctl = (i - i0) % 16 === 0;
      const vd = vib * Math.min(1, t / 0.8); // vibrato blooms in, as singers do
      let src = 0;
      for (let k = 0; k < osc.length; k++) {
        const q = osc[k];
        if (ctl) q.dt = (q.f * Math.pow(2, (vd * Math.sin(TAU * vibHz * t + q.vp)) / 12)) / SR;
        src += saw(q.ph, q.dt);
        q.ph += q.dt; if (q.ph >= 1) q.ph -= 1;
      }
      src = src / Math.sqrt(osc.length) + breath * nz();
      let y = 0;
      for (let k = 0; k < 3; k++) y += fs[k].bp(src) * F[k][1];
      out[i] += y * e * gain * 4; // formant filtering removes most energy; restore level
    }
  }
}

/** Brass section: saw stack whose filter opens like breath through a horn. */
export function brass(tr, t0, notes, dur, o = {}) {
  const { gain = 0.08, voices = 3, detune = 10, a = 0.05, d = 0.6, s = 0.8, r = 0.3,
    cutLow = 300, cutHigh = 3000, swell = 0.12, settle = 0.6, res = 0.6, bend = -0.35, bendTime = 0.05, spread = 0.5 } = o;
  const [i0, i1] = span(tr, t0, dur + 5 * r);
  const R = rng(Math.round(t0 * 313) + 3);
  const osc = [];
  notes.forEach((m, ni) => { for (let v = 0; v < voices; v++) { const p = ((ni + v) % 3 - 1) * spread; osc.push({ dt: (hz(m) * Math.pow(2, ((v - (voices - 1) / 2) * detune) / 1200)) / SR, ph: R(), l: panL(p), r: panR(p) }); } });
  const fL = new SVF(), fR = new SVF();
  const norm = 1 / Math.sqrt(voices);
  for (let i = i0; i < i1; i++) {
    const t = (i - i0) / SR;
    if ((i - i0) % 16 === 0) {
      const fe = t < swell ? smooth(t / swell) : settle + (1 - settle) * Math.exp(-(t - swell) / 0.4);
      const fc = cutLow + (cutHigh - cutLow) * fe * (t > dur ? Math.exp(-(t - dur) / r) : 1);
      fL.set(fc, res); fR.set(fc, res);
    }
    const e = adsr(t, dur, a, d, s, r);
    if (t > dur && e < 1e-4) break;
    const pb = Math.pow(2, (bend * Math.exp(-t / bendTime)) / 12);
    let sl = 0, sr = 0;
    for (let k = 0; k < osc.length; k++) {
      const q = osc[k], dt = q.dt * pb, v = saw(q.ph, dt);
      q.ph += dt; if (q.ph >= 1) q.ph -= 1;
      sl += v * q.l; sr += v * q.r;
    }
    const g = gain * norm * e;
    tr.L[i] += fL.lp(sl) * g; tr.R[i] += fR.lp(sr) * g;
  }
}

/** Sub bass: a sine with gentle saturation. `glide` = [fromMidi, seconds]. */
export function sub(tr, t0, m, dur, o = {}) {
  const { gain = 0.3, a = 0.006, r = 0.06, drive = 1.6, glide = null } = o;
  const [i0, i1] = span(tr, t0, dur + 5 * r);
  const norm = 1 / Math.tanh(drive);
  let ph = 0;
  for (let i = i0; i < i1; i++) {
    const t = (i - i0) / SR;
    const mm = glide ? m + (glide[0] - m) * Math.max(0, 1 - t / glide[1]) ** 2 : m;
    ph += hz(mm) / SR; if (ph >= 1) ph -= 1;
    const e = adsr(t, dur, a, 1, 1, r);
    if (t > dur && e < 1e-4) break;
    const y = Math.tanh(drive * Math.sin(TAU * ph)) * norm * e * gain;
    tr.L[i] += y; tr.R[i] += y;
  }
}

/** Mid bass: saw (+square) through a plucky low-pass, optionally driven hard. */
export function bass(tr, t0, m, dur, o = {}) {
  const { gain = 0.2, cutoff = 200, peak = 1400, decay = 0.08, res = 0.9, drive = 1.2, r = 0.03, mix = 0.35 } = o;
  const [i0, i1] = span(tr, t0, dur + 5 * r);
  const dt = hz(m) / SR, norm = 1 / Math.tanh(drive);
  let p1 = 0, p2 = 0.5;
  const fl = new SVF();
  for (let i = i0; i < i1; i++) {
    const t = (i - i0) / SR;
    if ((i - i0) % 16 === 0) fl.set(cutoff + (peak - cutoff) * Math.exp(-t / decay), res);
    const e = adsr(t, dur, 0.002, 1, 1, r);
    if (t > dur && e < 1e-4) break;
    const v = saw(p1, dt) * (1 - mix) + square(p2, dt) * mix;
    p1 += dt; if (p1 >= 1) p1 -= 1;
    p2 += dt; if (p2 >= 1) p2 -= 1;
    const y = Math.tanh(drive * fl.lp(v)) * norm * e * gain;
    tr.L[i] += y; tr.R[i] += y;
  }
}

// -----------------------------------------------------------------------------
// Drums
// -----------------------------------------------------------------------------
/** House kick: pitch-swept sine body, a short click, soft saturation. */
export function kick(tr, t0, o = {}) {
  const { gain = 0.8, f0 = 170, f1 = 52, sweep = 0.03, decay = 0.17, click = 0.35, drive = 1.6, tone = 1, lp = 0 } = o;
  const [i0, i1] = span(tr, t0, decay * 6 + 0.02);
  const nz = noiseSrc(), hp = new SVF(2500, 0.7), norm = 1 / Math.tanh(drive);
  const muffle = lp ? new SVF(lp, 0.7) : null; // a distant, low-passed kick
  let ph = 0;
  for (let i = i0; i < i1; i++) {
    const t = (i - i0) / SR;
    ph += (f1 + (f0 - f1) * Math.exp(-t / sweep)) / SR;
    const body = Math.sin(TAU * ph) * Math.exp(-t / decay) * Math.min(1, t / 0.0006);
    const ck = click * tone * hp.hp(nz()) * Math.exp(-t / 0.0022);
    const tail = Math.min(1, (i1 - 1 - i) / (0.004 * SR)); // fade the last 4 ms
    let y = Math.tanh(drive * (body + ck)) * norm * gain * tail;
    if (muffle) y = muffle.lp(y);
    tr.L[i] += y; tr.R[i] += y;
  }
}

/** Hand clap: three quick noise bursts and a tail through a band-pass. */
export function clap(tr, t0, o = {}) {
  const { gain = 0.35, tone = 1250, decay = 0.11, width = 0.35 } = o;
  const [i0, i1] = span(tr, t0, decay * 6 + 0.04);
  const bursts = [0, 0.0095, 0.019, 0.029];
  for (let c = 0; c < 2; c++) {
    const nz = noiseSrc(), bp = new SVF(tone * (c ? 1.04 : 0.96), 1.1), hp = new SVF(500, 0.7);
    const out = c ? tr.R : tr.L, g = gain * (1 + (c ? width : -width) * 0.3);
    for (let i = i0; i < i1; i++) {
      const t = (i - i0) / SR;
      let e = 0;
      for (let k = 0; k < 4; k++) {
        const dt = t - bursts[k];
        if (dt >= 0) e += k < 3 ? Math.exp(-dt / 0.0028) : Math.exp(-dt / decay);
      }
      out[i] += hp.hp(bp.bp(nz())) * e * g;
    }
  }
}

/** Snare: a pitched body plus a bright noise rattle. */
export function snare(tr, t0, o = {}) {
  const { gain = 0.35, tone = 190, toneDecay = 0.05, noiseDecay = 0.13, bright = 6500, body = 0.5 } = o;
  const [i0, i1] = span(tr, t0, noiseDecay * 6 + 0.02);
  for (let c = 0; c < 2; c++) {
    const nz = noiseSrc(), hp = new SVF(1400, 0.7), lp = new SVF(bright, 0.7);
    const out = c ? tr.R : tr.L;
    let ph = 0;
    for (let i = i0; i < i1; i++) {
      const t = (i - i0) / SR;
      ph += (tone * (1 + 0.6 * Math.exp(-t / 0.012))) / SR;
      const b = Math.sin(TAU * ph) * Math.exp(-t / toneDecay) * body;
      const n = lp.lp(hp.hp(nz())) * Math.exp(-t / noiseDecay);
      out[i] += (b + n) * gain * Math.min(1, t / 0.0005);
    }
  }
}

// TR-808 hi-hat oscillator frequencies (six detuned square waves).
const HAT_F = [205.3, 304.4, 369.6, 522.7, 540, 800];
/** Hi-hat: metallic squares plus noise, band-passed high. */
export function hat(tr, t0, o = {}) {
  const { gain = 0.1, open = false, decay = open ? 0.16 : 0.03, pan = 0, tone = 1 } = o;
  const [i0, i1] = span(tr, t0, decay * 6);
  const nz = noiseSrc(), bp = new SVF(9500 * tone, 1.0), hp = new SVF(7000 * tone, 0.7);
  const ph = HAT_F.map((_, k) => k * 0.17), gl = gain * panL(pan), gr = gain * panR(pan);
  for (let i = i0; i < i1; i++) {
    const t = (i - i0) / SR;
    let m = 0;
    for (let k = 0; k < 6; k++) {
      const dt = (HAT_F[k] * 2.0) / SR;
      m += square(ph[k], dt);
      ph[k] += dt; if (ph[k] >= 1) ph[k] -= 1;
    }
    const v = hp.hp(bp.bp(m * 0.25 + nz() * 0.8)) * Math.exp(-t / decay) * Math.min(1, t / 0.0004);
    tr.L[i] += v * gl; tr.R[i] += v * gr;
  }
}

/** Crash cymbal: decorrelated noise and metal, long decay. */
export function crash(tr, t0, o = {}) {
  const { gain = 0.12, decay = 1.1, tone = 1 } = o;
  const len = decay * 5;
  const [i0, i1] = span(tr, t0, len);
  for (let c = 0; c < 2; c++) {
    const nz = noiseSrc(), hp = new SVF(3200 * tone, 0.6), bp = new SVF(7000 * tone, 0.8);
    const out = c ? tr.R : tr.L, ph = HAT_F.map((_, k) => k * 0.31 + c * 0.1);
    for (let i = i0; i < i1; i++) {
      const t = (i - i0) / SR;
      let m = 0;
      for (let k = 0; k < 6; k++) {
        const dt = (HAT_F[k] * (2.7 + c * 0.03)) / SR;
        m += square(ph[k], dt);
        ph[k] += dt; if (ph[k] >= 1) ph[k] -= 1;
      }
      const v = hp.hp(nz() * 0.9 + bp.bp(m) * 0.25);
      const e = Math.min(1, t / 0.0015) * (0.55 * Math.exp(-t / 0.08) + 0.45 * Math.exp(-t / decay));
      out[i] += v * e * gain;
    }
  }
}

/** A reversed crash that swells into tEnd (and stops dead on it). */
export function reverseCrash(tr, tEnd, o = {}) {
  const { gain = 0.1, len = 1.5, decay = 0.9 } = o;
  const tmp = new Track(len + 0.01);
  crash(tmp, 0, { gain, decay });
  const N = Math.round(len * SR), n0 = Math.round(tEnd * SR) - N;
  for (let j = 0; j < N; j++) {
    const i = n0 + j;
    if (i < 0 || i >= tr.n) continue;
    const src = N - 1 - j;
    const f = Math.min(1, j / (0.25 * N)); // fade the far (quiet) end in
    tr.L[i] += tmp.L[src] * f; tr.R[i] += tmp.R[src] * f;
  }
}

/** Tom / taiko: a pitch-dropping sine with a skin slap. */
export function tom(tr, t0, o = {}) {
  const { gain = 0.4, f0 = 150, f1 = 85, sweep = 0.06, decay = 0.3, slap = 0.25, pan = 0 } = o;
  const [i0, i1] = span(tr, t0, decay * 6);
  const nz = noiseSrc(), lp = new SVF(2200, 0.7);
  const gl = gain * panL(pan), gr = gain * panR(pan);
  let ph = 0;
  for (let i = i0; i < i1; i++) {
    const t = (i - i0) / SR;
    ph += (f1 + (f0 - f1) * Math.exp(-t / sweep)) / SR;
    const v = Math.tanh(1.3 * (Math.sin(TAU * ph) * Math.exp(-t / decay) + slap * lp.lp(nz()) * Math.exp(-t / 0.012)));
    tr.L[i] += v * gl; tr.R[i] += v * gr;
  }
}

/** Anvil / steel strike: inharmonic FM partials with a hard transient. */
export function anvil(tr, t0, o = {}) {
  const { gain = 0.15, f = 620, decay = 0.9, pan = 0 } = o;
  const [i0, i1] = span(tr, t0, decay * 5);
  const modes = [[1, 1, 1], [2.76, 0.6, 0.55], [5.4, 0.45, 0.3], [8.93, 0.3, 0.16], [13.3, 0.2, 0.08]];
  const nz = noiseSrc(), gl = gain * panL(pan), gr = gain * panR(pan);
  for (let i = i0; i < i1; i++) {
    const t = (i - i0) / SR;
    let v = 0;
    for (const [k, l, dk] of modes) v += Math.sin(TAU * f * k * t + 0.8 * Math.sin(TAU * f * k * 1.41 * t) * Math.exp(-t / 0.05)) * l * Math.exp(-t / (decay * dk));
    v += nz() * 0.5 * Math.exp(-t / 0.004);
    tr.L[i] += v * gl * 0.5; tr.R[i] += v * gr * 0.5;
  }
}

/** Cinematic impact: sub drop, body thump and a falling noise burst. */
export function impact(tr, t0, o = {}) {
  const { gain = 0.6, size = 1, bright = 1 } = o;
  const len = 3.5 * size;
  const [i0, i1] = span(tr, t0, len);
  const nz = noiseSrc(), nz2 = noiseSrc(), lpL = new SVF(), lpR = new SVF();
  let ph = 0, ph2 = 0;
  for (let i = i0; i < i1; i++) {
    const t = (i - i0) / SR;
    ph += (30 + 34 * Math.exp(-t / (0.35 * size))) / SR;
    ph2 += (48 + 110 * Math.exp(-t / 0.05)) / SR;
    const boom = Math.sin(TAU * ph) * Math.exp(-t / (0.9 * size));
    const thump = Math.sin(TAU * ph2) * Math.exp(-t / 0.16) * 0.8;
    if ((i - i0) % 32 === 0) { const fc = 180 + 7000 * bright * Math.exp(-t / 0.22); lpL.set(fc, 0.8); lpR.set(fc, 0.8); }
    const ne = Math.exp(-t / (0.35 * size)) * Math.min(1, t / 0.002);
    const body = Math.tanh(1.5 * (boom + thump));
    tr.L[i] += (body + lpL.lp(nz()) * ne * 0.7) * gain;
    tr.R[i] += (body + lpR.lp(nz2()) * ne * 0.7) * gain;
  }
}

/** Short tick (clock, countdown, telegraph). */
export function tick(tr, t0, o = {}) {
  const { gain = 0.08, f = 2200, decay = 0.012, pan = 0, noise = 0.3 } = o;
  const [i0, i1] = span(tr, t0, decay * 6 + 0.002);
  const nz = noiseSrc(), gl = gain * panL(pan), gr = gain * panR(pan);
  for (let i = i0; i < i1; i++) {
    const t = (i - i0) / SR;
    const v = (Math.sin(TAU * f * t) + noise * nz()) * Math.exp(-t / decay) * Math.min(1, t / 0.0003);
    tr.L[i] += v * gl; tr.R[i] += v * gr;
  }
}

/** Sine beep with soft edges (mission-control countdown, Quindar tone). */
export function beep(tr, t0, o = {}) {
  const { gain = 0.05, f = 1000, len = 0.08, pan = 0 } = o;
  const [i0, i1] = span(tr, t0, len);
  const gl = gain * panL(pan), gr = gain * panR(pan), N = i1 - i0;
  for (let i = i0; i < i1; i++) {
    const j = i - i0, e = Math.min(1, j / 96, (N - j) / 96);
    const v = Math.sin((TAU * f * j) / SR) * e;
    tr.L[i] += v * gl; tr.R[i] += v * gr;
  }
}

/** Digital blip: a bit-crushed square chirp (silicon era). */
export function glitch(tr, t0, o = {}) {
  const { gain = 0.05, f = 1600, len = 0.05, crush = 6, pan = 0 } = o;
  const [i0, i1] = span(tr, t0, len);
  const gl = gain * panL(pan), gr = gain * panR(pan), N = i1 - i0;
  let ph = 0, held = 0;
  for (let i = i0; i < i1; i++) {
    const j = i - i0;
    ph += (f * (1 + 0.5 * (j / N))) / SR; if (ph >= 1) ph -= 1;
    if (j % crush === 0) held = ph < 0.5 ? 1 : -1;
    const v = Math.round(held * 4) / 4 * Math.min(1, (N - j) / 48) * Math.exp(-j / (N * 0.6));
    tr.L[i] += v * gl; tr.R[i] += v * gr;
  }
}

// -----------------------------------------------------------------------------
// Transitions & atmospheres
// -----------------------------------------------------------------------------
/** Riser: noise through a rising band-pass plus a climbing tone, ending at t1. */
export function riser(tr, t0, t1, o = {}) {
  const { gain = 0.08, f0 = 250, f1 = 7000, tone = 0.5, n0 = 45, n1 = 69, curve = 2 } = o;
  const [i0, i1] = span(tr, t0, t1 - t0);
  const N = i1 - i0;
  for (let c = 0; c < 2; c++) {
    const nz = noiseSrc(), bp = new SVF(f0, 2.2), out = c ? tr.R : tr.L;
    let ph = c * 0.25, ph2 = 0.5;
    for (let i = i0; i < i1; i++) {
      const u = (i - i0) / N;
      if ((i - i0) % 32 === 0) bp.set(f0 * Math.pow(f1 / f0, u), 2.2);
      const m = n0 + (n1 - n0) * u, f = hz(m), dt = f / SR;
      ph += dt * (1 + (c ? 0.004 : -0.004)); if (ph >= 1) ph -= 1;
      ph2 += (dt * 1.5) / 1; if (ph2 >= 1) ph2 -= 1;
      const env = Math.pow(u, curve) * Math.min(1, (N - (i - i0)) / 96);
      const v = bp.bp(nz()) * 1.2 + tone * (saw(ph, dt) * 0.5 + Math.sin(TAU * ph2) * 0.3) * 0.4;
      out[i] += v * env * gain;
    }
  }
}

/** Downlifter: a falling noise sweep after a hit. */
export function downlifter(tr, t0, o = {}) {
  const { gain = 0.07, len = 2, f0 = 6000, f1 = 180 } = o;
  const [i0, i1] = span(tr, t0, len);
  const N = i1 - i0;
  for (let c = 0; c < 2; c++) {
    const nz = noiseSrc(), bp = new SVF(f0, 1.6), out = c ? tr.R : tr.L;
    for (let i = i0; i < i1; i++) {
      const u = (i - i0) / N;
      if ((i - i0) % 32 === 0) bp.set(f0 * Math.pow(f1 / f0, u), 1.6);
      out[i] += bp.bp(nz()) * Math.pow(1 - u, 2) * Math.min(1, (i - i0) / 240) * gain;
    }
  }
}

/** Whoosh: a band-passed noise sweep that pans across the field, peaking at tc. */
export function whoosh(tr, tc, o = {}) {
  const { gain = 0.08, len = 0.9, f0 = 400, f1 = 5000 } = o;
  const [i0, i1] = span(tr, tc - len / 2, len);
  const N = i1 - i0, nz = noiseSrc(), bp = new SVF(f0, 1.4);
  for (let i = i0; i < i1; i++) {
    const u = (i - i0) / N, peak = Math.sin(Math.PI * u);
    if ((i - i0) % 32 === 0) bp.set(f0 * Math.pow(f1 / f0, peak), 1.4);
    const v = bp.bp(nz()) * peak * peak * gain, p = u * 2 - 1;
    tr.L[i] += v * panL(p); tr.R[i] += v * panR(p);
  }
}

/** Shepard–Risset glissando: octave-spaced tones that rise forever. */
export function shepard(tr, t0, t1, o = {}) {
  const { gain = 0.05, base = 55, octaves = 7, rate = 0.25, fadeIn = 1 } = o; // rate: octaves per second
  const [i0, i1] = span(tr, t0, t1 - t0);
  const N = i1 - i0;
  const ph = new Float64Array(octaves * 2);
  for (let i = i0; i < i1; i++) {
    const t = (i - i0) / SR;
    const shift = (t * rate) % 1;
    let l = 0, r = 0;
    for (let k = 0; k < octaves; k++) {
      const pos = (k + shift) / octaves; // 0..1 across the band
      const f = base * Math.pow(2, k + shift);
      const w = Math.pow(Math.sin(Math.PI * pos), 2);
      ph[k] += f / SR; if (ph[k] >= 1) ph[k] -= 1;
      ph[k + octaves] += (f * 1.003) / SR; if (ph[k + octaves] >= 1) ph[k + octaves] -= 1;
      l += Math.sin(TAU * ph[k]) * w; r += Math.sin(TAU * ph[k + octaves]) * w;
    }
    const e = Math.min(1, t / fadeIn) * Math.min(1, (N - (i - i0)) / 240);
    tr.L[i] += l * e * gain; tr.R[i] += r * e * gain;
  }
}

/** Rocket roar: brown noise with slow surges and crackle. */
export function rumble(tr, t0, t1, o = {}) {
  const { gain = 0.2, attack = 0.4, release = 1.5 } = o;
  const [i0, i1] = span(tr, t0, t1 - t0 + release * 3);
  for (let c = 0; c < 2; c++) {
    const nz = noiseSrc(), lp = new SVF(260, 0.7), lp2 = new SVF(1800, 0.7), R = rng(77 + c), out = c ? tr.R : tr.L;
    let brown = 0;
    for (let i = i0; i < i1; i++) {
      const t = (i - i0) / SR;
      brown = (brown + 0.02 * nz()) * 0.998;
      const crackle = R() < 0.0015 ? (R() * 2 - 1) * 2 : 0;
      const surge = 0.8 + 0.2 * Math.sin(TAU * 0.7 * t + c) * Math.sin(TAU * 0.23 * t);
      const e = Math.min(1, t / attack) * (t > t1 - t0 ? Math.exp(-(t - (t1 - t0)) / release) : 1);
      out[i] += (lp.lp(brown) * 6 + lp2.lp(crackle) * 0.5) * surge * e * gain;
    }
  }
}

/** Soft drone of pure sines (string harmonics / shimmer). */
export function shimmer(tr, t0, notes, dur, o = {}) {
  const { gain = 0.02, a = 2, r = 2, tremHz = 0.25 } = o;
  const [i0, i1] = span(tr, t0, dur + 5 * r);
  const fs = notes.map(hz);
  for (let i = i0; i < i1; i++) {
    const t = (i - i0) / SR;
    const e = adsr(t, dur, a, 1, 1, r);
    if (t > dur && e < 1e-4) break;
    let l = 0, rr = 0;
    fs.forEach((f, k) => {
      const tm = 0.75 + 0.25 * Math.sin(TAU * tremHz * t + k * 1.7);
      l += Math.sin(TAU * f * t) * tm; rr += Math.sin(TAU * f * 1.002 * t + k) * tm;
    });
    tr.L[i] += l * e * gain; tr.R[i] += rr * e * gain;
  }
}

// -----------------------------------------------------------------------------
// Effects
// -----------------------------------------------------------------------------
/**
 * 8-line feedback delay network reverb with Householder mixing, per-line
 * damping and two slowly modulated lines. Returns the wet signal only.
 */
export function reverb(inL, inR, o = {}) {
  const { rt60 = 3, preDelay = 0.025, damp = 5500, size = 1, lowCut = 220, mod = 6 } = o;
  const n = inL.length;
  const outL = new Float32Array(n), outR = new Float32Array(n);
  const base = [1433, 1601, 1867, 2053, 2251, 2399, 2687, 2903].map(x => Math.round(x * size));
  const lines = base.map(len => ({ buf: new Float32Array(len + 64), len, w: 0, lp: 0 }));
  const gains = base.map(len => Math.pow(10, (-3 * len) / (SR * rt60)));
  const dampA = Math.exp((-TAU * damp) / SR);
  const pd = Math.round(preDelay * SR), pdL = new Float32Array(pd + 1), pdR = new Float32Array(pd + 1);
  const hpL = new HP1(lowCut), hpR = new HP1(lowCut);
  // Input diffusion: four short allpasses per channel.
  const ap = (len, g) => ({ buf: new Float32Array(len), len, i: 0, g });
  const apL = [ap(142, 0.7), ap(107, 0.7), ap(379, 0.6), ap(277, 0.6)];
  const apR = [ap(149, 0.7), ap(113, 0.7), ap(367, 0.6), ap(283, 0.6)];
  const apTick = (a, x) => { const d = a.buf[a.i], y = -a.g * x + d; a.buf[a.i] = x + a.g * y; a.i = (a.i + 1) % a.len; return y; };
  const x = new Float64Array(8);
  let pdi = 0;
  for (let i = 0; i < n; i++) {
    // pre-delay
    const dl = pdL[pdi], dr = pdR[pdi];
    pdL[pdi] = inL[i]; pdR[pdi] = inR[i]; pdi = (pdi + 1) % (pd + 1);
    let sl = hpL.tick(dl), sr = hpR.tick(dr);
    for (let k = 0; k < 4; k++) { sl = apTick(apL[k], sl); sr = apTick(apR[k], sr); }
    // read lines (two modulated with fractional reads)
    let sum = 0;
    for (let k = 0; k < 8; k++) {
      const L = lines[k];
      let v;
      if (k === 1 || k === 6) {
        const off = L.len - 1 - mod * (1 + Math.sin((TAU * (0.31 + k * 0.07) * i) / SR));
        let rp = L.w - off; while (rp < 0) rp += L.buf.length;
        const ri = Math.floor(rp), fr = rp - ri;
        v = L.buf[ri % L.buf.length] * (1 - fr) + L.buf[(ri + 1) % L.buf.length] * fr;
      } else {
        let rp = L.w - L.len; if (rp < 0) rp += L.buf.length;
        v = L.buf[rp];
      }
      L.lp = v + dampA * (L.lp - v); // one-pole damping
      x[k] = L.lp * gains[k];
      sum += x[k];
    }
    outL[i] = x[0] - x[2] + x[4] - x[6] + 0.5 * (x[1] - x[5]);
    outR[i] = x[1] - x[3] + x[5] - x[7] + 0.5 * (x[2] - x[6]);
    // Householder feedback plus input injection
    const h = (2 / 8) * sum;
    for (let k = 0; k < 8; k++) {
      const L = lines[k];
      const inj = (k & 1 ? sr : sl) * (k & 2 ? -0.5 : 0.5);
      L.buf[L.w] = x[k] - h + inj;
      L.w = (L.w + 1) % L.buf.length;
    }
  }
  return { L: outL, R: outR };
}

/** Ping-pong delay (wet only): feedback alternates sides through a band-limit. */
export function pingPong(inL, inR, o = {}) {
  const { time = 0.375, feedback = 0.38, lowpass = 4200, highpass = 350 } = o;
  const n = inL.length, d = Math.round(time * SR);
  const outL = new Float32Array(n), outR = new Float32Array(n);
  const bl = new Float32Array(d), br = new Float32Array(d);
  const lpL = new SVF(lowpass, 0.6), lpR = new SVF(lowpass, 0.6), hp = new HP1(highpass);
  let w = 0;
  for (let i = 0; i < n; i++) {
    const yl = bl[w], yr = br[w];
    outL[i] = yl; outR[i] = yr;
    const x = hp.tick((inL[i] + inR[i]) * 0.5);
    bl[w] = lpL.lp(x + yr * feedback);
    br[w] = lpR.lp(yl * feedback);
    w = (w + 1) % d;
  }
  return { L: outL, R: outR };
}

/**
 * Sidechain gain curve from kick events [{t, depth}]: a 4 ms duck that
 * recovers over `release` seconds.
 */
export function duckCurve(n, kicks, o = {}) {
  const { release = 0.21, attack = 0.004, shape = 1.6 } = o;
  const g = new Float32Array(n).fill(1);
  for (const { t, depth } of kicks) {
    const a = Math.round((t - attack) * SR), k0 = Math.round(t * SR), b = Math.round((t + release) * SR);
    for (let i = Math.max(0, a); i < Math.min(n, b); i++) {
      const v = i < k0 ? 1 - depth * ((i - a) / (k0 - a)) : 1 - depth * Math.pow(1 - (i - k0) / (b - k0), shape);
      if (v < g[i]) g[i] = v;
    }
  }
  return g;
}

/** Tape stop: the signal slows to a halt between t0 and t1 (in place), sagging as it goes. */
export function tapeStop(L, R, t0, t1) {
  const a = Math.round(t0 * SR), N = Math.round((t1 - t0) * SR);
  const srcL = L.slice(a, a + N), srcR = R.slice(a, a + N);
  for (let j = 0; j < N; j++) {
    const u = j / N, pos = j * (1 - u / 2); // integral of a linearly falling speed
    const p = Math.floor(pos), f = pos - p;
    const fade = 1 - u * u; // level falls with the speed
    L[a + j] = (srcL[p] * (1 - f) + (srcL[p + 1] || 0) * f) * fade;
    R[a + j] = (srcR[p] * (1 - f) + (srcR[p + 1] || 0) * f) * fade;
  }
}

/** Biquad (RBJ cookbook) applied in place. type: 'hp' | 'lp' | 'lowshelf' | 'highshelf' | 'peak'. */
export function biquad(x, type, f, q = 0.707, gainDb = 0) {
  const A = Math.pow(10, gainDb / 40), w = (TAU * f) / SR, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
  else if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
  else if (type === 'peak') { b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A; }
  else {
    const sq = 2 * Math.sqrt(A) * al, s = type === 'lowshelf' ? 1 : -1;
    b0 = A * ((A + 1) - s * (A - 1) * cs + sq); b1 = 2 * s * A * ((A - 1) - s * (A + 1) * cs); b2 = A * ((A + 1) - s * (A - 1) * cs - sq);
    a0 = (A + 1) + s * (A - 1) * cs + sq; a1 = -2 * s * ((A - 1) + s * (A + 1) * cs); a2 = (A + 1) + s * (A - 1) * cs - sq;
  }
  b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const x0 = x[i], y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0; x[i] = y0;
  }
}

/** Gentle bus compressor (stereo-linked RMS detector), in place. */
export function compress(L, R, o = {}) {
  const { threshold = -16, ratio = 2, attack = 0.012, release = 0.18, knee = 6 } = o;
  const aA = Math.exp(-1 / (attack * SR)), aR = Math.exp(-1 / (release * SR)), aRms = Math.exp(-1 / (0.02 * SR));
  let ms = 0, gr = 0;
  for (let i = 0; i < L.length; i++) {
    ms = aRms * ms + (1 - aRms) * 0.5 * (L[i] * L[i] + R[i] * R[i]);
    const lvl = 10 * Math.log10(ms + 1e-12), over = lvl - threshold;
    let want = 0;
    if (over > knee / 2) want = over * (1 - 1 / ratio);
    else if (over > -knee / 2) want = ((over + knee / 2) ** 2 / (2 * knee)) * (1 - 1 / ratio);
    gr = want > gr ? aA * gr + (1 - aA) * want : aR * gr + (1 - aR) * want;
    const g = Math.pow(10, -gr / 20);
    L[i] *= g; R[i] *= g;
  }
}

/** Approximate true peak of each sample (max over 4x cubic-interpolated points). */
function truePeaks(L, R) {
  const n = L.length, p = new Float32Array(n);
  const tp = (x, i) => {
    const y0 = x[i - 1] ?? x[i], y1 = x[i], y2 = x[i + 1] ?? x[i], y3 = x[i + 2] ?? y2;
    let m = Math.abs(y1);
    for (const u of [0.25, 0.5, 0.75]) {
      const v = y1 + 0.5 * u * (y2 - y0 + u * (2 * y0 - 5 * y1 + 4 * y2 - y3 + u * (3 * (y1 - y2) + y3 - y0)));
      if (Math.abs(v) > m) m = Math.abs(v);
    }
    return m;
  };
  for (let i = 0; i < n; i++) p[i] = Math.max(tp(L, i), tp(R, i));
  return p;
}

/**
 * Lookahead brickwall limiter (in place). Gain = box-smoothed sliding minimum of
 * the required gain, which guarantees no (true-)peak exceeds the ceiling, then
 * a release smoother so the gain recovers without pumping.
 */
export function limiter(L, R, o = {}) {
  const { ceiling = dB(-1.2), lookahead = 0.005, release = 0.09 } = o;
  const n = L.length, D = Math.round(lookahead * SR);
  const pk = truePeaks(L, R);
  const req = new Float32Array(n);
  for (let i = 0; i < n; i++) req[i] = pk[i] > ceiling ? ceiling / pk[i] : 1;
  // h[i] = min(req[i - D .. i]) via a monotonic deque, evaluated for the delayed signal.
  const h = new Float32Array(n + D);
  const dq = new Int32Array(n + D); let qh = 0, qt = 0;
  for (let i = 0; i < n + D; i++) {
    const v = i < n ? req[i] : 1;
    while (qt > qh && (dq[qt - 1] < n ? req[dq[qt - 1]] : 1) >= v) qt--;
    dq[qt++] = i;
    while (dq[qh] < i - D) qh++;
    h[i] = dq[qh] < n ? req[dq[qh]] : 1;
  }
  // Box filter of length D over h, then release smoothing; apply with D delay removed.
  const aR = Math.exp(-1 / (release * SR));
  let sum = 0, g = 1, maxGR = 0;
  for (let i = 0; i < n + D; i++) {
    sum += h[i];
    if (i >= D) sum -= h[i - D];
    const s = i >= D - 1 ? sum / D : 1;
    g = s < g ? s : aR * g + (1 - aR) * s;
    const j = i - D;
    if (j >= 0) { L[j] *= g; R[j] *= g; if (1 - g > maxGR) maxGR = 1 - g; }
  }
  return 20 * Math.log10(1 - maxGR + 1e-9);
}

// -----------------------------------------------------------------------------
// Loudness (ITU-R BS.1770-4 / EBU R128)
// -----------------------------------------------------------------------------
function kWeight(x) {
  const y = Float64Array.from(x);
  const run = (b, a) => {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < y.length; i++) {
      const x0 = y[i], y0 = b[0] * x0 + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
      x2 = x1; x1 = x0; y2 = y1; y1 = y0; y[i] = y0;
    }
  };
  run([1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]);
  run([1, -2, 1], [1, -1.99004745483398, 0.99007225036621]);
  return y;
}
/** Integrated loudness (LUFS), plus short-term (3 s) loudness every 0.5 s. */
export function loudness(L, R) {
  const kl = kWeight(L), kr = kWeight(R);
  const blk = Math.round(0.4 * SR), hop = Math.round(0.1 * SR);
  const ms = [];
  for (let s = 0; s + blk <= kl.length; s += hop) {
    let a = 0;
    for (let i = s; i < s + blk; i++) a += kl[i] * kl[i] + kr[i] * kr[i];
    ms.push(a / blk);
  }
  const lk = m => -0.691 + 10 * Math.log10(m + 1e-15);
  const abs = ms.filter(m => lk(m) > -70);
  const rel = lk(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
  const gated = abs.filter(m => lk(m) > rel);
  const integrated = lk(gated.reduce((a, b) => a + b, 0) / gated.length);
  const short = [], win = 3 * SR;
  for (let s = 0; s + win <= kl.length; s += SR / 2) {
    let a = 0;
    for (let i = s; i < s + win; i++) a += kl[i] * kl[i] + kr[i] * kr[i];
    short.push({ t: s / SR + 1.5, lufs: lk(a / win) });
  }
  return { integrated, short };
}

// -----------------------------------------------------------------------------
// Output
// -----------------------------------------------------------------------------
/** Write a stereo PCM WAV (16 or 24 bit) with TPDF dither for 16-bit. */
export function writeWav(path, L, R, bits = 24) {
  const n = L.length, bps = bits / 8, data = n * 2 * bps;
  const buf = Buffer.alloc(44 + data);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + data, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2 * bps, 28); buf.writeUInt16LE(2 * bps, 32); buf.writeUInt16LE(bits, 34);
  buf.write('data', 36); buf.writeUInt32LE(data, 40);
  const max = Math.pow(2, bits - 1) - 1, r = rng(4242);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (const x of [L[i], R[i]]) {
      const d = bits === 16 ? (r() - r()) / max : 0;
      const v = Math.round(clamp(x + d, -1, 1) * max);
      if (bits === 24) { buf.writeIntLE(v, o, 3); o += 3; } else { buf.writeInt16LE(v, o); o += 2; }
    }
  }
  writeFileSync(path, buf);
}
