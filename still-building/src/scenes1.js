/* =============================================================================
 *  ACT I — LIBERTY & FOUNDING
 *  dawn → ships → hall → quill → bell → flag13 → statue
 * ========================================================================== */
'use strict';

/** Shader-plate helpers shared by every act: hex colours in, sensible defaults. */
const PLATE = (() => {
  const conv = (u, keys) => { for (const k of keys) if (typeof u[k] === 'string') u[k] = hex(u[k]); return u; };
  const SKY = { c0: '#0a1530', c1: '#27406e', c2: '#e9a66a', hy: 700, sun: [960, 600], sc: '#ffd9a0', ss: 26, sg: 0.6, cl: 0.5, cs: 1, ch: 1.6, cv: [0.012, 0], cd: '#1c2238', cb: '#ffc890', st: 0, seed: 1 };
  const OCEAN = { deep: '#04101f', refl: '#c58a5c', sc: '#ffd9a0', fog: '#e9a66a', sun: [960, 600], hy: 700, spd: 0.5, cam: 0, chop: 1, glit: 1, fogA: 0.6 };
  return {
    sky(S, o, opt) { GLX.plate(S.g, 'sky', conv(Object.assign({ T: S.t }, SKY, o), ['c0', 'c1', 'c2', 'sc', 'cd', 'cb']), opt); },
    ocean(S, o, opt) { GLX.plate(S.g, 'ocean', conv(Object.assign({ T: S.t }, OCEAN, o), ['deep', 'refl', 'sc', 'fog']), opt); },
    run(S, name, o, keys = [], opt) { GLX.plate(S.g, name, conv(Object.assign({ T: S.t }, o), keys), opt); },
  };
})();

// -----------------------------------------------------------------------------
// 1. Dawn over the Atlantic
// -----------------------------------------------------------------------------
SCENES.dawn = S => {
  const { g, t } = S, hy = 610;
  const k = seg(t, 0.5, 8.5, E.sine);                 // night → first light
  const sun = [1130, hy + 70 - 150 * seg(t, 1.5, 9.5, E.quadOut)];
  const lit = smooth(hy + 30, hy - 40, sun[1]);
  PLATE.sky(S, {
    hy, sun, c0: css3(mix3(hex('#03060f'), hex('#0a1838'), k)), c1: css3(mix3(hex('#0a1226'), hex('#3b3a66'), k)),
    c2: css3(mix3(hex('#1a1a30'), hex('#f09a58'), k)), sc: '#ffcf96', ss: 30, sg: 0.25 + 0.6 * k, cl: 0.52, cs: 1.1, ch: 1.5,
    cd: css3(mix3(hex('#05070f'), hex('#231d38'), k)), cb: css3(mix3(hex('#20202e'), hex('#ff9d5c'), k)), st: 1 - k * 0.9, seed: 3,
  });
  PLATE.ocean(S, {
    hy, sun, deep: '#020814', refl: css3(mix3(hex('#141a2c'), hex('#c7794c'), k)), fog: css3(mix3(hex('#141a2c'), hex('#f0a468'), k)),
    sc: '#ffc98c', spd: 0.55, chop: 1, glit: 1.5 * lit, fogA: 0.65,
  });
  S.post = { sun, rays: 0.5 * lit, rayc: [1, 0.78, 0.5], bloom: 0.6, expo: 0.92 + 0.14 * k, con: 0.3, vig: 0.7, shadow: [0.42, 0.5, 0.62], high: [0.62, 0.52, 0.4] };
  TYPE.say(S, 'IT BEGAN AS AN IDEA', 3.2, 7.6, { y: 330, size: 54 });
};
function css3(c) { return '#' + c.map(v => Math.round(clamp(v) * 255).toString(16).padStart(2, '0')).join(''); }

