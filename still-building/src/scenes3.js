/* =============================================================================
 *  ACT III — INDUSTRY
 *  steel → oil → bulb → citylight → line → skyline
 * ========================================================================== */
'use strict';

/** Model T in side view; stage 0 frame · 1 engine · 2 body · 3 top and fenders. (x, y) = ground under the middle. */
function modelT(g, x, y, s, stage = 3, rot = 0, face = 1) {
  g.save(); g.translate(x, y); g.scale(face * s, s); ART.both(g);
  g.fillRect(-74, -34, 150, 7);
  ART.wheel(g, -56, -25, 25, rot, 12, 0.13); ART.wheel(g, 58, -25, 25, rot, 12, 0.13);
  if (stage >= 1) { rrect(g, 28, -66, 46, 34, 4); g.fillRect(74, -70, 7, 40); circle(g, 86, -56, 7); g.fillRect(22, -72, 7, 40); }
  if (stage >= 2) {
    g.beginPath(); g.moveTo(-70, -34); g.lineTo(-72, -62); g.quadraticCurveTo(-70, -82, -58, -80); g.lineTo(-54, -62); g.lineTo(-20, -62);
    g.quadraticCurveTo(-18, -82, -6, -80); g.lineTo(-2, -62); g.lineTo(24, -64); g.lineTo(26, -34); g.closePath(); g.fill();
    g.lineWidth = 3; line(g, 20, -62, 6, -84); g.lineWidth = 3.4; line(g, 0, -80, 12, -90);
  }
  if (stage >= 3) {
    fillPoly(g, [[-76, -118], [30, -120], [34, -112], [-78, -108]]);
    g.lineWidth = 3; line(g, 28, -118, 24, -64); line(g, -74, -112, -70, -62); line(g, -30, -114, -28, -64);
    g.lineWidth = 5; g.beginPath(); g.arc(-56, -25, 33, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    g.beginPath(); g.arc(58, -25, 33, Math.PI * 1.05, Math.PI * 1.9); g.stroke(); line(g, -24, -22, 26, -22);
  }
  g.restore();
}
/** Setback skyscraper with a mast (Empire State). (x, base) = centre of the footprint. ~1250 units tall. */
function empire(g, x, base, s) {
  g.save(); g.translate(x, base); g.scale(s, s);
  for (const [w, y0, y1] of [[330, 0, -150], [250, -150, -260], [200, -260, -900], [170, -900, -960], [140, -960, -1010], [104, -1010, -1050], [58, -1050, -1130], [34, -1130, -1180], [10, -1180, -1290]]) g.fillRect(-w / 2, y1, w, y0 - y1 + 1);
  g.restore();
}
function chrysler(g, x, base, s) {
  g.save(); g.translate(x, base); g.scale(s, s);
  for (const [w, y0, y1] of [[220, 0, -200], [170, -200, -640], [140, -640, -700]]) g.fillRect(-w / 2, y1, w, y0 - y1 + 1);
  g.beginPath(); g.moveTo(-70, -700);
  for (let i = 0; i < 6; i++) { const w = 70 - i * 10, y = -700 - i * 34; g.quadraticCurveTo(-w, y - 30, -w + 9, y - 34); }
  g.lineTo(-2, -1040); g.lineTo(2, -1040);
  for (let i = 5; i >= 0; i--) { const w = 70 - i * 10, y = -700 - i * 34; g.lineTo(w - 9, y - 34); g.quadraticCurveTo(w, y - 30, i ? w + 10 : 70, y); }
  g.closePath(); g.fill();
  g.restore();
}

// -----------------------------------------------------------------------------
// 14. Steel
// -----------------------------------------------------------------------------
SCENES.steel = S => {
  const { g, t } = S, hot = [1, 0.62, 0.2];
  const pulse = 0.8 + 0.2 * Math.sin(t * 2.7) + 0.1 * Math.sin(t * 11);
  S.cam = { x: 10 * t, y: 0, z: 1 + 0.05 * S.p };
  PLATE.sky(S, { hy: 760, sun: [560, 800], c0: '#04050b', c1: '#160b10', c2: '#8a2c0c', sc: '#ff7a22', ss: 90, sg: 0.55 * pulse, cl: 0.8, cs: 1.4, ch: 1.2, cd: '#0a0608', cb: '#c8481a', cv: [0.05, 0.01], st: 0.5, seed: 91 });
  // the works: furnaces, stoves, stacks
  S.layer(0.35, () => {
    g.fillStyle = '#1a0a08';
    for (let i = 0; i < 9; i++) { const x = 60 + i * 215 + (i * 53 % 60), h = 250 + (i * 97 % 150); g.fillRect(x, 770 - h, 22 + (i % 3) * 5, h); }
    for (const [x, w, h] of [[220, 110, 300], [760, 130, 350], [1300, 120, 320]]) {
      fillPoly(g, [[x - w / 2, 770], [x - w / 2 + 10, 770 - h * 0.62], [x - w * 0.3, 770 - h], [x + w * 0.3, 770 - h], [x + w / 2 - 10, 770 - h * 0.62], [x + w / 2, 770]]);
      g.fillRect(x - w * 0.42, 770 - h - 26, w * 0.84, 12); g.fillRect(x - 6, 770 - h - 70, 12, 60);
      g.save(); g.strokeStyle = g.fillStyle; g.lineWidth = 9; line(g, x + w / 2 + 180, 770, x + 8, 770 - h - 30); g.restore();
      for (let k = 0; k < 3; k++) { const sx = x - w / 2 - 60 - k * 54; g.fillRect(sx - 22, 770 - h * 0.7, 44, h * 0.7); g.beginPath(); g.arc(sx, 770 - h * 0.7, 22, Math.PI, 0); g.fill(); }
    }
    g.fillStyle = '#12070a';
    for (let x = -100; x < W + 300; x += 150) fillPoly(g, [[x, 780], [x, 690], [x + 110, 650], [x + 110, 690], [x + 150, 690], [x + 150, 780]]);
  });
  for (const [x, y, s] of [[230, 420, 1], [770, 370, 1.2], [1310, 400, 1]]) {
    PLATE.run(S, 'smoke', { src: [x - S.cam.x * 0.35, y], w0: 30 * s, grow: 0.34, height: 520, wind: 0.6, dens: 0.9, seed: x, spd: 0.5, lit: '#e2622a', dark: '#1a0c0c', glowc: '#ff8a30', glowA: 1.4 * pulse }, ['lit', 'dark', 'glowc']);
    glow(g, x - S.cam.x * 0.35, y + 10, 150 * s, hot, 0.8 * pulse);
  }
  S.layer(0.6, () => {
    // shed windows glow
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let x = -80; x < W + 300; x += 150) for (let k = 0; k < 4; k++) { g.fillStyle = css(hot, 0.5 + 0.3 * h1(x + k)); g.fillRect(x + 12 + k * 24, 716, 14, 36); }
    g.restore();
    g.fillStyle = '#090405'; g.fillRect(-200, 776, W + 500, 400);
  });
  ART.haze(g, 640, 800, hot, 0, 0.26 * pulse);
  // the pour
  S.layer(1, () => {
    const px = 1310, py = 430, tilt = 0.5 + 0.08 * Math.sin(t * 0.8);
    g.save(); g.globalCompositeOperation = 'lighter';
    const gr = g.createLinearGradient(0, py, 0, 940); gr.addColorStop(0, 'rgba(255,240,190,1)'); gr.addColorStop(0.5, 'rgba(255,190,80,1)'); gr.addColorStop(1, 'rgba(255,140,40,0.9)');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(px - 88, py + 30);
    for (let y = py + 30; y <= 940; y += 20) g.lineTo(px - 96 - (y - py) * 0.02 + Math.sin(y * 0.05 - t * 14) * 3, y);
    for (let y = 940; y >= py + 30; y -= 20) g.lineTo(px - 74 - (y - py) * 0.035 + Math.sin(y * 0.05 - t * 14 + 1) * 3, y);
    g.fill(); g.restore();
    glow(g, px - 100, 940, 420, hot, 0.9 * pulse); glow(g, px - 96, 930, 120, [1, 0.95, 0.75], 1);
    glow(g, px - 86, py + 60, 200, hot, 0.7);
    // ladle and crane
    g.fillStyle = '#050203'; g.strokeStyle = '#050203';
    g.save(); g.translate(px, py); g.rotate(-tilt);
    fillPoly(g, [[-120, -110], [120, -110], [100, 120], [-100, 120]]); g.fillRect(-134, -124, 268, 22);
    g.lineWidth = 16; g.beginPath(); g.arc(0, -110, 150, Math.PI * 1.06, Math.PI * 1.94); g.stroke();
    g.restore();
    g.lineWidth = 12; line(g, px - 40, py - 240, px - 40, -100); line(g, px + 30, py - 240, px + 30, -100);
    g.fillRect(-200, 60, W + 600, 34); g.fillRect(px - 150, 40, 300, 70);
    // mould floor and crew
    g.fillRect(-200, 930, W + 600, 300);
    fillPoly(g, [[1090, 940], [1320, 940], [1290, 890], [1120, 890]]);
    ART.figure(g, 900, 944, 290, { hat: 'cap', broad: true, armF: [1.0, 1.3], armB: [0.7, 1.2], lean: 0.1 });
    g.lineWidth = 5; line(g, 965, 760, 1170, 870);
    ART.figure(g, 690, 950, 300, { hat: 'cap', broad: true, armF: [0.3, 0.9], armB: [-0.2, 0.2] });
    ART.figure(g, 1620, 950, 310, { hat: 'cap', broad: true, face: -1, armF: [2.2, 2.9], armB: [0, 0.3] });
  });
  ART.sparks(g, { x: 1213 - S.cam.x, y: 930, t, n: 150, seed: 2, life: 1.1, spd: 520, grav: 760, spread: 2.2, col: [1, 0.78, 0.36], size: 2.4 });
  ART.sparks(g, { x: 1222 - S.cam.x, y: 470, t, n: 40, seed: 7, life: 0.8, spd: 260, grav: 700, spread: 2.8, col: [1, 0.85, 0.5], size: 2 });
  ART.motes(g, { t, n: 90, seed: 3, vx: 16, vy: -40, size: 1.8, col: [1, 0.6, 0.25], a: 0.7, sway: 26 });
  S.post = { bloom: 0.9, th: 0.55, streak: 0.5, expo: 1.02 * (0.96 + 0.06 * pulse), con: 0.42, vig: 0.72, sat: 1.12, shadow: [0.44, 0.48, 0.6], high: [0.66, 0.52, 0.36] };
  TYPE.say(S, 'THEY BUILT BIGGER', 1.1, 5.6, { y: 280, size: 60 });
};

