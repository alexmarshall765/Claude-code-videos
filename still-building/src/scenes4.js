/* =============================================================================
 *  ACT IV — DEFENDING FREEDOM
 *  doughboys → arsenal → shipyard → fortress → normandy → victory
 * ========================================================================== */
'use strict';

/** B-17 planform (seen from above), nose toward -y. Span ~208 units. */
function b17(g, x, y, s, rot = 0, squash = 0.5, prop = 0) {
  g.save(); g.translate(x, y); g.scale(1, squash); g.rotate(rot); g.scale(s, s);
  g.beginPath();                                   // wings
  g.moveTo(-104, 6); g.quadraticCurveTo(-106, -4, -96, -8); g.lineTo(-12, -30); g.lineTo(12, -30); g.lineTo(96, -8);
  g.quadraticCurveTo(106, -4, 104, 6); g.lineTo(14, 12); g.lineTo(-14, 12); g.closePath(); g.fill();
  g.beginPath(); g.ellipse(0, 0, 8.5, 74, 0, 0, TAU); g.fill();    // fuselage
  g.beginPath(); g.moveTo(-36, 60); g.lineTo(-10, 48); g.lineTo(10, 48); g.lineTo(36, 60); g.lineTo(34, 68); g.lineTo(-34, 68); g.closePath(); g.fill();
  for (const ex of [-62, -32, 32, 62]) {            // engines and prop discs
    const ey = -17 - (1 - Math.abs(ex) / 62) * 9;
    rrect(g, ex - 5, ey - 16, 10, 24, 4);
    g.save(); g.globalAlpha *= 0.28; g.beginPath(); g.ellipse(ex, ey - 17, 16, 2.4, 0, 0, TAU); g.fill(); g.restore();
  }
  g.restore();
}
/** Soldier seen from behind, head and shoulders (for the landing-craft foreground). */
function backHelmet(g, x, y, s, rifle = false) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.beginPath(); g.moveTo(-120, 200); g.bezierCurveTo(-118, 60, -90, 20, -34, 4); g.lineTo(34, 4); g.bezierCurveTo(90, 20, 118, 60, 120, 200); g.closePath(); g.fill();
  rrect(g, -24, -30, 48, 44, 10);
  g.beginPath(); g.ellipse(0, -62, 62, 58, 0, Math.PI, 0); g.lineTo(68, -50); g.quadraticCurveTo(0, -36, -68, -50); g.closePath(); g.fill();
  rrect(g, -70, 40, 140, 170, 24);
  if (rifle) { g.save(); g.rotate(0.08); g.fillRect(96, -250, 11, 460); g.fillRect(92, -120, 19, 90); g.restore(); }
  g.restore();
}
/** Landing craft (LCVP) seen from astern at a distance. */
function lcvp(g, x, y, s, t = 0) {
  g.save(); g.translate(x, y + Math.sin(t * 1.3 + x) * 3 * s); g.scale(s, s);
  fillPoly(g, [[-52, 6], [-56, -30], [56, -30], [52, 6]]); g.fillRect(-46, -52, 92, 24);
  for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(-36 + i * 12, -54, 5.5, Math.PI, 0); g.fill(); }
  g.fillRect(20, -78, 3, 30); g.fillRect(-2, -70, 12, 20);
  g.restore();
}
/** Warship hull-down on the horizon. */
function warship(g, x, y, s, kind = 0) {
  g.save(); g.translate(x, y); g.scale(s, s);
  fillPoly(g, [[-150, 0], [-162, -16], [-60, -18], [-56, -30], [70, -30], [74, -18], [150, -20], [164, -4], [150, 0]]);
  g.fillRect(-30, -62, 44, 34); g.fillRect(-18, -84, 20, 24); g.fillRect(-10, -120, 4, 40);
  g.fillRect(24, -52, 16, 24); if (kind) g.fillRect(46, -48, 14, 20);
  for (const tx of [-96, -74, 96]) { g.fillRect(tx - 10, -28, 20, 10); g.fillRect(tx * 1.0 + (tx < 0 ? -34 : 10), -26, 24, 3); }
  g.restore();
}
/** Four-engine bomber on the assembly floor, side view, nose toward +x. ~700 units long. */
function bomberSide(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s); ART.both(g);
  g.beginPath();
  g.moveTo(340, -150); g.bezierCurveTo(372, -150, 386, -128, 386, -112); g.bezierCurveTo(386, -92, 366, -78, 330, -74);
  g.lineTo(-200, -84); g.lineTo(-360, -116); g.lineTo(-372, -128); g.lineTo(-330, -140); g.lineTo(-250, -150);
  g.lineTo(120, -170); g.bezierCurveTo(160, -196, 220, -196, 250, -172); g.closePath(); g.fill();
  fillPoly(g, [[-262, -148], [-330, -290], [-372, -294], [-352, -140]]);       // fin
  fillPoly(g, [[-250, -132], [-400, -126], [-402, -116], [-250, -112]]);
  // wing root and nacelles
  rrect(g, -40, -128, 250, 30, 12);
  for (const nx of [40, 150]) { rrect(g, nx - 20, -138, 92, 46, 20); g.lineWidth = 7; line(g, nx + 78, -206, nx + 78, -24); circle(g, nx + 78, -115, 10); }
  // gear
  g.lineWidth = 8; line(g, 90, -96, 96, -26); ART.wheel(g, 96, -26, 26, 0, 6, 0.4); line(g, -330, -118, -334, -14); circle(g, -334, -12, 12);
  g.restore();
}

