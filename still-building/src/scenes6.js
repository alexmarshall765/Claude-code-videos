/* =============================================================================
 *  FINALE — orbit → flag → title   (the montage before them replays earlier scenes)
 * ========================================================================== */
'use strict';

// -----------------------------------------------------------------------------
// 33. Sunrise over a continent of light
// -----------------------------------------------------------------------------
SCENES.orbit = S => {
  const { g, t } = S, k = seg(t, 0, S.dur + 0.6, E.sine);
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  starfield(g, t, 320, 0.7, 5);
  const map = GLX.tex('globe', MAPS.globeTex());
  const rad = 2500, ctr = [960, 610 + rad * 0.86 + 60 * k];
  // the sun climbs over the eastern limb
  const sa = lerp(-0.34, 0.1, k), sd = [0.62, Math.sin(sa) + 0.5, Math.cos(sa) * -0.62 + 0.1];
  PLATE.run(S, 'planet', { map, ctr, rad, lon0: (-97 + 3 * k) * D2R, lat0: (38 - 53) * D2R, sunDir: sd, cloudA: 0.5, lightsA: 3.2, roll: 0.0, atmoA: 1.3, seed: 2 }, [], { res: 1 });
  const sun = [1500 - 40 * k, 420 - 70 * k], rise = seg(t, 0.8, S.dur, E.quadIn);
  glow(g, sun[0], sun[1], 620, [1, 0.74, 0.44], 0.55 * rise); glow(g, sun[0], sun[1], 130, [1, 0.95, 0.85], rise);
  S.post = { sun, rays: 0.6 * rise, rayc: [1, 0.84, 0.62], th: 0.5, bloom: 0.9, streak: 0.9 * rise, expo: 1.05, con: 0.38, sat: 1.12, vig: 0.66, ca: 0.0012, shadow: [0.42, 0.48, 0.66], high: [0.62, 0.55, 0.44] };
  TYPE.say(S, 'THE WORK IS NOT FINISHED', 1.0, 5.6, { y: 210, size: 54 });
};

// -----------------------------------------------------------------------------
// 34. The flag, and everyone who built under it
// -----------------------------------------------------------------------------
SCENES.flag = S => {
  const { g, t } = S, sun = [1180, 560];
  S.cam = { x: 0, y: 14 - 20 * S.p, z: 1.0 + 0.05 * S.p };
  PLATE.sky(S, { hy: 1000, sun, c0: '#0a1f5a', c1: '#4f6fb6', c2: '#ffc890', sc: '#ffe9c0', ss: 44, sg: 0.8, cl: 0.5, cs: 1.0, ch: 1.4, cd: '#34467a', cb: '#ffe0b4', seed: 241 });
  const tex = GLX.tex('flag50', ART.flagArt(50));
  PLATE.run(S, 'flag', { tex, rect: [250, 80, 1400, 740], amp: 0.05, back: 0.36, spd: 2.6, shade: 0.4, tint: [1, 0.88, 0.66], T: t * 0.8 + 5 }, [], { res: 1 });
  // a launch climbs in the distance: the next chapter
  g.save(); g.globalCompositeOperation = 'lighter';
  const a = seg(t, 0.3, S.dur + 2, E.quadOut), tr = u => [1700 - 220 * u - 60 * u * u, 960 - 760 * u];
  g.lineCap = 'round';
  for (let i = 0; i < 40; i++) { const u0 = a * i / 40, u1 = a * (i + 1) / 40, p0 = tr(u0), p1 = tr(u1); g.strokeStyle = css([1, 0.86, 0.66], 0.1 + 0.7 * (i / 40) ** 2); g.lineWidth = 9 - 6 * (i / 40); line(g, p0[0], p0[1], p1[0], p1[1]); }
  const hd = tr(a); glow(g, hd[0], hd[1], 90, [1, 0.8, 0.5], 1); glow(g, hd[0], hd[1], 16, [1, 1, 1], 1);
  g.restore();
  // the ridge: every generation of builders, looking up
  S.layer(1.1, () => {
    const rd = { y: 950, amp: 26, freq: 0.0013, seed: 3 }, gy = x => ridgeY(rd, x) + 6;
    g.fillStyle = '#04050a'; ridge(g, rd); g.strokeStyle = '#04050a';
    g.fillRect(230, -200, 22, 1300);
    const cast = [
      [330, 205, { hat: 'tricorn', coat: true, armF: [0.2, 0.6] }], [470, 190, { hat: 'bonnet', skirt: true, armF: [0.3, 1.0] }], [600, 208, { hat: 'brim', armF: [0.3, 0.5], tool: { ang: 0.1, len: 52 } }],
      [740, 204, { hat: 'cap', broad: true, armF: [0.4, 1.1] }], [880, 196, { hat: 'bandana', armF: [2.5, 3.0] }], [1020, 208, { hat: 'brodie', pack: true, armF: [0.2, 0.5] }],
      [1160, 210, { hat: 'm1', broad: true, armF: [2.7, 2.2] }], [1440, 204, { hat: 'hardhat', armF: [0.3, 1.0] }], [1580, 196, { hat: 'none', armF: [2.4, 2.9] }], [1680, 122, { hat: 'none', armF: [2.6, 3.0], armB: [0.2, 0.3] }],
    ];
    for (const [x, h, o] of cast) ART.figure(g, x, gy(x), h, Object.assign({ face: 1, armB: [0, 0.25] }, o));
    astronaut(g, 1300, gy(1300), 215, 0);
    g.fillStyle = '#04050a'; g.globalAlpha = 0.9; ART.figure(g, 1300, gy(1300), 0.01, {}); g.globalAlpha = 1;
    ART.grass(g, { y: 990, t, n: 200, hMin: 20, hMax: 70, seed: 4 });
  });
  S.post = { sun, rays: 0.6, rayc: [1, 0.88, 0.66], th: 0.78, bloom: 0.5, streak: 0.3, expo: 1.0, sat: 1.15, vig: 0.6, shadow: [0.46, 0.5, 0.6], high: [0.62, 0.55, 0.42] };
};