// -----------------------------------------------------------------------------
// 15. Oil
// -----------------------------------------------------------------------------
SCENES.oil = S => {
  const { g, t } = S, sun = [520, 590];
  S.cam = { x: -8 * t, y: 0, z: 1.0 + 0.06 * S.p };
  PLATE.sky(S, { hy: 720, sun, c0: '#141a4a', c1: '#8a4a5e', c2: '#f7903c', sc: '#ffcf88', ss: 46, sg: 0.85, cl: 0.5, cs: 1.0, ch: 1.5, cd: '#32203a', cb: '#ffa450', seed: 102 });
  S.layer(0.2, () => { g.fillStyle = '#a05a3c'; ridge(g, { y: 716, amp: 14, freq: 0.002, seed: 2 }); for (let i = 0; i < 26; i++) ART.derrick(g, -60 + i * 84 + (i * 37 % 40), 712, 0.3 + (i * 53 % 10) / 60); });
  S.layer(0.45, () => { g.fillStyle = '#5a2e22'; ridge(g, { y: 742, amp: 12, freq: 0.002, seed: 4 }); for (let i = 0; i < 11; i++) ART.derrick(g, -40 + i * 200 + (i * 71 % 70), 742, 0.62 + (i * 29 % 10) / 50); ART.haze(g, 660, 760, [0.98, 0.6, 0.3], 0, 0.3); });
  S.layer(0.85, () => {
    g.fillStyle = '#0c0606'; g.strokeStyle = '#0c0606'; g.fillRect(-300, 800, W + 600, 400);
    ART.derrick(g, 420, 804, 1.5); ART.derrick(g, 1720, 806, 1.25);
    // the gusher
    const gx = 1130, gy = 806, top = gy - 262 * 1.9, up = seg(t, 0.25, 1.3, E.out);
    ART.derrick(g, gx, gy, 1.9);
    g.beginPath(); g.moveTo(gx - 9, top + 30);
    for (let i = 0; i <= 20; i++) { const u = i / 20, y = top + 30 - 470 * up * u; g.lineTo(gx - 16 - 90 * u * u * up + Math.sin(u * 20 - t * 16) * 7 * u, y); }
    for (let i = 20; i >= 0; i--) { const u = i / 20, y = top + 30 - 470 * up * u; g.lineTo(gx + 16 + 110 * u * u * up + Math.sin(u * 17 - t * 15) * 7 * u, y); }
    g.fill();
    ART.puffs(g, { x: gx, y: top - 410 * up, t: t * 1.6, n: 26, seed: 1, rise: -620 * up, drift: 520, r0: 50, r1: 210, col: [0.03, 0.02, 0.02], a: 0.85 * up, spd: 0.45, turb: 30 });
    ART.puffs(g, { x: gx, y: top - 430 * up, t: t * 1.6 + 3, n: 18, seed: 5, rise: 120, drift: -260, r0: 30, r1: 120, col: [0.03, 0.02, 0.02], a: 0.6 * up, spd: 0.4, turb: 30 });
    // roughnecks run, hats off
    for (let i = 0; i < 7; i++) ART.figure(g, 700 + i * 54 + t * (24 + i * 5), 808, 100 + (i * 13 % 14), { hat: i % 2 ? 'brim' : 'none', walk: t * 1.8 + i * 0.3, armF: [2.3, 2.9], armB: [-0.4, 0.2], stride: 0.6 });
    for (let i = 0; i < 4; i++) ART.figure(g, 1420 + i * 60, 810, 104, { hat: 'brim', face: -1, armF: [2.4, 3.0], armB: [2.2, 2.8] });
  });
  S.layer(1.3, () => { g.fillStyle = '#050303'; g.fillRect(-300, 990, W + 700, 200); ART.grass(g, { y: 1000, t, n: 200, hMin: 30, hMax: 100, seed: 5, x0: -300, x1: W + 400 }); });
  S.post = { sun, rays: 0.6, rayc: [1, 0.74, 0.44], th: 0.72, bloom: 0.55, vig: 0.66, shadow: [0.48, 0.47, 0.56], high: [0.64, 0.53, 0.38] };
  TYPE.year(S, '1901', 'SPINDLETOP, TEXAS', 0.7, 4.3);
};