/** Four-engine heavy bomber seen head-on, standing on its gear. Span ~1000 units; (x, y) = ground under the nose. */
function bomberFront(g, x, y, s, prop = 0) {
  g.save(); g.translate(x, y); g.scale(s, s); ART.both(g);
  const wy = -150;
  fillPoly(g, [[-500, wy - 34], [-60, wy - 4], [60, wy - 4], [500, wy - 34], [500, wy - 26], [60, wy + 22], [-60, wy + 22], [-500, wy - 26]]);
  fillPoly(g, [[-170, wy - 44], [170, wy - 44], [170, wy - 38], [-170, wy - 38]]);        // tailplane behind
  fillPoly(g, [[-7, wy - 60], [0, wy - 250], [7, wy - 60]]);                                 // fin
  g.beginPath(); g.ellipse(0, wy, 54, 64, 0, 0, TAU); g.fill();
  fillPoly(g, [[-30, wy - 58], [-22, wy - 84], [22, wy - 84], [30, wy - 58]]);
  for (const ex of [-330, -175, 175, 330]) {
    const ey = wy - 12 - Math.abs(ex) * 0.045;
    circle(g, ex, ey, 36);
    g.save(); g.translate(ex, ey); g.rotate(prop + ex * 0.01);
    for (let i = 0; i < 3; i++) { g.rotate(TAU / 3); g.beginPath(); g.ellipse(0, -52, 9, 50, 0, 0, TAU); g.fill(); }
    g.restore();
  }
  for (const gx of [-175, 175]) { g.lineWidth = 12; line(g, gx, wy + 10, gx, -44); g.beginPath(); g.ellipse(gx, -42, 17, 42, 0, 0, TAU); g.fill(); }
  g.restore();
}

