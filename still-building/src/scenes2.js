/* =============================================================================
 *  ACT II — BUILDING THE NATION
 *  wagons → hammer → spike → rails → growth → bridge
 * ========================================================================== */
'use strict';

// -----------------------------------------------------------------------------
// 8. Westward: the wagon train
// -----------------------------------------------------------------------------
SCENES.wagons = S => {
  const { g, t } = S, hy = 640, sun = [470, 548];
  S.cam = { x: -16 * t, y: 0, z: 1 + 0.045 * S.p };
  PLATE.sky(S, { hy, sun, c0: '#152454', c1: '#7d5a78', c2: '#f29a48', sc: '#ffd596', ss: 40, sg: 0.8, cl: 0.55, cs: 1.0, ch: 1.5, cd: '#3a2a4a', cb: '#ffb060', cv: [0.02, 0], seed: 41 });
  const far = { y: 600, amp: 120, freq: 0.0016, seed: 3, sharp: 0.85, oct: 5 }, mid = { y: 660, amp: 46, freq: 0.0022, seed: 8 };
  const plain = { y: 812, amp: 16, freq: 0.0012, seed: 5 }, gy = x => ridgeY(plain, x);
  S.layer(0.12, () => { g.fillStyle = '#b06a50'; ridge(g, far); });
  S.layer(0.3, () => { g.fillStyle = '#7a4636'; ridge(g, mid); ART.haze(g, 600, 700, [0.98, 0.66, 0.36], 0.0, 0.3); });
  S.layer(0.7, () => {
    g.fillStyle = '#1c100c'; ridge(g, plain);
    // dust kicked up behind the train, lit from the low sun
    for (let i = 0; i < 6; i++) ART.puffs(g, { x: 580 + i * 340 - t * 30, y: gy(600) - 6, t: t + i, n: 9, seed: i * 7, rise: 70, drift: 240, r0: 20, r1: 110, col: [1, 0.68, 0.38], a: 0.2, spd: 0.22 });
    for (let i = 0; i < 6; i++) {
      const x = 500 + i * 340 - t * 30, y = gy(x), sc = 1.0, near = clamp(1 - Math.abs(x - 520) / 900);
      g.fillStyle = '#120a08';
      ART.ox(g, x - 150 * sc, y + 2, sc * 0.92, t * 0.9 + i * 0.3, -1); ART.ox(g, x - 232 * sc, y + 2, sc * 0.92, t * 0.9 + i * 0.3 + 0.4, -1);
      g.lineWidth = 3; g.strokeStyle = '#120a08'; line(g, x - 96 * sc, y - 34 * sc, x - 250 * sc, y - 44 * sc);
      ART.wagon(g, x, y + 2, sc, -x / 27, -1, mixHex('#3a2318', '#f0b070', 0.25 + 0.6 * near, 0.96));
      g.fillStyle = '#120a08';
      ART.figure(g, x - 74 * sc, y + 3, 86, { walk: t * 0.9 + i * 0.37, face: -1, hat: 'brim', stride: 0.36 });
      if (i % 2 === 0) ART.figure(g, x + 96 * sc, y + 3, 78, { walk: t * 0.9 + i * 0.61, face: -1, hat: 'bonnet', skirt: true });
      if (i % 3 === 1) ART.figure(g, x + 132 * sc, y + 3, 52, { walk: t * 1.3 + i, face: -1 });
    }
  });
  S.layer(1.25, () => {
    const fgr = { y: 965, amp: 36, freq: 0.0014, seed: 12 };
    g.fillStyle = '#060303'; ridge(g, fgr);
    ART.grass(g, { y: 950, t, n: 260, hMin: 30, hMax: 110, seed: 2, x0: -200, x1: W + 300 });
    // a scout reins in to watch them pass
    const hx = 1640, hyy = ridgeY(fgr, hx) + 6;
    ART.horse(g, hx, hyy, 3.0, 0.06 + Math.sin(t * 0.6) * 0.01, -1);
    ART.figure(g, hx + 6, hyy - 140, 250, { sit: true, face: -1, hat: 'brim', armF: [0.5, 1.2], armB: [0.3, 1.0], lean: 0.05 });
  });
  ART.motes(g, { t, n: 70, seed: 6, vx: 22, vy: -5, size: 1.7, col: [1, 0.8, 0.5], a: 0.45 });
  S.post = { sun, rays: 0.6, rayc: [1, 0.76, 0.46], th: 0.72, bloom: 0.55, expo: 1.0, vig: 0.62, shadow: [0.48, 0.47, 0.56], high: [0.64, 0.53, 0.38] };
  TYPE.say(S, 'THEN CAME THE BUILDERS', 1.6, 6.6, { y: 300, size: 54 });
};

