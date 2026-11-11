/* =============================================================================
 *  ODE — scenes I–III: Greece, Rome, the cathedral.
 *  Each shot is  ODE.shots.<id>(c, t, d, p, shot)  — c: context, t: local seconds,
 *  d: duration, p: t / d. Shots may be asked for t slightly beyond d (dissolves).
 * ========================================================================== */
(() => {
  'use strict';
  const O = window.ODE;
  const { W, H, TAU, clamp, lerp, E, seg, win, rng, hash, n1, fbm, flicker, col, mix, mix2, lin, rad, camera, sky, glow, flare, beam, rays, motes,
    haze, stars, clouds, hills, ridgeY, poly, rect, rrect, circle, ellipse, line, strokeP, sample, bez, column, archPath, figure, crowd, F, txt } = O;
  const S = O.shots, P = (O.props = {});

  // ---------------------------------------------------------------------------
  // Props shared between scenes
  // ---------------------------------------------------------------------------
  /** Cypress and olive trees as silhouettes. */
  P.cypress = (c, x, y, h, fill) => {
    c.fillStyle = fill;
    c.beginPath();
    c.moveTo(x, y); c.bezierCurveTo(x - h * 0.16, y - h * 0.2, x - h * 0.1, y - h * 0.8, x, y - h);
    c.bezierCurveTo(x + h * 0.1, y - h * 0.8, x + h * 0.16, y - h * 0.2, x, y);
    c.fill();
    c.fillRect(x - h * 0.012, y - 2, h * 0.024, h * 0.06);
  };
  P.olive = (c, x, y, h, fill, seed = 1) => {
    const R = rng(seed);
    c.fillStyle = fill;
    c.beginPath(); c.moveTo(x - h * 0.05, y); c.quadraticCurveTo(x - h * 0.02, y - h * 0.3, x - h * 0.12, y - h * 0.55);
    c.lineTo(x + h * 0.1, y - h * 0.55); c.quadraticCurveTo(x + h * 0.03, y - h * 0.3, x + h * 0.06, y); c.fill();
    for (let i = 0; i < 16; i++) {
      const a = R() * TAU, r = R() * h * 0.36;
      c.beginPath(); c.ellipse(x + Math.cos(a) * r * 1.35, y - h * 0.72 + Math.sin(a) * r * 0.62, h * (0.12 + R() * 0.12), h * (0.09 + R() * 0.08), 0, 0, TAU); c.fill();
    }
  };
  /** Birds as tiny flapping chevrons. */
  P.birds = (c, x, y, n, t, color, seed = 2, spread = 160, size = 7) => {
    const R = rng(seed);
    c.strokeStyle = color; c.lineWidth = 1.6; c.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const bx = x + (R() - 0.5) * spread * 2 + t * (14 + R() * 10), by = y + (R() - 0.5) * spread * 0.7 + Math.sin(t * 0.8 + i) * 6;
      const s = size * (0.6 + R() * 0.8), f = Math.sin(t * (7 + R() * 3) + i * 2) * 0.5;
      c.beginPath(); c.moveTo(bx - s, by - s * (0.2 + f)); c.quadraticCurveTo(bx - s * 0.4, by - s * 0.3, bx, by);
      c.quadraticCurveTo(bx + s * 0.4, by - s * 0.3, bx + s, by - s * (0.2 + f)); c.stroke();
    }
  };
  /** Candle with a living flame. (x, y) is the base of the flame; s scales it. `lit` 0..1. */
  P.candle = (c, x, y, s, t, { seed = 1, body = true, lit = 1, glowR = 260 } = {}) => {
    const f = flicker(t, seed, 0.14), sway = (n1(t * 2.3, seed + 9) - 0.5) * 6 * s;
    if (body) {
      c.fillStyle = lin(x - 11 * s, 0, x + 11 * s, 0, [[0, '#8f7350'], [0.45, '#f4e2bd'], [1, '#6f5a40']]);
      c.beginPath(); c.roundRect(x - 10 * s, y + 6 * s, 20 * s, 96 * s, 3 * s); c.fill();
      c.fillStyle = '#f7ead0'; c.beginPath(); c.ellipse(x, y + 7 * s, 10 * s, 3.4 * s, 0, 0, TAU); c.fill();
      c.fillStyle = '#e8d3a8'; c.beginPath(); c.roundRect(x + 4 * s, y + 8 * s, 4.5 * s, 26 * s, 2 * s); c.fill();
      c.fillStyle = '#2a1a10'; c.fillRect(x - 0.9 * s, y - 2 * s, 1.8 * s, 9 * s);
      c.fillStyle = lin(x - 26 * s, 0, x + 26 * s, 0, [[0, '#3a2a14'], [0.4, '#b58a3c'], [1, '#2a1c0c']]);
      c.beginPath(); c.ellipse(x, y + 102 * s, 26 * s, 6 * s, 0, 0, TAU); c.fill();
      c.fillRect(x - 5 * s, y + 102 * s, 10 * s, 16 * s);
      c.beginPath(); c.ellipse(x, y + 120 * s, 20 * s, 5 * s, 0, 0, TAU); c.fill();
    }
    if (lit <= 0) return;
    glow(x, y - 16 * s, glowR * s * f, '#ff9c3a', 0.42 * lit);
    glow(x, y - 16 * s, 70 * s * f, '#ffd38a', 0.75 * lit);
    const hgt = 44 * s * (0.9 + 0.2 * f) * lit;
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = lin(0, y, 0, y - hgt, [[0, 'rgba(120,150,255,0.5)'], [0.18, 'rgba(255,214,130,0.95)'], [0.6, 'rgba(255,170,60,0.9)'], [1, 'rgba(255,120,30,0)']]);
    c.beginPath(); c.moveTo(x, y + 2 * s);
    c.bezierCurveTo(x - 11 * s, y - 6 * s, x - 8 * s + sway * 0.4, y - hgt * 0.55, x + sway, y - hgt);
    c.bezierCurveTo(x + 8 * s + sway * 0.4, y - hgt * 0.55, x + 11 * s, y - 6 * s, x, y + 2 * s);
    c.fill();
    c.fillStyle = 'rgba(255,250,230,0.95)';
    c.beginPath(); c.ellipse(x + sway * 0.25, y - hgt * 0.3, 3.4 * s, hgt * 0.24, 0, 0, TAU); c.fill();
    c.restore();
  };

  // ---------------------------------------------------------------------------
  // I · DAWN OF REASON
  // ---------------------------------------------------------------------------
  /** Parthenon elevation. cx = centre, yb = top of the rock, w = width of the stylobate. */
  P.temple = (c, cx, yb, w, { fill = '#2c1b1d', lit = '#ffc983', sunX = cx, n = 8 } = {}) => {
    const colH = w * 0.315, colW = w * 0.056, stepH = w * 0.02, top = yb - stepH * 3 - colH;
    for (let i = 0; i < 3; i++) rect(cx - w / 2 - (2 - i) * stepH * 1.2, yb - stepH * (i + 1), w + (2 - i) * stepH * 2.4, stepH + 0.5, fill);
    const x0 = cx - w / 2 + colW * 0.62, gap = (w - colW * 1.24) / (n - 1);
    for (let i = 0; i < n; i++) {
      const x = x0 + i * gap;
      column(x, yb - stepH * 3, colW, colH, { fill, lit, side: x < sunX ? 1 : -1, flutes: 6 });
    }
    const eh = w * 0.075;
    rect(cx - w / 2 - 2, top - eh, w + 4, eh + 1, fill);
    c.fillStyle = 'rgba(255,200,130,0.12)';
    for (let i = 0; i < 30; i++) c.fillRect(cx - w / 2 + 6 + i * (w - 12) / 30, top - eh * 0.52, (w - 12) / 60, eh * 0.4); // triglyphs
    poly([[cx - w / 2 - 10, top - eh], [cx, top - eh - w * 0.125], [cx + w / 2 + 10, top - eh]], fill);
    poly([[cx - 9, top - eh - w * 0.125 + 2], [cx, top - eh - w * 0.125 - 16], [cx + 9, top - eh - w * 0.125 + 2]], fill); // acroterion
  };

  S.parthenon = (c, t, d, p) => {
    const L = camera(p, { z0: 1.0, z1: 1.11, fx: 1180, fy: 430 });
    const rise = E.out(clamp(p * 0.95));
    const sunX = 1180, sunY = lerp(548, 436, rise);
    L(0, () => {
      sky([[0, mix('#12122e', '#2a2350', rise)], [0.3, mix('#3b2748', '#6a4368', rise)], [0.55, mix('#9a4f4a', '#d27b55', rise)], [0.75, mix('#e49a55', '#f7bd6c', rise)], [1, '#ffe4a6']]);
      stars({ n: 160, seed: 4, t, alpha: 0.75 * (1 - rise), h: 380 });
    });
    L(0.12, () => {
      glow(sunX, sunY, 900, '#ffb764', 0.55 + 0.25 * rise);
      clouds({ y: 250, amp: 60, n: 26, seed: 12, t, hex: '#ffb38a', alpha: 0.2, r: 170, drift: 3, mode: 'lighter' });
      clouds({ y: 360, amp: 30, n: 16, seed: 15, t, hex: '#ffd9a0', alpha: 0.2, r: 130, drift: 2, mode: 'lighter' });
    });
    L(0.3, () => {
      hills(585, 55, 0.0013, 31, lin(0, 520, 0, 700, [[0, '#a8666a'], [1, '#c98a6a']]));
      haze(560, 700, '#ffc78a', 0.0, 0.45);
    });
    L(0.5, () => {
      hills(640, 45, 0.0021, 37, lin(0, 590, 0, 760, [[0, '#70444f'], [1, '#9a5f58']]));
      haze(620, 760, '#ffb878', 0.0, 0.35);
    });
    L(1, () => {
      // sun and its rays, behind the temple
      glow(sunX, sunY, 300, '#fff0c4', 0.95);
      circle(sunX, sunY, 44, '#fffbea');
      rays(sunX, sunY, { n: 26, a0: -Math.PI * 1.05, a1: Math.PI * 0.05, len: 1300, hex: '#ffd590', alpha: 0.2, t, seed: 3, width: 0.5 });
      // the rock of the Acropolis
      c.fillStyle = lin(0, 540, 0, 804, [[0, '#2f1d20'], [1, '#170e12']]);
      c.beginPath(); c.moveTo(380, 900);
      for (let x = 380; x <= 2100; x += 12) {
        const pl = seg(x, 560, 800, E.sine) * (1 - seg(x, 1570, 1900, E.sine));
        c.lineTo(x, 804 - pl * 252 - fbm(x * 0.012, 5, 3) * 34 * (0.3 + pl) + (pl > 0.98 ? 10 : 0));
      }
      c.lineTo(2100, 900); c.fill();
      rect(800, 548, 780, 14, '#2a1a1c'); // retaining wall
      P.temple(c, 1180, 548, 610, { sunX });
      // a smaller temple (Erechtheion) and the Propylaea, far left of the rock
      for (let i = 0; i < 4; i++) column(868 + i * 22, 550, 9, 62, { fill: '#2c1b1d', lit: '#ffc983', side: 1 });
      rect(858, 482, 86, 9, '#2c1b1d'); poly([[856, 482], [901, 466], [946, 482]], '#2c1b1d');
      // light spilling through the colonnade toward the lens
      rays(sunX, sunY, { n: 14, a0: Math.PI * 0.08, a1: Math.PI * 0.92, len: 620, hex: '#ffcf8a', alpha: 0.1, t, seed: 8, width: 0.35 });
      glow(sunX, sunY, 120, '#fff6dc', 0.6 + 0.2 * rise);
      flare(sunX, sunY, 1500, '#ffd9a8', 0.28 + 0.14 * rise, 4);
      P.birds(c, 700 + t * 6, 300, 7, t, 'rgba(40,22,26,0.8)', 21, 150, 7);
    });
    L(1.5, () => {
      // foreground slope with olives and cypresses
      hills(770, 46, 0.0028, 43, '#0f080b', { oct: 2 });
      P.cypress(c, 190, 760, 330, '#0f080b'); P.cypress(c, 300, 772, 230, '#0f080b'); P.cypress(c, 1820, 790, 300, '#0f080b');
      P.olive(c, 520, 775, 150, '#0f080b', 4); P.olive(c, 1640, 800, 130, '#0f080b', 9);
    });
    motes({ n: 70, seed: 5, t, hex: '#ffe2ae', alpha: 0.55, size: 2.2 });
  };

  S.agora = (c, t, d, p) => {
    const L = camera(p, { z0: 1.02, z1: 1.1, fx: 1000, fy: 430, dx: -30 });
    L(0, () => sky([[0, '#e9b96a'], [0.55, '#f8dca0'], [1, '#eebf7c']]));
    L(0.25, () => {
      // the Acropolis in the haze beyond the square
      c.fillStyle = 'rgba(214,160,110,0.6)';
      c.beginPath(); c.moveTo(900, 520); c.lineTo(1010, 400); c.lineTo(1420, 392); c.lineTo(1560, 520); c.fill();
      P.temple(c, 1220, 394, 240, { fill: 'rgba(205,150,104,0.75)', lit: 'rgba(255,236,200,0.8)', sunX: 0 });
      haze(300, 560, '#ffe8b8', 0.0, 0.45);
    });
    const floorY = 640;
    L(0.6, () => {
      // far colonnade of the stoa, bright marble in raking light
      rect(-200, 120, 2400, 50, '#d8b68a'); rect(-200, 170, 2400, 12, '#b08a62');
      for (let i = 0; i < 9; i++) column(40 + i * 250, floorY - 30, 74, 428, { fill: '#b48a60', lit: '#fff3d6', side: -1, flutes: 8 });
      rect(-200, floorY - 32, 2400, 16, '#c9a273');
    });
    L(0.8, () => {
      // marble floor with long shadows
      c.fillStyle = lin(0, floorY - 20, 0, H, [[0, '#e7c591'], [0.5, '#c79a66'], [1, '#7a5636']]);
      c.fillRect(-300, floorY - 20, 2600, 400);
      c.fillStyle = 'rgba(70,40,20,0.28)';
      for (let i = 0; i < 9; i++) { const x = 40 + i * 250 * 1.0; poly([[x - 40, floorY - 18], [x + 40, floorY - 18], [x + 560, H + 60], [x + 330, H + 60]], c.fillStyle); }
      // debating pairs further down the colonnade
      const dk = '#3a2415', rm = '#ffdca0';
      figure(1500, 628, 190, { face: -1, fill: dk, rim: rm, light: -1, head: 'beard', armF: [1.2 + 0.2 * Math.sin(t * 1.4), 0.9] });
      figure(1425, 630, 182, { face: 1, fill: dk, rim: rm, light: -1, armF: [0.5, 1.6] });
      figure(1650, 626, 186, { face: -1, fill: dk, rim: rm, light: -1, armF: [0.2, 0.3] });
      figure(330, 628, 180, { face: 1, fill: dk, rim: rm, light: -1, armF: [0.9, 1.0 + 0.2 * Math.sin(t * 1.1)] });
      figure(410, 630, 186, { face: -1, fill: dk, rim: rm, light: -1, head: 'beard', armF: [0.3, 1.9] });
    });
    // shafts of morning light between the columns
    L(0.9, () => {
      for (let i = 0; i < 5; i++) {
        const x = -120 + i * 250 * 1.02;
        beam(x, 60, 150, x + 620, 800, 260, '#ffe2a6', 0.2 * (0.7 + 0.3 * n1(t * 0.4 + i, 3)), 0.02);
      }
    });
    L(1, () => {
      const dk = '#2a180e', rm = '#ffd9a0';
      // a stone bench
      rect(640, 598, 300, 26, '#8d6a48'); rect(660, 624, 30, 44, '#6f5136'); rect(890, 624, 30, 44, '#6f5136');
      c.fillStyle = 'rgba(50,28,14,0.35)'; c.beginPath(); c.ellipse(900, 676, 480, 22, 0, 0, TAU); c.fill();
      // students
      figure(590, 672, 300, { face: 1, fill: dk, rim: rm, light: -1, armF: [0.35, 1.9], armB: [0.2, 0.3], nod: 0.05 * Math.sin(t * 0.9) });
      figure(730, 668, 300, { face: 1, fill: dk, rim: rm, light: -1, sit: true, bend: 0.12, armF: [0.7, 1.2], armB: [0.5, 0.9], nod: -0.08 + 0.04 * Math.sin(t * 0.7 + 1) });
      figure(880, 668, 296, { face: 1, fill: dk, rim: rm, light: -1, sit: true, bend: 0.2, armF: [0.9, 1.5], armB: [0.6, 1.0], head: 'long', nod: -0.1 });
      // Socrates: barefoot, stocky, one hand raised mid-question
      const a = 0.14 * Math.sin(t * 1.6);
      c.save(); c.translate(1175, 676); c.scale(1.12, 1); c.translate(-1175, -676);
      figure(1175, 676, 318, { face: -1, fill: dk, rim: rm, light: -1, head: 'beard', lean: -0.03, armF: [1.25 + a, 1.15 - a * 0.6], armB: [0.35, 0.5] });
      c.restore();
    });
    L(1.7, () => {
      // foreground column, out of focus
      c.save(); c.filter = `blur(${O.blurPx(5)}px)`;
      column(1830, 900, 210, 1100, { fill: '#2a1a10', lit: '#b88a5a', side: -1, flutes: 0, cap: false });
      c.restore();
    });
    motes({ n: 130, seed: 8, t, hex: '#fff0c8', alpha: 0.8, size: 2.4, y: 60, h: 640 });
    glow(260, 120, 700, '#fff0c4', 0.16);
  };

  /** A sprig with leaves, swaying. */
  function plant(c, x, y, h, t, seed = 3) {
    const R = rng(seed);
    for (let s = 0; s < 5; s++) {
      const lean = (s - 2) * 0.16 + (R() - 0.5) * 0.1 + Math.sin(t * 0.9 + s) * 0.025, hh = h * (0.62 + R() * 0.4);
      const pts = sample(u => [x + Math.sin(lean * 1.4) * hh * u * u + (s - 2) * 5, y - hh * u], 20);
      c.strokeStyle = '#4c5a22'; c.lineWidth = 4.5 - s * 0.3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const q of pts) c.lineTo(q[0], q[1]); c.stroke();
      const nl = 6 + Math.floor(R() * 3);
      for (let i = 1; i <= nl; i++) {
        const u = 0.22 + 0.78 * i / nl, q = pts[Math.round(u * 20)], side = i % 2 ? 1 : -1;
        const ang = lean + side * (0.95 + 0.2 * Math.sin(t * 1.3 + i + s)) - 0.1, len = h * (0.2 - 0.09 * u) * (0.8 + R() * 0.4);
        c.save(); c.translate(q[0], q[1]); c.rotate(ang - Math.PI / 2);
        c.fillStyle = lin(0, 0, len, 0, [[0, '#55701f'], [0.5, '#a8b83c'], [1, '#f1e27a']]);
        c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(len * 0.45, -len * 0.3, len, 0); c.quadraticCurveTo(len * 0.45, len * 0.3, 0, 0); c.fill();
        c.strokeStyle = 'rgba(60,80,20,0.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, 0); c.lineTo(len * 0.9, 0); c.stroke();
        c.restore();
      }
      if (s % 2 === 0) { const q = pts[20]; circle(q[0], q[1], 9, '#fff3c0'); glow(q[0], q[1], 40, '#fff3b0', 0.5); }
    }
  }

  S.aristotle = (c, t, d, p) => {
    const L = camera(p, { z0: 1.02, z1: 1.12, fx: 1150, fy: 420 });
    L(0, () => sky([[0, '#e5b260'], [0.5, '#f4d28c'], [1, '#b98f4a']]));
    L(0.3, () => {
      // the Lyceum's garden, soft and far
      const R = rng(61);
      for (let i = 0; i < 60; i++) {
        const x = R() * 2200 - 140, y = R() * 620, r = 50 + R() * 130;
        glow(x, y, r, ['#6f8a3a', '#9aa84a', '#f4d98a', '#52702c'][i % 4], 0.3, 'source-over');
      }
      for (let i = 0; i < 5; i++) column(260 + i * 180, 620, 44, 330, { fill: 'rgba(196,160,110,0.5)', lit: 'rgba(255,240,205,0.6)', side: 1 });
      haze(0, 804, '#ffe3a6', 0.25, 0.1);
    });
    const sx = 1500, sy = 250;
    L(0.6, () => {
      glow(sx, sy, 700, '#ffe0a0', 0.5); glow(sx, sy, 200, '#fff8e0', 0.8);
      rays(sx, sy, { n: 18, a0: Math.PI * 0.45, a1: Math.PI * 1.15, len: 1500, hex: '#ffe2a4', alpha: 0.16, t, seed: 4, width: 0.5 });
    });
    L(1, () => {
      hills(742, 18, 0.004, 9, lin(0, 700, 0, 804, [[0, '#5a6426'], [1, '#2a3012']]), { oct: 2 });
      plant(c, 1190, 742, 330, t, 5);
      plant(c, 1330, 750, 210, t + 2, 11);
      const dk = '#2c1c10';
      // Aristotle, bent to the specimen, wax tablet in the other hand
      const reach = 0.06 * Math.sin(t * 1.1);
      const f = figure(800, 752, 430, { face: 1, fill: dk, rim: '#ffe0a8', light: 1, head: 'beard', bend: 0.5, nod: 0.1, armF: [0.72 + reach, 0.55], armB: [0.15, 1.5] });
      const hb = f.hands[1];
      c.save(); c.translate(hb[0] + 10, hb[1] - 8); c.rotate(-0.3);
      rrect(-34, -46, 68, 92, 4, '#3a2412'); rrect(-27, -39, 54, 78, 2, '#7a5a30');
      c.restore();
      flare(sx, sy, 1100, '#ffe6b8', 0.2, 4);
    });
    L(1.6, () => {
      c.save(); c.filter = `blur(${O.blurPx(9)}px)`;
      const R = rng(77);
      for (let i = 0; i < 9; i++) { c.fillStyle = 'rgba(40,52,16,0.9)'; c.beginPath(); c.ellipse(R() * 520 - 80, 620 + R() * 240, 150, 46, R() * 2 - 1, 0, TAU); c.fill(); }
      for (let i = 0; i < 5; i++) { c.fillStyle = 'rgba(36,48,14,0.9)'; c.beginPath(); c.ellipse(1700 + R() * 320, R() * 200 - 40, 170, 50, R() * 2 - 1, 0, TAU); c.fill(); }
      c.restore();
    });
    motes({ n: 90, seed: 13, t, hex: '#fff4c8', alpha: 0.8, size: 2.6 });
  };

  /** Papyrus sheet with fibres. */
  P.papyrus = (c, x, y, w, h, seed = 3) => {
    c.fillStyle = lin(x, y, x + w, y + h, [[0, '#f0deb0'], [0.5, '#e6cf98'], [1, '#d2b57c']]);
    c.fillRect(x, y, w, h);
    const R = rng(seed);
    c.lineWidth = 1;
    for (let i = 0; i < 150; i++) {
      c.strokeStyle = `rgba(${130 + R() * 60 | 0},${95 + R() * 40 | 0},${40 + R() * 30 | 0},${0.05 + R() * 0.1})`;
      const yy = y + R() * h; c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy + (R() - 0.5) * 3); c.stroke();
    }
    for (let i = 0; i < 110; i++) {
      c.strokeStyle = `rgba(120,85,40,${0.04 + R() * 0.07})`;
      const xx = x + R() * w; c.beginPath(); c.moveTo(xx, y); c.lineTo(xx + (R() - 0.5) * 3, y + h); c.stroke();
    }
  };
  /** A writing hand seen from above, holding a pen whose nib is at (x, y). kind: 'reed' | 'quill' | 'chalk'. */
  P.hand = (c, x, y, { kind = 'reed', skin = '#b9804f', sleeve = '#e4d6ba', s = 1 } = {}) => {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.save(); c.filter = `blur(${O.blurPx(16)}px)`; c.fillStyle = 'rgba(30,14,4,0.45)';
    c.beginPath(); c.ellipse(150, 170, 170, 80, 0.75, 0, TAU); c.fill(); c.restore();
    // sleeve / forearm, entering from the lower right
    c.fillStyle = lin(150, 150, 700, 700, [[0, sleeve], [0.5, mix2(sleeve, '#3a2410', 0.35)], [1, mix2(sleeve, '#000000', 0.6)]]);
    c.beginPath(); c.moveTo(128, 206); c.lineTo(206, 124); c.lineTo(900, 700); c.lineTo(640, 900); c.closePath(); c.fill();
    const sk = lin(0, 0, 200, 220, [[0, mix2(skin, '#ffe2b8', 0.25)], [0.6, skin], [1, mix2(skin, '#2a1206', 0.45)]]);
    const sd = mix2(skin, '#2a1206', 0.3);
    // curled fingers under the palm, then palm, thumb
    for (let i = 0; i < 3; i++) { c.fillStyle = sd; c.beginPath(); c.ellipse(52 + i * 24, 124 + i * 26, 30, 21, 0.9, 0, TAU); c.fill(); }
    c.fillStyle = sk; c.beginPath(); c.ellipse(126, 128, 76, 56, 0.78, 0, TAU); c.fill();
    O.limb(64, 112, 24, 40, 19, 14, sk);
    // the pen lies across the hand
    if (kind === 'quill') {
      c.strokeStyle = '#f1e8d4'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(330, 96); c.stroke();
      c.fillStyle = lin(150, 0, 420, 140, [[0, '#fbf5e6'], [1, '#bfb08e']]);
      c.beginPath(); c.moveTo(150, 42); c.bezierCurveTo(230, 20, 360, 40, 440, 100); c.bezierCurveTo(380, 150, 250, 110, 160, 64); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(110,90,60,0.45)'; c.lineWidth = 1.2;
      for (let i = 0; i < 12; i++) { const u = i / 12; c.beginPath(); c.moveTo(165 + u * 220, 50 + u * 62); c.lineTo(190 + u * 226, 30 + u * 62); c.moveTo(165 + u * 220, 50 + u * 62); c.lineTo(182 + u * 220, 76 + u * 56); c.stroke(); }
      c.strokeStyle = '#1a0e06'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(12, 3.5); c.stroke();
    } else {
      c.strokeStyle = kind === 'chalk' ? '#7a3a22' : '#b88c4c'; c.lineWidth = kind === 'chalk' ? 11 : 8; c.lineCap = 'round';
      c.beginPath(); c.moveTo(kind === 'chalk' ? 0 : 5, kind === 'chalk' ? 0 : 2); c.lineTo(230, 78); c.stroke();
      c.strokeStyle = '#2a1708'; c.lineWidth = 3.5; c.beginPath(); c.moveTo(0, 0); c.lineTo(16, 5); c.stroke();
    }
    // index finger over the pen
    O.limb(104, 66, 30, 14, 18, 13, sk);
    c.restore();
  };

  S.scroll = (c, t, d, p) => {
    const L = camera(p, { z0: 1.0, z1: 1.09, fx: 960, fy: 400, dx: -24 });
    const x0 = 430, y0 = 170, w = 1060, h = 470;
    const lines = [['ΓΝΩΘΙ ΣΕΑΥΤΟΝ', 0, 0], ['Ο ΔΕ ΑΝΕΞΕΤΑΣΤΟΣ ΒΙΟΣ', 0.04, 0.5], ['ΟΥ ΒΙΩΤΟΣ ΑΝΘΡΩΠΩΙ', 0.54, 0.93]];
    let pen = [x0 + 150, y0 + 240];
    L(1, () => {
      // desk
      c.fillStyle = lin(0, 0, W, H, [[0, '#4a2e18'], [1, '#22140a']]); c.fillRect(-300, -300, W + 600, H + 600);
      const R = rng(19);
      for (let i = 0; i < 60; i++) { c.strokeStyle = `rgba(20,10,4,${0.1 + R() * 0.2})`; c.lineWidth = 1 + R() * 2; const y = R() * 1000 - 100; c.beginPath(); c.moveTo(-300, y); c.bezierCurveTo(500, y + R() * 40 - 20, 1300, y + R() * 40 - 20, 2300, y + R() * 30); c.stroke(); }
      // shadow, sheet, rolled ends
      c.save(); c.filter = `blur(${O.blurPx(22)}px)`; c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(x0 - 50, y0 + 14, w + 120, h + 20); c.restore();
      P.papyrus(c, x0, y0, w, h, 3);
      for (const sx of [x0 - 34, x0 + w - 30]) {
        c.fillStyle = lin(sx, 0, sx + 64, 0, [[0, '#8a6c3c'], [0.3, '#f3e2b6'], [0.62, '#d7bb84'], [1, '#6a5028']]);
        c.beginPath(); c.roundRect(sx, y0 - 16, 64, h + 32, 10); c.fill();
        c.fillStyle = '#4a3216'; c.beginPath(); c.roundRect(sx + 22, y0 - 44, 20, h + 88, 6); c.fill();
      }
      // text, revealed as the pen moves
      lines.forEach(([s, a, b], i) => {
        const ty = y0 + 118 + i * 122, tx = x0 + 140, size = i === 0 ? 46 : 54;
        c.font = `${size}px ${F.greek}`; c.letterSpacing = '5px';
        const tw = c.measureText(s).width;
        const k = b > a ? clamp((p - a) / (b - a)) : 1;
        if (k > 0) {
          c.save(); c.beginPath(); c.rect(tx - 10, ty - size, tw * k + 10, size * 1.7); c.clip();
          c.fillStyle = i === 0 ? 'rgba(52,30,10,0.72)' : 'rgba(40,22,6,0.94)'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
          c.fillText(s, tx, ty);
          c.restore();
        }
        if (b > a && p >= a && p <= b + 0.03) pen = [tx + tw * k + 6, ty - 12 + Math.sin(t * 19) * 9 * (k < 1 ? 1 : 0)];
        c.letterSpacing = '0px';
      });
      if (p > 0.96) pen = [pen[0] + (p - 0.96) * 900, pen[1] - (p - 0.96) * 700];
    });
    L(1, () => {
      // inkwell
      c.fillStyle = '#17100a'; c.beginPath(); c.ellipse(1640, 240, 62, 50, 0, 0, TAU); c.fill();
      c.fillStyle = '#05060c'; c.beginPath(); c.ellipse(1640, 232, 40, 30, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,220,150,0.3)'; c.beginPath(); c.ellipse(1626, 224, 12, 6, -0.4, 0, TAU); c.fill();
      P.hand(c, pen[0], pen[1], { kind: 'reed' });
    });
    beam(-100, -160, 420, 1500, 900, 760, '#ffd590', 0.38, 0.06);
    motes({ n: 70, seed: 3, t, hex: '#ffe6b0', alpha: 0.7, size: 2.4, mask: (x, y) => clamp(1.2 - Math.abs((y - x * 0.66 + 60)) / 330) });
  };

  // ---------------------------------------------------------------------------
  // II · ROME AND LAW
  // ---------------------------------------------------------------------------
  S.forum = (c, t, d, p) => {
    const L = camera(p, { z0: 1.0, z1: 1.09, fx: 900, fy: 440 });
    const sx = 330, sy = 250;
    L(0, () => { sky([[0, '#d9a055'], [0.5, '#f3cd88'], [1, '#f9e2b0']]); glow(sx, sy, 800, '#fff0c0', 0.5); });
    L(0.3, () => {
      // the Capitoline and its temple, far
      hills(520, 40, 0.0016, 23, 'rgba(206,150,100,0.75)');
      P.temple(c, 1380, 440, 300, { fill: 'rgba(196,140,96,0.85)', lit: 'rgba(255,232,190,0.9)', sunX: 0, n: 6 });
      haze(380, 640, '#ffe2aa', 0.0, 0.5);
    });
    L(0.55, () => {
      // basilica arcade across the square
      const fill = '#c08a5c';
      c.fillStyle = lin(0, 330, 0, 620, [[0, '#d7a674'], [1, '#b47f52']]);
      c.beginPath(); c.rect(560, 350, 1500, 270);
      for (let i = 0; i < 16; i++) { const x = 590 + i * 92; archPath(x, x + 60, 530, 620); c.rect(x + 8, 372, 44, 70); }
      c.fill('evenodd');
      rect(540, 338, 1540, 14, fill); rect(540, 452, 1540, 8, '#a87548');
      // honorific columns with statues
      for (const x of [690, 1010, 1700]) { column(x, 620, 20, 250, { fill: '#b98558', lit: '#fff0d0', side: -1 }); figure(x, 372, 56, { fill: '#a87548', rim: '#fff0d0', light: -1, armF: [2.2, 0.2] }); }
      haze(520, 640, '#ffdca0', 0.0, 0.4);
    });
    L(0.8, () => {
      // Temple of Saturn (left) and a triumphal arch (right)
      const f = '#7a5234', lit = '#ffe9c0';
      rect(-80, 596, 620, 60, f);
      for (let i = 0; i < 6; i++) column(0 + i * 96, 598, 48, 372, { fill: f, lit, side: -1, flutes: 7 });
      rect(-70, 176, 600, 52, f); poly([[-80, 176], [230, 84], [540, 176]], f);
      c.fillStyle = 'rgba(255,225,170,0.25)'; c.fillRect(-60, 196, 580, 4);
      c.fillStyle = lin(1500, 0, 1960, 0, [[0, '#ffe2b4'], [0.25, '#b4855a'], [1, '#7a5234']]);
      c.beginPath(); c.rect(1500, 250, 470, 400);
      archPath(1668, 1802, 470, 650); archPath(1540, 1622, 520, 650); archPath(1848, 1930, 520, 650);
      c.fill('evenodd');
      rect(1486, 236, 498, 18, '#8a6040'); rect(1486, 330, 498, 10, '#8a6040');
      rays(sx, sy, { n: 12, a0: -0.1, a1: 0.9, len: 1900, hex: '#ffe6b0', alpha: 0.13, t, seed: 6, width: 0.45 });
    });
    L(0.9, () => {
      // paving
      c.fillStyle = lin(0, 630, 0, H, [[0, '#e3bf8c'], [1, '#8a6442']]); c.fillRect(-300, 630, 2600, 300);
      c.strokeStyle = 'rgba(90,60,30,0.2)'; c.lineWidth = 1.5;
      for (let i = 0; i < 9; i++) { const y = 636 + i * i * 2.6; c.beginPath(); c.moveTo(-300, y); c.lineTo(2300, y); c.stroke(); }
      for (let i = -14; i < 30; i++) { c.beginPath(); c.moveTo(960 + i * 60, 632); c.lineTo(960 + i * 190, 880); c.stroke(); }
      crowd({ x0: 560, x1: 1500, y: 668, rows: 2, h: 60, seed: 12, fill: '#6a4a30', density: 0.45, raise: 0, hats: 0, t, sway: 0.4 });
    });
    L(1, () => {
      // senators: white togas in the gold light
      const sh = '#d2bf9f', lt = '#fffdf6';
      c.fillStyle = 'rgba(70,40,18,0.3)'; c.beginPath(); c.ellipse(1010, 742, 520, 26, 0, 0, TAU); c.fill();
      const g = 0.16 * Math.sin(t * 1.3);
      const sen = (x, y, h, o) => {
        const f = figure(x, y, h, { fill: sh, rim: lt, light: -1, ...o });
        // the broad purple stripe
        c.save(); c.translate(x, y); c.scale(h * (o.face || 1), h); c.rotate(o.lean || 0);
        c.strokeStyle = 'rgba(110,30,60,0.7)'; c.lineWidth = 0.022; c.lineCap = 'round';
        c.beginPath(); c.moveTo(0.05, -0.8); c.quadraticCurveTo(-0.02, -0.5, 0.04, -0.03); c.stroke();
        c.restore();
        return f;
      };
      sen(700, 740, 330, { face: 1, armF: [0.5, 1.5], armB: [0.2, 0.4] });
      sen(840, 736, 322, { face: 1, head: 'beard', armF: [0.3, 0.4], armB: [0.3, 1.2] });
      const f = sen(1010, 742, 344, { face: 1, armF: [1.75 + g, 0.5 - g], armB: [0.5, 1.7], lean: 0.02 });
      // scroll of the law in the orator's hand
      c.save(); c.translate(f.hands[0][0], f.hands[0][1]); c.rotate(-0.5); rrect(-9, -44, 18, 80, 8, '#f6ead0'); c.restore();
      sen(1210, 738, 328, { face: -1, armF: [0.6, 1.7], armB: [0.2, 0.3], nod: 0.06 });
      sen(1340, 742, 336, { face: -1, head: 'beard', armF: [0.25, 0.4], armB: [0.4, 1.4] });
      sen(1470, 736, 320, { face: -1, armF: [0.9, 1.3 + g], armB: [0.2, 0.3] });
    });
    flare(sx, sy, 1300, '#ffe2b0', 0.2, 4);
    motes({ n: 90, seed: 31, t, hex: '#fff0c8', alpha: 0.7, size: 2.3 });
  };

  S.aqueduct = (c, t, d, p) => {
    const L = camera(p, { z0: 1.0, z1: 1.1, fx: 1300, fy: 440, dx: -20 });
    const sx = 330, sy = 170;
    L(0, () => { sky([[0, '#6f9cc4'], [0.4, '#b9cbbf'], [0.68, '#f6dd9c'], [1, '#ffeec2']]); glow(sx, sy, 950, '#ffe9b0', 0.85); glow(sx, sy, 200, '#fffbe6', 1); circle(sx, sy, 42, '#fffdf2'); });
    L(0.1, () => clouds({ y: 170, amp: 80, n: 22, seed: 5, t, hex: '#fff3d6', alpha: 0.35, r: 160, drift: 5 }));
    L(0.25, () => { hills(470, 60, 0.0011, 3, '#93a9a6'); haze(420, 560, '#ffeab8', 0, 0.6); });
    L(0.4, () => { hills(520, 46, 0.0017, 8, lin(0, 470, 0, 640, [[0, '#8fa56c'], [1, '#b9bd72']])); haze(480, 620, '#ffe6a8', 0, 0.45); });
    L(0.6, () => {
      // two-tier aqueduct marching across the valley
      c.fillStyle = lin(0, 250, 0, 640, [[0, '#f0c48a'], [0.5, '#d19a62'], [1, '#a8744a']]);
      c.beginPath(); c.rect(-300, 262, 2600, 420);
      for (let i = 0; i < 16; i++) { const x = -260 + i * 158; archPath(x + 26, x + 132, 470, 700); }
      for (let i = 0; i < 48; i++) { const x = -270 + i * 52.6; archPath(x + 8, x + 44, 318, 356); }
      c.fill('evenodd');
      rect(-300, 254, 2600, 10, '#b98556'); rect(-300, 356, 2600, 9, '#b98556');
      c.fillStyle = 'rgba(255,240,200,0.5)'; c.fillRect(-300, 262, 2600, 3);
      // light catching the piers
      for (let i = 0; i < 17; i++) { const x = -260 + i * 158 - 26; c.fillStyle = 'rgba(255,236,190,0.35)'; c.fillRect(x, 400, 9, 300); }
    });
    L(0.8, () => {
      hills(600, 44, 0.0019, 14, lin(0, 560, 0, 804, [[0, '#7d9a4c'], [1, '#55732f']]));
      for (let i = 0; i < 9; i++) P.cypress(c, 120 + i * 67 + (i % 3) * 22, ridgeY(120 + i * 67, 600, 44, 0.0019, 14) + 10, 96 + (i * 37 % 50), '#2f4a22');
      haze(560, 700, '#f6e7a6', 0, 0.25);
    });
    const vp = [1330, 548];
    L(1, () => {
      hills(672, 40, 0.0016, 21, lin(0, 620, 0, 820, [[0, '#6a8a3c'], [0.5, '#4d6c2a'], [1, '#2c421a']]), { oct: 2 });
      // the road: stone, straight, to the horizon
      const rl = [520, 860], rr = [1560, 860];
      c.fillStyle = lin(0, vp[1], 0, 820, [[0, '#f0dcae'], [0.4, '#c9ae86'], [1, '#8a735a']]);
      poly([[vp[0] - 5, vp[1]], [vp[0] + 5, vp[1]], rr, rl], c.fillStyle);
      c.save(); c.beginPath(); c.moveTo(vp[0] - 5, vp[1]); c.lineTo(vp[0] + 5, vp[1]); c.lineTo(rr[0], rr[1]); c.lineTo(rl[0], rl[1]); c.clip();
      c.strokeStyle = 'rgba(70,50,30,0.35)';
      for (let i = 1; i < 30; i++) { const u = Math.pow(i / 30, 2.4), y = lerp(vp[1], 860, u); c.lineWidth = 0.6 + u * 2.4; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
      for (let i = -3; i <= 3; i++) { c.lineWidth = 1.4; c.beginPath(); c.moveTo(vp[0], vp[1]); c.lineTo(1040 + i * 170, 860); c.stroke(); }
      c.fillStyle = lin(0, vp[1], 0, 800, [[0, 'rgba(255,240,200,0.5)'], [1, 'rgba(255,240,200,0)']]); c.fillRect(0, vp[1], W, 300);
      c.restore();
      // kerb stones, a milestone, travellers
      c.strokeStyle = '#6e5a44'; c.lineWidth = 5; c.beginPath(); c.moveTo(vp[0] - 5, vp[1]); c.lineTo(rl[0], rl[1]); c.moveTo(vp[0] + 5, vp[1]); c.lineTo(rr[0], rr[1]); c.stroke();
      c.fillStyle = lin(1590, 0, 1650, 0, [[0, '#e8d2a6'], [1, '#7c684e']]); c.beginPath(); c.roundRect(1590, 610, 58, 140, [26, 26, 4, 4]); c.fill();
      txt('IV', 1619, 660, { size: 26, font: F.display, weight: 600, color: '#5a4630', a: 0.8 });
      const dk = '#3a2c1c';
      for (let i = 0; i < 6; i++) { // a marching column, tiny with distance
        const u = 0.16 + i * 0.035 + p * 0.03, y = lerp(vp[1], 860, Math.pow(u, 1.6)), x = lerp(vp[0], 1070, Math.pow(u, 1.6)), h = 14 + u * 160;
        figure(x + (i % 2) * h * 0.3, y, h, { fill: dk, robe: false, face: -1, stride: Math.sin(t * 5 + i), armF: [0.3 * Math.sin(t * 5 + i), 0.2] });
        line(x + (i % 2) * h * 0.3 + h * 0.1, y - h * 0.5, x + (i % 2) * h * 0.3 + h * 0.12, y - h * 1.3, dk, Math.max(1, h * 0.02));
      }
      P.cypress(c, 420, 700, 330, '#22381a'); P.cypress(c, 330, 720, 250, '#1d3016'); P.cypress(c, 1760, 730, 380, '#1d3016');
    });
    rays(sx, sy, { n: 16, a0: -0.25, a1: 1.1, len: 2000, hex: '#fff0be', alpha: 0.12, t, seed: 2, width: 0.45 });
    flare(sx, sy, 1500, '#ffeccc', 0.3, 4);
    L(1.5, () => { hills(796, 16, 0.006, 51, '#16240f', { oct: 2 }); });
    motes({ n: 70, seed: 17, t, hex: '#fff6d0', alpha: 0.6, size: 2.2 });
  };

  S.pantheon = (c, t, d, p) => {
    const L = camera(p, { z0: 1.0, z1: 1.1, fx: 960, fy: 190 });
    const cx = 960;
    const ring = u => ({ cy: lerp(168, 300, Math.pow(u, 1.25)), rx: lerp(118, 1160, Math.pow(u, 1.12)), ry: lerp(58, 388, Math.pow(u, 1.2)) });
    const pt = (u, a) => { const r = ring(u); return [cx + r.rx * Math.cos(a), r.cy + r.ry * Math.sin(a)]; };
    // where the beam lands (drifts slowly, as the day does)
    const spotA = 0.62 + p * 0.05, spot = pt(0.86, spotA);
    L(1, () => {
      c.fillStyle = '#120c09'; c.fillRect(-300, -300, 2500, 1500);
      // dome shell
      const b = ring(1);
      c.fillStyle = rad(cx, 170, 60, 1200, [[0, '#8a6a4c'], [0.25, '#5e4532'], [0.7, '#33241a'], [1, '#1c130d']]);
      c.beginPath(); c.ellipse(cx, b.cy, b.rx, b.ry, 0, 0, TAU); c.fill();
      // coffers: five rings of twenty-eight
      const N = 28, bands = [[0.2, 0.34], [0.36, 0.5], [0.52, 0.66], [0.68, 0.82], [0.84, 0.985]];
      for (const [u0, u1] of bands) {
        for (let j = 0; j < N; j++) {
          const a0 = (j + 0.13) * TAU / N, a1 = (j + 0.87) * TAU / N, am = (a0 + a1) / 2;
          const facing = 0.5 + 0.5 * Math.cos(am - spotA), dist = Math.hypot(pt((u0 + u1) / 2, am)[0] - spot[0], pt((u0 + u1) / 2, am)[1] - spot[1]);
          const lum = 0.1 + 0.25 * facing + 0.9 * Math.exp(-dist / 260);
          const q = [pt(u0, a0), pt(u0, a1), pt(u1, a1), pt(u1, a0)];
          poly(q, mix('#170f0a', '#c79a66', clamp(lum * 0.55)));
          const ins = (k) => { const ua = lerp(u0, u1, k), ub = lerp(u1, u0, k), aa = lerp(a0, a1, k * 0.9), ab = lerp(a1, a0, k * 0.9); return [pt(ua, aa), pt(ua, ab), pt(ub, ab), pt(ub, aa)]; };
          poly(ins(0.16), mix('#0f0906', '#a67a4c', clamp(lum * 0.4)));
          poly(ins(0.3), mix('#090503', '#8a6238', clamp(lum * 0.3)));
          // lit lower lip
          const e = ins(0.02); line(e[2][0], e[2][1], e[3][0], e[3][1], col('#ffe2b0', 0.1 + 0.35 * clamp(lum - 0.2)), 1.6);
        }
      }
      // drum: cornice, attic niches, columns, floor
      const wallTop = y => { c.beginPath(); c.ellipse(cx, b.cy, b.rx, b.ry, 0, 0, Math.PI); c.lineTo(cx - b.rx - 300, b.cy); c.lineTo(cx - b.rx - 300, 1200); c.lineTo(cx + b.rx + 300, 1200); c.lineTo(cx + b.rx + 300, b.cy); c.closePath(); };
      c.save(); wallTop(); c.clip();
      c.fillStyle = lin(0, 560, 0, 804, [[0, '#3f2d20'], [1, '#18100b']]); c.fillRect(-300, 300, 2500, 700);
      for (let j = 0; j < 15; j++) {
        const a = Math.PI * (0.06 + 0.88 * j / 14), q = pt(1, a), x = q[0], y = q[1];
        const s = 0.55 + 0.45 * Math.sin(a);
        rrect(x - 22 * s, y + 26 * s, 44 * s, 62 * s, 3, 'rgba(10,6,4,0.8)');
        column(x + 62 * s, y + 250 * s, 20 * s, 150 * s, { fill: '#2a1d14', lit: '#8a6a48', side: x < spot[0] ? 1 : -1 });
      }
      c.strokeStyle = 'rgba(210,170,120,0.35)'; c.lineWidth = 5; c.beginPath(); c.ellipse(cx, b.cy + 8, b.rx, b.ry, 0, 0.05, Math.PI - 0.05); c.stroke();
      c.strokeStyle = 'rgba(210,170,120,0.2)'; c.lineWidth = 3; c.beginPath(); c.ellipse(cx, b.cy + 100, b.rx, b.ry, 0, 0.05, Math.PI - 0.05); c.stroke();
      c.restore();
      c.fillStyle = lin(0, 760, 0, 804, [[0, '#2a1d14'], [1, '#0c0705']]); c.fillRect(-300, 770, 2500, 100);
      // the oculus
      const o = ring(0);
      glow(cx, o.cy, 520, '#ffe6b4', 0.5);
      c.fillStyle = rad(cx, o.cy, 0, o.rx, [[0, '#ffffff'], [0.7, '#fff6da'], [1, '#ffe2a2']]);
      c.beginPath(); c.ellipse(cx, o.cy, o.rx, o.ry, 0, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(120,90,60,0.9)'; c.lineWidth = 7; c.beginPath(); c.ellipse(cx, o.cy, o.rx + 5, o.ry + 4, 0, 0, TAU); c.stroke();
      // the shaft of light and where it falls
      beam(cx, o.cy, 190, lerp(cx, spot[0], 1.18), lerp(o.cy, spot[1], 1.18), 320, '#ffe9bc', 0.6, 0.08, 4);
      c.save(); c.translate(spot[0], spot[1]); c.rotate(0.5); c.scale(1.5, 0.8);
      glow(0, 0, 170, '#fff2cf', 0.85); glow(0, 0, 330, '#ffc878', 0.3);
      c.restore();
      // people on the marble floor, very small
      const R = rng(9);
      for (let i = 0; i < 12; i++) { const x = 380 + R() * 1200; figure(x, 792 - R() * 14, 46 + R() * 8, { fill: '#0b0705', rim: '#c79a66', light: x < spot[0] ? 1 : -1, face: x < 960 ? 1 : -1, armF: [R() < 0.3 ? 2.4 : 0.2, 0.2] }); }
    });
    // dust in the beam
    const ax = spot[0] - cx, ay = spot[1] - 168, al = Math.hypot(ax, ay);
    L(1, () => motes({ n: 240, seed: 23, t, hex: '#fff3d2', alpha: 1, size: 2.3, speed: 0.6, mask: (x, y) => {
      const u = ((x - cx) * ax + (y - 168) * ay) / (al * al), dd = Math.abs((x - cx) * ay - (y - 168) * ax) / al;
      return u < 0 || u > 1.05 ? 0 : clamp(1.15 - dd / lerp(95, 150, u));
    } }));
    flare(cx, lerp(168, 150, p), 1100, '#ffe9c4', 0.26, 4);
  };

  // ---------------------------------------------------------------------------
  // III · FAITH AND THE CATHEDRAL
  // ---------------------------------------------------------------------------
  S.monk = (c, t, d, p) => {
    const L = camera(p, { z0: 1.02, z1: 1.13, fx: 1220, fy: 440 });
    const fl = flicker(t, 3, 0.1);
    const fx = 1520, fy = 372; // candle flame
    L(0.3, () => {
      c.fillStyle = '#0c0907'; c.fillRect(-300, -300, 2500, 1500);
      c.fillStyle = rad(fx, fy, 40, 1150, [[0, col('#6a4424', 0.95 * fl)], [0.4, col('#3a2414', 0.9)], [1, '#0c0806']]);
      c.fillRect(-300, -300, 2500, 1500);
      c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 2;
      for (let r = 0; r < 12; r++) { const y = r * 72 - 20; c.beginPath(); c.moveTo(-300, y); c.lineTo(2300, y); c.stroke(); for (let k = 0; k < 16; k++) { const x = k * 170 + (r % 2) * 85 - 200; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 72); c.stroke(); } }
      // a narrow window: moonlight
      c.save(); c.beginPath(); archPath(250, 400, 250, 520); c.clip();
      c.fillStyle = lin(0, 100, 0, 520, [[0, '#1c2c58'], [1, '#33507e']]); c.fillRect(200, 100, 260, 440);
      stars({ n: 26, seed: 6, t, x: 250, y: 170, w: 150, h: 300, size: 1.2 });
      glow(352, 250, 70, '#dfe9ff', 0.9); circle(352, 250, 17, '#f4f7ff');
      c.restore();
      c.strokeStyle = '#090705'; c.lineWidth = 7; c.beginPath(); c.moveTo(325, 176); c.lineTo(325, 520); c.stroke(); c.beginPath(); c.moveTo(250, 340); c.lineTo(400, 340); c.stroke();
      beam(325, 330, 150, 760, 860, 420, '#5f86d8', 0.14, 0.0);
      // shelves of codices
      rect(1640, 120, 520, 14, '#1b120b'); rect(1640, 300, 520, 14, '#1b120b');
      const R = rng(4);
      for (let s = 0; s < 2; s++) for (let i = 0; i < 12; i++) { const hh = 90 + R() * 60, ww = 22 + R() * 20; rect(1660 + i * 40, 120 + s * 180 - hh, ww, hh, mix('#1c100a', ['#5a2418', '#3a3a20', '#4a3018'][i % 3], 0.45 + 0.3 * fl)); }
    });
    L(0.6, () => {
      // a second scribe, further down the room
      P.candle(c, 640, 492, 0.5, t + 3, { seed: 8, glowR: 300 });
      rect(540, 552, 190, 10, '#17100a'); rect(556, 562, 12, 160, '#17100a'); rect(700, 562, 12, 160, '#17100a');
      figure(470, 724, 270, { face: 1, fill: '#0e0906', rim: '#7a4a22', light: 1, sit: true, head: 'hood', bend: 0.32, armF: [1.0, 0.7] });
    });
    // the open codex on its slanted desk: [x + px + 0.16 py, y - 0.21 px + py]
    const skew = (x, y, px, py) => [x + px + 0.16 * py, y - 0.21 * px + py];
    const PW = 236, PH = 150, pl = [1010, 430], pr = [1010 + PW + 8, 430 - 0.21 * (PW + 8)];
    const wr = clamp(p * 1.04), nLines = 10, lineW = PW - 30;
    let nib = skew(pl[0], pl[1], 16, 22);
    L(1, () => {
      c.fillStyle = lin(0, 700, 0, 804, [[0, '#2a1a0e'], [1, '#090604']]); c.fillRect(-300, 722, 2500, 200);
      const dk = '#1d130b';
      poly([[980, 590], [1540, 472], [1548, 494], [988, 614]], '#3a2616'); // desk board edge
      poly([[980, 590], [1540, 472], [1560, 330], [1000, 448]], '#2a1a0f');
      rect(1060, 600, 20, 180, dk); rect(1470, 500, 20, 280, dk); rect(1040, 764, 480, 16, dk);
      const pg = (o, sk, shade) => { c.save(); c.transform(1, -0.21, 0.16, 1, o[0], o[1]); c.fillStyle = lin(0, 0, PW, 0, [[0, mix('#ead9b0', '#6a4a2c', shade)], [1, mix('#f3e3bc', '#8a6a44', shade * 0.5)]]); c.fillRect(0, 0, PW, PH); sk(); c.restore(); };
      const ink = 'rgba(46,26,10,0.8)';
      pg(pl, () => { // the page being written
        c.fillStyle = ink;
        let rem = nLines * lineW * wr;
        for (let i = 0; i < nLines; i++) { const lw = Math.min(lineW, rem); if (lw <= 0) break; c.fillRect(15, 22 + i * 12.4, lw, 3.4); nib = skew(pl[0], pl[1], 15 + lw, 22 + i * 12.4); rem -= lw; }
        c.fillStyle = '#8c1c22'; c.fillRect(15, 9, 70, 3.4);
      }, 0.22);
      pg(pr, () => { // the exemplar, with its illuminated initial
        rrect(14, 14, 58, 58, 3, '#c9972e'); rrect(19, 19, 48, 48, 2, '#8c1c22');
        txt('I', 43, 44, { size: 46, font: F.black, color: '#f6d98a' });
        c.strokeStyle = '#2a5a9a'; c.lineWidth = 2.5; c.strokeRect(11, 11, 64, 64);
        c.fillStyle = ink; for (let i = 0; i < nLines; i++) c.fillRect(i < 5 ? 84 : 15, 22 + i * 12.4, i < 5 ? PW - 99 : lineW, 3.4);
        c.fillStyle = '#2a5a9a'; c.fillRect(15, PH - 9, 40, 3);
      }, 0.06);
      c.fillStyle = 'rgba(30,16,6,0.5)'; poly([skew(pl[0], pl[1], PW, 0), skew(pr[0], pr[1], 0, 0), skew(pr[0], pr[1], 0, PH), skew(pl[0], pl[1], PW, PH)], c.fillStyle);
    });
    L(1, () => {
      const dk = '#120b07';
      rect(900, 640, 170, 14, dk); rect(920, 654, 14, 130, dk); rect(1040, 654, 14, 130, dk); // stool
      // the scribe; his writing hand follows the line
      const grip = [nib[0] + 6 + Math.sin(t * 14) * 1.5, nib[1] - 30];
      const f = figure(985, 786, 500, { face: 1, fill: dk, sit: true, head: 'hood', bend: 0.3, nod: 0.2, reachF: grip, armB: [0.9, 0.9] });
      // quill
      const qx = nib[0] + 62, qy = nib[1] - 118;
      c.strokeStyle = '#e8dcc2'; c.lineWidth = 2.6; c.lineCap = 'round';
      c.beginPath(); c.moveTo(nib[0], nib[1]); c.lineTo(qx, qy); c.stroke();
      c.fillStyle = 'rgba(236,226,200,0.92)';
      c.beginPath(); c.moveTo(lerp(nib[0], qx, 0.42), lerp(nib[1], qy, 0.42)); c.quadraticCurveTo(qx - 22, qy + 10, qx + 5, qy - 12); c.quadraticCurveTo(qx + 20, qy + 26, lerp(nib[0], qx, 0.46) + 7, lerp(nib[1], qy, 0.46) + 4); c.fill();
      // candlelight catching hood, face and hand
      glow(f.head[0] + 40, f.head[1] + 6, 60, '#ffa850', 0.3 * fl);
      glow(f.hands[0][0], f.hands[0][1], 34, '#ffb060', 0.3 * fl);
      // ink horn and candle on a ledge
      rect(1470, 490, 190, 12, '#3a2616'); rect(1640, 502, 14, 280, '#1d130b');
      c.fillStyle = '#0a0705'; c.fillRect(1582, 466, 34, 24); c.beginPath(); c.ellipse(1599, 466, 17, 6, 0, 0, TAU); c.fill();
      P.candle(c, fx, fy, 0.92, t, { seed: 3, glowR: 520 });
    });
    L(1, () => motes({ n: 70, seed: 37, t, hex: '#ffcf8a', alpha: 0.85, size: 2.2, x: 1000, y: 60, w: 900, h: 560, mask: (x, y) => clamp(1.3 - Math.hypot(x - fx, y - fy) / 420) }));
    flare(fx + 40, fy - 30, 620, '#ffb060', 0.2 * fl, 3);
  };

  S.masons = (c, t, d, p) => {
    const L = camera(p, { z0: 1.0, z1: 1.09, fx: 1100, fy: 380, dy: 18 });
    const sx = 1150, sy = 330;
    L(0, () => { sky([[0, '#d9a868'], [0.45, '#f3d49c'], [1, '#fbe9c2']]); glow(sx, sy, 1000, '#fff3cf', 0.85); glow(sx, sy, 260, '#ffffff', 0.8); });
    L(0.2, () => { clouds({ y: 220, amp: 120, n: 26, seed: 3, t, hex: '#fff6e0', alpha: 0.3, r: 200, drift: 4 }); hills(660, 30, 0.002, 6, 'rgba(190,150,104,0.7)'); });
    L(0.5, () => {
      // town roofs in the mist
      const R = rng(12); c.fillStyle = 'rgba(160,116,78,0.7)';
      for (let i = 0; i < 30; i++) { const x = -100 + i * 74 + R() * 20, h = 50 + R() * 70, w = 60 + R() * 30; c.beginPath(); c.moveTo(x, 720); c.lineTo(x, 720 - h); c.lineTo(x + w / 2, 720 - h - 34); c.lineTo(x + w, 720 - h); c.lineTo(x + w, 720); c.fill(); }
      haze(560, 760, '#ffe6b8', 0, 0.6);
    });
    const dk = '#2a1b12', dk2 = '#1c120b';
    const lift = E.io(clamp(p * 1.1));
    L(0.85, () => {
      rays(sx, sy, { n: 22, a0: 0, a1: TAU, len: 1500, hex: '#ffe6b0', alpha: 0.11, t, seed: 5, width: 0.5 });
      // the rising arcade: two finished bays, a third on its centring
      c.fillStyle = lin(0, 60, 0, 760, [[0, '#4a3222'], [1, dk]]);
      c.beginPath(); c.rect(250, 150, 980, 640);
      archPath(330, 600, 470, 800, true, 280); archPath(700, 970, 470, 800, true, 280);
      c.fill('evenodd');
      // clerestory openings, stepped unfinished top
      c.fillStyle = dk; poly([[250, 150], [250, 96], [470, 96], [470, 60], [720, 60], [720, 110], [960, 110], [960, 150]], c.fillStyle);
      c.save(); c.globalCompositeOperation = 'destination-out'; c.beginPath(); archPath(520, 590, 110, 150, true, 46); archPath(610, 680, 110, 150, true, 46); c.fill(); c.restore();
      // buttress pier and the third arch being turned over timber centring
      rect(1230, 240, 86, 560, dk); rect(1600, 330, 80, 470, dk);
      c.strokeStyle = '#3a281a'; c.lineWidth = 9; c.lineCap = 'butt';
      c.beginPath(); c.moveTo(1316, 470); c.quadraticCurveTo(1330, 300, 1458, 196); c.quadraticCurveTo(1586, 300, 1600, 470); c.stroke();
      c.lineWidth = 5; for (let i = 0; i < 7; i++) { const u = i / 6, x = 1330 + u * 256; c.beginPath(); c.moveTo(x, 470); c.lineTo(1458, 470 - 0); c.moveTo(x, 470); c.lineTo(1458 + (x - 1458) * 0.55, 470 - 250 + Math.abs(x - 1458) * 0.75); c.stroke(); }
      c.beginPath(); c.moveTo(1316, 470); c.lineTo(1600, 470); c.stroke();
      // voussoirs laid so far (stone by stone)
      const nV = 12, laid = Math.floor(3 + lift * 4);
      for (let i = 0; i < nV; i++) {
        if (i >= laid && i < nV - laid) continue;
        const u = (i + 0.5) / nV, q = bez([1316, 470], [1324, 250], [1400, 190], [1458, 176], Math.min(1, u * 2));
        const q2 = u > 0.5 ? [2916 - bez([1316, 470], [1324, 250], [1400, 190], [1458, 176], 2 - u * 2)[0], bez([1316, 470], [1324, 250], [1400, 190], [1458, 176], 2 - u * 2)[1]] : q;
        c.save(); c.translate(q2[0], q2[1]); c.rotate((u - 0.5) * 2.4); rrect(-22, -20, 44, 34, 3, '#3d2a1c'); c.restore();
      }
      // scaffolding
      c.strokeStyle = dk2; c.lineWidth = 6;
      for (const x of [1250, 1420, 1690]) { c.beginPath(); c.moveTo(x, 800); c.lineTo(x + 6, 130); c.stroke(); }
      for (const y of [560, 380, 220]) { c.lineWidth = 7; c.beginPath(); c.moveTo(1236, y); c.lineTo(1712, y - 8); c.stroke(); }
      c.lineWidth = 3; c.beginPath(); c.moveTo(1250, 560); c.lineTo(1420, 380); c.moveTo(1420, 560); c.lineTo(1690, 380); c.moveTo(1250, 380); c.lineTo(1420, 220); c.stroke();
      c.lineWidth = 4; c.beginPath(); c.moveTo(1290, 800); c.lineTo(1350, 560); c.moveTo(1316, 800); c.lineTo(1376, 560); c.stroke(); // ladder
      for (let i = 0; i < 8; i++) { const u = i / 8; c.beginPath(); c.moveTo(1290 + u * 60, 800 - u * 240); c.lineTo(1316 + u * 60, 800 - u * 240); c.stroke(); }
      // masons aloft
      figure(1500, 376, 96, { fill: dk2, robe: false, face: -1, bend: 0.5, armF: [0.9, 0.4], head: 'cap' });
      figure(1640, 216, 92, { fill: dk2, robe: false, face: -1, armF: [1.5 + 0.2 * Math.sin(t * 3), 0.8], armB: [1.2, 0.9] });
      // the great wheel crane and its load
      c.strokeStyle = dk2; c.lineWidth = 9; c.beginPath(); c.moveTo(1100, 150); c.lineTo(1150, 20); c.lineTo(1380, -50); c.stroke();
      c.save(); c.translate(1090, 110); c.rotate(t * 0.9);
      c.lineWidth = 8; c.beginPath(); c.arc(0, 0, 56, 0, TAU); c.stroke(); c.lineWidth = 4;
      for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(i * TAU / 8) * 56, Math.sin(i * TAU / 8) * 56); c.stroke(); }
      c.restore();
      const by = lerp(690, 250, lift), bx = 1372 + Math.sin(t * 1.3) * 6;
      c.strokeStyle = '#1c120b'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(1376, -50); c.lineTo(bx, by - 30); c.stroke();
      c.beginPath(); c.moveTo(bx, by - 30); c.lineTo(bx - 32, by); c.moveTo(bx, by - 30); c.lineTo(bx + 32, by); c.stroke();
      rrect(bx - 38, by, 76, 52, 3, '#4a3424');
      c.fillStyle = 'rgba(255,230,180,0.35)'; c.fillRect(bx - 38, by, 5, 52);
    });
    L(1, () => {
      // ground, cut stone, the masons at work
      hills(770, 12, 0.005, 2, lin(0, 740, 0, 804, [[0, '#3a2718'], [1, '#150d08']]), { oct: 2 });
      rrect(430, 690, 150, 84, 4, '#4a3526'); rrect(560, 718, 110, 60, 4, '#3d2b1e'); rrect(1500, 716, 170, 64, 4, '#3d2b1e');
      c.fillStyle = 'rgba(255,228,180,0.4)'; c.fillRect(430, 690, 150, 4); c.fillRect(1500, 716, 170, 4);
      const sw = Math.pow(Math.abs(Math.sin(t * 3.2)), 3);
      const m1 = figure(700, 778, 300, { fill: dk2, rim: '#ffd9a0', light: 1, robe: false, face: -1, bend: 0.45, armF: [0.7, 0.9], armB: [1.9 - sw * 1.1, 0.7], head: 'cap', stride: 0.5 });
      // mallet + chisel
      c.save(); c.translate(m1.hands[1][0], m1.hands[1][1]); c.rotate(-0.4 - sw * 0.8); rect(-5, -52, 10, 60, dk2); rrect(-22, -76, 44, 30, 4, dk2); c.restore();
      line(m1.hands[0][0], m1.hands[0][1], m1.hands[0][0] - 44, m1.hands[0][1] + 30, dk2, 5);
      if (sw > 0.85) glow(m1.hands[0][0] - 46, m1.hands[0][1] + 32, 26, '#fff0c8', 0.9);
      figure(1740, 780, 290, { fill: dk2, rim: '#ffd9a0', light: -1, robe: false, face: -1, lean: 0.12, armF: [2.3, 0.5], armB: [2.5, 0.4], stride: 0.7 }); // hauling the rope
      line(1688, 560, 1380, -50, dk2, 2.5);
      // master mason with the plan
      const mm = figure(1010, 784, 310, { fill: dk2, rim: '#ffd9a0', light: 1, face: 1, head: 'beard', armF: [1.3, 0.6], armB: [0.8, 1.2] });
      c.save(); c.translate(mm.hands[0][0], mm.hands[0][1]); c.rotate(-0.2); rrect(-8, -50, 70, 80, 2, '#d9c49a'); c.restore();
    });
    motes({ n: 160, seed: 47, t, hex: '#fff0cc', alpha: 0.75, size: 2.5, speed: 1.4 });
    flare(sx, sy, 1200, '#ffe9c0', 0.22, 4);
  };

  /** Rose window. */
  P.rose = (c, x, y, r, t, glowA = 1) => {
    const pal = ['#d0263c', '#2a5fe0', '#f6b93a', '#2c9f76', '#7d3fc0', '#e8642a'];
    const lite = (px, py, pr, hex, k) => { const s = 0.75 + 0.25 * n1(t * 0.7 + k, 9); c.fillStyle = rad(px, py, 0, pr, [[0, mix(hex, '#ffffff', 0.55 * s)], [0.55, col(hex, 1)], [1, mix(hex, '#000000', 0.35)]]); };
    glow(x, y, r * 2.3, '#ffcf9a', 0.35 * glowA);
    circle(x, y, r * 1.08, '#090605');
    // outer ring of sixteen petals
    for (let i = 0; i < 16; i++) {
      const a = i * TAU / 16;
      c.save(); c.translate(x, y); c.rotate(a);
      lite(0, -r * 0.8, r * 0.26, pal[i % 2 ? 0 : 1], i);
      c.beginPath(); c.moveTo(-r * 0.045, -r * 0.6); c.lineTo(-r * 0.155, -r * 0.84); c.quadraticCurveTo(-r * 0.16, -r * 1.0, 0, -r * 1.0); c.quadraticCurveTo(r * 0.16, -r * 1.0, r * 0.155, -r * 0.84); c.lineTo(r * 0.045, -r * 0.6); c.closePath(); c.fill();
      c.restore();
    }
    // inner ring of eight
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8 + TAU / 16;
      c.save(); c.translate(x, y); c.rotate(a);
      lite(0, -r * 0.42, r * 0.2, pal[2 + (i % 2) * 1], i + 20);
      c.beginPath(); c.moveTo(-r * 0.04, -r * 0.24); c.lineTo(-r * 0.15, -r * 0.44); c.quadraticCurveTo(-r * 0.13, -r * 0.57, 0, -r * 0.57); c.quadraticCurveTo(r * 0.13, -r * 0.57, r * 0.15, -r * 0.44); c.lineTo(r * 0.04, -r * 0.24); c.closePath(); c.fill();
      lite(0, -r * 0.535, r * 0.06, pal[4], i + 40); c.beginPath(); c.arc(r * 0.22, -r * 0.535, r * 0.05, 0, TAU); c.fill();
      c.restore();
    }
    lite(x, y, r * 0.2, pal[5], 60); c.beginPath(); c.arc(x, y, r * 0.19, 0, TAU); c.fill();
    lite(x, y, r * 0.1, pal[2], 61); c.beginPath(); c.arc(x, y, r * 0.09, 0, TAU); c.fill();
  };

  S.rose = (c, t, d, p) => {
    const L = camera(p, { z0: 1.0, z1: 1.12, fx: 960, fy: 300 });
    const rx = 960, ry = 300, rr = 215;
    L(0.9, () => {
      c.fillStyle = '#070505'; c.fillRect(-300, -300, 2500, 1500);
      // west wall, faintly lit
      c.fillStyle = rad(rx, ry, 100, 1100, [[0, '#3a2a26'], [0.5, '#1a1212'], [1, '#080606']]); c.fillRect(-300, -300, 2500, 1500);
      P.rose(c, rx, ry, rr, t);
      // lancets beneath
      const pal = ['#2a5fe0', '#d0263c', '#f6b93a', '#2a5fe0', '#d0263c'];
      for (let i = 0; i < 5; i++) {
        const x = 690 + i * 135 - 45;
        c.save(); c.beginPath(); archPath(x, x + 90, 640, 900, true, 90); c.clip();
        c.fillStyle = lin(0, 540, 0, 820, [[0, mix(pal[i], '#ffffff', 0.45)], [0.5, col(pal[i], 1)], [1, mix(pal[i], '#000000', 0.5)]]); c.fillRect(x, 520, 90, 400);
        c.strokeStyle = 'rgba(8,5,4,0.85)'; c.lineWidth = 3;
        for (let k = 0; k < 9; k++) { c.beginPath(); c.moveTo(x, 560 + k * 34); c.lineTo(x + 90, 560 + k * 34); c.stroke(); }
        c.beginPath(); c.moveTo(x + 45, 520); c.lineTo(x + 45, 900); c.stroke();
        c.restore();
      }
      glow(960, 700, 520, '#7f8fff', 0.14);
    });
    // coloured shafts through incense and dust
    L(1, () => {
      const hues = ['#ff5a66', '#5f8cff', '#ffcc66', '#7fd8b0', '#b07cff', '#ffb070'];
      for (let i = 0; i < 6; i++) {
        const a = (i - 2.5) * 0.14, k = 0.75 + 0.25 * n1(t * 0.5 + i * 2, 4);
        beam(rx + (i - 2.5) * 60, ry + 40, 70, rx + Math.sin(a) * 1100 - 150, ry + 1000, 300, hues[i], 0.34 * k, 0.03, 3);
      }
      motes({ n: 220, seed: 53, t, hex: '#ffe9d0', alpha: 0.9, size: 2.3, speed: 0.6, x: 300, y: 250, w: 1300, h: 600, mask: (x, y) => clamp(1.2 - Math.abs(x - (rx - 150 * (y - ry) / 1000)) / (120 + (y - ry) * 0.6)) });
    });
    L(1.25, () => {
      // nave piers and ribs framing the view
      const pier = (x, s) => {
        c.fillStyle = lin(x - 90 * s, 0, x + 90 * s, 0, [[0, '#050404'], [0.5, s > 0 ? '#1d1513' : '#1d1513'], [1, '#050404']]);
        c.fillRect(x - 70, -300, 140, 1400);
        c.fillStyle = 'rgba(255,200,160,0.07)'; c.fillRect(x + (s > 0 ? 52 : -60), -300, 8, 1400);
        c.fillStyle = '#040303'; c.fillRect(x - 86, 690, 172, 300);
      };
      pier(330, 1); pier(1590, -1);
      c.strokeStyle = '#060404'; c.lineWidth = 46; c.lineCap = 'butt';
      c.beginPath(); c.moveTo(330, 260); c.quadraticCurveTo(420, -160, 960, -260); c.stroke();
      c.beginPath(); c.moveTo(1590, 260); c.quadraticCurveTo(1500, -160, 960, -260); c.stroke();
    });
    L(1.7, () => {
      c.fillStyle = '#020202'; c.fillRect(-400, -300, 470, 1500); c.fillRect(1850, -300, 470, 1500);
      c.fillStyle = lin(0, 720, 0, 804, [[0, 'rgba(2,2,2,0)'], [1, '#020202']]); c.fillRect(0, 700, W, 120);
      // worshippers, small against the light
      const R = rng(71);
      for (let i = 0; i < 9; i++) { const x = 560 + i * 100 + R() * 40; figure(x, 800 + R() * 6, 120 + R() * 16, { fill: '#030202', face: x < 960 ? 1 : -1, head: i % 3 === 0 ? 'hood' : 'plain', nod: -0.2, armF: [0.5, 1.9], armB: [0.2, 0.2] }); }
    });
    flare(rx, ry, 900, '#ffd0b0', 0.16, 4);
  };
})();