// -----------------------------------------------------------------------------
// 19. Over there
// -----------------------------------------------------------------------------
SCENES.doughboys = S => {
  const { g, t } = S, sun = [1380, 470];
  S.cam = { x: -10 * t, y: 0, z: 1 + 0.05 * S.p };
  PLATE.sky(S, { hy: 760, sun, c0: '#1a2434', c1: '#56637a', c2: '#c9b9a2', sc: '#fff0d6', ss: 34, sg: 0.6, cl: 0.75, cs: 1.3, ch: 1.5, cd: '#2a3242', cb: '#d8cdbc', cv: [0.02, 0], seed: 151, dk: 0.35 });
  S.layer(0.2, () => {
    g.fillStyle = '#7d8591'; ridge(g, { y: 740, amp: 40, freq: 0.0016, seed: 3 });
    g.fillRect(380, 610, 40, 130); fillPoly(g, [[374, 612], [400, 520], [426, 612]]); g.fillRect(300, 680, 220, 70);
    fillPoly(g, [[296, 682], [350, 650], [520, 650], [526, 682]]);
    for (let i = 0; i < 9; i++) ART.tree(g, 620 + i * 150 + (i * 47 % 60), 742, 0.5 + (i * 31 % 10) / 40, i, true);
  });
  ART.haze(g, 600, 800, [0.8, 0.78, 0.74], 0, 0.5);
  const road = { y: 800, amp: 22, freq: 0.0011, seed: 7 }, gy = x => ridgeY(road, x);
  S.layer(0.6, () => {
    g.fillStyle = '#272c36'; ridge(g, road);
    for (let i = 0; i < 6; i++) ART.tree(g, 120 + i * 400 + (i * 83 % 90), gy(120 + i * 400) + 4, 1.5 + (i * 29 % 10) / 14, i + 20, true);
    g.fillStyle = '#1b1f28';
    ART.column(g, { n: 30, x0: -300, x1: W + 400, t, speed: 34, h: 150, seed: 2, gy: x => gy(x) + 4, face: -1, jitter: 0.25, opts: () => ({ hat: 'brodie', pack: true, carry: 'rifle', armF: [0.9, 2.2], stride: 0.36 }) });
  });
  ART.haze(g, 720, 900, [0.78, 0.78, 0.76], 0, 0.3);
  S.layer(1.15, () => {
    const fg = { y: 1010, amp: 20, freq: 0.001, seed: 9 };
    g.fillStyle = '#07090c'; ridge(g, fg);
    ART.column(g, { n: 7, x0: -500, x1: W + 600, t, speed: 92, h: 420, seed: 5, gy: x => ridgeY(fg, x) + 14, face: -1, jitter: 0.2, vary: 0.04, opts: () => ({ hat: 'brodie', pack: true, carry: 'rifle', armF: [0.9, 2.2], stride: 0.36, broad: true }) });
  });
  ART.motes(g, { t, n: 60, seed: 4, vx: -14, vy: 10, size: 1.5, col: [0.95, 0.95, 1], a: 0.35, op: 'lighter' });
  S.post = { sun, rays: 0.55, rayc: [1, 0.94, 0.82], th: 0.72, bloom: 0.5, expo: 1.0, con: 0.36, sat: 0.72, vig: 0.72, shadow: [0.44, 0.5, 0.6], high: [0.58, 0.54, 0.46] };
  TYPE.year(S, '1917', 'THE AMERICAN EXPEDITIONARY FORCES, FRANCE', 0.6, 5.6);
  TYPE.say(S, 'WHEN FREEDOM CALLED', 1.4, 6.2, { y: 250, size: 52 });
};