// -----------------------------------------------------------------------------
// 2. Ships
// -----------------------------------------------------------------------------
SCENES.ships = S => {
  const { g, t } = S, hy = 650, sun = [1240, 520 - t * 6];
  S.cam = { x: 0, y: 0, z: 1 + 0.05 * S.p };
  PLATE.sky(S, { hy, sun, c0: '#0c1d44', c1: '#51487a', c2: '#e8935a', sc: '#ffd6a0', ss: 34, sg: 0.8, cl: 0.5, cs: 1.1, ch: 1.5, cd: '#2a2140', cb: '#ffab66', seed: 3 });
  PLATE.ocean(S, { hy, sun, deep: '#030b18', refl: '#cf8551', fog: '#f5ab6c', sc: '#ffd09a', spd: 0.5, glit: 1.6, fogA: 0.7 });
  const boat = (x, y, s, seed, haze) => {
    const bob = Math.sin(t * 0.9 + seed) * 3 * s, roll = Math.sin(t * 0.7 + seed * 2) * 0.018;
    const hull = mixHex('#07080d', '#a56848', haze), sail = mixHex('#1b1410', '#d9925c', haze * 0.8 + 0.14, 0.93);
    // reflection
    g.save(); g.translate(0, 2 * y); g.scale(1, -0.62); g.translate(0, y * (1 - 1 / 0.62) + 0);
    g.globalAlpha = 0.34 * (1 - haze * 0.5); g.fillStyle = hull;
    ART.ship(g, x, y / 0.62 - bob, s, { t, seed, sailCss: hull, roll: -roll });
    g.restore();
    g.fillStyle = hull;
    ART.ship(g, x, y + bob, s, { t, seed, sailCss: sail, roll });
  };
  S.layer(0.35, () => { boat(420 - t * 3, hy + 6, 0.36, 5, 0.62); boat(1560 - t * 4, hy + 10, 0.5, 9, 0.5); });
  S.layer(1, () => boat(900 - t * 12, hy + 150, 1.52, 1, 0));
  S.post = { sun, rays: 0.7, rayc: [1, 0.8, 0.52], rayDens: 0.9, bloom: 0.6, expo: 1.0, vig: 0.62, shadow: [0.42, 0.5, 0.62], high: [0.62, 0.53, 0.4] };
};

