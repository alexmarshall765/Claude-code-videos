/* =============================================================================
 *  STILL BUILDING — film engine.
 *  Reads the master timeline, renders any frame on demand (renderAt), handles
 *  shot transitions and the type overlay, and runs the preview player.
 *
 *  A scene is a function SCENES[id](S). It draws one frame into S.g (2D canvas,
 *  1920×1080 logical space), may call GLX.plate() for shader plates, fills
 *  S.post with grade / light-shaft settings and draws type through the T helpers.
 *    S.t     local time in seconds        S.dur   shot length
 *    S.p     t / dur                      S.bar   seconds per bar here
 *    S.cam   {x, y, z} parallax camera    S.layer(depth, fn) draws fn under it
 *    S.ta    type opacity for this shot (0 in the montage)
 * ========================================================================== */
'use strict';
const FILM = (() => {
  const params = new URLSearchParams(location.search);
  const RENDER = params.has('render');
  const SC = parseFloat(params.get('scale')) || 1;
  const out = document.getElementById('c');
  GLX.init(out, SC);
  const mk = () => { const c = document.createElement('canvas'); c.width = Math.round(W * SC); c.height = Math.round(H * SC); return c; };
  const c2 = mk(), ct = mk();
  const g = c2.getContext('2d'), tx = ct.getContext('2d');

  // ---- timeline -------------------------------------------------------------
  const TL = window.TIMELINE, secs = {};
  let acc = 0;
  for (const [id, bpm, bars] of TL.sections) { const bar = 240 / bpm; secs[id] = { id, bpm, bar, bars, t0: acc }; acc += bars * bar; }
  const DURATION = acc;
  const shots = TL.shots.map(([id, sec, b0, len, o = {}]) => ({
    id, sec: secs[sec], t0: secs[sec].t0 + b0 * secs[sec].bar, dur: len * secs[sec].bar, o, scene: o.src || id, at: o.at || 0,
  }));
  const shotIndex = t => { let i = 0; while (i < shots.length - 1 && t >= shots[i + 1].t0) i++; return i; };

  // ---- one shot → graded frame ---------------------------------------------
  function drawShot(sh, local, dst, ta) {
    g.setTransform(SC, 0, 0, SC, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
    g.shadowBlur = 0; g.shadowColor = 'transparent'; g.lineCap = 'butt'; g.lineJoin = 'miter';
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const S = {
      t: local + sh.at, dur: sh.dur, p: clamp(local / sh.dur), g, tx, bar: sh.sec.bar, beat: sh.sec.bar / 4,
      post: {}, cam: { x: 0, y: 0, z: 1 }, shot: sh, montage: !!sh.o.src, ta: sh.o.src ? 0 : ta, SC,
      layer(depth, fn) {
        const c = S.cam, z = 1 + (c.z - 1) * depth;
        g.save();
        g.translate(W / 2, H / 2); g.scale(z, z); g.translate(-W / 2 - c.x * depth, -H / 2 - c.y * depth);
        fn(g); g.restore();
      },
    };
    const fn = SCENES[sh.scene];
    if (fn) fn(S); else placeholder(S);
    GLX.post(c2, S.post, GLX.full(dst), local);
    return S;
  }
  function placeholder(S) {
    g.fillStyle = '#10141c'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#556'; g.font = '600 80px Inter, sans-serif'; g.textAlign = 'center';
    g.fillText(S.shot.scene, W / 2, H / 2);
  }

  function renderAt(T) {
    T = clamp(T, 0, DURATION - 1e-4);
    const i = shotIndex(T), sh = shots[i], local = T - sh.t0;
    tx.setTransform(1, 0, 0, 1, 0, 0); tx.clearRect(0, 0, ct.width, ct.height); tx.setTransform(SC, 0, 0, SC, 0, 0);
    const o = { fade: 1, flash: 0, mix: 1 };
    const tr = sh.o.in, d = sh.o.d || 0.5;
    let B = null;
    if (tr === 'dissolve' && local < d && i > 0) {
      o.mix = smooth(0, d, local);
      const pv = shots[i - 1];
      drawShot(pv, pv.dur + local, 'B', 1 - o.mix);
      B = GLX.full('B');
    }
    if (tr === 'fade' && local < d) o.fade = smooth(0, d, local);
    if (tr === 'flash' && local < d) o.flash = Math.pow(1 - local / d, 2.2) * 0.85;
    // a fade-in shot is preceded by a short fade-out of whatever came before
    const nx = shots[i + 1];
    if (nx && nx.o.in === 'fade') o.fade *= 1 - smooth(nx.t0 - 0.7, nx.t0, T);
    o.fade *= 1 - smooth(DURATION - 2.6, DURATION - 0.3, T);
    drawShot(sh, local, 'A', B ? o.mix : 1);
    GLX.present(GLX.full('A'), B, ct, o, T);
  }

  // ---- fonts ----------------------------------------------------------------
  const FONTS = ['600 40px Cinzel', '500 40px "Cormorant Garamond"', 'italic 500 40px "Cormorant Garamond"', '40px "Pinyon Script"',
    '40px "IM Fell English SC"', '500 40px Inter', '40px UnifrakturMaguntia'];
  const ready = Promise.all(FONTS.map(f => document.fonts.load(f))).then(() => document.fonts.ready);

  // ---- preview player -------------------------------------------------------
  if (!RENDER) {
    const $ = id => document.getElementById(id);
    const scrub = $('scrub'), clock = $('clock'), play = $('play'), audio = $('audio');
    scrub.max = DURATION;
    let playing = false, t = parseFloat(params.get('t')) || 0, last = 0;
    const show = () => {
      renderAt(t); scrub.value = t;
      const sh = shots[shotIndex(t)];
      clock.textContent = `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}  ${sh.id}`;
    };
    const tick = now => {
      if (playing) {
        t = audio && !audio.paused ? audio.currentTime : t + (now - last) / 1000;
        if (t >= DURATION) { t = DURATION - 0.01; toggle(); }
        show();
      }
      last = now; requestAnimationFrame(tick);
    };
    const toggle = () => {
      playing = !playing; play.textContent = playing ? 'PAUSE' : 'PLAY';
      if (audio) { if (playing) { audio.currentTime = t; audio.play().catch(() => {}); } else audio.pause(); }
    };
    play.onclick = toggle;
    scrub.oninput = () => { t = parseFloat(scrub.value); if (audio) audio.currentTime = t; show(); };
    addEventListener('keydown', e => {
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
      if (e.code === 'ArrowRight') { t = Math.min(DURATION - 0.01, t + 5); if (audio) audio.currentTime = t; show(); }
      if (e.code === 'ArrowLeft') { t = Math.max(0, t - 5); if (audio) audio.currentTime = t; show(); }
    });
    ready.then(() => { show(); requestAnimationFrame(tick); });
  }
  return { renderAt, DURATION, shots, secs, ready, canvas: out };
})();