// -----------------------------------------------------------------------------
// 9. The last spike — the swing
// -----------------------------------------------------------------------------
SCENES.hammer = S => {
  const { g, t } = S, sun = [1260, 610];
  const q = clamp(t / S.dur);
  S.cam = { x: 0, y: 0, z: 1.0 + 0.06 * q };
  PLATE.sky(S, { hy: 760, sun, c0: '#101c48', c1: '#6a4a70', c2: '#f39245', sc: '#ffd28c', ss: 46, sg: 0.85, cl: 0.5, cs: 1.3, ch: 1.4, cd: '#30223e', cb: '#ffa858', seed: 52 });
  S.layer(0.2, () => { g.fillStyle = '#8a4e3c'; ridge(g, { y: 740, amp: 70, freq: 0.002, seed: 21, sharp: 0.7 }); });
  S.layer(0.5, () => {
    g.fillStyle = '#20120c'; g.fillRect(-100, 800, W + 200, 400);
    ART.poles(g, -100, W + 200, 806, { gap: 330, h: 190, off: 60 });
    // onlookers along the grade
    for (let i = 0; i < 9; i++) ART.figure(g, 1240 + i * 86 + (i * 37 % 30), 812, 150 + (i * 53 % 24), { hat: i % 2 ? 'brim' : 'cap', face: -1, armF: [0.1, 0.3], armB: [-0.1, 0.2] });
  });
  // the swing: slow wind-up, fast strike that lands exactly on the cut
  const up = seg(q, 0, 0.7, E.out), dn = seg(q, 0.74, 1, E.in);
  const a = lerp(lerp(1.3, 2.75, up), 0.95, dn), b = lerp(lerp(1.7, 3.35, up), 0.75, dn), c = lerp(lerp(2.2, 3.8, up), 0.95, dn);
  S.layer(1, () => {
    g.fillStyle = '#070403';
    fillPoly(g, [[-100, 900], [W + 100, 880], [W + 100, 1200], [-100, 1200]]);
    // rail and ties
    fillPoly(g, [[-100, 868], [W + 100, 846], [W + 100, 872], [-100, 898]]);
    for (let i = 0; i < 9; i++) fillPoly(g, [[i * 250 - 60, 896 - i * 2.8], [i * 250 + 60, 894 - i * 2.8], [i * 250 + 100, 960], [i * 250 - 80, 962]]);
    ART.figure(g, 800, 930, 660, { hat: 'brim', broad: true, armF: [a, b], armB: [a - 0.12, b - 0.08], lean: lerp(-0.1 * up, 0.1, dn), tool: { ang: c, len: 56, head: [22, 10] }, stride: 0.5, walk: 0.19 });
    // the spike itself catches the sun
    g.fillStyle = '#ffd46a'; fillPoly(g, [[1244, 812], [1262, 812], [1258, 876], [1248, 876]]); g.fillRect(1238, 804, 30, 9);
  });
  glow(g, 1253, 826, 90, [1, 0.8, 0.35], 0.5 + 0.3 * Math.sin(t * 9));
  ART.motes(g, { t, n: 60, seed: 9, vx: 18, vy: -6, size: 1.8, col: [1, 0.8, 0.5], a: 0.45 });
  S.post = { sun, rays: 0.75, rayc: [1, 0.74, 0.44], th: 0.7, bloom: 0.55, expo: 1.0, vig: 0.7, shadow: [0.48, 0.47, 0.56], high: [0.64, 0.53, 0.38] };
};