// -----------------------------------------------------------------------------
// 20. The arsenal of democracy
// -----------------------------------------------------------------------------
SCENES.arsenal = S => {
  const { g, t } = S, floor = 930;
  S.cam = { x: 12 * t, y: 0, z: 1.0 + 0.06 * S.p };
  g.fillStyle = vgrad(g, 0, H, [[0, '#1c232e'], [0.5, '#2c3642'], [1, '#0a0c10']]); g.fillRect(0, 0, W, H);
  // roof trusses and lamps
  S.layer(0.25, () => {
    g.strokeStyle = '#0a0c10'; g.fillStyle = '#0a0c10'; g.lineWidth = 6;
    for (let x = -300; x < W + 500; x += 220) { line(g, x, 40, x + 110, 120); line(g, x + 110, 120, x + 220, 40); }
    g.fillRect(-300, 34, W + 900, 10); g.fillRect(-300, 116, W + 900, 8);
    for (let x = -200; x < W + 400; x += 260) { g.fillRect(x - 2, 120, 4, 40); fillPoly(g, [[x - 26, 182], [x - 10, 160], [x + 10, 160], [x + 26, 182]]); }
  });
  for (let x = -200; x < W + 400; x += 260) { const lx = x - S.cam.x * 0.25; glow(g, lx, 190, 460, [1, 0.86, 0.62], 0.36); glow(g, lx, 186, 24, [1, 0.96, 0.85], 1); }
  // the line: bombers nose to tail, receding into the haze
  for (let i = 4; i >= 0; i--) {
    const z = 1 + i * 0.85, sc = 1.25 / z;
    S.layer(0.35 + 0.6 / z, () => {
      g.fillStyle = mixHex('#07090c', '#59636e', clamp(i / 4.4));
      bomberFront(g, 1150 - i * 330, floor - 170 * (1 - 1 / z), sc, t * 0.25 + i);
    });
    if (i === 1) ART.haze(g, 300, 900, [0.8, 0.74, 0.64], 0.16, 0.02);
  }
  S.layer(0.95, () => {
    g.fillStyle = '#07090c'; g.strokeStyle = '#07090c';
    g.fillRect(-300, floor, W + 900, 400);
    // work stand under the outboard engine, a riveter on it
    g.lineWidth = 7; g.fillRect(1440, floor - 330, 230, 12); line(g, 1452, floor - 330, 1432, floor); line(g, 1658, floor - 330, 1678, floor); line(g, 1440, floor - 165, 1672, floor - 165);
    ART.figure(g, 1560, floor - 330, 200, { hat: 'bandana', face: -1, armF: [2.3, 2.8], armB: [2.0, 2.6] });
    ART.figure(g, 880, floor + 4, 210, { hat: 'bandana', armF: [0.4, 1.0], armB: [0.1, 0.4], walk: t * 0.5 });
  });
  ART.sparks(g, { x: 1500 - S.cam.x, y: 520, t, n: 60, seed: 5, life: 0.6, spd: 320, grav: 900, spread: 2.8, col: [1, 0.85, 0.55], size: 2.2 });
  // Rosie in the foreground, rivet gun to a wing panel
  S.layer(1.3, () => {
    const kick = Math.sin(t * 42) * 0.02;
    g.fillStyle = '#020304';
    fillPoly(g, [[760, 1200], [700, 610], [780, 590], [1100, 1200]]);
    ART.figure(g, 380, 1290, 780, { hat: 'bandana', broad: true, armF: [1.3 + kick, 1.62 + kick], armB: [1.0, 1.72], lean: 0.05 });
    g.fillRect(600, 716, 96, 30); g.fillRect(690, 724, 30, 12); g.fillRect(616, 744, 24, 60);
    ART.sparks(g, { x: 724, y: 730, t, n: 70, seed: 9, life: 0.45, spd: 420, grav: 900, dir: Math.PI, spread: 2.4, col: [1, 0.9, 0.65], size: 2.6 });
    glow(g, 722, 730, 130, [1, 0.85, 0.55], 0.5 + 0.5 * Math.abs(Math.sin(t * 42)));
  });
  S.post = { bloom: 0.75, th: 0.6, streak: 0.3, expo: 1.05, con: 0.36, sat: 0.92, vig: 0.72, shadow: [0.44, 0.5, 0.6], high: [0.62, 0.54, 0.42] };
  TYPE.year(S, '1942', 'WILLOW RUN, MICHIGAN', 0.4, 3.2);
};