// -----------------------------------------------------------------------------
// 3. Independence Hall — the signing
// -----------------------------------------------------------------------------
SCENES.hall = S => {
  const { g, t } = S;
  S.cam = { x: 14 * S.p, y: 0, z: 1 + 0.06 * S.p };
  g.fillStyle = '#0d0806'; g.fillRect(0, 0, W, H);
  const wins = [430, 960, 1490], ww = 250, top = 90, bot = 760;
  S.layer(0.5, () => {
    for (const wx of wins) {
      g.beginPath(); g.moveTo(wx - ww / 2, bot); g.lineTo(wx - ww / 2, top + ww / 2); g.arc(wx, top + ww / 2, ww / 2, Math.PI, 0); g.lineTo(wx + ww / 2, bot); g.closePath();
      g.fillStyle = vgrad(g, top, bot, [[0, '#f6ead0'], [0.55, '#f1cf96'], [1, '#d99f5c']]); g.fill();
      g.strokeStyle = '#140c07'; g.lineWidth = 8;
      for (let i = 1; i < 4; i++) line(g, wx - ww / 2 + i * ww / 4, top, wx - ww / 2 + i * ww / 4, bot);
      for (let j = 1; j < 9; j++) line(g, wx - ww / 2, top + 60 + j * 74, wx + ww / 2, top + 60 + j * 74);
      g.lineWidth = 20; g.stroke(new Path2D(`M ${wx - ww / 2 - 8} ${bot + 6} L ${wx - ww / 2 - 8} ${top + ww / 2} A ${ww / 2 + 8} ${ww / 2 + 8} 0 0 1 ${wx + ww / 2 + 8} ${top + ww / 2} L ${wx + ww / 2 + 8} ${bot + 6} Z`));
    }
    g.fillStyle = '#080503'; g.fillRect(-100, 772, W + 200, 14);
    // chandelier
    g.strokeStyle = g.fillStyle = '#080503'; g.lineWidth = 4; line(g, 960, -20, 960, 70);
    for (let i = 0; i < 8; i++) { const a = i / 7 * Math.PI; g.beginPath(); g.moveTo(960, 70); g.quadraticCurveTo(960 + Math.cos(a) * 90, 128, 960 + Math.cos(a) * 124, 82); g.stroke(); g.fillRect(960 + Math.cos(a) * 124 - 3, 62, 6, 20); }
  });
  // sunlit haze hanging in the room: this is what the delegates are silhouetted against
  for (const wx of wins) glow(g, wx, 470, 560, [0.95, 0.66, 0.32], 0.34);
  ART.haze(g, 560, 900, [0.9, 0.62, 0.3], 0.0, 0.26);
  // floor with window light
  S.layer(0.8, () => {
    g.fillStyle = vgrad(g, 790, H, [[0, '#2a190c'], [1, '#080403']]); g.fillRect(-100, 790, W + 200, 400);
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const wx of wins) {
      const gr = g.createLinearGradient(0, 800, 0, 1090); gr.addColorStop(0, 'rgba(255,196,110,0.5)'); gr.addColorStop(1, 'rgba(255,196,110,0)');
      g.fillStyle = gr; fillPoly(g, [[wx - 120, 796], [wx + 120, 796], [wx + 90 - 300, 1100], [wx - 170 - 420, 1100]]);
    }
    g.restore();
  });
  PLATE.run(S, 'beams', { src: [960, 330], ang: 1.95, wid: 700, len: 1000, dens: 0.22, seed: 2, n: 3, col: '#ffcf8a' }, ['col'], { op: 'lighter' });
  // delegates
  S.layer(0.9, () => {
    g.fillStyle = '#0e0806';
    const back = [[190, 'wig'], [330, 'tricorn'], [560, 'wig'], [690, 'wig'], [1250, 'wig'], [1370, 'tricorn'], [1610, 'wig'], [1760, 'wig']];
    back.forEach(([x, hat], i) => ART.figure(g, x, 900 + (i % 3) * 8, 400 + (i * 37 % 34), { hat, coat: true, face: x < 960 ? 1 : -1, armF: [0.1 + 0.2 * (i % 2), 0.9], armB: [-0.1, 0.2], lean: 0.02 }));
  });
  S.layer(1, () => {
    g.fillStyle = '#050302';
    // table with cloth, inkstand and candlesticks
    fillPoly(g, [[700, 800], [1240, 800], [1284, 990], [656, 990]]);
    g.fillRect(684, 788, 572, 16);
    g.fillRect(1104, 746, 9, 44); g.fillRect(1092, 780, 32, 9); g.fillRect(820, 736, 7, 54); g.fillRect(810, 780, 26, 9);
    fillPoly(g, [[1010, 788], [1036, 700], [1044, 703], [1022, 788]]);
    // the signer leans over the table, pen in hand; others close in
    ART.figure(g, 900, 1000, 470, { hat: 'wig', coat: true, lean: 0.4, armF: [1.05, 1.5], armB: [0.5, 1.2] });
    ART.figure(g, 1250, 1004, 480, { hat: 'wig', coat: true, face: -1, armF: [0.25, 1.1], armB: [-0.1, 0.3] });
    ART.figure(g, 730, 1006, 476, { hat: 'wig', coat: true, armF: [0.2, 0.7], armB: [-0.15, 0.15] });
  });
  ART.motes(g, { t, n: 110, seed: 4, x: 300, y: 120, w: 1400, h: 760, vx: 6, vy: 5, size: 1.5, col: [1, 0.86, 0.6], a: 0.55, sway: 14 });
  // out-of-focus foreground shoulders frame the room
  g.save(); g.filter = `blur(${7 * S.SC}px)`; g.fillStyle = '#020101';
  S.layer(1.6, () => { ART.figure(g, 110, 1560, 1080, { hat: 'tricorn', coat: true, broad: true }); ART.figure(g, 1830, 1600, 1100, { hat: 'wig', coat: true, face: -1, broad: true }); });
  g.restore();
  S.post = { sun: [960, 380], rays: 0.75, rayc: [1, 0.8, 0.52], rayDens: 0.9, rayDecay: 0.972, th: 0.6, bloom: 0.6, expo: 1.0, con: 0.3, vig: 0.75, shadow: [0.5, 0.47, 0.44], high: [0.62, 0.54, 0.4] };
  TYPE.year(S, '1776', 'PHILADELPHIA', 0.7, 3.9);
};

