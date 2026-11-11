/* =============================================================================
 *  ACT V — CONTINUED INNOVATION
 *  transistor → interstate → launch → earthrise → moon → digital → booster → ai
 * ========================================================================== */
'use strict';

// -----------------------------------------------------------------------------
// 25. The transistor
// -----------------------------------------------------------------------------
const TRACES = (() => {
  let list = null;
  return () => {
    if (list) return list;
    const r = rng(1947); list = [];
    for (let i = 0; i < 150; i++) {
      let x = 960 + (r() - 0.5) * 120, y = 600 + (r() - 0.5) * 60, dir = Math.floor(r() * 4);
      const pts = [[x, y]]; let len = 0;
      for (let k = 0; k < 9; k++) {
        const L = 40 + r() * 190, d = [[1, 0], [0, -1], [-1, 0], [0, 1]][dir];
        x += d[0] * L; y += d[1] * L * 0.8; pts.push([x, y]); len += L;
        dir = (dir + (r() > 0.5 ? 1 : 3)) % 4;
        if ((x - 960) * d[0] + (y - 600) * d[1] < -40) dir = (dir + 2) % 4;
      }
      list.push({ pts, len, d: r(), hue: r() });
    }
    return list;
  };
})();
SCENES.transistor = S => {
  const { g, t } = S, grow = seg(t, 1.5, 4.2, E.quadIn);
  S.cam = { x: 0, y: 0, z: 1.0 + 0.22 * seg(t, 0, S.dur, E.sine) };
  g.fillStyle = '#05070b'; g.fillRect(0, 0, W, H);
  // lab bench bokeh
  g.save(); g.filter = `blur(${18 * S.SC}px)`; g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 16; i++) { g.fillStyle = css(i % 3 ? [1, 0.7, 0.4] : [0.4, 0.7, 1], 0.12 + 0.08 * h1(i)); circle(g, h1(i * 3.1) * W, 120 + h1(i * 5.7) * 520, 30 + h1(i * 7.3) * 70); }
  g.restore();
  S.layer(1, () => {
    // circuits bloom outward from the point of contact
    g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const tr of TRACES()) {
      const p = clamp((grow * 1.5 - tr.d * 0.5) / 1.0); if (p <= 0) continue;
      let rem = tr.len * p; const col = tr.hue > 0.3 ? [0.45, 0.85, 1] : [1, 0.82, 0.45];
      g.strokeStyle = css(col, 0.55); g.lineWidth = 2.2; g.beginPath(); g.moveTo(tr.pts[0][0], tr.pts[0][1]);
      let end = tr.pts[0];
      for (let i = 1; i < tr.pts.length && rem > 0; i++) {
        const a = tr.pts[i - 1], b = tr.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), f = Math.min(1, rem / L);
        end = [lerp(a[0], b[0], f), lerp(a[1], b[1], f)]; g.lineTo(end[0], end[1]); rem -= L;
      }
      g.stroke(); g.fillStyle = css(col, 0.95); circle(g, end[0], end[1], 3.4);
    }
    g.restore();
    // base, germanium crystal, the plastic wedge with its gold foil, the spring
    g.fillStyle = vgrad(g, 640, 800, [[0, '#3a3f48'], [1, '#0c0e12']]); rrect(g, 560, 660, 800, 150, 8);
    g.fillStyle = vgrad(g, 596, 664, [[0, '#c9ced6'], [0.3, '#7b838f'], [1, '#2a2f38']]); rrect(g, 800, 600, 320, 66, 4);
    g.fillStyle = vgrad(g, 300, 600, [[0, '#e8b05a'], [1, '#8a5a22']]); g.globalAlpha = 0.92;
    fillPoly(g, [[820, 300], [1100, 300], [960, 598]]); g.globalAlpha = 1;
    g.strokeStyle = '#ffd97a'; g.lineWidth = 7; g.lineCap = 'round'; line(g, 822, 304, 957, 596); line(g, 1098, 304, 963, 596);
    g.strokeStyle = '#aeb6c2'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(960, 300); g.bezierCurveTo(960, 160, 1160, 150, 1180, 260); g.bezierCurveTo(1190, 330, 1130, 350, 1130, 240); g.stroke();
    g.beginPath(); g.moveTo(826, 320); g.bezierCurveTo(700, 330, 660, 420, 600, 660); g.stroke();
    g.beginPath(); g.moveTo(1094, 320); g.bezierCurveTo(1230, 350, 1290, 470, 1320, 660); g.stroke();
    const pulse = 0.6 + 0.4 * Math.sin(t * 9);
    glow(g, 960, 598, 240 + 260 * grow, [0.6, 0.85, 1], 0.45 * pulse + 0.2 * grow); glow(g, 960, 598, 26, [1, 1, 1], 1);
  });
  S.post = { bloom: 0.7 + 0.2 * grow, th: 0.6, streak: 0.5 + 0.4 * grow, expo: 1.0, con: 0.36, vig: 0.78, shadow: [0.42, 0.5, 0.62], high: [0.58, 0.55, 0.48] };
  TYPE.year(S, '1947', 'BELL LABORATORIES, NEW JERSEY', 0.3, 3.9);
  TYPE.say(S, 'THEN THEY REACHED FURTHER', 0.8, 4.1, { y: 210, size: 52, fi: 0.5, fo: 0.5 });
};