// -----------------------------------------------------------------------------
// 16. Light
// -----------------------------------------------------------------------------
SCENES.bulb = S => {
  const { g, t } = S, on = seg(t, 0.25, 1.5, E.in), cx = 960, cy = 470;
  g.fillStyle = '#020204'; g.fillRect(0, 0, W, H);
  S.cam = { x: 0, y: 0, z: 1.25 - 0.2 * S.p };
  S.layer(1, () => {
    const heat = mix3(mix3([0.25, 0.03, 0], [1, 0.45, 0.1], smooth(0, 0.5, on)), [1, 0.95, 0.8], smooth(0.5, 1, on));
    glow(g, cx, cy, 900, [1, 0.7, 0.35], 0.5 * on * on); glow(g, cx, cy, 330, [1, 0.8, 0.5], 0.9 * on);
    // glass envelope: rim light only
    g.lineWidth = 4; g.strokeStyle = css([0.55, 0.62, 0.78], 0.3 + 0.5 * on);
    g.beginPath(); g.moveTo(cx - 62, cy + 250); g.bezierCurveTo(cx - 70, cy + 150, cx - 210, cy + 110, cx - 210, cy - 30);
    g.bezierCurveTo(cx - 210, cy - 320, cx + 210, cy - 320, cx + 210, cy - 30); g.bezierCurveTo(cx + 210, cy + 110, cx + 70, cy + 150, cx + 62, cy + 250); g.stroke();
    g.lineWidth = 9; g.strokeStyle = css([0.8, 0.86, 1], 0.1 + 0.16 * on);
    g.beginPath(); g.arc(cx, cy - 30, 180, Math.PI * 1.08, Math.PI * 1.36); g.stroke();
    // base
    g.fillStyle = '#16130f'; rrect(g, cx - 66, cy + 246, 132, 150, 10);
    g.strokeStyle = css([0.6, 0.5, 0.35], 0.5); g.lineWidth = 4; for (let i = 0; i < 5; i++) line(g, cx - 64, cy + 272 + i * 26, cx + 64, cy + 262 + i * 26);
    // stem and filament
    g.strokeStyle = css([0.5, 0.5, 0.56], 0.5); g.lineWidth = 3; line(g, cx - 34, cy + 250, cx - 46, cy + 30); line(g, cx + 34, cy + 250, cx + 46, cy + 30);
    g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    for (const [w, a] of [[26, 0.25 * on], [11, 0.6 * on + 0.1], [4.5, 1]]) {
      g.strokeStyle = css(heat, a); g.lineWidth = w;
      g.beginPath(); g.moveTo(cx - 46, cy + 30);
      for (let i = 0; i <= 60; i++) { const u = i / 60, a = u * Math.PI; g.lineTo(cx - Math.cos(a) * (46 + 34 * Math.sin(a)), cy + 30 - Math.pow(Math.sin(a), 0.7) * 210); }
      g.stroke();
    }
    g.restore();
  });
  S.post = { bloom: 0.5 + 0.7 * on, th: 0.5, streak: 0.9 * on, expo: 1 + 0.12 * Math.sin(t * 40) * on * (1 - on), con: 0.3, vig: 0.8, shadow: [0.46, 0.5, 0.6], high: [0.64, 0.54, 0.38] };
  TYPE.year(S, '1879', 'MENLO PARK, NEW JERSEY', 0.5, 2.25);
};

