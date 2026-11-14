#!/usr/bin/env node
/* =============================================================================
 *  LIBERTY — "Conceived in Liberty", the original score
 *
 *  A 2:00 hybrid epic cue: a progressive electronic track with an orchestra of
 *  synthesized strings, brass, choir and war drums on top. It is composed and
 *  synthesized entirely in code (synth.mjs) and scored to the film's master
 *  timeline (timeline.js): 134 BPM, 4/4, D major, lifting to E major at the
 *  frontier. It reads the same scene lengths and sync cues the picture draws
 *  to, so every cut lands on a downbeat and every hit lands under its headline.
 *
 *    node score.mjs             → out/liberty-score.wav (48 kHz / 24-bit)
 *                                 and audio/liberty-score.mp3 (browser preview)
 *    node score.mjs --stems     → also out/stems/<track>.wav
 *    node score.mjs --report    → loudness per scene and the sync hit list
 *
 *  The motif is D–E–A–D′ (1–2–5–8) in a dotted rhythm. Horn and bell state it
 *  under the title. The theme "reaches" with it bar after bar (D–E–F♯, D–E–G,
 *  D–E–A, E–F♯–A) without resolving, first on horns, then on the lead, then
 *  on everything. It lands on the octave only on the final card, ONWARD.
 * ========================================================================== */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as S from './synth.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const TL = createRequire(import.meta.url)('./timeline.js');
const args = process.argv.slice(2);
const flag = name => args.includes(`--${name}`);
const { SR } = S;

const DUR = TL.DURATION, B = TL.BEAT;
const sc = id => TL.byId[id];
/** Absolute time of beat b (fractional allowed) in scene `id`. */
const at = (id, b) => sc(id).start + b * B;
const cue = (id, c) => TL.cueTime(id, c);
const clamp01 = x => Math.max(0, Math.min(1, x));
const inOut = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2); // the picture's E.inOut
/** Exponential automation through [[t, value], ...], flat outside the points. */
const auto = pts => t => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let k = 1; k < pts.length; k++) {
    if (t < pts[k][0]) {
      const [t0, v0] = pts[k - 1], [t1, v1] = pts[k];
      return v0 * Math.pow(v1 / v0, (t - t0) / (t1 - t0));
    }
  }
  return pts[pts.length - 1][1];
};
/** Linear ramp from v0 at t0 to v1 at t1, flat outside. */
const ramp = (t0, v0, t1, v1) => t => v0 + (v1 - v0) * clamp01((t - t0) / (t1 - t0));

// =============================================================================
//  KEY — the score lifts a whole step when the film reaches the frontier
// =============================================================================
const KEY = { frontier: 2, memory: 2, final: 2 }; // semitones above D major
let XP = 0; // transposition of the scene being scored
const x = m => m + XP;
const xs = notes => notes.map(x);
/** Pitched voices, transposed into the current scene's key. */
const V = {
  saws: (tr, t, notes, dur, o) => S.supersaw(tr, t, xs(notes), dur, o),
  pluck: (tr, t, m, o) => S.pluck(tr, t, x(m), o),
  mallet: (tr, t, m, o) => S.mallet(tr, t, x(m), o),
  bell: (t, m, o) => S.bell(T.bell, t, x(m), o),
  organ: (t, notes, dur, o) => S.organ(T.organ, t, xs(notes), dur, o),
  choir: (t, notes, dur, o) => S.choir(T.choir, t, xs(notes), dur, o),
  brass: (t, notes, dur, o) => S.brass(T.brass, t, xs(notes), dur, o),
  sub: (tr, t, m, dur, o) => S.sub(tr, t, x(m), dur, o),
  bass: (t, m, dur, o) => S.bass(T.bass, t, x(m), dur, o),
  spiccato: (t, m, o) => S.spiccato(T.strings, t, x(m), o),
  braam: (tr, t, m, dur, o) => S.braam(tr, t, x(m), dur, o),
  timpani: (t, m, o) => S.timpani(T.taiko, t, x(m), o),
  timpRoll: (t0, t1, m, o) => S.timpRoll(T.taiko, t0, t1, x(m), o),
  shimmer: (t, notes, dur, o) => S.shimmer(T.pad, t, xs(notes), dur, o),
};

// =============================================================================
//  HARMONY — one chord per bar (or per beat at the hits), voice-led around D4.
//  Written in D major; scenes in KEY sound a whole step higher.
// =============================================================================
const CHORDS = {
  D:     { root: 38, pad: [62, 66, 69, 74] }, // D2 · D4 F♯4 A4 D5
  D5:    { root: 38, pad: [57, 62, 69, 74] }, // open fifth
  A:     { root: 33, pad: [61, 64, 69, 73] }, // A1 · C♯4 E4 A4 C♯5
  Asus:  { root: 33, pad: [62, 64, 69, 74] }, // the motif's own notes: D E A
  Bm:    { root: 35, pad: [62, 66, 71, 74] },
  Bm7:   { root: 35, pad: [62, 66, 69, 71] },
  G:     { root: 31, pad: [62, 67, 71, 74] },
  Gmaj7: { root: 31, pad: [62, 66, 67, 71] },
  Em:    { root: 40, pad: [64, 67, 71, 76] },
  Em7:   { root: 40, pad: [62, 64, 67, 71] },
  Fsm:   { root: 30, pad: [61, 66, 69, 73] },
  Fs:    { root: 30, pad: [61, 66, 70, 73] }, // F♯ major: the dominant of B minor
  B:     { root: 35, pad: [63, 66, 71, 75] }, // B major: the dominant of the new key
};
// [chord, beats] per scene. Headlines land on the tonic wherever they can.
const HARMONY = {
  open:         [['D5', 4], ['Bm7', 4], ['D', 4], ['G', 2], ['A', 2]],
  founding:     [['D', 4], ['A', 4], ['Bm', 4], ['G', 4]],
  constitution: [['Bm', 4], ['G', 4], ['D', 4], ['A', 4]],
  expansion:    [['Bm', 4], ['G', 4], ['D', 4], ['A', 4]],
  infra:        [['G', 4], ['A', 4], ['D', 4], ['Bm', 4]],
  industry:     [['D', 4], ['Bm', 4], ['G', 1], ['A', 1], ['D', 6]], // STEEL IV · RAIL V · LIGHT I
  flight:       [['Gmaj7', 4], ['Bm7', 4], ['D', 4], ['A', 4]],
  abundance:    [['D', 4], ['A', 4], ['Bm', 4], ['G', 4]],
  arsenal:      [['Bm', 4], ['G', 4], ['Em', 4], ['Fs', 4]],
  prosperity:   [['G', 4], ['A', 4], ['D', 4], ['D', 4]], // F♯ → G: the sun comes out
  cosmos:       [['G', 4], ['A', 4], ['D', 4], ['A', 4], ['Gmaj7', 4], ['Asus', 4]],
  silicon:      [['Bm', 4], ['G', 4], ['D', 4], ['A', 4]],
  // The last bar climbs A–B in the bass: IV–V of E major, the key the frontier opens in.
  innovation:   [['Bm', 4], ['G', 4], ['D', 4], ['G', 4], ['A', 2], ['B', 2]],
  frontier:     [['Bm', 4], ['G', 4], ['D', 4], ['A', 4]],                           // sounds C♯m A E B
  memory:       [['Bm', 2], ['A', 2], ['G', 2], ['Fsm', 2], ['G', 4], ['Em7', 4]],   // a falling bass for the rewind
  final:        [['Asus', 4], ['D', 12]],                                            // sounds Bsus4 → E
};
const CHANGES = [];
TL.SCENES.forEach(s => {
  let b = 0;
  HARMONY[s.id].forEach(([name, beats]) => {
    CHANGES.push({ t0: s.start + b * B, t1: s.start + (b + beats) * B, name, ...CHORDS[name] });
    b += beats;
  });
  if (Math.abs(b - s.bars * 4) > 1e-9) throw new Error(`harmony for ${s.id} spans ${b} beats; the scene has ${s.bars * 4}`);
});
const chordAt = t => CHANGES.find(c => t >= c.t0 - 1e-6 && t < c.t1 - 1e-6) || CHANGES[CHANGES.length - 1];
/** Arpeggio tones: the pad voicing continued upward (2nd and 3rd notes an octave up). */
const tones = c => { const p = [...c.pad].sort((a, b) => a - b); return [...p, p[1] + 12, p[2] + 12]; };
/** Cello-register chord tones in root position: root, third, fifth, octave. */
const lowTones = c => {
  const r = c.root + 12;
  const up = [...new Set(c.pad.map(p => r + ((((p - r) % 12) + 12) % 12)))].sort((a, b) => a - b);
  return [...up, r + 12];
};
/** Timpani pitch for a chord (D2–C♯3). */
const timpNote = c => (c.root < 38 ? c.root + 12 : c.root);

// The motif cell — dotted quarter, eighth, half — and the notes it reaches for over each chord.
const CELL = [[0, 1.5], [1.5, 0.5], [2, 2]];
const HOOK = { Bm: [74, 76, 78], G: [74, 76, 79], D: [74, 76, 81], A: [76, 78, 81], Asus: [74, 76, 81] };

// Patterns: arps index into tones(); bass entries are [beat offset, length in beats].
const ARP8 = [0, 2, 1, 3, 2, 4, 3, 1];
const ARP16 = [0, 2, 3, 4, 3, 2, 1, 2, 0, 2, 3, 5, 4, 3, 2, 1];
const CLOCK = [0, 5, 1, 5, 2, 5, 1, 5, 3, 5, 1, 5, 2, 5, 1, 5]; // repeated top note = clockwork
const DIGI = [0, 3, 5, 3, 1, 4, 5, 4, 2, 3, 5, 3, 1, 4, 5, 2];
const GATE = [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0]; // trance gate for the drops
const OFFBEAT = [[0.5, 0.42]];
const GALLOP = [[0.5, 0.22], [0.75, 0.22]];
const ROLLING = [[0.25, 0.2], [0.5, 0.2], [0.75, 0.2]];
// String ostinato figures index into lowTones(); accents fall 3-3-2, the war-drum rhythm.
const OST16 = [0, 0, 2, 0, 3, 0, 2, 0, 0, 0, 2, 0, 3, 2, 1, 2];
const OST8 = [0, 2, 3, 2, 0, 2, 3, 2];
const ACC332 = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0];