// -----------------------------------------------------------------------------
// 21. Down the ways
// -----------------------------------------------------------------------------
SCENES.shipyard = S => {
  const { g, t } = S, hy = 780, sun = [420, 560];
  S.cam = { x: 0, y: 0, z: 1.06 - 0.05 * S.p };
  PLATE.sky(S, { hy, sun, c0: '#152846', c1: '#5d7088', c2: '#e8b98a', sc: '#ffe6c0', ss: 40, sg: 0.75, cl: 0.6, cs: 1.1, ch: 1.5, cd: '#33405a', cb: '#f6d2a6', seed: 161 });
  PLATE.ocean(S, { hy, sun, deep: '#07111c', refl: '#b08e72', fog: '#e2b88e', sc: '#ffe0b4', spd: 0.25, glit: 1.3, fogA: 0.7, chop: 1.2 });
  S.layer(0.3, () => {
    g.fillStyle = '#6e7b8c'; g.strokeStyle = '#6e7b8c';
    for (let i = 0; i < 5; i++) {               // more hulls on more ways, cranes over each
      const x = 150 + i * 430;
      fillPoly(g, [[x - 150, hy], [x - 170, hy - 60], [x + 130, hy - 60], [x + 170, hy - 30], [x + 150, hy]]);
      g.fillRect(x - 6, hy - 250, 12, 250); g.fillRect(x - 130, hy - 258, 220, 10); g.lineWidth = 2; line(g, x - 120, hy - 250, x - 120, hy - 150); line(g, x + 80, hy - 250, x, hy - 300); line(g, x - 126, hy - 256, x, hy - 300);
    }
  });
  S.layer(0.7, () => {
    // the Liberty ship slides stern-first into the water
    const sx = lerp(760, 1040, seg(t, 0.2, 3.6, E.quadIn)), y = hy + 56;
    g.fillStyle = '#0b0e13'; g.strokeStyle = '#0b0e13';
    g.save(); g.translate(sx, y); g.rotate(-0.012);
    fillPoly(g, [[-560, 0], [-620, -150], [-560, -156], [560, -150], [640, -168], [600, 0]]);
    g.fillRect(-90, -250, 190, 100); g.fillRect(-60, -300, 110, 52); g.fillRect(-14, -372, 40, 76);
    for (const mx of [-380, -230, 250, 400]) { g.fillRect(mx - 5, -330, 10, 180); g.lineWidth = 3; line(g, mx, -320, mx - 70, -160); line(g, mx, -320, mx + 70, -160); }
    // bunting stem to stern
    g.lineWidth = 2; g.beginPath(); g.moveTo(-600, -150); g.lineTo(-380, -330); g.lineTo(6, -372); g.lineTo(400, -330); g.lineTo(630, -168); g.stroke();
    g.restore();
    const spl = seg(t, 1.2, 3.2);
    ART.puffs(g, { x: sx + 590, y: y - 4, t: t * 1.5, n: 16, seed: 3, rise: 110 * spl, drift: 190, r0: 20, r1: 110, col: [0.95, 0.93, 0.9], a: 0.6 * spl, spd: 0.6 });
    // slipway and the yard crowd
    g.fillStyle = '#06080b';
    fillPoly(g, [[-200, y - 6], [760, y + 6], [1000, y + 30], [1000, 1300], [-200, 1300]]);
  });
  S.layer(1.1, () => {
    g.fillStyle = '#030405'; g.fillRect(-200, 990, W + 400, 300);
    for (let i = 0; i < 26; i++) {
      const x = -60 + i * 80 + (i * 37 % 40), c = 0.5 + 0.5 * Math.sin(t * 6 + i * 2.1);
      ART.figure(g, x, 1000 + (i % 3) * 8, 210 + (i * 53 % 40), { hat: ['hardhat', 'bandana', 'cap'][i % 3], face: 1, armF: [2.3 + 0.5 * c, 2.9 + 0.3 * c], armB: i % 2 ? [2.1 + 0.4 * c, 2.8] : [0.1, 0.3] });
    }
  });
  S.post = { sun, rays: 0.6, rayc: [1, 0.9, 0.72], th: 0.74, bloom: 0.5, expo: 1.0, sat: 0.86, vig: 0.66, shadow: [0.44, 0.5, 0.6], high: [0.62, 0.54, 0.42] };
  TYPE.say(S, 'THEY ANSWERED', 0.35, 3.1, { y: 250, size: 52, fi: 0.4, fo: 0.5 });
};