SCENES.citylight = S => {
  const { g, t } = S, hy = 800, k = seg(t, 0.0, 2.1, E.quadOut);
  S.cam = { x: 0, y: 12 * S.p, z: 1.08 - 0.08 * S.p };
  PLATE.sky(S, { hy, sun: [300, 900], c0: '#03061a', c1: '#0c1640', c2: '#3a3566', sc: '#8a6aa0', ss: 60, sg: 0.4, cl: 0.45, cs: 1.1, ch: 1.4, cd: '#070a1c', cb: '#3c3a70', st: 0.9, seed: 112 });
  PLATE.ocean(S, { hy, sun: [960, 700], deep: '#02040c', refl: '#3a3050', fog: '#2a2a50', sc: '#ffcf8a', spd: 0.2, glit: 0.9 * k, fogA: 0.6, chop: 1.4 });
  const far = { base: hy + 2, hMin: 60, hMax: 330, wMin: 30, wMax: 80, seed: 121, era: 1 }, near = { base: hy + 4, hMin: 120, hMax: 560, wMin: 60, wMax: 140, seed: 127, era: 1, gap: 30 };
  S.layer(0.4, () => {
    g.fillStyle = '#0d1230'; const l = ART.skyline(g, far);
    const wave = b => clamp((k * 1.5 - (b.x / W)) * 2.2);
    for (const b of l) ART.windows(g, [b], far.base, { k: wave(b), col: [1, 0.78, 0.42], a: 0.8, cw: 3, ch: 5, gx: 8, gy: 11, t });
  });
  S.layer(0.8, () => {
    g.fillStyle = '#050611'; const l = ART.skyline(g, near);
    for (const b of l) ART.windows(g, [b], near.base, { k: clamp((k * 1.5 - b.x / W) * 2.2), col: [1, 0.82, 0.48], a: 0.95, cw: 6, ch: 9, gx: 14, gy: 19, t });
    // lamps along the waterfront
    for (let x = -40; x < W + 80; x += 76) { const a = clamp((k * 1.5 - x / W) * 4); glow(g, x, hy - 8, 40, [1, 0.8, 0.45], 0.9 * a); glow(g, x, hy - 8, 7, [1, 0.95, 0.8], a); }
  });
  // reflections
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 70; i++) { const x = h1(i * 3.1) * W, a = clamp((k * 1.5 - x / W) * 2.2) * 0.2; g.fillStyle = css([1, 0.75, 0.4], a); g.fillRect(x, hy + 14, 3 + h1(i) * 5, 60 + h1(i * 7) * 200); }
  g.restore();
  S.post = { bloom: 0.8, th: 0.5, streak: 0.25, expo: 1.0, con: 0.36, vig: 0.7, shadow: [0.44, 0.48, 0.62], high: [0.64, 0.54, 0.4] };
};