// =============================================================================
//  TRACKS & MIX
//  duck = sidechain depth; hall / plate / delay / cath = effect sends;
//  through = keeps sounding in the silences before the drops.
// =============================================================================
const TRACKS = {
  kick:    { duck: 0 },
  drums:   { duck: 0.1, hall: 0.04, plate: 0.16 },
  taiko:   { duck: 0, hall: 0.1, cath: 0.2 },
  perc:    { duck: 0.25, hall: 0.12, plate: 0.08, delay: 0.12 },
  sub:     { duck: 0.9 },
  bass:    { duck: 0.85 },
  pad:     { duck: 0.7, hall: 0.22 },
  strings: { duck: 0.3, hall: 0.24, cath: 0.08 },
  choir:   { duck: 0.3, hall: 0.4, cath: 0.3 },
  organ:   { duck: 0.3, hall: 0.35 },
  arp:     { duck: 0.55, hall: 0.15, delay: 0.22 },
  lead:    { duck: 0.35, hall: 0.2, delay: 0.16 },
  brass:   { duck: 0.3, hall: 0.25, plate: 0.05, cath: 0.12 },
  braam:   { duck: 0, hall: 0.1, cath: 0.22 },
  bell:    { duck: 0.2, hall: 0.5, delay: 0.18, cath: 0.1 },
  fx:      { duck: 0.15, hall: 0.3, through: true },
  hits:    { duck: 0, hall: 0.2, cath: 0.3, through: true },
};
const T = {};
Object.keys(TRACKS).forEach(k => { T[k] = new S.Track(DUR, k); });
const KICKS = []; // { t, depth } → sidechain
const GAPS = [];  // { t, len } → silence before a drop
/** Cut the music dead for `beats` before t. Risers, swells and hits ring through. */
const gap = (t, beats) => GAPS.push({ t, len: beats * B });
// Stereo width (side gain) per track; anything unlisted stays as rendered.
const WIDTH = { pad: 1.6, choir: 1.5, arp: 1.4, lead: 1.5, brass: 1.3, bell: 1.3, strings: 1.4 };
// Reverb and delay tails are cut dead here: the Earthrise vacuum and the tape stop.
const CHOKES = [cue('cosmos', 'earthrise'), sc('memory').start];

// Base levels (linear). The master normalizes loudness afterwards.
const LV = {
  kick: 0.62, clap: 0.5, snare: 0.36, hat: 0.13, ohat: 0.095, shaker: 0.05, crash: 0.12,
  sub: 0.15, bass: 0.2, pad: 0.11, arp: 0.115, lead: 0.17, brass: 0.1, choir: 0.115,
  organ: 0.035, bell: 0.09, impact: 0.4, riser: 0.07,
  ost: 0.26, str: 0.085, braam: 0.2, taiko: 0.36, timp: 0.26, gong: 0.22, subdrop: 0.26,
};
// Macro dynamics (dB): [scene, cue, level]. The song grows from the founding to the
// frontier, drops to a whisper for the rewind and ends at its loudest.
const MACRO = [
  ['open', 'cut', -2.5], ['open', 'title', -0.5],
  ['founding', 'cut', -5],
  ['constitution', 'cut', -5], ['constitution', 'ambition', -3.5],
  ['expansion', 'cut', -2.8],
  ['infra', 'cut', -2.5],
  ['industry', 'cut', -2.2], ['industry', 'light', -1.2],
  ['flight', 'cut', -4.5], ['flight', 'takeoff', -2.5],
  ['abundance', 'cut', -1.5],
  ['arsenal', 'cut', -0.8],
  ['prosperity', 'cut', -2.2],
  ['cosmos', 'cut', -3], ['cosmos', 'liftoff', 0], ['cosmos', 'earthrise', -4.5],
  ['silicon', 'cut', -4.5], ['silicon', 'sand', -1.5],
  ['innovation', 'cut', -3], ['innovation', 'catch', 0],
  ['frontier', 'cut', 1],
  ['memory', 'cut', -5.5], ['memory', 'years', -3.5], ['memory', 'build', -2],
  ['final', 'cut', -0.5], ['final', 'onward', 1.5],
];

// =============================================================================
//  PARTS — helpers that follow the harmony
// =============================================================================
/** Start scoring a scene: sets the key and returns its span and a cue lookup. */
function scene(id) {
  XP = KEY[id] || 0;
  const s = sc(id);
  return { s, t0: s.start, end: s.start + s.dur, q: c => cue(id, c) };
}
/** For each chord overlapping [t0, t1): fn(start, end, chord). */
function eachChord(t0, t1, fn) {
  CHANGES.forEach(c => {
    const s = Math.max(c.t0, t0), e = Math.min(c.t1, t1);
    if (e - s > 0.05) fn(s, e, c);
  });
}
function pads(t0, t1, o = {}) {
  const { gain = LV.pad, a = 0.25, r = 0.5, track = T.pad, ...rest } = o;
  eachChord(t0, t1, (s, e, c) => V.saws(track, s, c.pad, e - s, { gain, a, d: 1, s: 1, r, cutoff: 2000, spread: 1, ...rest }));
}
/** Legato strings: the upper two chord tones an octave up, with vibrato. `low` adds cellos on root and fifth. */
function strs(t0, t1, o = {}) {
  const { gain = LV.str, a = 0.18, r = 0.4, low = 0, ...rest } = o;
  eachChord(t0, t1, (s, e, c) => {
    V.saws(T.strings, s, [c.pad[1] + 12, c.pad[3] + 12], e - s,
      { gain, a, d: 1, s: 1, r, cutoff: 4800, res: 0.5, voices: 5, detune: 13, spread: 0.9, vib: 0.16, hpHz: 220, ...rest });
    if (low) V.saws(T.strings, s, [c.root + 12, c.root + 19], e - s,
      { gain: gain * low, a, d: 1, s: 1, r, cutoff: 1500, res: 0.5, voices: 5, detune: 10, spread: 0.6, vib: 0.1, vibHz: 5, hpHz: 90, ...rest });
  });
}
/** A legato string line in octaves: [[beat, midi, beats], ...] from t0. */
function soar(t0, line, o = {}) {
  const { gain = LV.str * 1.25 } = o;
  line.forEach(([b, m, l]) => V.saws(T.strings, t0 + b * B, [m, m + 12], l * B * 0.97,
    { gain, a: 0.07, d: 1, s: 1, r: 0.3, cutoff: 6000, res: 0.5, voices: 5, detune: 13, spread: 0.9, vib: 0.2, vibDelay: 0.2, hpHz: 300 }));
}
/**
 * Spiccato string ostinato in sixteenths (div 4) or eighths (div 2). dyn 0..1
 * (number or function of time) sets level and bite; high adds violins an octave
 * up; low adds cellos and basses on the accents.
 */
function ost(t0, t1, o = {}) {
  const { div = 4, pattern = div === 4 ? OST16 : OST8, dyn = 0.6, high = 0, low = 0, gain = LV.ost } = o;
  const step = B / div, dynAt = typeof dyn === 'function' ? dyn : () => dyn;
  for (let k = 0; t0 + k * step < t1 - 1e-6; k++) {
    const t = t0 + k * step, c = chordAt(t), tn = lowTones(c), pos = Math.round(t / step) % (4 * div);
    const acc = div === 4 ? ACC332[pos] : pos % 2 ? 0 : 1, d = dynAt(t), g = gain * d * (0.55 + 0.45 * acc);
    const m = tn[pattern[pos % pattern.length] % tn.length];
    V.spiccato(t, m, { gain: g, peak: 1800 + 3600 * d * (0.6 + 0.4 * acc), decay: div === 4 ? 0.07 : 0.1, pan: -0.25 });
    if (high) V.spiccato(t, m + 12, { gain: g * high, peak: 2400 + 4000 * d * (0.6 + 0.4 * acc), decay: 0.06, pan: 0.3 });
    if (low && acc) V.spiccato(t, c.root + 12, { gain: g * low, peak: 1300 + 1500 * d, decay: 0.12, pan: 0.1, voices: 3 });
  }
}
function choirs(t0, t1, o = {}) {
  eachChord(t0, t1, (s, e, c) => V.choir(s, c.pad.slice(0, 3), e - s, { gain: LV.choir, a: 0.35, r: 0.6, ...o }));
}
/** A short choir shout on the chord at t, men an octave below. */
const choirStab = (t, o = {}) => {
  const c = chordAt(t + 0.01);
  V.choir(t, [c.pad[0] - 12, c.pad[2] - 12, ...c.pad.slice(0, 3)], 0.7 * B, { gain: LV.choir * 1.3, a: 0.015, r: 0.25, vib: 0.05, ...o });
};
function subs(t0, t1, o = {}) {
  eachChord(t0, t1, (s, e, c) => V.sub(T.sub, s, c.root, e - s - 0.01, { gain: LV.sub, ...o }));
}
/** Mid bass, an octave above the sub, repeating `pattern` every `every` beats. */
function bassline(t0, t1, pattern, o = {}, every = 1) {
  for (let k = 0; t0 + k * every * B < t1 - 1e-6; k++) {
    const tb = t0 + k * every * B;
    pattern.forEach(([off, len]) => {
      const t = tb + off * B;
      if (t < t1 - 1e-6) V.bass(t, chordAt(t).root + 12, len * B, { gain: LV.bass, ...o });
    });
  }
}
function arp(t0, t1, pattern, div, o = {}) {
  const { voice = 'pluck', gain = LV.arp, oct = 0, peakAt = null, ...rest } = o;
  const step = B / div;
  for (let k = 0; t0 + k * step < t1 - 1e-6; k++) {
    const t = t0 + k * step, m = tones(chordAt(t))[pattern[k % pattern.length]] + oct, pan = k % 2 ? 0.45 : -0.45;
    if (voice === 'mallet') V.mallet(T.arp, t, m, { gain, pan, ...rest });
    else V.pluck(T.arp, t, m, { gain, dur: step * 0.85, pan, ...rest, ...(peakAt ? { peak: peakAt(t) } : {}) });
  }
}
/** Lead voice: a supersaw doubled an octave below, or a bright square. */
function lead(t, m, dur, o = {}) {
  const { gain = LV.lead, voice = 'saw' } = o;
  if (voice === 'square') {
    V.pluck(T.lead, t, m, { gain: gain * 1.6, dur, wave: 'square', pw: 0.4, cutoff: 1400, peak: 4200, decay: 0.25, sustain: 0.65, r: 0.12, detune: 6 });
    return;
  }
  V.saws(T.lead, t, [m], dur, { gain, voices: 7, detune: 16, spread: 0.75, cutoff: 7000, res: 0.6, a: 0.008, d: 0.4, s: 0.8, r: 0.22, hpHz: 200 });
  V.saws(T.lead, t, [m - 12], dur, { gain: gain * 0.45, voices: 5, detune: 12, spread: 0.3, cutoff: 2800, res: 0.6, a: 0.008, d: 0.4, s: 0.8, r: 0.22, hpHz: 120 });
}
/** French horns in octaves: mellow, with a breath-like swell. */
const horn = (t, m, dur, o = {}) => V.brass(t, [m, m - 12], dur,
  { gain: LV.brass, cutLow: 220, cutHigh: 1800, swell: 0.09, settle: 0.7, a: 0.04, r: 0.25, voices: 3, detune: 8, ...o });
