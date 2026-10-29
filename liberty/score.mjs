#!/usr/bin/env node
/* =============================================================================
 *  LIBERTY — "Conceived in Liberty", the original score
 *
 *  A 2:15 progressive electronic track, composed and synthesized entirely in
 *  code (synth.mjs) and scored to the film's master timeline (timeline.js):
 *  120 BPM, 4/4, D major. It reads the same scene lengths and sync cues the
 *  picture draws to, so every cut lands on a downbeat and every hit lands
 *  under its headline.
 *
 *    node score.mjs             → out/liberty-score.wav (48 kHz / 24-bit)
 *                                 and audio/liberty-score.mp3 (browser preview)
 *    node score.mjs --stems     → also out/stems/<track>.wav
 *    node score.mjs --report    → loudness per scene and the sync hit list
 *
 *  The motif is D–E–A–D′ (1–2–5–8) in a dotted rhythm. The bell and horn
 *  state it under the title. Every drop "reaches" with it (D–E–F♯, D–E–G,
 *  D–E–A, E–F♯–A) without resolving, and it lands on D′ only on the final
 *  card, ONWARD.
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

// =============================================================================
//  HARMONY — one chord per bar (or per beat at the hits), voice-led around D4
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
  Fs:    { root: 30, pad: [61, 66, 70, 73] }, // F♯ major: the dominant of B minor
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
  innovation:   [['Bm', 4], ['G', 4], ['D', 4], ['G', 4], ['A', 4]],
  frontier:     [['Bm', 4], ['G', 4], ['D', 4], ['A', 4]],
  memory:       [['Bm', 4], ['G', 4], ['Em', 4], ['G', 4], ['Em7', 4]],
  final:        [['Asus', 4], ['D', 10]],
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

// =============================================================================
//  TRACKS & MIX — [gain, sidechain depth, hall send, plate send, delay send]
// =============================================================================
const TRACKS = {
  kick:  [1.0, 0.0, 0.0, 0.0, 0.0],
  drums: [1.0, 0.1, 0.04, 0.16, 0.0],
  perc:  [1.0, 0.25, 0.12, 0.08, 0.12],
  sub:   [1.0, 0.9, 0.0, 0.0, 0.0],
  bass:  [1.0, 0.85, 0.0, 0.0, 0.0],
  pad:   [1.0, 0.7, 0.22, 0.0, 0.0],
  choir: [1.0, 0.35, 0.55, 0.0, 0.0],
  organ: [1.0, 0.3, 0.35, 0.0, 0.0],
  arp:   [1.0, 0.55, 0.15, 0.0, 0.22],
  lead:  [1.0, 0.35, 0.2, 0.0, 0.16],
  brass: [1.0, 0.35, 0.22, 0.05, 0.0],
  bell:  [1.0, 0.2, 0.55, 0.0, 0.18],
  fx:    [1.0, 0.15, 0.3, 0.0, 0.0],
  hits:  [1.0, 0.0, 0.3, 0.0, 0.0],
};
const T = {};
Object.keys(TRACKS).forEach(k => { T[k] = new S.Track(DUR, k); });
const KICKS = []; // { t, depth } → sidechain
// Stereo width (side gain) per track; anything unlisted stays as rendered.
const WIDTH = { pad: 1.6, choir: 1.5, arp: 1.4, lead: 1.5, brass: 1.3, bell: 1.3 };
// Reverb and delay tails are cut dead here: the Earthrise vacuum and the tape stop.
const CHOKES = [cue('cosmos', 'earthrise'), sc('memory').start];

// Base levels (linear), balanced so the kick leads but chords, lead and arps sit
// within a few dB of it. The master normalizes loudness afterwards.
const LV = {
  kick: 0.62, clap: 0.5, snare: 0.36, hat: 0.13, ohat: 0.095, shaker: 0.05, crash: 0.12,
  sub: 0.155, bass: 0.2, pad: 0.115, arp: 0.12, lead: 0.17, brass: 0.08, choir: 0.07,
  organ: 0.035, bell: 0.09, impact: 0.45, riser: 0.07,
};
// Macro dynamics (dB) per scene: the song grows from the founding to the frontier.
const MACRO = {
  open: 0, founding: 0, constitution: -4, expansion: -3.2, infra: -2.6, industry: -2, flight: -1, abundance: -1.5,
  arsenal: -1.6, prosperity: -1.5, cosmos: 0, silicon: -1, innovation: 0, frontier: 1.2, memory: 0, final: 1,
};

// =============================================================================
//  PARTS — helpers that follow the harmony
// =============================================================================
/** For each chord overlapping [t0, t1): fn(start, end, chord). */
function eachChord(t0, t1, fn) {
  CHANGES.forEach(c => {
    const s = Math.max(c.t0, t0), e = Math.min(c.t1, t1);
    if (e - s > 0.05) fn(s, e, c);
  });
}
function pads(t0, t1, o = {}) {
  const { gain = LV.pad, a = 0.25, r = 0.5, track = T.pad, ...rest } = o;
  eachChord(t0, t1, (s, e, c) => S.supersaw(track, s, c.pad, e - s, { gain, a, d: 1, s: 1, r, cutoff: 2000, spread: 1, ...rest }));
}
function choirs(t0, t1, o = {}) {
  eachChord(t0, t1, (s, e, c) => S.choir(T.choir, s, c.pad.slice(0, 3), e - s, { gain: LV.choir, a: 0.35, r: 0.6, ...o }));
}
function subs(t0, t1, o = {}) {
  eachChord(t0, t1, (s, e, c) => S.sub(T.sub, s, c.root, e - s - 0.01, { gain: LV.sub, ...o }));
}
/** Mid bass, an octave above the sub, repeating `pattern` every `every` beats. */
function bassline(t0, t1, pattern, o = {}, every = 1) {
  for (let k = 0; t0 + k * every * B < t1 - 1e-6; k++) {
    const tb = t0 + k * every * B;
    pattern.forEach(([off, len]) => {
      const t = tb + off * B;
      if (t < t1 - 1e-6) S.bass(T.bass, t, chordAt(t).root + 12, len * B, { gain: LV.bass, ...o });
    });
  }
}
function arp(t0, t1, pattern, div, o = {}) {
  const { voice = 'pluck', gain = LV.arp, oct = 0, peakAt = null, ...rest } = o;
  const step = B / div;
  for (let k = 0; t0 + k * step < t1 - 1e-6; k++) {
    const t = t0 + k * step, m = tones(chordAt(t))[pattern[k % pattern.length]] + oct, pan = k % 2 ? 0.45 : -0.45;
    if (voice === 'mallet') S.mallet(T.arp, t, m, { gain, pan, ...rest });
    else S.pluck(T.arp, t, m, { gain, dur: step * 0.85, pan, ...rest, ...(peakAt ? { peak: peakAt(t) } : {}) });
  }
}
/** Lead voice: a supersaw doubled an octave below, or a bright square. */
function lead(t, m, dur, o = {}) {
  const { gain = LV.lead, voice = 'saw' } = o;
  if (voice === 'square') {
    S.pluck(T.lead, t, m, { gain: gain * 1.6, dur, wave: 'square', pw: 0.4, cutoff: 1400, peak: 4200, decay: 0.25, sustain: 0.65, r: 0.12, detune: 6 });
    return;
  }
  S.supersaw(T.lead, t, [m], dur, { gain, voices: 7, detune: 16, spread: 0.75, cutoff: 7000, res: 0.6, a: 0.008, d: 0.4, s: 0.8, r: 0.22, hpHz: 200 });
  S.supersaw(T.lead, t, [m - 12], dur, { gain: gain * 0.45, voices: 5, detune: 12, spread: 0.3, cutoff: 2800, res: 0.6, a: 0.008, d: 0.4, s: 0.8, r: 0.22, hpHz: 120 });
}
/** The motif cell over every bar in [t0, t1), reaching for HOOK[chord]. */
function hook(t0, t1, o = {}) {
  for (let tb = t0; tb < t1 - 1e-6; tb += 4 * B) {
    const notes = HOOK[chordAt(tb).name] || HOOK.D;
    CELL.forEach(([b, l], k) => {
      const t = tb + b * B;
      if (t < t1 - 1e-6) lead(t, notes[k], Math.min(l * B, t1 - t) * 0.95, o);
    });
  }
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
/** Backbeat on beats 2 and 4 (scenes all start on a bar line, so odd beats are the backbeat). */
function claps(t0, t1, k = 1) {
  for (let b = Math.ceil(t0 / B - 1e-6); b * B < t1 - 1e-6; b++) if (b % 2 === 1) S.clap(T.drums, b * B, { gain: LV.clap * k });
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
const brassChord = (t, dur, o = {}) => S.brass(T.brass, t, chordAt(t + 0.01).pad.map(m => m - 12), dur, { gain: LV.brass, ...o });

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
  arsenal: { gain: 0.72, f0: 190, f1: 50, decay: 0.19, click: 0.5, drive: 2.4 },
  prosperity: { gain: 0.6, decay: 0.22 },
  innovation: t => (t < cue('innovation', 'catch') ? { gain: 0.6, decay: 0.24 } : {}),
};
const DUCK = {
  founding: 0.15, constitution: 0.35, expansion: 0.5, infra: 0.5, industry: 0.55, abundance: 0.55, arsenal: 0.55,
  prosperity: 0.4, cosmos: 0.7, silicon: 0.6, innovation: 0.65, frontier: 0.75, memory: 0.15,
};
function groove() {
  TL.SCENES.forEach(s => s.kick.forEach(([b0, b1, style]) => {
    for (let b = b0; b < b1; b++) {
      if (style !== 'four' && b % 2) continue;
      const t = s.start + b * B, st = KICK_STYLE[s.id];
      const o = { gain: LV.kick, ...(typeof st === 'function' ? st(t) : st || {}) };
      S.kick(T.kick, t, o);
      KICKS.push({ t, depth: DUCK[s.id] ?? 0.5 });
      if (style === 'heart') S.kick(T.kick, t + 0.17, { ...o, gain: o.gain * 0.55 }); // lub-dub
    }
  }));
}

// =============================================================================
//  0 · PROLOGUE — organ pedal, the motif on bell and horn, the title impact
// =============================================================================
function scoreOpen() {
  const s = sc('open'), t0 = s.start, end = t0 + s.dur, q = c => cue('open', c);
  S.organ(T.organ, t0, [38, 45, 50], s.dur - 0.3, { gain: LV.organ * 1.1, a: 3.2, r: 1.2, trem: 0.08 });
  pads(t0, end, { gain: LV.pad * 0.8, a: 1.6, r: 0.8, cutoff: auto([[t0, 380], [q('motif'), 650], [q('title'), 650], [q('title') + 0.6, 3200], [end, 2400]]) });
  S.shimmer(T.pad, t0 + 0.5, [81, 86, 90], q('title') - t0, { gain: 0.012, a: 2.5, r: 2 });
  // The motif: D (dotted quarter), E (eighth), A on the flame, D′ under the title.
  [[q('motif'), 74, 0.75], [q('motif') + 0.75, 76, 0.25], [q('flame'), 81, 1.0], [q('title'), 86, 3.6]].forEach(([t, m, d]) => {
    S.bell(T.bell, t, m, { gain: LV.bell, dur: Math.max(2.5, d + 2) });
    S.brass(T.brass, t, [m - 12], d, { gain: LV.brass * 0.8, cutLow: 250, cutHigh: 1500, swell: 0.15, a: 0.06, r: 0.5, voices: 3, detune: 7 });
  });
  // The flame catches: a soft whoosh and a low bloom.
  S.whoosh(T.fx, q('flame') + 0.12, { gain: 0.07, len: 0.6, f0: 300, f1: 3000 });
  S.impact(T.hits, q('flame'), { gain: LV.impact * 0.25, size: 0.6, bright: 0.15 });
  // LIBERTY: reverse swell, impact, crash, a warm floor of sub and choir.
  S.reverseCrash(T.drums, q('title'), { gain: 0.09, len: 2.0 });
  S.impact(T.hits, q('title'), { gain: LV.impact * 0.8, size: 1.3, bright: 0.5 });
  S.crash(T.drums, q('title'), { gain: LV.crash, decay: 1.6 });
  S.sub(T.sub, q('title'), 38, end - q('title') - 2.2, { gain: LV.sub * 0.7, a: 0.05, r: 0.8 });
  S.choir(T.choir, q('title'), [62, 66, 69, 74], 3.2, { gain: LV.choir * 0.7, a: 0.4, r: 1.5 });
  // A quiet arpeggio previews the founding; a soft riser hands over.
  arp(q('subtitle'), end, ARP8, 2, { gain: LV.arp * 0.6, cutoff: 300, peak: 1500, decay: 0.1 });
  S.riser(T.fx, q('legend'), end, { gain: LV.riser * 0.6, f0: 300, f1: 5000, tone: 0.3 });
  S.reverseCrash(T.drums, end, { gain: 0.06, len: 1.2 });
}

// =============================================================================
//  I · FOUNDING — heartbeat, quill shaker, plucked arpeggio, taiko on the truths
// =============================================================================
function scoreFounding() {
  const s = sc('founding'), t0 = s.start, end = t0 + s.dur, q = c => cue('founding', c);
  pads(t0, end, { gain: LV.pad * 0.85, cutoff: 1300, a: 0.3 });
  subs(t0, end, { gain: LV.sub * 0.55 });
  arp(t0, end, ARP8, 2, { gain: LV.arp * 0.85, cutoff: 350, peak: 2600, decay: 0.12 });
  hats(t0, end, 4, { gain: LV.shaker, tone: 0.75, decay: 0.022 }); // the quill
  // WE HOLD · THESE TRUTHS — taiko, a soft crash and a brass chord on each
  [q('hold'), q('truths')].forEach((t, k) => {
    S.tom(T.drums, t, { gain: 0.42, f0: 105 + k * 12, f1: 52 + k * 6, decay: 0.45, slap: 0.35 });
    S.crash(T.drums, t, { gain: LV.crash * 0.45, decay: 1.2 });
    brassChord(t, 0.9, { gain: LV.brass * 0.9, a: 0.03, swell: 0.08, r: 0.4 });
  });
  // LIFE · LIBERTY · THE PURSUIT OF HAPPINESS — three rising chimes
  [[q('life'), 74], [q('liberty'), 79], [q('pursuit'), 83]].forEach(([t, m]) => S.bell(T.bell, t, m, { gain: LV.bell * 0.9, dur: 2.6 }));
  S.reverseCrash(T.drums, end, { gain: 0.07, len: 1.5 });
}

// =============================================================================
//  II · CONSTITUTION — the beat arrives, offbeat bass, brass on the headlines
// =============================================================================
function scoreConstitution() {
  const s = sc('constitution'), t0 = s.start, end = t0 + s.dur, q = c => cue('constitution', c);
  pads(t0, end, { gain: LV.pad, a: 0.2, cutoff: auto([[t0, 1400], [q('ambition'), 1800], [q('ambition') + 0.3, 3000]]) });
  subs(t0, end, { gain: LV.sub * 0.75 });
  bassline(t0, q('ambition'), OFFBEAT, { cutoff: 160, peak: 700 });
  bassline(q('ambition'), end, OFFBEAT, { cutoff: 220, peak: 1300 });
  arp(t0, q('ambition'), ARP8, 2, { cutoff: 350, peak: 3000 });
  arp(q('ambition'), end, ARP16, 4, { cutoff: 350, peak: 3400 });
  hats(q('limited'), end, 2, { gain: LV.hat * 0.7, offbeatOnly: true });
  claps(q('ambition'), end);
  // LIMITED GOVERNMENT. — a short stab
  brassChord(q('limited'), 0.45, { a: 0.02, swell: 0.06, r: 0.25 });
  S.crash(T.drums, q('limited'), { gain: LV.crash * 0.5 });
  // UNLIMITED AMBITION. — the filter opens, crash, a brass swell
  S.reverseCrash(T.drums, q('ambition'), { gain: 0.08, len: 1.0 });
  S.crash(T.drums, q('ambition'), { gain: LV.crash });
  S.impact(T.hits, q('ambition'), { gain: LV.impact * 0.35, size: 0.8, bright: 0.4 });
  S.brass(T.brass, q('ambition'), [50, 57, 62, 66, 69], 1.9, { gain: LV.brass * 1.1, a: 0.12, swell: 0.4, r: 0.6 });
  // Bill of Rights: ten amendments, ten sixteenths up the scale, panned with the numerals
  [74, 76, 78, 79, 81, 83, 85, 86, 88, 90].forEach((m, i) => S.pluck(T.arp, q('rights') + (i * B) / 4, m,
    { gain: LV.arp * 0.9, dur: 0.1, cutoff: 1200, peak: 6000, decay: 0.05, wave: 'square', pw: 0.3, pan: -0.1 + i * 0.1 }));
  snareFill(end - 1.5 * B, end, { gain: LV.snare * 0.7 });
}

// =============================================================================
//  III · EXPANSION — the frontier gallop
// =============================================================================
function scoreExpansion() {
  const s = sc('expansion'), t0 = s.start, end = t0 + s.dur, q = c => cue('expansion', c);
  pads(t0, end, { gain: LV.pad, cutoff: auto([[t0, 1800], [end, 3200]]) });
  subs(t0, end);
  bassline(t0, end, GALLOP, { cutoff: 220, peak: 1300 });
  arp(t0, end, ARP16, 4, { cutoff: 380, peak: 3600 });
  hats(t0, end, 4, { gain: LV.hat * 0.75 });
  openHats(q('continent'), end);
  claps(t0, end);
  // WE CROSSED A CONTINENT — open fifths in the brass, crash, timpani
  S.reverseCrash(T.drums, q('continent'), { gain: 0.07, len: 1.0 });
  S.crash(T.drums, q('continent'), { gain: LV.crash });
  S.brass(T.brass, q('continent'), [50, 57, 62, 69, 74], 2.2, { gain: LV.brass * 1.2, a: 0.08, swell: 0.3, r: 0.6 });
  S.tom(T.drums, q('continent'), { gain: 0.35, f0: 95, f1: 50, decay: 0.5 });
  snareFill(end - B, end, { gain: LV.snare * 0.6 });
  S.reverseCrash(T.drums, end, { gain: 0.06, len: 1.0 });
}

// =============================================================================
//  IV · INFRASTRUCTURE — machinery, three plates, a telegraph
// =============================================================================
function scoreInfra() {
  const s = sc('infra'), t0 = s.start, end = t0 + s.dur, q = c => cue('infra', c);
  pads(t0, end, { gain: LV.pad, cutoff: 2600 });
  subs(t0, end);
  bassline(t0, end, OFFBEAT, { cutoff: 240, peak: 1500 });
  arp(t0, end, ARP16, 4, { cutoff: 400, peak: 3800 });
  hats(t0, end, 4, { gain: LV.hat * 0.8 });
  openHats(t0, end);
  claps(t0, end);
  // Machinery: metal ticks on the "e" and "a" of every beat
  for (let t = t0; t < end - 1e-6; t += B) [0.25, 0.75].forEach((o, k) => S.tick(T.perc, t + o * B, { gain: 0.035, f: 3100 + k * 400, decay: 0.008, pan: k ? 0.35 : -0.35 }));
  // Three blueprint plates — left, centre, right — one per beat
  [-0.6, 0, 0.6].forEach((p, i) => {
    const t = q('plates') + i * B;
    S.anvil(T.perc, t, { gain: 0.06, f: 880 + i * 110, decay: 0.35, pan: p });
    S.tom(T.drums, t, { gain: 0.18, f0: 160, f1: 110, decay: 0.12, pan: p });
  });
  // WE BUILT THE ROADS
  S.crash(T.drums, q('roads'), { gain: LV.crash });
  brassChord(q('roads'), 1.2, { gain: LV.brass * 1.1, a: 0.03, swell: 0.1, r: 0.4 });
  S.tom(T.drums, q('roads'), { gain: 0.3, f0: 100, f1: 55, decay: 0.4 });
  // Telegraph, last bar: "··– ···" (U S)
  [[12, 0.05], [12.25, 0.05], [12.5, 0.2], [13.25, 0.05], [13.5, 0.05], [13.75, 0.05]]
    .forEach(([b, l]) => S.beep(T.perc, at('infra', b), { gain: 0.03, f: 1400, len: l, pan: 0.4 }));
}

// =============================================================================
//  V · INDUSTRY — rolling bass, then stop-time: STEEL. RAIL. LIGHT.
// =============================================================================
function scoreIndustry() {
  const s = sc('industry'), t0 = s.start, end = t0 + s.dur, q = c => cue('industry', c);
  const stop = q('steel'), go = q('light');
  pads(t0, stop, { gain: LV.pad, cutoff: 2800 });
  pads(go, end, { gain: LV.pad * 1.1, cutoff: 4200, a: 0.01 });
  subs(t0, stop); subs(go, end);
  bassline(t0, stop, ROLLING, { cutoff: 260, peak: 1700 });
  bassline(go, end, ROLLING, { cutoff: 300, peak: 2000 });
  arp(t0, stop, ARP16, 4, { cutoff: 420, peak: 4000 });
  arp(go, end, ARP16, 4, { cutoff: 450, peak: 4500 });
  hats(t0, stop, 4, { gain: LV.hat * 0.85 }); hats(go, end, 4, { gain: LV.hat * 0.9 });
  openHats(t0, stop); openHats(go, end);
  claps(t0, stop); claps(go, end);
  for (let i = 0; i < 4; i++) S.tick(T.perc, q('milestones') + i * B, { gain: 0.05, f: 2400, decay: 0.02, noise: 0.1 });
  S.reverseCrash(T.drums, stop, { gain: 0.09, len: 1.5 });
  // The three hits — anvil, kick, brass — walk IV, V, I.
  [[stop, 'G', 620], [q('rail'), 'A', 700], [go, 'D', 830]].forEach(([t, ch, f], k) => {
    const last = k === 2;
    S.anvil(T.perc, t, { gain: 0.12 + k * 0.03, f, decay: last ? 1.6 : 0.8 });
    S.kick(T.kick, t, { gain: LV.kick, decay: 0.22, click: 0.5 });
    KICKS.push({ t, depth: 0.5 });
    S.brass(T.brass, t, CHORDS[ch].pad.map(m => m - 12), last ? 1.6 : 0.42, { gain: LV.brass * 1.3, a: 0.015, swell: 0.05, r: last ? 0.6 : 0.2 });
    S.supersaw(T.pad, t, CHORDS[ch].pad, last ? 0.1 : 0.42, { gain: LV.pad * 1.4, cutoff: 5000, a: 0.005, d: 0.3, s: 0.6, r: 0.25 });
    S.impact(T.hits, t, { gain: LV.impact * (0.25 + k * 0.15), size: 0.7 + k * 0.2, bright: 0.5 });
  });
  S.crash(T.drums, go, { gain: LV.crash * 1.2 });
  // LIGHT: the lead enters with the motif
  [[0, 74, 1.5], [1.5, 76, 0.5], [2, 81, 2], [4, 78, 1], [5, 76, 1]].forEach(([b, m, l]) => lead(go + b * B, m, l * B * 0.95));
}

// =============================================================================
//  VI · FLIGHT — breakdown: drums out, choir, a filter rising to takeoff
// =============================================================================
function scoreFlight() {
  const s = sc('flight'), t0 = s.start, end = t0 + s.dur, q = c => cue('flight', c), up = q('takeoff');
  pads(t0, end, { gain: LV.pad * 1.1, a: 0.6, r: 0.8, cutoff: auto([[t0, 900], [up, 2600], [up + 0.4, 4200], [end, 4500]]) });
  S.choir(T.choir, t0 + 0.2, [62, 66, 71], up - t0 - 0.2, { gain: LV.choir, a: 1.2 });
  S.choir(T.choir, up, [62, 66, 69, 74], end - up, { gain: LV.choir * 1.2, a: 0.3, r: 1.2 });
  arp(t0, end, ARP16, 4, { gain: LV.arp * 0.8, cutoff: 250, peakAt: auto([[t0, 700], [up, 3200], [end, 4500]]) });
  S.riser(T.fx, t0 + 0.5, up, { gain: LV.riser, f0: 300, f1: 6000 });
  S.reverseCrash(T.drums, up, { gain: 0.08, len: 1.5 });
  // Takeoff: the lift
  S.impact(T.hits, up, { gain: LV.impact * 0.45, size: 1.4, bright: 0.25 });
  S.crash(T.drums, up, { gain: LV.crash * 0.9, decay: 1.8 });
  subs(up, end, { gain: LV.sub * 0.7 });
  [[0, 74, 1.5], [1.5, 76, 0.5], [2, 81, 2], [4, 78, 1], [5, 76, 1]].forEach(([b, m, l]) => lead(up + b * B, m, l * B * 0.95, { gain: LV.lead * 0.9 }));
  // Back into the groove
  snareRoll(at('flight', 12), end, { gain: LV.snare * 0.8 });
  S.riser(T.fx, at('flight', 12), end, { gain: LV.riser * 0.9, f0: 500, f1: 9000, tone: 0.6 });
  S.reverseCrash(T.drums, end, { gain: 0.08, len: 1.0 });
}

// =============================================================================
//  VII · ABUNDANCE — the groove returns: clockwork mallets, the hook on a square lead
// =============================================================================
function scoreAbundance() {
  const s = sc('abundance'), t0 = s.start, end = t0 + s.dur, q = c => cue('abundance', c);
  S.crash(T.drums, t0, { gain: LV.crash });
  S.impact(T.hits, t0, { gain: LV.impact * 0.35, size: 0.8 });
  pads(t0, end, { gain: LV.pad, cutoff: 3200 });
  subs(t0, end);
  bassline(t0, end, OFFBEAT, { cutoff: 260, peak: 1600 });
  arp(t0, end, CLOCK, 4, { voice: 'mallet', gain: LV.arp, decay: 0.22, oct: 12 });
  hats(t0, end, 4, { gain: LV.hat * 0.85 }); openHats(t0, end); claps(t0, end);
  // The line steps forward on each beat; a soft clack where it stops.
  for (let t = t0; t < end - 1e-6; t += B) S.tick(T.perc, t + 0.275, { gain: 0.03, f: 1800, decay: 0.01, noise: 0.5, pan: -0.2 });
  // ABUNDANCE.
  S.crash(T.drums, q('title'), { gain: LV.crash * 0.8 });
  brassChord(q('title'), 1.8, { a: 0.06, swell: 0.25, r: 0.5 });
  hook(t0, end, { voice: 'square', gain: LV.lead * 0.45 });
  snareFill(end - B, end, { gain: LV.snare * 0.6 });
}

// =============================================================================
//  VIII · ARSENAL — minor mode, war drums, driven bass, string tremolo
// =============================================================================
function scoreArsenal() {
  const s = sc('arsenal'), t0 = s.start, end = t0 + s.dur, q = c => cue('arsenal', c);
  // A hit on every cut
  [t0, q('shot2'), q('shot3')].forEach((t, k) => {
    S.impact(T.hits, t, { gain: LV.impact * (0.55 + 0.1 * k), size: 1, bright: 0.6 });
    S.crash(T.drums, t, { gain: LV.crash * 1.1 });
    S.tom(T.drums, t, { gain: 0.38, f0: 95, f1: 52, decay: 0.45, slap: 0.45 });
    brassChord(t, 0.7, { gain: LV.brass * 1.4, a: 0.01, swell: 0.05, r: 0.35, cutHigh: 3600 });
  });
  // Strings: sixteenth-note tremolo across two octaves
  eachChord(t0, end, (a, e, c) => S.supersaw(T.pad, a, c.pad.map(m => m - 12).concat(c.pad), e - a,
    { gain: LV.pad * 0.9, cutoff: 2600, a: 0.005, d: 1, s: 1, r: 0.2, voices: 5, detune: 14, gate: S.gate16(new Array(16).fill(1), a, B / 4) }));
  subs(t0, end, { drive: 1.8, gain: LV.sub * 0.75 });
  bassline(t0, end, ROLLING, { cutoff: 380, peak: 1400, drive: 3.2, mix: 0.5 });
  hats(t0, end, 4, { gain: LV.hat * 0.95 });
  for (let b = 1; b < 16; b += 2) S.snare(T.drums, at('arsenal', b), { gain: LV.snare * 0.85, tone: 175, noiseDecay: 0.16 });
  // War-drum pickups into every downbeat
  for (let bar = 0; bar < 4; bar++) [3.5, 3.75].forEach(o => S.tom(T.drums, at('arsenal', bar * 4 + o), { gain: 0.25, f0: 140, f1: 90, decay: 0.15 }));
  // The red counters roll: ticks on thirty-seconds while the numbers climb
  [[q('shot2'), 1.8], [q('shot3') + 0.6, 1.8]].forEach(([t, len]) => { for (let u = 0; u < len - 1e-6; u += B / 8) S.tick(T.perc, t + u, { gain: 0.025, f: 2800, decay: 0.006, noise: 0.6 }); });
  S.riser(T.fx, at('arsenal', 12), end, { gain: LV.riser, f0: 400, f1: 8000 });
  snareRoll(at('arsenal', 14), end, { gain: LV.snare * 0.7 });
}

// =============================================================================
//  IX · PROSPERITY — release into major: half time, brass chorale, choir, map pings
// =============================================================================
function scoreProsperity() {
  const s = sc('prosperity'), t0 = s.start, end = t0 + s.dur, q = c => cue('prosperity', c);
  S.crash(T.drums, t0, { gain: LV.crash * 0.9, decay: 1.8 });
  S.impact(T.hits, t0, { gain: LV.impact * 0.3, size: 1.2, bright: 0.3 });
  pads(t0, end, { gain: LV.pad * 1.1, cutoff: 3000, a: 0.15 });
  eachChord(t0, end, (a, e, c) => S.brass(T.brass, a, c.pad.map(m => m - 12), e - a - 0.05, { gain: LV.brass * 0.9, a: 0.25, swell: 0.6, settle: 0.8, r: 0.5 }));
  choirs(t0, end, { gain: LV.choir * 0.9 });
  subs(t0, end);
  bassline(t0, end, [[0, 1.85]], { cutoff: 300, peak: 900, decay: 0.3 }, 2);
  hats(t0, end, 2, { gain: LV.hat * 0.8 });
  claps(t0, end);
  // Interstate corridors: one ping per eighth note, rising and settling on the pentatonic
  [74, 78, 81, 83, 86, 83, 81, 78, 81, 83, 86, 88, 90].forEach((m, i) => S.bell(T.bell, q('routes') + (i * B) / 2, m, { gain: LV.bell * 0.55, dur: 1.6, index: 1.6 }));
  // PROSPERITY, AT SCALE.
  S.reverseCrash(T.drums, q('title'), { gain: 0.07, len: 1.0 });
  S.crash(T.drums, q('title'), { gain: LV.crash * 0.8 });
  S.bell(T.bell, q('title'), 86, { gain: LV.bell * 0.8, dur: 3 });
  S.downlifter(T.fx, at('prosperity', 14), { gain: 0.05, len: 1.2 }); // a hush before the countdown
}

// =============================================================================
//  X · COSMOS — countdown build, the liftoff drop, then the Earthrise vacuum
// =============================================================================
function scoreCosmos() {
  const s = sc('cosmos'), t0 = s.start, end = t0 + s.dur, q = c => cue('cosmos', c);
  const ign = q('ignition'), lift = q('liftoff'), rise = q('earthrise');
  // Build: organ crescendo IV → V, a beep on every beat, snare roll, riser, Shepard tones
  S.organ(T.organ, t0, [43, 50, 55, 59], 2 * B * 2 - 0.02, { gain: LV.organ * 1.2, a: 1.0, r: 0.15 });
  S.organ(T.organ, at('cosmos', 4), [45, 52, 57, 61], 4 * B, { gain: LV.organ * 1.6, a: 0.3, r: 0.1 });
  pads(t0, lift, { gain: LV.pad, a: 0.5, cutoff: auto([[t0, 500], [lift, 3500]]) });
  subs(t0, lift, { gain: LV.sub * 0.6 });
  for (let b = 0; b < 8; b++) S.beep(T.perc, at('cosmos', b), { gain: b === 7 ? 0.05 : 0.035, f: b === 7 ? 1320 : 990, len: 0.07 });
  snareRoll(t0, lift, { gain: LV.snare * 0.9 });
  S.riser(T.fx, t0, lift, { gain: LV.riser * 1.3, f0: 200, f1: 9000, tone: 0.7, n0: 38, n1: 74 });
  S.shepard(T.fx, t0, lift, { gain: 0.025, rate: 0.5 });
  S.rumble(T.fx, ign, rise, { gain: 0.11, attack: 0.5, release: 0.05 });
  S.reverseCrash(T.drums, lift, { gain: 0.1, len: 2 });
  // LIFTOFF — the drop
  S.impact(T.hits, lift, { gain: LV.impact, size: 1.6, bright: 0.8 });
  S.crash(T.drums, lift, { gain: LV.crash * 1.3, decay: 2 });
  pads(lift, rise, { gain: LV.pad * 1.25, cutoff: 8000, a: 0.005, gate: S.gate16(GATE, lift, B / 4) });
  pads(lift, rise, { gain: LV.pad * 0.5, cutoff: 2500 });
  subs(lift, rise);
  bassline(lift, rise, ROLLING, { cutoff: 320, peak: 2200 });
  arp(lift, rise, ARP16, 4, { cutoff: 500, peak: 5000 });
  hats(lift, rise, 4, { gain: LV.hat }); openHats(lift, rise); claps(lift, rise);
  hook(lift, rise);
  choirs(lift, rise, { gain: LV.choir });
  // EARTHRISE — everything stops. A Quindar tone, the choir, a distant bell.
  S.beep(T.perc, rise, { gain: 0.045, f: 2525, len: 0.25 });
  choirs(rise, end, { gain: LV.choir * 0.9, a: 1.0, r: 1.2 });
  pads(rise, end, { gain: LV.pad * 0.5, cutoff: 1200, a: 1.2, r: 1 });
  S.shimmer(T.pad, rise, [86, 93], end - rise, { gain: 0.01, a: 1.5 });
  [[q('left'), 86, 2], [q('left') + 0.75, 88, 2], [q('left') + 1.0, 93, 3]].forEach(([t, m, d]) => S.bell(T.bell, t, m, { gain: LV.bell * 0.6, dur: d + 1 }));
  subs(rise, end, { gain: LV.sub * 0.4, a: 0.8 });
  S.riser(T.fx, at('cosmos', 20), end, { gain: LV.riser * 0.6, f0: 400, f1: 7000, tone: 0.2 });
  S.reverseCrash(T.drums, end, { gain: 0.07, len: 1.5 });
}

// =============================================================================
//  XI · SILICON — a digital arpeggio whose filter opens along Moore's law
// =============================================================================
function scoreSilicon() {
  const s = sc('silicon'), t0 = s.start, end = t0 + s.dur, q = c => cue('silicon', c);
  // The on-screen transistor curve draws over seg(t, 1.0, 7.0) with in-out easing; the filter follows it.
  const moore = t => 350 * Math.pow(9000 / 350, inOut(clamp01((t - t0 - 1.0) / 6.0)));
  const pre = at('cosmos', 20);
  arp(pre, end, DIGI, 4, { wave: 'square', pw: 0.3, gain: LV.arp * 0.9, cutoff: 200, decay: 0.07,
    peakAt: t => (t < t0 ? 300 + (50 * (t - pre)) / (t0 - pre) : moore(t)) });
  pads(t0, end, { gain: LV.pad * 0.9, cutoff: auto([[t0, 900], [q('sand'), 2400], [end, 4200]]) });
  subs(t0, end);
  hats(t0, end, 4, { gain: LV.hat * 0.7 });
  // Data: seeded random glitches on the sixteenth grid
  const R = S.rng(1971);
  for (let k = 0; k < 64; k++) if (R() < 0.3) S.glitch(T.perc, t0 + (k * B) / 4, { gain: 0.03, f: [1175, 1480, 1760, 2349][Math.floor(R() * 4)], len: 0.04 + R() * 0.04, pan: R() * 1.6 - 0.8 });
  // WE TAUGHT SAND TO THINK — the beat drops in
  S.reverseCrash(T.drums, q('sand'), { gain: 0.09, len: 2 });
  S.impact(T.hits, q('sand'), { gain: LV.impact * 0.45, size: 1, bright: 0.6 });
  S.crash(T.drums, q('sand'), { gain: LV.crash });
  bassline(q('sand'), end, OFFBEAT, { cutoff: 280, peak: 1900 });
  claps(q('sand'), end); openHats(q('sand'), end);
  snareFill(end - B, end, { gain: LV.snare * 0.7 });
}

// =============================================================================
//  XII · ACCELERATED INNOVATION — half-time descent, the catch, the tools
// =============================================================================
function scoreInnovation() {
  const s = sc('innovation'), t0 = s.start, end = t0 + s.dur, q = c => cue('innovation', c), ct = q('catch');
  // Descent: half-time drums and a falling engine tone that decelerates with the booster
  pads(t0, ct, { gain: LV.pad * 0.9, cutoff: 1600 });
  subs(t0, ct, { gain: LV.sub * 0.7 });
  hats(t0, ct, 2, { gain: LV.hat * 0.7 });
  [2, 6].forEach(b => S.snare(T.drums, at('innovation', b), { gain: LV.snare, noiseDecay: 0.18 }));
  const fall = q('arms') - t0 - 0.25;
  S.sub(T.fx, t0 + 0.25, 45, fall, { gain: 0.05, glide: [93, fall], drive: 2.5, r: 0.1 });
  S.rumble(T.fx, t0 + 0.25, q('arms') - 0.25, { gain: 0.07, attack: 0.3, release: 0.15 });
  S.whoosh(T.fx, q('arms') + 0.25, { gain: 0.06, len: 0.5, f0: 800, f1: 6000 }); // the arms swing shut
  S.reverseCrash(T.drums, ct, { gain: 0.1, len: 2 });
  // THE CATCH
  S.impact(T.hits, ct, { gain: LV.impact * 0.95, size: 1.4, bright: 0.7 });
  S.anvil(T.perc, ct, { gain: 0.12, f: 310, decay: 1.2 }); // steel on steel
  S.crash(T.drums, ct, { gain: LV.crash * 1.2, decay: 1.8 });
  brassChord(ct, 1.0, { gain: LV.brass * 1.3, a: 0.01, swell: 0.05, r: 0.4 });
  pads(ct, end, { gain: LV.pad * 1.1, cutoff: 8000, a: 0.005, gate: S.gate16(GATE, ct, B / 4) });
  pads(ct, end, { gain: LV.pad * 0.5, cutoff: 2500 });
  subs(ct, end);
  bassline(ct, end, ROLLING, { cutoff: 320, peak: 2200 });
  arp(ct, end, ARP16, 4, { cutoff: 500, peak: 5200 });
  hats(ct, end, 4, { gain: LV.hat }); openHats(ct, end); claps(ct, end);
  hook(ct, q('tools'));
  // THE TOOLS OF ABUNDANCE: a whoosh across the crossfade and a rising stab per plate (D, G, B)
  S.whoosh(T.fx, q('tools'), { gain: 0.07, len: 0.7 });
  [74, 79, 83].forEach((m, i) => {
    const t = q('tools') + i * B;
    S.supersaw(T.lead, t, [m, m - 12], 0.35, { gain: LV.lead * 1.1, cutoff: 6000, a: 0.005, d: 0.2, s: 0.5, r: 0.2 });
    S.bell(T.bell, t, m + 12, { gain: LV.bell * 0.5, dur: 1.5 });
  });
  S.crash(T.drums, q('abundance'), { gain: LV.crash * 0.7 });
  // Bar 5 builds into the frontier
  hook(at('innovation', 16), end);
  snareRoll(at('innovation', 16), end, { gain: LV.snare * 0.75 });
  S.riser(T.fx, at('innovation', 16), end, { gain: LV.riser, f0: 400, f1: 9000 });
  S.reverseCrash(T.drums, end, { gain: 0.09, len: 1.5 });
}

// =============================================================================
//  XIII · FRONTIER — the peak: full anthem, the hook, an endless Shepard rise
// =============================================================================
function scoreFrontier() {
  const s = sc('frontier'), t0 = s.start, end = t0 + s.dur, q = c => cue('frontier', c), stop = q('stop');
  S.impact(T.hits, t0, { gain: LV.impact * 0.8, size: 1.3, bright: 0.7 });
  S.crash(T.drums, t0, { gain: LV.crash * 1.2, decay: 2 });
  pads(t0, end, { gain: LV.pad * 1.2, cutoff: 9000, a: 0.005, gate: S.gate16(GATE, t0, B / 4) });
  pads(t0, end, { gain: LV.pad * 0.55, cutoff: 3000 });
  choirs(t0, end, { gain: LV.choir * 1.1 });
  subs(t0, end);
  bassline(t0, stop, ROLLING, { cutoff: 340, peak: 2400 });
  arp(t0, end, ARP16, 4, { cutoff: 550, peak: 5600 });
  hats(t0, stop, 4, { gain: LV.hat * 1.05 }); openHats(t0, stop); claps(t0, stop);
  hook(t0, end, { gain: LV.lead * 1.15 });
  S.shepard(T.fx, t0, stop, { gain: 0.02, rate: 0.35, fadeIn: 2 });
  // Each statement lifts a step: a chime a tone higher and a soft crash.
  [['energy', 86], ['worlds', 88], ['minds', 90]].forEach(([c, m]) => {
    S.bell(T.bell, q(c), m, { gain: LV.bell * 0.8, dur: 2.5 });
    S.crash(T.drums, q(c), { gain: LV.crash * 0.55 });
  });
  // The tape stop over the last beat is applied to the whole mix in mixdown().
}

// =============================================================================
//  XIV · TWO HUNDRED FIFTY YEARS — the quiet rewind, then the build home
// =============================================================================
function scoreMemory() {
  const s = sc('memory'), t0 = s.start, end = t0 + s.dur, q = c => cue('memory', c);
  const each = s.at.each, yrs = q('years'), build = q('build');
  pads(t0, yrs, { gain: LV.pad * 0.6, cutoff: 900, a: 0.6 });
  subs(t0, yrs, { gain: LV.sub * 0.35, a: 0.5 });
  // The motif runs backwards, falling through time: D′ A E D A E — one note per symbol,
  // each preceded by its own reversed echo swelling into the cut.
  [86, 81, 76, 74, 69, 64].forEach((m, i) => {
    const t = t0 + i * each;
    S.bell(T.bell, t, m, { gain: LV.bell * 0.75, dur: 2.2 });
    if (i > 0) S.bell(T.bell, t - each, m, { gain: LV.bell * 0.45, dur: each, reverse: true });
    S.whoosh(T.fx, t, { gain: 0.03, len: 0.25, f0: 2000, f1: 8000 });
  });
  // Tick-tock on every beat
  for (let b = 0; b < 12; b++) S.tick(T.perc, at('memory', b), { gain: 0.03, f: b % 2 ? 1500 : 2000, decay: 0.01, noise: 0.4, pan: b % 2 ? 0.4 : -0.4 });
  // 250 YEARS — a warm swell on IV
  S.bell(T.bell, yrs - each, 74, { gain: LV.bell * 0.45, dur: each, reverse: true });
  S.impact(T.hits, yrs, { gain: LV.impact * 0.35, size: 1.6, bright: 0.1 });
  pads(yrs, end, { gain: LV.pad * 0.95, a: 0.4, cutoff: auto([[yrs, 1500], [build, 2200], [end, 5000]]) });
  choirs(yrs, end, { gain: LV.choir * 0.9, a: 0.5 });
  [74, 81].forEach(m => S.bell(T.bell, yrs, m, { gain: LV.bell * 0.7, dur: 3.5 }));
  subs(yrs, end, { gain: LV.sub * 0.6 });
  // The build home runs on through the cut into the final bar.
  const on = cue('final', 'onward');
  S.organ(T.organ, build, [40, 47, 52, 55], 4 * B, { gain: LV.organ * 1.3, a: 1.5, r: 0.2 });
  snareRoll(build, on, { gain: LV.snare });
  S.riser(T.fx, build, on, { gain: LV.riser * 1.3, f0: 200, f1: 10000, tone: 0.8, n0: 45, n1: 81 });
  S.shepard(T.fx, build, on, { gain: 0.03, rate: 0.5 });
}

// =============================================================================
//  FINAL — the motif completes on ONWARD; the chord rings into the open future
// =============================================================================
function scoreFinal() {
  const s = sc('final'), t0 = s.start, end = t0 + s.dur, q = c => cue('final', c), on = q('onward');
  // Bar 1: the motif climbs D–E–A over Asus4 (its own notes) while the build peaks
  pads(t0, on, { gain: LV.pad, cutoff: auto([[t0, 2500], [on, 6000]]) });
  S.organ(T.organ, t0, [33, 45, 50, 52, 57], on - t0, { gain: LV.organ * 1.5, a: 0.2, r: 0.1 });
  [[0, 74, 1.5], [1.5, 76, 0.5], [2, 81, 2]].forEach(([b, m, l]) => {
    lead(t0 + b * B, m, l * B * 0.97, { gain: LV.lead * 1.1 });
    S.brass(T.brass, t0 + b * B, [m - 12, m - 24], l * B, { gain: LV.brass * 1.1, a: 0.03, swell: 0.1, r: 0.15 });
  });
  S.reverseCrash(T.drums, on, { gain: 0.12, len: 2 });
  // ONWARD. — D′ at last, over everything
  S.impact(T.hits, on, { gain: LV.impact * 1.1, size: 2.0, bright: 0.8 });
  S.crash(T.drums, on, { gain: LV.crash * 1.4, decay: 2.4 });
  S.kick(T.kick, on, { gain: LV.kick, decay: 0.3 });
  KICKS.push({ t: on, depth: 0.6 });
  const ring = end - on;
  S.supersaw(T.pad, on, [50, 57, 62, 66, 69, 74, 78, 81], ring, { gain: LV.pad * 1.3, cutoff: auto([[on, 7000], [end, 1500]]), a: 0.005, d: 2.5, s: 0.5, r: 1.0 });
  lead(on, 86, 2.5, { gain: LV.lead * 1.2 });
  S.brass(T.brass, on, [50, 54, 57, 62], ring - 1, { gain: LV.brass * 1.2, a: 0.02, swell: 0.1, r: 1 });
  S.choir(T.choir, on, [62, 66, 69, 74], ring - 1.5, { gain: LV.choir * 1.2, a: 0.15, r: 1.5 });
  S.organ(T.organ, on, [26, 38, 45, 50, 54, 57], ring - 1, { gain: LV.organ * 1.5, a: 0.05, r: 1.5 });
  S.sub(T.sub, on, 38, ring - 1.5, { gain: LV.sub, r: 1.2 });
  S.sub(T.sub, on, 26, ring - 2, { gain: LV.sub * 0.6, r: 1 });
  // THE BEST IS STILL AHEAD — the motif again, twice as fast, an octave up; then a rise that never ends
  [[0, 86], [0.75, 88], [1, 93], [2, 98]].forEach(([b, m]) => S.bell(T.bell, q('ahead') + b * B, m, { gain: LV.bell * 0.55, dur: 2.5 }));
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

function mixdown() {
  const n = T.kick.n;
  const duck = S.duckCurve(n, KICKS, { release: 0.2, shape: 1.6 });
  const L = new Float32Array(n), R = new Float32Array(n);
  const sends = { hall: [new Float32Array(n), new Float32Array(n)], plate: [new Float32Array(n), new Float32Array(n)], delay: [new Float32Array(n), new Float32Array(n)] };
  for (const [name, [gain, dk, hall, plate, delay]] of Object.entries(TRACKS)) {
    const tr = T[name], w = WIDTH[name] ?? 1;
    for (let i = 0; i < n; i++) {
      const g = gain * (1 - dk * (1 - duck[i]));
      // Mid/side: widen the musical layers; bass and drums stay centred.
      const m = (tr.L[i] + tr.R[i]) * 0.5, sd = (tr.L[i] - tr.R[i]) * 0.5 * w;
      const l = (m + sd) * g, r = (m - sd) * g;
      L[i] += l; R[i] += r;
      if (hall) { sends.hall[0][i] += l * hall; sends.hall[1][i] += r * hall; }
      if (plate) { sends.plate[0][i] += l * plate; sends.plate[1][i] += r * plate; }
      if (delay) { sends.delay[0][i] += l * delay; sends.delay[1][i] += r * delay; }
    }
  }
  const hall = fxReturn(...sends.hall, (a, b) => S.reverb(a, b, { rt60: 3.4, size: 1.2, damp: 5000, preDelay: 0.03 }));
  const plate = fxReturn(...sends.plate, (a, b) => S.reverb(a, b, { rt60: 1.2, size: 0.5, damp: 8000, preDelay: 0.008, lowCut: 300 }));
  const dly = fxReturn(...sends.delay, (a, b) => S.pingPong(a, b, { time: 0.75 * B, feedback: 0.36 }));
  for (let i = 0; i < n; i++) {
    const hd = 1 - 0.3 * (1 - duck[i]); // the hall breathes with the kick too
    L[i] += hall.L[i] * 0.55 * hd + plate.L[i] * 0.5 + dly.L[i] * 0.5;
    R[i] += hall.R[i] * 0.55 * hd + plate.R[i] * 0.5 + dly.R[i] * 0.5;
  }
  // Macro dynamics: a gain per scene, ramped over 40 ms across each cut.
  const ramp = Math.round(0.04 * SR);
  TL.SCENES.forEach((s, k) => {
    const a = Math.round(s.start * SR), b = Math.min(n, Math.round((s.start + s.dur) * SR));
    const g = S.dB(MACRO[s.id] ?? 0), gp = k ? S.dB(MACRO[TL.SCENES[k - 1].id] ?? 0) : g;
    for (let i = a; i < b; i++) {
      const u = Math.min(1, (i - a) / ramp), gi = gp + (g - gp) * u;
      L[i] *= gi; R[i] *= gi;
    }
  });
  // Frontier → memory: the whole mix slows to a halt over the last beat, then the rewind begins.
  S.tapeStop(L, R, cue('frontier', 'stop'), sc('memory').start);
  return { L, R };
}

const TARGET_LUFS = -14;
function master({ L, R }) {
  S.biquad(L, 'hp', 28, 0.7); S.biquad(R, 'hp', 28, 0.7);
  S.biquad(L, 'highshelf', 7000, 0.7, 2.5); S.biquad(R, 'highshelf', 7000, 0.7, 2.5); // air
  S.compress(L, R, { threshold: -20, ratio: 1.8, attack: 0.015, release: 0.2 });
  // Normalize to the target loudness through the limiter (two passes converge within 0.2 LU).
  let gain = 1, out, lu, gr;
  for (let pass = 0; pass < 4; pass++) {
    out = { L: L.map(x => x * gain), R: R.map(x => x * gain) };
    gr = S.limiter(out.L, out.R, { ceiling: S.dB(-1.5), release: 0.09 });
    lu = S.loudness(out.L, out.R).integrated;
    if (Math.abs(lu - TARGET_LUFS) < 0.2) break;
    gain *= S.dB(TARGET_LUFS - lu);
  }
  // Fade with the picture (it reaches black at 135 s).
  const f0 = Math.round((DUR - 2) * SR), n = out.L.length;
  for (let i = f0; i < n; i++) { const u = (i - f0) / (n - f0), g = 0.5 + 0.5 * Math.cos(Math.PI * u); out.L[i] *= g; out.R[i] *= g; }
  return { ...out, lufs: lu, gainDb: 20 * Math.log10(gain), limiterDb: gr };
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
    const v = short.filter(x => x.t >= sc2.start && x.t < sc2.start + sc2.dur).map(x => x.lufs);
    const m = v.length ? 10 * Math.log10(v.reduce((a, b) => a + Math.pow(10, b / 10), 0) / v.length) : NaN;
    console.log(`${sc2.id.padEnd(14)} ${sc2.start.toFixed(1).padStart(6)}   ${m.toFixed(1)}`);
  });
  console.log('\nsync hits:', TL.HITS.map(h => `${h.id}.${h.cue} @ ${h.t.toFixed(2)} s`).join(' · '));
}
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