// -----------------------------------------------------------------------------
// 4. The quill
// -----------------------------------------------------------------------------
const PARCH = (() => {
  let page = null, ink = null, geo = null;
  const PW = 3000, PH = 1500;
  const LINES = [
    ['bl', 150, 'In CONGRESS, July 4, 1776.'],
    ['sc', 96, 'The unanimous Declaration of the thirteen united States of America,'],
    ['b', 0, 'When in the Course of human events, it becomes necessary for one people to dissolve the political bands'],
    ['b', 0, 'which have connected them with another, and to assume among the powers of the earth, the separate'],
    ['b', 0, 'and equal station to which the Laws of Nature and of Nature’s God entitle them, a decent respect'],
    ['b', 0, 'to the opinions of mankind requires that they should declare the causes which impel them.'],
    ['b', 0, 'We hold these truths to be self-evident, that all men are created equal, that they are endowed'],
    ['b', 0, 'by their Creator with certain unalienable Rights, that among these are Life, Liberty'],
    ['b', 0, 'and the pursuit of Happiness.'],
  ];
  function build() {
    if (page) return;
    const r = rng(77);
    page = document.createElement('canvas'); page.width = PW; page.height = PH;
    let g = page.getContext('2d');
    g.fillStyle = '#d9c292'; g.fillRect(0, 0, PW, PH);
    for (let i = 0; i < 900; i++) {             // mottling
      const x = r() * PW, y = r() * PH, rad = 40 + r() * 260, d = r() > 0.5;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, d ? 'rgba(110,78,36,0.07)' : 'rgba(250,236,196,0.07)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    g.globalAlpha = 0.05;                        // fibres
    for (let i = 0; i < 5000; i++) { g.strokeStyle = r() > 0.5 ? '#5a3c18' : '#fff3d0'; g.lineWidth = 0.6 + r(); const x = r() * PW, y = r() * PH, a = r() * TAU, L = 6 + r() * 30; line(g, x, y, x + Math.cos(a) * L, y + Math.sin(a) * L); }
    g.globalAlpha = 1;
    ink = document.createElement('canvas'); ink.width = PW; ink.height = PH;
    g = ink.getContext('2d'); g.fillStyle = '#2a1a0c'; g.textBaseline = 'alphabetic';
    let y = 250; geo = [];
    for (const [kind, size, text] of LINES) {
      if (kind === 'bl') { g.font = `${size}px UnifrakturMaguntia`; g.textAlign = 'center'; g.fillText(text, PW / 2, y); y += 150; continue; }
      if (kind === 'sc') { g.font = `${size}px "Pinyon Script"`; g.textAlign = 'center'; g.fillText(text, PW / 2, y); y += 170; continue; }
      g.font = '92px "Pinyon Script"'; g.textAlign = 'left';
      g.fillText(text, 190, y);
      geo.push({ y, x0: 190, w: g.measureText(text).width, text });
      y += 132;
    }
    // where the pen starts in the second-to-last line: after "that among these are "
    const L7 = geo[geo.length - 2], cut = L7.text.indexOf('Life,');
    L7.cut = 190 + g.measureText(L7.text.slice(0, cut)).width;
  }
  return { build, get page() { return page; }, get ink() { return ink; }, get geo() { return geo; }, PW, PH };
})();

function quillPen(g, x, y, ang, s) {
  g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s);
  // shaft
  g.strokeStyle = '#efe6cf'; g.lineCap = 'round'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(40, -260, 150, -640); g.stroke();
  // vane
  const gr = g.createLinearGradient(-40, -300, 160, -400); gr.addColorStop(0, '#fbf5e4'); gr.addColorStop(0.55, '#d9ccae'); gr.addColorStop(1, '#8f7f62');
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(28, -150);
  g.bezierCurveTo(-58, -250, -40, -470, 60, -590); g.bezierCurveTo(100, -636, 140, -652, 152, -648);
  g.bezierCurveTo(196, -560, 170, -330, 76, -226); g.lineTo(62, -238); g.lineTo(58, -208); g.bezierCurveTo(48, -184, 38, -166, 28, -150); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(90,70,40,0.35)'; g.lineWidth = 1.5;
  for (let i = 0; i < 26; i++) { const k = i / 26, bx = lerp(34, 148, k * k * 0.7 + k * 0.3), by = lerp(-170, -640, k); g.beginPath(); g.moveTo(bx, by); g.lineTo(bx - 62 + k * 30, by + 36); g.moveTo(bx, by); g.lineTo(bx + 44 - k * 20, by + 44); g.stroke(); }
  // nib
  g.fillStyle = '#3a2a16'; fillPoly(g, [[0, 0], [9, -40], [-3, -38]]);
  g.restore();
}