/** Trumpets: the same line, brighter. */
const trumpet = (t, m, dur, o = {}) => V.brass(t, [m], dur,
  { gain: LV.brass * 0.7, cutLow: 500, cutHigh: 4200, swell: 0.05, a: 0.02, r: 0.2, voices: 2, detune: 6, spread: 0.3, ...o });
const brassChord = (t, dur, o = {}) => V.brass(t, chordAt(t + 0.01).pad.map(m => m - 12), dur, { gain: LV.brass, ...o });
/**
 * The theme: the motif cell over every bar in [t0, t1), reaching for HOOK[chord].
 * voice: 'horn' | 'square' | 'lead' | 'tutti' (lead, horns, trumpets and strings together).
 */
function theme(t0, t1, o = {}) {
  const { voice = 'lead', gain = 1 } = o;
  for (let tb = t0; tb < t1 - 1e-6; tb += 4 * B) {
    const notes = HOOK[chordAt(tb).name] || HOOK.D;
    CELL.forEach(([b, l], k) => {
      const t = tb + b * B, m = notes[k];
      if (t >= t1 - 1e-6) return;
      const d = Math.min(l * B, t1 - t) * 0.95;
      if (voice === 'square') lead(t, m, d, { voice: 'square', gain: LV.lead * 0.45 * gain });
      if (voice === 'lead' || voice === 'tutti') lead(t, m, d, { gain: LV.lead * gain });
      if (voice === 'horn' || voice === 'tutti') horn(t, m - 12, d, { gain: LV.brass * 1.1 * gain });
      if (voice === 'tutti') { trumpet(t, m, d, { gain: LV.brass * 0.95 * gain }); soar(t, [[0, m, d / B]], { gain: LV.str * 0.9 * gain }); }
    });
  }
}
/** Notes played by the whole band at once: [[beat, midi, beats], ...] from t0. */
function tutti(t0, line, gain = 1) {
  line.forEach(([b, m, l]) => {
    const t = t0 + b * B, d = l * B * 0.95;
    lead(t, m, d, { gain: LV.lead * gain });
    horn(t, m - 12, d, { gain: LV.brass * 1.1 * gain });
    trumpet(t, m, d, { gain: LV.brass * 0.7 * gain });
    soar(t, [[0, m, l]], { gain: LV.str * 0.9 * gain });
  });
}
/** Closed hats at `div` per beat with an offbeat lilt. */
function hats(t0, t1, div, o = {}) {
  const { gain = LV.hat, tone = 1, decay = 0.03, offbeatOnly = false } = o;
  for (let k = 0; t0 + (k * B) / div < t1 - 1e-6; k++) {
    const pos = k % div;
    if (offbeatOnly && !(div === 2 && pos === 1)) continue;
    const acc = div === 4 ? [0.55, 0.35, 1, 0.45][pos] : div === 2 ? [0.6, 1][pos] : 1;
    S.hat(T.drums, t0 + (k * B) / div, { gain: gain * acc, tone, decay, pan: div === 4 ? (pos % 2 ? 0.15 : -0.1) : 0.1 });
  }
}
const openHats = (t0, t1, k = 1) => { for (let t = t0 + B / 2; t < t1 - 1e-6; t += B) S.hat(T.drums, t, { gain: LV.ohat * k, open: true, pan: 0.2 }); };
/** Beat number of time t on the film's grid (every scene starts on a bar line). */
const beatOf = t => Math.round(t / B);
/** Backbeat on beats 2 and 4. */
function claps(t0, t1, k = 1) {
  for (let b = Math.ceil(t0 / B - 1e-6); b * B < t1 - 1e-6; b++) if (b % 2 === 1) S.clap(T.drums, b * B, { gain: LV.clap * k });
}
/** Half-time backbeat: one big snare and clap on beat 3 of every bar. */
function bigBack(t0, t1, k = 1) {
  for (let b = Math.ceil(t0 / B - 1e-6); b * B < t1 - 1e-6; b++) {
    if (b % 4 !== 2) continue;
    S.snare(T.drums, b * B, { gain: LV.snare * 1.2 * k, tone: 170, noiseDecay: 0.2 });
    S.clap(T.drums, b * B, { gain: LV.clap * 0.8 * k, decay: 0.16 });
  }
}
/** War drums: taiko ensemble on the 3-3-2 of every bar, with sixteenth pickups into the next. */
function taikos(t0, t1, k = 1) {
  for (let tb = Math.ceil(t0 / (4 * B) - 1e-6) * 4 * B; tb < t1 - 1e-6; tb += 4 * B) {
    [[0, 1], [1.5, 0.7], [3, 0.8]].forEach(([b, g]) => {
      if (tb + b * B < t1 - 1e-6) S.taiko(T.taiko, tb + b * B, { gain: LV.taiko * 0.6 * g * k, players: 3, decay: 0.3 });
    });
    [[3.5, 0.4], [3.75, 0.55]].forEach(([b, g]) => {
      if (tb + b * B < t1 - 1e-6) S.taiko(T.taiko, tb + b * B, { gain: LV.taiko * 0.6 * g * k, players: 2, f: 105, decay: 0.16, boom: 0 });
    });
  }
}
/** Accelerating build roll: eighths, then sixteenths, then thirty-seconds, swelling. */
function snareRoll(t0, t1, o = {}) {
  const { gain = LV.snare } = o, len = t1 - t0;
  for (let t = t0; t < t1 - 1e-6;) {
    const u = (t - t0) / len;
    S.snare(T.drums, t, { gain: gain * (0.25 + 0.75 * u * u), tone: 200 + 80 * u, noiseDecay: 0.08 });
    t += u < 0.5 ? B / 2 : u < 0.75 ? B / 4 : B / 8;
  }
}
function snareFill(t0, t1, o = {}) {
  for (let t = t0; t < t1 - 1e-6; t += B / 4) S.snare(T.drums, t, { gain: (o.gain || LV.snare) * (0.4 + (0.6 * (t - t0)) / (t1 - t0)), noiseDecay: 0.09 });
}
/** Play anything backwards so that it swells into tEnd: render(track) draws it at time 0. */
function reversed(dst, tEnd, len, render) {
  const tmp = new S.Track(len + 0.05);
  render(tmp);
  const N = Math.round(len * SR), n0 = Math.round(tEnd * SR) - N;
  for (let j = 0; j < N; j++) {
    const i = n0 + j, src = N - 1 - j;
    if (i < 0 || i >= dst.n) continue;
    const f = Math.min(1, j / (0.3 * N), (N - j) / (0.004 * SR)); // fade the quiet far end in; no click at the hit
    dst.L[i] += tmp.L[src] * f; dst.R[i] += tmp.R[src] * f;
  }
}
/** A braam played backwards: a snarl that sucks into the hit at t. */
const reverseBraam = (t, m, len = 1.4, gain = LV.braam * 0.45) =>
  reversed(T.hits, t, len, tr => S.braam(tr, 0, x(m), len * 0.7, { gain, a: 0.03, r: 0.2, sub: 0.2 }));
/**
 * The big hit, scaled by k (0..1+): impact, taiko ensemble and crash; from k 0.5
 * a braam on the chord root; from k 0.8 a tam-tam.
 */
function slam(t, k = 1, o = {}) {
  const c = chordAt(t + 0.01);
  const { root = c.root, braam = k >= 0.5, gong = k >= 0.8, crash = true, drums = true, bright = 0.6, hold = 2.2 } = o;
  S.impact(T.hits, t, { gain: LV.impact * (0.35 + 0.65 * k), size: 0.8 + 0.9 * k, bright });
  if (drums) S.taiko(T.taiko, t, { gain: LV.taiko * (0.55 + 0.45 * k), players: 3 + Math.round(3 * k), decay: 0.4 + 0.25 * k });
  if (crash) S.crash(T.drums, t, { gain: LV.crash * (0.7 + 0.6 * k), decay: 1.2 + k });
  if (gong) S.gong(T.hits, t, { gain: LV.gong * k, decay: 3.5 + 2.5 * k });
  if (braam) V.braam(T.braam, t, root - 12 + XP >= 25 ? root - 12 : root, hold * B * (0.6 + 0.6 * k), { gain: LV.braam * (0.5 + 0.5 * k), peak: 1800 + 1400 * k });
  else if (k >= 0.4) S.subDrop(T.hits, t, { gain: LV.subdrop * k, len: 1 + k });
}

// =============================================================================
//  THE GROOVE — kicks come straight from the timeline's `kick` ranges
// =============================================================================
const KICK_STYLE = {
  founding: { gain: 0.4, f0: 110, f1: 44, decay: 0.2, click: 0, drive: 1.1, lp: 900 },
  memory: { gain: 0.17, f0: 110, f1: 44, decay: 0.2, click: 0, drive: 1.1, lp: 600 },
  // The beat arrives from a distance: low-passed and swelling, opening fully on UNLIMITED AMBITION.
  constitution: t => {
    const amb = cue('constitution', 'ambition'), u = clamp01((t - sc('constitution').start) / (amb - sc('constitution').start));
    return t < amb - 0.01 ? { click: 0.25, gain: LV.kick * (0.55 + 0.35 * u), lp: auto([[sc('constitution').start, 320], [amb, 1600]])(t) } : { click: 0.3 };
  },
  arsenal: { gain: 0.74, f0: 190, f1: 50, decay: 0.22, click: 0.5, drive: 2.4 },
  prosperity: { gain: 0.6, decay: 0.22 },
  // The countdown: a muffled pulse that sharpens toward ignition.
  cosmos: t => {
    const ig = cue('cosmos', 'ignition'), u = clamp01((t - sc('cosmos').start) / (ig - sc('cosmos').start));
    return t < ig ? { click: 0.2, gain: LV.kick * (0.5 + 0.4 * u), lp: 300 * Math.pow(8, u) } : {};
  },
  innovation: t => (t < cue('innovation', 'catch') ? { gain: 0.6, decay: 0.24 } : {}),
};
const DUCK = {
  founding: 0.15, constitution: 0.35, expansion: 0.5, infra: 0.5, industry: 0.55, abundance: 0.55, arsenal: 0.5,
  prosperity: 0.4, cosmos: 0.7, silicon: 0.6, innovation: 0.65, frontier: 0.72, memory: 0.15,
};
function groove() {
  TL.SCENES.forEach(s => s.kick.forEach(([b0, b1, style]) => {
    for (let bar = Math.floor(b0 / 4) * 4; bar < b1; bar += 4) {
      TL.KICK_PATTERNS[style].forEach(off => {
        const b = bar + off;
        if (b < b0 || b >= b1) return;
        const t = s.start + b * B, st = KICK_STYLE[s.id];
        const o = { gain: LV.kick, ...(typeof st === 'function' ? st(t) : st || {}) };
        S.kick(T.kick, t, o);
        KICKS.push({ t, depth: (DUCK[s.id] ?? 0.5) * Math.min(1, o.gain / LV.kick) });
        if (style === 'heart') S.kick(T.kick, t + 0.17, { ...o, gain: o.gain * 0.55 }); // lub-dub
      });
    }
  }));
}