// -----------------------------------------------------------------------------
// 17. The moving assembly line
// -----------------------------------------------------------------------------
SCENES.line = S => {
  const { g, t } = S, floor = 900;
  S.cam = { x: 12 * t, y: 0, z: 1.0 + 0.045 * S.p };
  g.fillStyle = vgrad(g, 0, H, [[0, '#3a3026'], [0.55, '#2a2018'], [1, '#0c0806']]); g.fillRect(0, 0, W, H);
  // sawtooth roof with north lights
  S.layer(0.3, () => {
    for (let x = -300; x < W + 500; x += 330) {
      g.fillStyle = vgrad(g, 0, 230, [[0, '#f8ecd2'], [1, '#d9b98a']]);
      fillPoly(g, [[x + 20, 220], [x + 20, 10], [x + 300, 220]]);
      g.fillStyle = '#0c0907'; fillPoly(g, [[x - 16, 232], [x + 6, -10], [x + 22, -10], [x + 22, 232]]); g.fillRect(x, 218, 340, 18);
      g.strokeStyle = '#0c0907'; g.lineWidth = 4; for (let i = 1; i < 6; i++) line(g, x + 20 + i * 47, 220, x + 20, 220 - 210 * (1 - i / 6));
    }
    g.fillStyle = '#120d0a'; for (let x = -280; x < W + 500; x += 330) g.fillRect(x - 6, 220, 26, 800);
  });
  // the hall is full of sunlit haze: the line is read against it
  for (let i = 0; i < 4; i++) glow(g, 200 + i * 520, 520, 620, [0.95, 0.7, 0.4], 0.28);
  S.layer(0.5, () => {
    g.fillStyle = '#241a12'; for (let i = 0; i < 12; i++) modelT(g, -300 + i * 230 + ((t * 30) % 230), 700, 0.9, 3, t * 1.2);
    g.fillRect(-300, 698, W + 800, 8);
    ART.haze(g, 560, 760, [0.9, 0.66, 0.4], 0.0, 0.22);
  });
  for (let i = 0; i < 4; i++) PLATE.run(S, 'beams', { src: [140 + i * 520 - S.cam.x * 0.3, 120], ang: 1.1, wid: 300, len: 1150, dens: 0.4, seed: i, n: 3, col: '#ffd9a0' }, ['col'], { op: 'lighter' });
  S.layer(0.9, () => {
    g.fillStyle = '#070504'; g.strokeStyle = '#070504';
    g.fillRect(-300, floor, W + 800, 400);
    // cars advance one station at a time; each station adds a stage
    const pitch = 500, v = pitch / 2.3, shift = (t * v) % pitch;
    for (let i = -1; i < 6; i++) {
      const x = i * pitch + shift - 80, st = clamp(Math.floor((x + 260) / 600), 0, 3);
      modelT(g, x, floor, 1.95, st, x / 49);
      if (st === 2) {                  // a body swings in on the hoist
        const u = clamp(((x + 260) % 600) / 380), yy = floor - 420 + 290 * E.io(Math.min(1, u * 1.5));
        if (u < 0.66) { g.lineWidth = 4; line(g, x - 46, yy - 90, x - 46, 200); fillPoly(g, [[x - 150, yy], [x - 144, yy - 70], [x + 50, yy - 72], [x + 56, yy]]); }
      }
    }
    // the men on the line
    for (let i = 0; i < 7; i++) {
      const x = -60 + i * 330, w = Math.sin(t * 5 + i * 1.9);
      ART.figure(g, x, floor + 8, 262 + (i * 37 % 16), { hat: 'cap', broad: true, face: i % 2 ? -1 : 1, armF: [0.9 + 0.3 * w, 1.5 + 0.3 * w], armB: [0.5 - 0.2 * w, 1.2], lean: 0.12 });
    }
  });
  ART.motes(g, { t, n: 120, seed: 14, vx: 8, vy: 6, size: 1.6, col: [1, 0.88, 0.66], a: 0.5 });
  S.post = { sun: [520, 60], rays: 0.5, rayc: [1, 0.86, 0.6], th: 0.62, bloom: 0.6, expo: 1.04, con: 0.34, vig: 0.7, shadow: [0.48, 0.48, 0.52], high: [0.62, 0.54, 0.42] };
  TYPE.year(S, '1913', 'HIGHLAND PARK, MICHIGAN', 0.5, 4.2);
  TYPE.say(S, 'FASTER', 4.4, 6.75, { y: 400, size: 78, track: 30, fi: 0.3, fo: 0.4 });
};