// -----------------------------------------------------------------------------
// 10. Promontory Summit
// -----------------------------------------------------------------------------
SCENES.spike = S => {
  const { g, t } = S, sun = [960, 540], rail = 812;
  S.cam = { x: 0, y: 0, z: 1.1 - 0.07 * seg(t, 0, 3, E.out) };
  PLATE.sky(S, { hy: 720, sun, c0: '#101c48', c1: '#6a4a70', c2: '#f59a4c', sc: '#ffd696', ss: 44, sg: 0.9, cl: 0.52, cs: 1.2, ch: 1.5, cd: '#30223e', cb: '#ffac5c', seed: 52 });
  S.layer(0.15, () => { g.fillStyle = '#9a5a42'; ridge(g, { y: 700, amp: 90, freq: 0.0018, seed: 23, sharp: 0.75 }); });
  S.layer(0.4, () => { g.fillStyle = '#5a3226'; ridge(g, { y: 740, amp: 30, freq: 0.002, seed: 4 }); ART.poles(g, -100, W + 200, 770, { gap: 280, h: 150, off: 120 }); });
  S.layer(1, () => {
    g.fillStyle = '#0a0605'; g.fillRect(-200, rail, W + 400, 500);
    ART.track(g, -200, W + 200, rail - 2);
    ART.loco(g, 548, rail, 1.3, 0.4, 1, true);
    ART.loco(g, 1372, rail, 1.3, 1.1, -1, false);
    // the crowd: on the pilots, on the boilers, hats in the air
    const crowd = [[810, 0], [850, 1], [900, 0], [1010, 1], [1060, 0], [1110, 1], [760, 1], [1160, 0], [700, 0], [1220, 1]];
    crowd.forEach(([x, k], i) => {
      const cheer = 0.5 + 0.5 * Math.sin(t * 5 + i * 1.7);
      ART.figure(g, x, rail + 2 + (i % 3) * 4, 118 + (i * 31 % 16), { hat: k ? 'brim' : 'cap', face: x < 960 ? 1 : -1, armF: [2.2 + cheer * 0.6, 2.9 + cheer * 0.4], armB: i % 2 ? [2.0 + cheer * 0.5, 2.8] : [0, 0.2] });
    });
    for (const [x, y, f] of [[640, rail - 172, 1], [470, rail - 178, 1], [1290, rail - 172, -1], [1450, rail - 178, -1]]) ART.figure(g, x, y, 104, { hat: 'brim', face: f, armF: [2.4, 3.0], armB: [0.1, 0.3] });
    // two men at the centre, hand reaching to hand
    ART.figure(g, 925, rail + 4, 132, { hat: 'brim', armF: [1.3, 1.5], armB: [0, 0.2] });
    ART.figure(g, 995, rail + 4, 132, { hat: 'brim', face: -1, armF: [1.3, 1.5], armB: [0, 0.2] });
  });
  ART.puffs(g, { x: 548 + 143, y: rail - 235, t, n: 14, seed: 1, rise: 330, drift: -160, r0: 16, r1: 120, col: [1, 0.76, 0.5], a: 0.4, spd: 0.25 });
  ART.puffs(g, { x: 1372 - 143, y: rail - 222, t, n: 14, seed: 2, rise: 330, drift: -200, r0: 16, r1: 120, col: [1, 0.76, 0.5], a: 0.4, spd: 0.25 });
  ART.sparks(g, { x: 960, y: rail - 6, t, t0: -0.05, n: 120, seed: 4, life: 1.2, spd: 620, grav: 700, spread: 2.4, col: [1, 0.8, 0.4], size: 2.6 });
  S.post = { sun, rays: 0.7, rayc: [1, 0.76, 0.46], th: 0.72, bloom: 0.6, expo: 1.0, vig: 0.66, shadow: [0.48, 0.47, 0.56], high: [0.64, 0.53, 0.38] };
  TYPE.year(S, '1869', 'PROMONTORY SUMMIT, UTAH', 0.35, 2.75);
};