// =============================================================================
//  0 · PROLOGUE — a distant drum, the motif on horn and bell, the title slam
// =============================================================================
function scoreOpen() {
  const { t0, end, q } = scene('open'), title = q('title');
  S.taiko(T.taiko, t0 + 0.02, { gain: LV.taiko * 0.55, players: 3, f: 62, decay: 0.8, slap: 0.15 });
  V.organ(t0, [26, 38, 45, 50], title - t0, { gain: LV.organ * 1.2, a: 2.6, r: 1.0, trem: 0.08 });
  pads(t0, title, { gain: LV.pad * 0.7, a: 1.6, r: 0.5, cutoff: auto([[t0, 350], [title, 900]]) });
  V.shimmer(t0 + 0.4, [81, 86, 90], title - t0, { gain: 0.012, a: 2.2, r: 2 });
  // The motif: D (dotted quarter), E (eighth), A on the flame, D′ under the title.
  [[q('motif'), 74, 1.5], [q('motif') + 1.5 * B, 76, 0.5], [q('flame'), 81, 2], [title, 86, 6]].forEach(([t, m, beats]) => {
    V.bell(t, m, { gain: LV.bell, dur: Math.max(2.5, beats * B + 2) });
    horn(t, m - 12, beats * B * 0.95, { gain: LV.brass * 0.95, a: 0.06, r: 0.5 });
  });
  // The flame catches: a soft whoosh, a low bloom and a roll into the title.
  S.whoosh(T.fx, q('flame') + 0.1, { gain: 0.07, len: 0.6, f0: 300, f1: 3000 });
  S.impact(T.hits, q('flame'), { gain: LV.impact * 0.22, size: 0.6, bright: 0.15 });
  V.timpRoll(q('flame'), title, 38, { gain: LV.timp * 0.8 });
  S.reverseCrash(T.fx, title, { gain: 0.1, len: 2.2 });
  // LIBERTY: braam, tam-tam, taikos, and a floor of choir and strings.
  slam(title, 0.9, { root: 38, bright: 0.5, hold: 3 });
  V.sub(T.sub, title, 38, 5 * B, { gain: LV.sub * 0.6, a: 0.05, r: 0.8 });
  V.choir(title, [50, 57, 62, 66, 69, 74], 6 * B, { gain: LV.choir * 0.9, a: 0.25, r: 1.5 });
  pads(title, end, { gain: LV.pad * 0.9, a: 0.02, r: 0.8, cutoff: auto([[title, 3600], [end, 2000]]) });
  strs(title, end, { gain: LV.str * 0.9, a: 0.4 });
  // The ostinato steals in under the subtitle; a roll and a riser hand over to the founding.
  ost(q('subtitle'), end, { div: 2, dyn: ramp(q('subtitle'), 0.2, end, 0.5) });
  V.timpRoll(at('open', 14), end, 45, { gain: LV.timp * 0.6 });
  S.riser(T.fx, q('legend'), end, { gain: LV.riser * 0.6, f0: 300, f1: 5000, tone: 0.3 });
  S.reverseCrash(T.fx, end, { gain: 0.06, len: 1.2 });
}

// =============================================================================
//  I · FOUNDING — heartbeat, quill shaker, the ostinato, taikos on the truths
// =============================================================================
function scoreFounding() {
  const { t0, end, q } = scene('founding');
  pads(t0, end, { gain: LV.pad * 0.8, cutoff: 1300, a: 0.3 });
  subs(t0, end, { gain: LV.sub * 0.55 });
  ost(t0, end, { div: 2, dyn: 0.5 });
  arp(t0, end, ARP8, 2, { gain: LV.arp * 0.6, cutoff: 350, peak: 2400, decay: 0.12 });
  hats(t0, end, 4, { gain: LV.shaker, tone: 0.75, decay: 0.022 }); // the quill
  // WE HOLD · THESE TRUTHS — taikos, brass and a choir shout on each
  [q('hold'), q('truths')].forEach((t, k) => {
    S.taiko(T.taiko, t, { gain: LV.taiko * 0.75, players: 4, f: 72 + k * 8, decay: 0.5 });
    S.crash(T.drums, t, { gain: LV.crash * 0.5, decay: 1.2 });
    S.impact(T.hits, t, { gain: LV.impact * 0.3, size: 0.8, bright: 0.3 });
    brassChord(t, 1.6 * B, { a: 0.03, swell: 0.08, r: 0.4 });
    choirStab(t, { gain: LV.choir });
  });
  // The horns try the theme for the first time, quietly, under the quotation.
  theme(at('founding', 8), end, { voice: 'horn', gain: 0.75 });
  // LIFE · LIBERTY · THE PURSUIT OF HAPPINESS — three rising chimes
  [[q('life'), 74], [q('liberty'), 79], [q('pursuit'), 83]].forEach(([t, m]) => V.bell(t, m, { gain: LV.bell * 0.9, dur: 2.6 }));
  V.timpRoll(at('founding', 14), end, 43, { gain: LV.timp * 0.55 });
  S.reverseCrash(T.fx, end, { gain: 0.07, len: 1.5 });
}

// =============================================================================
//  II · CONSTITUTION — the beat arrives; a breath, then UNLIMITED AMBITION
// =============================================================================
function scoreConstitution() {
  const { t0, end, q } = scene('constitution'), amb = q('ambition');
  pads(t0, end, { gain: LV.pad, a: 0.2, cutoff: auto([[t0, 1400], [amb, 1800], [amb + 0.3, 3000]]) });
  subs(t0, end, { gain: LV.sub * 0.75 });
  bassline(t0, amb, OFFBEAT, { cutoff: 160, peak: 700 });
  bassline(amb, end, OFFBEAT, { cutoff: 220, peak: 1300 });
  ost(t0, amb, { dyn: ramp(t0, 0.4, amb, 0.65) });
  ost(amb, end, { dyn: 0.75, high: 0.5 });
  arp(amb, end, ARP16, 4, { gain: LV.arp * 0.8, cutoff: 350, peak: 3400 });
  hats(q('limited'), end, 2, { gain: LV.hat * 0.7, offbeatOnly: true });
  claps(amb, end);
  // LIMITED GOVERNMENT. — a short stab
  S.taiko(T.taiko, q('limited'), { gain: LV.taiko * 0.6, players: 3 });
  brassChord(q('limited'), 0.9 * B, { a: 0.02, swell: 0.06, r: 0.25 });
  S.crash(T.drums, q('limited'), { gain: LV.crash * 0.5 });
  // UNLIMITED AMBITION. — half a beat of silence, then the filter opens
  gap(amb, 0.5);
  S.reverseCrash(T.fx, amb, { gain: 0.09, len: 1.0 });
  slam(amb, 0.55, { bright: 0.5 });
  V.brass(amb, [50, 57, 62, 66, 69], 4 * B, { gain: LV.brass * 1.1, a: 0.12, swell: 0.4, r: 0.6 });
  // Bill of Rights: ten amendments, ten sixteenths up the scale, panned with the numerals
  [74, 76, 78, 79, 81, 83, 85, 86, 88, 90].forEach((m, i) => V.pluck(T.arp, q('rights') + (i * B) / 4, m,
    { gain: LV.arp * 0.9, dur: 0.1, cutoff: 1200, peak: 6000, decay: 0.05, wave: 'square', pw: 0.3, pan: -0.1 + i * 0.1 }));
  snareFill(end - 1.5 * B, end, { gain: LV.snare * 0.7 });
}

// =============================================================================
//  III · EXPANSION — the frontier gallop; the horns carry the theme west
// =============================================================================
function scoreExpansion() {
  const { t0, end, q } = scene('expansion'), con = q('continent');
  pads(t0, end, { gain: LV.pad * 0.85, cutoff: auto([[t0, 1800], [end, 3200]]) });
  subs(t0, end);
  bassline(t0, end, GALLOP, { cutoff: 220, peak: 1300 });
  ost(t0, end, { dyn: 0.8, high: 0.5, low: 0.6 });
  hats(t0, end, 4, { gain: LV.hat * 0.75 });
  openHats(con, end);
  claps(t0, end);
  taikos(t0, end, 0.7);
  theme(t0, end, { voice: 'horn', gain: 1.25 });
  // WE CROSSED A CONTINENT — open fifths in the brass, timpani, strings
  S.reverseCrash(T.fx, con, { gain: 0.07, len: 1.0 });
  slam(con, 0.45, { braam: false });
  V.brass(con, [50, 57, 62, 69, 74], 4 * B, { gain: LV.brass * 1.1, a: 0.08, swell: 0.3, r: 0.6 });
  V.timpani(con, 38, { gain: LV.timp, decay: 1.2 });
  strs(con, end, { gain: LV.str, low: 0.9 });
  snareFill(end - B, end, { gain: LV.snare * 0.6 });
  S.reverseCrash(T.fx, end, { gain: 0.06, len: 1.0 });
}

// =============================================================================
//  IV · INFRASTRUCTURE — machinery, three plates, a rising string line, a telegraph
// =============================================================================
function scoreInfra() {
  const { t0, end, q } = scene('infra');
  pads(t0, end, { gain: LV.pad, cutoff: 2600 });
  subs(t0, end);
  bassline(t0, end, OFFBEAT, { cutoff: 240, peak: 1500 });
  ost(t0, end, { dyn: 0.75, high: 0.5, low: 0.5 });
  arp(t0, end, ARP16, 4, { gain: LV.arp * 0.8, cutoff: 400, peak: 3800 });
  hats(t0, end, 4, { gain: LV.hat * 0.8 });
  openHats(t0, end);
  claps(t0, end);
  soar(t0, [[0, 71, 4], [4, 73, 4], [8, 74, 4], [12, 78, 4]]); // B–C♯–D–F♯: the road climbs
  // Machinery: metal ticks on the "e" and "a" of every beat
  for (let t = t0; t < end - 1e-6; t += B) [0.25, 0.75].forEach((o, k) => S.tick(T.perc, t + o * B, { gain: 0.035, f: 3100 + k * 400, decay: 0.008, pan: k ? 0.35 : -0.35 }));
  // Three blueprint plates — left, centre, right — one per beat
  [-0.6, 0, 0.6].forEach((p, i) => {
    const t = q('plates') + i * B;
    S.anvil(T.perc, t, { gain: 0.06, f: 880 + i * 110, decay: 0.35, pan: p });
    S.tom(T.taiko, t, { gain: 0.18, f0: 160, f1: 110, decay: 0.12, pan: p });
  });
  // WE BUILT THE ROADS
  slam(q('roads'), 0.4, { braam: false });
  brassChord(q('roads'), 2.6 * B, { gain: LV.brass * 1.1, a: 0.03, swell: 0.1, r: 0.4 });
  // Telegraph, last bar: "··– ···" (U S)
  [[12, 0.05], [12.25, 0.05], [12.5, 0.2], [13.25, 0.05], [13.5, 0.05], [13.75, 0.05]]
    .forEach(([b, l]) => S.beep(T.perc, at('infra', b), { gain: 0.03, f: 1400, len: l, pan: 0.4 }));
}

