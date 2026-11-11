/* =============================================================================
 *  ODE — master timeline, compositor, finishing pass and preview player.
 *
 *  renderAt(t) is a pure function of time:
 *    1. the active shot (and, during a dissolve, the outgoing one) is drawn
 *       into a 1920×804 picture buffer;
 *    2. the finishing pass adds bloom, grade, vignette and film grain;
 *    3. the picture is letterboxed to 2.39:1 inside the 1920×1080 frame, with
 *       chapter captions in the picture and narration subtitles in the lower bar.
 *
 *  URL parameters
 *    ?render      headless mode (no UI, no audio, no animation loop)
 *    ?t=42.5      start the preview at a given time
 *    ?scale=0.5   canvas scale (0.5 = fast preview, 2 = 4K)
 *    ?nosubs      hide narration subtitles      ?nocaps   hide chapter captions
 *    ?nograin     disable film grain            ?nobloom  disable bloom
 * ========================================================================== */
(() => {
  'use strict';
  const O = window.ODE;
  const { W, H, clamp, lerp, seg, win, E, col, rng, hash, F } = O;
  const FULL_H = 1080, BAR = (FULL_H - H) / 2;
  const params = new URLSearchParams(location.search);
  const RENDER = params.has('render');
  const SCALE = Math.max(0.25, parseFloat(params.get('scale')) || 1);
  const SUBS = !params.has('nosubs'), CAPS = !params.has('nocaps');
  const GRAIN = !params.has('nograin'), BLOOM = !params.has('nobloom');
  const FPS = window.ODE_TIMING.fps;

  // ---------------------------------------------------------------------------
  // Timeline: timing.js (beats) -> absolute seconds
  // ---------------------------------------------------------------------------
  /** Per-shot options: x = dissolve-in seconds (0 = hard cut), flash = white flash on the cut,
   *  bloom / grain / vig = finishing strengths. */
  const SHOT_OPTS = {
    parthenon: { x: 0 }, agora: { x: 1.1, bloom: 0.28, grade: ['#7a3c10', 0.35, 'multiply'] }, aristotle: { x: 0.9, bloom: 0.3, grade: ['#8a5a1c', 0.3, 'multiply'] }, scroll: { x: 0.9 },
    forum: { x: 1.2, bloom: 0.28, grade: ['#8a4a18', 0.38, 'multiply'] }, aqueduct: { x: 1.0, bloom: 0.3, grade: ['#c98a3a', 0.3, 'multiply'] }, pantheon: { x: 1.0 },
    monk: { x: 1.2 }, masons: { x: 1.0, bloom: 0.3, grade: ['#8a5220', 0.3, 'multiply'] }, rose: { x: 1.0 },
    duomo: { x: 1.2 }, anatomy: { x: 1.0 }, press: { x: 0.9 },
    ships: { x: 0.8 }, galileo: { x: 1.0 }, newton: { x: 1.0 },
    quill: { x: 1.0 }, crowds: { x: 0.8 },
    vienna: { x: 1.4 }, scrawl: { x: 0.8 }, premiere: { x: 0.5, flash: 0.35 },
    steam: { x: 0, flash: 0.5 }, bulb: { x: 0.25 }, telegraph: { x: 0.3 }, flyer: { x: 0.3 },
    radio: { x: 0, flash: 0.25 }, penicillin: { x: 0, flash: 0.2 }, rocket: { x: 0, flash: 0.35 }, footprint: { x: 0, flash: 0.3 },
    computer: { x: 0, flash: 0.2 }, timeline: { x: 0.2 },
    fiber: { x: 0, flash: 0.6 }, webpage: { x: 0.2 }, phones: { x: 0.2 }, earthweb: { x: 0.35 },
    protein: { x: 1.4 }, doctor: { x: 1.0 }, child: { x: 1.0 }, horizon: { x: 1.0 },
    pullback: { x: 1.6 }, library: { x: 1.2 }, city: { x: 1.4 }, orbit: { x: 1.6 }, gold: { x: 1.5 },
  };
  const CHAPTERS = {
    greece: ['I', 'DAWN OF REASON', 'Athens · 5th century BC'],
    rome: ['II', 'ROME AND LAW', 'Rome · 2nd century AD'],
    faith: ['III', 'FAITH AND THE CATHEDRAL', 'Europe · 800 – 1250'],
    renaissance: ['IV', 'RENAISSANCE', 'Florence and Mainz · 15th century'],
    science: ['V', 'EXPLORATION AND SCIENCE', '1492 – 1687'],
    liberty: ['VI', 'LIBERTY AND GENIUS', 'Philadelphia · 1787'],
    beethoven: ['', '', 'Vienna · 1824'],
    industry: ['VII', 'INDUSTRY AND INVENTION', '1769 – 1903'],
    acceleration: ['VIII', 'ACCELERATION', 'The 20th century'],
    connected: ['IX', 'THE CONNECTED WORLD', '1988 –'],
    ai: ['X', 'THE NEXT FRONTIER', 'Now'],
  };
  const SHOTS = [], SECTIONS = [];
  let T = 0;
  for (const s of window.ODE_TIMING.sections) {
    const beat = 60 / s.bpm, sec = { id: s.id, start: T, bpm: s.bpm, beat, chapter: CHAPTERS[s.id] || null };
    for (const [id, beats] of s.shots) {
      SHOTS.push({ id, section: s.id, start: T, dur: beats * beat, beats, beat, ...(SHOT_OPTS[id] || {}) });
      T += beats * beat;
    }
    sec.end = T; SECTIONS.push(sec);
  }
  SHOTS[SHOTS.length - 1].dur += window.ODE_TIMING.coda;
  SECTIONS[SECTIONS.length - 1].end += window.ODE_TIMING.coda;
  const DURATION = T + window.ODE_TIMING.coda;
  const shotAt = t => { let i = 0; while (i < SHOTS.length - 1 && t >= SHOTS[i + 1].start) i++; return i; };
  const sectionStart = id => SECTIONS.find(s => s.id === id).start;
  const shotStart = id => SHOTS.find(s => s.id === id).start;

  // ---------------------------------------------------------------------------
  // Narration cues (also read by audio/narrate.py via cues.json — see README).
  // `at` is [anchor shot, offset seconds]; `hold` is how long the subtitle stays up.
  // ---------------------------------------------------------------------------
  const NARRATION = [
    { id: 'n1', at: ['parthenon', 2.4], hold: 3.0, text: 'It began with a question.' },
    { id: 'n2', at: ['agora', 1.3], hold: 2.3, text: 'What is true?' },
    { id: 'n3', at: ['aristotle', 0.9], hold: 2.2, text: 'What is good?' },
    { id: 'n4', at: ['forum', 0.9], hold: 2.3, text: 'What is just?' },
    { id: 'n5', at: ['duomo', 2.6], hold: 5.1, text: 'From those questions came reason, law, art, and science.' },
    { id: 'n6', at: ['scrawl', 0.5], hold: 3.8, text: 'A deaf man wrote a symphony of joy.' },
    { id: 'n7', at: ['radio', 0.3], hold: 5.5, text: 'Ideas once carried by ship now cross the world in an instant,' },
    { id: 'n8', at: ['computer', 1.2], hold: 4.5, text: 'and progress that took centuries now takes years.' },
    { id: 'n9', at: ['protein', 2.2], hold: 4.6, text: 'Now we’re building minds to think alongside our own.' },
    { id: 'n10', at: ['pullback', 2.2], hold: 2.9, text: 'The story isn’t finished.' },
    { id: 'n11', at: ['library', 1.4], hold: 3.0, text: 'It’s yours to continue.' },
  ].map(n => ({ ...n, start: shotStart(n.at[0]) + n.at[1] }));

  // ---------------------------------------------------------------------------
  // Canvases
  // ---------------------------------------------------------------------------
  const canvas = document.getElementById('c');
  canvas.width = Math.round(W * SCALE); canvas.height = Math.round(FULL_H * SCALE);
  const main = canvas.getContext('2d');
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.round(w); c.height = Math.round(h); return c; };
  const bufA = mk(W * SCALE, H * SCALE), bufB = mk(W * SCALE, H * SCALE), bloomC = mk(W * SCALE / 4, H * SCALE / 4);
  const ctxA = bufA.getContext('2d'), ctxB = bufB.getContext('2d'), bctx = bloomC.getContext('2d');

  // Film grain: a few tiles of monochrome noise, offset differently every frame.
  const grainTiles = [];
  for (let k = 0; k < 3; k++) {
    const g = mk(512, 512), gc = g.getContext('2d'), img = gc.createImageData(512, 512), R = rng(900 + k);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (R() + R() + R() - 1.5) * 150;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    gc.putImageData(img, 0, 0);
    grainTiles.push(g);
  }

  function drawShot(i, t, c) {
    const s = SHOTS[i], fn = O.shots[s.id];
    c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none'; c.shadowBlur = 0;
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    O.use(c, SCALE);
    c.save();
    c.beginPath(); c.rect(0, 0, W, H); c.clip();
    const lt = t - s.start;
    if (fn) fn(c, lt, s.dur, lt / s.dur, s);
    else { // placeholder card for shots not written yet
      c.fillStyle = '#111'; c.fillRect(0, 0, W, H);
      O.txt(s.id.toUpperCase(), W / 2, H / 2, { size: 60, font: F.display, color: '#665533' });
    }
    c.restore();
  }

  function renderAt(t) {
    t = clamp(t, 0, DURATION - 1e-6);
    const frame = Math.round(t * FPS);
    const i = shotAt(t), s = SHOTS[i], lt = t - s.start;

    // 1. picture
    drawShot(i, t, ctxA);
    if (s.x > 0 && lt < s.x && i > 0) {
      drawShot(i - 1, t, ctxB); // outgoing shot keeps running underneath
      const a = E.sine(clamp(lt / s.x));
      ctxB.setTransform(1, 0, 0, 1, 0, 0); ctxB.globalAlpha = a; ctxB.drawImage(bufA, 0, 0); ctxB.globalAlpha = 1;
      ctxA.setTransform(1, 0, 0, 1, 0, 0); ctxA.drawImage(bufB, 0, 0);
    }
    const pic = ctxA;
    pic.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    // flash on hard cuts
    if (s.flash && lt < s.flash) {
      pic.globalCompositeOperation = 'lighter';
      pic.fillStyle = `rgba(255,244,220,${0.75 * Math.pow(1 - lt / s.flash, 2)})`;
      pic.fillRect(0, 0, W, H);
      pic.globalCompositeOperation = 'source-over';
    }

    // 2. finishing
    const bloom = s.bloom ?? 0.42;
    if (BLOOM && bloom > 0) {
      bctx.setTransform(1, 0, 0, 1, 0, 0);
      bctx.filter = `contrast(1.7) brightness(0.78) blur(${Math.max(1, 5 * SCALE)}px)`;
      bctx.drawImage(bufA, 0, 0, bloomC.width, bloomC.height);
      bctx.filter = 'none';
      pic.save();
      pic.globalCompositeOperation = 'screen'; pic.globalAlpha = bloom;
      pic.imageSmoothingQuality = 'high';
      pic.drawImage(bloomC, 0, 0, W, H);
      pic.restore();
    }
    if (s.grade) { // per-shot colour wash: [hex, alpha, blend mode]
      pic.save(); pic.globalCompositeOperation = s.grade[2] || 'soft-light'; pic.fillStyle = col(s.grade[0], s.grade[1]); pic.fillRect(0, 0, W, H); pic.restore();
    }
    // vignette
    const vg = s.vig ?? 0.62;
    const g = pic.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, W * 0.66);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.6, `rgba(0,0,0,${vg * 0.35})`); g.addColorStop(1, `rgba(0,0,0,${vg})`);
    pic.fillStyle = g; pic.fillRect(0, 0, W, H);
    // grain
    if (GRAIN) {
      pic.save();
      pic.globalCompositeOperation = 'overlay'; pic.globalAlpha = s.grain ?? 0.085;
      const tile = grainTiles[frame % grainTiles.length];
      const ox = Math.floor(hash(frame, 1) * 512), oy = Math.floor(hash(frame, 2) * 512);
      const gs = 2; // grain size in picture pixels
      for (let y = -oy * gs; y < H; y += 512 * gs) for (let x = -ox * gs; x < W; x += 512 * gs) pic.drawImage(tile, x, y, 512 * gs, 512 * gs);
      pic.restore();
      // faint gate flicker
      pic.fillStyle = `rgba(0,0,0,${0.02 * hash(frame, 3)})`; pic.fillRect(0, 0, W, H);
    }

    // 3. frame: letterbox, captions, subtitles
    main.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    main.globalAlpha = 1; main.globalCompositeOperation = 'source-over';
    main.fillStyle = '#000'; main.fillRect(0, 0, W, FULL_H);
    main.filter = 'contrast(1.1) saturate(1.12)'; // a gentle print curve
    main.drawImage(bufA, 0, 0, bufA.width, bufA.height, 0, BAR, W, H);
    main.filter = 'none';
    O.use(main, SCALE);
    if (CAPS) captions(t);
    // global fade in / out
    const fade = Math.min(seg(t, 0, 1.6, E.sine), 1 - seg(t, DURATION - 2.2, DURATION - 0.2, E.sine));
    if (fade < 1) { main.fillStyle = `rgba(0,0,0,${1 - fade})`; main.fillRect(0, 0, W, FULL_H); }
    if (SUBS) subtitles(t);
  }

  function captions(t) {
    const sec = SECTIONS.find(s => t >= s.start && t < s.end);
    if (!sec || !sec.chapter) return;
    const lt = t - sec.start, len = Math.min(4.4, sec.end - sec.start - 0.4);
    const a = win(lt, 0.5, len, 0.7);
    if (a <= 0) return;
    const [num, title, sub] = sec.chapter;
    const x = 96, y = BAR + H - 92, slide = (1 - seg(lt, 0.5, 1.6, E.out)) * 14;
    main.save();
    main.shadowColor = 'rgba(0,0,0,0.7)'; main.shadowBlur = 14 * SCALE;
    if (title) {
      const wn = num ? O.txt(num, x + slide, y, { size: 21, font: F.display, weight: 600, align: 'left', color: '#f4dfae', a, track: 5 }) + 22 : 0;
      if (num) { main.shadowBlur = 0; main.fillStyle = col('#f4dfae', a * 0.7); main.fillRect(x + slide + wn - 6, y - 10, 1.5, 20); main.shadowBlur = 14 * SCALE; }
      O.txt(title, x + slide + wn + 12, y, { size: 21, font: F.display, weight: 500, align: 'left', color: '#fff6e0', a, track: 7 });
    }
    O.txt(sub, x + slide, y + (title ? 32 : 6), { size: 24, font: F.serif, italic: true, align: 'left', color: '#f1e3c4', a: a * 0.92, track: 0.5 });
    main.restore();
  }

  function subtitles(t) {
    for (const n of NARRATION) {
      const a = win(t, n.start - 0.15, n.start + n.hold, 0.35);
      if (a <= 0) continue;
      O.txt(n.text, W / 2, BAR + H + BAR / 2 + 2, { size: 31, font: F.serif, italic: true, color: '#e9dcc0', a: a * 0.95, track: 0.6 });
    }
  }

  // ---------------------------------------------------------------------------
  // Public API + preview player
  // ---------------------------------------------------------------------------
  const fonts = [
    `600 20px ${F.display}`, `500 20px ${F.serif}`, `italic 500 20px ${F.serif}`, `400 20px ${F.mono}`, `500 20px ${F.mono}`,
    `20px ${F.black}`, `20px ${F.script}`,
  ];
  const ready = Promise.all([...fonts.map(f => document.fonts.load(f)), document.fonts.load(`20px ${F.greek}`, 'ΑΒΓ')]).then(() => document.fonts.ready);
  Object.assign(O, { renderAt, DURATION, SHOTS, SECTIONS, NARRATION, FPS, ready, shotStart, sectionStart });

  if (RENDER) { document.body.classList.add('render'); return; }

  const $ = id => document.getElementById(id);
  const audio = $('audio'), scrub = $('scrub'), clock = $('clock'), jump = $('jump'), play = $('play');
  scrub.max = DURATION.toFixed(2);
  for (const s of SHOTS) {
    const o = document.createElement('option');
    o.value = s.start; o.textContent = `${fmt(s.start)}  ${s.section} / ${s.id}`;
    jump.appendChild(o);
  }
  function fmt(t) { return `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`; }
  let t = parseFloat(params.get('t')) || 0, playing = false, last = 0, hasAudio = false;
  audio.addEventListener('canplay', () => { hasAudio = true; });
  function setPlaying(p) {
    playing = p; play.textContent = p ? 'PAUSE' : 'PLAY';
    if (hasAudio) { if (p) { audio.currentTime = t; audio.play().catch(() => {}); } else audio.pause(); }
    last = performance.now();
  }
  function seek(v) { t = clamp(v, 0, DURATION); if (hasAudio) audio.currentTime = t; }
  function loop(now) {
    if (playing) {
      t = hasAudio && !audio.paused ? audio.currentTime : t + (now - last) / 1000;
      last = now;
      if (t >= DURATION) { t = DURATION; setPlaying(false); }
    }
    renderAt(Math.round(t * FPS) / FPS);
    scrub.value = t; clock.textContent = fmt(t);
    requestAnimationFrame(loop);
  }
  play.onclick = () => setPlaying(!playing);
  scrub.oninput = () => seek(parseFloat(scrub.value));
  jump.onchange = () => seek(parseFloat(jump.value));
  addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); setPlaying(!playing); }
    if (e.code === 'ArrowRight') seek(t + 5);
    if (e.code === 'ArrowLeft') seek(t - 5);
  });
  ready.then(() => { play.textContent = 'PLAY'; requestAnimationFrame(loop); });
})();
