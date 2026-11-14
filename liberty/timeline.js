/* =============================================================================
 *  LIBERTY — master timeline, shared by the picture and the score
 *
 *  One tempo grid drives everything: 134 BPM in 4/4, so a beat is about 0.448 s
 *  and a bar about 1.79 s. The film is 67 bars, which is exactly 2:00. Scenes
 *  are measured in bars. Sync cues are measured in beats from each scene's
 *  downbeat (0 = the cut, also available as the cue `cut`). liberty.js draws to
 *  these cues and score.mjs composes to them, so changing a number here moves
 *  picture and music together.
 *
 *  `kick` lists the beat ranges where the groove plays, per scene, as
 *  [from, to, pattern]. KICK_PATTERNS gives each pattern's hits within a bar.
 *  The score builds its drums from these ranges and the picture pulses the
 *  timeline marker on the same hits.
 *
 *  `HITS` are the strongest sync points. The score puts an impact under each
 *  one; the picture adds a bloom of light, a camera punch and, on the biggest,
 *  a shockwave ring.
 *
 *  Loaded as a classic <script> in the browser (window.LIBERTY_TIMELINE) and
 *  with require() in Node (module.exports).
 * ========================================================================== */
(function (root) {
  'use strict';
  const BPM = 134;
  const BEAT = 60 / BPM;
  const BAR = 4 * BEAT;

  // Beats within a bar on which each groove pattern hits.
  const KICK_PATTERNS = {
    four: [0, 1, 2, 3],   // four-on-the-floor
    half: [0, 2],         // half time
    heart: [0, 2],        // soft heartbeat
    epic: [0, 1.5, 3],    // 3-3-2 war drums
  };

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
    { id: 'arsenal', bars: 4, kick: [[0, 16, 'epic']],
      cues: { title: 1, shot2: 4, shot3: 8 } },
    // routes: interstate corridors start every eighth note from this beat.
    { id: 'prosperity', bars: 4, kick: [[0, 16, 'half']],
      cues: { routes: 1, title: 8 } },
    // The count runs one per beat. At ignition the music drops out and only the
    // engines are left; the drop lands on liftoff and lasts two bars, then Earthrise.
    { id: 'cosmos', bars: 6, kick: [[0, 7, 'four'], [8, 16, 'four']],
      cues: { ignition: 7, liftoff: 8, earthrise: 16, left: 17 } },
    { id: 'silicon', bars: 4, kick: [[8, 16, 'four']],
      cues: { chip: 7, sand: 8 } },
    // The booster descends in half time; the catch drops the full groove.
    { id: 'innovation', bars: 5, kick: [[0, 8, 'half'], [8, 20, 'four']],
      cues: { arms: 7, catch: 8, tools: 12, abundance: 14 } },
    // The music lifts a whole step here. `stop` starts the tape stop.
    { id: 'frontier', bars: 4, kick: [[0, 15, 'four']],
      cues: { energy: 1, worlds: 6, minds: 11, stop: 15 } },
    // Montage: the rewind accelerates. `marks` are the beats where each symbol cuts in.
    { id: 'memory', bars: 4, kick: [[0, 8, 'heart']],
      marks: [0, 2, 4, 5, 6, 7],
      cues: { years: 8, build: 12 } },
    { id: 'final', bars: 4, kick: [],
      cues: { onward: 4, ahead: 8 } },
  ];

  // [scene, cue, strength 0..1]
  const HITS = [
    ['open', 'title', 0.85],
    ['founding', 'hold', 0.3],
    ['founding', 'truths', 0.3],
    ['constitution', 'ambition', 0.5],
    ['expansion', 'continent', 0.45],
    ['infra', 'roads', 0.4],
    ['industry', 'light', 0.7],
    ['flight', 'takeoff', 0.5],
    ['abundance', 'cut', 0.45],
    ['arsenal', 'cut', 0.6],
    ['arsenal', 'shot2', 0.6],
    ['arsenal', 'shot3', 0.65],
    ['prosperity', 'cut', 0.4],
    ['cosmos', 'liftoff', 1.0],
    ['silicon', 'sand', 0.55],
    ['innovation', 'catch', 0.9],
    ['frontier', 'cut', 0.85],
    ['memory', 'years', 0.5],
    ['final', 'onward', 1.0],
  ];

  let bars = 0;
  SCENES.forEach(s => {
    s.start = bars * BAR;
    s.dur = s.bars * BAR;
    bars += s.bars;
    s.cues.cut = 0;
    // Cue times in seconds, local to the scene.
    s.at = {};
    Object.keys(s.cues).forEach(k => { s.at[k] = s.cues[k] * BEAT; });
    if (s.marks) s.marksAt = s.marks.map(b => b * BEAT);
  });
  const DURATION = Math.round(bars * BAR * 1e9) / 1e9;
  const byId = {};
  SCENES.forEach(s => { byId[s.id] = s; });

  /** Absolute time in seconds of a named cue. */
  const cueTime = (id, cue) => byId[id].start + byId[id].at[cue];

  /**
   * Beat (local to scene `s`) of the latest groove hit at or before local beat b,
   * with its pattern name; null when the groove is silent there.
   */
  function lastKick(s, b) {
    let best = null;
    for (const [b0, b1, style] of s.kick) {
      if (b < b0 || b >= b1) continue;
      const bar = Math.floor(b / 4) * 4;
      KICK_PATTERNS[style].forEach(off => {
        const hb = bar + off;
        if (hb <= b + 1e-9 && hb >= b0 && (!best || hb > best.beat)) best = { beat: hb, style };
      });
    }
    return best;
  }

  const T = {
    BPM, BEAT, BAR, BARS: bars, DURATION, SCENES, byId, cueTime, KICK_PATTERNS, lastKick,
    HITS: HITS.map(([id, cue, k]) => ({ id, cue, k, t: cueTime(id, cue) })),
  };
  root.LIBERTY_TIMELINE = T;
  if (typeof module === 'object' && module.exports) module.exports = T;
})(typeof globalThis !== 'undefined' ? globalThis : this);