// -----------------------------------------------------------------------------
// 26. The interstate
// -----------------------------------------------------------------------------
SCENES.interstate = S => {
  const { g, t } = S, hy = 560, sun = [960, 610];
  S.cam = { x: 0, y: -14 * S.p, z: 1 + 0.05 * S.p };
  PLATE.sky(S, { hy, sun, c0: '#070f2e', c1: '#2b2f66', c2: '#f08a4a', sc: '#ffb070', ss: 50, sg: 0.7, cl: 0.5, cs: 1.0, ch: 1.5, cd: '#141634', cb: '#f08050', st: 0.5, seed: 201 });
  S.layer(0.2, () => { g.fillStyle = '#3a2440'; ridge(g, { y: 556, amp: 30, freq: 0.002, seed: 5 }); g.fillStyle = '#231a34'; ART.skyline(g, { x0: 700, x1: 1260, base: 566, hMin: 14, hMax: 96, wMin: 12, wMax: 34, seed: 211, era: 1 }); });
  g.fillStyle = vgrad(g, hy, H, [[0, '#1c1630'], [0.3, '#0b0c18'], [1, '#040508']]); g.fillRect(0, hy, W, H - hy);
  glow(g, 960, 568, 500, [1, 0.6, 0.3], 0.3);
  // world → screen for a flat plain: z in road-widths from the camera
  const cxz = z => 960 + 300 * Math.sin(z * 0.17 + 0.5), Y = z => hy + (H + 40 - hy) / z, X = (lat, z) => cxz(z) + lat * 1150 / z;
  // suburbs: streets of houses with a light in every window
  for (let row = 24; row >= 0; row--) for (let k = -14; k <= 14; k++) {
    if (Math.abs(k) < 2) continue;
    const z = 2.2 + row * 0.8 + h2(row, k) * 0.4, lat = k * 0.5 + (h2(k, row) - 0.5) * 0.16, x = X(lat, z), y = Y(z), s = 46 / z;
    if (x < -60 || x > W + 60) continue;
    if (z < 9) { g.fillStyle = mixHex('#020305', '#141226', clamp(z / 9)); fillPoly(g, [[x - s, y], [x - s, y - s * 0.62], [x - s * 1.15, y - s * 0.62], [x, y - s * 1.2], [x + s * 1.15, y - s * 0.62], [x + s, y - s * 0.62], [x + s, y]]); }
    const on = clamp(t * 0.9 - h2(row * 1.7, k * 3.1) * 2.0), a = (0.4 + 0.6 * h2(k * 7, row * 3)) * on, w = Math.max(1.3, s * 0.3);
    g.save(); g.globalCompositeOperation = 'lighter';
    g.fillStyle = css([1, 0.8, 0.5], a * clamp(2.6 / z + 0.35)); g.fillRect(x - s * 0.55, y - s * 0.46, w, w * 0.8); if (z < 9) g.fillRect(x + s * 0.2, y - s * 0.46, w, w * 0.8);
    if (z < 7) glow(g, x - s * 0.4, y - s * 0.4, 40 / z, [1, 0.75, 0.42], 0.28 * a);
    g.restore();
  }
  // the road
  g.beginPath(); for (let z = 1; z <= 70; z *= 1.05) g.lineTo(X(-0.5, z), Y(z)); for (let z = 70; z >= 1; z /= 1.05) g.lineTo(X(0.5, z), Y(z)); g.closePath();
  g.fillStyle = vgrad(g, hy, H, [[0, '#3a2a3e'], [0.25, '#1b1a2c'], [1, '#101120']]); g.fill();
  g.strokeStyle = 'rgba(255,220,170,0.4)'; g.lineWidth = 2.5;
  for (const lat of [-0.5, 0, 0.5]) { g.beginPath(); for (let z = 1; z <= 70; z *= 1.05) g.lineTo(X(lat, z), Y(z)); g.stroke(); }
  // traffic: white coming on, red going away
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  for (let i = 0; i < 170; i++) {
    const away = i % 2, lane = (away ? -1 : 1) * (0.08 + 0.115 * (i % 4)), sp = 5 + 3 * h1(i * 3.3);
    const z = ((h1(i * 1.7) * 60 + (away ? 1 : -1) * t * sp) % 60 + 60) % 60 + 1.02;
    const x = X(lane, z), y = Y(z) - 7 / z, r = 34 / z + 1.2, col = away ? [1, 0.16, 0.1] : [1, 0.95, 0.85];
    glow(g, x, y, r * 2.4, col, 0.8); g.fillStyle = css(col, 1); circle(g, x, y, Math.max(0.9, r * 0.2));
    if (z < 14) { g.strokeStyle = css(col, 0.45); g.lineWidth = Math.max(1, r * 0.26); const z2 = z * (away ? 0.9 : 1.1); line(g, x, y, X(lane, z2), Y(z2) - 7 / z2); }
  }
  g.restore();
  S.post = { sun, rays: 0.35, rayc: [1, 0.7, 0.45], th: 0.6, bloom: 0.9, streak: 0.4, expo: 1.03, con: 0.36, vig: 0.72, shadow: [0.42, 0.48, 0.64], high: [0.64, 0.53, 0.4] };
  TYPE.year(S, '1956', 'THE INTERSTATE HIGHWAY SYSTEM', 0.4, 3.9);
};