// -----------------------------------------------------------------------------
// 11. Rails across the divide
// -----------------------------------------------------------------------------
SCENES.rails = S => {
  const { g, t } = S, sun = [1420, 500], deck = 590;
  S.cam = { x: 30 * t, y: -4 * t, z: 1 + 0.04 * S.p };
  PLATE.sky(S, { hy: 800, sun, c0: '#122458', c1: '#7c5a80', c2: '#f6a352', sc: '#ffd89a', ss: 40, sg: 0.8, cl: 0.5, cs: 1.0, ch: 1.4, cd: '#34264a', cb: '#ffb266', cv: [0.03, 0], seed: 63 });
  S.layer(0.12, () => { g.fillStyle = '#b06c54'; ridge(g, { y: 690, amp: 170, freq: 0.0014, seed: 31, sharp: 0.9, oct: 5 }); });
  S.layer(0.3, () => { g.fillStyle = '#7a4838'; ridge(g, { y: 800, amp: 110, freq: 0.0017, seed: 33, sharp: 0.6 }); ART.haze(g, 700, 900, [0.98, 0.66, 0.38], 0, 0.3); });
  const valley = x => 900 + 150 * Math.cos((x - 960) / 620) - 60 * fb1(x * 0.004, 5);
  S.layer(0.75, () => {
    g.fillStyle = '#150c0a'; g.strokeStyle = '#150c0a';
    // timber trestle
    g.fillRect(-300, deck, W + 700, 12);
    for (let x = -280; x < W + 400; x += 74) {
      const yb = valley(x) + 30;
      g.lineWidth = 5; line(g, x - 9, deck, x - 16, yb); line(g, x + 9, deck, x + 16, yb);
      g.lineWidth = 2.5;
      for (let y = deck + 46; y < yb; y += 46) { line(g, x - 14, y, x + 14, y); line(g, x - 12, y - 46, x + 13, y); }
    }
    g.lineWidth = 3; for (const dy of [60, 150, 240]) line(g, -300, deck + dy, W + 400, deck + dy);
    // the train
    const x0 = -700 + t * 250, rot = x0 / 40;
    ART.loco(g, x0 + 760, deck, 0.86, rot, 1, true);
    ['box', 'box', 'coach', 'coach', 'coach'].forEach((k, i) => ART.railcar(g, x0 + 470 - i * 152, deck, 0.86, rot, k));
    ART.puffs(g, { x: x0 + 760 + 94, y: deck - 152, t, n: 22, seed: 3, rise: 190, drift: -640, r0: 14, r1: 130, col: [1, 0.78, 0.54], a: 0.5, spd: 0.5, turb: 22 });
  });
  S.layer(1, () => { g.fillStyle = '#080404'; g.beginPath(); g.moveTo(-300, H + 100); for (let x = -300; x <= W + 400; x += 20) g.lineTo(x, valley(x) + 40); g.lineTo(W + 400, H + 100); g.fill(); });
  S.layer(1.3, () => { g.fillStyle = '#040202'; for (const [x, s] of [[60, 2.6], [230, 1.9], [370, 1.4], [1840, 2.9], [2010, 2.2]]) ART.pine(g, x, 1130, s, x); });
  S.post = { sun, rays: 0.65, rayc: [1, 0.78, 0.48], th: 0.72, bloom: 0.55, vig: 0.64, shadow: [0.48, 0.47, 0.56], high: [0.64, 0.53, 0.38] };
};