// -----------------------------------------------------------------------------
// 18. Higher
// -----------------------------------------------------------------------------
SCENES.skyline = S => {
  const { g, t } = S, oy = lerp(520, 0, seg(t, 0, S.dur + 0.4, E.sine)), sun = [1330, 640 - oy * 0.25];
  PLATE.sky(S, { hy: 1500 - oy, sun, c0: '#0e2a66', c1: '#4f76b8', c2: '#f4c692', sc: '#fff0c8', ss: 40, sg: 0.7, cl: 0.55, cs: 1.0, ch: 1.3, cd: '#48587e', cb: '#fff0d8', seed: 131 });
  g.save(); g.translate(0, -oy * 0.45);
  g.fillStyle = '#8f96b8'; ART.skyline(g, { base: 1500, hMin: 120, hMax: 520, wMin: 40, wMax: 110, seed: 141, era: 1 });
  g.fillStyle = '#5b6288'; chrysler(g, 520, 1500, 0.82); ART.skyline(g, { base: 1500, hMin: 100, hMax: 430, wMin: 50, wMax: 120, seed: 147, era: 1, gap: 60 });
  ART.haze(g, 1100, 1500, [0.96, 0.82, 0.68], 0, 0.5);
  g.restore();
  g.save(); g.translate(0, -oy * 0.7);
  g.fillStyle = '#262a44'; empire(g, 1040, 1700, 0.98);
  g.restore();
  // steel going up in the foreground
  g.save(); g.translate(0, -oy + 520);
  g.fillStyle = '#07060a'; g.strokeStyle = '#07060a';
  g.fillRect(-100, 760, 1500, 34); g.fillRect(-100, 752, 1500, 8); g.fillRect(-100, 794, 1500, 8);
  g.fillRect(240, 300, 40, 900); g.fillRect(232, 300, 8, 900); g.fillRect(280, 300, 8, 900);
  g.lineWidth = 5; line(g, 1150, 752, 1010, -700); line(g, 860, 752, 1000, -700);
  ART.figure(g, 560, 752, 250, { hat: 'cap', broad: true, armF: [1.0, 1.4], armB: [0.6, 1.2], lean: 0.2 });
  ART.figure(g, 800, 752, 240, { hat: 'cap', broad: true, face: -1, armF: [0.4, 0.9], armB: [0, 0.3] });
  ART.figure(g, 1040, 752, 240, { sit: true, hat: 'cap', broad: true, armF: [0.3, 1.2], armB: [0.1, 0.9] });
  ART.sparks(g, { x: 430, y: 742, t, n: 50, seed: 3, life: 0.7, spd: 330, grav: 800, spread: 2.6, col: [1, 0.8, 0.45], size: 2.2 });
  g.restore();
  S.post = { sun, rays: 0.55, rayc: [1, 0.9, 0.7], th: 0.78, bloom: 0.45, expo: 1.0, vig: 0.6, sat: 1.08, shadow: [0.46, 0.5, 0.58], high: [0.6, 0.55, 0.44] };
  TYPE.say(S, 'HIGHER', 1.2, 4.3, { y: 330, size: 78, track: 30, fi: 0.3, fo: 0.5 });
};