SCENES.quill = S => {
  const { g, t } = S;
  PARCH.build();
  const geo = PARCH.geo, L7 = geo[geo.length - 2], L8 = geo[geo.length - 1];
  // writing progress: finish line 7 from "Life," then line 8
  const a = seg(t, 0.15, 2.0, E.lin), b = seg(t, 2.25, 3.9, E.lin);
  const w7 = L7.cut - L7.x0 + (L7.w - (L7.cut - L7.x0)) * a;
  const pen = b > 0 ? [L8.x0 + L8.w * b, L8.y] : [L7.x0 + w7, L7.y];
  const lift = smooth(2.0, 2.12, t) * (1 - smooth(2.15, 2.27, t));
  // camera follows the nib
  const fx = lerp(L7.cut + 40, L7.x0 + L7.w * 0.72, seg(t, 0, 2.2, E.sine)), fx2 = lerp(fx, L8.x0 + 520, seg(t, 1.9, 2.9, E.io));
  const k = 1.0 + 0.05 * S.p, rot = -0.075;
  g.fillStyle = '#120b05'; g.fillRect(0, 0, W, H);
  g.save();
  g.translate(940, 590); g.rotate(rot); g.scale(k, k); g.translate(-fx2, -(L7.y + 30));
  g.drawImage(PARCH.page, 0, 0);
  // ink: everything above, then the lines being written
  g.save(); g.beginPath(); g.rect(0, 0, PARCH.PW, L7.y - 96); g.rect(0, L7.y - 96, L7.x0 + w7, 132); if (b > 0) g.rect(0, L8.y - 96, L8.x0 + L8.w * b, 140); g.clip();
  g.drawImage(PARCH.ink, 0, 0); g.restore();
  // wet ink glints behind the nib
  g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(40,20,5,0.25)';
  g.beginPath(); g.ellipse(pen[0] - 30, pen[1] - 20, 60, 34, 0, 0, TAU); g.fill(); g.restore();
  const wob = Math.sin(t * 31) * 5 + Math.sin(t * 17.3) * 4, px = pen[0], py = pen[1] - 10 - Math.abs(Math.sin(t * 23)) * 8 - lift * 60;
  // shadow, then quill and the writer's hand
  g.save(); g.filter = `blur(${10 * S.SC}px)`; g.globalAlpha = 0.42; g.globalCompositeOperation = 'multiply';
  g.save(); g.translate(46, 34); quillShadow(g, px, py, 0.38 + wob * 0.004); g.restore(); g.restore();
  quillPen(g, px, py, 0.38 + wob * 0.004, 1);
  g.save(); g.filter = `blur(${5 * S.SC}px)`;
  g.fillStyle = '#5b3d2a'; g.beginPath(); g.ellipse(px + 118, py - 92, 104, 62, -0.5, 0, TAU); g.fill();
  g.fillStyle = '#4a3122'; g.beginPath(); g.ellipse(px + 54, py - 98, 56, 22, 1.0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(px + 84, py - 46, 62, 22, 0.5, 0, TAU); g.fill();
  g.fillStyle = '#e9e0cc'; fillPoly(g, [[px + 176, py - 150], [px + 250, py - 70], [px + 330, py - 40], [px + 420, py + 60], [px + 300, py + 110], [px + 190, py - 10]]);
  g.fillStyle = '#10182c'; fillPoly(g, [[px + 236, py - 170], [px + 1500, py + 500], [px + 1300, py + 1100], [px + 250, py + 40]]);
  g.restore();
  g.restore();
  // candle light: warm pool, heavy fall-off
  const fl = 1 + 0.05 * Math.sin(t * 13) + 0.04 * Math.sin(t * 7.7);
  g.save(); g.globalCompositeOperation = 'multiply';
  const gr = g.createRadialGradient(760, 430, 60, 860, 520, 1250);
  gr.addColorStop(0, '#fff6e2'); gr.addColorStop(0.35, '#f2c58a'); gr.addColorStop(0.7, '#7a4a22'); gr.addColorStop(1, '#170b04');
  g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore();
  glow(g, 700, 380, 900, [1, 0.72, 0.38], 0.16 * fl);
  ART.motes(g, { t, n: 40, seed: 8, vx: 5, vy: -4, size: 1.6, col: [1, 0.85, 0.6], a: 0.3 });
  S.post = { bloom: 0.5, th: 0.7, expo: 1.02 * fl, con: 0.34, vig: 0.85, sat: 1.05, shadow: [0.52, 0.47, 0.42], high: [0.6, 0.54, 0.42] };
};
function quillShadow(g, x, y, ang) {
  g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = '#1a0e04';
  g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-58, -250, -40, -470, 60, -590); g.bezierCurveTo(140, -652, 196, -560, 76, -226); g.closePath(); g.fill();
  g.restore();
}