// -----------------------------------------------------------------------------
// 22. The Flying Fortresses
// -----------------------------------------------------------------------------
SCENES.fortress = S => {
  const { g, t } = S, hy = 470, sun = [1420, 400];
  S.cam = { x: 0, y: 0, z: 1 + 0.04 * S.p };
  PLATE.sky(S, { hy, sun, c0: '#0a1c46', c1: '#3f66a6', c2: '#f3b07a', sc: '#ffe4b8', ss: 36, sg: 0.9, cl: 0.25, cs: 0.8, ch: 2.0, cd: '#39507e', cb: '#ffd9ae', seed: 171 });
  PLATE.run(S, 'deck', { hy, sun, seed: 4, spd: 0.22, cover: 0.9, lit: '#f6c79a', dark: '#39446a', fog: '#f0b486', sc: '#ffe0b0' }, ['lit', 'dark', 'fog', 'sc']);
  // the box formation: ships step back and up toward the horizon
  const ships = [];
  for (let i = 0; i < 16; i++) {
    const row = Math.floor(i / 4), k = i % 4;
    const z = 1 + row * 0.9 + k * 0.12 + (i * 7 % 3) * 0.1;
    ships.push({ x: 300 + k * 330 + row * 150 + (i * 53 % 60), yw: 0.52 + row * 0.045 - k * 0.02, z, i });
  }
  ships.sort((a, b) => b.z - a.z);
  for (const s of ships) {
    const sc = 1.75 / s.z, drift = Math.sin(t * 0.5 + s.i * 1.7) * 10 * sc, bob = Math.cos(t * 0.6 + s.i) * 6 * sc;
    const x = s.x + (960 - s.x) * (1 - 1 / s.z) * 0.35 + drift + t * 12 * sc, y = hy + (H - hy) * (0.86 / s.z) - 250 * sc + bob;
    const haze = clamp((s.z - 1) / 3.2);
    // contrail
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const ex of [-62, -32, 32, 62]) {
      const gr = g.createLinearGradient(x, y, x - 900 * sc, y + 250 * sc);
      gr.addColorStop(0, 'rgba(255,236,214,0)'); gr.addColorStop(0.06, `rgba(255,236,214,${0.34 * (1 - haze * 0.5)})`); gr.addColorStop(1, 'rgba(255,236,214,0)');
      g.fillStyle = gr;
      const px = x + ex * sc * 0.62, py = y + ex * sc * 0.31;
      fillPoly(g, [[px, py - 2 * sc], [px, py + 2 * sc], [px - 900 * sc, py + 250 * sc + 26 * sc], [px - 900 * sc, py + 250 * sc - 26 * sc]]);
    }
    g.restore();
    // shadow on the deck, then the aircraft
    g.fillStyle = `rgba(20,24,50,${0.22 * (1 - haze)})`; b17(g, x - 150 * sc, y + 300 * sc, sc * 1.0, 1.25, 0.34);
    g.fillStyle = mixHex('#080a12', '#a98a86', haze * 0.8); b17(g, x, y, sc, 1.12, 0.5);
  }
  S.post = { sun, rays: 0.55, rayc: [1, 0.86, 0.62], th: 0.76, bloom: 0.55, streak: 0.45, expo: 1.0, sat: 0.95, vig: 0.66, shadow: [0.44, 0.5, 0.6], high: [0.62, 0.54, 0.42] };
  TYPE.year(S, '1943', 'THE EIGHTH AIR FORCE, OVER EUROPE', 0.8, 5.8);
};