// =============================================================================
//  V · INDUSTRY — a rolling build, then stop-time: STEEL. RAIL. LIGHT.
// =============================================================================
function scoreIndustry() {
  const { t0, end, q } = scene('industry'), stop = q('steel'), go = q('light');
  pads(t0, stop, { gain: LV.pad, cutoff: 2800 });
  pads(go, end, { gain: LV.pad * 1.1, cutoff: 4200, a: 0.01 });
  subs(t0, stop); subs(go, end);
  bassline(t0, stop, ROLLING, { cutoff: 260, peak: 1700 });
  bassline(go, end, ROLLING, { cutoff: 300, peak: 2000 });
  ost(t0, stop, { dyn: ramp(t0, 0.7, stop, 0.95), high: 0.6, low: 0.6 });
  ost(go, end, { dyn: 0.9, high: 0.7, low: 0.6 });
  arp(t0, stop, ARP16, 4, { gain: LV.arp * 0.8, cutoff: 420, peak: 4000 });
  arp(go, end, ARP16, 4, { cutoff: 450, peak: 4500 });
  hats(t0, stop, 4, { gain: LV.hat * 0.85 }); hats(go, end, 4, { gain: LV.hat * 0.9 });
  openHats(t0, stop); openHats(go, end);
  claps(t0, stop); claps(go, end);
  taikos(t0, at('industry', 4), 0.7);
  for (let i = 0; i < 4; i++) S.tick(T.perc, q('milestones') + i * B, { gain: 0.05, f: 2400, decay: 0.02, noise: 0.1 });
  // Bar 2 winds up
  snareRoll(at('industry', 4), stop, { gain: LV.snare * 0.75 });
  S.riser(T.fx, at('industry', 4), stop, { gain: LV.riser * 0.8, f0: 400, f1: 8000 });
  S.reverseCrash(T.fx, stop, { gain: 0.09, len: 1.5 });
  // The three hits — anvil, taikos, brass — walk IV, V, I.
  [[stop, 'G', 620], [q('rail'), 'A', 700], [go, 'D', 830]].forEach(([t, ch, f], k) => {
    const last = k === 2;
    S.anvil(T.perc, t, { gain: 0.12 + k * 0.03, f, decay: last ? 1.6 : 0.8 });
    if (!last) { S.kick(T.kick, t, { gain: LV.kick, decay: 0.22, click: 0.5 }); KICKS.push({ t, depth: 0.5 }); }
    V.brass(t, CHORDS[ch].pad.map(m => m - 12), last ? 3.5 * B : 0.9 * B, { gain: LV.brass * 1.3, a: 0.015, swell: 0.05, r: last ? 0.6 : 0.2 });
    V.saws(T.pad, t, CHORDS[ch].pad, last ? 0.1 : 0.9 * B, { gain: LV.pad * 1.4, cutoff: 5000, a: 0.005, d: 0.3, s: 0.6, r: 0.25 });
    choirStab(t, { gain: LV.choir * 1.1 });
    if (last) slam(t, 0.7, { root: 38 });
    else { S.taiko(T.taiko, t, { gain: LV.taiko * 0.8, players: 5 }); S.impact(T.hits, t, { gain: LV.impact * (0.3 + k * 0.1), size: 0.8, bright: 0.5 }); }
  });
  // LIGHT: the lead enters with the motif
  [[0, 74, 1.5], [1.5, 76, 0.5], [2, 81, 2], [4, 78, 1], [5, 76, 1]].forEach(([b, m, l]) => lead(go + b * B, m, l * B * 0.95));
  strs(go, end, { low: 0.9 });
}

// =============================================================================
//  VI · FLIGHT — breakdown: drums out, choir and strings, a lift on takeoff
// =============================================================================
function scoreFlight() {
  const { t0, end, q } = scene('flight'), up = q('takeoff');
  pads(t0, end, { gain: LV.pad * 1.1, a: 0.6, r: 0.8, cutoff: auto([[t0, 900], [up, 2600], [up + 0.4, 4200], [end, 4500]]) });
  V.choir(t0 + 0.2, [62, 66, 71], up - t0 - 0.2, { gain: LV.choir, a: 1.2 });
  V.choir(up, [50, 62, 66, 69, 74], end - up, { gain: LV.choir * 1.2, a: 0.3, r: 1.2 });
  strs(t0, up, { gain: LV.str * 0.8, a: 0.8 });
  arp(t0, end, ARP16, 4, { gain: LV.arp * 0.8, cutoff: 250, peakAt: auto([[t0, 700], [up, 3200], [end, 4500]]) });
  S.riser(T.fx, t0 + 0.5, up, { gain: LV.riser, f0: 300, f1: 6000 });
  S.reverseCrash(T.fx, up, { gain: 0.08, len: 1.5 });
  // Takeoff: the lift
  S.impact(T.hits, up, { gain: LV.impact * 0.45, size: 1.4, bright: 0.25 });
  S.subDrop(T.hits, up, { gain: LV.subdrop * 0.5, f0: 70, f1: 36, len: 2 });
  S.crash(T.drums, up, { gain: LV.crash * 0.9, decay: 1.8 });
  subs(up, end, { gain: LV.sub * 0.7 });
  [[0, 74, 1.5], [1.5, 76, 0.5], [2, 81, 2], [4, 78, 1], [5, 76, 1]].forEach(([b, m, l]) => {
    lead(up + b * B, m, l * B * 0.95, { gain: LV.lead * 0.85 });
    horn(up + b * B, m - 12, l * B * 0.95, { gain: LV.brass * 0.9 });
  });
  soar(up, [[0, 81, 4], [4, 83, 2], [6, 85, 2]]); // the violins climb with it: A–B–C♯
  // Back into the groove: timpani, snare roll, a beat of nothing
  V.timpRoll(at('flight', 12), end - 0.25 * B, 45, { gain: LV.timp * 0.8 });
  snareRoll(at('flight', 12), end - 0.25 * B, { gain: LV.snare * 0.8 });
  S.riser(T.fx, at('flight', 12), end - 0.25 * B, { gain: LV.riser * 0.9, f0: 500, f1: 9000, tone: 0.6 });
  S.reverseCrash(T.fx, end, { gain: 0.08, len: 1.0 });
  gap(end, 0.25);
}

// =============================================================================
//  VII · ABUNDANCE — the groove returns: clockwork mallets, the theme on a square lead
// =============================================================================
function scoreAbundance() {
  const { t0, end, q } = scene('abundance');
  slam(t0, 0.45, { braam: false });
  pads(t0, end, { gain: LV.pad, cutoff: 3200 });
  subs(t0, end);
  bassline(t0, end, OFFBEAT, { cutoff: 260, peak: 1600 });
  arp(t0, end, CLOCK, 4, { voice: 'mallet', gain: LV.arp, decay: 0.22, oct: 12 });
  ost(t0, end, { dyn: 0.7, high: 0.4, low: 0.5 });
  strs(t0, end, { gain: LV.str * 0.8, low: 0.9 });
  hats(t0, end, 4, { gain: LV.hat * 0.85 }); openHats(t0, end); claps(t0, end);
  // The line steps forward on each beat; a soft clack where it stops.
  for (let t = t0; t < end - 1e-6; t += B) S.tick(T.perc, t + 0.55 * B, { gain: 0.03, f: 1800, decay: 0.01, noise: 0.5, pan: -0.2 });
  // ABUNDANCE.
  S.crash(T.drums, q('title'), { gain: LV.crash * 0.8 });
  S.taiko(T.taiko, q('title'), { gain: LV.taiko * 0.6, players: 3 });
  brassChord(q('title'), 4 * B, { a: 0.06, swell: 0.25, r: 0.5 });
  theme(t0, end, { voice: 'square' });
  // The last bar darkens: a snarl sucks into the war
  snareFill(end - B, end, { gain: LV.snare * 0.6 });
  reverseBraam(end, 35, 1.6);
}

// =============================================================================
//  VIII · ARSENAL — B minor: war drums, braams on the cuts, strings and choir at full cry
// =============================================================================
function scoreArsenal() {
  const { t0, end, q } = scene('arsenal');
  // A braam, taikos and a choir shout on every cut
  [t0, q('shot2'), q('shot3')].forEach((t, k) => {
    slam(t, 0.7 + 0.05 * k, { bright: 0.6, gong: k === 0, hold: 1.8 });
    choirStab(t, { gain: LV.choir * 1.4 });
    brassChord(t, 1.5 * B, { gain: LV.brass * 1.3, a: 0.01, swell: 0.05, r: 0.35, cutHigh: 3600 });
  });
  // Strings: sixteenth-note tremolo under a spiccato ostinato in octaves
  eachChord(t0, end, (a, e, c) => V.saws(T.strings, a, c.pad.map(m => m - 12).concat(c.pad), e - a,
    { gain: LV.pad * 0.7, cutoff: 2600, a: 0.005, d: 1, s: 1, r: 0.2, voices: 5, detune: 14, gate: S.gate16(new Array(16).fill(1), a, B / 4) }));
  ost(t0, end, { dyn: 1, high: 0.8, low: 0.8 });
  // Trombones hold the chord low
  eachChord(t0, end, (a, e, c) => V.brass(a, [c.root + 12, c.root + 19, c.root + 24], e - a - 0.03,
    { gain: LV.brass * 0.9, cutLow: 180, cutHigh: 1300, swell: 0.2, settle: 0.8, a: 0.05, r: 0.2 }));
  subs(t0, end, { drive: 1.8, gain: LV.sub * 0.75 });
  bassline(t0, end, ROLLING, { cutoff: 380, peak: 1400, drive: 3.2, mix: 0.5 });
  hats(t0, end, 4, { gain: LV.hat * 0.95 });
  // Military snare: backbeat with ruffs, over the timeline's 3-3-2 kick
  for (let b = 1; b < 16; b += 2) {
    S.snare(T.drums, at('arsenal', b), { gain: LV.snare * 0.85, tone: 175, noiseDecay: 0.16 });
    [-0.25, -0.125].forEach((o, k) => S.snare(T.drums, at('arsenal', b + o), { gain: LV.snare * (0.25 + 0.15 * k), tone: 190, noiseDecay: 0.06 }));
  }
  taikos(t0, end, 1);
  // The red counters roll: ticks on thirty-seconds while the numbers climb
  [[q('shot2'), 3.2 * B], [q('shot3') + 0.6, 1.8]].forEach(([t, len]) => { for (let u = 0; u < len - 1e-6; u += B / 8) S.tick(T.perc, t + u, { gain: 0.025, f: 2800, decay: 0.006, noise: 0.6 }); });
  // Bar 4, on the dominant: the choir rises, timpani and snare roll toward the release
  choirs(at('arsenal', 12), end, { gain: LV.choir * 1.2, a: 1.2 });
  V.timpRoll(at('arsenal', 12), end, 42, { gain: LV.timp });
  S.riser(T.fx, at('arsenal', 12), end, { gain: LV.riser, f0: 400, f1: 8000 });
  snareRoll(at('arsenal', 14), end, { gain: LV.snare * 0.7 });
  S.reverseCrash(T.fx, end, { gain: 0.08, len: 1.2 });
}