// -----------------------------------------------------------------------------
// 12. Farms and towns rise
// -----------------------------------------------------------------------------
SCENES.growth = S => {
  const { g, t } = S, k = seg(t, 0.1, S.dur * 0.95, E.io);
  const sun = [lerp(300, 1500, k), 560 - 250 * Math.sin(Math.PI * (0.15 + 0.7 * k))];
  S.cam = { x: 0, y: 0, z: 1.07 - 0.07 * S.p };
  PLATE.sky(S, { hy: 700, sun, c0: '#143070', c1: '#5c7ab8', c2: '#f3c088', sc: '#fff0c8', ss: 34, sg: 0.6, cl: 0.55, cs: 1.0, ch: 1.6, cd: '#4a5684', cb: '#fff0d6', cv: [0.5, 0.02], seed: 71, T: t });
  S.layer(0.2, () => { g.fillStyle = '#6f7fa6'; ridge(g, { y: 690, amp: 40, freq: 0.0016, seed: 41 }); });
  // the town grows a storey at a time
  S.layer(0.45, () => {
    g.fillStyle = '#39405e';
    ART.skyline(g, { x0: 620, x1: 1700, base: 712, hMin: 20, hMax: 250, wMin: 26, wMax: 70, seed: 5, grow: k * 1.05, era: 0 });
    const st = seg(k, 0.25, 0.6, E.out);
    g.fillRect(1010, 712 - 190 * st, 30, 190 * st); if (st > 0.98) fillPoly(g, [[1004, 522], [1025, 440], [1046, 522]]);
    for (const [x, h, d] of [[1380, 230, 0.5], [1440, 270, 0.62], [1560, 210, 0.72]]) { const u = seg(k, d, d + 0.25, E.out); g.fillRect(x, 712 - h * u, 16, h * u); if (u > 0.9) ART.puffs(g, { x: x + 8, y: 712 - h, t: t * 2, n: 9, seed: x, rise: 120, drift: 200, r0: 8, r1: 60, col: [0.85, 0.85, 0.92], a: 0.35 * (u - 0.9) * 10, spd: 0.5 }); }
    ART.haze(g, 640, 720, [0.95, 0.82, 0.66], 0, 0.35);
  });
  S.layer(0.7, () => {
    g.fillStyle = '#1c1a14'; ridge(g, { y: 740, amp: 12, freq: 0.002, seed: 9 });
    ART.poles(g, -100, W + 200, 742, { gap: 210, h: 104, off: 30 });
    g.fillStyle = '#16140f';
    ART.barn(g, 360, 744, 1.25); ART.windmill(g, 600, 744, 1.15, t * 5);
    // fence
    g.fillRect(-100, 716, 560, 4); g.fillRect(-100, 730, 560, 4); for (let x = -90; x < 460; x += 44) g.fillRect(x, 706, 6, 40);
    // a short train arrives
    const x0 = lerp(2500, 1240, seg(t, 0.4, 3.6, E.out));
    ART.loco(g, x0, 744, 0.5, -x0 / 14, -1, true); for (let i = 0; i < 4; i++) ART.railcar(g, x0 + 170 + i * 88, 744, 0.5, -x0 / 14, 'box');
  });
  // wheat in the foreground, ripening as the light swings round
  S.layer(1.2, () => {
    g.fillStyle = mixHex('#1c1408', '#3a2a0c', k); g.fillRect(-200, 900, W + 400, 300);
    g.fillStyle = mixHex('#2a1e0a', '#c08a2c', 0.15 + 0.5 * k);
    ART.grass(g, { y: 1010, t: t * 2, n: 340, hMin: 110, hMax: 240, seed: 7, x0: -200, x1: W + 200, wind: 26 });
    g.fillStyle = '#0c0803';
    ART.grass(g, { y: 1100, t: t * 2, n: 240, hMin: 110, hMax: 230, seed: 17, x0: -200, x1: W + 200, wind: 30 });
  });
  S.post = { sun, rays: 0.5, rayc: [1, 0.9, 0.7], th: 0.78, bloom: 0.45, expo: 1.0, vig: 0.6, sat: 1.1, shadow: [0.46, 0.5, 0.58], high: [0.6, 0.55, 0.44] };
};