// -----------------------------------------------------------------------------
// 27. Apollo: launch
// -----------------------------------------------------------------------------
/** Saturn V, floodlit. (x, y) = base of the first stage; 1100 units tall. */
function saturnV(g, x, y, s, lit = 1) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const body = (w0, w1, y0, y1) => {
    const gr = g.createLinearGradient(-w0 / 2, 0, w0 / 2, 0);
    gr.addColorStop(0, css(mix3([0.1, 0.12, 0.16], [0.42, 0.46, 0.54], lit))); gr.addColorStop(0.42, css(mix3([0.16, 0.18, 0.22], [0.96, 0.96, 0.94], lit)));
    gr.addColorStop(0.7, css(mix3([0.13, 0.15, 0.19], [0.8, 0.82, 0.84], lit))); gr.addColorStop(1, css(mix3([0.07, 0.08, 0.11], [0.3, 0.33, 0.4], lit)));
    g.fillStyle = gr; fillPoly(g, [[-w0 / 2, y0], [w0 / 2, y0], [w1 / 2, y1], [-w1 / 2, y1]]);
  };
  // fins and engine skirt
  g.fillStyle = '#0b0c10'; fillPoly(g, [[-50, -70], [-86, 6], [-50, 6]]); fillPoly(g, [[50, -70], [86, 6], [50, 6]]);
  for (const nx of [-30, 0, 30]) fillPoly(g, [[nx - 9, 0], [nx + 9, 0], [nx + 15, 34], [nx - 15, 34]]);
  body(100, 100, 0, -640); body(100, 66, -640, -690); body(66, 66, -690, -860); body(66, 40, -860, -940); body(40, 40, -940, -988); body(40, 8, -988, -1016);
  g.fillStyle = '#c9cdd2'; g.fillRect(-2.5, -1090, 5, 76); fillPoly(g, [[-6, -1050], [6, -1050], [3, -1100], [-3, -1100]]);
  // roll patterns
  g.fillStyle = 'rgba(8,9,12,0.94)';
  g.fillRect(-50, -130, 100, 26); g.fillRect(-50, -104, 24, 90); g.fillRect(2, -104, 24, 90);
  g.fillRect(-50, -384, 100, 22); g.fillRect(-26, -362, 26, 150); g.fillRect(26, -362, 24, 150);
  g.fillRect(-50, -640, 100, 14); g.fillRect(-33, -700, 66, 10); g.fillRect(-33, -862, 66, 8); g.fillRect(-20, -960, 40, 8);
  g.fillStyle = 'rgba(190,30,36,0.95)'; g.font = '700 30px Inter'; g.textAlign = 'center';
  ['U', 'S', 'A'].forEach((c, i) => g.fillText(c, -36, -330 + i * 40)); ['U', 'S', 'A'].forEach((c, i) => g.fillText(c, 14, -590 + i * 40));
  g.restore();
}
function launchTower(g, x, y, s, arms = 1) {
  g.save(); g.translate(x, y); g.scale(s, s); g.lineCap = 'butt';
  g.strokeStyle = '#7a2a1c'; g.fillStyle = '#7a2a1c';
  g.fillRect(-150, -70, 420, 70);
  g.lineWidth = 7; line(g, -44, -70, -44, -1080); line(g, 44, -70, 44, -1080);
  g.lineWidth = 3;
  for (let i = 0; i < 20; i++) { const y0 = -70 - i * 50.5; line(g, -44, y0, 44, y0); line(g, -44, y0, 44, y0 - 50.5); line(g, 44, y0, -44, y0 - 50.5); }
  g.lineWidth = 6; line(g, 0, -1080, 0, -1180); line(g, -70, -1130, 190, -1150); line(g, 0, -1180, 190, -1150); line(g, 0, -1180, -70, -1130);
  g.lineWidth = 9;
  for (let i = 0; i < 9; i++) { const y0 = -150 - i * 108, L = (120 + (i > 5 ? 22 : 0)) * arms; line(g, 44, y0, 44 + L, y0 + (1 - arms) * 30); }
  g.restore();
}
SCENES.launch = S => {
  const { g, t } = S, T0 = S.bar * 2;               // ignition on the downbeat of the third bar
  const burn = t - T0, lift = Math.max(0, burn - 0.75);
  const alt = 62 * lift * lift, oy = -alt * 0.72;   // camera follows, a little behind
  const ground = 940 - oy, sc = 0.72, rx = 1010, ry = ground - 64 - alt;
  const ign = clamp(burn / 0.5), sun = [1500, 760 - oy * 0.3], shake = burn > 0 ? (1.6 + 5 * Math.exp(-burn)) : 0;
  g.save(); g.translate(Math.sin(t * 61) * shake, Math.cos(t * 53) * shake);
  PLATE.sky(S, { hy: ground - 60, sun, c0: '#040a22', c1: '#16255a', c2: '#e88a4c', sc: '#ffc48a', ss: 30, sg: 0.5, cl: 0.4, cs: 1.0, ch: 1.6, cd: '#0c1230', cb: '#f09a5c', st: 0.8, seed: 221 });
  // searchlights before ignition
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const [bx, a] of [[300, -0.5], [640, -0.2], [1500, -2.85], [1800, -2.6]]) {
    const aa = a + Math.sin(t * 0.2 + bx) * 0.03, L = 1500, gr = g.createLinearGradient(bx, ground, bx + Math.cos(aa) * L, ground + Math.sin(aa) * L);
    gr.addColorStop(0, 'rgba(190,210,255,0.24)'); gr.addColorStop(1, 'rgba(190,210,255,0)'); g.fillStyle = gr;
    fillPoly(g, [[bx - 6, ground], [bx + 6, ground], [bx + Math.cos(aa + 0.05) * L, ground + Math.sin(aa + 0.05) * L], [bx + Math.cos(aa - 0.05) * L, ground + Math.sin(aa - 0.05) * L]]);
  }
  g.restore();
  // pad, tower, vehicle
  g.fillStyle = '#05060a'; g.fillRect(-100, ground - 62, W + 200, 900);
  fillPoly(g, [[rx - 330, ground - 62], [rx - 250, ground - 120], [rx + 250, ground - 120], [rx + 330, ground - 62]]);
  launchTower(g, rx - 150, ground - 110, sc, 1 - seg(burn, 0.3, 1.2));
  if (burn > 0) {
    PLATE.run(S, 'plume', { src: [rx, ry + 16], gy: Math.min(ground - 60, ry + 1100), pw: ign, spread: 150 + 760 * seg(burn, 0, 3.2, E.out), rise: 60 + 330 * seg(burn, 0.1, 3.5, E.out), jw: 30, hot: '#ffa23c', smokeLit: '#e0a878', smokeDark: '#2c2228', seed: 3 }, ['hot', 'smokeLit', 'smokeDark'], { res: 0.5 });
    glow(g, rx, ry + 60, 620, [1, 0.6, 0.25], 0.3 * ign); glow(g, rx, ry + 40, 150, [1, 0.9, 0.7], 0.7 * ign);
  }
  saturnV(g, rx, ry, sc, 0.72 + 0.28 * ign);
  // vapour off the tanks, then ice shaken loose at liftoff
  if (burn < 1) ART.puffs(g, { x: rx + 30, y: ry - 380, t, n: 9, seed: 2, rise: -130, drift: 170, r0: 10, r1: 60, col: [0.85, 0.9, 1], a: 0.22, spd: 0.3 });
  if (burn > 0.2) ART.motes(g, { t: burn * 1.4, n: 70, seed: 6, x: rx - 60, y: ry - 660, w: 120, h: 700, vx: 4, vy: 200, size: 1.8, col: [1, 1, 1], a: 0.8 * clamp(2 - burn * 0.4), sway: 10 });
  // foreground: the causeway, cameras, the crowd that came to watch
  g.fillStyle = '#020204'; g.fillRect(-100, 1010 - oy * 1.6, W + 200, 900);
  for (let i = 0; i < 26; i++) ART.figure(g, 60 + i * 76 + (i * 37 % 30), 1016 - oy * 1.6, 96 + (i * 53 % 22), { hat: i % 3 ? 'none' : 'brim', face: 1, armF: burn > 0.3 && i % 2 ? [2.5, 3.0] : [0.2, 0.9], armB: [0, 0.2] });
  g.restore();
  S.post = { sun: [rx, ry + 30], rays: 0.5 * ign, rayc: [1, 0.76, 0.46], th: 0.6, bloom: 0.55 + 0.25 * ign, streak: 0.3 + 0.6 * ign, expo: 1.0 + 0.3 * Math.exp(-Math.max(0, burn) * 5) * (burn > 0 ? 1 : 0), con: 0.36, vig: 0.72, shadow: [0.42, 0.48, 0.64], high: [0.64, 0.54, 0.4] };
  TYPE.year(S, '1969', 'KENNEDY SPACE CENTER, FLORIDA', 0.5, T0 - 0.2);
};

