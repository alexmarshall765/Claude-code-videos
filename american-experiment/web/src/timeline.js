// Resolves timeline.json: scene start bars, bar.beat addresses and cue hits.
// Plain module with no DOM access, so render/check.mjs can import it in Node.
// audio/synth.py implements the same rules; keep the two in step.

export const UNIT_BEATS = { '32nd': 0.125, '16th': 0.25, '8th': 0.5, beat: 1, half: 2, bar: 4 };

export class Timeline {
  constructor(json) {
    this.json = json;
    this.bpm = json.bpm;
    this.beatsPerBar = json.beatsPerBar;
    this.fps = json.fps;
    this.beat = 60 / json.bpm;
    this.bar = this.beat * json.beatsPerBar;
    this.acts = json.acts;
    let bar = 1;
    this.scenes = json.scenes.map((sc, index) => {
      const s = { ...sc, index, startBar: bar, start: (bar - 1) * this.bar, dur: sc.bars * this.bar };
      s.end = s.start + s.dur;
      bar += sc.bars;
      return s;
    });
    this.totalBars = bar - 1;
    this.duration = this.totalBars * this.bar;
    this.frames = Math.round(this.duration * this.fps);
    this.byId = Object.fromEntries(this.scenes.map(s => [s.id, s]));
    for (const s of this.scenes) {
      s.cueMap = {};
      for (const c of s.cues || []) {
        if (s.cueMap[c.name]) throw new Error(`${s.id}: duplicate cue ${c.name}`);
        s.cueMap[c.name] = { ...c, hits: this.expand(c, s) };
      }
      s.yearKeys = (s.years || []).map(k => ({ t: this.time(k.at, s), year: k.year }));
      s.eventKeys = (s.events || []).map(k => ({ t: this.time(k.at, s), year: k.year }));
      const co = s.hud && s.hud.coords;
      s.coordKeys = Array.isArray(co)
        ? co.map(k => ({ t: this.time(k.at, s), text: k.text, fact: k.fact }))
        : [{ t: s.start, text: co || '', fact: s.hud && s.hud.coordsFact }];
      s.marker = s.act === 'CODA' || !s.chapter ? this.acts[s.act] : `${this.acts[s.act]} — ${s.chapter}`;
    }
  }

  /** Global seconds of an address: "bar.beat[.16th]" local to `scene`, "other_scene@bar.beat", "end" or a number. */
  time(addr, scene) {
    if (typeof addr === 'number') return addr;
    if (addr === 'end') return scene.end;
    if (addr === 'start') return scene.start;
    let sc = scene, a = addr;
    const at = addr.indexOf('@');
    if (at >= 0) {
      sc = this.byId[addr.slice(0, at)];
      if (!sc) throw new Error(`unknown scene in address ${addr}`);
      a = addr.slice(at + 1);
    }
    const parts = a.split('.').map(Number);
    if (parts.some(Number.isNaN) || parts.length < 2) throw new Error(`bad address ${addr} in ${scene && scene.id}`);
    const [bar, beat, six = 1] = parts;
    return sc.start + (bar - 1) * this.bar + (beat - 1) * this.beat + (six - 1) * (this.beat / 4);
  }

  /** Every hit of a cue as {t0, t1} in global seconds. */
  expand(c, scene) {
    const starts = [];
    for (const a of Array.isArray(c.at) ? c.at : [c.at]) {
      const t = this.time(a, scene);
      if (c.every) {
        const step = UNIT_BEATS[c.every] * this.beat;
        if (!step) throw new Error(`${scene.id}/${c.name}: unknown unit ${c.every}`);
        for (let k = 0; k < c.count; k++) starts.push(t + k * step);
      } else starts.push(t);
    }
    return starts.map(t0 => ({ t0, t1: c.to ? this.time(c.to, scene) : t0 + (c.beats ?? 1) * this.beat }));
  }

  sceneIndexAt(T) {
    for (let i = this.scenes.length - 1; i >= 0; i--) if (T >= this.scenes[i].start) return i;
    return 0;
  }

  /** Musical position at global time T: 1-indexed bar and beat plus the phase inside the beat. */
  position(T) {
    const bar = Math.floor(T / this.bar) + 1;
    const inBar = T - (bar - 1) * this.bar;
    const beat = Math.floor(inBar / this.beat) + 1;
    return { bar, beat, beatPhase: (inBar - (beat - 1) * this.beat) / this.beat };
  }

  /** "bar.beat" label for a global time, for cue sheets and the debug overlay. */
  label(T) {
    const { bar, beat, beatPhase } = this.position(T + 1e-9);
    const six = Math.floor(beatPhase * 4) + 1;
    return six > 1 ? `${bar}.${beat}.${six}` : `${bar}.${beat}`;
  }
}