// -----------------------------------------------------------------------------
// 23. Normandy
// -----------------------------------------------------------------------------
SCENES.normandy = S => {
  const { g, t } = S, sway = Math.sin(t * 1.1) * 14, hy = 500 + sway * 0.6, sun = [1250, -160];
  PLATE.sky(S, { hy, sun, c0: '#1b2330', c1: '#4c5868', c2: '#a9a79f', sc: '#f4ecdc', ss: 90, sg: 0.5, cl: 0.85, cs: 1.5, ch: 1.4, cd: '#252c38', cb: '#c9c6bd', cv: [0.02, 0], seed: 181, dk: 0 });
  PLATE.ocean(S, { hy, sun: [1250, 300], deep: '#0b1218', refl: '#7d8890', fog: '#a8aaa6', sc: '#e8e4d8', spd: 1.1, glit: 0.5, fogA: 0.8, chop: 1.6 });
  // the coast: bluffs, obstacles, balloons, the fleet
  g.save(); g.translate(0, sway * 0.6);
  g.fillStyle = '#6f7880'; ridge(g, { y: 478, amp: 22, freq: 0.004, seed: 5, base: 502 });
  g.fillStyle = '#7b848b'; g.strokeStyle = '#7b848b'; g.lineWidth = 1;
  for (let i = 0; i < 9; i++) { const x = 140 + i * 210 + (i * 67 % 80), y = 250 + (i * 91 % 150); ellipse(g, x, y, 22, 9); fillPoly(g, [[x + 16, y - 3], [x + 30, y - 12], [x + 30, y + 10]]); line(g, x, y + 8, x + 12, 480); }
  g.fillStyle = '#5c666e'; warship(g, 330, 506, 0.55, 0); warship(g, 1580, 508, 0.7, 1); warship(g, 760, 504, 0.36, 1);
  g.restore();
  ART.haze(g, 420, 620, [0.72, 0.74, 0.73], 0.55, 0);
  for (const [x, y, s] of [[420, 610, 0.9], [1500, 640, 1.2], [1060, 580, 0.6], [150, 590, 0.55], [1790, 596, 0.6]]) {
    g.fillStyle = mixHex('#11161b', '#6c757c', clamp(1 - s)); lcvp(g, x, y + sway * 0.4, s, t);
    g.fillStyle = 'rgba(225,228,228,0.4)'; fillPoly(g, [[x - 50 * s, y + 6 * s + sway * 0.4], [x + 50 * s, y + 6 * s + sway * 0.4], [x + 120 * s, y + 80 * s + sway * 0.4], [x - 120 * s, y + 80 * s + sway * 0.4]]);
  }
  // our boat: ramp, gunwales, the men waiting
  const bob = Math.sin(t * 1.1 + 1) * 10;
  g.save(); g.translate(0, bob); g.rotate(Math.sin(t * 0.8) * 0.008);
  g.fillStyle = vgrad(g, 560, 1080, [[0, '#3b444c'], [1, '#161b20']]);
  fillPoly(g, [[560, 1100], [610, 560], [1310, 560], [1360, 1100]]);
  g.fillStyle = '#20262c'; for (let i = 0; i < 6; i++) g.fillRect(630 + i * 112, 580, 12, 500);
  g.fillRect(604, 552, 712, 16);
  g.fillStyle = '#0c1014';
  fillPoly(g, [[-100, 1200], [-100, 640], [560, 600], [610, 1200]]); fillPoly(g, [[W + 100, 1200], [W + 100, 640], [1360, 600], [1310, 1200]]);
  g.strokeStyle = 'rgba(190,200,206,0.35)'; g.lineWidth = 3; line(g, -100, 640, 560, 600); line(g, W + 100, 640, 1360, 600);
  const men = [[700, 800, 1.0, 0], [940, 770, 1.05, 1], [1190, 810, 1.0, 0], [500, 900, 1.35, 1], [1420, 910, 1.4, 0], [820, 960, 1.5, 0], [1100, 980, 1.55, 1], [240, 1040, 1.9, 0], [1700, 1050, 1.9, 1]];
  men.forEach(([x, y, s, r], i) => {
    const yy = y + Math.sin(t * 1.4 + i) * 5;
    g.fillStyle = '#030405'; backHelmet(g, x, yy, s, !!r);
    // cold sky light along the crown of each helmet
    g.strokeStyle = 'rgba(200,210,216,0.5)'; g.lineWidth = 3.5 * s; g.lineCap = 'round';
    g.beginPath(); g.ellipse(x, yy - 62 * s, 60 * s, 56 * s, 0, Math.PI * 1.12, Math.PI * 1.72); g.stroke();
  });
  g.restore();
  // spray off the bow
  ART.motes(g, { t: t * 3, n: 90, seed: 2, x: 300, y: 300, w: 1300, h: 500, vx: -60, vy: 90, size: 2, col: [0.9, 0.92, 0.94], a: 0.4, sway: 30, op: 'lighter' });
  S.post = { sun, rays: 0.4, rayc: [0.95, 0.95, 0.92], th: 0.74, bloom: 0.5, expo: 0.98, con: 0.4, sat: 0.55, vig: 0.78, shadow: [0.44, 0.5, 0.58], high: [0.54, 0.53, 0.5] };
  TYPE.year(S, 'JUNE 6, 1944', 'NORMANDY, FRANCE', 1.0, 6.0);
};

