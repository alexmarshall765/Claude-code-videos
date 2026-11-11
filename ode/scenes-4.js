/* =============================================================================
 *  ODE — scene X (the next frontier) and the finale.
 *  Calm again: soft whites and blues, then one long pull-back into gold.
 * ========================================================================== */
(() => {
  'use strict';
  const O = window.ODE;
  const { W, H, TAU, clamp, lerp, E, seg, win, rng, hash, n1, fbm, flicker, col, mix, mix2, lin, rad, camera, sky, glow, flare, beam, rays, motes,
    haze, stars, clouds, hills, ridgeY, poly, rect, rrect, circle, ellipse, line, limb, strokeP, sample, bez, column, archPath, figure, crowd, F, txt } = O;
  const S = O.shots, P = O.props;

  /** The AI, drawn as a quiet presence of light rather than a machine. */
  P.orb = (c, x, y, r, t, k = 1, pulse = 0) => {
    const br = r * (1 + 0.04 * Math.sin(t * 1.6) + 0.12 * pulse);
    glow(x, y, br * 5.5, '#5a9cff', 0.3 * k); glow(x, y, br * 2.6, '#bfe0ff', 0.55 * k + 0.2 * pulse);
    c.save(); c.globalCompositeOperation = 'lighter';
    c.fillStyle = rad(x - br * 0.2, y - br * 0.25, 0, br, [[0, col('#ffffff', k)], [0.45, col('#d6ebff', 0.9 * k)], [0.8, col('#7fb8ff', 0.5 * k)], [1, col('#5a9cff', 0)]]);
    c.beginPath(); c.arc(x, y, br, 0, TAU); c.fill();
    c.lineWidth = Math.max(1, r * 0.03);
    for (let i = 0; i < 3; i++) { c.strokeStyle = col('#cfe6ff', 0.4 * k); c.beginPath(); c.ellipse(x, y, br * (1.35 + i * 0.22), br * (0.42 + i * 0.1), t * 0.25 * (i % 2 ? -1 : 1) + i * 1.1, 0, TAU); c.stroke(); }
    const R = rng(17);
    for (let i = 0; i < 16; i++) { const a = t * (0.3 + R() * 0.5) + R() * TAU, rr = br * (1.3 + R() * 1.4), px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.6; c.fillStyle = col('#ffffff', (0.4 + 0.5 * R()) * k); c.beginPath(); c.arc(px, py, Math.max(0.8, r * 0.035), 0, TAU); c.fill(); }
    c.restore();
  };

  // ---------------------------------------------------------------------------
  // X · THE NEXT FRONTIER
  // ---------------------------------------------------------------------------
  const PROT = (() => {
    const N = 420, pts = [];
    const w = (u, a, b) => clamp((u - a) / 0.03) * clamp((b - u) / 0.03);
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const cx = 150 * Math.sin(u * 5.1 * Math.PI + 0.4) + 70 * Math.sin(u * 11.3 * Math.PI), cy = 120 * Math.sin(u * 4.3 * Math.PI + 1.2) + 56 * Math.cos(u * 9.1 * Math.PI), cz = 150 * Math.cos(u * 3.7 * Math.PI) + 60 * Math.sin(u * 8.2 * Math.PI);
      const hel = 24 * Math.max(w(u, 0.04, 0.3), w(u, 0.42, 0.62), w(u, 0.74, 0.96)), ang = u * 230;
      pts.push([cx + hel * Math.cos(ang), cy + hel * Math.sin(ang), cz + hel * 0.4 * Math.sin(ang + 1), u, hel > 4]);
    }
    return pts;
  })();
  function protein(c, ox, oy, s, t, reveal, fold) {
    const th = t * 0.45, ct = Math.cos(th), st = Math.sin(th), N = PROT.length - 1;
    const pr = q => { // unfolded = a loose, noisy thread; folded = the structure
      const u = q[3], ux = (u - 0.5) * 900, uy = Math.sin(u * 40) * 30, uz = Math.cos(u * 33) * 30;
      const x = lerp(ux, q[0], fold), y = lerp(uy, q[1], fold), z = lerp(uz, q[2], fold);
      return [ox + (x * ct + z * st) * s, oy + y * s, -x * st + z * ct];
    };
    const pal = u => (u < 0.33 ? mix('#3a7bff', '#4fe0e6', u * 3) : u < 0.66 ? mix('#4fe0e6', '#f4f7ff', (u - 0.33) * 3) : mix('#f4f7ff', '#ffc86a', (u - 0.66) * 3));
    c.save(); c.lineCap = 'round';
    for (const pass of [0, 1]) for (let i = 0; i < N * reveal; i++) {
      const a = pr(PROT[i]), b = pr(PROT[i + 1]), front = (a[2] + b[2]) / 2 > 0;
      if (front !== (pass === 1)) continue;
      const depth = clamp(0.5 + (a[2] + b[2]) / 700), wd = (PROT[i][4] ? 9 : 4.5) * s * (0.6 + 0.6 * depth);
      c.strokeStyle = 'rgba(2,10,24,0.55)'; c.lineWidth = wd + 3; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
      c.strokeStyle = pal(PROT[i][3]); c.globalAlpha = 0.45 + 0.55 * depth; c.lineWidth = wd; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.globalAlpha = 1;
    }
    const tip = pr(PROT[Math.min(N, Math.floor(N * reveal))]);
    c.restore();
    return tip;
  }

  S.protein = (c, t, d, p) => {
    const L = camera(p, { z0: 1.0, z1: 1.09, fx: 1150, fy: 380 });
    const sx = 640, sy = 70, sw = 1100, sh = 590;
    const reveal = seg(t, 0.3, 2.6, E.io), fold = seg(t, 1.4, 4.6, E.io);
    let tip = [1190, 360];
    L(0.5, () => {
      c.fillStyle = '#04070d'; c.fillRect(-300, -300, 2500, 1500);
      c.fillStyle = rad(1190, 360, 80, 1300, [[0, '#12304c'], [0.5, '#081624'], [1, '#04070d']]); c.fillRect(-300, -300, 2500, 1500);
      // lab bench shapes
      const R = rng(9);
      for (let i = 0; i < 7; i++) { const x = 40 + i * 80; rrect(x, 520 - R() * 120, 40, 150 + R() * 120, 8, col('#16324a', 0.5)); }
      rect(-300, 660, 2500, 240, '#05090f'); c.fillStyle = 'rgba(120,190,255,0.2)'; c.fillRect(-300, 660, 2500, 2);
    });
    L(1, () => {
      // the display
      rrect(sx - 14, sy - 14, sw + 28, sh + 28, 18, '#080c12', 'rgba(140,190,240,0.3)', 2);
      c.save(); c.beginPath(); c.roundRect(sx, sy, sw, sh, 8); c.clip();
      c.fillStyle = rad(1190, 360, 40, 760, [[0, '#0e2a48'], [1, '#030912']]); c.fillRect(sx, sy, sw, sh);
      c.strokeStyle = 'rgba(100,170,240,0.08)'; c.lineWidth = 1; for (let i = 0; i < 30; i++) { c.beginPath(); c.moveTo(sx + i * 40, sy); c.lineTo(sx + i * 40, sy + sh); c.stroke(); c.beginPath(); c.moveTo(sx, sy + i * 40); c.lineTo(sx + sw, sy + i * 40); c.stroke(); }
      glow(1190, 350, 420, '#3a8adf', 0.25);
      tip = protein(c, 1190, 330, 1.35, t, reveal, fold);
      if (reveal < 1) { glow(tip[0], tip[1], 40, '#ffffff', 0.9); }
      // residue confidence along the chain
      for (let i = 0; i < 120; i++) { if (i / 120 > reveal) break; const v = 0.45 + 0.5 * fbm(i * 0.11, 5, 2) * (0.5 + 0.5 * fold); rect(sx + 40 + i * 8.5, sy + sh - 34 - v * 44, 5.5, v * 44, col(v > 0.7 ? '#4fe0e6' : v > 0.55 ? '#7fb8ff' : '#ffc86a', 0.85)); }
      const seqS = 'MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQAPILSRVGDGTQDNLSGAEKAVQVKVKALPDAQFEVVHSLAKWKRQTLGQHDFSAGEGLYTHMKALRPDEDRLSPLHSVYVDQWDWERVMGDGERQFSTLKSTVEAIWAGIKATEAAVSEEFGLAPFLPDQIHFVHSQELLSRYPDLDAKGRERAIAKDLGAVFLVGIGGKLSDGHRHDVRAPDYDDWSTPSELGHAGLNGDILVWNPVLEDAFELSSMGIRVDADTLKHQLALTGDEDRLELEWHQALLRGEMPQTIGGGIGQSRLTMLLLQLPHIGQVQAGVWPAAVRESVPSLL';
      c.font = `400 17px ${F.mono}`; c.fillStyle = 'rgba(160,210,255,0.55)'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      c.fillText(seqS.slice(Math.floor(t * 6) % 120, Math.floor(t * 6) % 120 + 100), sx + 40, sy + 40);
      c.restore();
      glow(1190, 700, 700, '#3a8adf', 0.12);
    });
    L(1.15, () => {
      // researcher and AI, side by side before the unknown
      const f = figure(420, 830, 600, { face: 1, fill: '#030509', rim: '#2c5c94', light: 1, robe: false, head: 'bun', armF: [0.7, 1.9], armB: [0.25, 0.3], stride: 0.25 });
      const ox = 700, oy = 430 + Math.sin(t * 1.2) * 8;
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) { c.strokeStyle = col('#bfe0ff', 0.22 * (1 - fold * 0.5)); c.lineWidth = 1.5; c.beginPath(); c.moveTo(ox, oy); c.quadraticCurveTo(900, 200 + i * 130, tip[0], tip[1]); c.stroke(); }
      c.restore();
      P.orb(c, ox, oy, 46, t, 1, 0.3 * Math.sin(t * 3) * (1 - fold));
    });
    motes({ n: 50, seed: 11, t, hex: '#bfe0ff', alpha: 0.4 });
  };

  S.doctor = (c, t, d, p) => {
    const L = camera(p, { z0: 1.0, z1: 1.09, fx: 1100, fy: 380 });
    const sx = 760, sy = 70, sw = 800, sh = 600, hx = 1040, hy = 330;
    const find = seg(t, 0.8, 1.6, E.out);
    L(0.5, () => {
      c.fillStyle = '#060a10'; c.fillRect(-300, -300, 2500, 1500);
      c.fillStyle = rad(1160, 360, 80, 1300, [[0, '#1a3348'], [0.5, '#0a1622'], [1, '#060a10']]); c.fillRect(-300, -300, 2500, 1500);
      rect(-300, 690, 2500, 200, '#070b11');
    });
    L(1, () => {
      rrect(sx - 14, sy - 14, sw + 28, sh + 28, 16, '#0a0e14', 'rgba(170,210,240,0.35)', 2);
      c.save(); c.beginPath(); c.roundRect(sx, sy, sw, sh, 6); c.clip();
      c.fillStyle = rad(1160, 370, 40, 620, [[0, '#16303f'], [1, '#04090e']]); c.fillRect(sx, sy, sw, sh);
      // a chest film: lungs, ribs, spine, heart
      const mx = 1160;
      for (const s of [-1, 1]) {
        c.fillStyle = rad(mx + s * 150, 360, 20, 250, [[0, 'rgba(190,225,240,0.5)'], [1, 'rgba(120,170,200,0.08)']]);
        c.beginPath(); c.moveTo(mx + s * 36, 170); c.bezierCurveTo(mx + s * 130, 120, mx + s * 280, 260, mx + s * 270, 520); c.bezierCurveTo(mx + s * 200, 580, mx + s * 80, 560, mx + s * 40, 520); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(220,240,250,0.4)'; c.lineWidth = 5; c.lineCap = 'round';
        for (let i = 0; i < 9; i++) { const y = 170 + i * 44; c.beginPath(); c.moveTo(mx + s * 14, y); c.bezierCurveTo(mx + s * 150, y - 46, mx + s * 280, y + 10, mx + s * 292, y + 90); c.stroke(); }
        c.lineWidth = 7; c.beginPath(); c.moveTo(mx + s * 10, 150); c.quadraticCurveTo(mx + s * 160, 120, mx + s * 300, 150); c.stroke();
      }
      c.fillStyle = 'rgba(220,240,250,0.3)'; for (let i = 0; i < 12; i++) c.fillRect(mx - 15, 120 + i * 44, 30, 34);
      c.fillStyle = 'rgba(200,225,240,0.22)'; c.beginPath(); c.ellipse(mx + 50, 450, 120, 100, -0.3, 0, TAU); c.fill();
      // what the model noticed
      if (find > 0) {
        const pu = 1 + 0.06 * Math.sin(t * 5);
        glow(hx, hy, 120, '#ffc86a', 0.35 * find);
        c.strokeStyle = col('#ffd98a', find); c.lineWidth = 3; c.beginPath(); c.arc(hx, hy, 46 * pu * (2 - find), 0, TAU); c.stroke();
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; c.beginPath(); c.moveTo(hx + Math.cos(a) * 56, hy + Math.sin(a) * 56); c.lineTo(hx + Math.cos(a) * 74, hy + Math.sin(a) * 74); c.stroke(); }
        strokeP([[hx + 40, hy - 30], [hx + 130, hy - 120], [sx + sw - 250, hy - 120]], seg(t, 1.3, 1.9), col('#ffd98a', 0.9), 2);
        const pa = seg(t, 1.7, 2.3);
        if (pa > 0) {
          rrect(sx + sw - 250, hy - 190, 226, 150, 10, col('#0a1a28', 0.9 * pa), col('#ffd98a', 0.7 * pa), 1.5);
          txt('WORTH A SECOND LOOK', sx + sw - 232, hy - 162, { size: 14.5, font: F.mono, weight: 500, align: 'left', color: '#ffe2a8', a: pa, track: 1.5 });
          for (let i = 0; i < 3; i++) rect(sx + sw - 232, hy - 138 + i * 22, [170, 130, 150][i] * seg(t, 1.9 + i * 0.15, 2.5 + i * 0.15), 5, col('#bfe0ff', 0.6 * pa));
          rect(sx + sw - 232, hy - 66, 190, 8, col('#16324a', pa)); rect(sx + sw - 232, hy - 66, 190 * 0.86 * seg(t, 2.2, 3.0), 8, col('#ffc86a', pa));
        }
      }
      c.restore();
      glow(1160, 700, 700, '#5aa8df', 0.12);
    });
    L(1.12, () => {
      // the physician decides; the model only points
      const f = figure(500, 830, 610, { face: 1, fill: '#93a7bd', rim: '#f4f9ff', light: 1, robe: false, tails: false, armF: [lerp(0.4, 1.45, seg(t, 1.6, 2.6)), lerp(1.6, 0.25, seg(t, 1.6, 2.6))], armB: [0.2, 0.35], stride: 0.2, nod: 0.05 });
      // white coat hem and stethoscope
      c.fillStyle = lin(380, 0, 620, 0, [[0, '#5a6c80'], [1, '#e8f0f8']]); c.beginPath(); c.moveTo(442, 560); c.lineTo(562, 560); c.lineTo(580, 750); c.lineTo(424, 750); c.closePath(); c.fill();
      c.strokeStyle = '#1c2a38'; c.lineWidth = 5; c.beginPath(); c.arc(510, 330, 34, 0.2, Math.PI - 0.2); c.stroke(); circle(510, 372, 9, '#1c2a38');
      P.orb(c, 1700, 250 + Math.sin(t * 1.1) * 8, 40, t, 1, find * (1 - seg(t, 1.6, 2.4)));
    });
    motes({ n: 40, seed: 19, t, hex: '#cfe6ff', alpha: 0.35 });
  };

  /** The child's corner. q = seconds since the question began; text: draw the words. */
  function alcove(c, t, q, text = true) {
    const pulse = Math.max(0, 1 - Math.abs(q - 2.3) * 1.6);
    c.fillStyle = lin(0, 0, 0, H, [[0, '#1a1428'], [1, '#120c18']]); c.fillRect(-300, -300, 2500, 1500);
    glow(330, 330, 760, '#ffa24a', 0.4); glow(1200, 380, 800, '#3a7adf', 0.25 + 0.1 * pulse);
    // window: the first stars
    c.save(); c.beginPath(); archPath(820, 1100, 250, 470); c.clip();
    c.fillStyle = lin(0, 100, 0, 470, [[0, '#0c1640'], [0.7, '#3a3a7a'], [1, '#a8607a']]); c.fillRect(800, 90, 320, 400);
    stars({ n: 40, seed: 3, t, x: 820, y: 110, w: 280, h: 300, size: 1.6 });
    c.restore();
    c.strokeStyle = '#0c0812'; c.lineWidth = 9; c.beginPath(); archPath(820, 1100, 250, 470); c.stroke(); c.beginPath(); c.moveTo(960, 110); c.lineTo(960, 470); c.moveTo(820, 300); c.lineTo(1100, 300); c.stroke();
    // shelves: scrolls below, books above
    rect(80, 180, 440, 12, '#0c0812'); rect(80, 330, 440, 12, '#0c0812'); rect(80, 480, 440, 12, '#0c0812');
    const R = rng(6);
    for (let i = 0; i < 11; i++) { const h = 80 + R() * 50; rect(96 + i * 38, 330 - h, 26 + R() * 8, h, ['#6a2c24', '#2c4a5a', '#7a5a2a', '#3a3050'][i % 4]); }
    for (let i = 0; i < 10; i++) { const h = 70 + R() * 50; rect(100 + i * 42, 180 - h, 28 + R() * 8, h, ['#3a3050', '#6a2c24', '#2c4a5a'][i % 3]); }
    for (let i = 0; i < 12; i++) { const x = 112 + (i % 6) * 68, y = 396 + Math.floor(i / 6) * 50; circle(x, y, 21, '#d9c08a'); circle(x, y, 8, '#8a6a34'); }
    // lamp
    rect(320, 520, 10, 190, '#0c0812'); poly([[270, 520], [380, 520], [356, 440], [294, 440]], '#ffca7a'); glow(325, 480, 200, '#ffb45a', 0.6 * flicker(t, 3, 0.04));
    // floor, rug, a bear
    c.fillStyle = lin(0, 690, 0, 804, [[0, '#241828'], [1, '#0c0810']]); c.fillRect(-300, 700, 2500, 300);
    c.fillStyle = '#5a2c34'; c.beginPath(); c.ellipse(900, 742, 520, 46, 0, 0, TAU); c.fill(); c.strokeStyle = '#c9a45a'; c.lineWidth = 3; c.beginPath(); c.ellipse(900, 742, 480, 38, 0, 0, TAU); c.stroke();
    circle(560, 706, 30, '#7a5a34'); circle(560, 664, 22, '#7a5a34'); circle(544, 646, 9, '#7a5a34'); circle(576, 646, 9, '#7a5a34');
    // the child, looking up
    const ask = seg(q, 0.3, 1.0);
    figure(790, 744, 330, { face: 1, fill: '#0a0710', rim: '#6f9fe6', light: 1, sit: true, child: true, head: 'long', nod: -0.34, bend: -0.06, armF: [lerp(0.8, 2.15, ask) + 0.05 * Math.sin(t * 2), 0.35], armB: [0.7, 0.9] });
    // the answerer
    const ox = 1210, oy = 392 + Math.sin(t * 1.1) * 9;
    P.orb(c, ox, oy, 58, t, 1, pulse);
    if (text) {
      const qa = win(q, 0.45, 30, 0.6) * (1 - 0.45 * seg(q, 2.3, 3.0));
      txt('“Why do the stars shine?”', 760, 560 - 14 * seg(q, 0.6, 3), { size: 46, font: F.serif, italic: true, color: '#ffe9c8', a: qa, blur: 14, glowColor: '#ffb45a' });
      const aa = seg(q, 2.3, 3.0);
      if (aa > 0) {
        c.save(); c.beginPath(); c.rect(900, 520, 900 * seg(q, 2.3, 3.5), 160); c.clip();
        txt('“Deep inside, they press tiny atoms together —', 1300, 574, { size: 38, font: F.serif, italic: true, color: '#e6f2ff', a: aa, blur: 16, glowColor: '#5a9cff' });
        txt('and what is left over becomes light.”', 1300, 624, { size: 38, font: F.serif, italic: true, color: '#e6f2ff', a: seg(q, 2.8, 3.5), blur: 16, glowColor: '#5a9cff' });
        c.restore();
      }
    }
  }

  S.child = (c, t, d, p) => {
    const L = camera(p, { z0: 1.0, z1: 1.07, fx: 1000, fy: 400 });
    L(1, () => alcove(c, t, t));
    motes({ n: 60, seed: 23, t, hex: '#ffe2b8', alpha: 0.5, x: 0, y: 0, w: 800, h: 700 });
    motes({ n: 40, seed: 29, t, hex: '#bfe0ff', alpha: 0.45, x: 800, y: 0, w: 1100, h: 700 });
  };

  const CODE = ['def think(question, memory):', '    context = recall(memory, question)', '    for step in range(depth):', '        thought = reason(context, question)',
    '        context = reflect(context, thought)', '        if confident(thought):', '            break', '    return explain(thought, kindly=True)', '',
    'while curious:', '    question = listen()', '    answer = think(question, all_we_have_learned)', '    share(answer)', '    all_we_have_learned += answer', '',
    '# the story isn\'t finished'];
  const horizonY = x => 548 + 64 * Math.pow((x - 960) / 1100, 2);

  S.horizon = (c, t, d, p) => {
    const dawn = seg(p, 0.42, 1.0, E.sine);
    c.fillStyle = '#02050b'; c.fillRect(0, 0, W, H);
    // sky beyond the new horizon
    c.save(); c.globalAlpha = dawn;
    c.fillStyle = lin(0, 0, 0, 560, [[0, '#030814'], [0.6, '#0c2a54'], [0.9, '#3a7ac8'], [1, '#bfe0ff']]); c.fillRect(0, 0, W, 620);
    stars({ n: 200, seed: 13, t, alpha: 0.8, h: 380 });
    c.restore();
    const sunY = horizonY(960) + 30 - 46 * dawn;
    glow(960, sunY, 1100 * dawn, '#7fb8ff', 0.5 * dawn); glow(960, sunY, 420 * dawn, '#fff2d0', 0.8 * dawn);
    rays(960, sunY, { n: 22, a0: Math.PI, a1: TAU, len: 1200, hex: '#cfe6ff', alpha: 0.1 * dawn, t, seed: 4, width: 0.4 });
    // the world below it
    c.fillStyle = col('#01030a', Math.min(1, dawn * 1.5)); c.beginPath(); c.moveTo(-10, H + 10); for (let x = -10; x <= W + 10; x += 20) c.lineTo(x, horizonY(x)); c.lineTo(W + 10, H + 10); c.fill();
    // code: each glyph lets go and becomes light on the horizon
    c.font = `400 29px ${F.mono}`; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    const cw = c.measureText('M').width, x0 = 250, y0 = 96, lh = 44;
    c.save(); c.globalCompositeOperation = 'lighter';
    let n = 0;
    CODE.forEach((s, i) => {
      const typed = clamp((p * 9 - i * 0.22)) * s.length; // the listing types itself first
      for (let j = 0; j < s.length; j++) {
        if (s[j] === ' ') continue;
        n++;
        if (j > typed) continue;
        const hx = x0 + j * cw, hy = y0 + i * lh, h1 = hash(n, 1), h2 = hash(n, 2), h3 = hash(n, 3);
        const leave = 0.3 + 0.34 * h1 + 0.1 * (1 - i / CODE.length), u = (p - leave) / 0.26;
        if (u <= 0) { c.fillStyle = col(i === CODE.length - 1 ? '#ffe2a8' : '#bfe0ff', 0.92); c.fillText(s[j], hx, hy); continue; }
        const tx = h2 * 2100 - 90, lift = Math.pow(h3, 5) * 330, ty = horizonY(tx) - 2 - lift;
        const e = E.io(clamp(u)), px = lerp(hx, tx, e) + Math.sin(u * 5 + h1 * 9) * 30 * (1 - e), py = lerp(hy, ty, e) - Math.sin(Math.PI * clamp(u)) * 60 * h3;
        if (u < 0.35) { c.fillStyle = col('#bfe0ff', 0.9 * (1 - u / 0.35)); c.fillText(s[j], px - cw / 2, py); }
        const a = clamp(u * 3) * (u < 1 ? 1 : 0.75 + 0.25 * Math.sin(t * 3 + n));
        c.fillStyle = col(lift > 20 ? '#ffffff' : '#dff0ff', a); c.beginPath(); c.arc(px, py, lift > 20 ? 1.6 : 2.2, 0, TAU); c.fill();
        if (n % 3 === 0) glow(px, py, 14, '#7fc0ff', 0.5 * a);
      }
    });
    c.restore();
    // the limb, drawn in light
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const [lw, a] of [[18, 0.1], [7, 0.25], [2, 0.9]]) { c.strokeStyle = col('#cfe8ff', a * dawn); c.lineWidth = lw; c.beginPath(); for (let x = -10; x <= W + 10; x += 20) { x === -10 ? c.moveTo(x, horizonY(x)) : c.lineTo(x, horizonY(x)); } c.stroke(); }
    c.restore();
    // two small figures on the rim of it, and the light beside them
    const who = seg(p, 0.7, 0.95);
    if (who > 0) {
      c.save(); c.globalAlpha = who;
      figure(700, horizonY(700) + 2, 74, { fill: '#01030a', robe: false, face: 1, armF: [0.3, 0.2], armB: [0.2, 0.2], stride: 0.2 });
      figure(742, horizonY(742) + 2, 46, { fill: '#01030a', robe: false, face: 1, child: true, armF: [2.3, 0.2], armB: [0.2, 0.2], stride: 0.2 });
      P.orb(c, 790, horizonY(790) - 50, 9, t, 1);
      c.restore();
    }
    flare(960, sunY, 1700 * dawn, '#dff0ff', 0.45 * dawn, 4);
  };

  // ---------------------------------------------------------------------------
  // FINALE — one move, from a child's question out to the stars
  // ---------------------------------------------------------------------------
  /** The library, in one-point perspective. Its far end is the child's alcove (drawn at 1/5 scale). */
  function library(c, t, zoom) {
    const cx = W / 2, cy = H / 2, FAR = 5;
    const X = (u, z) => cx + u * 960 / z, Y = (v, z) => cy + v * 402 / z;
    c.save(); c.translate(cx, cy); c.scale(zoom, zoom); c.translate(-cx, -cy);
    c.fillStyle = '#0a0706'; c.fillRect(-100, -100, W + 200, H + 200);
    // floor and vault
    c.fillStyle = lin(0, cy, 0, H, [[0, '#3a2a1c'], [1, '#120c08']]); poly([[X(-1, 1), Y(1, 1)], [X(1, 1), Y(1, 1)], [X(1, FAR), Y(1, FAR)], [X(-1, FAR), Y(1, FAR)]], c.fillStyle);
    c.fillStyle = lin(0, 0, 0, cy, [[0, '#0c0907'], [1, '#2a1c12']]); poly([[X(-1, 1), Y(-1, 1)], [X(1, 1), Y(-1, 1)], [X(1, FAR), Y(-1, FAR)], [X(-1, FAR), Y(-1, FAR)]], c.fillStyle);
    c.strokeStyle = 'rgba(255,220,160,0.14)'; c.lineWidth = 1.2 / Math.sqrt(zoom);
    for (let i = -6; i <= 6; i++) { c.beginPath(); c.moveTo(X(i / 6, 1), Y(1, 1)); c.lineTo(X(i / 6, FAR), Y(1, FAR)); c.stroke(); }
    const N = 9, zs = Array.from({ length: N + 1 }, (_, i) => 1 + (FAR - 1) * i / N);
    for (const z of zs) { c.beginPath(); c.moveTo(X(-1, z), Y(1, z)); c.lineTo(X(1, z), Y(1, z)); c.stroke(); }
    // skylights and their shafts
    for (let i = 0; i < N; i += 2) { const z0 = zs[i] + 0.1, z1 = zs[i + 1] - 0.05; poly([[X(-0.3, z0), Y(-1, z0)], [X(0.3, z0), Y(-1, z0)], [X(0.3, z1), Y(-1, z1)], [X(-0.3, z1), Y(-1, z1)]], 'rgba(160,190,255,0.5)'); const zm = (z0 + z1) / 2; beam(X(0, zm), Y(-1, zm), 500 / zm, X(-0.25, zm), Y(1, zm), 800 / zm, '#9fb8ff', 0.2, 0.02, 2); }
    // the two walls: bays of shelving, old and new side by side
    const R = rng(88);
    for (const side of [-1, 1]) for (let i = N - 1; i >= 0; i--) {
      const z0 = zs[i], z1 = zs[i + 1], kind = (i + (side > 0 ? 1 : 0)) % 3; // 0 scrolls · 1 screens · 2 books
      const q = (z, v) => [X(side, z), Y(v, z)];
      c.fillStyle = side < 0 ? lin(X(side, z0), 0, X(side, z1), 0, [[0, '#2a1a10'], [1, '#3a2616']]) : lin(X(side, z1), 0, X(side, z0), 0, [[0, '#3a2616'], [1, '#2a1a10']]);
      poly([q(z0, -1), q(z1, -1), q(z1, 1), q(z0, 1)], c.fillStyle);
      const rows = 6;
      for (let r = 0; r < rows; r++) {
        const v0 = -0.86 + r * 0.29, v1 = v0 + 0.25, za = z0 + (z1 - z0) * 0.08, zb = z1 - (z1 - z0) * 0.08;
        if (kind === 1) {
          const k = 0.75 + 0.25 * n1(t * 0.8 + i * 3 + r, side + 5);
          c.fillStyle = col(r % 2 ? '#bfe0ff' : '#8fc6ff', 0.75 * k); poly([q(za, v0), q(zb, v0), q(zb, v1), q(za, v1)], c.fillStyle);
          c.strokeStyle = 'rgba(10,30,60,0.5)'; c.lineWidth = 1.5 / zoom ** 0.5;
          for (let l = 1; l < 5; l++) { const vv = lerp(v0, v1, l / 5); c.beginPath(); c.moveTo(...q(lerp(za, zb, 0.1), vv)); c.lineTo(...q(lerp(za, zb, 0.1 + 0.8 * hash(i * 31 + r * 7 + l, 4)), vv)); c.stroke(); }
          const g = q((za + zb) / 2, (v0 + v1) / 2); glow(g[0], g[1], 130 / z0, '#5aa8ff', 0.3 * k);
        } else {
          poly([q(za, v0), q(zb, v0), q(zb, v1), q(za, v1)], '#120b07');
          const n = 7;
          for (let b = 0; b < n; b++) {
            const zc = lerp(za, zb, (b + 0.5) / n), zw = (zb - za) / n * 0.4;
            if (kind === 0) { const g = q(zc, (v0 + v1) / 2), rr = 402 * 0.085 / zc; c.fillStyle = '#d9c08a'; c.beginPath(); c.ellipse(g[0], g[1], rr * 0.45, rr, 0, 0, TAU); c.fill(); c.fillStyle = '#8a6a34'; c.beginPath(); c.ellipse(g[0], g[1], rr * 0.16, rr * 0.36, 0, 0, TAU); c.fill(); }
            else { const hh = 0.6 + 0.4 * R(); poly([q(zc - zw, lerp(v1, v0, hh)), q(zc + zw, lerp(v1, v0, hh)), q(zc + zw, v1), q(zc - zw, v1)], ['#6a2c24', '#2c4a5a', '#7a5a2a', '#3a3050', '#4a5a2c'][(b + r + i) % 5]); }
          }
        }
      }
      c.strokeStyle = 'rgba(255,214,150,0.35)'; c.lineWidth = 3 / z0; c.beginPath(); c.moveTo(...q(z0, -1)); c.lineTo(...q(z0, 1)); c.stroke();
    }
    // vault ribs
    for (const z of zs) { c.strokeStyle = 'rgba(255,214,150,0.22)'; c.lineWidth = 5 / z; c.beginPath(); c.ellipse(cx, Y(-1, z), 960 / z, 170 / z, 0, Math.PI, TAU); c.stroke(); }
    // reading tables, green-shaded lamps, readers
    for (let i = N - 1; i >= 1; i--) for (const side of [-1, 1]) {
      const z0 = zs[i] + 0.06, z1 = zs[i + 1] - 0.1, u0 = side * 0.2, u1 = side * 0.58;
      poly([[X(u0, z0), Y(0.62, z0)], [X(u1, z0), Y(0.62, z0)], [X(u1, z1), Y(0.62, z1)], [X(u0, z1), Y(0.62, z1)]], '#4a2e18');
      poly([[X(u0, z0), Y(0.62, z0)], [X(u1, z0), Y(0.62, z0)], [X(u1, z0), Y(1, z0)], [X(u0, z0), Y(1, z0)]], '#1c110a');
      const lx = X((u0 + u1) / 2, z0), ly = Y(0.52, z0); glow(lx, ly, 240 / z0, i % 2 ? '#ffc46a' : '#9fd0ff', 0.5); rect(lx - 16 / z0, ly - 6 / z0, 32 / z0, 10 / z0, i % 2 ? '#ffe2a8' : '#e6f4ff');
      if ((i + (side > 0 ? 1 : 0)) % 2 === 0) figure(X(side * 0.66, z0), Y(1, z0), 300 / z0, { fill: '#0c0705', rim: '#8a5a2a', light: -side, face: -side, sit: true, bend: 0.25, nod: 0.2, armF: [1.0, 0.9], armB: [0.8, 0.9], head: i % 3 ? 'plain' : 'long' });
    }
    // far wall and the alcove set into it
    c.save(); c.translate(cx, cy); c.scale(1 / FAR, 1 / FAR); c.translate(-cx, -cy);
    alcove(c, t, 99, false);
    c.restore();
    c.strokeStyle = '#1a100a'; c.lineWidth = 3; c.strokeRect(X(-1, FAR), Y(-1, FAR), 1920 / FAR, 804 / FAR);
    c.restore();
  }
  const libZoom = q => Math.exp(Math.log(5) * (1 - E.sine(clamp(q)))); // 5 -> 1

  S.pullback = (c, t, d, p, shot) => {
    const total = d + 16 * shot.beat; // this shot + the library shot share one camera move
    library(c, t, libZoom(t / total));
    motes({ n: 80, seed: 41, t, hex: '#ffe2b8', alpha: 0.5 });
  };
  S.library = (c, t, d, p, shot) => {
    const prev = 12 * shot.beat, total = prev + d;
    library(c, t + prev, libZoom((t + prev) / total));
    motes({ n: 120, seed: 41, t: t + prev, hex: '#ffe2b8', alpha: 0.6 });
  };

  S.city = (c, t, d, p) => {
    // a marble column becomes a tower of glass, and the camera keeps rising
    const pull = E.out(clamp(p * 1.15)), z = lerp(3.3, 1.0, pull), rise = E.io(clamp((p - 0.3) / 0.7)) * 240;
    const tx = 960, tb = 740, tw = 124, th = 600;
    const cam = fn => { c.save(); c.translate(tx, 420); c.scale(z, z); c.translate(-tx, -420 + rise); fn(); c.restore(); };
    const camD = (dp, fn) => { const zz = 1 + (z - 1) * dp; c.save(); c.translate(tx, 420); c.scale(zz, zz); c.translate(-tx, -420 + rise * dp); fn(); c.restore(); };
    camD(0.1, () => {
      sky([[0, '#02040c'], [0.5, '#0a1638'], [0.85, '#27407a'], [1, '#6a5a8a']], -400, 804);
      stars({ n: 420, seed: 31, t, alpha: 0.95, y: -500, h: 1100 });
      glow(1500, 60, 160, '#eef4ff', 0.7); circle(1500, 60, 32, '#f6f9ff');
    });
    const tower = (x, yb, w, h, seed, shade, lit = 0.5) => {
      c.fillStyle = shade; c.fillRect(x - w / 2, yb - h, w, h + 400);
      const R = rng(seed), cols = Math.max(2, Math.floor(w / 13)), rows = Math.floor(h / 15);
      for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) { const v = R(); if (v > lit) continue; c.fillStyle = v < lit * 0.25 ? 'rgba(190,225,255,0.9)' : 'rgba(255,214,140,0.85)'; c.fillRect(x - w / 2 + 4 + k * (w - 8) / cols, yb - h + 6 + r * 15, (w - 8) / cols - 3.5, 7.5); }
    };
    camD(0.4, () => { const R = rng(5); for (let i = 0; i < 40; i++) tower(-200 + i * 62 + R() * 20, 760, 44 + R() * 30, 150 + R() * 260, 100 + i, '#0e1a3a', 0.3); haze(420, 780, '#3a5aa0', 0, 0.35); });
    camD(0.7, () => { const R = rng(9); for (let i = 0; i < 24; i++) { const x = -160 + i * 100 + R() * 30; if (Math.abs(x - tx) < 150) continue; tower(x, 770, 60 + R() * 44, 230 + R() * 330, 200 + i, '#081028', 0.4); if (i % 3 === 0) { line(x, 770 - 560, x, 770 - 640, '#081028', 3); glow(x, 770 - 640, 18, '#ff4a3a', 0.5 + 0.5 * Math.sin(t * 4 + i)); } } });
    cam(() => {
      // the tower (and, for a moment, the column it grew from)
      const morph = seg(t, 0.5, 1.9, E.sine);
      c.fillStyle = lin(tx - tw / 2, 0, tx + tw / 2, 0, [[0, '#1a2c54'], [0.5, '#0c1630'], [1, '#060c1c']]); c.fillRect(tx - tw / 2, tb - th, tw, th + 300);
      const R = rng(71);
      for (let r = 0; r < 42; r++) for (let k = 0; k < 8; k++) { const v = R(); c.fillStyle = v < 0.5 ? 'rgba(255,220,150,0.9)' : v < 0.62 ? 'rgba(190,225,255,0.9)' : 'rgba(40,60,100,0.5)'; c.fillRect(tx - tw / 2 + 7 + k * 14, tb - th + 12 + r * 14, 9.5, 8); }
      poly([[tx - tw / 2, tb - th], [tx, tb - th - 70], [tx + tw / 2, tb - th]], '#0c1630'); line(tx, tb - th - 70, tx, tb - th - 150, '#0c1630', 4); glow(tx, tb - th - 150, 26, '#ff4a3a', 0.5 + 0.5 * Math.sin(t * 4));
      if (morph < 1) { c.save(); c.globalAlpha = 1 - morph; column(tx, tb + 40, tw, th + 40, { fill: '#8a6a44', lit: '#fff0cc', side: -1, flutes: 9 }); glow(tx - 30, tb - th / 2, 300, '#ffd590', 0.3); c.restore(); }
      // neighbours, a bridge, the river, the library with its lit portico
      const R2 = rng(13);
      for (let i = 0; i < 16; i++) { const x = -100 + i * 140 + R2() * 40; if (Math.abs(x - tx) < 130) continue; tower(x, 790, 84 + R2() * 50, 150 + R2() * 300, 300 + i, '#040816', 0.5); }
      c.fillStyle = lin(0, 780, 0, 900, [[0, '#0a1836'], [1, '#02040c']]); c.fillRect(-400, 786, 2800, 300);
      for (let i = 0; i < 70; i++) { const gx = R2() * 2400 - 240; c.fillStyle = col(i % 3 ? '#ffd28a' : '#bfe0ff', 0.25 + 0.3 * n1(t * 2 + i, 2)); c.fillRect(gx, 792 + R2() * 70, 3 + R2() * 5, 14 + R2() * 40); }
      c.strokeStyle = '#02040c'; c.lineWidth = 9; c.beginPath(); c.moveTo(-200, 800); c.lineTo(760, 800); c.stroke();
      c.lineWidth = 3; for (const bx of [140, 520]) { c.beginPath(); c.moveTo(bx, 800); c.lineTo(bx, 690); c.stroke(); c.beginPath(); c.moveTo(bx - 190, 800); c.quadraticCurveTo(bx - 60, 780, bx, 692); c.quadraticCurveTo(bx + 60, 780, bx + 190, 800); c.stroke(); }
      for (let i = 0; i < 30; i++) { const u = ((t * 0.12 + i / 30) % 1), x = -200 + u * 960; glow(x, 794, 9, i % 2 ? '#ffffff' : '#ff6a5a', 0.9); }
      // the library
      rect(1240, 716, 330, 80, '#0c0a10'); for (let i = 0; i < 8; i++) column(1262 + i * 41, 794, 16, 76, { fill: '#6a4a2a', lit: '#ffe6b0', side: 1 });
      poly([[1232, 718], [1405, 672], [1578, 718]], '#2a1c12'); glow(1405, 760, 240, '#ffc46a', 0.5);
    });
    motes({ n: 40, seed: 3, t, hex: '#bfd8ff', alpha: 0.35 });
  };

  S.orbit = (c, t, d, p) => {
    const e = E.io(clamp(p)), r = Math.exp(lerp(Math.log(1500), Math.log(170), e)), cx = 960, cy = lerp(440, 300, e) + r; // the limb stays in frame as the planet falls away
    c.fillStyle = '#01020a'; c.fillRect(0, 0, W, H);
    // stars drift outward as we fall away
    c.save(); c.translate(960, 402); c.scale(1.25 - 0.25 * e, 1.25 - 0.25 * e); c.translate(-960, -402);
    stars({ n: 700, seed: 51, t, alpha: 1, x: -400, y: -300, w: 2700, h: 1400, size: 1.5 });
    c.save(); c.translate(700, 250); c.rotate(-0.5); c.scale(4.5, 1); glow(0, 0, 330, '#6a7aff', 0.11); glow(60, 10, 160, '#ffd9b0', 0.08); c.restore();
    c.restore();
    // the sun comes round the limb
    const sa = -0.62, sunK = seg(p, 0.3, 1.0, E.sine), sx = cx + Math.cos(sa) * r * (0.99 + 0.08 * sunK), sy = cy + Math.sin(sa) * r * (0.99 + 0.08 * sunK);
    glow(sx, sy, 300 + 900 * sunK, '#ffc46a', 0.55 * sunK); glow(sx, sy, 120 + 300 * sunK, '#fff0c8', 0.9 * sunK);
    rays(sx, sy, { n: 24, a0: 0, a1: TAU, len: 900 + 900 * sunK, hex: '#ffdc9a', alpha: 0.16 * sunK, t, seed: 7, width: 0.4 });
    const pr = P.globe(c, cx, cy, r, lerp(20, -30, e), lerp(38, 24, e), t, { lights: 1, day: 0.25 + 0.35 * sunK });
    c.save(); c.beginPath(); c.arc(cx, cy, r * 1.3, 0, TAU); c.clip(); P.net(c, pr, t, 1, { pages: false, alpha: 0.8 - 0.3 * e }); c.restore();
    // golden arc of atmosphere on the sunward side
    c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = col('#ffd98a', 0.85 * sunK); c.lineWidth = 3 + 5 * sunK; c.beginPath(); c.arc(cx, cy, r + 1, sa - 0.9, sa + 0.9); c.stroke(); c.restore();
    circle(sx, sy, 8 + 30 * sunK, col('#fffdf0', sunK));
    flare(sx, sy, 600 + 1500 * sunK, '#ffe2b0', 0.55 * sunK, 5);
    flare(sx, sy, 300 + 500 * sunK, '#9fc8ff', 0.3 * sunK, 2);
  };

  S.gold = (c, t, d, p) => {
    const fill = seg(t, 0.0, 3.2, E.sine);
    const cx = 960, cy = 470, r = 170 * (1 - 0.3 * fill), sa = -0.62, sx = cx + Math.cos(sa) * r * 1.07, sy = cy + Math.sin(sa) * r * 1.07;
    c.fillStyle = '#01020a'; c.fillRect(0, 0, W, H);
    stars({ n: 500, seed: 51, t: t + 8, alpha: 1 - fill, x: -400, y: -300, w: 2700, h: 1400, size: 1.5 });
    P.globe(c, cx, cy, r, -30, 24, t + 8, { lights: 1 - fill, day: 0.6 });
    // golden light fills the frame
    c.fillStyle = rad(sx, sy, 0, 300 + 2400 * fill, [[0, col('#fffbe6', 1)], [0.25, col('#ffe9a8', 0.95 * (0.4 + 0.6 * fill))], [0.6, col('#f6c25a', 0.9 * fill)], [1, col('#d9963a', fill)]]);
    c.fillRect(0, 0, W, H);
    rays(sx, sy, { n: 30, a0: 0, a1: TAU, len: 2400, hex: '#fff3cf', alpha: 0.22, t: t * 1.5, seed: 7, width: 0.45 });
    glow(sx, sy, 700, '#ffffff', 0.7);
    motes({ n: 160, seed: 61, t, hex: '#ffffff', alpha: 0.8 * fill, size: 2.6 });
    // the last words
    const ink = '#3a2206';
    const a1 = seg(t, 2.3, 3.5, E.sine), a2 = seg(t, 3.5, 4.7, E.sine);
    txt('THE STORY ISN’T FINISHED.', W / 2, 356 + (1 - a1) * 10, { size: 58, font: F.display, weight: 500, color: ink, a: a1 * 0.92, track: 14 });
    txt('IT’S YOURS TO CONTINUE.', W / 2, 444 + (1 - a2) * 10, { size: 58, font: F.display, weight: 600, color: ink, a: a2 * 0.96, track: 14 });
    const a3 = seg(t, 4.6, 5.6);
    rect(W / 2 - 60, 508, 120, 1.5, col(ink, 0.5 * a3));
    txt('O D E', W / 2, 546, { size: 22, font: F.display, weight: 600, color: ink, a: 0.7 * a3, track: 12 });
  };
})();