// =============================================================================
//  IX · PROSPERITY — release into major: half time, horn chorale, a broad string melody
// =============================================================================
function scoreProsperity() {
  const { t0, end, q } = scene('prosperity');
  S.crash(T.drums, t0, { gain: LV.crash * 0.9, decay: 1.8 });
  S.impact(T.hits, t0, { gain: LV.impact * 0.3, size: 1.2, bright: 0.3 });
  S.gong(T.hits, t0, { gain: LV.gong * 0.4, decay: 4, bright: 0.6 });
  pads(t0, end, { gain: LV.pad * 1.1, cutoff: 3000, a: 0.15 });
  eachChord(t0, end, (a, e, c) => V.brass(a, c.pad.map(m => m - 12), e - a - 0.05, { gain: LV.brass * 0.9, a: 0.25, swell: 0.6, settle: 0.8, r: 0.5, cutHigh: 2200 }));
  choirs(t0, end, { gain: LV.choir * 0.95 });
  strs(t0, end, { gain: LV.str * 0.7, low: 1.3 });
  subs(t0, end);
  bassline(t0, end, [[0, 1.85]], { cutoff: 300, peak: 900, decay: 0.3 }, 2);
  hats(t0, end, 2, { gain: LV.hat * 0.8 });
  bigBack(t0, end);
  ost(t0, end, { div: 2, dyn: 0.55 });
  // The melody, strings in octaves with a horn beneath: it arrives on high D with the headline.
  const tune = [[0, 83, 1.5], [1.5, 81, 0.5], [2, 79, 1], [3, 83, 1], [4, 85, 2], [6, 81, 1], [7, 85, 1], [8, 86, 4], [12, 90, 2], [14, 88, 1], [15, 86, 1]];
  soar(t0, tune);
  tune.forEach(([b, m, l]) => horn(t0 + b * B, m - 24, l * B * 0.95, { gain: LV.brass * 0.8 }));
  // Interstate corridors: one ping per eighth note, rising and settling on the pentatonic
  [74, 78, 81, 83, 86, 83, 81, 78, 81, 83, 86, 88, 90].forEach((m, i) => V.bell(q('routes') + (i * B) / 2, m, { gain: LV.bell * 0.5, dur: 1.6, index: 1.6 }));
  // PROSPERITY, AT SCALE.
  S.reverseCrash(T.fx, q('title'), { gain: 0.07, len: 1.0 });
  S.crash(T.drums, q('title'), { gain: LV.crash * 0.8 });
  V.timpani(q('title'), 38, { gain: LV.timp, decay: 1.4 });
  V.bell(q('title'), 86, { gain: LV.bell * 0.8, dur: 3 });
  S.downlifter(T.fx, at('prosperity', 14), { gain: 0.05, len: 0.9 }); // a hush before the countdown
}

// =============================================================================
//  X · COSMOS — the countdown, a beat of engines alone, the drop, then vacuum
// =============================================================================
function scoreCosmos() {
  const { t0, end, q } = scene('cosmos'), ign = q('ignition'), lift = q('liftoff'), rise = q('earthrise');
  // The count: organ and strings crescendo IV → V, a beep on every beat, rolls, risers
  V.organ(t0, [43, 50, 55, 59], 4 * B - 0.02, { gain: LV.organ * 1.2, a: 0.8, r: 0.15 });
  V.organ(at('cosmos', 4), [45, 52, 57, 61], ign - at('cosmos', 4), { gain: LV.organ * 1.6, a: 0.3, r: 0.1 });
  pads(t0, ign, { gain: LV.pad, a: 0.5, cutoff: auto([[t0, 500], [ign, 3500]]) });
  subs(t0, ign, { gain: LV.sub * 0.6 });
  ost(t0, ign, { dyn: ramp(t0, 0.45, ign, 1), high: 0.6, low: 0.6 });
  for (let b = 0; b < 8; b++) S.beep(T.fx, at('cosmos', b), { gain: b === 7 ? 0.05 : 0.035, f: b === 7 ? 1320 : 990, len: 0.07 });
  snareRoll(t0, ign, { gain: LV.snare * 0.9 });
  V.timpRoll(t0, at('cosmos', 4), 43, { gain: LV.timp * 0.7, to: 0.6 });
  V.timpRoll(at('cosmos', 4), ign, 45, { gain: LV.timp, from: 0.6 });
  S.riser(T.fx, t0, ign, { gain: LV.riser * 1.3, f0: 200, f1: 9000, tone: 0.7, n0: 38, n1: 73 });
  S.shepard(T.fx, t0, ign, { gain: 0.025, rate: 0.5 });
  // Ignition: the music stops. One beat of engines, a snarl and a cymbal swelling into liftoff.
  gap(lift, 1);
  S.rumble(T.fx, ign, rise, { gain: 0.13, attack: 0.4, release: 0.05 });
  S.reverseCrash(T.fx, lift, { gain: 0.1, len: 2 });
  reverseBraam(lift, 26, 1.2);
  // LIFTOFF — the drop
  slam(lift, 1, { root: 38, hold: 3 });
  pads(lift, rise, { gain: LV.pad * 1.05, cutoff: 8000, a: 0.005, gate: S.gate16(GATE, lift, B / 4) });
  pads(lift, rise, { gain: LV.pad * 0.5, cutoff: 2500 });
  subs(lift, rise);
  bassline(lift, rise, ROLLING, { cutoff: 320, peak: 2200 });
  arp(lift, rise, ARP16, 4, { cutoff: 500, peak: 5000 });
  ost(lift, rise, { dyn: 1, high: 0.6, low: 0.8 });
  hats(lift, rise, 4, { gain: LV.hat }); openHats(lift, rise); claps(lift, rise);
  taikos(lift, rise, 1);
  theme(lift, rise, { voice: 'tutti', gain: 1.2 });
  choirs(lift, rise, { gain: LV.choir * 1.1 });
  strs(lift, rise, { low: 1 });
  // EARTHRISE — everything stops. A Quindar tone, the choir, a distant bell.
  S.beep(T.perc, rise, { gain: 0.045, f: 2525, len: 0.25 });
  choirs(rise, end, { gain: LV.choir * 0.9, a: 1.0, r: 1.2 });
  pads(rise, end, { gain: LV.pad * 0.5, cutoff: 1200, a: 1.2, r: 1 });
  V.shimmer(rise, [86, 93], end - rise, { gain: 0.01, a: 1.5 });
  [[q('left'), 86, 2], [q('left') + 1.5 * B, 88, 2], [q('left') + 2 * B, 93, 3]].forEach(([t, m, d]) => V.bell(t, m, { gain: LV.bell * 0.6, dur: d + 1 }));
  subs(rise, end, { gain: LV.sub * 0.4, a: 0.8 });
  S.riser(T.fx, at('cosmos', 20), end, { gain: LV.riser * 0.6, f0: 400, f1: 7000, tone: 0.2 });
  S.reverseCrash(T.fx, end, { gain: 0.07, len: 1.5 });
}

// =============================================================================
//  XI · SILICON — a digital arpeggio whose filter opens along Moore's law
// =============================================================================
function scoreSilicon() {
  const { t0, end, q } = scene('silicon'), sand = q('sand');
  // The on-screen transistor curve draws over MOORE = [0.9, 6.4] s with in-out easing; the filter follows it.
  const moore = t => 350 * Math.pow(9000 / 350, inOut(clamp01((t - t0 - 0.9) / 5.5)));
  const pre = at('cosmos', 20);
  arp(pre, end, DIGI, 4, { wave: 'square', pw: 0.3, gain: LV.arp * 0.9, cutoff: 200, decay: 0.07,
    peakAt: t => (t < t0 ? 300 + (50 * (t - pre)) / (t0 - pre) : moore(t)) });
  pads(t0, end, { gain: LV.pad * 0.9, cutoff: auto([[t0, 900], [sand, 2400], [end, 4200]]) });
  subs(t0, end);
  hats(t0, end, 4, { gain: LV.hat * 0.7 });
  // Data: seeded random glitches on the sixteenth grid
  const R = S.rng(1971);
  for (let k = 0; k < 64; k++) if (R() < 0.3) S.glitch(T.perc, t0 + (k * B) / 4, { gain: 0.03, f: [1175, 1480, 1760, 2349][Math.floor(R() * 4)], len: 0.04 + R() * 0.04, pan: R() * 1.6 - 0.8 });
  // WE TAUGHT SAND TO THINK — half a beat of silence, then the beat drops in
  gap(sand, 0.5);
  S.reverseCrash(T.fx, sand, { gain: 0.09, len: 2 });
  slam(sand, 0.55, { root: 38 });
  bassline(sand, end, OFFBEAT, { cutoff: 280, peak: 1900 });
  ost(sand, end, { dyn: 0.8, high: 0.5, low: 0.6 });
  claps(sand, end); openHats(sand, end);
  theme(sand, end, { voice: 'square', gain: 1.1 });
  snareFill(end - B, end, { gain: LV.snare * 0.7 });
}

