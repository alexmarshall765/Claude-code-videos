// Boot: load the timeline, facts and fonts, build the film, then either expose the
// capture API (?render), draw one frame (?frame=N), or run the interactive preview.
//
// Flags: ?frame=N  ?preview  ?scale=2  ?debug  ?render  ?t=SECONDS  ?final=WORD

import { Film } from './engine.js';
import { Timeline } from './timeline.js';
import { Hud } from './hud.js';
import { sceneModules } from './scenes/index.js';
import { FONT, WEIGHT, W, H } from './theme.js';

const params = new URLSearchParams(location.search);
const SCALE = Math.max(1, Math.min(4, parseFloat(params.get('scale')) || 1));
const RENDER = params.has('render');
const DEBUG = params.has('debug');

// Each face is loaded with the glyphs the film uses beyond plain ASCII.
const FACES = [
  [`${WEIGHT.statement} 96px ${FONT.statement}`, 'AZ —·∞→≈'],
  [`${WEIGHT.title} 96px ${FONT.statement}`, 'AZ'],
  [`${WEIGHT.marker} 24px ${FONT.marker}`, 'AZ —·∞'],
  [`${WEIGHT.data} 24px ${FONT.data}`, 'AZ09 —·°∞→≈×'],
  [`${WEIGHT.dataBold} 24px ${FONT.data}`, 'AZ09 —·∞'],
];

async function boot() {
  const [tlJson, facts] = await Promise.all([
    fetch('../timeline.json').then(r => r.json()),
    fetch('../data/facts.json').then(r => r.json()),
  ]);
  await Promise.all(FACES.map(([f, s]) => document.fonts.load(f, s)));
  await document.fonts.ready;
  const timeline = new Timeline(tlJson);
  const film = new Film({
    el: document.getElementById('c'), timeline, modules: sceneModules(timeline), facts,
    scale: SCALE, debug: DEBUG, noTexture: params.has('notexture'),
  });
  film.hud = new Hud(film);
  // ?final=ACCELERATE. swaps the film's last word (OBS 22's white card).
  film.finalWord = params.get('final') ? params.get('final').trim().toUpperCase() : null;
  window.film = film;
  window.renderFrame = n => film.renderFrame(n);
  window.fontStatus = () => [...document.fonts].map(f => ({ family: f.family, weight: f.weight, status: f.status }));
  window.filmInfo = { duration: timeline.duration, frames: timeline.frames, fps: timeline.fps, width: W * SCALE, height: H * SCALE };
  /** Render frame n and POST its raw RGBA bytes to the capture server. */
  window.captureFrame = async (n, url) => {
    film.renderFrame(n);
    const g = film.ctx;
    const img = g.getImageData(0, 0, W * SCALE, H * SCALE);
    const res = await fetch(url, { method: 'POST', body: img.data.buffer, headers: { 'content-type': 'application/octet-stream' } });
    if (!res.ok) throw new Error(`capture server: ${res.status}`);
    return true;
  };
  window.framePNG = n => { film.renderFrame(n); return film.el.toDataURL('image/png'); };
  return film;
}

const ready = boot();
window.ready = ready.then(() => true);

ready.then(film => {
  if (RENDER) { document.body.classList.add('render'); return; }
  if (params.has('frame')) {
    document.body.classList.add('still');
    film.renderFrame(parseInt(params.get('frame'), 10) || 0);
    return;
  }
  preview(film);
}).catch(e => {
  document.body.insertAdjacentHTML('beforeend', `<pre class="err">${e.stack || e}</pre>`);
  console.error(e);
});

function preview(film) {
  const tl = film.tl;
  const ui = {
    play: document.getElementById('play'), clock: document.getElementById('clock'),
    scrub: document.getElementById('scrub'), jump: document.getElementById('jump'), audio: document.getElementById('audio'),
  };
  ui.scrub.max = tl.duration;
  for (const sc of tl.scenes) {
    const o = document.createElement('option');
    o.value = sc.start;
    o.textContent = `${String(Math.floor(sc.start / 60))}:${String(Math.floor(sc.start % 60)).padStart(2, '0')}  OBS ${String(sc.obs).padStart(2, '0')} · ${sc.chapter || sc.act}`;
    ui.jump.appendChild(o);
  }
  // ?preview plays the score and derives the frame from the audio clock, so picture
  // and sound stay locked. Without a score file it falls back to the display clock.
  let haveAudio = false;
  ui.audio.src = '../audio/score.wav';
  ui.audio.addEventListener('canplay', () => { haveAudio = true; }, { once: true });
  ui.audio.addEventListener('error', () => { haveAudio = false; });
  let playing = false, t = parseFloat(params.get('t') || '0'), last = null;
  const seek = x => { t = Math.max(0, Math.min(tl.duration - 1 / tl.fps, x)); if (haveAudio) ui.audio.currentTime = t; };
  const setPlaying = on => {
    playing = on;
    ui.play.textContent = on ? 'PAUSE' : 'PLAY';
    if (haveAudio) { if (on) { ui.audio.currentTime = t; ui.audio.play(); } else ui.audio.pause(); }
  };
  ui.play.onclick = () => setPlaying(!playing);
  ui.scrub.oninput = () => seek(parseFloat(ui.scrub.value));
  ui.jump.onchange = () => seek(parseFloat(ui.jump.value));
  addEventListener('keydown', e => {
    if (e.code === 'Space') { setPlaying(!playing); e.preventDefault(); }
    if (e.code === 'ArrowRight') seek(t + (e.shiftKey ? 1 / tl.fps : 2));
    if (e.code === 'ArrowLeft') seek(t - (e.shiftKey ? 1 / tl.fps : 2));
  });
  // ?debug adds a metronome click on every beat.
  let actx = null, lastBeat = -1;
  const click = () => {
    if (!DEBUG || !playing) return;
    actx = actx || new AudioContext();
    const o = actx.createOscillator(), gn = actx.createGain();
    o.frequency.value = 1760; gn.gain.setValueAtTime(0.15, actx.currentTime); gn.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.04);
    o.connect(gn).connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.05);
  };
  if (params.has('preview')) setPlaying(true);
  const loop = now => {
    if (playing) {
      if (haveAudio && !ui.audio.paused) t = ui.audio.currentTime;
      else if (last != null) t = Math.min(tl.duration - 1 / tl.fps, t + (now - last) / 1000);
      if (t >= tl.duration - 1 / tl.fps) setPlaying(false);
    }
    last = now;
    const frame = Math.round(t * tl.fps);
    film.renderFrame(frame);
    const beat = Math.floor(t / tl.beat);
    if (beat !== lastBeat) { lastBeat = beat; click(); }
    ui.scrub.value = t;
    ui.clock.textContent = `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}  ${tl.label(t)}  f${frame}`;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