// -----------------------------------------------------------------------------
// 24. Victory
// -----------------------------------------------------------------------------
SCENES.victory = S => {
  const { g, t } = S, sun = [960, 400];
  S.cam = { x: 0, y: -10 * S.p, z: 1.0 + 0.06 * S.p };
  PLATE.sky(S, { hy: 900, sun, c0: '#1a3f86', c1: '#6f9ad4', c2: '#ffe2b0', sc: '#fff2d0', ss: 44, sg: 0.85, cl: 0.4, cs: 1.0, ch: 1.4, cd: '#5a78a8', cb: '#fff4dc', seed: 191 });
  // the avenue: façades converge on the light
  S.layer(0.4, () => {
    for (let k = 0; k < 6; k++) {
      const u = k / 6, c = mixHex('#0b0d16', '#a8947e', 1 - u * 0.9 - 0.1);
      for (const sgn of [-1, 1]) {
        const x0 = 960 + sgn * (150 + 950 * u), x1 = 960 + sgn * (150 + 950 * (u + 0.2)), top = 520 - 640 * u - (k * 97 % 80) * (1 + u), base = 900 + 260 * u;
        const t1 = top - 90 * u, b1 = base + 60;
        g.fillStyle = c; fillPoly(g, [[x0, top], [x1, t1], [x1, b1], [x0, base]]);
        // storeys, piers and a cornice give the stone some scale
        g.strokeStyle = `rgba(10,10,18,${0.1 + 0.2 * u})`; g.lineWidth = 3 + 7 * u;
        const rows = 9 + k;
        for (let j = 1; j < rows; j++) line(g, x0, lerp(top, base, j / rows), x1, lerp(t1, b1, j / rows));
        g.lineWidth = 2 + 3 * u; for (let j = 1; j < 5; j++) { const xx = lerp(x0, x1, j / 5); line(g, xx, lerp(top, t1, j / 5), xx, lerp(base, b1, j / 5)); }
        g.fillStyle = `rgba(8,8,14,${0.35 + 0.3 * u})`; fillPoly(g, [[x0, top], [x1, t1], [x1, t1 + 14 + 20 * u], [x0, top + 10 + 16 * u]]);
        // bunting from the windows
        for (let j = 2; j < rows - 2; j += 3) { const xx = lerp(x0, x1, 0.5), yy = lerp(lerp(top, base, j / rows), lerp(t1, b1, j / rows), 0.5), w = 26 + 60 * u; g.fillStyle = '#9e2030'; g.fillRect(xx - w / 2, yy, w, w * 0.5); g.fillStyle = '#e9e2d2'; g.fillRect(xx - w / 2, yy + w * 0.17, w, w * 0.16); g.fillStyle = '#27305e'; g.fillRect(xx - w / 2, yy, w * 0.4, w * 0.27); }
      }
    }
  });
  ART.haze(g, 300, 900, [1, 0.92, 0.76], 0.26, 0);
  // flags over the crowd
  const f48 = GLX.tex('flag48', ART.flagArt(48));
  for (const [x, y, w, sp] of [[250, 250, 620, 3.3], [1210, 300, 520, 3.8]]) {
    PLATE.run(S, 'flag', { tex: f48, rect: [x, y, w, w * 0.53], amp: 0.06, back: 0.35, spd: sp, shade: 0.4, tint: [1, 0.9, 0.7], T: t + x }, [], { res: 1 });
    g.fillStyle = '#07080b'; g.save(); g.translate(x - 4, y - 14); g.rotate(0.06); g.fillRect(-7, 0, 13, 1100); g.restore();
  }
  // the crowd, hats and arms in the air
  g.fillStyle = vgrad(g, 800, 1000, [[0, 'rgba(8,8,12,0)'], [1, 'rgba(8,8,12,0.9)']]); g.fillRect(0, 800, W, 300);
  for (let row = 0; row < 4; row++) {
    const y = 930 + row * 86, h = 230 + row * 95, n = 26 - row * 4;
    g.fillStyle = mixHex('#27242a', '#020203', row / 3);
    for (let i = 0; i < n; i++) {
      const x = -80 + (i + ((row * 0.37) % 1)) * (W + 160) / n + (h1(i * 3.3 + row) - 0.5) * 30, c = 0.5 + 0.5 * Math.sin(t * (5 + h1(i + row * 9) * 3) + i * 1.9 + row);
      const jump = Math.max(0, Math.sin(t * 4 + i * 2.3 + row)) * 14;
      ART.figure(g, x, y - jump + 40, h, { hat: ['cap', 'none', 'brim', 'bandana', 'm1'][(i + row * 2) % 5], face: i % 2 ? 1 : -1, broad: row > 1, armF: [2.3 + 0.6 * c, 2.9 + 0.3 * c], armB: (i + row) % 3 ? [2.2 + 0.5 * (1 - c), 2.8] : [0.1, 0.4] });
    }
  }
  // ticker tape
  ART.motes(g, { t, n: 260, seed: 11, y: -40, h: H + 80, vx: 26, vy: 150, size: 3.2, col: [1, 0.97, 0.9], a: 0.85, sway: 40, op: 'source-over', tw: 1.2 });
  ART.motes(g, { t, n: 120, seed: 17, y: -40, h: H + 80, vx: -20, vy: 110, size: 4.4, col: [1, 0.86, 0.5], a: 0.7, sway: 60, op: 'source-over', tw: 1.2 });
  S.post = { sun, rays: 0.75, rayc: [1, 0.92, 0.74], th: 0.76, bloom: 0.6, expo: 1.03, sat: 1.12, vig: 0.6, shadow: [0.46, 0.5, 0.58], high: [0.62, 0.55, 0.42] };
  TYPE.year(S, '1945', 'VICTORY', 0.9, 6.2);
};