// =============================================================================
//  XII · ACCELERATED INNOVATION — a tense descent, the catch, then the climb to a new key
// =============================================================================
function scoreInnovation() {
  const { t0, end, q } = scene('innovation'), ct = q('catch'), climb = at('innovation', 16);
  // Descent: half-time drums, strings tightening, a falling engine tone that slows with the booster
  pads(t0, ct, { gain: LV.pad * 0.9, cutoff: 1600 });
  subs(t0, ct, { gain: LV.sub * 0.7 });
  ost(t0, ct, { dyn: ramp(t0, 0.45, ct, 0.95), low: 0.6 });
  hats(t0, ct, 2, { gain: LV.hat * 0.7 });
  bigBack(t0, ct);
  const fall = q('arms') - t0 - 0.25;
  V.sub(T.fx, t0 + 0.25, 45, fall, { gain: 0.05, glide: [93, fall], drive: 2.5, r: 0.1 });
  S.rumble(T.fx, t0 + 0.25, q('arms') - 0.25, { gain: 0.07, attack: 0.3, release: 0.15 });
  V.timpRoll(at('innovation', 5), ct - 0.5 * B, 43, { gain: LV.timp * 0.8 });
  // The arms swing shut in half a beat of silence
  gap(ct, 0.5);
  S.whoosh(T.fx, q('arms') + 0.5 * B, { gain: 0.07, len: 0.5, f0: 800, f1: 6000 });
  S.reverseCrash(T.fx, ct, { gain: 0.1, len: 2 });
  reverseBraam(ct, 26, 1.3);
  // THE CATCH
  slam(ct, 0.95, { root: 38, hold: 2.6 });
  S.anvil(T.perc, ct, { gain: 0.12, f: 310, decay: 1.2 }); // steel on steel
  brassChord(ct, 2 * B, { gain: LV.brass * 1.3, a: 0.01, swell: 0.05, r: 0.4 });
  pads(ct, end, { gain: LV.pad, cutoff: 8000, a: 0.005, gate: S.gate16(GATE, ct, B / 4) });
  pads(ct, end, { gain: LV.pad * 0.5, cutoff: 2500 });
  subs(ct, end);
  bassline(ct, end, ROLLING, { cutoff: 320, peak: 2200 });
  arp(ct, end, ARP16, 4, { cutoff: 500, peak: 5200 });
  ost(ct, end, { dyn: 1, high: 0.6, low: 0.8 });
  hats(ct, end, 4, { gain: LV.hat }); openHats(ct, end); claps(ct, end);
  taikos(ct, climb, 0.9);
  strs(ct, end, { low: 1 });
  theme(ct, q('tools'), { voice: 'tutti', gain: 1.15 });
  // THE TOOLS OF ABUNDANCE: a whoosh across the crossfade and a rising stab per plate (D, G, B)
  S.whoosh(T.fx, q('tools'), { gain: 0.07, len: 0.7 });
  [74, 79, 83].forEach((m, i) => {
    const t = q('tools') + i * B;
    V.saws(T.lead, t, [m, m - 12], 0.35, { gain: LV.lead * 1.1, cutoff: 6000, a: 0.005, d: 0.2, s: 0.5, r: 0.2 });
    V.bell(t, m + 12, { gain: LV.bell * 0.5, dur: 1.5 });
  });
  S.crash(T.drums, q('abundance'), { gain: LV.crash * 0.7 });
  // Bar 5 climbs IV–V toward the new key: the whole band walks up A–B–C♯–D♯ over a rising bass
  tutti(climb, [[0, 69, 1], [1, 71, 1], [2, 73, 1], [3, 75, 0.5]]);
  choirs(climb, end, { gain: LV.choir * 1.2, a: 0.3 });
  V.timpRoll(climb, at('innovation', 18), 45, { gain: LV.timp, from: 0.4, to: 0.7 });
  V.timpRoll(at('innovation', 18), end - 0.5 * B, 47, { gain: LV.timp, from: 0.7 });
  snareRoll(climb, end - 0.5 * B, { gain: LV.snare * 0.8 });
  S.riser(T.fx, climb, end - 0.5 * B, { gain: LV.riser * 1.1, f0: 400, f1: 9000, n0: 45, n1: 75 });
  S.reverseCrash(T.fx, end, { gain: 0.1, len: 1.5 });
  gap(end, 0.5);
}

// =============================================================================
//  XIII · FRONTIER — the peak, a whole step higher: the theme on everything
// =============================================================================
function scoreFrontier() {
  const { t0, end, q } = scene('frontier'), stop = q('stop');
  slam(t0, 0.95, { bright: 0.7, hold: 2.6 });
  pads(t0, end, { gain: LV.pad, cutoff: 9000, a: 0.005, gate: S.gate16(GATE, t0, B / 4) });
  pads(t0, end, { gain: LV.pad * 0.55, cutoff: 3000 });
  choirs(t0, end, { gain: LV.choir * 1.25 });
  strs(t0, end, { low: 1 });
  subs(t0, end);
  bassline(t0, stop, ROLLING, { cutoff: 340, peak: 2400 });
  arp(t0, end, ARP16, 4, { cutoff: 550, peak: 5600 });
  ost(t0, end, { dyn: 1, high: 0.6, low: 0.9 });
  hats(t0, stop, 4, { gain: LV.hat * 1.05 }); openHats(t0, stop); claps(t0, stop);
  taikos(t0, stop, 1);
  theme(t0, end, { voice: 'tutti', gain: 1.3 });
  soar(t0, [[0, 90, 4], [4, 91, 4], [8, 93, 4], [12, 93, 2], [14, 95, 2]], { gain: LV.str * 1.1 }); // the violins ride above it all
  S.shepard(T.fx, t0, stop, { gain: 0.02, rate: 0.35, fadeIn: 2 });
  // Each statement lifts a step: a chime a tone higher and a soft crash.
  [['energy', 86], ['worlds', 88], ['minds', 90]].forEach(([c, m]) => {
    V.bell(q(c), m, { gain: LV.bell * 0.8, dur: 2.5 });
    S.crash(T.drums, q(c), { gain: LV.crash * 0.55 });
  });
  // The tape stop over the last beat is applied to the whole mix in mixdown().
}

// =============================================================================
//  XIV · TWO HUNDRED FIFTY YEARS — the rewind accelerates, a warm swell, the build home
// =============================================================================
function scoreMemory() {
  const { s, t0, end, q } = scene('memory'), yrs = q('years'), build = q('build');
  const marks = s.marksAt.map(m => t0 + m);
  pads(t0, yrs, { gain: LV.pad * 0.6, cutoff: 900, a: 0.4 });
  subs(t0, yrs, { gain: LV.sub * 0.35, a: 0.3 });
  // The motif runs backwards, falling through time — one note per symbol, each
  // preceded by its own reversed echo swelling into the cut.
  [86, 81, 76, 74, 69, 64].forEach((m, i) => {
    const t = marks[i];
    V.bell(t, m, { gain: LV.bell * 0.75, dur: 2.0 });
    if (i > 0) V.bell(marks[i - 1], m, { gain: LV.bell * 0.45, dur: t - marks[i - 1], reverse: true });
    S.whoosh(T.fx, t, { gain: 0.03, len: 0.22, f0: 2000, f1: 8000 });
  });
  // Tick-tock on every beat
  for (let b = 0; b < 8; b++) S.tick(T.perc, at('memory', b), { gain: 0.03, f: b % 2 ? 1500 : 2000, decay: 0.01, noise: 0.4, pan: b % 2 ? 0.4 : -0.4 });
  // 250 YEARS — a warm swell on IV
  V.bell(marks[5], 74, { gain: LV.bell * 0.45, dur: yrs - marks[5], reverse: true });
  S.impact(T.hits, yrs, { gain: LV.impact * 0.35, size: 1.6, bright: 0.1 });
  S.gong(T.hits, yrs, { gain: LV.gong * 0.45, decay: 4, bright: 0.5 });
  V.timpani(yrs, 43, { gain: LV.timp * 0.7, decay: 1.5 });
  pads(yrs, end, { gain: LV.pad * 0.95, a: 0.3, cutoff: auto([[yrs, 1500], [build, 2200], [end, 5000]]) });
  choirs(yrs, end, { gain: LV.choir, a: 0.4 });
  strs(yrs, end, { gain: LV.str, a: 0.4, low: 1 });
  [74, 81].forEach(m => V.bell(yrs, m, { gain: LV.bell * 0.7, dur: 3.5 }));
  subs(yrs, end, { gain: LV.sub * 0.6 });
  // The build home starts here and runs on through the cut (scoreFinal carries it to ONWARD).
  V.organ(build, [40, 47, 52, 55], 4 * B, { gain: LV.organ * 1.3, a: 1.2, r: 0.2 });
  ost(build, end, { dyn: ramp(build, 0.35, end, 0.85), low: 0.5 });
  V.timpRoll(build, end, 40, { gain: LV.timp * 0.9, to: 0.7 });
  snareRoll(build, end, { gain: LV.snare * 0.7 });
}

// =============================================================================
//  FINAL — three unison blows climb the motif; it lands on ONWARD and rings into the future
// =============================================================================
function scoreFinal() {
  const { t0, end, q } = scene('final'), on = q('onward'), hush = on - 0.5 * B;
  const build = cue('memory', 'build');
  S.riser(T.fx, build, hush, { gain: LV.riser * 1.3, f0: 200, f1: 10000, tone: 0.8, n0: x(45), n1: x(81) });
  S.shepard(T.fx, build, hush, { gain: 0.03, rate: 0.5 });
  // Bar 1: the motif climbs D–E–A over its own sus chord, the whole band and the drums as one
  pads(t0, on, { gain: LV.pad, cutoff: auto([[t0, 2500], [on, 6000]]) });
  V.organ(t0, [33, 45, 50, 52, 57], on - t0, { gain: LV.organ * 1.5, a: 0.2, r: 0.1 });
  ost(t0, hush, { dyn: 1, high: 0.8, low: 0.8 });
  V.timpRoll(t0, hush, 45, { gain: LV.timp, from: 0.7 });
  [[0, 74, 1.5], [1.5, 76, 0.5], [2, 81, 1.5]].forEach(([b, m, l], k) => {
    const t = t0 + b * B;
    tutti(t0, [[b, m, l]], 1.1);
    S.taiko(T.taiko, t, { gain: LV.taiko * (0.8 + 0.1 * k), players: 6, decay: 0.5 });
    S.impact(T.hits, t, { gain: LV.impact * 0.3, size: 0.8, bright: 0.5 });
    choirStab(t, { gain: LV.choir * 1.3 });
    S.kick(T.kick, t, { gain: LV.kick * 0.9, decay: 0.22 });
    KICKS.push({ t, depth: 0.4 });
  });
  // Half a beat of nothing
  gap(on, 0.5);
  S.reverseCrash(T.fx, on, { gain: 0.09, len: 2.2 });
  reverseBraam(on, 26, 1.5);
  // ONWARD. — the octave at last, over everything
  slam(on, 1.1, { root: 38, hold: 4.5, bright: 0.8 });
  S.kick(T.kick, on, { gain: LV.kick, decay: 0.3 });
  KICKS.push({ t: on, depth: 0.6 });
  const ring = end - on;
  V.saws(T.pad, on, [50, 57, 62, 66, 69, 74, 78, 81], ring, { gain: LV.pad * 1.3, cutoff: auto([[on, 7000], [end, 1500]]), a: 0.005, d: 2.5, s: 0.5, r: 1.0 });
  lead(on, 86, 2.8, { gain: LV.lead * 1.2 });
  V.brass(on, [38, 50, 54, 57, 62, 66], ring - 1, { gain: LV.brass * 1.2, a: 0.02, swell: 0.1, r: 1 });
  trumpet(on, 74, ring - 1.5, { gain: LV.brass * 0.8, r: 1 }); trumpet(on, 78, ring - 1.5, { gain: LV.brass * 0.6, r: 1 });
  V.choir(on, [50, 57, 62, 66, 69, 74], ring - 1.2, { gain: LV.choir * 1.4, a: 0.12, r: 1.5 });
  V.organ(on, [26, 38, 45, 50, 54, 57], ring - 1, { gain: LV.organ * 1.5, a: 0.05, r: 1.5 });
  V.saws(T.strings, on, [78, 81, 86, 90], ring - 0.8, { gain: LV.str * 1.2, a: 0.05, d: 1, s: 1, r: 1.2, cutoff: 6000, voices: 5, detune: 13, vib: 0.18, hpHz: 300 });
  V.sub(T.sub, on, 38, ring - 1.5, { gain: LV.sub, r: 1.2 });
  V.timpRoll(on, on + 6 * B, 38, { gain: LV.timp * 1.1, from: 1, to: 0.15, curve: 0.7 });
  // THE BEST IS STILL AHEAD — a second, softer blow; the motif twice as fast, an octave up
  S.taiko(T.taiko, q('ahead'), { gain: LV.taiko * 0.7, players: 5, decay: 0.6 });
  S.impact(T.hits, q('ahead'), { gain: LV.impact * 0.35, size: 1.4, bright: 0.2 });
  [[0, 86], [0.75, 88], [1, 93], [2, 98]].forEach(([b, m]) => V.bell(q('ahead') + b * B, m, { gain: LV.bell * 0.55, dur: 2.5 }));
  S.shepard(T.fx, on + 1, end, { gain: 0.02, rate: 0.4, fadeIn: 2 });
}

