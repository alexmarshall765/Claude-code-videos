/* =============================================================================
 *  ODE — scenes IV–VI: Renaissance, exploration and science, liberty, Beethoven.
 * ========================================================================== */
(() => {
  'use strict';
  const O = window.ODE;
  const { W, H, TAU, clamp, lerp, E, seg, win, rng, hash, n1, fbm, flicker, col, mix, mix2, lin, rad, camera, sky, glow, flare, beam, rays, motes,
    haze, stars, clouds, hills, ridgeY, poly, rect, rrect, circle, ellipse, line, limb, strokeP, sample, bez, column, archPath, figure, crowd, F, txt } = O;
  const S = O.shots, P = O.props;

  /** Aged parchment / paper filling a rectangle. */
  P.parchment = (c, x, y, w, h, seed = 1, base = '#ead6a4', dark = '#c7a468') => {
    c.fillStyle = lin(x, y, x + w, y + h, [[0, base], [0.6, mix2(base, dark, 0.35)], [1, dark]]);
    c.fillRect(x, y, w, h);
    const R = rng(seed);
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    for (let i = 0; i < 40; i++) glow(x + R() * w, y + R() * h, 60 + R() * 200, R() < 0.5 ? '#8a6a34' : '#fff2cc', 0.06 + R() * 0.07, 'source-over');
    c.strokeStyle = 'rgba(110,80,40,0.06)'; c.lineWidth = 1;
    for (let i = 0; i < 90; i++) { const yy = y + R() * h; c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy + (R() - 0.5) * 8); c.stroke(); }
    c.restore();
  };
  /** Trace land outlines through a projection fn(lon, lat) -> [x, y] | null. */
  P.land = (c, proj, minPts = 0) => {
    c.beginPath();
    for (const ring of window.ODE_LAND) {
      if (ring.length / 2 < minPts) continue;
      let pen = false;
      for (let i = 0; i < ring.length; i += 2) {
        const q = proj(ring[i], ring[i + 1]);
        if (!q) { pen = false; continue; }
        if (pen) c.lineTo(q[0], q[1]); else { c.moveTo(q[0], q[1]); pen = true; }
      }
      c.closePath();
    }
  };
  /** A sheet of printed paper: two columns of black-letter lines and a red initial. */
  P.page = (c, x, y, w, h, { a = 1, lines = 1, tone = '#f1e3c0' } = {}) => {
    c.save(); c.globalAlpha *= a;
    c.fillStyle = lin(x, y, x + w, y + h, [[0, tone], [1, mix2(tone, '#a8875a', 0.45)]]); c.fillRect(x, y, w, h);
    const m = w * 0.1, cw = (w - m * 2.6) / 2, lh = h * 0.0235, n = Math.floor((h - m * 2.2) / lh);
    for (let col2 = 0; col2 < 2; col2++) for (let i = 0; i < n; i++) {
      if ((col2 * n + i) / (2 * n) > lines) break;
      const cx = x + m + col2 * (cw + m * 0.6), cy = y + m * 1.1 + i * lh, ini = col2 === 0 && i < 5;
      c.fillStyle = 'rgba(24,14,8,0.86)'; c.fillRect(cx + (ini ? cw * 0.3 : 0), cy, (ini ? cw * 0.7 : cw) * (0.92 + 0.08 * hash(i, col2 + 3)), lh * 0.5);
    }
    if (lines > 0.02) { c.fillStyle = '#a3201c'; c.fillRect(x + m, y + m * 1.1, cw * 0.25, lh * 4.6); c.fillStyle = '#2a4f9a'; c.fillRect(x + m + cw * 0.05, y + m * 1.1 + lh * 0.5, cw * 0.15, lh * 3.6); }
    c.restore();
  };

  // ---------------------------------------------------------------------------
  // IV · RENAISSANCE
  // ---------------------------------------------------------------------------
  S.duomo = (c, t, d, p) => {
    const L = camera(p, { z0: 1.0, z1: 1.1, fx: 1120, fy: 380 });
    const dusk = clamp(p);
    L(0, () => {
      sky([[0, mix('#2a2350', '#1c1a40', dusk)], [0.35, '#6a3f66'], [0.62, '#d0694a'], [0.82, '#f6a85a'], [1, '#ffd590']]);
      stars({ n: 120, seed: 9, t, alpha: 0.35 + 0.5 * dusk, h: 330 });
      glow(380, 640, 900, '#ffb866', 0.6);
    });
    L(0.12, () => { clouds({ y: 250, amp: 70, n: 24, seed: 4, t, hex: '#ff9a6a', alpha: 0.26, r: 180, drift: 3, mode: 'lighter' }); clouds({ y: 140, amp: 50, n: 14, seed: 6, t, hex: '#b06a9a', alpha: 0.2, r: 200, drift: 2, mode: 'lighter' }); });
    L(0.3, () => { hills(540, 50, 0.0013, 5, lin(0, 480, 0, 660, [[0, '#6a4468'], [1, '#a45a5a']])); haze(500, 660, '#ff9c66', 0, 0.4); });
    L(0.5, () => { hills(590, 30, 0.0022, 8, lin(0, 550, 0, 700, [[0, '#4c2f4c'], [1, '#7a4448']])); for (let i = 0; i < 14; i++) P.cypress(c, 60 + i * 140 + (i % 3) * 30, ridgeY(60 + i * 140, 590, 30, 0.0022, 8) + 6, 44 + (i * 13 % 30), '#3a2238'); });
    const lit = '#f79a56', shade = '#4a2436', mid = '#b8573a';
    L(1, () => {
      // campanile
      c.fillStyle = lin(640, 0, 716, 0, [[0, '#ffd0a0'], [0.3, '#e8a878'], [1, '#6a3c40']]); c.fillRect(640, 196, 76, 440);
      rect(634, 186, 88, 12, '#f6c698');
      c.fillStyle = 'rgba(40,18,30,0.75)';
      for (const [y, hh] of [[220, 56], [296, 56], [372, 70], [462, 70]]) { c.beginPath(); archPath(656, 674, y + 18, y + hh, true, 18); archPath(682, 700, y + 18, y + hh, true, 18); c.fill(); }
      c.fillStyle = 'rgba(255,220,180,0.4)'; for (const y of [282, 358, 448, 540]) c.fillRect(640, y, 76, 3);
      // nave
      c.fillStyle = lin(700, 0, 1010, 0, [[0, '#e09a6a'], [1, '#70404a']]); c.fillRect(712, 486, 300, 160);
      poly([[706, 486], [1012, 486], [1012, 462], [728, 462]], mid);
      // tribunes (half-domes) around the crossing
      for (const x of [972, 1268]) { c.fillStyle = lin(x - 70, 0, x + 70, 0, [[0, lit], [1, shade]]); c.beginPath(); c.arc(x, 520, 70, Math.PI, 0); c.fill(); c.fillRect(x - 70, 520, 140, 120); }
      // drum
      c.fillStyle = lin(962, 0, 1278, 0, [[0, '#ffd2a4'], [0.35, '#e0a074'], [1, '#5a3040']]); c.fillRect(962, 412, 316, 96);
      rect(954, 404, 332, 12, '#f8d0a4'); rect(954, 500, 332, 8, '#d9a074');
      for (let i = 0; i < 3; i++) circle(1016 + i * 104, 458, 21, 'rgba(40,18,30,0.8)', 'rgba(255,225,190,0.6)', 2.5);
      // Brunelleschi's dome
      const domeP = () => { c.beginPath(); c.moveTo(966, 406); c.bezierCurveTo(966, 300, 1040, 214, 1096, 196); c.lineTo(1144, 196); c.bezierCurveTo(1200, 214, 1274, 300, 1274, 406); c.closePath(); };
      domeP(); c.fillStyle = lin(966, 0, 1274, 0, [[0, '#ffa864'], [0.3, '#d9663a'], [0.62, '#93402e'], [1, '#4a2032']]); c.fill();
      c.save(); domeP(); c.clip();
      c.strokeStyle = 'rgba(60,20,20,0.16)'; c.lineWidth = 1.5; for (let i = 0; i < 16; i++) { const y = 210 + i * 13; c.beginPath(); c.moveTo(940, y); c.lineTo(1300, y); c.stroke(); }
      c.restore();
      c.lineCap = 'round';
      for (const k of [-1, -0.52, 0, 0.52, 1]) { // white marble ribs
        c.strokeStyle = k <= 0 ? '#ffe9d0' : '#c9a08c'; c.lineWidth = k === 0 ? 9 : 7;
        c.beginPath(); c.moveTo(1120 + k * 22, 198); c.bezierCurveTo(1120 + k * 86, 226, 1120 + k * 150, 300, 1120 + k * 152, 406); c.stroke();
      }
      // lantern
      c.fillStyle = lin(1094, 0, 1146, 0, [[0, '#fff0da'], [1, '#8a6064']]); c.fillRect(1098, 140, 44, 58);
      rect(1090, 190, 60, 8, '#f6d6b0'); rect(1092, 134, 56, 8, '#f6d6b0');
      c.fillStyle = 'rgba(40,18,30,0.7)'; for (let i = 0; i < 3; i++) { c.beginPath(); archPath(1104 + i * 12, 1112 + i * 12, 158, 190); c.fill(); }
      poly([[1096, 134], [1120, 92], [1144, 134]], mid); circle(1120, 86, 8, '#ffd98a'); glow(1120, 86, 26, '#ffd98a', 0.7);
      line(1120, 78, 1120, 62, '#ffd98a', 2.5); line(1113, 69, 1127, 69, '#ffd98a', 2.5);
      // Palazzo Vecchio's tower, far left
      c.fillStyle = lin(300, 0, 350, 0, [[0, '#d99468'], [1, '#5a3240']]); c.fillRect(310, 330, 34, 300); c.fillRect(300, 300, 54, 36); c.fillRect(316, 262, 22, 40);
      poly([[314, 262], [327, 238], [340, 262]], '#5a3240');
    });
    L(1.05, () => {
      // roofs of the city, windows lighting one by one
      const R = rng(33);
      for (let row = 0; row < 3; row++) {
        const y = 600 + row * 34;
        for (let x = -200; x < 2200;) {
          const w = 50 + R() * 90, h = 30 + R() * 46, f = R();
          c.fillStyle = lin(x, 0, x + w, 0, [[0, mix('#c9603c', '#e8885a', f)], [1, mix('#55283a', '#6a3040', f)]]);
          c.beginPath(); c.moveTo(x, y + 60); c.lineTo(x, y - h); c.lineTo(x + w * 0.5, y - h - 16); c.lineTo(x + w, y - h); c.lineTo(x + w, y + 60); c.fill();
          const on = R() < 0.25 + 0.6 * clamp(dusk * 1.3 - R() * 0.5);
          if (on) { const wx = x + w * (0.25 + R() * 0.5), wy = y - h * 0.5; rect(wx, wy, 5, 8, '#ffd27a'); glow(wx + 2, wy + 4, 16, '#ffb84a', 0.55 * flicker(t, row * 100 + x | 0, 0.1)); }
          x += w + 2;
        }
      }
      haze(560, 720, '#ff9060', 0.22, 0);
    });
    L(1.1, () => P.birds(c, 900 + t * 10, 260, 9, t, 'rgba(30,14,30,0.8)', 3, 240, 7));
    L(1.5, () => {
      hills(772, 26, 0.003, 61, '#0f0810', { oct: 2 });
      P.cypress(c, 120, 790, 420, '#0f0810'); P.cypress(c, 250, 800, 300, '#0f0810'); P.cypress(c, 1790, 800, 380, '#0f0810');
    });
    flare(380, 640, 1500, '#ffb070', 0.22, 4);
    motes({ n: 50, seed: 3, t, hex: '#ffd0a0', alpha: 0.5 });
  };

  S.anatomy = (c, t, d, p) => {
    const L = camera(p, { z0: 1.0, z1: 1.1, fx: 960, fy: 400, dx: 16 });
    const fl = flicker(t, 6, 0.09);
    const cx = 960, ink = col('#4a2410', 0.86);
    // the drawing, as a list of strokes revealed in order
    const circ = (x, y, r, a0 = 0, a1 = TAU) => sample(u => [x + r * Math.cos(a0 + (a1 - a0) * u), y + r * Math.sin(a0 + (a1 - a0) * u)], 60);
    const mir = pts => pts.map(q => [2 * cx - q[0], q[1]]);
    const strokes = [
      [circ(cx, 410, 262, -Math.PI / 2, TAU - Math.PI / 2), 2.2], // the circle
      [[[748, 222], [1172, 222], [1172, 646], [748, 646], [748, 222]], 2.2], // the square
      [circ(cx, 258, 34), 2.4],
    ];
    const half = [
      [[946, 290], [900, 304], [908, 380], [918, 452]], // shoulder to hip
      [[900, 304], [820, 300], [758, 304]], [[906, 328], [822, 322], [760, 320]], // arm, level
      [[900, 304], [826, 256], [776, 216]], [[904, 322], [838, 282], [784, 236]], // arm, raised
      [[918, 452], [926, 548], [934, 640]], [[956, 470], [952, 560], [950, 640]], [[934, 640], [918, 646], [952, 646]], // leg, straight
      [[918, 452], [866, 540], [822, 618]], [[950, 474], [896, 560], [856, 634]], // leg, spread
      [[930, 330], [960, 344]], [[930, 372], [960, 380]], [[934, 410], [960, 414]], // chest
    ];
    for (const h of half) { strokes.push([h, 2]); strokes.push([mir(h), 2]); }
    strokes.push([[[cx, 292], [cx, 470]], 1.4]);
    strokes.push([[[748, 676], [1172, 676]], 1.4]);
    for (let i = 0; i <= 8; i++) strokes.push([[[748 + i * 53, 670], [748 + i * 53, 682]], 1.4]);
    const lens = strokes.map(([pts]) => { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; });
    const total = lens.reduce((a, b) => a + b, 0);
    let tip = [cx, 148];
    L(1, () => {
      c.fillStyle = lin(0, 0, W, H, [[0, '#3a2414'], [1, '#170d07']]); c.fillRect(-300, -300, 2500, 1500);
      c.save(); c.translate(cx, 420); c.rotate(-0.025); c.translate(-cx, -420);
      c.save(); c.filter = `blur(${O.blurPx(20)}px)`; c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(560, 70, 830, 760); c.restore();
      P.parchment(c, 540, 40, 840, 780, 7);
      // mirror-script notes above and below
      const R = rng(5);
      c.strokeStyle = col('#4a2410', 0.6); c.lineWidth = 1.5;
      for (let r = 0; r < 4; r++) {
        const y = 82 + r * 20, k = clamp(p * 6 - r * 0.6);
        c.beginPath();
        for (let x = 0; x < 620 * k; x += 4) { const yy = y + Math.sin(x * 0.5 + r * 9) * 3.5 * (0.4 + n1(x * 0.07, r + 3)) * (hash(Math.floor(x / 30), r) < 0.18 ? 0 : 1); x === 0 ? c.moveTo(1270 - x, yy) : c.lineTo(1270 - x, yy); }
        c.stroke();
      }
      for (let r = 0; r < 3; r++) {
        const y = 712 + r * 20, k = clamp(p * 5 - 3.6 - r * 0.3);
        c.beginPath();
        for (let x = 0; x < 560 * k; x += 4) { const yy = y + Math.sin(x * 0.55 + r * 5) * 3.5 * (0.4 + n1(x * 0.07, r + 13)) * (hash(Math.floor(x / 30), r + 9) < 0.18 ? 0 : 1); x === 0 ? c.moveTo(1240 - x, yy) : c.lineTo(1240 - x, yy); }
        c.stroke();
      }
      // the figure
      let rem = total * E.io(clamp((p - 0.04) / 0.88));
      for (let i = 0; i < strokes.length; i++) {
        if (rem <= 0) break;
        const k = Math.min(1, rem / lens[i]);
        tip = strokeP(strokes[i][0], k, ink, strokes[i][1]);
        rem -= lens[i];
      }
      c.restore();
    });
    L(1, () => {
      P.hand(c, tip[0], tip[1], { kind: 'chalk', sleeve: '#5a2420', s: 0.92 });
      // oil lamp
      c.fillStyle = '#6a4a1c'; c.beginPath(); c.ellipse(250, 250, 86, 44, 0, 0, TAU); c.fill();
      c.fillStyle = '#b8892c'; c.beginPath(); c.ellipse(250, 240, 74, 34, 0, 0, TAU); c.fill();
      c.fillStyle = '#3a2610'; c.beginPath(); c.ellipse(332, 232, 26, 12, -0.2, 0, TAU); c.fill();
      P.candle(c, 346, 226, 0.9, t, { seed: 6, body: false, glowR: 560 });
    });
    glow(346, 200, 1200, '#ff9a3c', 0.2 * fl);
    motes({ n: 50, seed: 61, t, hex: '#ffcf8a', alpha: 0.7, x: 0, y: 0, w: 900, h: 600 });
  };

  /** Wooden screw press. k: 0 platen up .. 1 pressed. */
  function press(c, x, y, k, t) {
    const wood = lin(x - 260, 0, x + 260, 0, [[0, '#6a4526'], [0.5, '#4a2e18'], [1, '#22140a']]), dk = '#1a0f08';
    rect(x - 250, y - 560, 46, 560, wood); rect(x + 204, y - 560, 46, 560, wood); // cheeks
    rect(x - 290, y - 590, 580, 44, wood); rect(x - 270, y - 420, 540, 30, wood); // crown, head
    rect(x - 300, y - 8, 600, 26, dk); rect(x - 280, y - 150, 560, 24, wood); // feet, winter
    // screw + platen
    const py = y - 300 + k * 86;
    c.fillStyle = lin(x - 26, 0, x + 26, 0, [[0, '#8a6a3a'], [0.5, '#c9a45a'], [1, '#4a3418']]); c.fillRect(x - 22, y - 546, 44, py - (y - 546));
    c.strokeStyle = 'rgba(30,18,8,0.5)'; c.lineWidth = 3; for (let i = 0; i < 12; i++) { const yy = y - 540 + i * 18 + k * 10; if (yy < py - 6) { c.beginPath(); c.moveTo(x - 22, yy); c.lineTo(x + 22, yy + 9); c.stroke(); } }
    rect(x - 150, py, 300, 34, '#3a2414'); rect(x - 40, py - 26, 80, 28, '#5a3a1e');
    // bar
    const ba = lerp(-0.5, 0.35, k);
    c.save(); c.translate(x, py - 14); c.rotate(ba); rrect(0, -9, 330, 18, 9, '#7a5630'); c.restore();
    // bed with type forme and the sheet
    rect(x - 190, y - 172, 380, 24, '#2a1a0e'); rect(x - 160, y - 190, 320, 20, '#1a120c');
    rect(x - 150, y - 196, 300, 7, '#f1e3c0');
    return [x + Math.cos(ba) * 322, py - 14 + Math.sin(ba) * 322];
  }

  S.press = (c, t, d, p) => {
    // A: the pull  ·  B: the first page  ·  C: the pages take flight across Europe
    const aB = seg(t, 2.1, 2.9, E.sine), aC = seg(t, 3.5, 4.4, E.sine);
    const k = seg(t, 0.55, 1.15, E.in) * (1 - seg(t, 1.5, 2.1, E.io));
    if (aB < 1) {
      const L = camera(clamp(t / 2.9), { z0: 1.0, z1: 1.12, fx: 1000, fy: 470 });
      L(0.4, () => {
        c.fillStyle = '#1a100a'; c.fillRect(-300, -300, 2500, 1500);
        c.fillStyle = rad(380, 260, 60, 1300, [[0, '#8a5a2c'], [0.4, '#3d2614'], [1, '#120a06']]); c.fillRect(-300, -300, 2500, 1500);
        // leaded window
        c.save(); c.beginPath(); archPath(250, 520, 240, 520); c.clip();
        c.fillStyle = lin(0, 100, 0, 520, [[0, '#fff0c0'], [1, '#f2b866']]); c.fillRect(240, 90, 300, 440);
        c.strokeStyle = 'rgba(40,24,10,0.7)'; c.lineWidth = 3;
        for (let i = -8; i < 12; i++) { c.beginPath(); c.moveTo(250 + i * 34, 90); c.lineTo(250 + i * 34 + 300, 530); c.moveTo(550 - i * 34, 90); c.lineTo(250 - i * 34, 530); c.stroke(); }
        c.restore();
        beam(385, 300, 260, 1250, 900, 760, '#ffd590', 0.32, 0.03);
        // sheets hung to dry
        line(600, 150, 2000, 110, '#1a0f08', 2.5);
        for (let i = 0; i < 7; i++) { const x = 700 + i * 180, y = 148 - i * 5.2; c.save(); c.translate(x, y); c.rotate(Math.sin(t * 1.2 + i) * 0.03); P.page(c, -45, 0, 90, 124, { a: 0.8 }); c.restore(); }
      });
      L(1, () => {
        c.fillStyle = lin(0, 730, 0, 804, [[0, '#2a1a0e'], [1, '#0a0604']]); c.fillRect(-300, 742, 2500, 200);
        const h = press(c, 980, 750, k, t);
        // the pressman throws his weight on the bar
        figure(h[0] + 96, 752, 400, { face: -1, fill: '#150c07', rim: '#5a3418', light: -1, robe: false, lean: lerp(0.1, -0.22, k), reachF: h, reachB: [h[0] - 8, h[1] + 6], head: 'cap', stride: 0.9 });
        // the beater with his ink balls
        figure(560, 752, 380, { face: 1, fill: '#150c07', rim: '#ffca8a', light: -1, robe: false, armF: [0.9, 0.9], armB: [0.7, 1.0], stride: 0.4 });
        if (k > 0.9) glow(980, 560, 260 * (k - 0.9) * 10, '#ffe0a8', 0.5);
      });
      motes({ n: 90, seed: 15, t, hex: '#ffe0aa', alpha: 0.8, mask: (x, y) => clamp(1.1 - Math.abs(y - (300 + (x - 385) * 0.69)) / 300) });
    }
    if (aB > 0) {
      c.save(); c.globalAlpha = aB;
      const L = camera(clamp((t - 2.1) / 4.3), { z0: 1.12, z1: 1.0, fx: 960, fy: 402 });
      // the map: sea dark, land in gold leaf
      const proj = (lon, lat) => [960 + (lon - 11) * 24.4, 402 - (lat - 50) * 38];
      c.fillStyle = '#17110b'; c.fillRect(0, 0, W, H);
      L(0.9, () => {
        c.fillStyle = rad(960, 402, 60, 1200, [[0, '#2f2416'], [1, '#0c0805']]); c.fillRect(-300, -300, 2500, 1500);
        c.save(); c.globalAlpha = aB * aC;
        P.land(c, proj); c.fillStyle = lin(0, 0, 0, H, [[0, '#8f7444'], [1, '#6a5230']]); c.fill();
        c.strokeStyle = 'rgba(255,222,150,0.55)'; c.lineWidth = 1.6; c.stroke();
        c.restore();
      });
      const mainz = proj(8.27, 50.0);
      const cities = [[12.33, 45.44], [12.5, 41.9], [2.35, 48.85], [-0.12, 51.5], [19.94, 50.06], [-5.98, 37.39], [11.08, 49.45], [7.59, 47.56], [4.4, 51.22], [4.83, 45.76], [10.69, 53.87],
        [19.04, 47.5], [14.42, 50.09], [14.27, 40.85], [-9.14, 38.72], [18.07, 59.33], [4.9, 52.37], [-3.7, 40.42], [9.19, 45.46], [16.37, 48.21], [23.73, 37.98], [28.97, 41.01], [-6.26, 53.35], [12.57, 55.68], [30.52, 50.45], [24.1, 56.95], [2.17, 41.39], [37.6, 55.75]];
      L(1, () => {
        // B: the first printed page (the scroll's ghost dissolves into it — the same words, now set in type)
        const pw = 340, ph = 470, lift = E.io(aC);
        const ghost = 1 - seg(t, 2.3, 3.2);
        if (ghost > 0) { c.save(); c.globalAlpha = aB * ghost * 0.9; P.papyrus(c, 960 - 330, 402 - 150, 660, 300, 3); c.fillStyle = 'rgba(40,22,6,0.8)'; for (let i = 0; i < 3; i++) c.fillRect(700, 320 + i * 62, [330, 500, 420][i], 9); c.restore(); }
        // C: the flock
        const R = rng(7);
        const N = 150;
        for (let i = 0; i < N; i++) {
          const city = i < cities.length * 2 ? proj(...cities[i % cities.length]) : null;
          const born = 3.5 + (i / N) * 2.2 + R() * 0.25, life = 1.0 + R() * 0.8, u = (t - born) / life;
          const ang = R() * TAU, far = 700 + R() * 900, spin = (R() - 0.5) * 9, flut = 3 + R() * 5, ph0 = R() * TAU;
          if (u <= 0) continue;
          const e = E.out(clamp(u)), dst = city || [mainz[0] + Math.cos(ang) * far, mainz[1] + Math.sin(ang) * far * 0.6];
          const x = lerp(mainz[0], dst[0], e), y = lerp(mainz[1], dst[1], e) - Math.sin(Math.PI * clamp(u)) * (60 + R() * 90);
          if (city && u >= 1) { const a = clamp(1.4 - (u - 1) * 0.5); glow(dst[0], dst[1], 46, '#ffd27a', 0.7 * a + 0.25); circle(dst[0], dst[1], 3.2, '#fff1c8'); continue; }
          if (u >= 1) continue;
          const s = lerp(0.5, city ? 0.12 : 0.34, e);
          c.save(); c.translate(x, y); c.rotate(spin * u + ph0); c.scale(Math.cos(t * flut + ph0), 1);
          c.globalAlpha = aB * clamp(u * 6) * clamp((1 - u) * 5);
          P.page(c, -45 * s * 2, -62 * s * 2, 90 * s * 2, 124 * s * 2, { lines: 1 });
          c.restore();
        }
        if (lift < 1) {
          c.save(); c.translate(mainz[0] + (960 - mainz[0]) * (1 - lift), 402 + (mainz[1] - 402) * lift); c.scale(1 - lift * 0.86, 1 - lift * 0.86); c.rotate(-0.03 + lift * 0.4);
          c.globalAlpha = aB * (1 - seg(t, 4.2, 4.7));
          c.save(); c.filter = `blur(${O.blurPx(18)}px)`; c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(-pw / 2 + 10, -ph / 2 + 20, pw, ph); c.restore();
          P.page(c, -pw / 2, -ph / 2, pw, ph, { lines: seg(t, 2.2, 3.3) });
          c.restore();
        }
        glow(mainz[0], mainz[1], 150, '#ffd27a', 0.5 * aC); circle(mainz[0], mainz[1], 4, '#fff6dc');
        txt('MAINZ · 1455', mainz[0] + 16, mainz[1] - 22, { size: 17, font: F.display, weight: 600, align: 'left', color: '#ffe6b0', a: aC * (1 - seg(t, 5.6, 6.2)), track: 4 });
      });
      motes({ n: 40, seed: 5, t, hex: '#ffe0aa', alpha: 0.5 * aB });
      c.restore();
    }
  };

  // ---------------------------------------------------------------------------
  // V · EXPLORATION AND SCIENCE
  // ---------------------------------------------------------------------------
  /** A carrack under full sail. (x, y) is the waterline amidships. */
  P.ship = (c, x, y, s, t, { tilt = 0, dark = '#1a120c', sail = '#eadcba', lit = '#fff4d6', cross = true } = {}) => {
    c.save(); c.translate(x, y); c.rotate(tilt); c.scale(s, s);
    const wind = 0.5 + 0.1 * Math.sin(t * 1.7);
    const sq = (mx, y0, y1, w0, w1, b) => { // square sail, bellied forward
      c.fillStyle = lin(mx - w0 / 2, y0, mx + w0 / 2 + 30, y1, [[0, mix2(sail, '#5a4a3a', 0.45)], [0.55, sail], [1, lit]]);
      c.beginPath(); c.moveTo(mx - w0 / 2, y0); c.lineTo(mx + w0 / 2, y0);
      c.quadraticCurveTo(mx + w1 / 2 + 46 * b * wind, (y0 + y1) / 2, mx + w1 / 2, y1);
      c.quadraticCurveTo(mx + 16 * b * wind, y1 - 12 * b, mx - w1 / 2, y1);
      c.quadraticCurveTo(mx - w0 / 2 + 30 * b * wind, (y0 + y1) / 2, mx - w0 / 2, y0); c.fill();
      c.strokeStyle = dark; c.lineWidth = 3; c.beginPath(); c.moveTo(mx - w0 / 2 - 6, y0); c.lineTo(mx + w0 / 2 + 6, y0); c.stroke();
    };
    // masts, rigging
    c.strokeStyle = dark; c.lineCap = 'round';
    for (const [mx, top, w] of [[0, -340, 7], [96, -278, 6], [-104, -226, 5]]) { c.lineWidth = w; c.beginPath(); c.moveTo(mx, -30); c.lineTo(mx, top); c.stroke(); }
    c.lineWidth = 5; c.beginPath(); c.moveTo(140, -50); c.lineTo(236, -92); c.stroke();
    c.lineWidth = 1.3; c.globalAlpha = 0.7;
    for (const [a, b] of [[[0, -340], [236, -92]], [[0, -340], [-150, -58]], [[96, -278], [236, -92]], [[0, -330], [-60, -40]], [[0, -330], [60, -40]], [[96, -270], [150, -45]], [[96, -270], [40, -40]], [[-104, -220], [-150, -62]], [[0, -340], [96, -278]]]) { c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
    c.globalAlpha = 1;
    // sails
    c.fillStyle = mix2(sail, '#5a4a3a', 0.3); c.beginPath(); c.moveTo(-104, -222); c.quadraticCurveTo(-50, -150, -62, -62); c.lineTo(-160, -84); c.closePath(); c.fill(); // lateen
    sq(96, -256, -196, 84, 96, 1); sq(96, -186, -74, 112, 128, 1.1);
    sq(0, -320, -262, 70, 84, 0.9); sq(0, -254, -176, 104, 124, 1); sq(0, -168, -64, 150, 168, 1.2);
    if (cross) { c.fillStyle = 'rgba(170,36,32,0.85)'; c.fillRect(8, -150, 12, 66); c.fillRect(-16, -124, 60, 12); }
    c.fillStyle = mix2(sail, '#5a4a3a', 0.2); c.beginPath(); c.moveTo(108, -262); c.lineTo(232, -94); c.lineTo(150, -100); c.closePath(); c.fill(); // jib
    // pennants
    c.fillStyle = '#b02a26';
    for (const [mx, top] of [[0, -340], [96, -278]]) { c.beginPath(); c.moveTo(mx, top); c.quadraticCurveTo(mx + 26, top - 8 + Math.sin(t * 5) * 5, mx + 54, top + 4 + Math.sin(t * 5 + 1) * 7); c.lineTo(mx, top + 12); c.fill(); }
    // hull
    c.fillStyle = lin(0, -70, 0, 30, [[0, mix2(dark, '#8a5a30', 0.45)], [0.5, dark], [1, '#0a0705']]);
    c.beginPath(); c.moveTo(-170, -78); c.lineTo(-86, -72); c.lineTo(-80, -40); c.lineTo(58, -40); c.lineTo(64, -60); c.lineTo(128, -62); c.quadraticCurveTo(160, -50, 172, -44);
    c.quadraticCurveTo(150, 4, 118, 22); c.lineTo(-128, 26); c.quadraticCurveTo(-160, 10, -170, -78); c.fill();
    c.strokeStyle = 'rgba(255,210,150,0.25)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-164, -52); c.lineTo(160, -32); c.moveTo(-158, -30); c.lineTo(146, -12); c.stroke();
    for (let i = 0; i < 5; i++) rect(-60 + i * 26, -28, 8, 8, 'rgba(255,190,110,0.5)');
    c.restore();
  };
  function sea(c, y, amp, len, speed, t, fill, foam, seed) {
    const f = x => y + Math.sin(x / len + t * speed + seed) * amp + Math.sin(x / (len * 0.37) - t * speed * 1.7 + seed * 3) * amp * 0.34 + Math.sin(x / (len * 2.3) + t * speed * 0.4) * amp * 0.6;
    c.fillStyle = fill; c.beginPath(); c.moveTo(-300, 1200);
    for (let x = -300; x <= 2220; x += 12) c.lineTo(x, f(x));
    c.lineTo(2220, 1200); c.fill();
    if (foam) { c.strokeStyle = foam; c.lineWidth = 2.5; c.beginPath(); for (let x = -300; x <= 2220; x += 12) { const yy = f(x); if (Math.sin(x / len + t * speed + seed) < -0.35) { c.moveTo(x, yy); c.lineTo(x + 12, f(x + 12)); } } c.stroke(); }
    return f;
  }

  S.ships = (c, t, d, p) => {
    const L = camera(p, { z0: 1.02, z1: 1.1, fx: 1050, fy: 420 });
    const bolt = Math.max(0, 1 - Math.abs(t - 3.3) * 9) + 0.6 * Math.max(0, 1 - Math.abs(t - 3.55) * 12);
    L(0, () => {
      sky([[0, '#131b24'], [0.5, '#2b3a44'], [0.8, '#59666a'], [1, '#8a8a7c']]);
      glow(1450, 150, 800, '#ffe2a0', 0.55);
      if (bolt > 0) { c.fillStyle = `rgba(210,225,255,${0.3 * bolt})`; c.fillRect(0, 0, W, H); }
    });
    L(0.15, () => {
      clouds({ y: 90, amp: 110, n: 46, seed: 2, t, hex: '#0d141b', alpha: 0.75, r: 230, drift: 22 });
      clouds({ y: 250, amp: 70, n: 26, seed: 5, t, hex: '#1c2832', alpha: 0.55, r: 200, drift: 30 });
      clouds({ y: 180, amp: 60, n: 12, seed: 8, t, hex: '#ffdc9a', alpha: 0.22, r: 170, drift: 16, mode: 'lighter', x0: 1000, x1: 2000 });
      // light breaking through
      for (let i = 0; i < 6; i++) beam(1380 + i * 46, 110, 40, 900 + i * 150, 760, 190, '#ffe2a6', 0.3 * (0.55 + 0.45 * n1(t * 0.6 + i, 4)), 0.02, 2);
    });
    L(0.4, () => { sea(c, 512, 8, 160, 0.9, t, '#3a4f56', null, 1); P.ship(c, 440, 520 + Math.sin(t * 1.1) * 5, 0.36, t, { tilt: Math.sin(t * 0.9) * 0.05, cross: false, sail: '#b9ae96', lit: '#d9cfb4' }); sea(c, 532, 10, 140, 1.0, t, '#2c4149', 'rgba(220,235,230,0.25)', 2); haze(480, 600, '#9aa49a', 0.25, 0); });
    L(0.7, () => sea(c, 580, 16, 200, 1.1, t, '#213840', 'rgba(220,235,230,0.3)', 3));
    L(1, () => {
      const heave = Math.sin(t * 1.25) * 16, roll = Math.sin(t * 1.25 + 1.1) * 0.07;
      P.ship(c, 1090, 640 + heave, 1.18, t, { tilt: roll - 0.03 });
      const f = sea(c, 668, 26, 260, 1.25, t, lin(0, 620, 0, 804, [[0, '#1b3038'], [1, '#0a151b']]), 'rgba(230,240,235,0.5)', 4);
      // spray at the bow
      const R = rng(3);
      c.fillStyle = 'rgba(235,245,240,0.7)';
      for (let i = 0; i < 46; i++) { const u = (t * (0.9 + R() * 0.6) + R()) % 1, a = -0.4 - R() * 1.9, v = 60 + R() * 130; const x = 1296 + Math.cos(a) * v * u, y = 660 + heave * 0.6 + Math.sin(a) * v * u + 190 * u * u; c.globalAlpha = (1 - u) * 0.8; c.beginPath(); c.arc(x, y, 1.5 + R() * 2.6, 0, TAU); c.fill(); }
      c.globalAlpha = 1;
    });
    L(1.4, () => sea(c, 742, 34, 330, 1.45, t, lin(0, 700, 0, 820, [[0, '#122329'], [1, '#050b0e']]), 'rgba(230,240,235,0.45)', 6));
    // rain
    c.strokeStyle = 'rgba(200,215,220,0.16)'; c.lineWidth = 1.3;
    const R = rng(21);
    c.beginPath(); for (let i = 0; i < 240; i++) { const x = (R() * 2300 + t * 260) % 2300 - 200, y = (R() * 900 + t * 1150 * (0.8 + R() * 0.4)) % 900 - 50; c.moveTo(x, y); c.lineTo(x + 9, y + 38); } c.stroke();
    if (bolt > 0) { c.fillStyle = `rgba(225,235,255,${0.22 * bolt})`; c.fillRect(0, 0, W, H); }
    motes({ n: 60, seed: 77, t, hex: '#ffe9c0', alpha: 0.5, speed: 3 });
  };

  S.galileo = (c, t, d, p) => {
    const L = camera(p, { z0: 1.0, z1: 1.09, fx: 1200, fy: 330 });
    const jx = 1390, jy = 190;
    L(0, () => {
      sky([[0, '#070c26'], [0.5, '#152150'], [0.82, '#3a3a6a'], [1, '#8a5a66']]);
      stars({ n: 420, seed: 12, t, alpha: 1 });
      c.save(); c.translate(900, 200); c.rotate(-0.5); c.scale(3.4, 1); glow(0, 0, 330, '#8aa0ff', 0.1); c.restore(); // the Milky Way
    });
    L(0.3, () => {
      // Padua asleep: domes and towers
      c.fillStyle = '#0d1230';
      const R = rng(8);
      c.beginPath(); c.moveTo(-200, 900); c.lineTo(-200, 690);
      for (let x = -200; x < 2200;) { const w = 40 + R() * 90, h = R() * 46; c.lineTo(x, 690 - h); c.lineTo(x + w, 690 - h); x += w; }
      c.lineTo(2200, 900); c.fill();
      for (const [x, r] of [[420, 60], [540, 44], [1640, 70], [1790, 48]]) { c.beginPath(); c.arc(x, 664, r, Math.PI, 0); c.fill(); c.fillRect(x - 3, 664 - r - 30, 6, 32); }
      c.fillRect(980, 560, 34, 140); poly([[976, 560], [997, 520], [1018, 560]], '#0d1230');
      for (let i = 0; i < 12; i++) { const x = 100 + R() * 1700; rect(x, 668 + R() * 16, 3, 4, '#ffca7a'); glow(x, 670, 10, '#ffb04a', 0.4); }
      haze(600, 720, '#6a5a7a', 0, 0.3);
    });
    L(1, () => {
      // Jupiter, to the naked eye
      glow(jx, jy, 90, '#fff1cc', 0.8); circle(jx, jy, 4.5, '#fffbe8'); flare(jx, jy, 300, '#cfe0ff', 0.4, 2);
      // balcony
      rect(-300, 716, 2600, 200, '#070914'); rect(-300, 704, 2600, 16, '#141a36');
      for (let i = 0; i < 44; i++) { const x = -200 + i * 54; c.fillStyle = '#0c1026'; c.beginPath(); c.ellipse(x, 760, 12, 40, 0, 0, TAU); c.fill(); }
      // telescope on its stand; Galileo at the eyepiece
      const eye = [760, 420], ang = Math.atan2(jy - eye[1], jx - eye[0]) + Math.sin(t * 0.8) * 0.004, len = 360;
      const tip = [eye[0] + Math.cos(ang) * len, eye[1] + Math.sin(ang) * len];
      line(eye[0] + Math.cos(ang) * 170, eye[1] + Math.sin(ang) * 170, 900, 706, '#0a0c1c', 7); line(eye[0] + Math.cos(ang) * 170, eye[1] + Math.sin(ang) * 170, 980, 706, '#0a0c1c', 7); line(eye[0] + Math.cos(ang) * 170, eye[1] + Math.sin(ang) * 170, 940, 706, '#0a0c1c', 5);
      c.save(); c.translate(eye[0], eye[1]); c.rotate(ang);
      c.fillStyle = lin(0, -14, 0, 14, [[0, '#6f86c8'], [0.35, '#232b52'], [1, '#090b1a']]);
      c.beginPath(); c.moveTo(0, -9); c.lineTo(len, -15); c.lineTo(len, 15); c.lineTo(0, 9); c.fill();
      rect(len - 14, -17, 14, 34, '#8a7440'); rect(120, -13, 10, 26, '#8a7440'); rect(0, -10, 12, 20, '#8a7440');
      c.restore();
      figure(650, 708, 400, { face: 1, fill: '#080a18', rim: '#2c3a70', light: 1, head: 'cap', lean: -0.1, nod: -0.42, reachF: [eye[0] + 96, eye[1] - 40], reachB: [eye[0] + 30, eye[1] + 4] });
      // a lantern and his notebook
      rect(430, 660, 34, 48, '#0a0c1c'); glow(447, 676, 150, '#ff9a3c', 0.45 * flicker(t, 2, 0.1)); rect(438, 668, 18, 22, '#ffc46a');
      rrect(500, 690, 90, 16, 2, '#d9c49a');
      // the view through the glass
      const k = seg(t, 1.3, 2.9, E.out), vr = 215 * k, vx = 1390, vy = 420;
      if (k > 0) {
        c.strokeStyle = col('#cfe0ff', 0.35 * k); c.lineWidth = 1.5; c.setLineDash([4, 8]);
        c.beginPath(); c.moveTo(jx, jy + 10); c.lineTo(vx, vy - vr); c.stroke(); c.setLineDash([]);
        c.save(); c.beginPath(); c.arc(vx, vy, vr, 0, TAU); c.clip();
        c.fillStyle = rad(vx, vy, 0, vr, [[0, '#0a1030'], [0.8, '#050818'], [1, '#000208']]); c.fillRect(vx - vr, vy - vr, vr * 2, vr * 2);
        stars({ n: 30, seed: 5, t, x: vx - vr, y: vy - vr, w: vr * 2, h: vr * 2, size: 1.1, alpha: 0.7 });
        // Jupiter with its belts
        const jr = 46 * k;
        c.save(); c.beginPath(); c.arc(vx, vy, jr, 0, TAU); c.clip();
        c.fillStyle = lin(0, vy - jr, 0, vy + jr, [[0, '#d9b98a'], [0.22, '#f1dcb4'], [0.36, '#b98a5a'], [0.47, '#f3e2c0'], [0.6, '#c49a6a'], [0.72, '#ecd6ae'], [1, '#b89a74']]);
        c.fillRect(vx - jr, vy - jr, jr * 2, jr * 2);
        c.fillStyle = rad(vx - jr * 0.4, vy - jr * 0.4, 0, jr * 2, [[0, 'rgba(255,255,255,0.2)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,20,0.7)']]); c.fillRect(vx - jr, vy - jr, jr * 2, jr * 2);
        c.restore();
        glow(vx, vy, jr * 2.6, '#ffe6b8', 0.3);
        // the four Medicean stars, never in the same place twice
        [[72, 1.9, 0.3], [104, 1.25, 2.0], [146, 0.8, 4.1], [192, 0.5, 5.3]].forEach(([r, w, ph], i) => {
          const mx = vx + Math.cos(t * w * 0.5 + ph) * r * k, behind = Math.sin(t * w * 0.5 + ph) > 0 && Math.abs(mx - vx) < jr;
          if (!behind) { circle(mx, vy + (i - 1.5) * 1.5, 3.4, '#fffbe6'); glow(mx, vy, 16, '#fff3cf', 0.7); }
        });
        c.restore();
        c.strokeStyle = col('#c9a45a', 0.9 * k); c.lineWidth = 5; c.beginPath(); c.arc(vx, vy, vr, 0, TAU); c.stroke();
        c.strokeStyle = col('#fff0c0', 0.35 * k); c.lineWidth = 1.5; c.beginPath(); c.arc(vx, vy, vr - 6, 0, TAU); c.stroke();
        txt('7 January 1610', vx, vy + vr + 34, { size: 25, font: F.serif, italic: true, color: '#dfe6ff', a: seg(t, 2.6, 3.4) * 0.85 });
      }
    });
    motes({ n: 30, seed: 9, t, hex: '#cfdcff', alpha: 0.35 });
  };

  /** Draw a formula with sub/superscripts: parts = [text, 'n'|'sub'|'sup'] */
  function formula(c, parts, x, y, size, color, a, blur = 18) {
    if (a <= 0) return;
    c.save(); c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    let w = 0;
    const measure = () => { let tw = 0; for (const [s, k] of parts) { c.font = `italic 500 ${k === 'n' ? size : size * 0.58}px ${F.serif}`; tw += c.measureText(s).width; } return tw; };
    w = measure();
    let cx = x - w / 2;
    c.fillStyle = col(color, a); c.shadowColor = col(color, a * 0.9); c.shadowBlur = O.blurPx(blur);
    for (const [s, k] of parts) {
      const fs = k === 'n' ? size : size * 0.58;
      c.font = `italic 500 ${fs}px ${F.serif}`;
      c.fillText(s, cx, y + (k === 'sub' ? size * 0.2 : k === 'sup' ? -size * 0.42 : 0));
      cx += c.measureText(s).width;
    }
    c.restore();
    return w;
  }

  S.newton = (c, t, d, p) => {
    const L = camera(p, { z0: 1.0, z1: 1.1, fx: 1080, fy: 420 });
    const ox = 1100, oy = 520;
    L(0.3, () => {
      c.fillStyle = '#0d0a08'; c.fillRect(-300, -300, 2500, 1500);
      c.fillStyle = rad(ox, oy - 20, 40, 1100, [[0, '#6a4a22'], [0.35, '#36230f'], [1, '#0b0806']]); c.fillRect(-300, -300, 2500, 1500);
      // panelled wall, a tall sash window with the night outside
      c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 3; for (let i = 0; i < 10; i++) c.strokeRect(-100 + i * 240, 60, 200, 520);
      c.fillStyle = lin(0, 80, 0, 560, [[0, '#0c1436'], [1, '#27376e']]); c.fillRect(150, 90, 250, 460);
      stars({ n: 40, seed: 3, t, x: 150, y: 90, w: 250, h: 460, size: 1.2 });
      glow(330, 180, 60, '#e6edff', 0.8); circle(330, 180, 15, '#f7f9ff');
      c.strokeStyle = '#140d08'; c.lineWidth = 8; c.strokeRect(150, 90, 250, 460); c.beginPath(); c.moveTo(275, 90); c.lineTo(275, 550); c.moveTo(150, 320); c.lineTo(400, 320); c.stroke();
      beam(275, 320, 240, 760, 880, 520, '#6f8fe0', 0.13, 0);
    });
    L(1, () => {
      // table
      c.fillStyle = lin(0, 640, 0, 804, [[0, '#4a2e16'], [0.15, '#2e1c0e'], [1, '#0c0705']]); c.fillRect(-300, 650, 2500, 300);
      c.fillStyle = 'rgba(255,200,120,0.25)'; c.fillRect(-300, 650, 2500, 3);
      // Newton reading, the Principia, an apple, a prism
      figure(520, 800, 520, { face: 1, fill: '#0b0806', rim: '#8a5a2a', light: 1, sit: true, head: 'long', bend: 0.22, nod: 0.2, armF: [1.0, 1.0], armB: [0.8, 0.9] });
      rrect(600, 622, 200, 30, 3, '#3a1c14'); rrect(606, 616, 188, 10, 2, '#e6d4a8');
      c.fillStyle = rad(860, 620, 0, 32, [[0, '#e04a34'], [0.7, '#9a1c1c'], [1, '#4a0c0c']]); c.beginPath(); c.arc(868, 626, 25, 0, TAU); c.fill();
      line(868, 603, 873, 592, '#2a1808', 3);
      poly([[1560, 650], [1600, 584], [1640, 650]], 'rgba(200,225,255,0.35)', 'rgba(230,240,255,0.7)', 2);
      ['#ff5a4a', '#ffa23a', '#ffe14a', '#5ad06a', '#4a9aff', '#8a5aff'].forEach((h, i) => beam(1618, 618, 4, 1900, 600 + i * 22, 22, h, 0.5, 0.2, 1));
      // the orrery
      const brass = lin(ox - 60, 0, ox + 60, 0, [[0, '#6a4a16'], [0.45, '#f0c86a'], [1, '#4a3210']]);
      c.fillStyle = brass; c.beginPath(); c.ellipse(ox, 650, 150, 20, 0, 0, TAU); c.fill(); c.fillRect(ox - 9, oy, 18, 130);
      c.beginPath(); c.ellipse(ox, 610, 44, 9, 0, 0, TAU); c.fill();
      const planets = [[110, 2.6, 7, '#c9b08a'], [170, 1.7, 10, '#e8c890'], [240, 1.15, 11, '#6fa8e8'], [320, 0.8, 9, '#d9704a'], [430, 0.42, 22, '#e2c08a'], [540, 0.28, 18, '#e8d6a0']];
      const draw = front => planets.forEach(([r, w, pr, hex], i) => {
        const a = t * w * 0.55 + i * 1.9, px = ox + Math.cos(a) * r, py = oy + Math.sin(a) * r * 0.27, isFront = Math.sin(a) > 0;
        if (isFront !== front) return;
        c.strokeStyle = col('#d9b25a', 0.75); c.lineWidth = 2.5; c.beginPath(); c.moveTo(ox, oy + 30 + i * 3); c.lineTo(px, oy + 30 + i * 3 + Math.sin(a) * r * 0.27); c.lineTo(px, py); c.stroke();
        c.fillStyle = rad(px - (px - ox) / r * pr * 0.5, py - pr * 0.2, 0, pr * 1.6, [[0, mix(hex, '#ffffff', 0.5)], [0.6, col(hex, 1)], [1, mix(hex, '#000000', 0.7)]]);
        c.beginPath(); c.arc(px, py, pr, 0, TAU); c.fill();
        if (i === 5) { c.strokeStyle = col('#f0dca8', 0.9); c.lineWidth = 3; c.beginPath(); c.ellipse(px, py, pr * 1.9, pr * 0.5, -0.3, 0, TAU); c.stroke(); }
        if (i === 2) { const ma = t * 3.2; circle(px + Math.cos(ma) * 22, py + Math.sin(ma) * 7, 3.4, '#e8e8f0'); }
      });
      // orbit rings (back halves, back planets, the sun, front halves, front planets)
      const rings = (a0, a1) => planets.forEach(([r]) => { c.strokeStyle = col('#e8c46a', 0.4); c.lineWidth = 1.6; c.beginPath(); c.ellipse(ox, oy, r, r * 0.27, 0, a0, a1); c.stroke(); });
      rings(Math.PI, TAU); draw(false);
      glow(ox, oy, 420, '#ffb44a', 0.5 * flicker(t, 4, 0.05)); glow(ox, oy, 120, '#ffe6a8', 0.9);
      c.fillStyle = rad(ox - 10, oy - 10, 0, 44, [[0, '#fffbe0'], [0.6, '#ffd36a'], [1, '#e0962a']]); c.beginPath(); c.arc(ox, oy, 40, 0, TAU); c.fill();
      rings(0, Math.PI); draw(true);
      flare(ox, oy, 900, '#ffd9a0', 0.25, 3);
    });
    L(1.1, () => {
      // the laws, hanging in the lamplit air
      const gold = '#ffdf9a', drift = -p * 26;
      const a1 = win(t, 0.6, 9, 1.0), a2 = win(t, 1.7, 9, 1.0), a3 = win(t, 2.8, 9, 1.0);
      const w = formula(c, [['F  =  G ', 'n']], 870, 232 + drift, 78, gold, a1);
      c.save(); c.shadowColor = col(gold, a1); c.shadowBlur = O.blurPx(14); rect(966, 208 + drift, 196, 3, col(gold, a1)); c.restore();
      formula(c, [['m', 'n'], ['1', 'sub'], [' m', 'n'], ['2', 'sub']], 1064, 192 + drift, 62, gold, a1);
      formula(c, [['r', 'n'], ['2', 'sup']], 1064, 270 + drift, 62, gold, a1);
      formula(c, [['F  =  m a', 'n']], 1500, 300 + drift, 64, gold, a2 * 0.9);
      formula(c, [['T', 'n'], ['2', 'sup'], ['  ∝  a', 'n'], ['3', 'sup']], 640, 330 + drift, 56, gold, a3 * 0.8);
      // a faint ellipse with its focus: the geometry behind the brass
      c.save(); c.globalCompositeOperation = 'lighter';
      c.strokeStyle = col(gold, 0.3 * a3); c.lineWidth = 1.5; c.beginPath(); c.ellipse(1480, 170 + drift, 150, 62, -0.12, 0, TAU * seg(t, 2.8, 4.6)); c.stroke();
      circle(1420, 177 + drift, 4, col(gold, 0.7 * a3));
      c.restore();
    });
    motes({ n: 80, seed: 31, t, hex: '#ffd89a', alpha: 0.7 });
  };

  // ---------------------------------------------------------------------------
  // VI · LIBERTY AND GENIUS
  // ---------------------------------------------------------------------------
  S.quill = (c, t, d, p) => {
    const aB = seg(t, 2.25, 2.95, E.sine);
    if (aB < 1) {
      // A: the signing
      const pa = clamp(t / 2.6);
      const L = camera(pa, { z0: 1.05, z1: 1.14, fx: 1000, fy: 420, dx: -30 });
      const sig = sample(u => { // a looping hand: circles carried along a rising line
        const r = (u < 0.12 ? 62 : 26 + 22 * Math.abs(Math.sin(u * 9))) * (1 - u * 0.35), w = u * 44 + 2.4;
        return [650 + 600 * u + r * Math.cos(w) * 0.8, 440 - r * Math.sin(w) + 24 * u - (u < 0.12 ? 30 : 0)];
      }, 260);
      const fl = sample(u => [1260 - 700 * u, 470 + 60 * Math.sin(u * Math.PI) + 14 * Math.sin(u * 9)], 60);
      let tip = sig[0];
      L(1, () => {
        P.parchment(c, -300, -300, 2500, 1500, 11, '#ecd9aa', '#c9a970');
        // the last lines of the text above, other hands below
        const R = rng(9);
        for (let r = 0; r < 4; r++) { c.strokeStyle = col('#3a2412', 0.55); c.lineWidth = 2; c.beginPath(); for (let x = 300; x < 1700; x += 5) { const yy = 60 + r * 54 + Math.sin(x * 0.21 + r * 3) * 5 * (0.3 + n1(x * 0.05, r)) * (hash(Math.floor(x / 44), r + 5) < 0.2 ? 0 : 1); x === 300 ? c.moveTo(x, yy) : c.lineTo(x, yy); } c.stroke(); }
        for (let i = 0; i < 7; i++) { const x0 = 240 + (i % 4) * 420, y0 = 600 + Math.floor(i / 4) * 90; c.strokeStyle = col('#3a2412', 0.5); c.lineWidth = 2.2; c.beginPath(); for (let u = 0; u <= 1; u += 0.02) { const x = x0 + 250 * u, y = y0 + Math.sin(u * (14 + i * 3)) * 16 * (1 - u * 0.5) + Math.sin(u * 40 + i) * 4; u === 0 ? c.moveTo(x, y) : c.lineTo(x, y); } c.stroke(); }
        const k = E.io(clamp((pa - 0.05) / 0.62)), k2 = E.io(clamp((pa - 0.7) / 0.22));
        tip = strokeP(sig, k, col('#22140a', 0.92), 4.2);
        if (k2 > 0) tip = strokeP(fl, k2, col('#22140a', 0.9), 3.4);
      });
      L(1, () => P.hand(c, tip[0], tip[1], { kind: 'quill', sleeve: '#2a2a3a' }));
      beam(-100, -100, 400, 1700, 900, 800, '#ffdc9a', 0.26, 0.04);
      motes({ n: 50, seed: 3, t, hex: '#ffe9c0', alpha: 0.6 });
    }
    if (aB > 0) {
      // B: the opening words
      c.save(); c.globalAlpha = aB;
      const pb = clamp((t - 2.25) / (d - 2.25));
      const L = camera(pb, { z0: 1.0, z1: 1.12, fx: 760, fy: 330 });
      L(1, () => {
        P.parchment(c, -300, -300, 2500, 1500, 21, '#ecd9aa', '#c4a268');
        const ink = '#1c120a';
        txt('We the People', 150, 330, { size: 268, font: F.black, align: 'left', color: ink, a: 0.94, base: 'alphabetic' });
        const body = ['of the United States, in Order to form a more perfect Union, establish Justice, insure domestic Tranquility,',
          'provide for the common defence, promote the general Welfare, and secure the Blessings of Liberty to ourselves',
          'and our Posterity, do ordain and establish this Constitution for the United States of America.'];
        body.forEach((s, i) => txt(s, 170, 450 + i * 78, { size: 47, font: F.script, align: 'left', color: ink, a: 0.82, base: 'alphabetic' }));
        txt('Article. I.', 960, 730, { size: 64, font: F.black, color: ink, a: 0.8, base: 'alphabetic' });
      });
      // light moving across the vellum
      const sx = lerp(-300, 1700, pb);
      beam(sx, -200, 260, sx + 520, 1000, 420, '#fff0c8', 0.34, 0.2, 3);
      motes({ n: 60, seed: 41, t, hex: '#fff0c8', alpha: 0.7 });
      c.restore();
    }
  };

  S.crowds = (c, t, d, p) => {
    const L = camera(p, { z0: 1.0, z1: 1.1, fx: 960, fy: 380 });
    const sx = 960, sy = 250;
    L(0, () => { sky([[0, '#d99a52'], [0.5, '#f4cf8c'], [1, '#fde9bc']]); glow(sx, sy, 900, '#fff2c8', 0.85); glow(sx, sy, 240, '#ffffff', 0.9); });
    L(0.2, () => clouds({ y: 170, amp: 80, n: 20, seed: 3, t, hex: '#fff3d8', alpha: 0.3, r: 190, drift: 5 }));
    L(0.6, () => {
      rays(sx, sy, { n: 26, a0: 0, a1: TAU, len: 1500, hex: '#ffe9b4', alpha: 0.13, t, seed: 9, width: 0.5 });
      // the State House: brick wings, clock tower, cupola and spire
      const b = '#4a2a1c', b2 = '#34190f';
      c.fillStyle = lin(0, 330, 0, 640, [[0, '#6a3c24'], [1, b]]); c.fillRect(480, 400, 960, 260);
      poly([[470, 400], [1450, 400], [1420, 356], [500, 356]], b2);
      c.fillStyle = 'rgba(255,225,170,0.5)';
      for (let r = 0; r < 2; r++) for (let i = 0; i < 9; i++) { if (i === 4) continue; c.fillRect(520 + i * 102, 430 + r * 96, 36, 60); }
      rect(900, 260, 120, 400, b); rect(916, 150, 88, 112, b2); circle(960, 320, 26, '#f4e6c0'); line(960, 320, 960, 302, b2, 3); line(960, 320, 972, 326, b2, 3);
      c.fillStyle = 'rgba(255,225,170,0.6)'; c.beginPath(); archPath(942, 978, 196, 240); c.fill();
      c.fillStyle = b; c.beginPath(); c.arc(960, 150, 40, Math.PI, 0); c.fill(); rect(952, 70, 16, 46, b2); poly([[950, 72], [960, 10], [970, 72]], b2);
      for (const x of [420, 1500]) { P.olive(c, x, 668, 250, '#2a1c10', x); }
      haze(520, 680, '#ffe0a8', 0, 0.45);
    });
    L(0.85, () => {
      // banners and a speaker above the heads
      const dk = '#20130b';
      c.fillStyle = lin(0, 640, 0, 804, [[0, '#3a2616'], [1, '#0e0805']]); c.fillRect(-300, 664, 2500, 400); // trodden ground behind the crowd
      rect(880, 560, 180, 16, dk); rect(890, 576, 12, 70, dk); rect(1040, 576, 12, 70, dk);
      const f = figure(960, 562, 150, { fill: dk, rim: '#ffdca0', light: -1, robe: false, tails: true, head: 'tricorn', armF: [1.5, 0.9], armB: [1.3, 1.1], stride: 0.3 });
      c.save(); c.translate(f.hands[0][0], f.hands[0][1]); rrect(-4, -30, 38, 50, 2, '#f3e6c4'); c.restore();
      crowd({ x0: -200, x1: 2200, y: 700, rows: 6, h: 84, seed: 3, fill: '#1c110a', fill2: '#6a4a30', density: lerp(0.45, 1, clamp(p * 1.3)), raise: 0.35, hats: 0.5, t, depth: 0.86, rowGap: 0.3 });
      for (let i = 0; i < 7; i++) {
        const x = 160 + i * 270 + (i % 2) * 60, y = 560 + (i % 3) * 20, w = Math.sin(t * 2.2 + i) * 8;
        line(x, y + 140, x, y - 90, '#1c110a', 4);
        c.fillStyle = ['#f3e6c4', '#a82a26', '#2a3f7a'][i % 3];
        c.beginPath(); c.moveTo(x, y - 88); c.quadraticCurveTo(x + 50, y - 96 + w, x + 104, y - 80 - w); c.lineTo(x + 100, y - 30 + w); c.quadraticCurveTo(x + 50, y - 44 - w, x, y - 34); c.fill();
      }
    });
    L(1.2, () => crowd({ x0: -200, x1: 2200, y: 820, rows: 2, h: 170, seed: 8, fill: '#0e0805', density: lerp(0.5, 1, clamp(p * 1.6)), raise: 0.5, hats: 0.55, t, depth: 0.8, rowGap: 0.34 }));
    flare(sx, sy, 1300, '#ffe9c0', 0.25, 4);
    motes({ n: 110, seed: 19, t, hex: '#fff0cc', alpha: 0.7, speed: 1.4 });
  };

  // ---------------------------------------------------------------------------
  // Beethoven
  // ---------------------------------------------------------------------------
  /** Beethoven-ish silhouette helper: wild hair, tailcoat. */
  const ludwig = (c, x, y, h, o) => figure(x, y, h, { fill: '#0d0806', robe: false, tails: true, head: 'wild', ...o });

  S.vienna = (c, t, d, p, shot) => {
    const L = camera(p, { z0: 1.0, z1: 1.1, fx: 900, fy: 450 });
    const fl = flicker(t, 2, 0.1), beat = shot.beat;
    L(0.3, () => {
      c.fillStyle = '#0b0807'; c.fillRect(-300, -300, 2500, 1500);
      c.fillStyle = rad(1010, 380, 40, 1050, [[0, col('#7a5026', fl)], [0.4, '#33200f'], [1, '#0a0706']]); c.fillRect(-300, -300, 2500, 1500);
      // tall window, heavy curtain, a winter night
      c.fillStyle = lin(0, 60, 0, 560, [[0, '#0c1434'], [1, '#2a3a6a']]); c.fillRect(1500, 70, 260, 520);
      stars({ n: 30, seed: 8, t, x: 1500, y: 70, w: 260, h: 520, size: 1.2 });
      c.strokeStyle = '#120b07'; c.lineWidth = 8; c.strokeRect(1500, 70, 260, 520); c.beginPath(); c.moveTo(1630, 70); c.lineTo(1630, 590); c.moveTo(1500, 250); c.lineTo(1760, 250); c.moveTo(1500, 420); c.lineTo(1760, 420); c.stroke();
      c.fillStyle = lin(1740, 0, 1960, 0, [[0, '#4a1c18'], [1, '#1c0a08']]); c.beginPath(); c.moveTo(1720, 30); c.quadraticCurveTo(1790, 400, 1740, 760); c.lineTo(2000, 760); c.lineTo(2000, 30); c.fill();
      beam(1630, 330, 240, 1250, 860, 500, '#6f8fe0', 0.1, 0);
      // framed portraits lost in shadow
      c.strokeStyle = 'rgba(140,100,50,0.5)'; c.lineWidth = 6; c.strokeRect(260, 140, 150, 200); c.strokeRect(1180, 120, 120, 150);
    });
    L(1, () => {
      c.fillStyle = lin(0, 700, 0, 804, [[0, '#2c1b0e'], [1, '#090604']]); c.fillRect(-300, 716, 2500, 200);
      // sheets everywhere
      const R = rng(4);
      for (let i = 0; i < 14; i++) { c.save(); c.translate(300 + R() * 1300, 740 + R() * 50); c.rotate(R() * 3); c.scale(1, 0.4); rect(-40, -52, 80, 104, col('#e8dab8', 0.5 + R() * 0.3)); c.restore(); }
      // the fortepiano
      const wood = lin(0, 470, 0, 580, [[0, '#7a4a22'], [0.4, '#4a2a12'], [1, '#1c0f06']]);
      for (const x of [800, 1010, 1330]) poly([[x, 566], [x + 26, 566], [x + 20, 718], [x + 8, 718]], '#1c0f06');
      c.fillStyle = wood; c.beginPath(); c.moveTo(770, 486); c.lineTo(1380, 486); c.quadraticCurveTo(1396, 530, 1380, 570); c.lineTo(770, 570); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,200,120,0.4)'; c.fillRect(770, 486, 610, 3);
      poly([[880, 484], [1380, 484], [1300, 330], [900, 420]], lin(0, 330, 0, 486, [[0, '#2a180c'], [1, '#5a3418']])); // raised lid
      line(1240, 484, 1262, 356, '#1c0f06', 5);
      rect(762, 512, 112, 14, '#f3ead6'); for (let i = 0; i < 9; i++) rect(770 + i * 12, 512, 5, 9, '#17100a'); // keys
      rect(752, 526, 124, 12, '#2a1608');
      // candles
      P.candle(c, 1010, 392, 0.72, t, { seed: 2, glowR: 520 });
      P.candle(c, 1180, 396, 0.66, t + 5, { seed: 7, glowR: 420 });
      rect(1070, 468, 70, 18, '#e8dab8'); c.fillStyle = '#0a0705'; c.fillRect(940, 462, 30, 24);
      // he bends until his ear lies on the wood, one hand still on the keys
      rect(590, 598, 130, 14, '#1c0f06'); rect(606, 612, 12, 106, '#1c0f06'); rect(692, 612, 12, 106, '#1c0f06');
      const press = Math.max(0, 1 - ((t / beat) % 1) * 3);
      ludwig(c, 650, 724, 440, { face: 1, sit: true, bend: lerp(0.5, 1.02, seg(t, 0, 1.3)), nod: 0.55, reachF: [820, 512 + press * 5], armB: [1.3, 0.5], rim: '#7a4a22', light: 1 });
    });
    // the vibrations he can still feel
    L(1, () => {
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 6; k++) {
        const born = k * beat, u = (t - born) / 2.6;
        if (u <= 0 || u >= 1) continue;
        const r = 40 + 620 * E.out(u), a = 0.42 * Math.pow(1 - u, 1.6) * (k === 0 ? 1.4 : 0.8);
        c.strokeStyle = col('#ffcf8a', a); c.lineWidth = 3 + 5 * (1 - u);
        c.beginPath(); c.ellipse(1000, 528, r, r * 0.42, 0, 0, TAU); c.stroke();
        c.strokeStyle = col('#ffcf8a', a * 0.5); c.lineWidth = 1.5; c.beginPath(); c.ellipse(1000, 528, r * 0.86, r * 0.36, 0, 0, TAU); c.stroke();
      }
      c.restore();
    });
    motes({ n: 70, seed: 23, t, hex: '#ffcf8a', alpha: 0.75, x: 500, y: 100, w: 1100, h: 560 });
  };

  S.scrawl = (c, t, d, p, shot) => {
    const L = camera(p, { z0: 1.03, z1: 1.14, fx: 900, fy: 400, dx: -50 });
    const fl = flicker(t, 4, 0.12);
    // Ode to Joy, bars 1–4: staff steps above the bottom line (E4 = 0)
    const notes = [1, 1, 2, 3, 3, 2, 1, 0, -1, -1, 0, 1, 1, 0, 0];
    const durs = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5, 0.5, 2];
    const sp = 17, x0 = 330, y0 = 330; // staff line spacing, origin (bottom line)
    let tip = [x0, y0];
    L(1, () => {
      c.fillStyle = '#1c110a'; c.fillRect(-300, -300, 2500, 1500);
      c.save(); c.translate(960, 400); c.rotate(-0.045); c.translate(-960, -400);
      c.save(); c.filter = `blur(${O.blurPx(20)}px)`; c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(150, 60, 1700, 760); c.restore();
      P.parchment(c, 120, 20, 1700, 800, 31, '#efe2c2', '#cdb486');
      const ink = col('#1a0f08', 0.9);
      // staves
      for (let s = 0; s < 3; s++) for (let i = 0; i < 5; i++) { const y = y0 - i * sp + s * 190 - 150; line(230, y + Math.sin(i + s) * 1.2, 1740, y + Math.sin(i * 2 + s) * 1.6, col('#2a1a10', 0.7), 1.7); }
      // an earlier line, struck through in impatience
      const R = rng(12);
      for (let i = 0; i < 13; i++) { const x = 330 + i * 100 + R() * 20, y = y0 - 150 - (R() * 5 | 0) * sp / 2; c.save(); c.translate(x, y); c.rotate(-0.4); c.fillStyle = col('#1a0f08', 0.55); c.beginPath(); c.ellipse(0, 0, 11, 7.5, 0, 0, TAU); c.fill(); c.restore(); line(x + 9, y, x + 12, y - 58, col('#1a0f08', 0.55), 2.2); }
      c.strokeStyle = col('#1a0f08', 0.7); c.lineWidth = 3.5; c.beginPath(); c.moveTo(300, y0 - 196); c.bezierCurveTo(700, y0 - 130, 1100, y0 - 230, 1640, y0 - 150); c.moveTo(310, y0 - 150); c.bezierCurveTo(800, y0 - 210, 1200, y0 - 120, 1660, y0 - 190); c.stroke();
      // clef, key (two sharps), the tune
      c.strokeStyle = ink; c.lineWidth = 4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(262, y0 + 26); c.bezierCurveTo(250, y0 - 30, 300, y0 - 80, 270, y0 - 104); c.bezierCurveTo(240, y0 - 70, 300, y0 - 20, 268, y0 - 4); c.bezierCurveTo(240, y0 + 4, 240, y0 - 40, 274, y0 - 36); c.stroke();
      for (const [sx, sy] of [[306, y0 - 4 * sp], [326, y0 - 2.5 * sp]]) { c.lineWidth = 2.4; c.beginPath(); c.moveTo(sx - 5, sy - 13); c.lineTo(sx - 5, sy + 13); c.moveTo(sx + 5, sy - 15); c.lineTo(sx + 5, sy + 11); c.moveTo(sx - 11, sy - 3); c.lineTo(sx + 11, sy - 8); c.moveTo(sx - 11, sy + 7); c.lineTo(sx + 11, sy + 2); c.stroke(); }
      let beatPos = 0;
      const total = 16, nShown = clamp((p - 0.03) / 0.8) * total;
      notes.forEach((st, i) => {
        const x = 392 + beatPos * 83 + Math.floor(beatPos / 4) * 14, y = y0 - st * sp / 2, startBeat = beatPos;
        beatPos += durs[i];
        const k = clamp((nShown - startBeat) * 1.6);
        if (k <= 0) return;
        if (nShown >= startBeat && nShown < startBeat + durs[i] + 0.3) tip = [x + 16 * k, y - 50 * clamp(k * 2 - 1) + Math.sin(t * 40) * 3];
        const jr = (hash(i, 7) - 0.5) * 0.3;
        c.save(); c.translate(x, y); c.rotate(-0.42 + jr);
        c.fillStyle = ink; c.beginPath(); c.ellipse(0, 0, 12.5 * Math.min(1, k * 2), 8.4, 0, 0, TAU);
        if (durs[i] === 2) { c.strokeStyle = ink; c.lineWidth = 3.4; c.stroke(); } else c.fill();
        c.restore();
        if (k > 0.5) { const sk = (k - 0.5) * 2; line(x + 11, y - 3, x + 11 + jr * 20, y - 3 - 60 * sk, ink, 2.6); if (durs[i] === 0.5) { c.strokeStyle = ink; c.lineWidth = 2.8; c.beginPath(); c.moveTo(x + 11 + jr * 20, y - 63); c.quadraticCurveTo(x + 34, y - 44, x + 26, y - 20); c.stroke(); } }
        if (durs[i] === 1.5 && k > 0.8) circle(x + 24, y - sp * 0.25, 3.4, ink);
        if (st < 0 && k > 0.2) line(x - 18, y0 + sp, x + 18, y0 + sp, ink, 1.8); // (D sits just under the staff; a short guide stroke)
        if ((startBeat + durs[i]) % 4 === 0) line(x + (durs[i] === 2 ? 110 : 52), y0, x + (durs[i] === 2 ? 110 : 52) + 2, y0 - 4 * sp, ink, 2.4);
      });
      // the word, scrawled beneath
      const wk = seg(p, 0.42, 0.8);
      if (wk > 0) { c.save(); c.beginPath(); c.rect(380, y0 + 20, 900 * wk, 140); c.clip(); txt('Freude, schöner Götterfunken', 392, y0 + 96, { size: 74, font: F.script, align: 'left', color: '#1a0f08', a: 0.86, base: 'alphabetic' }); c.restore(); }
      // blots
      for (let i = 0; i < 7; i++) { const bx = 300 + R() * 1300, by = 120 + R() * 560; if (p > i / 9) circle(bx, by, 2 + R() * 7, col('#1a0f08', 0.55)); }
      c.restore();
    });
    L(1, () => P.hand(c, tip[0], tip[1], { kind: 'quill', sleeve: '#1c1614', s: 0.96 }));
    glow(160, 120, 1300, '#ff9a3c', 0.3 * fl);
    L(1.3, () => { P.candle(c, 150, 190, 1.5, t, { seed: 4, glowR: 420 }); });
    motes({ n: 50, seed: 15, t, hex: '#ffcf8a', alpha: 0.7, x: 0, y: 0, w: 900, h: 700 });
  };

  S.premiere = (c, t, d, p, shot) => {
    // t < turn: he conducts on, facing the orchestra. Then he is turned to see what he cannot hear.
    const turn = seg(t, 4.3, 5.7, E.io), deaf = seg(t, 5.2, 6.6);
    const tt = t < 5.2 ? t : 5.2 + (t - 5.2) * lerp(1, 0.45, deaf); // time slows in the silence
    const L = camera(p, { z0: 1.0, z1: 1.12, fx: 940, fy: 420 });
    L(0.3, () => {
      c.fillStyle = '#120a06'; c.fillRect(-300, -300, 2500, 1500);
      c.fillStyle = rad(1300, 300, 60, 1300, [[0, '#a8702c'], [0.4, '#4a2c12'], [1, '#110905']]); c.fillRect(-300, -300, 2500, 1500);
      // tiers of boxes, gilded and candlelit
      for (let r = 0; r < 4; r++) {
        const y = 120 + r * 118;
        c.fillStyle = lin(0, y, 0, y + 100, [[0, '#6a4418'], [1, '#2a1808']]); c.fillRect(1080, y, 1100, 100);
        c.fillStyle = '#d9a84a'; c.fillRect(1080, y + 92, 1100, 7); c.fillStyle = 'rgba(255,220,150,0.3)'; c.fillRect(1080, y, 1100, 3);
        for (let i = 0; i < 9; i++) { const x = 1110 + i * 118; c.fillStyle = 'rgba(20,10,4,0.8)'; c.beginPath(); archPath(x, x + 92, y + 40, y + 92); c.fill(); glow(x + 46, y + 44, 44, '#ffc66a', 0.5 * flicker(tt, r * 10 + i, 0.08)); }
        crowd({ x0: 1100, x1: 2180, y: y + 104, rows: 1, h: 44, seed: 30 + r, fill: '#1a0e06', density: 0.9, raise: 0.25 + 0.6 * turn, hats: 0.2, t: tt, sway: 1 + turn });
      }
      // chandeliers
      for (const [x, y, s] of [[1260, 60, 1], [1680, 40, 0.8], [760, 50, 0.9]]) { for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, px = x + Math.cos(a) * 60 * s, py = y + Math.sin(a) * 16 * s; glow(px, py, 34 * s, '#ffd98a', 0.75 * flicker(tt, i + x, 0.1)); circle(px, py, 2.2, '#fff6dc'); } glow(x, y, 300 * s, '#ffb84a', 0.3); }
    });
    L(0.7, () => {
      // orchestra and chorus, stage left
      for (let r = 0; r < 4; r++) crowd({ x0: -200, x1: 640 - r * 30, y: 520 + r * 46 - 150, rows: 1, h: 86 + r * 8, seed: 50 + r, fill: mix('#2a1808', '#140b05', r / 3), density: 0.95, raise: 0, hats: 0, t: tt, sway: 0.6 });
      const dk = '#0e0704';
      for (let i = 0; i < 9; i++) {
        const x = 60 + i * 66, y = 640 + (i % 2) * 22, bow = Math.sin(tt * 5.2 + i * 0.7) * (1 - turn * 0.9);
        const f = figure(x, y, 210, { face: 1, fill: dk, sit: true, robe: false, armF: [1.1 + bow * 0.3, 1.2 - bow * 0.5], armB: [1.3, 1.6], rim: '#8a5a22', light: 1 });
        line(f.hands[1][0] - 8, f.hands[1][1] + 6, f.hands[1][0] + 46, f.hands[1][1] - 26, dk, 9); // violin
        line(f.hands[0][0] - 50, f.hands[0][1] + 20 - bow * 18, f.hands[0][0] + 40, f.hands[0][1] - 34 + bow * 18, '#c9a46a', 1.8); // bow
      }
      rect(-300, 660, 1000, 30, '#1c1008');
    });
    L(1, () => {
      // stage floor, footlights
      c.fillStyle = lin(0, 690, 0, 804, [[0, '#3a2210'], [1, '#0c0603']]); c.fillRect(-300, 690, 2500, 200);
      for (let i = 0; i < 12; i++) glow(720 + i * 34, 700, 40, '#ffca6a', 0.4 * flicker(tt, i, 0.1));
      // the contralto who takes his sleeve
      const step = seg(t, 3.2, 4.3, E.io);
      const cu = figure(lerp(600, 800, step), 700, 340, { face: 1, fill: '#1a0d08', rim: '#ffca7a', light: 1, head: 'bun', armF: [lerp(0.2, 1.25, step) - turn * 0.5, 0.5], armB: [0.2, 0.3] });
      // Beethoven on the podium: beating time to music long finished, then turned by the shoulders
      rect(850, 690, 180, 16, '#22140a');
      const sxk = Math.cos(Math.PI * turn), beatA = Math.sin(tt * (Math.PI * 2 / shot.beat) * 0.5) * (1 - turn);
      c.save(); c.translate(940, 0); c.scale(Math.abs(sxk) < 0.08 ? 0.08 : -sxk, 1); c.translate(-940, 0);
      ludwig(c, 940, 692, 380, { face: 1, rim: '#ffd08a', light: turn > 0.5 ? 1 : -1, armF: [lerp(1.5 + beatA * 0.5, 0.25, turn), lerp(0.9 - beatA * 0.6, 0.25, turn)], armB: [lerp(1.2 - beatA * 0.5, 0.2, turn), lerp(1.2 + beatA * 0.5, 0.2, turn)], stride: 0.3, nod: lerp(0.25, -0.12, turn) });
      c.restore();
      rect(1016 - 190 * (1 - turn) - 20, 560, 8, 136, '#1a0e06'); poly([[1016 - 190 * (1 - turn) - 60, 552], [1016 - 190 * (1 - turn) + 30, 540], [1016 - 190 * (1 - turn) + 34, 560], [1016 - 190 * (1 - turn) - 56, 572]], '#2a180a'); // music stand
    });
    L(1.25, () => {
      // the house on its feet: hats and handkerchiefs in the air, so that he can see
      crowd({ x0: 1040, x1: 2300, y: 800, rows: 5, h: 150, seed: 77, fill: '#0c0604', fill2: '#3a2210', density: 1, raise: 0.25 + 0.7 * turn, hats: 0.25, t: tt, sway: 1.2 + turn, depth: 0.84, rowGap: 0.4 });
      const R = rng(5);
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 70; i++) {
        const born = 4.4 + R() * 3.4, u = (tt - born) / (1.6 + R());
        const x = 1080 + R() * 900, y0 = 380 + R() * 330, s = 5 + R() * 9, ph = R() * 9;
        if (u <= 0 || u >= 1) continue;
        const y = y0 - Math.sin(u * Math.PI) * (70 + R() * 110), a = Math.sin(u * Math.PI) * 0.9;
        c.save(); c.translate(x + Math.sin(tt * 3 + ph) * 16, y); c.rotate(tt * 4 + ph); c.scale(1, 0.4 + 0.6 * Math.abs(Math.sin(tt * 6 + ph)));
        rect(-s, -s, s * 2, s * 2, col('#fff3d6', a)); c.restore();
      }
      c.restore();
    });
    motes({ n: 90, seed: 3, t: tt, hex: '#ffd89a', alpha: 0.8 });
    // the silence: colour and sharpness drain to the edges
    if (deaf > 0) {
      c.save(); c.globalCompositeOperation = 'saturation'; c.fillStyle = `rgba(90,80,70,${0.5 * deaf})`; c.fillRect(0, 0, W, H); c.restore();
      c.fillStyle = rad(940, 400, 200, 1150, [[0, 'rgba(0,0,0,0)'], [1, `rgba(0,0,0,${0.6 * deaf})`]]); c.fillRect(0, 0, W, H);
    }
  };
})();