// -----------------------------------------------------------------------------
// 28. Earthrise
// -----------------------------------------------------------------------------
function starfield(g, t, n = 260, a = 0.8, seed = 3) {
  for (let i = 0; i < n; i++) { const s = h1(i * 7.7 + seed); g.fillStyle = css([0.9, 0.93, 1], a * (0.2 + 0.8 * s * s) * (0.8 + 0.2 * Math.sin(t * 2 + i))); g.fillRect(h1(i * 1.3 + seed) * W, h1(i * 2.9 + seed) * H, 1 + s * 1.6, 1 + s * 1.6); }
}
SCENES.earthrise = S => {
  const { g, t } = S, k = seg(t, 0, S.dur + 1, E.sine);
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  starfield(g, t, 240, 0.55);
  const map = GLX.tex('globe', MAPS.globeTex());
  const ey = lerp(650, 420, k);
  PLATE.run(S, 'planet', { map, ctr: [1130, ey], rad: 214, lon0: -1.25 + t * 0.006, lat0: 0.12, sunDir: [0.75, 0.62, 0.28], cloudA: 1, lightsA: 0, roll: 0.4, atmoA: 1, seed: 2 }, [], { res: 1 });
  PLATE.run(S, 'lunar', { hy: lerp(640, 690, k), curve: 150, scl: 1.0, seed: 4, cam: t * 0.035, light: [-0.8, -0.6], bright: 1.0 }, [], { res: 0.5 });
  S.post = { bloom: 0.5, th: 0.6, streak: 0.2, expo: 1.03, con: 0.42, sat: 1.1, vig: 0.7, ca: 0.001, shadow: [0.46, 0.5, 0.56], high: [0.52, 0.52, 0.52] };
};