// =============================================================================
//  MIX & MASTER
// =============================================================================
/** Run an effect per segment between CHOKES so tails stop dead at each choke (80 ms fade). */
function fxReturn(L, R, proc) {
  const n = L.length, outL = new Float32Array(n), outR = new Float32Array(n);
  const edges = [0, ...CHOKES.map(t => Math.round(t * SR)), n];
  for (let k = 0; k < edges.length - 1; k++) {
    const a = edges[k], b = edges[k + 1], tail = Math.min(n, b + Math.round(0.08 * SR));
    const wet = proc(L.slice(a, tail).fill(0, b - a), R.slice(a, tail).fill(0, b - a));
    for (let j = 0; j < tail - a; j++) {
      const i = a + j, f = i < b ? 1 : 1 - (i - b) / (tail - b);
      outL[i] += wet.L[j] * f; outR[i] += wet.R[j] * f;
    }
  }
  return { L: outL, R: outR };
}
/** Gain curve for the silences before the drops: an 8 ms fade down, back at full exactly on the hit. */
function gapCurve(n) {
  const g = new Float32Array(n).fill(1), fade = Math.round(0.008 * SR);
  for (const { t, len } of GAPS) {
    const a = Math.round((t - len) * SR), b = Math.round(t * SR);
    for (let i = Math.max(0, a); i < Math.min(n, b); i++) g[i] = Math.min(g[i], Math.max(0, 1 - (i - a) / fade));
  }
  return g;
}
/** Macro dynamics as a gain curve. Each step ramps over 60 ms and completes just before its cue. */
function macroCurve(n) {
  const g = new Float32Array(n), steps = MACRO.map(([id, c, db]) => [cue(id, c), S.dB(db)]).sort((a, b) => a[0] - b[0]);
  const rampN = Math.round(0.06 * SR);
  let k = 0, cur = steps[0][1], from = cur, i0 = -rampN;
  for (let i = 0; i < n; i++) {
    while (k < steps.length && i >= Math.round(steps[k][0] * SR) - rampN - 48) { from = cur; cur = steps[k][1]; i0 = i; k++; }
    g[i] = from + (cur - from) * Math.min(1, (i - i0) / rampN);
  }
  return g;
}

function mixdown() {
  const n = T.kick.n;
  const duck = S.duckCurve(n, KICKS, { release: 0.19, shape: 1.6 });
  const hush = gapCurve(n);
  const L = new Float32Array(n), R = new Float32Array(n);
  const SENDS = ['hall', 'plate', 'delay', 'cath'];
  const sends = Object.fromEntries(SENDS.map(k => [k, [new Float32Array(n), new Float32Array(n)]]));
  for (const [name, cfg] of Object.entries(TRACKS)) {
    const tr = T[name], w = WIDTH[name] ?? 1, dk = cfg.duck || 0, active = SENDS.filter(k => cfg[k]);
    for (let i = 0; i < n; i++) {
      const g = (1 - dk * (1 - duck[i])) * (cfg.through ? 1 : hush[i]);
      // Mid/side: widen the musical layers; bass and drums stay centred.
      const m = (tr.L[i] + tr.R[i]) * 0.5, sd = (tr.L[i] - tr.R[i]) * 0.5 * w;
      const l = (m + sd) * g, r = (m - sd) * g;
      L[i] += l; R[i] += r;
      for (let k = 0; k < active.length; k++) { const sd2 = sends[active[k]], a = cfg[active[k]]; sd2[0][i] += l * a; sd2[1][i] += r * a; }
    }
  }
  // The silences are cut before the effects, so the room keeps ringing through them.
  const hall = fxReturn(...sends.hall, (a, b) => S.reverb(a, b, { rt60: 3.4, size: 1.2, damp: 5000, preDelay: 0.03 }));
  const plate = fxReturn(...sends.plate, (a, b) => S.reverb(a, b, { rt60: 1.2, size: 0.5, damp: 8000, preDelay: 0.008, lowCut: 300 }));
  const cath = fxReturn(...sends.cath, (a, b) => S.reverb(a, b, { rt60: 5.5, size: 1.6, damp: 4200, preDelay: 0.045, lowCut: 180 }));
  const dly = fxReturn(...sends.delay, (a, b) => S.pingPong(a, b, { time: 0.75 * B, feedback: 0.36 }));
  const macro = macroCurve(n);
  for (let i = 0; i < n; i++) {
    const hd = 1 - 0.3 * (1 - duck[i]); // the rooms breathe with the kick too
    L[i] = (L[i] + (hall.L[i] * 0.55 + cath.L[i] * 0.5) * hd + plate.L[i] * 0.5 + dly.L[i] * 0.5) * macro[i];
    R[i] = (R[i] + (hall.R[i] * 0.55 + cath.R[i] * 0.5) * hd + plate.R[i] * 0.5 + dly.R[i] * 0.5) * macro[i];
  }
  // Frontier → memory: the whole mix slows to a halt over the last beat, then the rewind begins.
  S.tapeStop(L, R, cue('frontier', 'stop'), sc('memory').start);
  return { L, R };
}

const TARGET_LUFS = -14;
function master({ L, R }) {
  S.biquad(L, 'hp', 28, 0.7); S.biquad(R, 'hp', 28, 0.7);
  S.biquad(L, 'highshelf', 7000, 0.7, 2.5); S.biquad(R, 'highshelf', 7000, 0.7, 2.5); // air
  S.compress(L, R, { threshold: -20, ratio: 1.6, attack: 0.02, release: 0.2 });
  // Normalize to the target loudness through the limiter (two passes converge within 0.2 LU).
  let gain = 1, out, lu, gr;
  for (let pass = 0; pass < 4; pass++) {
    out = { L: L.map(v => v * gain), R: R.map(v => v * gain) };
    gr = S.limiter(out.L, out.R, { ceiling: S.dB(-1.5), release: 0.09 });
    lu = S.loudness(out.L, out.R).integrated;
    if (Math.abs(lu - TARGET_LUFS) < 0.2) break;
    gain *= S.dB(TARGET_LUFS - lu);
  }
  // How much of the film sits more than 3 dB into the limiter (for --report).
  let hot = 0;
  for (let i = 0; i < L.length; i++) if (Math.max(Math.abs(L[i]), Math.abs(R[i])) * gain > S.dB(-1.5 + 3)) hot++;
  // Fade with the picture (it reaches black at the last frame).
  const f0 = Math.round((DUR - 2) * SR), n = out.L.length;
  for (let i = f0; i < n; i++) { const u = (i - f0) / (n - f0), g = 0.5 + 0.5 * Math.cos(Math.PI * u); out.L[i] *= g; out.R[i] *= g; }
  return { ...out, lufs: lu, gainDb: 20 * Math.log10(gain), limiterDb: gr, hot: hot / L.length };
}

// =============================================================================
//  RENDER
// =============================================================================
const t0 = Date.now();
const SCORE = [scoreOpen, scoreFounding, scoreConstitution, scoreExpansion, scoreInfra, scoreIndustry, scoreFlight, scoreAbundance,
  scoreArsenal, scoreProsperity, scoreCosmos, scoreSilicon, scoreInnovation, scoreFrontier, scoreMemory, scoreFinal];
groove();
SCORE.forEach(fn => fn());
console.log(`composed in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

const outDir = join(here, 'out');
mkdirSync(outDir, { recursive: true });
if (flag('stems')) {
  mkdirSync(join(outDir, 'stems'), { recursive: true });
  Object.values(T).forEach(tr => S.writeWav(join(outDir, 'stems', `${tr.name}.wav`), tr.L, tr.R, 24));
}
const mix = master(mixdown());
const wav = join(outDir, 'liberty-score.wav');
S.writeWav(wav, mix.L, mix.R, 24);
console.log(`wrote ${wav}  (${DUR.toFixed(1)} s, ${mix.lufs.toFixed(1)} LUFS integrated, limiter ${mix.limiterDb.toFixed(1)} dB peak reduction)`);

// Browser preview copy (the player in index.html plays this in sync with the picture).
const audioDir = join(here, 'audio');
mkdirSync(audioDir, { recursive: true });
const mp3 = join(audioDir, 'liberty-score.mp3');
const ff = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '192k', mp3], { stdio: 'inherit' });
console.log(ff.status === 0 ? `wrote ${mp3}` : 'ffmpeg not found: skipped the MP3 preview copy');

if (flag('report')) {
  const { short } = S.loudness(mix.L, mix.R);
  console.log('\nscene          start   mean short-term LUFS');
  TL.SCENES.forEach(sc2 => {
    const v = short.filter(p => p.t >= sc2.start && p.t < sc2.start + sc2.dur).map(p => p.lufs);
    const m = v.length ? 10 * Math.log10(v.reduce((a, b) => a + Math.pow(10, b / 10), 0) / v.length) : NaN;
    console.log(`${sc2.id.padEnd(14)} ${sc2.start.toFixed(1).padStart(6)}   ${m.toFixed(1)}`);
  });
  console.log(`\nlimiter: ${(100 * mix.hot).toFixed(2)} % of samples more than 3 dB over the ceiling before limiting`);
  console.log('sync hits:', TL.HITS.map(h => `${h.id}.${h.cue} @ ${h.t.toFixed(2)} s`).join(' · '));
}
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