// -----------------------------------------------------------------------------
// 5. The bell
// -----------------------------------------------------------------------------
SCENES.bell = S => {
  const { g, t } = S, sun = [1180, 330];
  S.cam = { x: 0, y: -10 * S.p, z: 1.02 + 0.05 * S.p };
  PLATE.sky(S, { hy: 1500, sun, c0: '#12295c', c1: '#4f6aa6', c2: '#e9b07a', sc: '#ffe2b0', ss: 38, sg: 0.6, cl: 0.5, cs: 0.9, ch: 1.2, cd: '#3f4a78', cb: '#ffdcae', seed: 11 });
  const ang = Math.sin(t * 2.6 + 0.9) * 0.36;
  S.layer(0.6, () => { g.fillStyle = '#0a0806'; ART.bell(g, 960, 196, 2.25, ang, -ang * 1.5 + Math.sin(t * 2.6 + 2.2) * 0.2); });
  // belfry: brick arch and timber frame
  S.layer(1, () => {
    g.fillStyle = '#050403';
    g.beginPath(); g.rect(-200, -200, W + 400, H + 400);
    g.moveTo(330, 1300); g.lineTo(330, 470); g.bezierCurveTo(330, -40, 1590, -40, 1590, 470); g.lineTo(1590, 1300); g.closePath(); g.fill('evenodd');
    g.fillRect(300, 150, 1320, 46);
    g.fillRect(-100, 960, W + 200, 300);
    for (const x of [470, 1450]) { g.save(); g.translate(x, 196); g.rotate(x < 960 ? 0.5 : -0.5); g.fillRect(-13, -160, 26, 200); g.restore(); }
  });
  ART.motes(g, { t, n: 50, seed: 3, vx: 12, vy: -6, size: 1.6, col: [1, 0.9, 0.7], a: 0.5 });
  S.post = { sun, rays: 0.55, rayc: [1, 0.84, 0.58], th: 0.78, bloom: 0.5, expo: 0.96, vig: 0.7, shadow: [0.46, 0.5, 0.58], high: [0.6, 0.54, 0.42] };
};