// -----------------------------------------------------------------------------
// 29. One small step
// -----------------------------------------------------------------------------
function astronaut(g, x, y, h, salute = 1) {
  const u = h / 100;
  g.save(); g.translate(x, y); g.scale(u, u); g.lineCap = 'round'; g.lineJoin = 'round';
  const suit = g.createLinearGradient(-14, 0, 16, 0); suit.addColorStop(0, '#f4f2ec'); suit.addColorStop(0.55, '#c9c7c0'); suit.addColorStop(1, '#55585e');
  g.fillStyle = suit; g.strokeStyle = suit;
  rrect(g, 6, -86, 16, 34, 4);                                   // life-support pack
  g.lineWidth = 13; line(g, -5, -46, -7, -6); line(g, 5, -46, 6, -6);
  g.lineWidth = 9; line(g, -9, -3, -15, -2); line(g, 4, -3, 12, -2);
  rrect(g, -13, -84, 26, 42, 8);
  g.lineWidth = 9; line(g, 8, -78, 14, -58); line(g, 14, -58, 10, -44);
  if (salute) { line(g, -9, -78, -20, -70); line(g, -20, -70, -10, -90); } else { line(g, -9, -78, -16, -58); line(g, -16, -58, -12, -44); }
  circle(g, -1, -96, 12.5);
  const vis = g.createLinearGradient(-12, -104, 4, -90); vis.addColorStop(0, '#ffe9a8'); vis.addColorStop(0.5, '#c88a2a'); vis.addColorStop(1, '#3a2408');
  g.fillStyle = vis; g.beginPath(); g.ellipse(-4.5, -96, 8, 9.5, 0, 0, TAU); g.fill();
  g.restore();
}
SCENES.moon = S => {
  const { g, t } = S, hy = 610;
  S.cam = { x: 8 * t, y: 0, z: 1.0 + 0.05 * S.p };
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  starfield(g, t, 160, 0.4, 9);
  const map = GLX.tex('globe', MAPS.globeTex());
  PLATE.run(S, 'planet', { map, ctr: [1480, 250], rad: 74, lon0: -1.2, lat0: 0.2, sunDir: [-0.7, 0.5, 0.45], cloudA: 1, lightsA: 0, roll: 0.3, atmoA: 1, seed: 2 }, [], { res: 1 });
  PLATE.run(S, 'lunar', { hy, curve: 60, scl: 1.3, seed: 9, cam: t * 0.01, light: [0.85, -0.5], bright: 1.05 }, [], { res: 0.5 });
  S.layer(0.6, () => {
    // lunar module
    g.save(); g.translate(430, 668); g.scale(1.25, 1.25);
    g.strokeStyle = '#b5913f'; g.lineWidth = 5; for (const k of [-1, 1]) { line(g, k * 40, -50, k * 92, 0); line(g, k * 78, 0, k * 106, 0); line(g, k * 40, -20, k * 78, -12); }
    g.fillStyle = vgrad(g, -74, -22, [[0, '#d9b45a'], [1, '#6d5320']]); fillPoly(g, [[-50, -22], [-58, -50], [-46, -72], [46, -72], [58, -50], [50, -22]]);
    g.fillStyle = vgrad(g, -160, -72, [[0, '#d8d9dc'], [1, '#6a6d74']]); fillPoly(g, [[-38, -72], [-46, -104], [-30, -146], [20, -152], [44, -120], [40, -72]]);
    g.fillStyle = '#16181c'; fillPoly(g, [[-22, -126], [-6, -134], [-6, -112], [-24, -108]]); g.fillRect(-16, -22, 32, 14);
    g.strokeStyle = '#c9c9c9'; g.lineWidth = 2; line(g, 20, -152, 34, -196); g.beginPath(); g.arc(36, -204, 12, 0, TAU); g.stroke();
    g.restore();
    g.fillStyle = 'rgba(0,0,0,0.55)'; ellipse(g, 330, 676, 190, 9);
  });
  S.layer(1, () => {
    // flag, astronaut, long shadows
    g.fillStyle = 'rgba(0,0,0,0.6)'; fillPoly(g, [[1010, 792], [1030, 800], [560, 838], [540, 826]]); fillPoly(g, [[1232, 806], [1254, 812], [860, 846], [840, 836]]);
    g.fillStyle = '#d8d8d8'; g.fillRect(1228, 500, 5, 310); g.fillRect(1228, 500, 170, 4);
    g.save(); g.beginPath(); g.rect(1233, 504, 166, 96); g.clip(); g.drawImage(ART.flagArt(50), 1233, 504, 166 + Math.sin(t) * 0, 96);
    g.fillStyle = 'rgba(0,0,0,0.22)'; for (let i = 0; i < 4; i++) g.fillRect(1250 + i * 40, 504, 12, 96);
    g.restore();
    astronaut(g, 1020, 800, 250, 1);
    // bootprints in the foreground
    g.fillStyle = 'rgba(0,0,0,0.5)';
    for (const [x, y, s, r] of [[620, 960, 1.5, -0.25], [800, 1010, 1.7, -0.1], [470, 900, 1.2, -0.3]]) {
      g.save(); g.translate(x, y); g.rotate(r); g.scale(s, s * 0.5);
      rrect(g, -22, -60, 44, 120, 20); g.fillStyle = 'rgba(210,208,200,0.35)'; for (let i = 0; i < 9; i++) g.fillRect(-18, -50 + i * 12, 36, 4);
      g.restore(); g.fillStyle = 'rgba(0,0,0,0.5)';
    }
  });
  S.post = { bloom: 0.45, th: 0.7, streak: 0.15, expo: 1.0, con: 0.44, sat: 1.05, vig: 0.72, ca: 0.001, shadow: [0.46, 0.5, 0.56], high: [0.53, 0.52, 0.5] };
  TYPE.quote(S, '“We came in peace for all mankind.”', 0.5, 3.4, { y: 210, size: 56, fi: 0.6, fo: 0.5 });
};

