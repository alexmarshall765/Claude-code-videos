/* =============================================================================
 *  LIBERTY — master timeline, shared by the picture and the score
 *
 *  One tempo grid drives everything: 120 BPM in 4/4, so a beat is 0.5 s and a
 *  bar is 2 s. Scenes are measured in bars. Sync cues are measured in beats
 *  from each scene's downbeat (0 = the cut). liberty.js draws to these cues
 *  and score.mjs composes to them, so changing a number here moves picture and
 *  music together.
 *
 *  `kick` lists the beat ranges where the groove plays, per scene:
 *    four  = four-on-the-floor   half = beats 1 and 3   heart = soft pulse on 1 and 3
 *  The score builds its drums from these ranges and the picture pulses the
 *  timeline marker on the same beats.
 *
 *  `HITS` are the strongest sync points. The score puts an impact under each
 *  one and the picture adds a brief bloom of light.
 *
 *  Loaded as a classic <script> in the browser (window.LIBERTY_TIMELINE) and
 *  with require() in Node (module.exports).
 * ========================================================================== */
(function (root) {
  'use strict';
  const BPM = 120;
  const BEAT = 60 / BPM;
  const BAR = 4 * BEAT;

  const SCENES = [
    // Seal and torch draw in; the motif plays D (4) E (5.5) A (6, flame) D' (8, title).
    { id: 'open', bars: 4, kick: [],
      cues: { motif: 4, flame: 6, title: 8, subtitle: 10, legend: 12 } },
    // life / liberty / pursuit: the three phrases of the final line, one per beat.
    { id: 'founding', bars: 4, kick: [[0, 16, 'heart']],
      cues: { hold: 4, truths: 6, quote: 7, life: 11, liberty: 12, pursuit: 13 } },
    // rights: Bill of Rights numerals tick in on sixteenths from this beat.
    { id: 'constitution', bars: 4, kick: [[0, 16, 'four']],
      cues: { limited: 4, ambition: 8, rights: 11 } },
    { id: 'expansion', bars: 4, kick: [[0, 16, 'four']],
      cues: { continent: 8 } },
    // plates: the three blueprint frames start on beats 0, 1 and 2.
    { id: 'infra', bars: 4, kick: [[0, 16, 'four']],
      cues: { plates: 0, roads: 8 } },
    // steel / rail are stop-time hits; the groove returns on light.
    { id: 'industry', bars: 4, kick: [[0, 8, 'four'], [10, 16, 'four']],
      cues: { milestones: 1, steel: 8, rail: 9, light: 10 } },
    { id: 'flight', bars: 4, kick: [],
      cues: { takeoff: 8, air: 9 } },
    { id: 'abundance', bars: 4, kick: [[0, 16, 'four']],
      cues: { title: 4 } },
    { id: 'arsenal', bars: 4, kick: [[0, 16, 'four']],
      cues: { title: 1, shot2: 4, shot3: 8 } },
    // routes: interstate corridors start every eighth note from this beat.
    { id: 'prosperity', bars: 4, kick: [[0, 16, 'half']],
      cues: { routes: 1, title: 8 } },
    // Countdown ticks every beat until liftoff; the drop lasts two bars, then Earthrise.
    { id: 'cosmos', bars: 6, kick: [[8, 16, 'four']],
      cues: { ignition: 7, liftoff: 8, earthrise: 16, left: 17 } },
    { id: 'silicon', bars: 4, kick: [[8, 16, 'four']],
      cues: { chip: 7, sand: 8 } },
    // The booster descends in half time; the catch drops the full groove.
    { id: 'innovation', bars: 5, kick: [[0, 8, 'half'], [8, 20, 'four']],
      cues: { arms: 7, catch: 8, tools: 12, abundance: 14 } },
    { id: 'frontier', bars: 4, kick: [[0, 15, 'four']],
      cues: { energy: 1, worlds: 6, minds: 11, stop: 15 } },
    // Montage: one symbol every `each` beats, then the 250 YEARS card.
    { id: 'memory', bars: 5, kick: [[0, 12, 'heart']],
      cues: { each: 2, years: 12, build: 16 } },
    { id: 'final', bars: 3.5, kick: [],
      cues: { onward: 4, ahead: 8 } },
  ];

  // [scene, cue, strength 0..1]
  const HITS = [
    ['open', 'title', 0.8],
    ['constitution', 'ambition', 0.45],
    ['industry', 'light', 0.7],
    ['flight', 'takeoff', 0.45],
    ['cosmos', 'liftoff', 1.0],
    ['innovation', 'catch', 0.9],
    ['memory', 'years', 0.5],
    ['final', 'onward', 1.0],
  ];

  let acc = 0;
  SCENES.forEach(s => {
    s.start = acc;
    s.dur = s.bars * BAR;
    acc += s.dur;
    // Cue times in seconds, local to the scene.
    s.at = {};
    Object.keys(s.cues).forEach(k => { s.at[k] = s.cues[k] * BEAT; });
  });
  const DURATION = acc;
  const byId = {};
  SCENES.forEach(s => { byId[s.id] = s; });

  /** Absolute time in seconds of a named cue. */
  const cueTime = (id, cue) => byId[id].start + byId[id].at[cue];

  const T = {
    BPM, BEAT, BAR, DURATION, SCENES, byId, cueTime,
    HITS: HITS.map(([id, cue, k]) => ({ id, cue, k, t: cueTime(id, cue) })),
  };
  root.LIBERTY_TIMELINE = T;
  if (typeof module === 'object' && module.exports) module.exports = T;
})(typeof globalThis !== 'undefined' ? globalThis : this);
