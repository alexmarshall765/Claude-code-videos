/* =============================================================================
 *  ODE — scenes VII–IX: industry, acceleration, the connected world.
 *  The palette leaves gold for iron and soot, then electric blue.
 * ========================================================================== */
(() => {
  'use strict';
  const O = window.ODE;
  const { W, H, TAU, clamp, lerp, E, seg, win, rng, hash, n1, fbm, flicker, col, mix, mix2, lin, rad, camera, sky, glow, flare, beam, rays, motes,
    haze, stars, clouds, hills, ridgeY, poly, rect, rrect, circle, ellipse, line, limb, strokeP, sample, bez, column, archPath, figure, crowd, F, txt } = O;
  const S = O.shots, P = O.props;

  /** Small year stamp in the corner of the fast cuts. */
  const stamp = (c, s, a = 0.85, color = '#dfeeff') => txt(s, W - 96, H - 78, { size: 23, font: F.mono, weight: 500, align: 'right', color, a, track: 5 });

  /** Billowing smoke/steam: puffs born at (x, y), drifting along (vx, vy). */
  function smoke(c, x, y, t, { n = 26, vx = -160, vy = -60, life = 2.4, r0 = 12, r1 = 110, hex = '#e8dccc', alpha = 0.5, seed = 1, mode = 'source-over', rise = 0 } = {}) {
    const R = rng(seed);
    c.save(); c.globalCompositeOperation = mode;
    for (let i = 0; i < n; i++) {
      const ph = R(), jx = R() - 0.5, jy = R() - 0.5, u = ((t / life + ph) % 1 + 1) % 1;
      const px = x + vx * life * u + jx * 60 * u, py = y + vy * life * u + jy * 50 * u - rise * u * u, r = lerp(r0, r1, Math.pow(u, 0.7)) * (0.7 + R() * 0.6);
      const a = alpha * Math.pow(1 - u, 1.3) * clamp(u * 9);
      c.fillStyle = rad(px, py, 0, r, [[0, col(hex, a)], [0.55, col(hex, a * 0.55)], [1, col(hex, 0)]]);
      c.fillRect(px - r, py - r, r * 2, r * 2);
    }
    c.restore();
  }
  P.smoke = smoke;

  // ---------------------------------------------------------------------------
  // VII · INDUSTRY AND INVENTION
  // ---------------------------------------------------------------------------
  function wheel(c, x, y, r, a, color, spokes = 8, lw = 6) {
    c.strokeStyle = color; c.lineWidth = lw; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
    c.lineWidth = lw * 0.6;
    for (let i = 0; i < spokes; i++) { const an = a + i * TAU / spokes; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r); c.stroke(); }
    circle(x, y, r * 0.2, color);
  }
  /** Steam locomotive, heading right. (x, y) = rail under the front driving wheel. */
  function loco(c, x, y, s, t, color = '#120b08') {
    c.save(); c.translate(x, y); c.scale(s, s);
    const a = t * 9;
    c.fillStyle = color;
    c.beginPath(); c.roundRect(-250, -108, 270, 66, 30); c.fill(); // boiler
    c.fillRect(-330, -150, 96, 110); c.fillRect(-340, -160, 116, 14); // cab
    c.fillRect(-36, -150, 26, 50); poly([[-44, -150], [-2, -150], [6, -172], [-52, -172]], color); // stack
    c.beginPath(); c.arc(-130, -108, 18, Math.PI, 0); c.fill(); c.beginPath(); c.arc(-200, -108, 13, Math.PI, 0); c.fill(); // domes
    poly([[20, -46], [70, -6], [20, -6]], color); c.fillRect(-340, -46, 370, 16); // cowcatcher, frame
    c.fillStyle = 'rgba(255,170,80,0.85)'; c.fillRect(-316, -138, 34, 36); // cab window, firelit
    c.fillStyle = color;
    for (const wx of [-60, -150, -240]) wheel(c, wx, -32, 32, a, color, 8, 6);
    wheel(c, 0, -20, 20, a * 1.6, color, 6, 5); wheel(c, -306, -20, 20, a * 1.6, color, 6, 5);
    // coupling rod
    const cr = [Math.cos(a) * 18, Math.sin(a) * 18];
    c.strokeStyle = '#3a2a22'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(-240 + cr[0], -32 + cr[1]); c.lineTo(-60 + cr[0], -32 + cr[1]); c.stroke();
    c.beginPath(); c.moveTo(-60 + cr[0], -32 + cr[1]); c.lineTo(30, -50); c.stroke();
    // tender and carriages
    c.fillStyle = color; c.fillRect(-470, -124, 120, 84); wheel(c, -440, -22, 22, a * 1.5, color, 6, 5); wheel(c, -380, -22, 22, a * 1.5, color, 6, 5);
    for (let k = 0; k < 5; k++) {
      const cx0 = -820 - k * 330;
      c.fillStyle = color; c.beginPath(); c.roundRect(cx0, -150, 310, 110, [14, 14, 0, 0]); c.fill();
      c.fillStyle = 'rgba(255,200,120,0.75)'; for (let i = 0; i < 7; i++) c.fillRect(cx0 + 18 + i * 41, -128, 26, 34);
      wheel(c, cx0 + 50, -22, 22, a * 1.5, color, 6, 5); wheel(c, cx0 + 260, -22, 22, a * 1.5, color, 6, 5);
      c.fillStyle = color; c.fillRect(cx0 + 310, -60, 20, 8);
    }
    c.fillRect(-350, -60, 20, 8); c.fillRect(-490, -60, 20, 8);
    c.restore();
  }

  S.steam = (c, t, d, p, shot) => {
    const cut = shot.beat * 2;
    if (t < cut) {
      // A: the engine comes alive — flywheel, rod, a breath of steam
      const u = t / cut, L = camera(u, { z0: 1.08, z1: 1.16, fx: 900, fy: 420 });
      const a = t * t * 9 + t * 3;
      L(1, () => {
        c.fillStyle = '#0c0706'; c.fillRect(-300, -300, 2500, 1500);
        glow(240, 620, 900, '#ff6a1c', 0.55 * flicker(t, 3, 0.1)); glow(240, 640, 300, '#ffb04a', 0.6);
        const iron = '#1c1310', edge = 'rgba(255,150,70,0.6)';
        c.strokeStyle = '#0e0908'; c.lineWidth = 60; c.beginPath(); c.arc(1180, 440, 330, 0, TAU); c.stroke();
        c.strokeStyle = iron; c.lineWidth = 46; c.beginPath(); c.arc(1180, 440, 330, 0, TAU); c.stroke();
        c.strokeStyle = edge; c.lineWidth = 3; c.beginPath(); c.arc(1180, 440, 354, Math.PI * 0.55, Math.PI * 1.25); c.stroke();
        for (let i = 0; i < 6; i++) { const an = a + i * TAU / 6; c.strokeStyle = iron; c.lineWidth = 30; c.beginPath(); c.moveTo(1180, 440); c.lineTo(1180 + Math.cos(an) * 318, 440 + Math.sin(an) * 318); c.stroke(); }
        circle(1180, 440, 70, iron, edge, 3);
        const crank = [1180 + Math.cos(a) * 190, 440 + Math.sin(a) * 190], px = crank[0] - 560 - Math.sqrt(Math.max(0, 560 * 560 - Math.pow(crank[1] - 440, 2))) + 560;
        c.strokeStyle = '#3a2a22'; c.lineWidth = 34; c.lineCap = 'round'; c.beginPath(); c.moveTo(crank[0], crank[1]); c.lineTo(px - 430, 440); c.stroke();
        c.strokeStyle = edge; c.lineWidth = 2; c.beginPath(); c.moveTo(crank[0], crank[1] - 17); c.lineTo(px - 430, 423); c.stroke();
        circle(crank[0], crank[1], 30, '#4a362c'); rect(px - 760, 418, 340, 44, '#4a362c');
        rrect(-200, 340, 560, 200, 16, iron, edge, 2); rect(-200, 330, 580, 16, '#2a1c16');
      });
      smoke(c, 380, 420, t, { n: 34, vx: 170, vy: -230, life: 1.0, r0: 16, r1: 200, hex: '#e8c8a8', alpha: 0.3 * clamp(t * 3), seed: 4 });
      return;
    }
    // B: iron road, iron bridge
    const tb = t - cut, pb = tb / (d - cut);
    const L = camera(pb, { z0: 1.0, z1: 1.08, fx: 1000, fy: 420 });
    const sx = 1560, sy = 330;
    L(0, () => { sky([[0, '#2a2026'], [0.4, '#6a3a34'], [0.72, '#e0834a'], [1, '#ffcf84']]); glow(sx, sy, 800, '#ffc070', 0.75); glow(sx, sy, 160, '#fff2cf', 1); circle(sx, sy, 36, '#fff8e6'); });
    L(0.2, () => {
      clouds({ y: 130, amp: 90, n: 30, seed: 4, t, hex: '#1c1418', alpha: 0.55, r: 220, drift: 12 });
      // mill chimneys along the valley
      const R = rng(6);
      for (let i = 0; i < 9; i++) {
        const x = 80 + i * 210 + R() * 60, h = 120 + R() * 110;
        poly([[x - 9, 560], [x + 9, 560], [x + 6, 560 - h], [x - 6, 560 - h]], '#3a2228');
        smoke(c, x, 560 - h, t + i, { n: 12, vx: -46, vy: -30, life: 5, r0: 8, r1: 100, hex: '#2a1c22', alpha: 0.55, seed: 20 + i });
        rect(x - 60, 520, 120 + R() * 60, 60, '#3a2228');
      }
      hills(560, 30, 0.002, 4, lin(0, 520, 0, 700, [[0, '#4a2a2c'], [1, '#7a443a']]));
      haze(480, 680, '#ff9a5a', 0, 0.4);
    });
    const deck = 470;
    L(1, () => {
      // gorge walls and river
      c.fillStyle = lin(0, 640, 0, 804, [[0, '#f2a868'], [1, '#6a3a34']]); c.fillRect(-300, 700, 2500, 200);
      c.fillStyle = '#17100f';
      c.beginPath(); c.moveTo(-300, 900); c.lineTo(-300, deck + 6); c.lineTo(250, deck + 6); c.quadraticCurveTo(330, 640, 420, 900); c.fill();
      c.beginPath(); c.moveTo(2300, 900); c.lineTo(2300, deck + 6); c.lineTo(1700, deck + 6); c.quadraticCurveTo(1600, 640, 1520, 900); c.fill();
      // the train, its plume
      const x = lerp(520, 1440, E.sine(clamp(pb)) * 0.9 + pb * 0.1);
      smoke(c, x - 23 * 0.86, deck - 172 * 0.86, tb, { n: 44, vx: -380, vy: -70, life: 2.2, r0: 12, r1: 150, hex: '#f6dcc0', alpha: 0.62, seed: 3, rise: 60 });
      loco(c, x, deck, 0.86, t);
      // the iron arch
      const iron = '#17100f';
      c.strokeStyle = iron; c.lineCap = 'butt';
      c.lineWidth = 16; c.beginPath(); c.moveTo(-300, deck + 6); c.lineTo(2300, deck + 6); c.stroke();
      const arch = xx => 790 - 300 * (1 - Math.pow((xx - 975) / 735, 2));
      c.lineWidth = 15; c.beginPath(); for (let xx = 240; xx <= 1710; xx += 10) { const yy = arch(xx); xx === 240 ? c.moveTo(xx, yy) : c.lineTo(xx, yy); } c.stroke();
      c.lineWidth = 9; c.beginPath(); for (let xx = 240; xx <= 1710; xx += 10) { const yy = arch(xx) + 34; xx === 240 ? c.moveTo(xx, yy) : c.lineTo(xx, yy); } c.stroke();
      c.lineWidth = 5;
      for (let xx = 270; xx <= 1690; xx += 58) { const yy = arch(xx); c.beginPath(); c.moveTo(xx, deck + 12); c.lineTo(xx, yy + 34); c.moveTo(xx, deck + 12); c.lineTo(xx + 58, Math.max(deck + 12, arch(xx + 58))); c.moveTo(xx, yy); c.lineTo(xx + 58, arch(xx + 58) + 34); c.stroke(); }
      c.strokeStyle = 'rgba(255,170,90,0.45)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-300, deck - 3); c.lineTo(2300, deck - 3); c.stroke();
      // sun glinting on the river
      const R = rng(2);
      for (let i = 0; i < 40; i++) { const gx = 500 + R() * 1000, gy = 730 + R() * 60; glow(gx, gy, 14 + R() * 20, '#ffd9a0', 0.5 * n1(t * 4 + i, 3)); }
    });
    flare(sx, sy, 1400, '#ffcf9a', 0.3, 4);
    motes({ n: 70, seed: 3, t, hex: '#ffcf9a', alpha: 0.55, speed: 2.4 });
  };

  /** Edison's lamp: pear-shaped glass, horseshoe filament. k = brightness 0..1. */
  P.bulb = (c, x, y, s, k, t = 0) => {
    c.save(); c.translate(x, y); c.scale(s, s);
    const glass = () => { c.beginPath(); c.moveTo(-34, 150); c.bezierCurveTo(-40, 90, -128, 60, -128, -30); c.arc(0, -30, 128, Math.PI, 0); c.bezierCurveTo(128, 60, 40, 90, 34, 150); c.closePath(); };
    glow(0, -20, 760 * k, '#ff9a3a', 0.5 * k); glow(0, -20, 300 * k, '#ffd98a', 0.75 * k);
    glass(); c.fillStyle = rad(0, -30, 0, 190, [[0, col('#fff2c0', 0.5 * k)], [0.6, col('#ffb04a', 0.2 * k)], [1, 'rgba(120,140,160,0.08)']]); c.fill();
    c.strokeStyle = col('#cfe0ee', 0.5 + 0.3 * k); c.lineWidth = 2.5; glass(); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.arc(0, -30, 104, Math.PI * 1.1, Math.PI * 1.4); c.stroke();
    // stem, lead wires, filament
    c.strokeStyle = 'rgba(200,220,235,0.45)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-14, 150); c.lineTo(-10, 50); c.lineTo(10, 50); c.lineTo(14, 150); c.stroke();
    c.strokeStyle = '#8a8f96'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-9, 120); c.lineTo(-26, 30); c.moveTo(9, 120); c.lineTo(26, 30); c.stroke();
    const fil = mix('#3a2a1a', '#fff6d8', clamp(k * 1.2));
    c.save(); if (k > 0.05) { c.shadowColor = col('#ffb44a', k); c.shadowBlur = O.blurPx(30 * k * s); }
    c.strokeStyle = fil; c.lineWidth = 4 + 2 * k;
    c.beginPath(); c.moveTo(-26, 30); c.bezierCurveTo(-56, -120, 56, -120, 26, 30); c.stroke();
    c.restore();
    // brass base
    c.fillStyle = lin(-40, 0, 40, 0, [[0, '#5a4418'], [0.4, '#e2bd62'], [1, '#3a2a0e']]);
    c.beginPath(); c.roundRect(-38, 148, 76, 78, 6); c.fill();
    c.strokeStyle = 'rgba(40,26,8,0.7)'; c.lineWidth = 3; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-38, 164 + i * 15); c.lineTo(38, 172 + i * 15); c.stroke(); }
    c.fillStyle = '#2a1c0c'; c.fillRect(-20, 226, 40, 16);
    c.restore();
  };

  S.bulb = (c, t, d, p) => {
    const L = camera(p, { z0: 1.0, z1: 1.12, fx: 960, fy: 380 });
    // it stutters, then holds
    const st = t < 0.55 ? 0 : t < 1.9 ? (n1(t * 21, 5) > 0.5 - (t - 0.55) * 0.3 ? 0.35 + 0.5 * n1(t * 40, 9) : 0.04) : 1;
    const k = clamp(st * seg(t, 0.5, 2.4, E.out) * (t > 1.9 ? 0.86 + 0.14 * n1(t * 14, 2) : 1));
    const ghost = 1 - seg(t, 0.15, 0.95);
    L(0.5, () => {
      c.fillStyle = '#050607'; c.fillRect(-300, -300, 2500, 1500);
      c.fillStyle = rad(960, 370, 60, 1150, [[0, col('#6a4420', k)], [0.45, col('#2a1a0e', k)], [1, col('#050607', k)]]); c.fillRect(-300, -300, 2500, 1500);
      // Menlo Park: shelves of jars, the bench
      const R = rng(4);
      for (let s = 0; s < 3; s++) { rect(-200, 130 + s * 150, 760, 10, col('#6a4a26', 0.5 * k)); rect(1360, 130 + s * 150, 800, 10, col('#6a4a26', 0.5 * k)); for (let i = 0; i < 22; i++) { const x = (i < 11 ? -120 + i * 60 : 700 + i * 62), h = 40 + R() * 60; c.fillStyle = col(['#7a8a6a', '#8a6a3a', '#5a7a8a'][i % 3], 0.4 * k); c.beginPath(); c.roundRect(x, 130 + s * 150 - h, 34, h, 6); c.fill(); } }
    });
    L(1, () => {
      rect(-300, 640, 2500, 300, col('#1c120a', 0.6 + 0.4 * k)); c.fillStyle = col('#ffb45a', 0.35 * k); c.fillRect(-300, 640, 2500, 3);
      // stand
      rect(946, 590, 28, 54, '#2a1c0c'); rrect(880, 632, 160, 16, 6, '#3a2a12');
      if (ghost > 0) { c.save(); c.globalAlpha = ghost; P.candle(c, 960, 360, 1.5, t, { seed: 3, glowR: 420 }); c.restore(); }
      c.save(); c.globalAlpha = 1 - ghost * 0.9; P.bulb(c, 960, 360, 1.0, k, t); c.restore();
      // the watchers, found by the new light
      figure(480, 800, 520, { face: 1, fill: '#060504', rim: col('#ffb45a', 0.9 * k), light: 1, robe: false, bend: 0.14, armF: [0.5, 1.7], armB: [0.2, 0.3], stride: 0.2 });
      figure(1500, 800, 500, { face: -1, fill: '#060504', rim: col('#ffb45a', 0.9 * k), light: -1, robe: false, bend: 0.1, armF: [0.3, 0.3], armB: [0.2, 0.3], stride: 0.2, head: 'beard' });
      glow(960, 660, 520 * k, '#ffb45a', 0.22 * k);
    });
    flare(960, 340, 1500 * k, '#ffd9a0', 0.45 * k, 4);
    motes({ n: 60, seed: 5, t, hex: '#ffd89a', alpha: 0.7 * k, mask: (x, y) => clamp(1.3 - Math.hypot(x - 960, y - 340) / 520) });
    stamp(c, '1879', 0.8 * k, '#ffe2b0');
  };

  S.telegraph = (c, t, d, p) => {
    const L = camera(p, { z0: 1.0, z1: 1.1, fx: 1480, fy: 470 });
    const vp = [1480, 478];
    L(0, () => { sky([[0, '#0e1a34'], [0.45, '#27456a'], [0.72, '#c8785a'], [0.86, '#f6b46a'], [1, '#ffd590']]); stars({ n: 110, seed: 6, t, alpha: 0.7, h: 320 }); glow(vp[0], vp[1] + 20, 760, '#ffb060', 0.6); });
    L(0.2, () => { clouds({ y: 300, amp: 50, n: 16, seed: 3, t, hex: '#ff9a6a', alpha: 0.22, r: 170, drift: 3, mode: 'lighter' }); hills(500, 18, 0.0018, 4, '#3a3350'); });
    L(1, () => {
      c.fillStyle = lin(0, 480, 0, 804, [[0, '#4a3540'], [0.3, '#241c2a'], [1, '#0a0810']]); c.fillRect(-300, 486, 2500, 400);
      // rails converging
      c.strokeStyle = '#c9a07a'; c.lineWidth = 5; c.beginPath(); c.moveTo(vp[0], vp[1] + 8); c.lineTo(240, 860); c.moveTo(vp[0], vp[1] + 8); c.lineTo(760, 860); c.stroke();
      c.strokeStyle = 'rgba(20,14,18,0.9)';
      for (let i = 1; i < 26; i++) { const u = Math.pow(i / 26, 2.6), y = lerp(vp[1] + 8, 860, u), xa = lerp(vp[0], 170, u), xb = lerp(vp[0], 830, u); c.lineWidth = 1 + u * 16; c.beginPath(); c.moveTo(xa, y); c.lineTo(xb, y); c.stroke(); }
      // the poles, the singing wires
      const pole = i => { const z = 1 + i * 0.85; return { x: vp[0] + (980 - vp[0]) / z + (1140 - 980) * 0, y: vp[1] + (800 - vp[1]) / z, h: 640 / z, z }; };
      const N = 12, poles = Array.from({ length: N }, (_, i) => pole(i)).map(q => ({ ...q, x: vp[0] + (1060 - vp[0]) / q.z }));
      const hum = (i, w) => Math.sin(t * 60 + i * 2 + w) * 1.6;
      for (let i = N - 1; i >= 0; i--) {
        const q = poles[i], lw = Math.max(1.2, 16 / q.z), arm = 130 / q.z;
        c.strokeStyle = '#0c0a10'; c.lineCap = 'butt'; c.lineWidth = lw; c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x, q.y - q.h); c.stroke();
        for (const ky of [0.9, 0.78]) { c.lineWidth = lw * 0.7; c.beginPath(); c.moveTo(q.x - arm, q.y - q.h * ky); c.lineTo(q.x + arm, q.y - q.h * ky); c.stroke(); }
        if (i < N - 1) {
          const n = poles[i + 1];
          for (let w = 0; w < 4; w++) {
            const ky = w < 2 ? 0.9 : 0.78, sgn = w % 2 ? 1 : -1, a0 = [q.x + sgn * arm * 0.9, q.y - q.h * ky], a1 = [n.x + sgn * (130 / n.z) * 0.9, n.y - n.h * ky];
            const sag = 60 / q.z + hum(i, w) / q.z, ctl = [(a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2 + sag];
            c.strokeStyle = 'rgba(12,10,16,0.95)'; c.lineWidth = Math.max(0.8, 2.6 / q.z); c.beginPath(); c.moveTo(a0[0], a0[1]); c.quadraticCurveTo(ctl[0], ctl[1], a1[0], a1[1]); c.stroke();
            // Morse on the line: dots and dashes of light running to the horizon
            const code = [1, 0, 1, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0];
            for (let m = 0; m < 5; m++) {
              const pos = (t * 2.3 + m * 0.83 + w * 0.37) % 4.2 - 0.1, seg0 = pos * 3 - i;
              if (seg0 < 0 || seg0 > 1) continue;
              if (!code[(m * 3 + w * 5 + Math.floor(t * 2.3 + m)) % code.length]) continue;
              const u = seg0, bx = (1 - u) * (1 - u) * a0[0] + 2 * u * (1 - u) * ctl[0] + u * u * a1[0], by = (1 - u) * (1 - u) * a0[1] + 2 * u * (1 - u) * ctl[1] + u * u * a1[1];
              glow(bx, by, 40 / q.z + 6, '#bfe6ff', 0.95); circle(bx, by, Math.max(1.2, 4 / q.z), '#ffffff');
            }
          }
        }
      }
      // the operator's hut
      rect(1210, 640, 120, 74, '#0c0a10'); poly([[1200, 640], [1270, 600], [1340, 640]], '#0c0a10'); rect(1250, 664, 26, 24, '#ffc46a'); glow(1263, 676, 60, '#ffb04a', 0.6 * flicker(t, 2, 0.1));
    });
    flare(vp[0], vp[1] + 6, 1300, '#ffc890', 0.25, 3);
    stamp(c, '1844', 0.8);
  };

  /** Wright Flyer, three-quarter view, nose to the right. */
  P.flyer = (c, x, y, s, t, tilt = 0) => {
    c.save(); c.translate(x, y); c.rotate(tilt); c.scale(s, s);
    const dk = '#150e0a', cloth = 'rgba(246,230,196,0.82)';
    const wing = (yy) => { c.fillStyle = cloth; c.beginPath(); c.moveTo(-250, yy); c.lineTo(210, yy - 26); c.lineTo(250, yy - 14); c.lineTo(-210, yy + 14); c.closePath(); c.fill(); c.strokeStyle = dk; c.lineWidth = 3; c.stroke(); };
    // rudders (aft), skids
    c.strokeStyle = dk; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(-120, -40); c.lineTo(-330, -64); c.moveTo(-120, 34); c.lineTo(-330, -6); c.stroke();
    c.fillStyle = cloth; for (const o of [0, 14]) { c.beginPath(); c.moveTo(-340 + o, -84); c.lineTo(-300 + o, -88); c.lineTo(-300 + o, 0); c.lineTo(-340 + o, 4); c.closePath(); c.fill(); c.stroke(); }
    c.beginPath(); c.moveTo(-180, 60); c.lineTo(190, 46); c.quadraticCurveTo(260, 30, 300, -20); c.moveTo(-150, 70); c.lineTo(220, 56); c.quadraticCurveTo(290, 40, 330, -10); c.stroke();
    // lower wing, struts, pilot, upper wing
    wing(30);
    c.strokeStyle = dk; c.lineWidth = 2.6;
    for (let i = 0; i < 9; i++) { const u = i / 8, x0 = lerp(-230, 230, u), y0 = lerp(36, 12, u); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0, y0 - 76); c.stroke(); if (i < 8) { c.lineWidth = 1; c.beginPath(); c.moveTo(x0, y0); c.lineTo(lerp(-230, 230, (i + 1) / 8), lerp(36, 12, (i + 1) / 8) - 76); c.stroke(); c.lineWidth = 2.6; } }
    c.fillStyle = dk; c.beginPath(); c.ellipse(10, 14, 46, 9, -0.06, 0, TAU); c.fill(); c.beginPath(); c.arc(56, 6, 10, 0, TAU); c.fill(); // Orville, prone
    rect(-50, 2, 40, 22, dk); // engine
    wing(-46);
    // canard (forward elevator)
    c.fillStyle = cloth; for (const yy of [-34, 2]) { c.beginPath(); c.moveTo(290, yy); c.lineTo(390, yy - 8); c.lineTo(404, yy); c.lineTo(304, yy + 8); c.closePath(); c.fill(); c.strokeStyle = dk; c.lineWidth = 2; c.stroke(); }
    c.beginPath(); c.moveTo(346, -36); c.lineTo(346, 4); c.moveTo(210, -60); c.lineTo(330, -36); c.moveTo(220, 30); c.lineTo(340, 4); c.stroke();
    // propellers, a blur
    for (const px of [-96, -40]) { c.fillStyle = 'rgba(30,20,14,0.28)'; c.beginPath(); c.ellipse(px - 60, -6, 9, 56, 0.05, 0, TAU); c.fill(); const a = t * 40 + px; c.strokeStyle = dk; c.lineWidth = 3; c.beginPath(); c.moveTo(px - 60 + Math.cos(a) * 4, -6 + Math.sin(a) * 54); c.lineTo(px - 60 - Math.cos(a) * 4, -6 - Math.sin(a) * 54); c.stroke(); }
    c.restore();
  };

  S.flyer = (c, t, d, p) => {
    const L = camera(p, { z0: 1.0, z1: 1.08, fx: 1100, fy: 400, dy: 24 });
    const sx = 1500, sy = 500;
    L(0, () => { sky([[0, '#7f97b0'], [0.4, '#c9c4b8'], [0.72, '#ffd9a0'], [1, '#fff0cc']]); glow(sx, sy, 900, '#fff0c8', 0.85); glow(sx, sy, 190, '#ffffff', 1); circle(sx, sy, 40, '#fffdf4'); });
    L(0.15, () => { clouds({ y: 200, amp: 100, n: 22, seed: 7, t, hex: '#fff6e4', alpha: 0.4, r: 210, drift: 9 }); P.birds(c, 500 + t * 20, 260, 6, t, 'rgba(50,40,40,0.7)', 5, 200, 9); });
    L(0.35, () => { rect(-300, 520, 2500, 60, '#8fa3a8'); c.fillStyle = 'rgba(255,240,200,0.5)'; c.fillRect(1100, 522, 800, 4); haze(480, 600, '#ffe6b8', 0.5, 0); });
    L(0.6, () => { hills(590, 34, 0.0014, 9, lin(0, 540, 0, 760, [[0, '#e8d2a0'], [1, '#b89a6a']])); rays(sx, sy, { n: 18, a0: Math.PI, a1: TAU, len: 1500, hex: '#fff0c8', alpha: 0.12, t, seed: 3, width: 0.5 }); });
    const lift = E.io(clamp((p - 0.2) / 0.75)), x = lerp(520, 1180, E.sine(clamp(p * 1.05))), y = 560 - lift * 170;
    L(1, () => {
      hills(650, 22, 0.002, 14, lin(0, 620, 0, 804, [[0, '#d9c08a'], [1, '#8a704a']]), { oct: 2 });
      // the launching rail
      line(200, 646, 1060, 632, '#3a2a1c', 6); for (let i = 0; i < 10; i++) rect(240 + i * 86, 644 - i * 1.4, 26, 10, '#3a2a1c');
      // shadow, machine
      c.fillStyle = `rgba(60,40,20,${0.35 - lift * 0.2})`; c.beginPath(); c.ellipse(x + lift * 60, 648, 240 - lift * 40, 12, 0, 0, TAU); c.fill();
      P.flyer(c, x, y, 0.92, t, -0.04 - lift * 0.07 + Math.sin(t * 3) * 0.012);
      // Wilbur, who ran alongside
      const wx = lerp(360, 760, clamp(p * 1.15));
      figure(wx, 652, 150, { face: 1, fill: '#1a120c', robe: false, head: 'cap', lean: 0.14, stride: Math.sin(t * 11), armF: [0.9 * Math.sin(t * 11) + 0.4, 0.9], armB: [-0.9 * Math.sin(t * 11) + 0.2, 0.9] });
      // dune grass, sand lifted by the props
      const R = rng(8); c.strokeStyle = '#4a3a22'; c.lineWidth = 2;
      for (let i = 0; i < 70; i++) { const gx = R() * 2200 - 100, gy = 690 + R() * 90, gh = 18 + R() * 30, sw = Math.sin(t * 3 + i) * 6; c.beginPath(); c.moveTo(gx, gy); c.quadraticCurveTo(gx + sw, gy - gh * 0.6, gx + sw * 2 + 4, gy - gh); c.stroke(); }
      smoke(c, x - 200, y + 40, t, { n: 16, vx: -260, vy: 10, life: 0.9, r0: 8, r1: 70, hex: '#f0dcae', alpha: 0.35, seed: 2 });
    });
    flare(sx, sy, 1500, '#fff0d0', 0.3, 4);
    motes({ n: 80, seed: 9, t, hex: '#fff4d6', alpha: 0.6, speed: 3 });
    stamp(c, '1903', 0.8, '#5a4630');
  };

  // ---------------------------------------------------------------------------
  // VIII · ACCELERATION
  // ---------------------------------------------------------------------------
  S.radio = (c, t, d, p) => {
    const L = camera(p, { z0: 1.0, z1: 1.1, fx: 1000, fy: 300 });
    const mast = (x, yb, h, w, color) => {
      c.strokeStyle = color; c.lineWidth = Math.max(1.5, w * 0.06); c.lineCap = 'round';
      c.beginPath(); c.moveTo(x - w / 2, yb); c.lineTo(x - 2, yb - h); c.moveTo(x + w / 2, yb); c.lineTo(x + 2, yb - h); c.stroke();
      c.lineWidth = Math.max(1, w * 0.03);
      const n = 16; for (let i = 0; i < n; i++) { const u0 = i / n, u1 = (i + 1) / n, w0 = w / 2 * (1 - u0) + 2 * u0, w1 = w / 2 * (1 - u1) + 2 * u1, y0 = yb - h * u0, y1 = yb - h * u1; c.beginPath(); c.moveTo(x - w0, y0); c.lineTo(x + w1, y1); c.moveTo(x + w0, y0); c.lineTo(x - w1, y1); c.moveTo(x - w0, y0); c.lineTo(x + w0, y0); c.stroke(); }
      c.lineWidth = 1; c.globalAlpha = 0.6; for (const k of [0.5, 0.85]) { c.beginPath(); c.moveTo(x, yb - h * k); c.lineTo(x - h * 0.4, yb + 6); c.moveTo(x, yb - h * k); c.lineTo(x + h * 0.4, yb + 6); c.stroke(); } c.globalAlpha = 1;
    };
    L(0, () => { sky([[0, '#04121e'], [0.5, '#0b3446'], [0.8, '#2a6f7a'], [0.92, '#e09a5a'], [1, '#ffd08a']]); stars({ n: 200, seed: 3, t, alpha: 0.9, h: 480 }); });
    L(0.3, () => hills(640, 30, 0.0016, 5, '#0a2430'));
    L(1, () => {
      hills(690, 36, 0.0012, 9, '#04121a', { oct: 2 });
      mast(1000, 690, 540, 110, '#04121a'); mast(520, 700, 360, 76, '#04121a'); mast(1500, 704, 320, 70, '#04121a');
      // houses listening in the valley
      const R = rng(3);
      for (let i = 0; i < 16; i++) { const x = 60 + i * 124 + R() * 40, y = 744 + R() * 30; rect(x, y - 26, 40, 30, '#020a10'); poly([[x - 5, y - 26], [x + 20, y - 44], [x + 45, y - 26]], '#020a10'); rect(x + 14, y - 18, 9, 10, '#ffd27a'); glow(x + 18, y - 13, 24, '#ffb84a', 0.6); }
      // the signal
      const tx = 1000, ty = 150;
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 9; k++) {
        const u = ((t * 0.7 + k / 9) % 1), r = 30 + u * 1300, a = 0.75 * Math.pow(1 - u, 1.4);
        c.strokeStyle = col('#7fe0ff', a); c.lineWidth = 2 + 4 * (1 - u);
        c.beginPath(); c.arc(tx, ty, r, Math.PI * 1.02, Math.PI * 1.98); c.stroke();
        c.strokeStyle = col('#7fe0ff', a * 0.45); c.beginPath(); c.arc(tx, ty, r, Math.PI * 0.05, Math.PI * 0.95); c.stroke();
      }
      c.restore();
      const bl = 0.5 + 0.5 * Math.sin(t * 9);
      glow(tx, ty, 130, '#bff0ff', 0.9); glow(tx, ty, 26, '#ff4a3a', bl); circle(tx, ty, 5, '#ffffff');
    });
    flare(1000, 150, 1100, '#9fe6ff', 0.4, 3);
    stamp(c, '1901');
  };

  S.penicillin = (c, t, d, p) => {
    const L = camera(p, { z0: 1.0, z1: 1.12, fx: 900, fy: 380 });
    const focus = (1 - seg(t, 0, 0.7, E.out)) * 9;
    c.fillStyle = '#020507'; c.fillRect(0, 0, W, H);
    const cx = 960, cy = 402, r = 372;
    c.save(); c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.clip();
    c.save(); if (focus > 0.3) c.filter = `blur(${O.blurPx(focus)}px)`;
    L(1, () => {
      c.fillStyle = rad(cx - 80, cy - 60, 40, 560, [[0, '#d6efe6'], [0.6, '#9fd0c6'], [1, '#4a8f90']]); c.fillRect(0, -200, W, 1300);
      // the plate: staphylococci everywhere, except near the mould
      const mx = 720, my = 290, R = rng(28);
      for (let i = 0; i < 520; i++) {
        const x = cx + (R() - 0.5) * 1000, y = cy + (R() - 0.5) * 900, dd = Math.hypot(x - mx, y - my), s = 5 + R() * 9;
        if (dd < 260) continue;
        const k = clamp((dd - 260) / 150);
        c.fillStyle = col('#f7f1cf', 0.25 + 0.7 * k); c.beginPath(); c.arc(x, y, s * (0.4 + 0.6 * k), 0, TAU); c.fill();
        c.strokeStyle = col('#8fae96', 0.5 * k); c.lineWidth = 1; c.stroke();
      }
      // Penicillium notatum
      for (let i = 0; i < 90; i++) { const a = R() * TAU, rr = R() * 150; glow(mx + Math.cos(a) * rr, my + Math.sin(a) * rr * 0.9, 30 + R() * 50, i % 3 ? '#f4fbf4' : '#9fd6c0', 0.35, 'source-over'); }
      glow(mx, my, 120, '#5aa890', 0.6, 'source-over'); glow(mx, my, 60, '#3a8a7a', 0.6, 'source-over');
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1.5; c.setLineDash([6, 10]); c.beginPath(); c.arc(mx, my, 258 + Math.sin(t * 3) * 3, 0, TAU); c.stroke(); c.setLineDash([]);
    });
    c.restore();
    // reticle
    c.strokeStyle = 'rgba(10,30,40,0.5)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(cx - r, cy); c.lineTo(cx + r, cy); c.moveTo(cx, cy - r); c.lineTo(cx, cy + r); c.stroke();
    for (let i = -8; i <= 8; i++) { c.beginPath(); c.moveTo(cx + i * 40, cy - 6); c.lineTo(cx + i * 40, cy + 6); c.stroke(); }
    c.fillStyle = rad(cx, cy, r * 0.6, r, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,10,16,0.75)']]); c.fillRect(cx - r, cy - r, r * 2, r * 2);
    c.restore();
    c.strokeStyle = '#1c3038'; c.lineWidth = 14; c.beginPath(); c.arc(cx, cy, r + 6, 0, TAU); c.stroke();
    c.strokeStyle = 'rgba(160,220,235,0.5)'; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, r - 2, 0, TAU); c.stroke();
    glow(cx - 200, cy - 200, 600, '#bfeee6', 0.12);
    stamp(c, '1928');
  };

  /** Saturn V-like stack. (x, y) = base of the first stage. */
  P.rocket = (c, x, y, s) => {
    c.save(); c.translate(x, y); c.scale(s, s);
    const body = lin(-26, 0, 26, 0, [[0, '#7f8894'], [0.35, '#ffffff'], [0.7, '#d9dee6'], [1, '#5a626e']]);
    c.fillStyle = body; c.fillRect(-26, -230, 52, 230);
    c.beginPath(); c.moveTo(-26, -230); c.lineTo(-17, -262); c.lineTo(17, -262); c.lineTo(26, -230); c.fill();
    c.fillRect(-17, -330, 34, 68);
    c.beginPath(); c.moveTo(-17, -330); c.lineTo(-10, -352); c.lineTo(10, -352); c.lineTo(17, -330); c.fill();
    c.fillRect(-10, -380, 20, 28); c.beginPath(); c.moveTo(-10, -380); c.lineTo(0, -404); c.lineTo(10, -380); c.fill();
    c.strokeStyle = '#c9ced6'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -404); c.lineTo(0, -440); c.stroke();
    c.fillStyle = '#12161c'; c.fillRect(-26, -64, 52, 12); c.fillRect(-26, -232, 52, 9); c.fillRect(-17, -300, 34, 7); c.fillRect(-26, -150, 13, 60); c.fillRect(13, -150, 13, 60);
    poly([[-26, -40], [-48, 4], [-26, 0]], '#aab2bd'); poly([[26, -40], [48, 4], [26, 0]], '#6a727e');
    for (const ex of [-17, 0, 17]) poly([[ex - 6, 0], [ex + 6, 0], [ex + 9, 16], [ex - 9, 16]], '#2a2e36');
    c.restore();
  };

  S.rocket = (c, t, d, p) => {
    const sh = [(n1(t * 37, 1) - 0.5) * 9, (n1(t * 41, 2) - 0.5) * 9];
    c.save(); c.translate(sh[0], sh[1]);
    const L = camera(p, { z0: 1.04, z1: 1.12, fx: 960, fy: 480 });
    const up = Math.pow(clamp(p), 2.1) * 520, rx = 1010, ry = 640 - up;
    L(0, () => { sky([[0, '#030a18'], [0.5, '#0c2440'], [0.85, '#27506e'], [1, '#6f8a96']]); stars({ n: 160, seed: 2, t, alpha: 0.8, h: 420 }); });
    L(1, () => {
      glow(rx, 700, 1200, '#ff8a2a', 0.5);
      // umbilical tower
      c.strokeStyle = '#3a1c18'; c.lineWidth = 7; c.beginPath(); c.moveTo(770, 700); c.lineTo(770, 120); c.moveTo(850, 700); c.lineTo(850, 120); c.stroke();
      c.lineWidth = 3; for (let i = 0; i < 14; i++) { const y = 700 - i * 42; c.beginPath(); c.moveTo(770, y); c.lineTo(850, y - 42); c.moveTo(850, y); c.lineTo(770, y - 42); c.moveTo(770, y); c.lineTo(850, y); c.stroke(); }
      for (let i = 0; i < 5; i++) rect(850, 210 + i * 96, 70 - Math.min(60, up * 0.5), 9, '#3a1c18');
      c.strokeStyle = 'rgba(255,150,80,0.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(853, 700); c.lineTo(853, 120); c.stroke();
      // fire
      const fl = flicker(t, 3, 0.2), len = 300 + up * 0.9;
      c.save(); c.globalCompositeOperation = 'lighter';
      c.fillStyle = lin(0, ry, 0, ry + len, [[0, 'rgba(255,255,240,1)'], [0.25, 'rgba(255,220,130,0.95)'], [0.6, 'rgba(255,130,40,0.7)'], [1, 'rgba(255,80,20,0)']]);
      c.beginPath(); c.moveTo(rx - 22, ry + 8); c.quadraticCurveTo(rx - 70 * fl, ry + len * 0.5, rx + (n1(t * 20, 6) - 0.5) * 40, ry + len); c.quadraticCurveTo(rx + 70 * fl, ry + len * 0.5, rx + 22, ry + 8); c.fill();
      c.restore();
      glow(rx, ry + 40, 420, '#ffd9a0', 0.95); glow(rx, ry + 30, 120, '#ffffff', 1);
      P.rocket(c, rx, ry, 1.15);
      // exhaust rolling across the pad
      smoke(c, rx, 716, t, { n: 46, vx: 520, vy: -40, life: 1.6, r0: 40, r1: 300, hex: '#ffc890', alpha: 0.6, seed: 5, rise: 90 });
      smoke(c, rx, 716, t, { n: 46, vx: -520, vy: -40, life: 1.6, r0: 40, r1: 300, hex: '#f6b47a', alpha: 0.6, seed: 9, rise: 90 });
      smoke(c, rx, 730, t, { n: 30, vx: 0, vy: -70, life: 1.2, r0: 60, r1: 260, hex: '#fff0d0', alpha: 0.5, seed: 12, mode: 'lighter' });
      rect(-300, 730, 2500, 200, '#06080c');
    });
    flare(rx, ry + 40, 1700, '#ffd9b0', 0.5, 5);
    c.restore();
    stamp(c, '1969');
  };

  S.footprint = (c, t, d, p) => {
    const L = camera(p, { z0: 1.0, z1: 1.1, fx: 800, fy: 520 });
    L(0, () => { c.fillStyle = '#000'; c.fillRect(-300, -300, 2500, 1500); stars({ n: 260, seed: 5, t, alpha: 0.9, h: 420 }); });
    L(0.3, () => {
      // the Earth, half lit
      const ex = 1440, ey = 150, er = 78;
      glow(ex, ey, 260, '#5aa0ff', 0.35);
      c.save(); c.beginPath(); c.arc(ex, ey, er, 0, TAU); c.clip();
      c.fillStyle = rad(ex - 26, ey - 26, 0, er * 1.5, [[0, '#9fd0ff'], [0.5, '#2a6fd6'], [1, '#0a2a6a']]); c.fillRect(ex - er, ey - er, er * 2, er * 2);
      for (let i = 0; i < 12; i++) glow(ex + (hash(i, 3) - 0.5) * 130, ey + (hash(i, 4) - 0.5) * 130, 20 + hash(i, 5) * 34, '#ffffff', 0.5, 'source-over');
      c.fillStyle = 'rgba(0,0,0,0.92)'; c.beginPath(); c.ellipse(ex + 46, ey + 10, er * 1.05, er * 1.3, 0.3, 0, TAU); c.fill();
      c.restore();
    });
    L(1, () => {
      // regolith to a near horizon
      c.fillStyle = lin(0, 300, 0, 804, [[0, '#8a8a8c'], [0.3, '#6a6a6e'], [1, '#2c2c30']]);
      c.beginPath(); c.moveTo(-300, 900); c.lineTo(-300, 330); c.quadraticCurveTo(960, 268, 2300, 340); c.lineTo(2300, 900); c.fill();
      const R = rng(14);
      for (let i = 0; i < 700; i++) { const u = Math.pow(R(), 0.7), y = lerp(320, 820, u), x = R() * 2400 - 240, s = (0.6 + R() * 2.4) * (0.4 + u * 2); c.fillStyle = `rgba(20,20,24,${0.25 + R() * 0.3})`; c.beginPath(); c.ellipse(x + s, y + s * 0.3, s * 1.4, s * 0.6, 0, 0, TAU); c.fill(); c.fillStyle = `rgba(220,220,225,${0.2 + R() * 0.4})`; c.beginPath(); c.ellipse(x, y, s, s * 0.5, 0, 0, TAU); c.fill(); }
      for (let i = 0; i < 9; i++) { const x = R() * 2000, y = 360 + R() * 140, s = 14 + R() * 30; c.fillStyle = 'rgba(20,20,24,0.5)'; c.beginPath(); c.ellipse(x, y, s, s * 0.3, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(220,220,225,0.4)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(x, y, s, s * 0.3, 0, 0.2, Math.PI - 0.2); c.stroke(); }
      // the bootprint
      c.save(); c.translate(820, 560); c.rotate(-0.28); c.scale(1, 0.56);
      const sole = () => { c.beginPath(); c.moveTo(-260, -70); c.bezierCurveTo(-320, -74, -350, 70, -250, 78); c.lineTo(190, 100); c.bezierCurveTo(340, 110, 360, -110, 200, -104); c.closePath(); };
      sole(); c.fillStyle = '#3a3a3e'; c.fill();
      c.save(); sole(); c.clip();
      for (let i = 0; i < 13; i++) { const x = -300 + i * 50; c.fillStyle = '#17171a'; c.fillRect(x, -130, 22, 260); c.fillStyle = 'rgba(235,235,240,0.75)'; c.fillRect(x + 22, -130, 5, 260); }
      c.fillStyle = lin(-340, 0, 340, 0, [[0, 'rgba(0,0,0,0.6)'], [0.3, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(-360, -140, 720, 280);
      c.restore();
      c.strokeStyle = 'rgba(240,240,245,0.8)'; c.lineWidth = 5; c.beginPath(); c.moveTo(200, -104); c.bezierCurveTo(360, -110, 340, 110, 190, 100); c.stroke();
      c.strokeStyle = 'rgba(10,10,12,0.8)'; c.lineWidth = 6; c.beginPath(); c.moveTo(-250, 78); c.bezierCurveTo(-350, 70, -320, -74, -260, -70); c.stroke();
      c.restore();
      // long shadow of the lander's leg
      c.fillStyle = 'rgba(0,0,0,0.55)'; poly([[1500, 804], [1900, 804], [1300, 420], [1270, 430]], c.fillStyle);
    });
    glow(-100, 500, 900, '#ffffff', 0.12);
    stamp(c, '1969');
  };

  /** Room-sized computer, drawn in a 1920×804 frame. */
  function mainframe(c, t) {
    c.fillStyle = lin(0, 0, 0, 804, [[0, '#0c1a2a'], [1, '#04080e']]); c.fillRect(0, 0, 1920, 804);
    c.fillStyle = '#0a1420'; c.fillRect(0, 690, 1920, 114);
    for (let i = 0; i < 8; i++) {
      const x = 60 + i * 232;
      c.fillStyle = lin(x, 0, x + 200, 0, [[0, '#33485e'], [0.5, '#22344a'], [1, '#101c2a']]); c.fillRect(x, 130, 200, 560);
      c.fillStyle = '#0a121c'; c.fillRect(x + 14, 150, 172, 250);
      if (i % 3 === 1) { // tape drives
        for (const cy of [220, 330]) { c.strokeStyle = '#9fb4c8'; c.lineWidth = 5; c.beginPath(); c.arc(x + 100, cy, 44, 0, TAU); c.stroke(); for (let k = 0; k < 3; k++) { const a = t * (cy === 220 ? 5 : -5) + k * TAU / 3; c.beginPath(); c.moveTo(x + 100, cy); c.lineTo(x + 100 + Math.cos(a) * 40, cy + Math.sin(a) * 40); c.stroke(); } }
      } else {
        for (let r = 0; r < 10; r++) for (let k = 0; k < 8; k++) { const on = hash(Math.floor(t * 7) + r * 31 + k * 7 + i * 101, 5) > 0.55; c.fillStyle = on ? ['#ffb84a', '#7fe0ff', '#ff6a4a'][(r + k + i) % 3] : '#16222e'; c.fillRect(x + 24 + k * 20, 162 + r * 23, 9, 9); }
      }
      c.fillStyle = '#16222e'; c.fillRect(x + 14, 420, 172, 250); c.fillStyle = 'rgba(160,200,230,0.2)'; c.fillRect(x, 130, 3, 560);
    }
    figure(1010, 800, 330, { fill: '#04080e', robe: false, face: -1, armF: [1.2, 0.5], armB: [0.2, 0.3], rim: '#3a6a8a', light: -1 });
  }

  S.computer = (c, t, d, p) => {
    // one continuous pull-back: machine room -> die -> package -> board
    const zEnd = 1 / 38, z = Math.exp(Math.log(zEnd) * E.io(clamp((p - 0.12) / 0.8)));
    const cx = W / 2, cy = H / 2;
    c.fillStyle = '#04121c'; c.fillRect(0, 0, W, H);
    // board
    const bs = z / zEnd;
    c.save(); c.translate(cx, cy); c.scale(bs, bs); c.translate(-cx, -cy);
    c.fillStyle = lin(0, 0, W, H, [[0, '#06283a'], [1, '#03141e']]); c.fillRect(-200, -200, W + 400, H + 400);
    const R = rng(44);
    c.lineCap = 'round';
    for (let i = 0; i < 90; i++) {
      const y0 = Math.round(R() * 40) * 22 - 40, x0 = R() * 1900, len = 200 + R() * 700, dir = R() < 0.5 ? 1 : -1, dy = (R() < 0.5 ? 1 : -1) * (22 + Math.round(R() * 4) * 22);
      const pts = [[x0, y0], [x0 + len * 0.4 * dir, y0], [x0 + len * 0.4 * dir + Math.abs(dy) * dir, y0 + dy], [x0 + len * dir, y0 + dy]];
      c.strokeStyle = 'rgba(60,170,220,0.5)'; c.lineWidth = 3; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const q of pts) c.lineTo(q[0], q[1]); c.stroke();
      circle(pts[0][0], pts[0][1], 5, '#7fd6ff'); circle(pts[3][0], pts[3][1], 5, '#7fd6ff');
      const u = (t * (0.5 + R()) + R()) % 1, k = Math.min(2.999, u * 3), a = pts[Math.floor(k)], b = pts[Math.floor(k) + 1], f = k % 1;
      glow(lerp(a[0], b[0], f), lerp(a[1], b[1], f), 22, '#bfefff', 0.9 * clamp((bs - 0.5) * 2 + 0.3));
    }
    for (let i = 0; i < 14; i++) { const x = 120 + R() * 1680, y = 80 + R() * 640, w = 70 + R() * 90, h = 44 + R() * 40; if (Math.abs(x - cx) < 240 && Math.abs(y - cy) < 150) continue; rrect(x - w / 2, y - h / 2, w, h, 4, '#0a0e14'); for (let k = 0; k < 6; k++) { rect(x - w / 2 + 6 + k * (w - 12) / 6, y - h / 2 - 7, 5, 7, '#c9a45a'); rect(x - w / 2 + 6 + k * (w - 12) / 6, y + h / 2, 5, 7, '#c9a45a'); } }
    c.restore();
    // package (ceramic, gold pins) — the room is its die
    const pw = 4300 * z, ph = 2500 * z;
    c.save(); c.translate(cx, cy);
    for (let k = 0; k < 14; k++) { const px = -pw / 2 + pw * (k + 0.5) / 14; c.fillStyle = lin(px - pw * 0.012, 0, px + pw * 0.012, 0, [[0, '#8a6a2a'], [0.5, '#ffe29a'], [1, '#6a4c1a']]); c.fillRect(px - pw * 0.012, -ph / 2 - ph * 0.12, pw * 0.024, ph * 1.24); }
    c.fillStyle = lin(0, -ph / 2, 0, ph / 2, [[0, '#2a2e3a'], [1, '#0e1016']]); c.beginPath(); c.roundRect(-pw / 2, -ph / 2, pw, ph, pw * 0.02); c.fill();
    c.strokeStyle = 'rgba(160,200,240,0.35)'; c.lineWidth = Math.max(1, pw * 0.002); c.stroke();
    c.fillStyle = '#c9a45a'; c.beginPath(); c.roundRect(-1100 * z, -520 * z, 2200 * z, 1040 * z, 30 * z); c.fill();
    // bond wires
    c.strokeStyle = 'rgba(255,226,154,0.7)'; c.lineWidth = Math.max(0.6, 6 * z);
    for (let k = 0; k < 14; k++) { const px = -pw / 2 + pw * (k + 0.5) / 14; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(px, s * ph * 0.46); c.lineTo(lerp(-900, 900, (k + 0.5) / 14) * z, s * 410 * z); c.stroke(); } }
    if (pw < 1100) txt('µP', -pw * 0.4, -ph * 0.36, { size: Math.max(6, pw * 0.05), font: F.mono, weight: 500, align: 'left', color: '#8f9bb0', a: 0.8 });
    // die: the machine room, dissolving into etched silicon
    c.save(); c.scale(z, z); c.translate(-960, -402);
    c.beginPath(); c.rect(0, 0, 1920, 804); c.clip();
    mainframe(c, t);
    const die = seg(z, 0.5, 0.12);
    if (die > 0) {
      c.globalAlpha = die;
      c.fillStyle = lin(0, 0, 1920, 804, [[0, '#2a4a7a'], [0.5, '#6a4aa0'], [1, '#1c6a8a']]); c.fillRect(0, 0, 1920, 804);
      const R2 = rng(8);
      for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(${150 + R2() * 100 | 0},${170 + R2() * 80 | 0},255,${0.25 + R2() * 0.4})`; c.fillRect(R2() * 1800, R2() * 740, 60 + R2() * 300, 30 + R2() * 120); }
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 8; for (let i = 0; i < 12; i++) { c.beginPath(); c.moveTo(0, i * 70); c.lineTo(1920, i * 70); c.stroke(); }
    }
    c.restore();
    c.restore();
    glow(cx, cy, 700, '#3a9adf', 0.14 * clamp(1 - z * 2));
    const s1 = 1 - seg(p, 0.3, 0.45), s2 = seg(p, 0.55, 0.7);
    if (s1 > 0) stamp(c, '1946', 0.85 * s1);
    if (s2 > 0) stamp(c, '1971', 0.85 * s2);
  };

  S.timeline = (c, t, d, p) => {
    // centuries -> decades -> years: each scale is squeezed aside by the next
    const y0 = 420, xa = 150, xb = 1770;
    c.fillStyle = lin(0, 0, 0, H, [[0, '#020812'], [0.5, '#061a2c'], [1, '#020812']]); c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(80,160,220,0.06)'; c.lineWidth = 1;
    for (let i = 0; i < 40; i++) { c.beginPath(); c.moveTo(i * 50, 0); c.lineTo(i * 50, H); c.stroke(); } for (let i = 0; i < 17; i++) { c.beginPath(); c.moveTo(0, i * 50); c.lineTo(W, i * 50); c.stroke(); }
    const k1 = seg(p, 0.26, 0.5, E.io), k2 = seg(p, 0.54, 0.78, E.io), k3 = seg(p, 0.84, 1.0, E.in);
    // segment boundaries on screen
    const span = xb - xa;
    let b1 = xa + span * lerp(1, 0.3, k1), b2 = xb;
    b1 = xa + span * lerp(lerp(1, 0.3, k1), 0.09, k2); b2 = xa + span * lerp(1, 0.34, k2);
    const squeeze = x => lerp(x, xb, k3 * 0.985);
    const segs = [
      { a: xa, b: b1, y0: -400, y1: 1900, step: 100, label: y => (y < 0 ? `${-y} BC` : y === 0 ? 'AD 1' : `${y}`), every: 500, draw: seg(p, 0.0, 0.24, E.out) },
      { a: b1, b: b2, y0: 1900, y1: 2010, step: 10, label: y => `${y}`, every: 50, draw: k1 },
      { a: b2, b: xb, y0: 2010, y1: 2026, step: 1, label: y => `${y}`, every: 5, draw: k2 },
    ];
    const events = [-430, 126, 1220, 1455, 1492, 1610, 1687, 1769, 1787, 1824, 1844, 1879, 1903, 1901, 1928, 1946, 1957, 1969, 1971, 1991, 2007, 2012, 2020, 2022, 2025];
    c.save(); c.globalCompositeOperation = 'lighter';
    // the line itself
    const drawnTo = squeeze(segs[2].draw > 0 ? lerp(b2, xb, segs[2].draw) : segs[1].draw > 0 ? lerp(b1, b2, segs[1].draw) : lerp(xa, b1, segs[0].draw));
    for (const [lw, a] of [[14, 0.12], [6, 0.3], [2.2, 1]]) { c.strokeStyle = col('#6fd0ff', a); c.lineWidth = lw; c.lineCap = 'round'; c.beginPath(); c.moveTo(squeeze(xa), y0); c.lineTo(drawnTo, y0); c.stroke(); }
    segs.forEach((s, si) => {
      if (s.draw <= 0) return;
      const n = Math.round((s.y1 - s.y0) / s.step), w = s.b - s.a, gap = w / n;
      for (let i = 0; i <= n; i++) {
        if (i / n > s.draw + 0.001) break;
        const yr = s.y0 + i * s.step, x = squeeze(s.a + w * i / n), major = yr % s.every === 0;
        if (si > 0 && i === 0) continue;
        const vis = clamp(gap * (1 - k3) / 9);
        c.strokeStyle = col('#9fe0ff', (major ? 0.9 : 0.5) * (0.35 + 0.65 * vis)); c.lineWidth = major ? 2.2 : 1.2;
        c.beginPath(); c.moveTo(x, y0 - (major ? 20 : 10)); c.lineTo(x, y0 + (major ? 20 : 10)); c.stroke();
        if (major && gap * s.every / s.step > 70) txt(s.label(yr), x, y0 + 52, { size: 21, font: F.mono, color: '#bfe6ff', a: 0.85 * clamp((gap * s.every / s.step - 70) / 60) * (1 - k3) });
      }
    });
    // milestones
    const xOf = yr => { for (const s of segs) if (yr <= s.y1) return s.draw > 0 && (yr - s.y0) / (s.y1 - s.y0) <= s.draw ? squeeze(s.a + (s.b - s.a) * (yr - s.y0) / (s.y1 - s.y0)) : null; return null; };
    events.forEach((yr, i) => {
      const x = xOf(yr); if (x === null) return;
      const tw = 0.7 + 0.3 * Math.sin(t * 6 + i);
      glow(x, y0, 34, '#ffe6b0', 0.8 * tw); circle(x, y0, 4.2, '#fff6dc');
      c.strokeStyle = col('#ffe6b0', 0.35); c.lineWidth = 1; c.beginPath(); c.moveTo(x, y0 - 24); c.lineTo(x, y0 - 70 - (i % 3) * 26); c.stroke();
    });
    // "now"
    const nx = squeeze(xb);
    glow(nx, y0, 120 + 900 * k3, '#bfeaff', 0.5 * segs[2].draw + k3 * 0.5); glow(nx, y0, 40 + 200 * k3, '#ffffff', segs[2].draw);
    c.restore();
    // the unit of progress
    const big = (s, a, sub) => { txt(s, W / 2, 200, { size: 74, font: F.display, weight: 500, color: '#eaf6ff', a, track: 30, blur: 24, glowColor: '#6fd0ff' }); txt(sub, W / 2, 262, { size: 22, font: F.mono, color: '#9fd6ff', a: a * 0.8, track: 6 }); };
    big('CENTURIES', win(p, 0.02, 0.36, 0.08), 'BETWEEN BREAKTHROUGHS');
    big('DECADES', win(p, 0.36, 0.64, 0.08), 'BETWEEN BREAKTHROUGHS');
    big('YEARS', win(p, 0.64, 0.97, 0.08), 'BETWEEN BREAKTHROUGHS');
    flare(nx, y0, 1600 * (segs[2].draw * 0.5 + k3), '#bfeaff', 0.5 * (segs[2].draw * 0.6 + k3), 4);
    if (k3 > 0) { c.fillStyle = `rgba(230,245,255,${k3 * k3})`; c.fillRect(0, 0, W, H); }
  };

  // ---------------------------------------------------------------------------
  // IX · THE CONNECTED WORLD
  // ---------------------------------------------------------------------------
  S.fiber = (c, t, d, p) => {
    const L = camera(p, { z0: 1.0, z1: 1.08, fx: 960, fy: 500 });
    const scroll = t * 520;
    L(0, () => {
      sky([[0, '#0a4a6e'], [0.3, '#063654'], [0.7, '#03182c'], [1, '#010810']]);
      // light from the surface
      for (let i = 0; i < 9; i++) { const x = 100 + i * 230 + Math.sin(t * 0.5 + i) * 30; beam(x, -60, 50, x - 260, 700, 260, '#6fd6ff', 0.2 * (0.5 + 0.5 * n1(t * 0.7 + i * 3, 5)), 0, 2); }
    });
    L(0.3, () => {
      // something vast, far off
      const wx = 1500 - t * 40, wy = 250 + Math.sin(t * 0.8) * 10;
      c.fillStyle = 'rgba(4,30,50,0.9)';
      c.beginPath(); c.moveTo(wx - 190, wy); c.bezierCurveTo(wx - 120, wy - 60, wx + 80, wy - 54, wx + 180, wy - 6); c.lineTo(wx + 250, wy - 46); c.lineTo(wx + 236, wy + 4); c.lineTo(wx + 256, wy + 40); c.lineTo(wx + 180, wy + 10); c.bezierCurveTo(wx + 60, wy + 46, wx - 120, wy + 44, wx - 190, wy); c.fill();
      hills(600, 60, 0.0014, 3, '#042236', { off: scroll * 0.3 });
    });
    const bed = x => ridgeY(x, 690, 46, 0.0016, 9, 3, scroll);
    L(1, () => {
      hills(690, 46, 0.0016, 9, lin(0, 640, 0, 804, [[0, '#06283c'], [1, '#010a12']]), { off: scroll });
      // the cable on the abyssal plain
      const cy = x => bed(x) - 6;
      c.strokeStyle = '#010608'; c.lineWidth = 15; c.lineCap = 'round'; c.beginPath(); for (let x = -300; x <= 2220; x += 16) { x === -300 ? c.moveTo(x, cy(x)) : c.lineTo(x, cy(x)); } c.stroke();
      c.strokeStyle = 'rgba(120,200,240,0.35)'; c.lineWidth = 2; c.beginPath(); for (let x = -300; x <= 2220; x += 16) { x === -300 ? c.moveTo(x, cy(x) - 6) : c.lineTo(x, cy(x) - 6); } c.stroke();
      // light racing through the glass
      c.save(); c.globalCompositeOperation = 'lighter';
      const R = rng(6);
      for (let i = 0; i < 26; i++) {
        const sp = 1500 + R() * 1700, x = ((R() * 2600 + t * sp) % 2600) - 340, tail = 120 + sp * 0.12, hue = ['#7fe6ff', '#ffffff', '#9fb8ff', '#7fffd8'][i % 4];
        const g = c.createLinearGradient(x - tail, 0, x, 0); g.addColorStop(0, col(hue, 0)); g.addColorStop(1, col(hue, 0.9));
        c.strokeStyle = g; c.lineWidth = 4; c.beginPath(); for (let xx = x - tail; xx <= x; xx += 12) { xx === x - tail ? c.moveTo(xx, cy(xx)) : c.lineTo(xx, cy(xx)); } c.stroke();
        glow(x, cy(x), 46, hue, 0.9); circle(x, cy(x), 3.5, '#ffffff');
      }
      c.restore();
      glow(960, 690, 1300, '#1c9ad6', 0.14);
      // repeater housings
      for (let k = 0; k < 4; k++) { const x = ((k * 760 - scroll) % 3040 + 3040) % 3040 - 400; c.save(); c.translate(x, cy(x)); c.rotate(Math.atan2(cy(x + 20) - cy(x - 20), 40)); rrect(-60, -15, 120, 30, 14, '#04141c', 'rgba(120,200,240,0.5)', 1.5); glow(0, 0, 30, '#7fe6ff', 0.5 + 0.4 * Math.sin(t * 12 + k)); c.restore(); }
    });
    L(1.4, () => hills(790, 30, 0.003, 21, '#00060a', { off: scroll * 1.7, oct: 2 }));
    motes({ n: 150, seed: 31, t, hex: '#bfeaff', alpha: 0.55, speed: 5, size: 2 });
    flare(960, 690, 1900, '#7fd6ff', 0.2, 3);
  };

  const WEB = ['                               World Wide Web', '',
    'The WorldWideWeb (W3) is a wide-area hypermedia[1] information retrieval',
    'initiative aiming to give universal access to a large universe of documents.', '',
    'Everything there is online about W3 is linked directly or indirectly to',
    'this document, including an executive summary[2] of the project, Mailing',
    'lists[3], Policy[4], November\'s W3 news[5], Frequently Asked Questions[6].', '',
    '   What\'s out there?[7]   Pointers to the world\'s online information,',
    '                          subjects[8], W3 servers[9], etc.',
    '   Help[10]               on the browser you are using',
    '   Software Products[11]  A list of W3 project components and their',
    '                          current state.',
    '   Technical[12]          Details of protocols, formats, program internals',
    '   People[14]             A list of some people involved in the project.',
    '   History[15]            A summary of the history of the project.', '',
    '1-20, Back, <RETURN> for more, Quit, or Help: _'];

  S.webpage = (c, t, d, p) => {
    const L = camera(p, { z0: 1.0, z1: 1.1, fx: 960, fy: 380 });
    const sw = 900, sh = 560, sx = 960 - sw / 2, sy = 64;
    const on = seg(t, 0.05, 0.4);
    L(0.4, () => {
      c.fillStyle = '#04070c'; c.fillRect(-300, -300, 2500, 1500);
      c.fillStyle = rad(960, 340, 80, 1100, [[0, col('#16324a', on)], [0.5, col('#081624', on)], [1, '#04070c']]); c.fillRect(-300, -300, 2500, 1500);
      rect(-300, 690, 2500, 200, '#060a10');
      // a windowless office at CERN: binders, a note taped up
      const R = rng(3);
      for (let i = 0; i < 9; i++) rect(80 + i * 34, 200 + R() * 30, 26, 200 - R() * 30, col(['#2a4a6a', '#3a3a5a', '#1c3a4a'][i % 3], 0.5 * on));
      rect(60, 400, 340, 10, col('#1c2a3a', on));
      c.save(); c.translate(1620, 300); c.rotate(0.06); rect(-70, -50, 140, 100, col('#d9e6f2', 0.25 * on)); c.restore();
    });
    L(1, () => {
      // the monitor
      rrect(sx - 46, sy - 40, sw + 92, sh + 92, 22, '#0c0e12', 'rgba(140,180,220,0.25)', 2);
      rect(900, sy + sh + 52, 120, 40, '#0a0c10'); rrect(760, sy + sh + 88, 400, 18, 8, '#0c0e12');
      c.save(); c.beginPath(); c.roundRect(sx, sy, sw, sh, 26); c.clip();
      c.fillStyle = rad(960, sy + sh / 2, 60, 700, [[0, col('#0c2238', on)], [1, col('#040c16', on)]]); c.fillRect(sx, sy, sw, sh);
      // the printed page, remembered for an instant
      const ghost = 1 - seg(t, 0.1, 0.8);
      if (ghost > 0) P.page(c, 960 - 170, sy + 46, 340, 470, { a: ghost * 0.55 });
      // the first page, arriving line by line
      const lines = clamp((t - 0.35) / 1.5) * WEB.length;
      c.font = `400 19.5px ${F.mono}`; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      c.shadowColor = 'rgba(140,210,255,0.9)'; c.shadowBlur = O.blurPx(9);
      WEB.forEach((s, i) => {
        if (i > lines) return;
        const k = clamp(lines - i), txtS = k < 1 ? s.slice(0, Math.floor(s.length * k)) : s;
        c.fillStyle = i === 0 ? '#ffffff' : '#cfeaff';
        c.fillText(i === WEB.length - 1 && Math.floor(t * 4) % 2 ? txtS.replace('_', ' ') : txtS, sx + 34, sy + 52 + i * 26.5);
      });
      c.shadowBlur = 0;
      // scanlines and glass
      c.fillStyle = 'rgba(0,0,0,0.16)'; for (let y = sy; y < sy + sh; y += 4) c.fillRect(sx, y, sw, 1.5);
      c.fillStyle = lin(sx, sy, sx + sw, sy + sh, [[0, 'rgba(255,255,255,0.09)'], [0.4, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0)']]); c.fillRect(sx, sy, sw, sh);
      c.restore();
      glow(960, sy + sh / 2, 900, '#3a9adf', 0.2 * on);
      // keyboard, a cup, light spilling on the desk
      rrect(700, 716, 520, 60, 8, '#0e1218', 'rgba(140,180,220,0.2)', 1.5);
      for (let r = 0; r < 3; r++) for (let k = 0; k < 22; k++) rect(714 + k * 22.6, 724 + r * 15, 17, 10, col('#3a4a5c', 0.5 + 0.2 * on));
      glow(960, 730, 520, '#5ab4ff', 0.16 * on);
    });
    L(1.5, () => { c.save(); c.filter = `blur(${O.blurPx(6)}px)`; figure(380, 1100, 900, { face: 1, fill: '#020406', robe: false, rim: col('#1c4a7a', 0.6 * on), light: 1, armF: [0.9, 0.9], armB: [0.2, 0.2] }); c.restore(); });
    stamp(c, '1991');
  };

  /** A phone: dark slab, lit screen. Returns nothing; draws at (x, y) centre with rotation. */
  P.phone = (c, x, y, w, rot, screen, k = 1) => {
    const h = w * 2.05;
    c.save(); c.translate(x, y); c.rotate(rot);
    glow(0, 0, w * 3.4, '#7fc8ff', 0.4 * k);
    rrect(-w / 2, -h / 2, w, h, w * 0.16, '#06080c', 'rgba(170,200,230,0.5)', Math.max(1, w * 0.025));
    c.save(); c.beginPath(); c.roundRect(-w / 2 + w * 0.06, -h / 2 + w * 0.06, w * 0.88, h - w * 0.12, w * 0.11); c.clip();
    c.fillStyle = lin(0, -h / 2, 0, h / 2, [[0, mix('#06080c', '#eaf6ff', k)], [1, mix('#06080c', '#bfe0ff', k)]]); c.fillRect(-w / 2, -h / 2, w, h);
    if (screen) { c.globalAlpha = k; screen(w * 0.88, h - w * 0.12); }
    c.restore(); c.restore();
  };

  S.phones = (c, t, d, p) => {
    c.fillStyle = '#02060c'; c.fillRect(0, 0, W, H);
    const pw = 628, gap = 18, starts = [0, d * 0.3, d * 0.6];
    const panel = (i, fn) => {
      const lt = t - starts[i]; if (lt < 0) return;
      const a = seg(lt, 0, 0.35, E.out), x = i * (pw + gap);
      c.save(); c.beginPath(); c.rect(x, 0, pw, H); c.clip();
      c.translate(x + pw / 2, H / 2); const z = 1.04 + 0.05 * clamp(lt / 3); c.scale(z, z); c.translate(-pw / 2, -H / 2 + (1 - a) * 30);
      fn(lt, clamp(lt / (d - starts[i])));
      c.restore();
      if (a < 1) { c.fillStyle = `rgba(2,6,12,${1 - a})`; c.fillRect(x, 0, pw, H); }
      if (lt < 0.2) { c.fillStyle = `rgba(200,235,255,${0.5 * (1 - lt / 0.2)})`; c.fillRect(x, 0, pw, H); }
    };
    const card = (x, y, w, h, fn) => { c.save(); c.translate(x, y); glow(w / 2, h / 2, w * 0.9, '#7fc8ff', 0.25); rrect(0, 0, w, h, 18, 'rgba(236,246,255,0.96)'); c.beginPath(); c.roundRect(0, 0, w, h, 18); c.clip(); fn(w, h); c.restore(); };
    const tag = (s) => txt(s, pw / 2, 744, { size: 17, font: F.mono, weight: 500, color: '#cfe6ff', a: 0.8, track: 4 });

    // 1 — a farmer checks the morning's price
    panel(0, (lt, u) => {
      c.fillStyle = lin(0, 0, 0, H, [[0, '#16345a'], [0.45, '#c9785a'], [0.62, '#ffd08a'], [1, '#ffe2a6']]); c.fillRect(-60, -60, pw + 120, H + 120);
      glow(470, 500, 420, '#fff0c8', 0.8); circle(470, 500, 30, '#fffbe8');
      hills(520, 22, 0.004, 3, '#5a4a52', { x0: -60, x1: pw + 60 });
      c.fillStyle = lin(0, 540, 0, H, [[0, '#6a7a3a'], [1, '#1c2a14']]); c.fillRect(-60, 548, pw + 120, 400);
      c.strokeStyle = 'rgba(20,30,10,0.5)'; c.lineWidth = 3; for (let i = -8; i < 16; i++) { c.beginPath(); c.moveTo(430, 548); c.lineTo(430 + (i - 4) * 150, 900); c.stroke(); }
      const f = figure(250, 790, 420, { face: 1, fill: '#150f0c', rim: '#ffc880', light: 1, robe: false, head: 'straw', armF: [1.25, 1.25], armB: [0.3, 0.3], stride: 0.3, nod: 0.25 });
      P.phone(c, f.hands[0][0] + 8, f.hands[0][1] - 20, 30, 0.12, null, seg(lt, 0.2, 0.5));
      const k = seg(lt, 0.35, 0.8, E.back);
      c.save(); c.translate(380, 210); c.scale(k, k); c.translate(-380, -210);
      card(250, 110, 270, 190, (w, h) => {
        txt('MAIZE · 90 KG', 18, 30, { size: 15, font: F.mono, weight: 500, align: 'left', color: '#3a5a7a' });
        const pts = [0.3, 0.36, 0.33, 0.45, 0.42, 0.56, 0.6, 0.74, 0.82].map((v, i) => [22 + i * 28, 160 - v * 110]);
        strokeP(pts, seg(lt, 0.6, 1.5), '#1c9a5a', 4);
        c.fillStyle = 'rgba(28,154,90,0.12)'; c.beginPath(); c.moveTo(22, 160); pts.forEach(q => c.lineTo(q[0], q[1])); c.lineTo(246, 160); c.fill();
        txt('▲ 4.2%', w - 18, 30, { size: 17, font: F.mono, weight: 500, align: 'right', color: '#1c9a5a', a: seg(lt, 1.2, 1.6) });
      });
      c.restore();
      tag('KISUMU · 06:12');
    });
    // 2 — a student calls her teacher
    panel(1, (lt, u) => {
      c.fillStyle = lin(0, 0, 0, H, [[0, '#0a1430'], [1, '#1c1430']]); c.fillRect(-60, -60, pw + 120, H + 120);
      rect(360, 90, 220, 280, '#0c1c44'); stars({ n: 26, seed: 4, t, x: 360, y: 90, w: 220, h: 280, size: 1.2 }); c.strokeStyle = '#06091a'; c.lineWidth = 8; c.strokeRect(360, 90, 220, 280);
      glow(120, 300, 300, '#ffb45a', 0.35); rect(100, 300, 12, 260, '#06091a'); poly([[70, 300], [150, 300], [130, 250], [90, 250]], '#ffca7a');
      rect(-60, 600, pw + 120, 24, '#141028'); rect(-60, 624, pw + 120, 300, '#0a0818');
      const f = figure(200, 800, 400, { face: 1, fill: '#07060f', rim: '#7fb8ff', light: 1, sit: true, head: 'bun', child: false, armF: [1.1, 1.3], armB: [0.9, 1.1], nod: 0.1 });
      P.phone(c, 430, 530, 64, 0.03, (w, h) => {
        c.fillStyle = '#16324a'; c.fillRect(-w / 2, -h / 2, w, h);
        c.save(); c.scale(0.24, 0.24); figure(0, 330, 430, { fill: '#eaf2ff', robe: false, face: -1, armF: [2.6 + 0.3 * Math.sin(lt * 7), 0.4], armB: [0.2, 0.2] }); c.restore();
      }, seg(lt, 0.15, 0.45));
      rect(424, 596, 12, 8, '#06091a');
      const k = seg(lt, 0.4, 0.85, E.back);
      c.save(); c.translate(360, 250); c.scale(k, k); c.translate(-360, -250);
      card(210, 150, 300, 200, (w, h) => {
        c.fillStyle = '#1c3a5a'; c.fillRect(0, 0, w, h);
        c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(150, 40); c.lineTo(250, 150); c.lineTo(150, 150); c.closePath(); c.stroke(); // on the blackboard: a² + b² = c²
        txt('a² + b² = c²', 205, 176, { size: 21, font: F.serif, italic: true, color: '#ffffff', a: seg(lt, 1.0, 1.5) });
        c.save(); c.translate(86, 228); figure(0, 0, 250, { fill: '#eaf2ff', robe: false, face: 1, head: 'beard', armF: [1.9 + 0.12 * Math.sin(lt * 5), 0.5], armB: [0.2, 0.3] }); c.restore();
        rrect(w - 76, h - 62, 62, 48, 6, '#0a1420', '#ffffff', 2); circle(w - 45, h - 44, 9, '#cfe0f2'); rrect(w - 60, h - 34, 30, 20, 8, '#cfe0f2');
      });
      c.restore();
      tag('LIMA ⇄ MADRID · 20:40');
    });
    // 3 — strangers, one idea
    panel(2, (lt, u) => {
      c.fillStyle = rad(pw / 2, 380, 40, 600, [[0, '#103a5c'], [1, '#030a14']]); c.fillRect(-60, -60, pw + 120, H + 120);
      const cols = ['#ff7a6a', '#ffd25a', '#6fe0a0', '#7fb8ff'], corners = [[110, 150], [520, 130], [100, 620], [530, 640]];
      const k = seg(lt, 0.25, 0.7, E.back);
      // the shared sketch: each hand adds a stroke
      const parts = [sample(u2 => [314 + 86 * Math.cos(Math.PI * (0.75 + 1.5 * u2)), 350 + 86 * Math.sin(Math.PI * (0.75 + 1.5 * u2))], 30), [[254, 412], [276, 470], [352, 470], [374, 412]], [[280, 492], [348, 492], [340, 512], [288, 512], [280, 492]], [[296, 420], [300, 350], [314, 380], [328, 350], [332, 420]]];
      corners.forEach((q, i) => {
        const a = seg(lt, 0.1 + i * 0.12, 0.5 + i * 0.12);
        c.strokeStyle = col(cols[i], 0.55 * a); c.lineWidth = 2; c.setLineDash([3, 9]); c.lineDashOffset = -lt * 60; c.beginPath(); c.moveTo(q[0], q[1]); c.lineTo(314, 400); c.stroke(); c.setLineDash([]);
        P.phone(c, q[0], q[1], 56, (i % 2 ? 1 : -1) * 0.2, (w, h) => { c.fillStyle = col(cols[i], 0.35); c.fillRect(-w / 2, -h / 2, w, h); circle(0, -6, 12, col(cols[i], 0.9)); }, a);
        limb(q[0] + (i % 2 ? 60 : -60), q[1] + 150, q[0] + (i % 2 ? 22 : -22), q[1] + 50, 30, 20, '#02060c');
      });
      c.save(); c.translate(314, 400); c.scale(k, k); c.translate(-314, -400);
      glow(314, 390, 300, '#bfe6ff', 0.3); rrect(194, 240, 240, 300, 16, 'rgba(236,246,255,0.95)');
      parts.forEach((pts, i) => {
        const tip = strokeP(pts, seg(lt, 0.4 + i * 0.16, 0.85 + i * 0.16), cols[i === 0 ? 3 : i === 1 ? 0 : i === 2 ? 2 : 1], 5);
        const kk = seg(lt, 0.4 + i * 0.16, 0.85 + i * 0.16);
        if (kk > 0 && kk < 1) { poly([[tip[0], tip[1]], [tip[0] + 16, tip[1] + 6], [tip[0] + 6, tip[1] + 16]], cols[i === 0 ? 3 : i === 1 ? 0 : i === 2 ? 2 : 1]); }
      });
      const lit = seg(lt, 1.15, 1.5); glow(314, 350, 150 * lit, '#ffe27a', 0.8 * lit);
      c.restore();
      tag('SEOUL · LAGOS · OSLO · SÃO PAULO');
    });
    rect(pw, 0, gap, H, '#000'); rect(pw * 2 + gap, 0, gap, H, '#000');
  };

  // --- the globe -------------------------------------------------------------
  const CITIES = [[6.14, 46.2], [-0.12, 51.5], [2.35, 48.85], [13.4, 52.52], [-3.7, 40.42], [12.5, 41.9], [37.6, 55.75], [28.97, 41.01], [31.24, 30.04], [3.38, 6.52], [36.82, -1.29], [28.05, -26.2], [18.42, -33.92],
    [-74.0, 40.71], [-87.63, 41.88], [-122.42, 37.77], [-118.24, 34.05], [-99.13, 19.43], [-79.38, 43.65], [-46.63, -23.55], [-58.38, -34.6], [-77.04, -12.05], [-74.07, 4.71], [-43.17, -22.9],
    [55.27, 25.2], [51.39, 35.69], [72.88, 19.08], [77.21, 28.61], [77.59, 12.97], [90.41, 23.81], [100.5, 13.76], [103.82, 1.35], [106.85, -6.21], [116.4, 39.9], [121.47, 31.23], [114.17, 22.32], [126.98, 37.57], [139.69, 35.69],
    [151.21, -33.87], [144.96, -37.81], [174.76, -36.85], [-157.86, 21.31], [-21.9, 64.13], [18.07, 59.33], [24.94, 60.17], [-9.14, 38.72], [-17.44, 14.69], [38.75, 9.02], [39.28, -6.79], [47.5, -18.9], [67.0, 24.86], [69.24, 41.3], [-123.12, 49.28], [-149.9, 61.22], [-70.67, -33.45], [-66.9, 10.5], [-82.38, 23.13], [120.98, 14.6], [96.2, 16.87], [44.36, 33.31], [35.5, 33.9], [10.75, 59.91], [-6.26, 53.35], [21.01, 52.23], [30.52, 50.45], [2.17, 41.39], [-7.6, 33.57], [13.19, 32.89], [32.58, 0.35], [15.3, -4.3]];
  /** Orthographic projection factory. */
  P.ortho = (cx, cy, r, lon0, lat0) => {
    const p0 = lat0 * Math.PI / 180, s0 = Math.sin(p0), c0 = Math.cos(p0);
    return (lon, lat, alt = 1) => {
      const l = (lon - lon0) * Math.PI / 180, ph = lat * Math.PI / 180, cp = Math.cos(ph), sp = Math.sin(ph);
      const x = cp * Math.sin(l), y = c0 * sp - s0 * cp * Math.cos(l), z = s0 * sp + c0 * cp * Math.cos(l);
      return [cx + r * x * alt, cy - r * y * alt, z, x, y];
    };
  };
  /** Night-side Earth. opts.day: 0..1 adds a sunlit limb on the right. */
  P.globe = (c, cx, cy, r, lon0, lat0, t, { lights = 1, day = 0.25, land = '#0c2238', sea = '#040c1a' } = {}) => {
    const pr = P.ortho(cx, cy, r, lon0, lat0);
    glow(cx, cy, r * 1.32, '#3a8adf', 0.42);
    c.save(); c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.clip();
    c.fillStyle = rad(cx - r * 0.3, cy - r * 0.3, 0, r * 1.6, [[0, mix(sea, '#0a2a4a', 0.6)], [1, sea]]); c.fillRect(cx - r, cy - r, r * 2, r * 2);
    // land, with back-facing points pushed out to the limb
    c.beginPath();
    for (const ring of window.ODE_LAND) {
      let any = false; const pts = [];
      for (let i = 0; i < ring.length; i += 2) { const q = pr(ring[i], ring[i + 1]); if (q[2] > 0) { any = true; pts.push([q[0], q[1]]); } else { const n = Math.hypot(q[3], q[4]) || 1; pts.push([cx + r * 1.02 * q[3] / n, cy - r * 1.02 * q[4] / n]); } }
      if (!any) continue;
      c.moveTo(pts[0][0], pts[0][1]); for (const q of pts) c.lineTo(q[0], q[1]); c.closePath();
    }
    c.fillStyle = land; c.fill(); c.strokeStyle = 'rgba(110,170,230,0.28)'; c.lineWidth = 1.2; c.stroke();
    // city lights
    if (lights > 0) {
      const R = rng(81);
      CITIES.forEach(([lon, lat], i) => {
        const q = pr(lon, lat); if (q[2] <= 0.02) return;
        const a = lights * (0.6 + 0.4 * Math.sin(t * 2 + i)) * clamp(q[2] * 3);
        glow(q[0], q[1], r * 0.045, '#ffcf8a', 0.75 * a); circle(q[0], q[1], Math.max(1, r * 0.0045), col('#fff3d0', a));
        for (let k = 0; k < 5; k++) { const qq = pr(lon + (R() - 0.5) * 9, lat + (R() - 0.5) * 7); if (qq[2] > 0.05) circle(qq[0], qq[1], Math.max(0.7, r * 0.0028), col('#ffd9a0', 0.6 * a)); }
      });
    }
    // terminator: daylight creeping round the limb
    if (day > 0) { c.fillStyle = lin(cx + r * (1 - day * 1.6), cy, cx + r, cy - r * 0.2, [[0, 'rgba(120,190,255,0)'], [0.7, `rgba(140,200,255,${0.35})`], [1, 'rgba(255,240,220,0.9)']]); c.fillRect(cx - r, cy - r, r * 2, r * 2); }
    c.fillStyle = rad(cx, cy, r * 0.8, r, [[0, 'rgba(60,140,255,0)'], [1, 'rgba(90,170,255,0.4)']]); c.fillRect(cx - r, cy - r, r * 2, r * 2);
    c.restore();
    c.strokeStyle = 'rgba(140,200,255,0.55)'; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke();
    return pr;
  };
  P.CITIES = CITIES;
  // network links: each city to its nearest few + some long hauls, ordered outward from Geneva (CERN)
  const LINKS = (() => {
    const d2r = Math.PI / 180, gc = (a, b) => Math.acos(clamp(Math.sin(a[1] * d2r) * Math.sin(b[1] * d2r) + Math.cos(a[1] * d2r) * Math.cos(b[1] * d2r) * Math.cos((a[0] - b[0]) * d2r), -1, 1));
    const links = new Map();
    CITIES.forEach((a, i) => {
      const near = CITIES.map((b, j) => [gc(a, b), j]).filter(q => q[1] !== i).sort((x, y) => x[0] - y[0]);
      for (const [dist, j] of [near[0], near[1], near[2], near[6 + (i * 7) % 20]]) { const key = i < j ? `${i}-${j}` : `${j}-${i}`; links.set(key, [Math.min(i, j), Math.max(i, j), dist]); }
    });
    // breadth-first hop count from city 0
    const hop = new Array(CITIES.length).fill(99); hop[0] = 0;
    for (let pass = 0; pass < 12; pass++) for (const [i, j] of links.values()) { if (hop[i] + 1 < hop[j]) hop[j] = hop[i] + 1; if (hop[j] + 1 < hop[i]) hop[i] = hop[j] + 1; }
    return [...links.values()].map(([i, j, dist]) => ({ i: hop[i] <= hop[j] ? i : j, j: hop[i] <= hop[j] ? j : i, dist, hop: Math.min(hop[i], hop[j]) }));
  })();
  /** Great-circle point between two cities, lifted off the surface. */
  const arcPt = (a, b, u, lift) => {
    const d2r = Math.PI / 180, v = q => [Math.cos(q[1] * d2r) * Math.cos(q[0] * d2r), Math.cos(q[1] * d2r) * Math.sin(q[0] * d2r), Math.sin(q[1] * d2r)];
    const A = v(a), B = v(b), w = Math.acos(clamp(A[0] * B[0] + A[1] * B[1] + A[2] * B[2], -1, 1)) || 1e-6, s = Math.sin(w);
    const k0 = Math.sin((1 - u) * w) / s, k1 = Math.sin(u * w) / s, x = A[0] * k0 + B[0] * k1, y = A[1] * k0 + B[1] * k1, z = A[2] * k0 + B[2] * k1;
    return [Math.atan2(y, x) / d2r, Math.asin(clamp(z, -1, 1)) / d2r, 1 + lift * Math.sin(Math.PI * u) * Math.min(1, w)];
  };
  /** The web of links over a globe projection. grow: 0..1 how far it has spread. */
  P.net = (c, pr, t, grow, { pages = true, alpha = 1 } = {}) => {
    c.save(); c.globalCompositeOperation = 'lighter';
    const maxHop = 7;
    LINKS.forEach((lk, n) => {
      const born = lk.hop / maxHop * 0.75, k = clamp((grow - born) / 0.2);
      if (k <= 0) return;
      const a = CITIES[lk.i], b = CITIES[lk.j], N = 26, lift = 0.16;
      c.beginPath(); let pen = false, vis = false;
      for (let s = 0; s <= N * k; s++) { const g = arcPt(a, b, s / N, lift), q = pr(g[0], g[1], g[2]); if (q[2] > -0.05) { pen ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); pen = true; vis = true; } else pen = false; }
      if (!vis) return;
      c.strokeStyle = col('#4fb4ff', 0.2 * alpha); c.lineWidth = 4; c.stroke();
      c.strokeStyle = col('#bfe6ff', 0.6 * alpha); c.lineWidth = 1.1; c.stroke();
      // messages in flight (the printed pages of 1455, now light)
      if (k >= 1 || pages) {
        const u = (t * (0.5 + hash(n, 3) * 0.6) + hash(n, 7)) % 1; if (u > k) return;
        const g = arcPt(a, b, u, lift), q = pr(g[0], g[1], g[2]); if (q[2] <= 0) return;
        if (pages && n % 3 === 0) { c.save(); c.translate(q[0], q[1]); c.rotate(t * 3 + n); c.scale(Math.cos(t * 6 + n), 1); c.fillStyle = col('#eaf6ff', 0.95 * alpha); c.fillRect(-4, -5.5, 8, 11); c.restore(); glow(q[0], q[1], 14, '#bfe6ff', 0.6 * alpha); }
        else { glow(q[0], q[1], 12, '#ffffff', 0.9 * alpha); }
      }
    });
    // nodes
    CITIES.forEach((city, i) => {
      const q = pr(city[0], city[1]); if (q[2] <= 0) return;
      const lit = LINKS.some(lk => (lk.i === i || lk.j === i) && grow > lk.hop / maxHop * 0.75);
      if (lit) { glow(q[0], q[1], 20, '#9fd8ff', 0.9 * alpha); circle(q[0], q[1], 2.4, col('#ffffff', alpha)); }
    });
    c.restore();
  };

  S.earthweb = (c, t, d, p) => {
    const L = camera(p, { z0: 1.12, z1: 1.0, fx: 960, fy: 402 });
    const cx = 960, cy = 420, r = 352, lon0 = lerp(-8, 38, E.sine(clamp(p))), lat0 = 26;
    L(0.2, () => { c.fillStyle = '#01030a'; c.fillRect(-300, -300, 2500, 1500); stars({ n: 420, seed: 21, t, alpha: 0.9 }); c.save(); c.translate(500, 300); c.rotate(-0.4); c.scale(4, 1); glow(0, 0, 300, '#4a6aff', 0.08); c.restore(); });
    L(1, () => {
      glow(cx + r * 1.02, cy - r * 0.2, 420, '#bfe0ff', 0.3);
      const pr = P.globe(c, cx, cy, r, lon0, lat0, t, { lights: 1, day: 0.22 });
      P.net(c, pr, t, clamp(0.08 + p * 1.05));
      // the lamp of 1879, now one node among millions
      const g = pr(CITIES[0][0], CITIES[0][1]), ghost = 1 - seg(t, 0.0, 0.9);
      if (ghost > 0) { c.save(); c.globalAlpha = ghost * 0.9; P.bulb(c, g[0], g[1] - 6, 0.5 + ghost * 0.5, 1, t); c.restore(); }
      glow(g[0], g[1], 60 + 200 * ghost, '#ffe6b0', 0.8);
      flare(g[0], g[1], 700, '#bfe0ff', 0.3 + 0.3 * ghost, 3);
      flare(cx + r * 0.99, cy - r * 0.16, 900, '#ffffff', 0.35, 3);
    });
  };
})();