// -----------------------------------------------------------------------------
// 30. Personal computing and the network
// -----------------------------------------------------------------------------
SCENES.digital = S => {
  const { g, t } = S, cut = S.bar;                 // second bar: the map
  if (t < cut) {
    S.cam = { x: 0, y: 0, z: 1.0 + 0.16 * (t / cut) };
    g.fillStyle = '#04060a'; g.fillRect(0, 0, W, H);
    S.layer(1, () => {
      // garage bench: the machine, a soldering iron, pegboard tools
      g.fillStyle = '#0b0e14'; g.fillRect(-100, 820, W + 200, 400);
      g.fillStyle = '#0a0c11'; for (let i = 0; i < 12; i++) g.fillRect(140 + i * 150, 120 + (i * 53 % 90), 12 + (i * 31 % 50), 150 + (i * 71 % 120));
      g.fillStyle = vgrad(g, 300, 830, [[0, '#cfc6ad'], [1, '#6c6654']]); rrect(g, 610, 290, 700, 470, 26); rrect(g, 540, 760, 840, 76, 10);
      g.fillStyle = '#04100a'; rrect(g, 664, 338, 592, 376, 34);
      // phosphor text
      g.save(); g.beginPath(); g.roundRect(664, 338, 592, 376, 34); g.clip();
      glow(g, 960, 526, 420, [0.2, 1, 0.5], 0.22, 'lighter');
      g.font = '500 34px "DejaVu Sans Mono", monospace'; g.textAlign = 'left'; g.fillStyle = '#6dff9c'; g.shadowColor = '#3dff80'; g.shadowBlur = 14 * S.SC;
      const lines = [']LOAD "FUTURE"', ']RUN', '', 'HELLO, WORLD.'], n = Math.floor(t * 26); let used = 0;
      lines.forEach((ln, i) => { const show = clamp(n - used, 0, ln.length); used += ln.length + 4; if (show > 0 || !ln) g.fillText(ln.slice(0, show) + (show < ln.length && show > 0 ? '█' : ''), 700, 400 + i * 54); });
      if (Math.floor(t * 4) % 2 && n > used - 4) g.fillText('█', 700, 400 + lines.length * 54);
      g.shadowBlur = 0; g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 338; y < 716; y += 6) g.fillRect(664, y, 592, 2);
      g.restore();
      g.fillStyle = '#3d3a30'; for (let r = 0; r < 4; r++) for (let k = 0; k < 15; k++) g.fillRect(586 + k * 50 + r * 8, 772 + r * 15, 40, 10);
    });
    glow(g, 960, 540, 1000, [0.2, 0.9, 0.5], 0.14);
    S.post = { bloom: 0.9, th: 0.5, streak: 0.3, expo: 1.0, con: 0.36, vig: 0.8, shadow: [0.42, 0.52, 0.56], high: [0.54, 0.56, 0.5] };
    TYPE.year(S, '1977', 'THE PERSONAL COMPUTER', 0.25, cut - 0.1);
    return;
  }
  // the network crosses the country
  const u = t - cut, k = seg(u, 0, S.bar, E.quadOut), cx = 960, cy = 590, K = 1500;
  S.cam = { x: 0, y: 0, z: 1.08 - 0.07 * (u / S.bar) };
  g.fillStyle = '#02040a'; g.fillRect(0, 0, W, H);
  S.layer(1, () => {
    MAPS.usaPath(g, cx, cy, K); g.fillStyle = '#081226'; g.fill(); g.strokeStyle = 'rgba(110,170,255,0.55)'; g.lineWidth = 2; g.stroke();
    MAPS.usaPath(g, cx, cy, K, GEO.states, false); g.strokeStyle = 'rgba(90,140,230,0.16)'; g.lineWidth = 1; g.stroke();
    g.save(); g.globalCompositeOperation = 'lighter';
    const P = CITIES.slice(0, 64).map(c => MAPS.albers(c[0], c[1], cx, cy, K));
    // links light up west to east from the first four nodes
    for (let i = 0; i < 64; i++) for (let j = i + 1; j < 64; j++) {
      const d = Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]); if (d > 330 && !(h2(i, j) > 0.985)) continue;
      const on = clamp(k * 2.6 - (Math.min(P[i][0], P[j][0]) - 300) / 1100 - h2(i * 3, j * 7) * 0.5); if (on <= 0) continue;
      g.strokeStyle = css([0.45, 0.8, 1], 0.42 * on); g.lineWidth = 1.4;
      const mx = (P[i][0] + P[j][0]) / 2, my = (P[i][1] + P[j][1]) / 2 - d * 0.16;
      g.beginPath(); g.moveTo(P[i][0], P[i][1]); g.quadraticCurveTo(mx, my, P[j][0], P[j][1]); g.stroke();
      const f = (u * 0.9 + h2(i, j)) % 1, a = 1 - f, bx = a * a * P[i][0] + 2 * a * f * mx + f * f * P[j][0], by = a * a * P[i][1] + 2 * a * f * my + f * f * P[j][1];
      g.fillStyle = css([0.9, 0.97, 1], on); circle(g, bx, by, 2.2);
    }
    P.forEach((p, i) => { const on = clamp(k * 2.6 - (p[0] - 300) / 1100); glow(g, p[0], p[1], 10 + 26 * CITIES[i][2], [0.5, 0.82, 1], 0.9 * on); g.fillStyle = css([1, 1, 1], on); circle(g, p[0], p[1], 2.4); });
    g.restore();
  });
  S.post = { bloom: 0.9, th: 0.45, streak: 0.25, expo: 1.03, con: 0.36, vig: 0.74, shadow: [0.42, 0.5, 0.64], high: [0.52, 0.55, 0.56] };
  TYPE.say(S, 'AND CONNECTED THE WORLD', cut + 0.2, cut + S.bar - 0.05, { y: 170, size: 48, fi: 0.35, fo: 0.3 });
};