// -----------------------------------------------------------------------------
// 35. Title
// -----------------------------------------------------------------------------
SCENES.title = S => {
  const { g, t } = S, cx = 960, cy = 440, K = 1560;
  S.cam = { x: 0, y: 0, z: 1.0 + 0.035 * S.p };
  g.fillStyle = '#01030a'; g.fillRect(0, 0, W, H);
  glow(g, 960, 520, 1200, [0.1, 0.2, 0.5], 0.35, 'lighter');
  starfield(g, t, 200, 0.35, 11);
  const on = seg(t, 0.2, 3.4, E.sine);
  S.layer(1, () => {
    MAPS.usaPath(g, cx, cy, K); g.fillStyle = 'rgba(10,22,50,0.9)'; g.fill();
    g.strokeStyle = css([0.85, 0.7, 0.4], 0.5 * on); g.lineWidth = 1.6; g.stroke();
    g.save(); g.globalCompositeOperation = 'lighter';
    // lights come on from the Atlantic westward, the way the country was built
    const lit = (lon, h) => clamp(on * 2.2 - (-66 - lon) / 58 - h * 0.35);
    MAPS.towns.forEach(([lo, la, w], i) => { const a = lit(lo, h1(i)); if (a <= 0) return; const p = MAPS.albers(lo, la, cx, cy, K); g.fillStyle = css([1, 0.8, 0.5], Math.min(1, a * (0.5 + 4 * w)) * (0.8 + 0.2 * Math.sin(t * 3 + i))); g.fillRect(p[0], p[1], 2.2, 2.2); });
    CITIES.slice(0, 64).forEach(([lo, la, w], i) => { const a = lit(lo, 0); if (a <= 0) return; const p = MAPS.albers(lo, la, cx, cy, K); glow(g, p[0], p[1], 8 + 30 * w, [1, 0.74, 0.4], 0.8 * a); g.fillStyle = css([1, 0.95, 0.85], a); circle(g, p[0], p[1], 1.4 + 1.8 * w); });
    g.restore();
  });
  S.post = { bloom: 0.9, th: 0.42, streak: 0.2, expo: 1.03 + 0.22 * Math.exp(-Math.max(0, t - hit) * 3) * (t > hit ? 1 : 0), con: 0.34, vig: 0.72, shadow: [0.42, 0.48, 0.66], high: [0.62, 0.55, 0.44] };
  // the card
  const hit = S.bar * 1.5;      // the last chord of the score
  const tx = S.tx, a1 = env(t, 1.6, 99, 1.8, 1) * S.ta, a2 = env(t, hit - 0.08, 99, 0.5, 1) * S.ta;
  tx.save();
  TYPE.setup(tx, '500 46px Cinzel', 20 + 6 * seg(t, 2, 11, E.out), 'center');
  TYPE.draw(tx, 'THE UNITED STATES OF AMERICA', W / 2 + 10, 842, a1);
  tx.fillStyle = css([0.85, 0.68, 0.36], a1); const rw = 300 * seg(t, 1.8, 4.4, E.out); tx.fillRect(W / 2 - rw, 872, rw * 2, 2);
  TYPE.setup(tx, '600 104px Cinzel', 22 + 8 * seg(t, hit, 11, E.out), 'center');
  TYPE.draw(tx, 'STILL BUILDING', W / 2 + 11, 990, a2);
  tx.restore();
};