// -----------------------------------------------------------------------------
// 13. Brooklyn Bridge
// -----------------------------------------------------------------------------
SCENES.bridge = S => {
  const { g, t } = S, hy = 770, sun = [1050, 560];
  S.cam = { x: 0, y: 26 - 46 * S.p, z: 1.0 + 0.07 * S.p };
  PLATE.sky(S, { hy, sun, c0: '#0e1c4a', c1: '#6a4f7e', c2: '#f79b4c', sc: '#ffd696', ss: 44, sg: 0.9, cl: 0.55, cs: 1.1, ch: 1.5, cd: '#2e2444', cb: '#ffab5e', seed: 84 });
  PLATE.ocean(S, { hy, sun, deep: '#060d1c', refl: '#c9824e', fog: '#f4a868', sc: '#ffd096', spd: 0.25, glit: 1.5, fogA: 0.7, chop: 1.3 });
  S.layer(0.3, () => {
    g.fillStyle = '#8e5a48';
    ART.skyline(g, { base: hy + 2, hMin: 14, hMax: 92, wMin: 18, wMax: 54, seed: 91 });
    for (const [x, s] of [[300, 0.16], [1580, 0.2]]) ART.ship(g, x + t * 4, hy + 5, s, { t, seed: x });
  });
  S.layer(0.8, () => {
    const s = 1.42, tx = [470, 1450], top = hy + 30 - 446 * s, deck = hy + 30 - 176 * s;
    g.fillStyle = '#0b0708'; g.strokeStyle = '#0b0708'; g.lineCap = 'round';
    const cab = x => {            // main cable height at x
      if (x < tx[0]) return lerp(deck + 6, top + 14, clamp((x + 420) / (tx[0] + 420)) ** 1.5);
      if (x > tx[1]) return lerp(deck + 6, top + 14, clamp((W + 420 - x) / (W + 420 - tx[1])) ** 1.5);
      const u = (x - tx[0]) / (tx[1] - tx[0]); return top + 14 + (deck - 34 - top - 14) * 4 * u * (1 - u);
    };
    g.lineWidth = 6; g.beginPath(); for (let x = -420; x <= W + 420; x += 12) g.lineTo(x, cab(x)); g.stroke();
    g.lineWidth = 1.3; g.beginPath(); for (let x = -410; x <= W + 410; x += 21) { g.moveTo(x, cab(x)); g.lineTo(x, deck); } g.stroke();
    // diagonal stays fanning from each tower: the bridge's signature web
    g.lineWidth = 1.1; g.globalAlpha = 0.8; g.beginPath();
    for (const x of tx) for (const k of [-1, 1]) for (let i = 1; i <= 16; i++) { g.moveTo(x + k * 26, top + 30); g.lineTo(x + k * (40 + i * 25), deck); }
    g.stroke(); g.globalAlpha = 1;
    g.fillRect(-420, deck, W + 840, 16); g.fillRect(-420, deck - 22, W + 840, 3);
    for (let x = -410; x < W + 420; x += 42) g.fillRect(x, deck - 22, 2, 22);
    for (const x of tx) ART.bridgeTower(g, x, hy + 30, s);
    // traffic on the promenade
    ART.column(g, { n: 16, x0: -300, x1: W + 300, t, speed: 16, h: 30, seed: 3, gy: () => deck, opts: i => ({ hat: i % 2 ? 'brim' : 'bonnet', skirt: i % 2 === 0 }) });
  });
  S.layer(1.1, () => { g.fillStyle = '#050303'; const x = 1900 - t * 46; ART.ship(g, x, hy + 250, 1.1, { t, seed: 2 }); });
  S.post = { sun, rays: 0.7, rayc: [1, 0.78, 0.48], th: 0.72, bloom: 0.6, streak: 0.3, expo: 1.0, vig: 0.64, shadow: [0.46, 0.48, 0.58], high: [0.64, 0.53, 0.38] };
  TYPE.year(S, '1883', 'BROOKLYN BRIDGE, NEW YORK', 0.9, 5.0);
};