// -----------------------------------------------------------------------------
// 31. The boosters come home
// -----------------------------------------------------------------------------
function booster(g, x, y, s, legs = 1, lit = 0.5) {
  g.save(); g.translate(x, y); g.scale(s, s); g.lineCap = 'round';
  g.strokeStyle = '#1b1d22'; g.lineWidth = 7;
  for (const k of [-1, 1]) { const a = lerp(0.12, 0.92, legs); line(g, k * 16, -64, k * (16 + Math.sin(a) * 96), -64 + Math.cos(a) * 96 * (legs > 0.5 ? 0.7 : 1)); line(g, k * 14, -22, k * (16 + Math.sin(a) * 96), -64 + Math.cos(a) * 96 * (legs > 0.5 ? 0.7 : 1)); }
  const gr = g.createLinearGradient(-19, 0, 19, 0); gr.addColorStop(0, '#4a4d55'); gr.addColorStop(0.4, '#e9e9e6'); gr.addColorStop(1, '#3a3d45');
  g.fillStyle = gr; g.fillRect(-19, -440, 38, 430);
  const soot = g.createLinearGradient(0, -440, 0, -10); soot.addColorStop(0, 'rgba(10,10,12,0.15)'); soot.addColorStop(0.55, 'rgba(10,10,12,0.5)'); soot.addColorStop(1, `rgba(${Math.round(60 + 195 * lit)},${Math.round(40 + 120 * lit)},${Math.round(20 + 40 * lit)},0.75)`);
  g.fillStyle = soot; g.fillRect(-19, -440, 38, 430);
  g.fillStyle = '#0c0d10'; g.fillRect(-19, -470, 38, 34); g.fillRect(-21, -12, 42, 14);
  for (const k of [-1, 1]) fillPoly(g, [[k * 19, -462], [k * 52, -468], [k * 52, -452], [k * 19, -446]]);
  g.restore();
}
SCENES.booster = S => {
  const { g, t } = S, hy = 800, T0 = S.bar * 2, sun = [520, 742];
  S.cam = { x: 0, y: 0, z: 1.07 - 0.07 * seg(t, 0, S.dur, E.sine) };
  PLATE.sky(S, { hy, sun, c0: '#060d30', c1: '#3b3476', c2: '#d9744a', sc: '#ffbe84', ss: 36, sg: 0.45, cl: 0.45, cs: 1.0, ch: 1.6, cd: '#161a40', cb: '#f58c58', st: 0.6, seed: 231 });
  PLATE.ocean(S, { hy, sun, deep: '#040814', refl: '#b06a52', fog: '#e08a5a', sc: '#ffc08a', spd: 0.2, glit: 1.1, fogA: 0.7 });
  // landing zone: concrete pads on a low shore
  g.fillStyle = '#05060b'; fillPoly(g, [[-100, 880], [W + 100, 850], [W + 100, 1200], [-100, 1200]]);
  g.fillStyle = '#0c0e16'; for (const px of [760, 1300]) ellipse(g, px, 900, 250, 26);
  const ships = [[760, 0], [1300, 0.42]];
  for (const [bx, dly] of ships) {
    const td = T0 + dly, rem = Math.max(0, td - t), alt = 46 * Math.pow(rem, 1.85), by = 902 - alt, firing = t < td + 0.25 ? clamp((td + 0.25 - t) / 0.25) : 0;
    const pw = firing * (0.75 + 0.25 * Math.sin(t * 40 + bx)), near = clamp(1 - alt / 330), after = clamp((t - td) / 2.2);
    PLATE.run(S, 'plume', { src: [bx, by + 4], gy: Math.min(904, by + 520), pw, spread: 30 + 400 * Math.max(near * firing, after > 0 ? 1 - after * 0.2 : 0), rise: 30 + 170 * Math.max(near, after ? 1 : 0), jw: 13, hot: '#ffb860', smokeLit: '#e9a878', smokeDark: '#2a2030', seed: bx * 0.01 }, ['hot', 'smokeLit', 'smokeDark'], { res: 0.5, alpha: after > 0 ? 1 - after * 0.75 : 1 });
    glow(g, bx, by + 40, 340, [1, 0.62, 0.28], 0.4 * pw); glow(g, bx, by + 16, 80, [1, 0.92, 0.75], 0.9 * pw);
    booster(g, bx, by, 0.92, seg(rem, 1.6, 0.4), pw);
    if (t > td && t < td + 0.6) ART.sparks(g, { x: bx, y: 900, t, t0: td, n: 60, seed: bx, life: 0.6, spd: 420, grav: 300, dir: -Math.PI / 2, spread: 3.0, col: [1, 0.75, 0.4], size: 2 });
  }
  // watchers on the shore
  S.layer(1.2, () => { g.fillStyle = '#020204'; g.fillRect(-200, 1010, W + 400, 300); for (let i = 0; i < 14; i++) ART.figure(g, 80 + i * 138 + (i * 37 % 50), 1016, 150 + (i * 53 % 30), { face: i % 2 ? 1 : -1, hat: i % 4 ? 'none' : 'cap', armF: t > T0 && i % 2 ? [2.5, 3.0] : [0.3, 1.0], armB: t > T0 + 0.3 && i % 3 === 0 ? [2.4, 2.9] : [0, 0.2] }); });
  const flash = Math.exp(-Math.abs(t - T0) * 5) * (t > T0 ? 1 : 0.2);
  S.post = { sun, rays: 0.35, rayc: [1, 0.76, 0.5], th: 0.68, bloom: 0.6, streak: 0.6, expo: 1.0 + 0.2 * flash, con: 0.36, vig: 0.7, shadow: [0.42, 0.48, 0.64], high: [0.64, 0.54, 0.4] };
  TYPE.year(S, '2018', 'CAPE CANAVERAL, FLORIDA', T0 + 0.25, S.dur - 0.1);
};

