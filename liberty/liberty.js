/* =============================================================================
 *  LIBERTY — The American Project
 *  A 2:15 cinematic short drawn entirely in code (HTML Canvas 2D).
 *
 *  Architecture
 *  ------------
 *  - Everything is a pure function of time:  renderAt(t) draws frame t (seconds).
 *    No state accumulates between frames, so preview scrubbing and offline
 *    frame-by-frame rendering produce identical images.
 *  - SCENES (bottom of file) is the master timeline. Each scene has a duration,
 *    a chapter label, a year range for the timeline bar and a draw(t, dur)
 *    function receiving LOCAL time. Change a duration and everything after it
 *    re-flows automatically.
 *  - Reusable "plates" (torch, Capitol, bridge, Wright Flyer, Saturn V, chip,
 *    booster tower ...) are drawn at any position/scale with a progress 0..1
 *    so they can assemble in their own scene and reappear in the montage.
 *
 *  URL parameters
 *  --------------
 *    ?render            headless mode: no UI, no animation loop (see render.mjs)
 *    ?t=42.5            start preview at a given time
 *    ?theme=parchment   aged-parchment variant (sepia ink on paper)
 *    ?noglow            disable glow (faster preview on slow machines)
 *    ?scale=2           supersample the canvas (2 = 3840×2160 / 4K UHD)
 * ========================================================================== */
(() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------------
  const W = 1920, H = 1080;
  const params = new URLSearchParams(location.search);
  const RENDER = params.has('render');
  const THEME = params.get('theme') === 'parchment' ? 'parchment' : 'black';
  const SCALE = Math.max(1, parseFloat(params.get('scale')) || 1);
  // shadowBlur ignores the canvas transform, so glow is scaled by hand.
  const GLOW = params.has('noglow') ? 0 : SCALE;
  const FINAL_WORD = params.get('final') || 'ONWARD.'; // try ?final=ACCELERATE.

  const canvas = document.getElementById('c');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');

  // Palette: colours are "r,g,b" strings so any alpha can be applied.
  const PALETTES = {
    black: {
      bg: '#050507', vignette: 'rgba(0,0,0,0.85)',
      gold: '212,175,55', bright: '247,221,140', white: '244,239,227',
      red: '196,42,52', ink: '5,5,7', grainOp: 'screen', grainA: 0.05, stars: true,
    },
    parchment: {
      bg: '#e6d8b8', vignette: 'rgba(90,60,20,0.45)',
      gold: '120,84,22', bright: '64,42,10', white: '40,26,8',
      red: '150,26,34', ink: '230,216,184', grainOp: 'multiply', grainA: 0.10, stars: false,
    },
  };
  const C = PALETTES[THEME];
  const col = (rgb, a = 1) => `rgba(${rgb},${a})`;

  const F = {
    display: '"Cinzel", "Trajan Pro", Georgia, serif',
    serif: '"Cormorant Garamond", Garamond, Georgia, serif',
    mono: '"IBM Plex Mono", "DejaVu Sans Mono", monospace',
  };

  // ---------------------------------------------------------------------------
  // Math & easing
  // ---------------------------------------------------------------------------
  const TAU = Math.PI * 2, D2R = Math.PI / 180;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const E = {
    linear: x => x,
    out: x => 1 - Math.pow(1 - x, 3),
    in: x => x * x * x,
    inOut: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    expoOut: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    back: x => 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2),
  };
  /** Eased progress of t through the window [a, b]. */
  const seg = (t, a, b, e = E.inOut) => e(clamp((t - a) / (b - a)));
  /** Linear sub-progress of p through [a, b] — used to stage parts of a drawing. */
  const st = (p, a, b) => clamp((p - a) / (b - a));
  const fmt = n => Math.round(n).toLocaleString('en-US');

  /** Deterministic PRNG (mulberry32) so every render is identical. */
  function rng(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------------------
  // Pen & primitive drawing (all progressive: p = 0..1 of the stroke drawn)
  // ---------------------------------------------------------------------------
  function pen(rgb = C.gold, a = 1, w = 2, glow = 0) {
    ctx.strokeStyle = col(rgb, a);
    ctx.lineWidth = w;
    ctx.shadowColor = col(rgb, 0.75);
    ctx.shadowBlur = glow * GLOW;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }
  const noGlow = () => { ctx.shadowBlur = 0; };

  /** Stroke a polyline up to fraction p of its length. Returns the pen tip. */
  function polyP(pts, p = 1, closed = false, tip = true) {
    if (p <= 0 || pts.length < 2) return null;
    const P = closed ? pts.concat([pts[0]]) : pts;
    let total = 0;
    const L = [];
    for (let i = 1; i < P.length; i++) {
      const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
      L.push(d); total += d;
    }
    let rem = total * clamp(p);
    let end = P[0];
    ctx.beginPath();
    ctx.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < P.length; i++) {
      const d = L[i - 1];
      if (rem >= d) { ctx.lineTo(P[i][0], P[i][1]); rem -= d; end = P[i]; }
      else {
        const f = d ? rem / d : 0;
        end = [lerp(P[i - 1][0], P[i][0], f), lerp(P[i - 1][1], P[i][1], f)];
        ctx.lineTo(end[0], end[1]);
        break;
      }
    }
    ctx.stroke();
    // A bright "drafting pen" head while the stroke is still being drawn.
    if (tip && p < 1) {
      const sb = ctx.shadowBlur;
      ctx.fillStyle = col(C.bright, 0.9);
      ctx.shadowBlur = 10 * GLOW;
      ctx.beginPath(); ctx.arc(end[0], end[1], 2.4, 0, TAU); ctx.fill();
      ctx.shadowBlur = sb;
    }
    return end;
  }
  const lineP = (x1, y1, x2, y2, p = 1, tip = true) => polyP([[x1, y1], [x2, y2]], p, false, tip);
  const rectP = (x, y, w, h, p = 1) => polyP([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], p, true);
  function arcP(cx, cy, r, a0, a1, p = 1) {
    if (p <= 0) return;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a0 + (a1 - a0) * clamp(p), a1 < a0);
    ctx.stroke();
  }
  const circleP = (cx, cy, r, p = 1, a0 = -Math.PI / 2) => arcP(cx, cy, r, a0, a0 + TAU, p);
  function ellipseP(cx, cy, rx, ry, rot, a0, a1, p = 1) {
    if (p <= 0) return;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(0.01, rx), Math.max(0.01, ry), rot, a0, a0 + (a1 - a0) * clamp(p), a1 < a0);
    ctx.stroke();
  }
  function dot(x, y, r, rgb = C.bright, a = 1, glow = 0) {
    ctx.fillStyle = col(rgb, a);
    ctx.shadowColor = col(rgb, 0.9);
    ctx.shadowBlur = glow * GLOW;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
  }
  /** Sample a parametric curve fn(u) -> [x, y] into n+1 points. */
  function sample(fn, n = 48) {
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push(fn(i / n));
    return pts;
  }
  function bez(p0, p1, p2, p3, u) {
    const v = 1 - u;
    return [
      v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
      v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1],
    ];
  }
  /** Diagonal engraving hatch inside a rectangle. */
  function hatch(x, y, w, h, gap = 8, p = 1, a = 0.35) {
    if (p <= 0) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w * clamp(p), h); ctx.clip();
    pen(C.gold, a, 1);
    ctx.beginPath();
    for (let k = -h; k < w; k += gap) { ctx.moveTo(x + k, y + h); ctx.lineTo(x + k + h, y); }
    ctx.stroke();
    ctx.restore();
  }
  /** Five-pointed star outline. */
  function star(x, y, r, p = 1, rot = 0) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + rot + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.4 : r;
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }
    polyP(pts, p, true, false);
  }

  // ---------------------------------------------------------------------------
  // Typography
  // ---------------------------------------------------------------------------
  function setFont(size, font, weight = 400, italic = false) {
    ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${font}`;
  }
  /** Static text with optional tracking (letter-spacing). */
  function txt(s, x, y, o = {}) {
    const { size = 16, font = F.mono, weight = 400, italic = false, align = 'center',
      rgb = C.gold, a = 1, track = 0, base = 'middle', glow = 0 } = o;
    if (a <= 0) return;
    setFont(size, font, weight, italic);
    ctx.letterSpacing = `${track}px`;
    ctx.textAlign = align;
    ctx.textBaseline = base;
    ctx.fillStyle = col(rgb, a);
    ctx.shadowColor = col(rgb, 0.6);
    ctx.shadowBlur = glow * GLOW;
    // letter-spacing adds trailing space after the last glyph; re-centre.
    const dx = align === 'center' ? track / 2 : align === 'right' ? track : 0;
    ctx.fillText(s, x + dx, y);
    ctx.letterSpacing = '0px';
    ctx.shadowBlur = 0;
  }
  /**
   * Kinetic typography: letters rise and resolve one by one, then (optionally)
   * dissolve at `out`. t is local scene time, t0 is when the line starts.
   */
  function kinetic(s, x, y, t, t0, o = {}) {
    const { size = 64, font = F.display, weight = 600, track = 8, rgb = C.bright,
      stagger = 0.03, dur = 0.7, out = Infinity, outDur = 0.5, rise = 0.35,
      glow = 22, align = 'center', italic = false } = o;
    if (t < t0) return;
    const aOut = Number.isFinite(out) ? 1 - seg(t, out, out + outDur) : 1;
    if (aOut <= 0) return;
    setFont(size, font, weight, italic);
    ctx.letterSpacing = '0px';
    const chars = [...s];
    const widths = chars.map(c => ctx.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0) + track * (chars.length - 1);
    let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = col(rgb, 0.55);
    ctx.shadowBlur = glow * GLOW;
    chars.forEach((c, i) => {
      const k = seg(t, t0 + i * stagger, t0 + i * stagger + dur, E.out);
      if (k > 0) {
        ctx.fillStyle = col(rgb, k * aOut);
        ctx.fillText(c, cx, y + (1 - k) * size * rise);
      }
      cx += widths[i] + track;
    });
    ctx.shadowBlur = 0;
  }
  /** Width of a tracked line, matching kinetic()'s layout. */
  function textWidth(s, size, font = F.display, weight = 600, track = 8) {
    setFont(size, font, weight);
    ctx.letterSpacing = '0px';
    return [...s].reduce((a, c) => a + ctx.measureText(c).width, 0) + track * (s.length - 1);
  }
  /** Several words on one line, each landing at its own time. */
  function kineticWords(words, x, y, t, times, o = {}) {
    const { size = 64, font = F.display, weight = 600, track = 8, gap = size * 0.6 } = o;
    const ws = words.map(w => textWidth(w, size, font, weight, track));
    let cx = x - (ws.reduce((a, b) => a + b, 0) + gap * (words.length - 1)) / 2;
    words.forEach((w, i) => {
      kinetic(w, cx, y, t, times[i], { ...o, align: 'left', ...(o.styles ? o.styles[i] : {}) });
      cx += ws[i] + gap;
    });
  }
  /** Small mono annotation with a leader line from (ax, ay) to the label. */
  function annot(label, ax, ay, lx, ly, a = 1, align = 'left', p = 1) {
    if (a <= 0 || p <= 0) return;
    pen(C.gold, 0.55 * a, 1);
    lineP(ax, ay, lx, ly, p, false);
    dot(ax, ay, 2.5, C.bright, a);
    txt(label, lx + (align === 'left' ? 8 : -8), ly, { size: 14, align, a: a * st(p, 0.6, 1), track: 1.5 });
  }
  /** Blueprint dimension line with end ticks and centred label. */
  function dimension(x1, y1, x2, y2, label, p = 1, a = 0.75) {
    if (p <= 0) return;
    pen(C.gold, a, 1);
    const ang = Math.atan2(y2 - y1, x2 - x1), nx = -Math.sin(ang) * 8, ny = Math.cos(ang) * 8;
    lineP(x1 - nx, y1 - ny, x1 + nx, y1 + ny, 1, false);
    lineP(x1, y1, x2, y2, p, false);
    if (p >= 1) lineP(x2 - nx, y2 - ny, x2 + nx, y2 + ny, 1, false);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(Math.abs(ang) > Math.PI / 2 ? ang + Math.PI : ang);
    txt(label, 0, -14, { size: 13, a: a * st(p, 0.7, 1), track: 2 });
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Charts
  // ---------------------------------------------------------------------------
  /**
   * Progressive chart. data = [[x, y], ...]. Returns tip position & value so
   * counters can stay synced with the curve. dashFrom: x value after which the
   * curve is drawn dashed (projections).
   */
  function chart(o) {
    const { x, y, w, h, p, data, xr, yr, log = false, xticks = [], yticks = [], title = '',
      dashFrom = null, rgb = C.bright, area = true } = o;
    const X = v => x + ((v - xr[0]) / (xr[1] - xr[0])) * w;
    const nrm = v => (log ? (Math.log10(v) - Math.log10(yr[0])) / (Math.log10(yr[1]) - Math.log10(yr[0])) : (v - yr[0]) / (yr[1] - yr[0]));
    const Y = v => y + h - nrm(v) * h;
    const pa = st(p, 0, 0.25), pc = st(p, 0.2, 1);
    // Axes & grid
    pen(C.gold, 0.7, 1.4);
    polyP([[x, y], [x, y + h], [x + w, y + h]], pa, false, false);
    pen(C.gold, 0.12, 1);
    yticks.forEach(([v]) => lineP(x, Y(v), x + w * pa, Y(v), 1, false));
    xticks.forEach(([v, l]) => txt(l, X(v), y + h + 20, { size: 12, a: pa * 0.8 }));
    yticks.forEach(([v, l]) => txt(l, x - 10, Y(v), { size: 12, a: pa * 0.8, align: 'right' }));
    if (title) txt(title, x, y - 22, { size: 13, align: 'left', a: pa, track: 2.5 });
    // Curve
    const pts = data.map(([a, b]) => [X(a), Y(b)]);
    if (pc <= 0) return { X, Y, tip: pts[0], val: data[0][1], xval: data[0][0] };
    // Find tip by x-extent (curve reveals left-to-right in data-space)
    const xEnd = lerp(xr[0], data[data.length - 1][0], pc);
    const visible = [];
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] <= xEnd) visible.push(data[i]);
      else {
        const a = data[i - 1], b = data[i];
        const f = (xEnd - a[0]) / (b[0] - a[0]);
        const v = log ? Math.pow(10, lerp(Math.log10(a[1]), Math.log10(b[1]), f)) : lerp(a[1], b[1], f);
        visible.push([xEnd, v]);
        break;
      }
    }
    const vpts = visible.map(([a, b]) => [X(a), Y(b)]);
    if (area && vpts.length > 1) {
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, col(C.gold, 0.18)); g.addColorStop(1, col(C.gold, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(vpts[0][0], y + h);
      vpts.forEach(q => ctx.lineTo(q[0], q[1]));
      ctx.lineTo(vpts[vpts.length - 1][0], y + h); ctx.closePath(); ctx.fill();
    }
    if (dashFrom == null) {
      pen(rgb, 1, 2.6, 12); polyP(vpts, 1, false, false);
    } else {
      const solid = vpts.filter((_, i) => visible[i][0] <= dashFrom);
      const iDash = Math.max(0, solid.length - 1);
      pen(rgb, 1, 2.6, 12); polyP(solid, 1, false, false);
      ctx.setLineDash([10, 9]); polyP(vpts.slice(iDash), 1, false, false); ctx.setLineDash([]);
    }
    data.forEach(([a, b]) => { if (a <= xEnd) dot(X(a), Y(b), 3, C.gold, 0.9); });
    const tip = vpts[vpts.length - 1];
    if (pc < 1 || true) dot(tip[0], tip[1], 5, C.bright, 1, 16);
    noGlow();
    return { X, Y, tip, val: visible[visible.length - 1][1], xval: xEnd };
  }

  // ---------------------------------------------------------------------------
  // Map of the contiguous United States (simplified outline, conic projection)
  // ---------------------------------------------------------------------------
  const US_OUTLINE = [
    [-124.7, 48.4], [-123.0, 49.0], [-95.2, 49.0], [-95.0, 49.4], [-89.6, 48.0], [-84.8, 46.5],
    [-82.5, 45.3], [-82.4, 43.0], [-83.1, 42.3], [-82.5, 41.7], [-79.0, 42.8], [-79.1, 43.3],
    [-76.8, 43.6], [-75.0, 45.0], [-71.5, 45.0], [-70.0, 46.7], [-67.8, 47.1], [-67.0, 45.0],
    [-70.2, 43.6], [-70.6, 42.6], [-71.0, 42.3], [-70.0, 41.8], [-71.9, 41.3], [-74.0, 40.6],
    [-74.1, 39.6], [-74.9, 38.9], [-75.1, 38.4], [-75.9, 37.2], [-76.0, 36.9], [-75.5, 35.2],
    [-77.9, 33.9], [-79.9, 32.8], [-81.1, 32.0], [-81.4, 30.3], [-80.6, 28.5], [-80.1, 25.8],
    [-81.0, 25.1], [-81.8, 26.5], [-82.7, 27.9], [-83.0, 29.1], [-84.2, 30.0], [-85.4, 29.7],
    [-87.4, 30.3], [-88.1, 30.4], [-89.4, 30.2], [-89.4, 29.0], [-90.5, 29.1], [-92.0, 29.6],
    [-93.8, 29.7], [-94.8, 29.3], [-96.5, 28.3], [-97.3, 27.6], [-97.2, 25.9], [-99.5, 27.5],
    [-100.9, 29.4], [-102.4, 29.8], [-103.0, 29.0], [-104.5, 29.6], [-106.5, 31.8], [-108.2, 31.8],
    [-108.2, 31.3], [-111.1, 31.3], [-114.8, 32.5], [-117.1, 32.5], [-118.4, 33.9], [-120.6, 34.5],
    [-121.9, 36.6], [-122.5, 37.8], [-123.7, 39.0], [-124.4, 40.4], [-124.2, 42.0], [-124.0, 44.5],
    [-124.0, 46.2], [-124.7, 48.4],
  ];
  /** Lambert-style conic: parallels are arcs, meridians converge northward. */
  function makeProj(cx, cy, k) {
    const lat0 = 38, lon0 = -96, n = Math.sin(lat0 * D2R);
    const R0 = (k * Math.cos(lat0 * D2R)) / (n * D2R);
    return (lon, lat) => {
      const r = R0 - (lat - lat0) * k, th = (lon - lon0) * n * D2R;
      return [cx + r * Math.sin(th), cy - R0 + r * Math.cos(th)];
    };
  }
  function graticule(proj, a = 0.12, p = 1) {
    pen(C.gold, a, 1);
    for (let lon = -125; lon <= -65; lon += 5) polyP(sample(u => proj(lon, lerp(23, 51, u)), 12), p, false, false);
    for (let lat = 25; lat <= 50; lat += 5) polyP(sample(u => proj(lerp(-127, -63, u), lat), 40), p, false, false);
  }
  function outlinePath(proj) {
    ctx.beginPath();
    US_OUTLINE.forEach(([lo, la], i) => { const [x, y] = proj(lo, la); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.closePath();
  }
  const CITY = {
    SEA: [-122.3, 47.6], POR: [-122.7, 45.5], SAC: [-121.5, 38.6], SF: [-122.4, 37.8], LA: [-118.2, 34.05],
    SD: [-117.2, 32.7], PHX: [-112.1, 33.4], TUS: [-110.9, 32.2], ELP: [-106.5, 31.8], SAT: [-98.5, 29.4],
    HOU: [-95.4, 29.8], NOL: [-90.1, 29.95], MOB: [-88.0, 30.7], TLH: [-84.3, 30.4], JAX: [-81.7, 30.3],
    MIA: [-80.2, 25.8], SAV: [-81.1, 32.1], RIC: [-77.4, 37.5], DC: [-77.0, 38.9], BAL: [-76.6, 39.3],
    PHL: [-75.2, 39.95], NYC: [-74.0, 40.7], BOS: [-71.06, 42.36], PME: [-70.3, 43.7], SPK: [-117.4, 47.7],
    MSO: [-114.0, 46.9], BUT: [-112.5, 46.0], BIL: [-108.5, 45.8], SXF: [-96.7, 43.5], MAD: [-89.4, 43.1],
    CHI: [-87.6, 41.9], CLE: [-81.7, 41.5], BUF: [-78.9, 42.9], ALB: [-73.8, 42.65], RNO: [-119.8, 39.5],
    SLC: [-111.9, 40.8], CHY: [-104.8, 41.1], OMA: [-95.9, 41.3], DSM: [-93.6, 41.6], TOL: [-83.5, 41.65],
    BAR: [-117.0, 34.9], FLG: [-111.65, 35.2], ABQ: [-106.65, 35.1], AMA: [-101.8, 35.2], OKC: [-97.5, 35.5],
    LIT: [-92.3, 34.7], MEM: [-90.05, 35.15], NSH: [-86.8, 36.2], KNX: [-83.9, 35.95], RAL: [-78.6, 35.8],
    WIL: [-77.9, 34.2], LRD: [-99.5, 27.5], DAL: [-96.8, 32.8], KC: [-94.6, 39.1], MSP: [-93.3, 44.95],
    DUL: [-92.1, 46.8], DEN: [-105.0, 39.7], STL: [-90.2, 38.6], IND: [-86.2, 39.8], COL: [-83.0, 39.96],
    PIT: [-80.0, 40.4], TPA: [-82.5, 27.95], ATL: [-84.4, 33.75], CHA: [-85.3, 35.0], CIN: [-84.5, 39.1],
    DET: [-83.05, 42.3], LAS: [-115.15, 36.2], GTF: [-111.3, 47.5], UT: [-112.6, 38.6], PA: [-77.8, 41.0],
    MGM: [-86.3, 32.4],
  };
  const INTERSTATES = [
    'SD LA SAC POR SEA', 'SD BAR LAS SLC BUT GTF', 'LA PHX TUS ELP SAT HOU NOL MOB TLH JAX',
    'BAR FLG ABQ AMA OKC LIT MEM NSH KNX RAL WIL', 'SF SAC RNO SLC CHY OMA DSM CHI TOL CLE PA NYC',
    'SEA SPK MSO BUT BIL SXF MAD CHI TOL CLE BUF ALB BOS', 'LRD SAT DAL OKC KC DSM MSP DUL',
    'UT DEN KC STL IND COL PIT BAL', 'MIA TPA ATL CHA KNX CIN TOL DET',
    'MIA JAX SAV RIC DC BAL PHL NYC BOS PME', 'ELP ABQ DEN CHY', 'NOL MEM STL CHI', 'MOB MGM NSH IND CHI',
  ].map(r => r.split(' ').map(k => CITY[k]));
  const LEWIS_CLARK = [
    [-90.2, 38.6], [-92.5, 38.8], [-94.6, 39.1], [-95.9, 41.3], [-97.4, 42.8], [-100.4, 44.4],
    [-100.8, 46.8], [-103.5, 48.0], [-107.0, 47.6], [-111.3, 47.5], [-112.4, 45.9], [-113.4, 45.0],
    [-114.5, 46.6], [-116.0, 46.5], [-117.0, 46.4], [-119.0, 46.0], [-121.2, 45.6], [-123.9, 46.1],
  ];

  // ---------------------------------------------------------------------------
  // Static randomness (computed once => deterministic frames)
  // ---------------------------------------------------------------------------
  const R = rng(1776);
  const STARS = Array.from({ length: 260 }, () => ({ x: R() * W, y: R() * H, r: R() * 1.3 + 0.2, ph: R() * TAU, a: R() * 0.5 + 0.1 }));
  const CHIP_TRACES = (() => {
    const out = [], r = rng(1971);
    for (let i = 0; i < 90; i++) {
      // Start on die perimeter, walk inward with Manhattan turns.
      const side = Math.floor(r() * 4), u = 0.06 + r() * 0.88;
      let x = [u, 1, u, 0][side], y = [0, u, 1, u][side];
      const pts = [[x, y]];
      let horiz = side % 2 === 1;
      const n = 2 + Math.floor(r() * 4);
      for (let k = 0; k < n; k++) {
        const d = (0.08 + r() * 0.3) * (r() < 0.5 ? -1 : 1);
        if (horiz) x = clamp(x + (side === 1 ? -Math.abs(d) : side === 3 ? Math.abs(d) : d), 0.04, 0.96);
        else y = clamp(y + (side === 0 ? Math.abs(d) : side === 2 ? -Math.abs(d) : d), 0.04, 0.96);
        pts.push([x, y]);
        horiz = !horiz;
      }
      out.push({ pts, delay: r() });
    }
    return out;
  })();
  const RACK_LEDS = Array.from({ length: 400 }, () => ({ ph: R() * TAU, f: 1 + R() * 5 }));
  const NEURAL = Array.from({ length: 46 }, () => ({ x: R(), y: R(), ph: R() * TAU }));
  const GRAIN = Array.from({ length: 4 }, (_, k) => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'), img = g.createImageData(256, 256), r = rng(99 + k);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = r() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = r() * 120;
    }
    g.putImageData(img, 0, 0);
    return c;
  });
  // Pre-rendered background (paper/grid/vignette) — identical for every frame.
  const BG = (() => {
    const c = document.createElement('canvas'); c.width = W * SCALE; c.height = H * SCALE;
    const g = c.getContext('2d');
    g.scale(SCALE, SCALE);
    g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
    if (THEME === 'parchment') {
      const r = rng(5);
      for (let i = 0; i < 90; i++) { // age stains
        const x = r() * W, y = r() * H, rad = 60 + r() * 260;
        const gr = g.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, `rgba(140,100,40,${0.04 + r() * 0.05})`); gr.addColorStop(1, 'rgba(140,100,40,0)');
        g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
    }
    // Surveyor grid: minor every 40px, major every 200px.
    g.strokeStyle = col(C.gold, THEME === 'black' ? 0.035 : 0.08); g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x <= W; x += 40) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); }
    for (let y = 0; y <= H; y += 40) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
    g.stroke();
    g.strokeStyle = col(C.gold, THEME === 'black' ? 0.06 : 0.12);
    g.beginPath();
    for (let x = 0; x <= W; x += 200) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); }
    for (let y = 0; y <= H; y += 200) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
    g.stroke();
    const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, C.vignette);
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    return c;
  })();

  // ===========================================================================
  //  PLATES — reusable drawings. (cx, cy) anchor, s = scale, p = assembly 0..1
  // ===========================================================================

  /** The torch of liberty. Anchor = centre of cup rim. t animates the flame. */
  function torch(cx, cy, s, p, t, flame = 1) {
    const M = (x, y) => [cx + x * s, cy + y * s];
    const hw = y => 14 + ((230 - y) / 170) * 10;
    pen(C.gold, 1, 2.2, 8);
    polyP([M(-14, 230), M(14, 230), M(24, 60), M(-24, 60)], st(p, 0, 0.3), true);
    pen(C.gold, 0.8, 1.4);
    [200, 165, 120, 90].forEach((y, i) => lineP(...M(-hw(y), y), ...M(hw(y), y), st(p, 0.18 + i * 0.03, 0.3 + i * 0.03), false));
    circleP(...M(0, 244), 14 * s, st(p, 0.2, 0.32));
    pen(C.gold, 1, 2.2, 8);
    rectP(...M(-34, 40), 68 * s, 20 * s, st(p, 0.3, 0.42));
    polyP([M(-34, 40), M(34, 40), M(64, -20), M(-64, -20)], st(p, 0.38, 0.55), true);
    pen(C.gold, 0.7, 1.2);
    for (let f = -2; f <= 2; f++) lineP(...M(f * 13.6, 40), ...M(f * 25.6, -20), st(p, 0.45 + (f + 2) * 0.02, 0.6), false);
    pen(C.bright, 1, 2, 10);
    ellipseP(...M(0, -20), 64 * s, 12 * s, 0, 0, TAU, st(p, 0.5, 0.65));
    // Flame: three nested tongues, flickering.
    const g = st(p, 0.62, 1) * flame;
    if (g > 0) {
      const fl = ctx.createRadialGradient(...M(0, -70), 0, ...M(0, -70), 170 * s * g);
      fl.addColorStop(0, col(C.bright, 0.35 * g)); fl.addColorStop(1, col(C.bright, 0));
      ctx.fillStyle = fl; ctx.beginPath(); ctx.arc(...M(0, -70), 170 * s * g, 0, TAU); ctx.fill();
      [[54, 210], [36, 155], [20, 100]].forEach(([w0, h0], j) => {
        const w = w0 * (0.6 + 0.4 * g), h = h0 * g * (1 + 0.05 * Math.sin(t * 4.1 + j));
        const tx = Math.sin(t * 2.3 + j * 1.7) * 9 + Math.sin(t * 5.3 + j) * 4;
        const b = -22;
        const left = sample(u => bez([-w, b], [-w * 1.35, b - h * 0.45], [tx - w * 0.25, b - h * 0.8], [tx, b - h], u), 20);
        const right = sample(u => bez([tx, b - h], [tx + w * 0.25, b - h * 0.75], [w * 1.3, b - h * 0.42], [w, b], u), 20);
        pen(j === 2 ? C.white : C.bright, 1, j === 0 ? 2.4 : 1.8, 16);
        polyP(left.concat(right).map(([x, y]) => M(x, y)), st(g, j * 0.15, 1), false, false);
      });
    }
    noGlow();
  }

  /** Compass seal: rings, degree ticks, inscribed eight-point star, rotating rays. */
  function seal(cx, cy, R0, p, t, rays = 1) {
    pen(C.gold, 0.9, 1.6, 6);
    circleP(cx, cy, R0, st(p, 0, 0.4));
    circleP(cx, cy, R0 + 22, st(p, 0.1, 0.5), Math.PI / 2);
    pen(C.gold, 0.45, 1);
    ctx.setLineDash([3, 7]); circleP(cx, cy, R0 - 26, st(p, 0.2, 0.6)); ctx.setLineDash([]);
    pen(C.gold, 0.8, 1.2);
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * TAU - Math.PI / 2, L = i % 6 === 0 ? 14 : 6;
      const q = st(p, 0.3 + (i / 72) * 0.3, 0.33 + (i / 72) * 0.3);
      if (q > 0) lineP(cx + Math.cos(a) * R0, cy + Math.sin(a) * R0, cx + Math.cos(a) * (R0 + L * q), cy + Math.sin(a) * (R0 + L * q), 1, false);
    }
    // Two interlocked squares
    pen(C.gold, 0.22, 1);
    for (let k = 0; k < 2; k++) {
      const pts = [0, 1, 2, 3].map(i => { const a = (i / 4) * TAU + (k * Math.PI) / 4 - Math.PI / 4; return [cx + Math.cos(a) * (R0 - 26), cy + Math.sin(a) * (R0 - 26)]; });
      polyP(pts, st(p, 0.5, 0.9), true, false);
    }
    // Rays of the rising sun
    if (rays > 0) {
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * TAU + t * 0.04;
        const long = i % 3 === 0;
        const r1 = R0 + 34, r2 = R0 + (long ? 240 : 130) * rays;
        const g = ctx.createLinearGradient(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
        g.addColorStop(0, col(C.gold, (long ? 0.55 : 0.3) * rays)); g.addColorStop(1, col(C.gold, 0));
        ctx.strokeStyle = g; ctx.lineWidth = long ? 1.6 : 1;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); ctx.stroke();
      }
    }
    noGlow();
  }

  /** Thirteen stars in a ring (the 1777 flag's circle). */
  function thirteen(cx, cy, r, sr, p, rgb = C.bright) {
    pen(rgb, 1, 1.6, 10);
    for (let i = 0; i < 13; i++) {
      const a = (i / 13) * TAU - Math.PI / 2;
      star(cx + Math.cos(a) * r, cy + Math.sin(a) * r, sr, st(p, i / 16, i / 16 + 0.25));
    }
    noGlow();
  }

  /** U.S. Capitol, front elevation. Anchor = ground centre. */
  function capitol(cx, by, s, p) {
    const M = (x, y) => [cx + x * s, by + y * s];
    const L = (x1, y1, x2, y2, q) => lineP(...M(x1, y1), ...M(x2, y2), q, false);
    pen(C.gold, 0.9, 1.6);
    L(-580, 0, 580, 0, st(p, 0, 0.15));
    pen(C.gold, 1, 2, 6);
    polyP([M(-200, 0), M(-200, -150), M(200, -150), M(200, 0)], st(p, 0.04, 0.2), false);
    polyP([M(-500, 0), M(-500, -120), M(-200, -120)], st(p, 0.06, 0.2), false);
    polyP([M(500, 0), M(500, -120), M(200, -120)], st(p, 0.06, 0.2), false);
    // Wing pediments & columns
    pen(C.gold, 0.85, 1.4);
    [-1, 1].forEach(sd => {
      polyP([M(sd * 280, -120), M(sd * 350, -150), M(sd * 420, -120)], st(p, 0.15, 0.3), false);
      for (let i = 0; i <= 10; i++) L(sd * (240 + i * 22), -12, sd * (240 + i * 22), -108, st(p, 0.15 + i * 0.012, 0.3 + i * 0.012));
      L(sd * 230, -108, sd * 470, -108, st(p, 0.2, 0.32));
    });
    // Central portico
    for (let i = 0; i < 8; i++) L(-112 + i * 32, -10, -112 + i * 32, -128, st(p, 0.25 + i * 0.01, 0.38 + i * 0.01));
    L(-140, -132, 140, -132, st(p, 0.3, 0.4));
    pen(C.gold, 1, 2, 6);
    polyP([M(-150, -150), M(0, -196), M(150, -150)], st(p, 0.3, 0.45), false);
    pen(C.gold, 0.6, 1);
    for (let i = 0; i < 4; i++) L(-150 + i * 10, i * 8, 150 - i * 10, i * 8, st(p, 0.32, 0.45));
    // Attic behind the portico, then the drum (two tiers)
    pen(C.gold, 0.8, 1.4);
    polyP([M(-175, -150), M(-175, -205), M(175, -205), M(175, -150)], st(p, 0.36, 0.48), false);
    pen(C.gold, 1, 1.8, 6);
    rectP(...M(-155, -305), 310 * s, 100 * s, st(p, 0.4, 0.55));
    pen(C.gold, 0.8, 1.2);
    for (let i = 0; i <= 18; i++) L(-150 + i * (300 / 18), -210, -150 + i * (300 / 18), -296, st(p, 0.45 + i * 0.006, 0.56 + i * 0.006));
    L(-172, -305, 172, -305, st(p, 0.5, 0.58));
    pen(C.gold, 1, 1.8, 6);
    rectP(...M(-122, -365), 244 * s, 60 * s, st(p, 0.52, 0.64));
    pen(C.gold, 0.7, 1.1);
    for (let i = 0; i < 12; i++) rectP(...M(-112 + i * 19.5, -353), 9 * s, 34 * s, st(p, 0.55 + i * 0.005, 0.66));
    // Dome: outline, meridian ribs, latitude bands
    pen(C.bright, 1, 2.2, 12);
    ellipseP(...M(0, -365), 122 * s, 145 * s, 0, Math.PI, TAU, st(p, 0.62, 0.8));
    pen(C.gold, 0.75, 1.2);
    for (let k = 1; k <= 4; k++) {
      const rx = 122 * Math.cos((k * Math.PI) / 10) * s;
      ellipseP(...M(0, -365), rx, 145 * s, 0, Math.PI * 1.5, Math.PI, st(p, 0.68 + k * 0.02, 0.86));
      ellipseP(...M(0, -365), rx, 145 * s, 0, Math.PI * 1.5, TAU, st(p, 0.68 + k * 0.02, 0.86));
    }
    for (let k = 1; k <= 3; k++) {
      const yy = -365 - (k / 4) * 145, xx = 122 * Math.sqrt(1 - Math.pow(k / 4, 2));
      L(-xx, yy, xx, yy, st(p, 0.75 + k * 0.03, 0.9));
    }
    // Lantern & statue of Freedom
    pen(C.bright, 1, 1.6, 10);
    rectP(...M(-20, -565), 40 * s, 55 * s, st(p, 0.85, 0.93));
    ellipseP(...M(0, -565), 20 * s, 18 * s, 0, Math.PI, TAU, st(p, 0.9, 0.96));
    L(0, -583, 0, -617, st(p, 0.93, 1));
    if (p > 0.96) circleP(...M(0, -623), 5 * s, st(p, 0.96, 1));
    noGlow();
  }

  /** Checks & balances: three branches, mutual constraint arrows. */
  function balances(cx, cy, R0, p, t) {
    const nodes = [-90, 30, 150].map(a => [cx + Math.cos(a * D2R) * R0, cy + Math.sin(a * D2R) * R0]);
    const labels = [['LEGISLATIVE', 'ART. I'], ['JUDICIAL', 'ART. III'], ['EXECUTIVE', 'ART. II']];
    pen(C.gold, 0.6, 1.2);
    for (let i = 0; i < 3; i++) {
      const A = nodes[i], B = nodes[(i + 1) % 3], d = Math.hypot(B[0] - A[0], B[1] - A[1]);
      const ux = (B[0] - A[0]) / d, uy = (B[1] - A[1]) / d;
      lineP(A[0] + ux * 66, A[1] + uy * 66, B[0] - ux * 66, B[1] - uy * 66, st(p, i * 0.1, 0.4 + i * 0.1), false);
    }
    nodes.forEach(([x, y], i) => {
      pen(C.bright, 1, 1.8, 10);
      circleP(x, y, 60, st(p, 0.2 + i * 0.1, 0.5 + i * 0.1));
      txt(labels[i][0], x, y - 6, { size: 13, a: st(p, 0.4 + i * 0.1, 0.6 + i * 0.1), track: 1.5, rgb: C.bright });
      txt(labels[i][1], x, y + 14, { size: 11, a: st(p, 0.45 + i * 0.1, 0.65 + i * 0.1) * 0.7 });
    });
    // Pulses travelling both ways along each edge: power checking power.
    if (p >= 0.8) {
      const a = st(p, 0.8, 1);
      for (let i = 0; i < 3; i++) {
        const A = nodes[i], B = nodes[(i + 1) % 3];
        const dx = B[0] - A[0], dy = B[1] - A[1], d = Math.hypot(dx, dy);
        const f0 = 60 / d;
        const u1 = lerp(f0, 1 - f0, (t * 0.5 + i * 0.33) % 1), u2 = lerp(f0, 1 - f0, 1 - ((t * 0.5 + i * 0.33 + 0.5) % 1));
        dot(A[0] + dx * u1, A[1] + dy * u1, 3.5, C.bright, a, 12);
        dot(A[0] + dx * u2, A[1] + dy * u2, 3.5, C.red, a, 12);
      }
    }
    txt('WE THE PEOPLE', cx, cy + 12, { size: 26, font: F.serif, italic: true, a: st(p, 0.6, 0.9), rgb: C.bright });
    noGlow();
  }

  /** Brooklyn Bridge, elevation. Anchor = deck centre. */
  function bridge(cx, cy, s, p, t = 0) {
    const M = (x, y) => [cx + x * s, cy + y * s];
    const cable = x => -20 - 270 * Math.pow(x / 300, 2);
    const side = (sd, u) => [sd * (300 + 320 * u), lerp(-290, -40, u) + 70 * Math.sin(Math.PI * u) * (1 - u * 0.3)];
    // Water
    pen(C.gold, 0.25, 1);
    for (let k = 0; k < 4; k++) polyP(sample(u => M(lerp(-760, 760, u), 150 + k * 16 + Math.sin(u * 40 + t * 1.5 + k) * 2.5), 80), st(p, 0, 0.2), false, false);
    // Deck & truss
    pen(C.gold, 1, 2, 6);
    lineP(...M(-740, 0), ...M(740, 0), st(p, 0.05, 0.25), false);
    lineP(...M(-740, 14), ...M(740, 14), st(p, 0.08, 0.28), false);
    pen(C.gold, 0.5, 1);
    polyP(sample(u => M(lerp(-740, 740, u), (Math.round(u * 120) % 2) * 14), 120), st(p, 0.1, 0.32), false, false);
    // Towers with twin gothic arches
    [-300, 300].forEach((tx, k) => {
      const q = st(p, 0.2 + k * 0.06, 0.45 + k * 0.06);
      pen(C.bright, 1, 2.2, 10);
      polyP([M(tx - 38, 150), M(tx - 38, -300), M(tx + 38, -300), M(tx + 38, 150)], q, false);
      pen(C.gold, 0.9, 1.4);
      lineP(...M(tx - 44, -300), ...M(tx + 44, -300), q, false);
      lineP(...M(tx - 42, -285), ...M(tx + 42, -285), q, false);
      [-17, 17].forEach(ox => {
        const x0 = tx + ox;
        const arch = [M(x0 - 11, 0), M(x0 - 11, -190), ...sample(u => M(x0 - 11 + 11 * Math.sin(u * Math.PI / 2), -190 - 34 * Math.sin(u * Math.PI / 2)), 6),
          ...sample(u => M(x0 + 11 * Math.sin(u * Math.PI / 2), -224 + 34 * (1 - Math.cos(u * Math.PI / 2))), 6), M(x0 + 11, 0)];
        polyP(arch, st(p, 0.3 + k * 0.05, 0.5 + k * 0.05), false, false);
      });
    });
    // Anchorages
    pen(C.gold, 0.9, 1.6);
    [-1, 1].forEach(sd => rectP(...M(sd > 0 ? 610 : -710, -60), 100 * s, 120 * s, st(p, 0.25, 0.4)));
    // Main cables
    pen(C.bright, 1, 2.2, 12);
    polyP(sample(u => M(lerp(-300, 300, u), cable(lerp(-300, 300, u))), 60), st(p, 0.45, 0.65), false);
    [-1, 1].forEach(sd => polyP(sample(u => M(...side(sd, u)), 30), st(p, 0.5, 0.65), false));
    // Vertical suspenders
    pen(C.gold, 0.55, 1);
    for (let x = -280; x <= 280; x += 20) lineP(...M(x, cable(x)), ...M(x, 0), st(p, 0.62 + ((x + 300) / 600) * 0.15, 0.7 + ((x + 300) / 600) * 0.15), false);
    for (const sd of [-1, 1]) for (let u = 0.06; u < 1; u += 0.065) { const [x, y] = side(sd, u); lineP(...M(x, y), ...M(x, 0), st(p, 0.7, 0.82), false); }
    // Diagonal stays — the bridge's signature web
    pen(C.gold, 0.45, 1);
    [-300, 300].forEach(tx => {
      for (let k = 1; k <= 9; k++) {
        lineP(...M(tx, -270), ...M(tx - Math.sign(tx) * k * 26, 0), st(p, 0.78 + k * 0.01, 0.9 + k * 0.01), false);
        lineP(...M(tx, -270), ...M(tx + Math.sign(tx) * k * 26, 0), st(p, 0.78 + k * 0.01, 0.9 + k * 0.01), false);
      }
    });
    noGlow();
  }

  /** Wright Flyer, oblique projection. Anchor = centre of airframe. */
  /** Orthographic 3/4 view: yaw 28°, looking down 16°. x = span, y = up, z = forward. */
  function flyerProj(cx, cy, s) {
    const cy_ = Math.cos(28 * D2R), sy_ = Math.sin(28 * D2R), cp = Math.cos(16 * D2R), sp = Math.sin(16 * D2R);
    return (x, y, z) => {
      const sx = x * cy_ + z * sy_, d = z * cy_ - x * sy_;
      return [cx + sx * s, cy + (-y * cp + d * sp) * s];
    };
  }
  function flyer(cx, cy, s, p, t) {
    const P3 = flyerProj(cx, cy, s);
    const L3 = (a, b, q, tip = false) => polyP([P3(...a), P3(...b)], q, false, tip);
    // Wings: upper (y=45) and lower (y=-45)
    [[-45, 0], [45, 0.1]].forEach(([y, d]) => {
      pen(C.bright, 1, 2, 10);
      polyP([P3(-200, y, -30), P3(-200, y, 35), P3(200, y, 35), P3(200, y, -30)], st(p, d, d + 0.3), true);
      pen(C.gold, 0.45, 1);
      for (let x = -180; x <= 180; x += 20) L3([x, y, -30], [x, y, 35], st(p, d + 0.15 + (x + 200) / 2000, d + 0.35 + (x + 200) / 2000));
    });
    // Struts & wire bracing
    pen(C.gold, 0.9, 1.3);
    for (let x = -200; x <= 200; x += 40) {
      L3([x, -45, 35], [x, 45, 35], st(p, 0.3 + (x + 200) / 3000, 0.45 + (x + 200) / 3000));
      L3([x, -45, -30], [x, 45, -30], st(p, 0.32 + (x + 200) / 3000, 0.47 + (x + 200) / 3000));
    }
    pen(C.gold, 0.3, 0.8);
    for (let x = -200; x < 200; x += 40) {
      L3([x, -45, 35], [x + 40, 45, 35], st(p, 0.45, 0.65));
      L3([x, 45, 35], [x + 40, -45, 35], st(p, 0.45, 0.65));
    }
    // Forward elevator (biplane canard) and booms
    pen(C.bright, 1, 1.6, 8);
    [-12, 12].forEach(y => polyP([P3(-50, y, 140), P3(-50, y, 175), P3(50, y, 175), P3(50, y, 140)], st(p, 0.5, 0.7), true));
    pen(C.gold, 0.7, 1.1);
    [-25, 25].forEach(x => { L3([x, -45, 35], [x, -12, 140], st(p, 0.55, 0.72)); L3([x, 45, 35], [x, 12, 140], st(p, 0.55, 0.72)); });
    // Twin rudders and rear booms
    pen(C.bright, 1, 1.6, 8);
    [-10, 10].forEach(x => polyP([P3(x, -32, -168), P3(x, 32, -168), P3(x, 32, -190), P3(x, -32, -190)], st(p, 0.6, 0.8), true));
    pen(C.gold, 0.7, 1.1);
    [-25, 25].forEach(x => { L3([x, -45, -30], [0, -30, -168], st(p, 0.6, 0.8)); L3([x, 45, -30], [0, 30, -168], st(p, 0.6, 0.8)); });
    // Skids
    pen(C.gold, 0.8, 1.3);
    [-25, 25].forEach(x => { L3([x, -62, 75], [x, -62, -60], st(p, 0.7, 0.85)); L3([x, -62, 20], [x, -45, 20], st(p, 0.75, 0.9)); });
    // Pusher propellers (spinning)
    if (p > 0.8) {
      const q = st(p, 0.8, 1), a = t * 30;
      [-70, 70].forEach((x, k) => {
        pen(C.bright, q, 2, 8);
        const da = k ? -a : a;
        L3([x + Math.cos(da) * 34, Math.sin(da) * 34, -40], [x - Math.cos(da) * 34, -Math.sin(da) * 34, -40], 1);
        pen(C.gold, 0.25 * q, 1);
        polyP(sample(u => P3(x + Math.cos(u * TAU) * 34, Math.sin(u * TAU) * 34, -40), 30), 1, true, false);
      });
    }
    noGlow();
  }

  /** Saturn V, elevation, in feet (s = px per ft / 2). Anchor = base centre. */
  function saturnV(cx, by, s, p, labels = 0) {
    const f = 2 * s;
    const M = (x, y) => [cx + x * f, by - y * f];
    const sec = (y0, y1, w0, w1, q) => polyP([M(-w0, y0), M(-w1, y1), M(w1, y1), M(w0, y0)], q, true);
    pen(C.bright, 1, 2, 10);
    // F-1 engine bells
    [-10, 0, 10].forEach((x, i) => polyP([M(x - 5.5, 0), M(x - 2.6, 19), M(x + 2.6, 19), M(x + 5.5, 0)], st(p, 0.05 + i * 0.03, 0.2 + i * 0.03), true));
    sec(19, 138, 16.5, 16.5, st(p, 0.1, 0.3));          // S-IC
    sec(138, 212, 16.5, 16.5, st(p, 0.25, 0.42));       // S-II
    sec(212, 222, 16.5, 10.85, st(p, 0.38, 0.48));      // interstage
    sec(222, 278, 10.85, 10.85, st(p, 0.45, 0.6));      // S-IVB
    sec(278, 281, 10.85, 10.85, st(p, 0.55, 0.65));     // IU
    sec(281, 309, 10.85, 6.4, st(p, 0.6, 0.72));        // SLA
    sec(309, 319, 6.4, 6.4, st(p, 0.68, 0.78));         // SM
    sec(319, 330, 6.4, 1.6, st(p, 0.74, 0.84));         // CM
    pen(C.gold, 1, 1.3, 6);                              // Launch escape tower
    polyP([M(-1.6, 330), M(-0.8, 345), M(0.8, 345), M(1.6, 330)], st(p, 0.82, 0.9), true);
    for (let k = 0; k < 4; k++) { lineP(...M(-1.2 + (k % 2) * 2.4, 330 + k * 3.7), ...M(1.2 - (k % 2) * 2.4, 333.7 + k * 3.7), st(p, 0.84, 0.92), false); }
    sec(345, 358, 1.4, 1.4, st(p, 0.86, 0.95));
    sec(358, 363, 1.4, 0.2, st(p, 0.9, 1));
    // Fins
    pen(C.gold, 1, 1.6, 6);
    [-1, 1].forEach(sd => polyP([M(sd * 16.5, 46), M(sd * 25, 22), M(sd * 25, 10), M(sd * 16.5, 19)], st(p, 0.15, 0.3), false));
    // Roll-pattern bands (engraved hatch)
    const hq = st(p, 0.4, 0.7);
    if (hq > 0) {
      const H2 = (x0, y0, x1, y1) => { const [a, b] = M(x0, y1), [c, d] = M(x1, y0); hatch(a, b, c - a, d - b, 5, hq, 0.55); };
      H2(-16.5, 19, -8.25, 60); H2(8.25, 100, 16.5, 138); H2(-16.5, 138, -8.25, 150);
      H2(-10.85, 222, -5.4, 245); H2(5.4, 222, 10.85, 245);
    }
    // Stage seams
    pen(C.gold, 0.5, 1);
    [60, 100, 170, 190].forEach(y => lineP(...M(-16.5, y), ...M(16.5, y), st(p, 0.3, 0.5), false));
    if (p > 0.5) {
      const a = st(p, 0.5, 0.8);
      ['U', 'S', 'A'].forEach((c, i) => txt(c, cx, by - (115 - i * 14) * f, { size: 16 * s * 1.2, font: F.display, weight: 700, a, rgb: C.bright }));
    }
    if (labels > 0) {
      const lx = cx + 70 * f;
      [['S-IC · FIRST STAGE · 7.5M LBF', 80], ['S-II · SECOND STAGE', 175], ['S-IVB · THIRD STAGE', 250], ['COMMAND & SERVICE MODULE', 318], ['LAUNCH ESCAPE SYSTEM', 350]]
        .forEach(([l, y], i) => annot(l, cx + (y < 220 ? 16.5 : y < 300 ? 10.85 : 4) * f, by - y * f, lx, by - y * f, labels, 'left', st(labels, i * 0.1, i * 0.1 + 0.5)));
      dimension(cx - 60 * f, by, cx - 60 * f, by - 363 * f, '363 FT', st(labels, 0, 0.7));
    }
    noGlow();
  }

  /** Integrated circuit: package, pins, die, cores and routed traces. */
  function chip(cx, cy, S, p, t) {
    const x0 = cx - S / 2, y0 = cy - S / 2;
    pen(C.bright, 1, 2.2, 10);
    rectP(x0, y0, S, S, st(p, 0, 0.2));
    // Pins
    pen(C.gold, 0.85, 2);
    const n = 20, step = S / (n + 1);
    for (let i = 1; i <= n; i++) {
      const q = st(p, 0.1 + i * 0.006, 0.25 + i * 0.006);
      lineP(x0 + i * step, y0, x0 + i * step, y0 - 22, q, false);
      lineP(x0 + i * step, y0 + S, x0 + i * step, y0 + S + 22, q, false);
      lineP(x0, y0 + i * step, x0 - 22, y0 + i * step, q, false);
      lineP(x0 + S, y0 + i * step, x0 + S + 22, y0 + i * step, q, false);
    }
    // Die
    const D = S * 0.78, dx = cx - D / 2, dy = cy - D / 2;
    pen(C.gold, 0.9, 1.4);
    rectP(dx, dy, D, D, st(p, 0.18, 0.32));
    // Four cores + cache
    const core = D * 0.27;
    [[0.1, 0.1], [0.63, 0.1], [0.1, 0.63], [0.63, 0.63]].forEach(([u, v], k) => {
      const q = st(p, 0.3 + k * 0.05, 0.5 + k * 0.05);
      pen(C.bright, 1, 1.5, 8);
      rectP(dx + u * D, dy + v * D, core, core, q);
      pen(C.gold, 0.35, 1);
      for (let g = 1; g < 6; g++) {
        lineP(dx + u * D + (g * core) / 6, dy + v * D, dx + u * D + (g * core) / 6, dy + v * D + core, q, false);
        lineP(dx + u * D, dy + v * D + (g * core) / 6, dx + u * D + core, dy + v * D + (g * core) / 6, q, false);
      }
    });
    pen(C.gold, 0.8, 1.2);
    rectP(dx + 0.38 * D, dy + 0.38 * D, 0.24 * D, 0.24 * D, st(p, 0.45, 0.6));
    hatch(dx + 0.38 * D, dy + 0.38 * D, 0.24 * D, 0.24 * D, 6, st(p, 0.5, 0.65), 0.4);
    // Traces
    pen(C.gold, 0.55, 1);
    CHIP_TRACES.forEach(tr => {
      const q = st(p, 0.4 + tr.delay * 0.35, 0.6 + tr.delay * 0.35);
      polyP(tr.pts.map(([u, v]) => [dx + u * D, dy + v * D]), q, false, false);
    });
    // Signal pulses running along traces once built
    if (p >= 1) {
      CHIP_TRACES.forEach((tr, i) => {
        if (i % 3) return;
        const pts = tr.pts.map(([u, v]) => [dx + u * D, dy + v * D]);
        const u = (t * 0.6 + tr.delay) % 1;
        const seglen = pts.length - 1, k = Math.min(seglen - 1, Math.floor(u * seglen)), f = u * seglen - k;
        dot(lerp(pts[k][0], pts[k + 1][0], f), lerp(pts[k][1], pts[k + 1][1], f), 2.6, C.bright, 0.9, 10);
      });
    }
    noGlow();
  }

  /** Launch/catch tower with arms and a returning booster. */
  function catchTower(tx, by, s, p, boosterY, armClose, flame, t) {
    const M = (x, y) => [tx + x * s, by + y * s];
    // Ground & launch mount
    pen(C.gold, 0.8, 1.4);
    lineP(...M(-520, 0), ...M(300, 0), st(p, 0, 0.2), false);
    polyP([M(-216, 0), M(-206, -120), M(-86, -120), M(-76, 0)], st(p, 0.1, 0.3), false);
    pen(C.gold, 0.4, 1);
    for (let k = 0; k < 6; k++) lineP(...M(-206 + k * 24, -120), ...M(-196 + k * 24, 0), st(p, 0.2, 0.35), false);
    // Lattice tower
    pen(C.bright, 1, 2, 8);
    lineP(...M(-36, 0), ...M(-36, -650), st(p, 0.1, 0.4), false);
    lineP(...M(36, 0), ...M(36, -650), st(p, 0.12, 0.42), false);
    pen(C.gold, 0.55, 1);
    for (let k = 0; k < 14; k++) {
      const y0 = -k * 46, q = st(p, 0.2 + k * 0.02, 0.35 + k * 0.02);
      lineP(...M(-36, y0), ...M(36, y0 - 46), q, false);
      lineP(...M(36, y0), ...M(-36, y0 - 46), q, false);
      lineP(...M(-36, y0), ...M(36, y0), q, false);
    }
    pen(C.gold, 0.9, 1.4);
    polyP([M(-36, -650), M(-10, -690), M(10, -690), M(36, -650)], st(p, 0.4, 0.5), false);
    // Booster (centre x = -146)
    const bx = -146, bTop = boosterY, bBot = boosterY + 320;
    if (p > 0.4) {
      const q = st(p, 0.4, 0.7);
      pen(C.bright, 1, 2, 10);
      polyP([M(bx - 23, bBot), M(bx - 23, bTop + 8), M(bx - 18, bTop), M(bx + 18, bTop), M(bx + 23, bTop + 8), M(bx + 23, bBot)], q, true);
      pen(C.gold, 0.5, 1);
      for (let k = 1; k < 8; k++) lineP(...M(bx - 23, bTop + k * 40), ...M(bx + 23, bTop + k * 40), q, false);
      // Grid fins
      pen(C.gold, 0.9, 1.2);
      [-1, 1].forEach(sd => { rectP(...M(bx + sd * 23 + (sd > 0 ? 0 : -14), bTop + 18), 14 * s, 16 * s, q); });
      // Engine plume
      if (flame > 0) {
        for (let k = 0; k < 9; k++) {
          const x = bx - 16 + k * 4, len = (40 + 70 * flame) * (0.7 + 0.3 * Math.sin(t * 40 + k * 2.1));
          pen(k % 2 ? C.bright : C.white, 0.9 * flame, 1.4, 14);
          lineP(...M(x, bBot + 2), ...M(bx + (x - bx) * 1.8, bBot + len), 1, false);
        }
      }
    }
    // Catch arms: open = angled, closed = horizontal pinching the booster
    const ang = lerp(16, 0, armClose) * D2R, ay = -470, len = 190;
    [-1, 1].forEach(sd => {
      const ex = -36 - Math.cos(ang) * len, ey = ay + sd * Math.sin(ang) * len + sd * 6 * (1 - armClose);
      pen(C.bright, 1, 2.2, 10);
      polyP([M(-36, ay + sd * 6), M(ex, ey)], st(p, 0.45, 0.6), false);
      pen(C.gold, 0.6, 1);
      polyP([M(-36, ay + sd * 14), M(ex + 4, ey + sd * 6)], st(p, 0.5, 0.65), false);
    });
    noGlow();
  }

  /** Model T, side elevation, assembled to `stage` (0..4). Anchor = ground under centre. */
  function modelT(cx, gy, s, stage, wheelA) {
    const M = (x, y) => [cx + x * s, gy + y * s];
    const q = k => clamp(stage - k);
    pen(C.bright, 1, 1.8, 8);
    polyP([M(-112, -34), M(112, -34)], q(0), false, false);              // frame
    pen(C.gold, 0.8, 1.2);
    polyP([M(-112, -28), M(112, -28)], q(0), false, false);
    [-70, 75].forEach(x => {
      const qq = q(1);
      if (qq <= 0) return;
      pen(C.bright, 1, 1.8, 8);
      circleP(...M(x, -30), 30 * s, qq);
      pen(C.gold, 0.7, 1);
      for (let k = 0; k < 10; k++) {
        const a = wheelA + (k / 10) * TAU;
        lineP(...M(x, -30), cx + (x + Math.cos(a) * 28) * s, gy + (-30 + Math.sin(a) * 28) * s, qq, false);
      }
      arcP(...M(x, -30), 36 * s, Math.PI * 1.05, Math.PI * 1.95, q(2));    // fenders
    });
    pen(C.bright, 1, 1.8, 8);
    polyP([M(40, -36), M(40, -82), M(104, -78), M(110, -40)], q(2), false, false); // hood
    polyP([M(104, -88), M(114, -88), M(114, -40)], q(2), false, false);          // radiator
    polyP([M(-100, -36), M(-100, -96), M(-62, -100), M(-55, -60), M(40, -60), M(40, -82)], q(2), false, false); // body
    pen(C.gold, 0.9, 1.4);
    polyP([M(40, -82), M(30, -150)], q(3), false, false);                        // windshield
    polyP([M(-104, -102), M(-104, -150), M(34, -154)], q(3), false, false);      // top
    polyP([M(-30, -100), M(-30, -152)], q(3), false, false);
    noGlow();
  }

  /** Top-view aircraft icon. */
  function plane(x, y, s, a = 1) {
    const M = (u, v) => [x + u * s, y + v * s];
    pen(C.gold, a, 1.2);
    polyP([M(0, -30), M(0, 30)], 1, false, false);
    polyP([M(-42, -2), M(42, -2), M(38, 7), M(-38, 7)], 1, true, false);
    polyP([M(-15, 25), M(15, 25), M(13, 31), M(-13, 31)], 1, true, false);
  }
  /** Liberty ship, side elevation. Anchor = waterline centre. */
  function libertyShip(cx, wy, s, p, a = 1) {
    const M = (x, y) => [cx + x * s, wy + y * s];
    pen(C.bright, a, 1.8, 8);
    polyP([M(-300, 0), M(290, 0), M(335, -62), M(-318, -55), M(-300, 0)], p, false, false);
    pen(C.gold, 0.85 * a, 1.2);
    polyP([M(-50, -56), M(-50, -105), M(70, -105), M(70, -58)], st(p, 0.3, 0.6), false, false);
    polyP([M(-25, -105), M(-25, -138), M(45, -138), M(45, -105)], st(p, 0.4, 0.7), false, false);
    polyP([M(5, -138), M(5, -175), M(25, -175), M(25, -138)], st(p, 0.5, 0.8), false, false);
    [-220, -130, 150, 235].forEach((x, i) => {
      lineP(...M(x, -58), ...M(x, -205), st(p, 0.55 + i * 0.05, 0.85 + i * 0.03), false);
      lineP(...M(x, -190), ...M(x + (x < 0 ? 60 : -60), -70), st(p, 0.6 + i * 0.05, 0.9 + i * 0.03), false);
    });
    noGlow();
  }

  /** Early locomotive (c. 1830). Anchor = rail under centre. */
  function locomotive(cx, gy, s, p, t) {
    const M = (x, y) => [cx + x * s, gy + y * s];
    pen(C.gold, 0.8, 1.2);
    lineP(...M(-160, 0), ...M(160, 0), st(p, 0, 0.2), false);
    pen(C.bright, 1, 1.8, 8);
    polyP([M(-60, -42), M(-60, -82), M(70, -82), M(70, -42), M(-60, -42)], st(p, 0.1, 0.35), false);
    ellipseP(...M(70, -62), 8 * s, 20 * s, 0, -Math.PI / 2, Math.PI / 2, st(p, 0.3, 0.4));
    polyP([M(48, -82), M(48, -138), M(38, -158), M(78, -158), M(68, -138), M(68, -82)], st(p, 0.3, 0.55), false);
    polyP([M(-60, -36), M(-60, -120), M(-118, -120), M(-118, -36)], st(p, 0.35, 0.55), false);
    polyP([M(-126, -124), M(-52, -124)], st(p, 0.45, 0.6), false);
    polyP([M(-130, -36), M(110, -36), M(130, -6)], st(p, 0.2, 0.45), false);
    [-50, 30].forEach(x => {
      pen(C.bright, 1, 1.6, 8);
      circleP(...M(x, -26), 26 * s, st(p, 0.4, 0.65));
      pen(C.gold, 0.7, 1);
      for (let k = 0; k < 8; k++) { const a = t * 3 + (k / 8) * TAU; lineP(...M(x, -26), cx + (x + Math.cos(a) * 24) * s, gy + (-26 + Math.sin(a) * 24) * s, st(p, 0.55, 0.8), false); }
    });
    // Smoke rings drifting back
    if (p >= 1) for (let k = 0; k < 5; k++) {
      const u = (t * 0.6 + k / 5) % 1;
      pen(C.gold, 0.5 * (1 - u), 1);
      circleP(...M(58 - u * 160, -170 - u * 70), (8 + u * 26) * s);
    }
    noGlow();
  }
  /** Side-wheel steamboat (c. 1807). Anchor = waterline centre. */
  function steamboat(cx, wy, s, p, t) {
    const M = (x, y) => [cx + x * s, wy + y * s];
    pen(C.bright, 1, 1.8, 8);
    polyP([M(-170, -22), M(-150, 4), M(140, 4), M(178, -26)], st(p, 0, 0.3), false);
    polyP([M(-170, -22), M(178, -26)], st(p, 0.1, 0.35), false);
    polyP([M(-90, -24), M(-90, -58), M(60, -58), M(60, -24)], st(p, 0.25, 0.5), false);
    [[-30, -150], [10, -150]].forEach(([x, y]) => polyP([M(x, -58), M(x, y), M(x + 12, y), M(x + 12, -58)], st(p, 0.35, 0.6), false));
    // Paddle wheel
    pen(C.bright, 1, 1.6, 8);
    circleP(...M(-10, -20), 48 * s, st(p, 0.45, 0.7));
    pen(C.gold, 0.8, 1.2);
    for (let k = 0; k < 12; k++) { const a = t * 2.2 + (k / 12) * TAU; lineP(...M(-10, -20), cx + (-10 + Math.cos(a) * 48) * s, wy + (-20 + Math.sin(a) * 48) * s, st(p, 0.6, 0.85), false); }
    // Water
    pen(C.gold, 0.35, 1);
    for (let k = 0; k < 3; k++) polyP(sample(u => M(lerp(-230, 230, u), 14 + k * 12 + Math.sin(u * 30 - t * 3 + k) * 2), 60), st(p, 0, 0.3), false, false);
    if (p >= 1) for (let k = 0; k < 4; k++) {
      const u = (t * 0.5 + k / 4) % 1;
      pen(C.gold, 0.45 * (1 - u), 1);
      circleP(...M(-24 - u * 120, -160 - u * 60), (6 + u * 22) * s);
    }
    noGlow();
  }
  /** Canal lock cross-section with rising water and boat. */
  function canalLock(cx, cy, s, p, fill) {
    const M = (x, y) => [cx + x * s, cy + y * s];
    pen(C.bright, 1, 1.8, 8);
    polyP([M(-230, -60), M(-110, -60), M(-110, 60), M(110, 60), M(110, 0), M(230, 0)], st(p, 0, 0.4), false);
    pen(C.gold, 0.9, 1.6);
    lineP(...M(-110, -90), ...M(-110, 60), st(p, 0.3, 0.5), false);
    lineP(...M(110, -90), ...M(110, 60), st(p, 0.35, 0.55), false);
    // Water
    if (p > 0.4) {
      const lvl = lerp(0, -60, fill), a = st(p, 0.4, 0.6);
      ctx.fillStyle = col(C.gold, 0.12 * a);
      ctx.fillRect(...M(-110, lvl), 220 * s, (60 - lvl) * s);
      ctx.fillRect(...M(-230, -60), 120 * s, 50 * s);
      ctx.fillRect(...M(110, 0), 120 * s, 40 * s);
      pen(C.bright, a, 1.4, 6);
      lineP(...M(-108, lvl), ...M(108, lvl), 1, false);
      // Boat floats on the level
      pen(C.bright, a, 1.8, 8);
      polyP([M(-70, lvl - 18), M(-60, lvl + 8), M(60, lvl + 8), M(72, lvl - 18)], 1, true, false);
      rectP(...M(-30, lvl - 40), 50 * s, 22 * s, 1);
      // Rise arrow
      pen(C.gold, 0.6 * a, 1);
      lineP(...M(150, -10), ...M(150, -70), 1, false);
      polyP([M(144, -62), M(150, -72), M(156, -62)], 1, false, false);
    }
    noGlow();
  }

  /** Factory hall with sawtooth roof; aircraft move down the line inside. */
  function factory(cx, gy, s, p, t) {
    const M = (x, y) => [cx + x * s, gy + y * s];
    pen(C.bright, 1, 1.8, 8);
    polyP([M(-700, 0), M(-700, -140), M(700, -140), M(700, 0)], st(p, 0, 0.35), false);
    const teeth = [];
    for (let k = 0; k < 28; k++) { const x = -700 + k * 50; teeth.push(M(x, -140), M(x, -200), M(x + 50, -140)); }
    pen(C.gold, 0.9, 1.4);
    polyP(teeth, st(p, 0.2, 0.6), false, false);
    [-520, -260, 260, 520].forEach((x, i) => polyP([M(x - 14, -140), M(x - 10, -330), M(x + 10, -330), M(x + 14, -140)], st(p, 0.4 + i * 0.05, 0.6 + i * 0.05), false, false));
    pen(C.gold, 0.25, 1);
    for (let x = -680; x < 700; x += 40) lineP(...M(x, -120), ...M(x, -20), st(p, 0.3, 0.7), false);
    if (p > 0.5) for (let k = 0; k < 10; k++) {
      const x = ((t * 140 + k * 150) % 1500) - 750;
      if (x > -690 && x < 690) {
        ctx.save(); ctx.translate(...M(x, -70)); ctx.rotate(Math.PI / 2);
        plane(0, 0, 0.9 * s, st(p, 0.5, 0.8)); ctx.restore();
      }
    }
    noGlow();
  }

  /** Rotating wireframe globe. */
  function globe(cx, cy, r, p, t, shade = true) {
    pen(C.bright, 1, 2, 12);
    circleP(cx, cy, r, p);
    pen(C.gold, 0.5, 1);
    for (let k = 0; k < 6; k++) {
      const ph = ((k / 6) * Math.PI + t * 0.25) % Math.PI;
      ellipseP(cx, cy, Math.abs(Math.cos(ph)) * r, r, 0, 0, TAU, st(p, 0.3, 1));
    }
    for (let k = -2; k <= 2; k++) {
      const yy = cy + (k / 3) * r, xx = Math.sqrt(1 - Math.pow(k / 3, 2)) * r;
      lineP(cx - xx, yy, cx + xx, yy, st(p, 0.3, 1), false);
    }
    if (shade) {
      ctx.fillStyle = col(C.ink, 0.8 * p);
      ctx.beginPath(); ctx.arc(cx, cy, r - 1, Math.PI * 0.5, Math.PI * 1.5);
      ctx.ellipse(cx, cy, r * 0.35, r - 1, 0, -Math.PI * 0.5, Math.PI * 0.5, true); ctx.fill();
    }
    noGlow();
  }

  /** Server racks with blinking status lights. */
  function racks(cx, cy, p, t) {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
      const x = cx - 170 + c * 52 + r * 22, y = cy - 80 + r * 46 - c * 4;
      const q = st(p, (r * 6 + c) / 30, (r * 6 + c) / 30 + 0.3);
      pen(C.gold, 0.9, 1.2);
      rectP(x, y, 40, 90, q);
      if (q >= 1) for (let k = 0; k < 6; k++) {
        const L = RACK_LEDS[(r * 6 + c) * 6 + k];
        dot(x + 10 + (k % 2) * 18, y + 14 + Math.floor(k / 2) * 24, 2.4, C.bright, 0.35 + 0.65 * (Math.sin(t * L.f + L.ph) > 0 ? 1 : 0), 6);
      }
    }
  }
  /** Double helix. */
  function helix(cx, cy, p, t) {
    const pts1 = [], pts2 = [];
    for (let i = 0; i <= 80; i++) {
      const x = cx - 170 + (i / 80) * 340, ph = (i / 80) * TAU * 2 + t * 1.6;
      pts1.push([x, cy + Math.sin(ph) * 60]); pts2.push([x, cy + Math.sin(ph + Math.PI) * 60]);
    }
    pen(C.bright, 1, 1.8, 10); polyP(pts1, p, false); polyP(pts2, p, false);
    pen(C.gold, 0.5, 1);
    for (let i = 0; i <= 80; i += 4) if (i / 80 <= p) lineP(pts1[i][0], pts1[i][1], pts2[i][0], pts2[i][1], 1, false);
    noGlow();
  }
  /** Atom / energy symbol. */
  function atom(cx, cy, p, t) {
    pen(C.bright, 1, 1.6, 10);
    [0, 60, 120].forEach((a, k) => {
      ellipseP(cx, cy, 150, 48, a * D2R, 0, TAU, st(p, k * 0.15, k * 0.15 + 0.6));
      if (p >= 1) {
        const u = t * 1.8 + k * 2;
        const ex = Math.cos(u) * 150, ey = Math.sin(u) * 48, r = a * D2R;
        dot(cx + ex * Math.cos(r) - ey * Math.sin(r), cy + ex * Math.sin(r) + ey * Math.cos(r), 4, C.white, 1, 14);
      }
    });
    dot(cx, cy, 12 * st(p, 0.5, 1), C.bright, 1, 30);
    noGlow();
  }
  /** Lunar module (simplified). Anchor = surface between legs. */
  function lunarModule(cx, gy, s, p) {
    const M = (x, y) => [cx + x * s, gy + y * s];
    pen(C.bright, 1, 1.6, 8);
    polyP([M(-30, -24), M(-22, -44), M(22, -44), M(30, -24), M(22, -14), M(-22, -14)], p, true);
    polyP([M(-20, -44), M(-24, -66), M(-8, -80), M(14, -78), M(24, -60), M(20, -44)], st(p, 0.3, 1), false);
    pen(C.gold, 0.9, 1.2);
    [-1, 1].forEach(sd => { polyP([M(sd * 26, -26), M(sd * 46, 0)], st(p, 0.4, 1), false); lineP(...M(sd * 40, 0), ...M(sd * 52, 0), st(p, 0.6, 1), false); });
    noGlow();
  }

  // ===========================================================================
  //  SCENES  — draw(t, d): t = local time in seconds, d = scene duration
  // ===========================================================================

  function sOpen(t) {
    const cx = 960, cy = 420;
    seal(cx, cy, 280, seg(t, 0.2, 3.2), t, seg(t, 3.0, 5.5));
    torch(cx, cy - 10, 1.05, seg(t, 0.9, 3.6, E.inOut), t, seg(t, 3.0, 4.2, E.out));
    kinetic('LIBERTY', cx, 820, t, 3.7, { size: 150, track: 46, stagger: 0.08, dur: 1.2, glow: 34 });
    kinetic('A NATION CONCEIVED IN LIBERTY.', cx, 912, t, 5.1, { size: 30, track: 12, weight: 500, stagger: 0.025, rgb: C.gold, glow: 10 });
    txt('THE AMERICAN PROJECT · MDCCLXXVI — MMXXVI', cx, 962, { size: 13, track: 6, a: seg(t, 6.0, 7.0) * 0.7 });
  }

  function sFounding(t) {
    // The document, drafted line by line.
    const x0 = 250, y0 = 150, w = 560, h = 780;
    pen(C.gold, 0.9, 1.6, 6);
    rectP(x0, y0, w, h, seg(t, 0, 1.4));
    pen(C.gold, 0.4, 1);
    rectP(x0 + 12, y0 + 12, w - 24, h - 24, seg(t, 0.3, 1.6));
    txt('IN CONGRESS, JULY 4, 1776.', x0 + w / 2, y0 + 58, { size: 15, track: 4, a: seg(t, 0.8, 1.6) });
    txt('The unanimous Declaration', x0 + w / 2, y0 + 108, { size: 40, font: F.serif, italic: true, a: seg(t, 1.0, 1.8), rgb: C.bright });
    txt('of the thirteen united States of America', x0 + w / 2, y0 + 150, { size: 24, font: F.serif, italic: true, a: seg(t, 1.2, 2.0) });
    const r = rng(4);
    pen(C.gold, 0.55, 1.1);
    for (let i = 0; i < 18; i++) {
      const yy = y0 + 205 + i * 24, len = i === 17 ? 0.5 : 0.82 + r() * 0.12;
      const pts = sample(u => [x0 + 40 + u * (w - 80) * len, yy + Math.sin(u * 90 + i) * 2.2 + Math.sin(u * 23 + i * 3) * 1.2], 70);
      polyP(pts, seg(t, 1.4 + i * 0.12, 2.0 + i * 0.12, E.linear), false, i % 3 === 0);
    }
    // Signatures — the great flourish, then columns of smaller hands.
    pen(C.bright, 1, 1.8, 10);
    // Cursive loops (a prolate trochoid) and an underline swash.
    const flourish = sample(u => [x0 + 140 + u * 280 - Math.sin(u * TAU * 4) * 18, y0 + 650 - Math.cos(u * TAU * 4) * 16 + u * 6], 160);
    flourish.push(...sample(u => [x0 + 420 - u * 300, y0 + 686 + Math.sin(u * Math.PI) * 10], 30));
    polyP(flourish, seg(t, 3.6, 4.8, E.linear), false);
    pen(C.gold, 0.5, 1);
    for (let i = 0; i < 8; i++) {
      const sx = x0 + 50 + (i % 4) * 120, sy = y0 + 730 + Math.floor(i / 4) * 26;
      polyP(sample(u => [sx + u * 90, sy + Math.sin(u * 20 + i) * 4], 30), seg(t, 4.2 + i * 0.08, 4.8 + i * 0.08, E.linear), false, false);
    }
    // The truths.
    const X = 1340;
    thirteen(X, 215, 56, 9, seg(t, 0.6, 2.6));
    kinetic('WE HOLD', X, 365, t, 1.8, { size: 90, track: 16, stagger: 0.06, dur: 0.9 });
    kinetic('THESE TRUTHS', X, 470, t, 2.3, { size: 90, track: 16, stagger: 0.05, dur: 0.9 });
    const q = [['to be self-evident, that all men are created equal,', 3.7], ['that they are endowed by their Creator', 4.2], ['with certain unalienable Rights —', 4.7]];
    q.forEach(([s, t0]) => txt(s, X, 590 + (t0 - 3.7) * 92, { size: 32, font: F.serif, italic: true, a: seg(t, t0, t0 + 0.8) }));
    pen(C.gold, 0.6, 1);
    lineP(X - 260, 755, X + 260, 755, seg(t, 5.4, 6.2), false);
    kinetic('LIFE · LIBERTY · THE PURSUIT OF HAPPINESS', X, 800, t, 5.8, { size: 28, track: 6, weight: 600, stagger: 0.02, glow: 14 });
  }

  function sConstitution(t) {
    capitol(740, 900, 0.82, seg(t, 0.1, 5.2, E.inOut));
    dimension(220, 900, 220, 900 - 623 * 0.82, '288 FT', seg(t, 4.0, 5.2));
    kinetic('LIMITED GOVERNMENT.', 960, 175, t, 2.4, { size: 66, track: 12, stagger: 0.03 });
    kinetic('UNLIMITED AMBITION.', 960, 262, t, 4.4, { size: 66, track: 12, stagger: 0.03, rgb: C.white, glow: 30 });
    balances(1530, 600, 165, seg(t, 1.6, 5.4, E.linear), t);
    // Bill of Rights: ten amendments, ticked off
    const rn = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    txt('BILL OF RIGHTS · 1791', 1530, 838, { size: 14, track: 4, a: seg(t, 5.2, 5.8) });
    rn.forEach((n, i) => txt(n, 1530 - 270 + i * 60, 880, { size: 22, font: F.display, weight: 600, rgb: C.bright, a: seg(t, 5.6 + i * 0.12, 6.0 + i * 0.12), glow: 8 }));
    txt('CONSTITUTION SIGNED 1787 · RATIFIED 1788 · FIRST CONGRESS 1789', 740, 945, { size: 13, track: 3, a: seg(t, 3.0, 4.0) * 0.8 });
  }

  // Territorial growth: [year, cumulative square miles, label, lon, lat]
  const ACQ = [
    [1783, 888685, 'TREATY OF PARIS · 1783', -84, 37], [1803, 1715877, 'LOUISIANA PURCHASE · 1803', -99, 42.5],
    [1819, 1787880, 'FLORIDA · 1819', -82.2, 28.6], [1845, 2177046, 'TEXAS · 1845', -99.5, 31.5],
    [1846, 2463587, 'OREGON · 1846', -119.6, 44.8], [1848, 2992776, 'MEXICAN CESSION · 1848', -116.5, 37.5],
    [1853, 3022387, 'GADSDEN · 1853', -110.5, 32.2],
  ];
  function sExpansion(t) {
    const proj = makeProj(960, 590, 26);
    graticule(proj, 0.14, seg(t, 0, 1.2));
    // The frontier meridian sweeps west from the Appalachians to the Pacific.
    const q = seg(t, 0.9, 7.2, E.inOut);
    const frontier = lerp(-89.6, -125.5, q); // 1783: the Mississippi was the western border
    const year = Math.round(lerp(1783, 1853, q));
    ctx.save();
    ctx.beginPath();
    const fpts = sample(u => proj(frontier, lerp(20, 54, u)), 10);
    fpts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    [proj(-60, 54), proj(-60, 20)].forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.closePath(); ctx.clip();
    outlinePath(proj);
    ctx.fillStyle = col(C.gold, 0.1); ctx.fill();
    ctx.clip();
    pen(C.gold, 0.28, 1);
    ctx.beginPath();
    for (let k = 0; k < 2400; k += 11) { ctx.moveTo(k - 600, 1000); ctx.lineTo(k, 100); }
    ctx.stroke();
    ctx.restore();
    // Outline over the fill
    pen(C.bright, 1, 2, 10);
    polyP(US_OUTLINE.map(([a, b]) => proj(a, b)), seg(t, 0, 1.6), false, false);
    noGlow();
    // The frontier line itself
    if (q > 0 && q < 1) { pen(C.white, 0.8, 1.6, 18); polyP(sample(u => proj(frontier, lerp(24, 50, u)), 10), 1, false, false); noGlow(); }
    // Lewis & Clark, 1804–1806
    const lc = seg(t, 2.2, 5.6, E.linear);
    pen(C.red, 1, 2.2, 10);
    ctx.setLineDash([7, 6]);
    const tip = polyP(LEWIS_CLARK.map(([a, b]) => proj(a, b)), lc, false, false);
    ctx.setLineDash([]);
    if (lc > 0 && lc < 1 && tip) dot(tip[0], tip[1], 5, C.red, 1, 16);
    const stl = proj(-90.2, 38.6), fc = proj(-123.9, 46.1);
    annot('ST. LOUIS · 1804', ...stl, stl[0] - 60, stl[1] + 110, seg(t, 2.0, 2.6), 'right');
    annot('FORT CLATSOP · 1805', ...fc, fc[0] + 10, fc[1] - 80, seg(t, 5.4, 6.0), 'left');
    txt('LEWIS & CLARK', proj(-104, 48.6)[0], proj(-104, 48.6)[1] - 20, { size: 13, track: 3, rgb: C.red, a: seg(t, 3.0, 3.6) });
    // Acquisitions light up as the frontier passes.
    let area = ACQ[0][1];
    ACQ.forEach(([y, a, label, lo, la], i) => {
      if (year >= y) area = a;
      const [x, yy] = proj(lo, la);
      const k = seg(t, 1.0 + i * 0.9, 1.6 + i * 0.9);
      if (year >= y) { dot(x, yy, 3, C.bright, k); txt(label, x, yy + 16, { size: 12, track: 1.5, a: k, rgb: C.bright }); }
    });
    // Ledger, lower left
    txt(String(year), 260, 880, { size: 62, font: F.display, weight: 600, align: 'left', rgb: C.bright, a: seg(t, 0.6, 1.2), glow: 12 });
    txt(`${fmt(area)} SQ. MI.`, 262, 930, { size: 18, align: 'left', track: 3, a: seg(t, 0.8, 1.4) });
    kinetic('WE CROSSED A CONTINENT.', 960, 170, t, 4.6, { size: 64, track: 12, stagger: 0.03 });
  }

  function sInfrastructure(t) {
    const plates = [
      ['ERIE CANAL · 1825', '363 MILES · LAKE ERIE TO THE HUDSON', (x, y, p) => canalLock(x, y + 20, 1.05, p, seg(t, 2.0, 5.5))],
      ['CLERMONT · 1807', 'STEAM UP THE HUDSON', (x, y, p) => steamboat(x, y + 80, 1.15, p, t)],
      ['B & O RAILROAD · 1830', 'IRON ROADS WEST', (x, y, p) => locomotive(x, y + 110, 1.2, p, t)],
    ];
    plates.forEach(([title, sub, draw], i) => {
      const cx = 360 + i * 600, cy = 500, t0 = 0.2 + i * 0.5;
      const p = seg(t, t0, t0 + 3.0, E.inOut);
      pen(C.gold, 0.8, 1.2);
      rectP(cx - 270, cy - 230, 540, 440, seg(t, t0, t0 + 1));
      pen(C.gold, 0.3, 1);
      lineP(cx - 270, cy - 190, cx + 270, cy - 190, seg(t, t0 + 0.4, t0 + 1.2), false);
      lineP(cx - 270, cy + 170, cx + 270, cy + 170, seg(t, t0 + 0.4, t0 + 1.2), false);
      txt(title, cx, cy - 210, { size: 16, track: 4, rgb: C.bright, a: seg(t, t0 + 0.5, t0 + 1.2) });
      txt(sub, cx, cy + 190, { size: 13, track: 2, a: seg(t, t0 + 1.0, t0 + 1.8) * 0.85 });
      txt(`FIG. ${['A', 'B', 'C'][i]}`, cx + 255, cy - 210, { size: 11, align: 'right', a: seg(t, t0 + 0.5, t0 + 1.2) * 0.6 });
      draw(cx, cy, p);
    });
    kinetic('WE BUILT THE ROADS.', 960, 860, t, 4.0, { size: 70, track: 14, stagger: 0.035 });
    txt('CANALS · STEAMBOATS · RAILROADS · TELEGRAPH', 960, 935, { size: 15, track: 6, a: seg(t, 5.0, 6.0) * 0.8 });
  }

  function sIndustry(t) {
    bridge(960, 600, 1.0, seg(t, 0.1, 5.6, E.inOut), t);
    dimension(660, 790, 1260, 790, '1,595 FT · LONGEST SPAN ON EARTH, 1883', seg(t, 4.6, 5.8));
    // Steel output chart, upper right
    const c = chart({
      x: 1440, y: 150, w: 320, h: 150, p: seg(t, 1.2, 6.0, E.inOut),
      data: [[1870, 0.07], [1875, 0.4], [1880, 1.25], [1885, 1.7], [1890, 4.3], [1895, 6.1], [1900, 10.2], [1905, 20.0], [1910, 26.1]],
      xr: [1870, 1910], yr: [0, 28], xticks: [[1870, '1870'], [1890, '1890'], [1910, '1910']], yticks: [[0, '0'], [25, '25M']],
      title: 'U.S. STEEL OUTPUT · TONS',
    });
    txt(`${c.val.toFixed(1)}M`, c.tip[0] - 10, c.tip[1] - 22, { size: 15, align: 'right', rgb: C.bright, a: seg(t, 1.6, 2.2) });
    [['1869', 'TRANSCONTINENTAL RAILROAD'], ['1876', 'TELEPHONE'], ['1879', 'INCANDESCENT LAMP'], ['1883', 'BROOKLYN BRIDGE']]
      .forEach(([y, l], i) => {
        const a = seg(t, 0.8 + i * 0.45, 1.4 + i * 0.45);
        txt(y, 160, 160 + i * 30, { size: 15, align: 'left', rgb: C.bright, a });
        txt(l, 220, 160 + i * 30, { size: 15, align: 'left', track: 2, a: a * 0.85 });
      });
    kineticWords(['STEEL.', 'RAIL.', 'LIGHT.'], 960, 890, t, [3.6, 4.1, 4.6],
      { size: 70, track: 14, gap: 56, styles: [{}, {}, { rgb: C.white, glow: 34 }] });
  }

  function sFlight(t) {
    // Dune horizon and launching rail.
    pen(C.gold, 0.5, 1.2);
    polyP(sample(u => [lerp(80, 1840, u), 820 - Math.sin(u * 3.2) * 40 - Math.sin(u * 11) * 6], 80), seg(t, 0, 1.2), false, false);
    const fly = seg(t, 3.0, 7.0, E.in);
    const fx = 640 + fly * 900, fy = 640 - Math.pow(fly, 1.6) * 340;
    // 60-ft launching rail, in the same projection as the airframe
    const RP = flyerProj(640, 640, 1.2);
    pen(C.gold, 0.7, 1.4);
    lineP(...RP(0, -64, -320), ...RP(0, -64, 420), seg(t, 0.2, 1.0), false);
    for (let z = -300; z < 420; z += 30) lineP(...RP(-14, -64, z), ...RP(14, -64, z), seg(t, 0.4, 1.2), false);
    // Streamlines while airborne
    if (t > 3) {
      const a = seg(t, 3.0, 4.0);
      pen(C.gold, 0.18 * a, 1);
      for (let k = 0; k < 12; k++) {
        const y = 260 + k * 38, off = ((t * 520 + k * 211) % 2200);
        lineP(1900 - off, y, 2100 - off, y, 1, false);
      }
    }
    // Trajectory
    if (fly > 0) {
      pen(C.bright, 0.55, 1.4);
      ctx.setLineDash([6, 8]);
      polyP(sample(u => [640 + u * fly * 900, 640 - Math.pow(u * fly, 1.6) * 340 + 70], 40), 1, false, false);
      ctx.setLineDash([]);
    }
    flyer(fx, fy, 1.2, seg(t, 0.2, 3.0, E.inOut), t);
    const wt = flyerProj(fx, fy, 1.2)(200, 45, 0);
    annot('40 FT 4 IN WINGSPAN · 605 LB', wt[0], wt[1], wt[0] + 90, wt[1] - 90, seg(t, 1.6, 2.4) * (1 - seg(t, 3.0, 3.4)));
    kinetic('WE TOOK TO THE AIR.', 960, 175, t, 3.4, { size: 70, track: 14, stagger: 0.035 });
    txt('DECEMBER 17, 1903 · KILL DEVIL HILLS, NORTH CAROLINA', 160, 880, { size: 15, align: 'left', track: 3, a: seg(t, 0.8, 1.6) });
    txt('12 SECONDS · 120 FEET · THE FIRST POWERED, CONTROLLED FLIGHT', 160, 910, { size: 15, align: 'left', track: 3, rgb: C.bright, a: seg(t, 4.4, 5.2) });
  }

  function sAbundance(t) {
    // Conveyor
    pen(C.gold, 0.9, 1.6);
    lineP(100, 760, 1820, 760, seg(t, 0, 0.8), false);
    lineP(100, 784, 1820, 784, seg(t, 0.1, 0.9), false);
    pen(C.gold, 0.5, 1);
    for (let x = 120; x < 1820; x += 40) {
      circleP(x, 772, 9, seg(t, 0.2, 1.0));
      const a = t * 4 + x;
      lineP(x, 772, x + Math.cos(a) * 9, 772 + Math.sin(a) * 9, seg(t, 0.4, 1.0), false);
    }
    // Stations
    const ST = [['FRAME', 330], ['AXLES', 700], ['BODY', 1070], ['TOP', 1440]];
    ST.forEach(([l, x], i) => {
      const a = seg(t, 0.4 + i * 0.15, 1.0 + i * 0.15);
      pen(C.gold, 0.45 * a, 1);
      lineP(x, 420, x, 560, 1, false);
      polyP([[x - 30, 560], [x + 30, 560], [x + 20, 580], [x - 20, 580]], a, true, false);
      txt(`STATION ${i + 1} · ${l}`, x, 400, { size: 13, track: 2, a });
    });
    // Cars advance; each gains parts as it passes each station.
    for (let i = 0; i < 7; i++) {
      const x = ((t * 140 + i * 300) % 2100) - 120;
      const stage = clamp((x - 200) / 370, 0, 4) + (x > 1500 ? 1 : 0);
      modelT(x, 756, 1.15, Math.min(stage, 4), x / 34);
    }
    kinetic('ABUNDANCE.', 960, 220, t, 1.6, { size: 128, track: 34, stagger: 0.06, dur: 1.0, glow: 30 });
    // Ledger
    const k = seg(t, 2.6, 5.6);
    txt('CHASSIS ASSEMBLY', 300, 870, { size: 14, align: 'left', track: 3, a: seg(t, 2.4, 3.0) });
    txt(`${fmt(lerp(750, 93, k))} MIN`, 300, 910, { size: 32, font: F.display, weight: 600, align: 'left', rgb: C.bright, a: seg(t, 2.4, 3.0), glow: 10 });
    txt('MODEL T PRICE', 960, 870, { size: 14, track: 3, a: seg(t, 2.8, 3.4) });
    txt(`$${fmt(lerp(850, 260, k))}`, 960, 910, { size: 32, font: F.display, weight: 600, rgb: C.bright, a: seg(t, 2.8, 3.4), glow: 10 });
    txt('BUILT 1908–1927', 1620, 870, { size: 14, align: 'right', track: 3, a: seg(t, 3.2, 3.8) });
    txt(`${fmt(lerp(0, 15000000, k))}`, 1620, 910, { size: 32, font: F.display, weight: 600, align: 'right', rgb: C.bright, a: seg(t, 3.2, 3.8), glow: 10 });
  }

  function sArsenal(t) {
    // Three hard-cut shots; a brief flash marks each cut.
    const shot = t < 2.6 ? 0 : t < 5.2 ? 1 : 2;
    const ls = t - [0, 2.6, 5.2][shot];
    if (shot === 0) {
      factory(960, 760, 1.0, seg(ls, 0, 1.8), t);
      txt('WILLOW RUN · ONE B-24 BOMBER OFF THE LINE EVERY HOUR', 960, 830, { size: 15, track: 3, a: seg(ls, 1.0, 1.6) });
    } else if (shot === 1) {
      const n = Math.floor(seg(ls, 0, 2.2, E.inOut) * 216);
      for (let i = 0; i < 216; i++) {
        if (i >= n) break;
        const c = i % 24, r = Math.floor(i / 24);
        plane(390 + c * 50, 340 + r * 52, 0.5, i > n - 12 ? 1 : 0.6);
      }
      txt(fmt(seg(ls, 0, 2.2, E.inOut) * 296000), 960, 850, { size: 64, font: F.display, weight: 700, rgb: C.red, glow: 16 });
      txt('MILITARY AIRCRAFT · 1940–1945', 960, 905, { size: 15, track: 4 });
    } else {
      libertyShip(960, 560, 1.15, seg(ls, 0, 1.5));
      const n = Math.floor(seg(ls, 0.8, 2.6, E.inOut) * 30);
      for (let i = 0; i < n; i++) libertyShip(330 + (i % 15) * 90, 680 + Math.floor(i / 15) * 50, 0.13, 1, 0.8);
      txt(fmt(seg(ls, 0.6, 2.4, E.inOut) * 2710), 960, 850, { size: 64, font: F.display, weight: 700, rgb: C.red, glow: 16 });
      txt('LIBERTY SHIPS · ONE LAUNCHED IN UNDER FIVE DAYS', 960, 905, { size: 15, track: 4 });
    }
    // Cut flash
    const fl = Math.max(0, 1 - Math.abs(t - 2.6) / 0.12) + Math.max(0, 1 - Math.abs(t - 5.2) / 0.12);
    if (fl > 0) { ctx.fillStyle = col(C.white, 0.18 * fl); ctx.fillRect(0, 0, W, H); }
    kinetic('WE BUILT THE ARSENAL.', 960, 175, t, 0.4, { size: 70, track: 14, stagger: 0.03 });
    txt('THE ARSENAL OF DEMOCRACY · 1941 — 1945', 960, 245, { size: 15, track: 6, rgb: C.red, a: seg(t, 1.2, 2.0) });
  }

  function sProsperity(t) {
    const proj = makeProj(780, 610, 21);
    graticule(proj, 0.1, seg(t, 0, 1));
    pen(C.gold, 0.8, 1.4, 6);
    polyP(US_OUTLINE.map(([a, b]) => proj(a, b)), seg(t, 0, 1.2), false, false);
    noGlow();
    INTERSTATES.forEach((route, i) => {
      const q = seg(t, 0.8 + i * 0.22, 2.6 + i * 0.22, E.inOut);
      pen(C.bright, 1, 2.2, 10);
      polyP(route.map(([a, b]) => proj(a, b)), q, false);
    });
    Object.values(CITY).forEach(([a, b], i) => { const [x, y] = proj(a, b); dot(x, y, 2.6, C.bright, seg(t, 2 + (i % 10) * 0.15, 3 + (i % 10) * 0.15)); });
    const mi = seg(t, 0.8, 5.6, E.inOut);
    txt(fmt(mi * 41000), 1590, 330, { size: 58, font: F.display, weight: 600, rgb: C.bright, glow: 12, a: seg(t, 0.8, 1.4) });
    txt('MILES OF INTERSTATE · AUTHORIZED 1956', 1590, 380, { size: 13, track: 2, a: seg(t, 1.0, 1.6) });
    const c = chart({
      x: 1440, y: 500, w: 320, h: 190, p: seg(t, 2.0, 6.5, E.inOut),
      data: [[1947, 30], [1950, 31], [1955, 36.5], [1960, 41], [1965, 47], [1970, 55], [1973, 58]],
      xr: [1947, 1973], yr: [20, 60], xticks: [[1947, '1947'], [1960, '1960'], [1973, '1973']], yticks: [[20, ''], [40, ''], [60, '']],
      title: 'REAL MEDIAN FAMILY INCOME',
    });
    txt(`×${(c.val / 30).toFixed(2)}`, c.tip[0] - 12, c.tip[1] - 22, { size: 16, align: 'right', rgb: C.bright, a: seg(t, 2.6, 3.0) });
    txt('LIFE EXPECTANCY 65.9 → 70.8 · 1945–1970', 1600, 760, { size: 13, track: 1.5, a: seg(t, 4.6, 5.4) });
    kinetic('PROSPERITY, AT SCALE.', 960, 175, t, 3.4, { size: 66, track: 12, stagger: 0.03 });
  }

  function sApollo(t) {
    if (t < 6.4) {
      // Launch umbilical tower
      pen(C.gold, 0.6, 1.2);
      const tx = 760, by = 920;
      lineP(tx, by, tx, by - 620, seg(t, 0, 1.2), false); lineP(tx - 40, by, tx - 40, by - 620, seg(t, 0, 1.2), false);
      pen(C.gold, 0.3, 1);
      for (let k = 0; k < 15; k++) { lineP(tx - 40, by - k * 41, tx, by - (k + 1) * 41, seg(t, 0.3 + k * 0.04, 0.8 + k * 0.04), false); }
      pen(C.gold, 0.8, 1.4);
      lineP(600, by, 1320, by, seg(t, 0, 0.8), false);
      // Rocket: assemble, then lift.
      const lift = seg(t, 4.2, 6.4, E.in);
      const ry = by - lift * 1300;
      // Exhaust plume and ground cloud
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, W, by); ctx.clip();
      if (t > 3.9) {
        const ig = seg(t, 3.9, 4.3);
        for (let k = 0; k < 16; k++) {
          const x = 960 + (k - 7.5) * 4.2;
          const len = (120 + 260 * ig) * (0.75 + 0.25 * Math.sin(t * 50 + k * 1.7));
          pen(k % 3 ? C.bright : C.white, 0.9 * ig, 1.5, 18);
          lineP(x, ry, 960 + (x - 960) * 3, ry + len, 1, false);
        }
        for (let k = 0; k < 10; k++) {
          const u = seg(t, 4.0 + k * 0.05, 6.4);
          pen(C.gold, 0.5 * (1 - u * 0.6), 1);
          circleP(960 + (k - 4.5) * 34 * (0.4 + u), by - 10 - u * 30 - (k % 3) * 12, 14 + u * (40 + (k % 4) * 12));
        }
      }
      ctx.restore();
      saturnV(960, ry, 0.95, seg(t, 0.1, 3.6, E.inOut), seg(t, 1.5, 3.8) * (1 - seg(t, 4.0, 4.4)));
      txt(t < 4.2 ? `T−${Math.max(0, 4.2 - t).toFixed(1)}` : 'LIFTOFF', 1660, 800, { size: 30, font: F.display, weight: 600, align: 'right', rgb: C.bright, a: seg(t, 2.6, 3.0), glow: 10 });
      txt('KENNEDY SPACE CENTER · JULY 16, 1969 · 09:32 EDT', 1660, 845, { size: 13, align: 'right', track: 2, a: seg(t, 2.8, 3.4) });
    } else {
      const u = t - 6.4;
      // Earthrise over the lunar horizon.
      const mx = 960, my = 2500, mr = 1640;
      const ex = 1230, ey = lerp(1000, 560, seg(u, 0, 3.4, E.out));
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(mx, my, mr, 0, TAU, true); ctx.clip('evenodd');
      globe(ex, ey, 120, 1, t);
      ctx.restore();
      ctx.fillStyle = col(C.ink, 0.88 * seg(u, 0, 1.0));
      ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
      pen(C.bright, 1, 2.2, 12);
      arcP(mx, my, mr, Math.PI * 1.25, Math.PI * 1.75, seg(u, 0, 1.0));
      noGlow();
      const r = rng(11);
      pen(C.gold, 0.4, 1);
      for (let k = 0; k < 16; k++) {
        const x = 160 + r() * 1600, depth = r();
        const yy = my - Math.sqrt(mr * mr - Math.pow(x - mx, 2)) + 20 + depth * 120;
        if (yy < 950) ellipseP(x, yy, 18 + r() * 50, (6 + r() * 14) * (0.4 + depth), 0, 0, TAU, seg(u, 0.2 + k * 0.03, 1.2 + k * 0.03));
      }
      const lmy = my - Math.sqrt(mr * mr - Math.pow(620 - mx, 2)) + 40;
      lunarModule(620, lmy, 1.3, seg(u, 0.6, 2.0));
      annot('EAGLE · TRANQUILITY BASE', 620, lmy - 110, 470, lmy - 200, seg(u, 1.6, 2.2), 'right');
      kinetic('WE LEFT THE EARTH.', 960, 175, u, 0.4, { size: 70, track: 14, stagger: 0.035 });
      txt('JULY 20, 1969 · 20:17 UTC', 960, 245, { size: 15, track: 6, a: seg(u, 1.2, 2.0) });
    }
  }

  function sSilicon(t) {
    chip(540, 560, 480, seg(t, 0.1, 4.0, E.inOut), t);
    const c = chart({
      x: 1050, y: 330, w: 700, h: 420, p: seg(t, 1.4, 7.0, E.inOut), log: true,
      data: [[1971, 2300], [1978, 29000], [1985, 275000], [1993, 3.1e6], [2000, 4.2e7], [2006, 2.9e8], [2012, 1.4e9], [2017, 1.9e10], [2022, 1.14e11], [2024, 2.08e11]],
      xr: [1970, 2026], yr: [1e3, 1e12],
      xticks: [[1971, '1971'], [1985, '1985'], [2000, '2000'], [2024, '2024']],
      yticks: [[1e3, '10³'], [1e6, '10⁶'], [1e9, '10⁹'], [1e12, '10¹²']],
      title: 'TRANSISTORS PER CHIP · LOG SCALE',
    });
    txt(fmt(c.val), 1750, 830, { size: 50, font: F.display, weight: 600, align: 'right', rgb: C.bright, glow: 12, a: seg(t, 1.6, 2.2) });
    txt(`TRANSISTORS · ${Math.round(c.xval)}`, 1750, 878, { size: 14, align: 'right', track: 3, a: seg(t, 1.6, 2.2) });
    annot('INTEL 4004 · 1971', c.X(1971), c.Y(2300), c.X(1971) + 40, c.Y(2300) - 50, seg(t, 2.0, 2.6));
    txt('1947 TRANSISTOR · 1958 INTEGRATED CIRCUIT · 1971 MICROPROCESSOR · 1991 WORLD WIDE WEB', 540, 880, { size: 12, track: 1, a: seg(t, 3.2, 4.0) * 0.8 });
    kinetic('WE TAUGHT SAND TO THINK.', 960, 175, t, 3.8, { size: 66, track: 12, stagger: 0.03 });
  }

  function sModern(t) {
    if (t < 5.6) {
      const a = 1 - seg(t, 5.1, 5.6, E.linear);
      ctx.save(); ctx.globalAlpha *= a;
      const descend = seg(t, 0.3, 4.0, E.out);
      const by = 940, restTop = -490;
      const boosterY = lerp(-1300, restTop, descend);
      const close = seg(t, 3.6, 4.4, E.inOut);
      catchTower(1180, by, 1.0, seg(t, 0, 2.0, E.inOut), boosterY, close, 1 - seg(t, 3.4, 4.0), t);
      const v = Math.max(0, (1 - descend)) * 1250;
      txt(`${fmt(v)} KM/H`, 360, 640, { size: 46, font: F.display, weight: 600, align: 'left', rgb: C.bright, glow: 12, a: seg(t, 0.6, 1.2) });
      txt('DESCENT VELOCITY', 362, 690, { size: 14, align: 'left', track: 3, a: seg(t, 0.6, 1.2) });
      txt('OCTOBER 13, 2024 · STARBASE, TEXAS', 362, 740, { size: 14, align: 'left', track: 3, a: seg(t, 1.0, 1.6) * 0.85 });
      txt('A 71-METRE BOOSTER, CAUGHT BY ITS OWN LAUNCH TOWER', 362, 768, { size: 14, align: 'left', track: 1.5, a: seg(t, 4.2, 4.8), rgb: C.bright });
      kinetic('WE CAUGHT THE ROCKET.', 960, 175, t, 4.1, { size: 70, track: 14, stagger: 0.035 });
      ctx.restore();
    }
    if (t >= 5.3) {
      const u = t - 5.3;
      const a = seg(u, 0, 0.4, E.linear);
      ctx.save(); ctx.globalAlpha *= a;
      [['COMPUTE', 'AI DATA CENTERS', (x, y, p) => racks(x, y, p, t)], ['LIFE', 'GENOMES READ & WRITTEN', (x, y, p) => helix(x, y, p, t)], ['ENERGY', 'FISSION · FUSION · SOLAR', (x, y, p) => atom(x, y, p, t)]]
        .forEach(([title, sub, draw], i) => {
          const cx = 360 + i * 600, cy = 540, t0 = i * 0.25;
          pen(C.gold, 0.7, 1.2);
          rectP(cx - 260, cy - 200, 520, 400, seg(u, t0, t0 + 0.8));
          txt(title, cx, cy - 240, { size: 26, font: F.display, weight: 600, track: 10, rgb: C.bright, a: seg(u, t0 + 0.2, t0 + 0.8), glow: 10 });
          txt(sub, cx, cy + 235, { size: 13, track: 3, a: seg(u, t0 + 0.6, t0 + 1.2) });
          draw(cx, cy, seg(u, t0 + 0.2, t0 + 1.8, E.inOut));
        });
      kinetic('THE TOOLS OF ABUNDANCE.', 960, 880, u, 0.9, { size: 52, track: 10, stagger: 0.025 });
      ctx.restore();
    }
  }

  function sFrontier(t) {
    // Heliocentric: Earth → Mars transfer.
    const sx = 560, sy = 560;
    dot(sx, sy, 16 * seg(t, 0, 0.8), C.bright, 1, 40);
    pen(C.gold, 0.5, 1);
    circleP(sx, sy, 200, seg(t, 0, 1.2));
    circleP(sx, sy, 330, seg(t, 0.2, 1.4));
    const r = rng(8);
    for (let k = 0; k < 140; k++) {
      const a = r() * TAU + t * 0.02, rr = 380 + r() * 50;
      dot(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr * 1.0, 1.1, C.gold, 0.5 * seg(t, 0.6, 1.6));
    }
    const ea = -Math.PI * 0.85 + t * 0.12, ma = ea + Math.PI * 0.75;
    const E1 = [sx + Math.cos(ea) * 200, sy + Math.sin(ea) * 200];
    globe(E1[0], E1[1], 26, seg(t, 0.4, 1.4), t, false);
    pen(C.gold, 0.6, 1); circleP(E1[0], E1[1], 44, seg(t, 0.8, 1.6));
    dot(E1[0] + Math.cos(t * 1.5) * 44, E1[1] + Math.sin(t * 1.5) * 44, 3.5, C.white, seg(t, 0.8, 1.6));
    const M1 = [sx + Math.cos(ma) * 330, sy + Math.sin(ma) * 330];
    pen(C.red, 1, 1.8, 12); circleP(M1[0], M1[1], 18, seg(t, 0.6, 1.4)); noGlow();
    txt('EARTH', E1[0], E1[1] + 54, { size: 12, track: 3, a: seg(t, 1, 1.6) });
    txt('MARS', M1[0], M1[1] + 36, { size: 12, track: 3, rgb: C.red, a: seg(t, 1, 1.6) });
    // Transfer ellipse from Earth's position to Mars' (fixed at launch geometry).
    const a0 = -Math.PI * 0.85 + 1.6 * 0.12, A = (200 + 330) / 2, ecc = (330 - 200) / (330 + 200);
    const ell = th => { const rr = (A * (1 - ecc * ecc)) / (1 + ecc * Math.cos(th)); return [sx + Math.cos(a0 + th) * rr, sy + Math.sin(a0 + th) * rr]; };
    pen(C.bright, 0.9, 1.6, 8);
    ctx.setLineDash([6, 7]);
    const tr = seg(t, 1.6, 6.0, E.inOut);
    const tip = polyP(sample(u => ell(u * Math.PI), 60), tr, false, false);
    ctx.setLineDash([]);
    if (tip && tr > 0) dot(tip[0], tip[1], 5, C.white, 1, 18);
    txt('TRANSFER ORBIT · ~259 DAYS', sx, sy + 44, { size: 13, track: 3, a: seg(t, 2.0, 2.8) });
    // Neural lattice: AI-augmented discovery, faint behind the chart.
    const na = seg(t, 5.8, 7.0);
    if (na > 0) {
      pen(C.gold, 0.18 * na, 1);
      NEURAL.forEach((n, i) => NEURAL.forEach((m, j) => {
        if (j <= i) return;
        const d = Math.hypot(n.x - m.x, (n.y - m.y) * 0.6);
        if (d < 0.18) lineP(1040 + n.x * 740, 300 + n.y * 480, 1040 + m.x * 740, 300 + m.y * 480, 1, false);
      }));
      NEURAL.forEach(n => dot(1040 + n.x * 740, 300 + n.y * 480, 2.6, C.bright, na * (0.5 + 0.5 * Math.sin(t * 3 + n.ph)), 8));
    }
    // Energy chart: history solid, ambition dashed.
    const c = chart({
      x: 1080, y: 330, w: 660, h: 400, p: seg(t, 0.8, 7.4, E.inOut), dashFrom: 2025,
      data: [[1950, 330], [1960, 750], [1970, 1530], [1980, 2290], [1990, 3040], [2000, 3800], [2010, 4120], [2020, 4010], [2025, 4400],
        [2035, 6500], [2045, 9500], [2055, 13500], [2065, 18500], [2076, 25000]],
      xr: [1950, 2076], yr: [0, 26000], xticks: [[1950, '1950'], [2000, '2000'], [2025, 'NOW'], [2076, '2076']],
      yticks: [[0, '0'], [10000, '10k'], [20000, '20k']], title: 'U.S. ELECTRICITY · TWh / YEAR · HISTORY & AMBITION',
    });
    const K = (Math.log10(lerp(1.9e13, 1e14, seg(t, 4.6, 7.6, E.inOut))) - 6) / 10;
    txt(`K = ${K.toFixed(3)}`, 1740, 800, { size: 40, font: F.display, weight: 600, align: 'right', rgb: C.bright, glow: 12, a: seg(t, 2.0, 2.6) });
    txt('CIVILIZATION ON THE KARDASHEV SCALE', 1740, 845, { size: 13, align: 'right', track: 2, a: seg(t, 2.0, 2.6) });
    if (c.xval > 2025) txt('PROJECTED', c.X(2050), c.Y(11500) - 26, { size: 12, track: 3, a: 0.8 });
    kinetic('ABUNDANT ENERGY.', 960, 175, t, 0.8, { size: 66, track: 12, stagger: 0.03, out: 3.5 });
    kinetic('NEW WORLDS.', 960, 175, t, 4.0, { size: 66, track: 12, stagger: 0.03, out: 5.9 });
    kinetic('MINDS, AUGMENTED.', 960, 175, t, 6.4, { size: 66, track: 12, stagger: 0.03 });
  }

  // Montage: strongest symbols in reverse, timeline rewinding to 1776.
  const MONTAGE = [
    ['2024', (p, t) => catchTower(1080, 860, 0.85, p, -490, 1, 0, t)],
    ['1971', (p, t) => chip(960, 500, 420, p, t)],
    ['1969', (p) => saturnV(960, 880, 0.9, p)],
    ['1903', (p, t) => flyer(960, 500, 1.3, p, t)],
    ['1883', (p, t) => bridge(960, 560, 0.9, p, t)],
    ['1800', (p) => capitol(960, 820, 0.8, p)],
  ];
  const MONTAGE_EACH = 1.05;
  function sRewind(t) {
    const each = MONTAGE_EACH;
    const i = Math.floor(t / each);
    if (i < MONTAGE.length) {
      const [year, draw] = MONTAGE[i];
      const lt = t - i * each;
      const a = seg(lt, 0, 0.12, E.linear) * (1 - seg(lt, each - 0.1, each, E.linear));
      ctx.save(); ctx.globalAlpha *= a;
      draw(seg(lt, 0, 0.6, E.out), t);
      txt(year, 960, 960, { size: 40, font: F.display, weight: 600, rgb: C.bright, glow: 14 });
      ctx.restore();
      const fl = Math.max(0, 1 - lt / 0.1);
      if (fl > 0) { ctx.fillStyle = col(C.white, 0.12 * fl); ctx.fillRect(0, 0, W, H); }
    } else {
      const lt = t - MONTAGE.length * each;
      thirteen(960, 470, 270, 22, seg(lt, 0, 1.2, E.out));
      kinetic('250 YEARS.', 960, 470, lt, 0.4, { size: 92, track: 22, stagger: 0.06, dur: 0.9, glow: 30 });
      txt('1776 — 2026', 960, 800, { size: 22, track: 12, a: seg(lt, 1.0, 1.6) });
    }
  }

  function sFinal(t) {
    const cx = 960, cy = 450;
    seal(cx, cy, 250, seg(t, 0, 1.6), t, seg(t, 0.4, 2.4) * 1.3);
    torch(cx, cy - 6, 0.94, seg(t, 0, 1.4), t, seg(t, 0.8, 1.6, E.out) * (1 + 0.25 * seg(t, 2.0, 4.0)));
    kinetic(FINAL_WORD, cx, 830, t, 2.0, { size: 140, track: 40, stagger: 0.09, dur: 1.1, rgb: C.white, glow: 40 });
    txt('THE BEST IS STILL AHEAD.', cx, 920, { size: 22, track: 12, a: seg(t, 3.6, 4.6) });
  }

  // ===========================================================================
  //  MASTER TIMELINE — edit durations here; everything downstream re-flows.
  // ===========================================================================
  const SCENES = [
    { id: 'open',         chapter: null,                                dur: 8,  years: [1776, 1776], fadeIn: 0.6, fadeOut: 0.45, draw: sOpen },
    { id: 'founding',     chapter: ['I', 'FOUNDING'],                   dur: 9,  years: [1776, 1776], draw: sFounding },
    { id: 'constitution', chapter: ['II', 'CONSTITUTION'],              dur: 9,  years: [1787, 1791], draw: sConstitution },
    { id: 'expansion',    chapter: ['III', 'EXPANSION'],                dur: 9,  years: [1791, 1853], draw: sExpansion,
      yearFn: t => Math.max(1791, lerp(1783, 1853, seg(t, 0.9, 7.2))) },
    { id: 'infra',        chapter: ['IV', 'INFRASTRUCTURE'],            dur: 8,  years: [1825, 1860], draw: sInfrastructure },
    { id: 'industry',     chapter: ['V', 'INDUSTRY'],                   dur: 9,  years: [1869, 1900], draw: sIndustry },
    { id: 'flight',       chapter: ['VI', 'FLIGHT'],                    dur: 7,  years: [1903, 1903], draw: sFlight },
    { id: 'abundance',    chapter: ['VII', 'ABUNDANCE'],                dur: 7,  years: [1908, 1927], draw: sAbundance },
    { id: 'arsenal',      chapter: ['VIII', 'ARSENAL'],                 dur: 8,  years: [1941, 1945], draw: sArsenal, accent: 'red' },
    { id: 'prosperity',   chapter: ['IX', 'PROSPERITY'],                dur: 8,  years: [1950, 1970], draw: sProsperity },
    { id: 'cosmos',       chapter: ['X', 'COSMOS'],                     dur: 10, years: [1969, 1969], draw: sApollo },
    { id: 'silicon',      chapter: ['XI', 'SILICON'],                   dur: 9,  years: [1971, 2000], draw: sSilicon },
    { id: 'innovation',   chapter: ['XII', 'ACCELERATED INNOVATION'],   dur: 9,  years: [2010, 2026], draw: sModern },
    { id: 'frontier',     chapter: ['XIII', 'FRONTIER'],                dur: 9,  years: [2026, 2076], draw: sFrontier },
    { id: 'memory',       chapter: ['XIV', 'TWO HUNDRED FIFTY YEARS'],  dur: 9,  years: [2076, 1776], draw: sRewind, fadeIn: 0.2,
      yearFn: t => { // snap to each montage symbol's year
        const ys = [2076, ...MONTAGE.map(m => +m[0]), 1776];
        const i = Math.min(ys.length - 2, Math.floor(t / MONTAGE_EACH));
        return lerp(ys[i], ys[i + 1], seg(t - i * MONTAGE_EACH, 0, 0.35));
      } },
    { id: 'final',        chapter: null,                                dur: 7,  years: [1776, 2076], fadeIn: 0.3, fadeOut: 1.2, draw: sFinal },
  ];
  let acc = 0;
  SCENES.forEach(s => { s.start = acc; acc += s.dur; });
  const DURATION = acc; // 135 s

  const sceneAt = T => SCENES.find(s => T >= s.start && T < s.start + s.dur) || SCENES[SCENES.length - 1];
  function yearAt(T) {
    const s = sceneAt(T), u = clamp((T - s.start) / s.dur);
    if (s.yearFn) return s.yearFn(T - s.start);
    return lerp(s.years[0], s.years[1], (s.ease || E.inOut)(u));
  }

  // ---------------------------------------------------------------------------
  // Persistent chrome: plate border, chapter marker, year, timeline bar
  // ---------------------------------------------------------------------------
  const Y0 = 1776, Y1 = 2076, TLX0 = 200, TLX1 = 1720, TLY = 1004;
  const tlx = y => lerp(TLX0, TLX1, (y - Y0) / (Y1 - Y0));
  function chrome(T, s, local, env) {
    const intro = seg(T, 0.5, 2.0, E.linear);
    // Plate border, corner registration marks and ruler ticks
    ctx.save(); ctx.globalAlpha = intro;
    pen(C.gold, 0.35, 1);
    ctx.strokeRect(36.5, 36.5, W - 73, H - 73);
    pen(C.gold, 0.18, 1);
    ctx.strokeRect(44.5, 44.5, W - 89, H - 89);
    [[36, 36], [W - 36, 36], [36, H - 36], [W - 36, H - 36]].forEach(([x, y]) => {
      pen(C.gold, 0.6, 1);
      lineP(x - 14, y, x + 14, y, 1, false); lineP(x, y - 14, x, y + 14, 1, false);
      circleP(x, y, 6);
    });
    pen(C.gold, 0.25, 1);
    ctx.beginPath();
    for (let x = 60; x < W - 50; x += 20) { const L = x % 100 === 0 ? 8 : 4; ctx.moveTo(x, 36); ctx.lineTo(x, 36 + L); }
    for (let y = 60; y < H - 50; y += 20) { const L = y % 100 === 0 ? 8 : 4; ctx.moveTo(36, y); ctx.lineTo(36 + L, y); ctx.moveTo(W - 36, y); ctx.lineTo(W - 36 - L, y); }
    ctx.stroke();
    ctx.restore();

    // Chapter marker (small caps) & plate number
    if (s.chapter) {
      const a = env;
      const idx = SCENES.filter(x => x.chapter).indexOf(s) + 1;
      txt(`CHAPTER ${s.chapter[0]}`, 84, 82, { size: 12, align: 'left', track: 4, a: a * 0.7 });
      txt(s.chapter[1], 84, 108, { size: 21, font: F.display, weight: 600, align: 'left', track: 7, rgb: s.accent === 'red' ? C.red : C.bright, a });
      txt(`PLATE ${String(idx).padStart(2, '0')} / 14`, W - 84, 82, { size: 12, align: 'right', track: 4, a: a * 0.7 });
    }

    // Timeline bar
    const tla = THEME === 'black' ? 1 : 1;
    const vis = seg(T, 6.0, 7.5) * (1 - seg(T, DURATION - 3.6, DURATION - 2.6)) * tla;
    if (vis > 0) {
      ctx.save(); ctx.globalAlpha = vis;
      const y = yearAt(T);
      pen(C.gold, 0.35, 1);
      lineP(TLX0, TLY, tlx(2026), TLY, 1, false);
      ctx.setLineDash([4, 6]); lineP(tlx(2026), TLY, TLX1, TLY, 1, false); ctx.setLineDash([]);
      ctx.beginPath();
      for (let yy = 1780; yy <= 2070; yy += 10) { const L = yy % 50 === 0 ? 9 : 4; ctx.moveTo(tlx(yy), TLY - L); ctx.lineTo(tlx(yy), TLY); }
      ctx.stroke();
      [1776, 1800, 1850, 1900, 1950, 2000, 2026, 2076].forEach(yy => txt(yy === 2026 ? 'NOW' : String(yy), tlx(yy), TLY + 18, { size: 11, track: 2, a: 0.6, rgb: yy === 2026 ? C.bright : C.gold }));
      // Chapter beacons
      SCENES.filter(x => x.chapter && x.id !== 'memory').forEach(x => {
        const on = T >= x.start;
        dot(tlx(x.years[0]), TLY, on ? 3 : 2, on ? C.bright : C.gold, on ? 0.9 : 0.35, on ? 6 : 0);
      });
      // Progress & marker
      pen(C.bright, 1, 2.4, 12);
      lineP(TLX0, TLY, tlx(y), TLY, 1, false);
      noGlow();
      const mx = tlx(y);
      ctx.fillStyle = col(C.bright, 1); ctx.shadowColor = col(C.bright, 0.9); ctx.shadowBlur = 14 * GLOW;
      ctx.beginPath(); ctx.moveTo(mx, TLY - 8); ctx.lineTo(mx + 6, TLY); ctx.lineTo(mx, TLY + 8); ctx.lineTo(mx - 6, TLY); ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      txt(String(Math.round(y)), mx, TLY - 22, { size: 15, font: F.display, weight: 600, rgb: C.bright, track: 2 });
      ctx.restore();
    }
  }

  function grain(T) {
    const fi = Math.floor(T * 24); // grain changes at film rate
    const tile = GRAIN[fi % GRAIN.length];
    const r = rng(fi + 7);
    ctx.save();
    ctx.globalCompositeOperation = C.grainOp;
    ctx.globalAlpha = C.grainA;
    const ox = Math.floor(r() * 256), oy = Math.floor(r() * 256);
    for (let x = -ox; x < W; x += 256) for (let y = -oy; y < H; y += 256) ctx.drawImage(tile, x, y);
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Frame renderer — the single entry point
  // ---------------------------------------------------------------------------
  function renderAt(T) {
    T = clamp(T, 0, DURATION - 1e-6);
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(BG, 0, 0, W, H);
    if (C.stars) STARS.forEach(s => dot(s.x, s.y, s.r, C.white, s.a * (0.6 + 0.4 * Math.sin(T * 1.3 + s.ph))));

    const s = sceneAt(T), local = T - s.start;
    const fi = s.fadeIn ?? 0.35, fo = s.fadeOut ?? 0.35;
    const env = Math.min(fi ? clamp(local / fi) : 1, fo ? clamp((s.dur - local) / fo) : 1);
    ctx.save();
    ctx.globalAlpha = env;
    s.draw(local, s.dur);
    ctx.restore();
    ctx.shadowBlur = 0; ctx.setLineDash([]); ctx.letterSpacing = '0px';

    chrome(T, s, local, env);
    grain(T);
    // Final fade to black
    const out = seg(T, DURATION - 1.0, DURATION, E.linear);
    if (out > 0) { ctx.fillStyle = `rgba(0,0,0,${out})`; ctx.fillRect(0, 0, W, H); }
  }

  // ---------------------------------------------------------------------------
  // Boot: wait for fonts, then either expose the API (render) or play.
  // ---------------------------------------------------------------------------
  const fontsReady = Promise.all([
    document.fonts.load(`600 64px ${F.display}`),
    document.fonts.load(`italic 500 32px ${F.serif}`),
    document.fonts.load(`500 32px ${F.serif}`),
    document.fonts.load(`400 16px ${F.mono}`),
  ]).catch(() => {});

  window.LIBERTY = {
    W, H, DURATION, renderAt,
    scenes: SCENES.map(s => ({ id: s.id, start: s.start, dur: s.dur, chapter: s.chapter && s.chapter[1] })),
    ready: fontsReady.then(() => true),
  };
  if (RENDER) { document.body.classList.add('render'); fontsReady.then(() => renderAt(0)); return; }

  // Interactive preview
  const ui = {
    play: document.getElementById('play'), clock: document.getElementById('clock'),
    scrub: document.getElementById('scrub'), jump: document.getElementById('jump'),
  };
  ui.scrub.max = DURATION;
  SCENES.forEach(s => {
    const o = document.createElement('option');
    o.value = s.start; o.textContent = `${s.start.toFixed(0).padStart(3, ' ')}s  ${s.chapter ? s.chapter[1] : s.id.toUpperCase()}`;
    ui.jump.appendChild(o);
  });
  let playing = true, t = parseFloat(params.get('t') || '0'), last = null;
  const toggle = () => { playing = !playing; ui.play.textContent = playing ? 'PAUSE' : 'PLAY'; };
  ui.play.onclick = toggle;
  ui.scrub.oninput = () => { t = parseFloat(ui.scrub.value); };
  ui.jump.onchange = () => { t = parseFloat(ui.jump.value); };
  addEventListener('keydown', e => {
    if (e.code === 'Space') { toggle(); e.preventDefault(); }
    if (e.code === 'ArrowRight') t = Math.min(DURATION, t + 5);
    if (e.code === 'ArrowLeft') t = Math.max(0, t - 5);
  });
  function loop(now) {
    if (last != null && playing) t = (t + (now - last) / 1000) % DURATION;
    last = now;
    renderAt(t);
    ui.scrub.value = t;
    ui.clock.textContent = `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
    requestAnimationFrame(loop);
  }
  fontsReady.then(() => requestAnimationFrame(loop));
})();