// -----------------------------------------------------------------------------
// 6. Thirteen stars
// -----------------------------------------------------------------------------
SCENES.flag13 = S => {
  const { g, t } = S, sun = [1320, 420];
  S.cam = { x: 0, y: 0, z: 1.04 - 0.04 * S.p };
  PLATE.sky(S, { hy: 1400, sun, c0: '#0c2356', c1: '#3f62a4', c2: '#d9a878', sc: '#ffe4b6', ss: 42, sg: 0.5, cl: 0.5, cs: 0.8, ch: 1.1, cd: '#3b4a7c', cb: '#ffe0b4', seed: 21 });
  const tex = GLX.tex('flag13', ART.flagArt(13));
  PLATE.run(S, 'flag', { tex, rect: [372, 150, 1290, 680], amp: 0.055, back: 0.3, spd: 4.2, shade: 0.4, tint: [1, 0.86, 0.62], T: t + 3 }, [], { res: 1 });
  g.fillStyle = '#0a0705'; g.fillRect(346, -20, 26, H + 40); circle(g, 359, 60, 26);
  ART.motes(g, { t, n: 40, seed: 5, vx: 30, vy: -8, size: 1.5, col: [1, 0.92, 0.75], a: 0.4 });
  S.post = { sun, rays: 0.4, rayc: [1, 0.88, 0.66], th: 0.8, bloom: 0.4, expo: 0.95, vig: 0.6, sat: 1.15, shadow: [0.46, 0.5, 0.58], high: [0.6, 0.54, 0.44] };
};

// -----------------------------------------------------------------------------
// 7. Liberty Enlightening the World
// -----------------------------------------------------------------------------
SCENES.statue = S => {
  const { g, t } = S;
  const oy = lerp(640, 70, seg(t, 0, 7.2, E.sine));          // camera tilt: world y of the top of frame
  const water = 1500, sunW = [1080, 470];
  const hy = water - oy, sun = [sunW[0], sunW[1] - oy];
  PLATE.sky(S, { hy, sun, c0: '#081a44', c1: '#3c5594', c2: '#f0a25e', sc: '#ffdca6', ss: 40, sg: 0.62, cl: 0.52, cs: 1.25, ch: 2.2, cd: '#2c335e', cb: '#ffc88a', seed: 17 });
  if (hy < H) PLATE.ocean(S, { hy, sun, deep: '#07142a', refl: '#d89862', fog: '#ffc888', sc: '#ffd9a2', spd: 0.3, glit: 1.2, fogA: 0.7 });
  g.save(); g.translate(0, -oy);
  // far shore and shipping
  g.fillStyle = '#b77f58';
  ART.skyline(g, { base: water + 2, hMin: 8, hMax: 46, wMin: 16, wMax: 60, seed: 31 });
  g.fillStyle = '#8c5d44';
  for (const [x, s] of [[300, 0.16], [1480, 0.22], [1700, 0.13]]) ART.ship(g, x, water + 6, s, { t, seed: x });
  // gulls
  g.strokeStyle = '#2a2230'; g.lineWidth = 2.5; g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const gx = 1150 + i * 77 % 500 + t * (16 + i * 2), gy = 760 + (i * 131 % 340) - t * (8 + i), fl = Math.sin(t * 7 + i * 2) * 7;
    g.beginPath(); g.moveTo(gx - 13, gy - fl); g.quadraticCurveTo(gx - 5, gy - 5, gx, gy); g.quadraticCurveTo(gx + 5, gy - 5, gx + 13, gy - fl); g.stroke();
  }
  // the statue, backlit
  g.fillStyle = '#060a12';
  ART.statue(g, 720, water + 16, 1.36, { flame: '#ffd27a' });
  glow(g, 720 - 76 * 1.36, water + 16 - 948 * 1.36, 130, [1, 0.78, 0.38], 0.8);
  glow(g, 720 - 76 * 1.36, water + 16 - 948 * 1.36, 36, [1, 0.95, 0.8], 1);
  // island trees
  for (let i = 0; i < 9; i++) ART.tree(g, 250 + i * 118 + (i * 53 % 40), water + 16, 0.55 + (i * 37 % 10) / 30, i);
  g.restore();
  S.post = { sun, rays: 0.5, rayc: [1, 0.82, 0.54], rayDens: 0.9, th: 0.8, bloom: 0.5, streak: 0.35, expo: 0.98, vig: 0.62, shadow: [0.44, 0.5, 0.6], high: [0.62, 0.54, 0.42] };
  TYPE.quote(S, 'Life, Liberty, and the Pursuit of Happiness.', 3.6, 8.2, { y: 968, size: 70, x: 1235 });
};