// -----------------------------------------------------------------------------
// 32. The machine room
// -----------------------------------------------------------------------------
SCENES.ai = S => {
  const { g, t } = S, vx = 960, vy = 500, speed = 0.9;
  g.fillStyle = '#02040a'; g.fillRect(0, 0, W, H);
  const PX = (x, z) => vx + x * 760 / z, PY = (y, z) => vy + y * 560 / z;
  // floor and ceiling
  g.fillStyle = vgrad(g, vy, H, [[0, '#0c1a30'], [1, '#03060c']]); fillPoly(g, [[PX(-1, 1), PY(1, 1)], [PX(1, 1), PY(1, 1)], [PX(1, 60), PY(1, 60)], [PX(-1, 60), PY(1, 60)]]);
  g.fillStyle = vgrad(g, 0, vy, [[0, '#04070e'], [1, '#0d1a2e']]); fillPoly(g, [[PX(-1, 1), PY(-0.9, 1)], [PX(1, 1), PY(-0.9, 1)], [PX(1, 60), PY(-0.9, 60)], [PX(-1, 60), PY(-0.9, 60)]]);
  const off = (t * speed) % 0.7;
  for (let n = 46; n >= 0; n--) {
    const z0 = 0.9 + n * 0.7 - off, z1 = z0 + 0.62; if (z1 < 0.75) continue;
    const zn = Math.max(0.72, z0), fog = clamp(1 - 6 / (z0 + 5));
    for (const sgn of [-1, 1]) {
      // rack face
      g.fillStyle = mixHex('#05080f', '#12264a', fog);
      fillPoly(g, [[PX(sgn, zn), PY(-0.78, zn)], [PX(sgn, z1), PY(-0.78, z1)], [PX(sgn, z1), PY(1, z1)], [PX(sgn, zn), PY(1, zn)]]);
      // status lights
      g.save(); g.globalCompositeOperation = 'lighter';
      const id = n + Math.floor(t * speed / 0.7);
      for (let k = 0; k < 3; k++) for (let j = 0; j < 20; j++) {
        const z = z0 + 0.08 + k * 0.2; if (z < 0.78) continue;
        const h = h2(id * 3.1 + k * 7.7 + sgn, j * 1.3); if (h < 0.3) continue;
        const bl = h2(id + j * 3.3 + k, Math.floor(t * (2 + h * 6) + h * 10)) > 0.25 ? 1 : 0.15;
        const col = h > 0.9 ? [1, 0.65, 0.2] : h > 0.62 ? [0.3, 1, 0.6] : [0.35, 0.7, 1];
        const x = PX(sgn, z), y = PY(-0.7 + j * 0.083, z), s = Math.max(1, 7 / z);
        g.fillStyle = css(col, bl * clamp(1.6 - fog)); g.fillRect(x - s * 0.5, y, s * 1.4, s * 0.55);
        if (z < 3.5 && bl > 0.5) glow(g, x, y, 22 / z, col, 0.5);
      }
      g.restore();
    }
    // ceiling light bar
    g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = css([0.7, 0.86, 1], clamp(1.5 - fog) * 0.85); g.lineWidth = Math.max(1, 12 / zn);
    line(g, PX(-0.3, zn), PY(-0.88, zn), PX(0.3, zn), PY(-0.88, zn)); g.restore();
  }
  // floor sheen
  g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createLinearGradient(0, vy, 0, H); gr.addColorStop(0, 'rgba(90,150,255,0.26)'); gr.addColorStop(1, 'rgba(90,150,255,0)');
  g.fillStyle = gr; fillPoly(g, [[PX(-0.32, 1), H], [PX(0.32, 1), H], [PX(0.32, 60), PY(1, 60)], [PX(-0.32, 60), PY(1, 60)]]); g.restore();
  // an engineer, for scale
  { const z = 4.2 - t * 0.12; g.fillStyle = '#010204'; ART.figure(g, PX(0.12, z), PY(1, z), 560 * 0.86 / z, { walk: t * 0.7, face: 1, armF: [0.5, 1.2] }); }
  // a mind of light gathers at the far end
  const k = seg(t, 1.8, S.dur, E.sine);
  g.save(); g.globalCompositeOperation = 'lighter';
  const N = 46, pts = [];
  for (let i = 0; i < N; i++) { const a = h1(i * 3.3) * TAU + t * 0.12 * (h1(i) - 0.5), r = (40 + 300 * Math.sqrt(h1(i * 7.1))) * (0.35 + 0.65 * k); pts.push([vx + Math.cos(a) * r * 1.5, vy - 20 + Math.sin(a) * r * 0.9]); }
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]); if (d > 150 * (0.4 + 0.6 * k)) continue;
    const pulse = 0.5 + 0.5 * Math.sin(t * 5 + i + j);
    g.strokeStyle = css([0.6, 0.85, 1], 0.3 * k * (0.4 + 0.6 * pulse)); g.lineWidth = 1.3; line(g, pts[i][0], pts[i][1], pts[j][0], pts[j][1]);
  }
  for (const p of pts) { glow(g, p[0], p[1], 16, [0.7, 0.9, 1], 0.7 * k); }
  glow(g, vx, vy - 10, 520, [0.45, 0.7, 1], 0.42 * k + 0.12);
  g.restore();
  S.post = { sun: [vx, vy], rays: 0.5 * k + 0.15, rayc: [0.7, 0.86, 1], th: 0.5, bloom: 0.85, streak: 0.5, expo: 1.03, con: 0.38, vig: 0.74, shadow: [0.42, 0.5, 0.66], high: [0.5, 0.55, 0.6] };
  TYPE.year(S, '2020s', 'ARTIFICIAL INTELLIGENCE', 0.5, 5.9);
};
