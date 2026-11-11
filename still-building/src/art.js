/* =============================================================================
 *  STILL BUILDING — the art kit: silhouettes and particles shared by the scenes.
 *  Everything is drawn with the current g.fillStyle so a scene sets one colour
 *  per depth layer (atmospheric perspective) and the kit stays palette-free.
 *  Unless noted, (x, y) is the point where the subject meets the ground and
 *  `s` is a uniform scale; subjects face +x and flip with face = -1.
 * ========================================================================== */
'use strict';
const ART = (() => {
  const both = g => { g.strokeStyle = g.fillStyle; g.lineCap = 'round'; g.lineJoin = 'round'; };

  function star(g, x, y, r, rot = -Math.PI / 2) {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = rot + i * Math.PI / 5, rr = i % 2 ? r * 0.382 : r;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath(); g.fill();
  }

  /** Spoked wheel centred at (x, y). */
  function wheel(g, x, y, r, rot = 0, spokes = 12, rim = 0.12) {
    both(g);
    g.lineWidth = r * rim;
    g.beginPath(); g.arc(x, y, r * (1 - rim / 2), 0, TAU); g.stroke();
    g.lineWidth = Math.max(1, r * 0.06);
    g.beginPath();
    for (let i = 0; i < spokes; i++) {
      const a = rot + i * TAU / spokes;
      g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.92);
    }
    g.stroke();
    circle(g, x, y, r * 0.2);
  }

  // ---------------------------------------------------------------------------
  // People
  // ---------------------------------------------------------------------------
  /**
   * Human silhouette, 100 units tall before scaling to h pixels.
   * o.walk   stride phase 0..1 (omit to stand)      o.face  1 | -1
   * o.hat    tricorn | brodie | m1 | brim | cap | bandana | hardhat | bonnet | wig
   * o.coat   long coat tails    o.skirt  long skirt    o.pack  back pack
   * o.armF / o.armB  [upper, fore] angles from straight down, + is forward
   * o.carry  rifle | sling | none          o.lean  radians, + forward
   * o.sit    seated (thighs forward)
   */
  function figure(g, x, y, h, o = {}) {
    const f = o.face || 1, u = h / 100;
    const walking = o.walk !== undefined && o.walk !== null;
    const sw = walking ? Math.sin(o.walk * TAU) : 0, cw = walking ? Math.cos(o.walk * TAU) : 0;
    g.save(); g.translate(x, y); g.scale(f * u, u);
    both(g);
    const bob = walking ? -Math.abs(cw) * 1.3 : 0;
    const hipY = (o.sit ? -34 : -50) + bob;
    g.translate(0, hipY); g.rotate(o.lean || 0); g.translate(0, -hipY);
    const shY = hipY - 32;
    const A = o.stride === undefined ? 0.42 : o.stride;
    const leg = (a, bend) => {
      const kx = Math.sin(a) * 24, ky = hipY + Math.cos(a) * 24, a2 = a - bend;
      const fx = kx + Math.sin(a2) * 26, fy = ky + Math.cos(a2) * 26;
      g.lineWidth = 7.4; g.beginPath(); g.moveTo(0, hipY); g.lineTo(kx, ky); g.lineTo(fx, fy); g.stroke();
      g.lineWidth = 4.6; g.beginPath(); g.moveTo(fx, fy - 0.5); g.lineTo(fx + 6.5, fy); g.stroke();
    };
    if (o.sit) { g.save(); g.translate(0, hipY); g.rotate(-(o.lean || 0)); g.translate(0, -hipY); leg(1.45, 1.45); leg(1.35, 1.4); g.restore(); }
    else if (!o.skirt) { leg(sw * A, walking ? Math.max(0, -cw) * 0.55 : 0); leg(-sw * A, walking ? Math.max(0, cw) * 0.55 : 0); }
    else {
      fillPoly(g, [[-6, hipY - 4], [6, hipY - 4], [13 + sw * 2, -2], [-12 + sw * 2, -2]]);
      g.lineWidth = 4; line(g, -3, -3, 3 + sw * 4, 0);
    }
    // torso
    const tw = o.broad ? 10 : 8.2;
    fillPoly(g, [[-tw, shY + 2], [-tw + 1.5, shY - 1.5], [tw - 1.5, shY - 1.5], [tw, shY + 2], [6.4, hipY + 3], [-6.4, hipY + 3]]);
    if (o.coat) fillPoly(g, [[-7.5, hipY - 6], [7.5, hipY - 6], [9, hipY + 20], [-11 - sw * 2, hipY + 21]]);
    if (o.pack) rrect(g, -17, shY, 10, 21, 3);
    // head
    const hx = 1.2, hy = shY - 11.5;
    g.lineWidth = 5; line(g, 0.5, shY, hx, hy + 4);
    circle(g, hx, hy, 6.6);
    const top = hy - 6;
    switch (o.hat) {
      case 'tricorn': fillPoly(g, [[-12, top + 5], [-6, top - 1.5], [0, top - 2.5], [8, top - 0.5], [14, top + 4.5], [4, top + 6], [-4, top + 6.5]]); rrect(g, -7.5, hy + 2, 4, 8, 2); break;
      case 'wig': circle(g, hx - 3.5, hy + 1, 5.6); rrect(g, -7.5, hy + 3, 3.6, 9, 1.6); break;
      case 'brodie': ellipse(g, hx, top + 4, 12, 2.6); ellipse(g, hx, top + 3, 7.5, 4.6); break;
      case 'm1': g.beginPath(); g.ellipse(hx, hy - 0.5, 8.6, 8.2, 0, Math.PI, 0); g.lineTo(hx + 9.6, hy + 1.2); g.lineTo(hx - 8.8, hy + 1.2); g.closePath(); g.fill(); break;
      case 'hardhat': g.beginPath(); g.ellipse(hx, hy - 1, 8, 7.6, 0, Math.PI, 0); g.lineTo(hx + 12, hy); g.lineTo(hx - 8, hy); g.closePath(); g.fill(); break;
      case 'brim': ellipse(g, hx, top + 4, 13, 2.2); rrect(g, hx - 6, top - 3.5, 12, 8, 3); break;
      case 'cap': g.beginPath(); g.ellipse(hx - 0.5, top + 4.4, 7.6, 5, 0, Math.PI, 0); g.closePath(); g.fill(); fillPoly(g, [[hx + 4, top + 3], [hx + 12, top + 5], [hx + 4, top + 5.5]]); break;
      case 'bandana': circle(g, hx - 0.5, hy - 1.2, 7.3); fillPoly(g, [[hx - 1, top - 0.5], [hx + 3, top - 5.5], [hx + 4, top], [hx + 8, top - 3.5], [hx + 5.5, top + 2.5]]); break;
      case 'bonnet': g.beginPath(); g.ellipse(hx - 1.5, hy - 0.5, 8.6, 8.4, 0, Math.PI * 0.5, Math.PI * 1.9); g.lineTo(hx + 8, hy + 3); g.closePath(); g.fill(); break;
      default: break;
    }
    // arms
    const arm = (ang, shoulderX) => {
      const [a, b] = ang;
      const ex = shoulderX + Math.sin(a) * 16, ey = shY + 3 + Math.cos(a) * 16;
      const hx2 = ex + Math.sin(b) * 16, hy2 = ey + Math.cos(b) * 16;
      g.lineWidth = 5.2; g.beginPath(); g.moveTo(shoulderX, shY + 3); g.lineTo(ex, ey); g.lineTo(hx2, hy2); g.stroke();
      return [hx2, hy2];
    };
    const hF = arm(o.armF || [-sw * 0.5 + 0.05, -sw * 0.5 + 0.4], 2);
    const hB = arm(o.armB || [sw * 0.5 - 0.05, sw * 0.5 + 0.25], -2);
    if (o.carry === 'rifle') { g.lineWidth = 2.4; line(g, hF[0] - 1, hF[1] + 4, hF[0] - 14, hF[1] - 46); }
    if (o.carry === 'sling') { g.lineWidth = 2.4; line(g, -7, shY + 22, -9, shY - 30); }
    g.restore();
    return { hF, hB };
  }

  /** A column of walking figures between x0 and x1 (wraps), on a ground function gy(x). */
  function column(g, { n, x0, x1, t, speed, h, seed = 1, gy, face = 1, opts = {}, vary = 0.08, jitter = 0.5 }) {
    const span = x1 - x0, gap = span / n;
    for (let i = 0; i < n; i++) {
      const r = h1(i * 7.13 + seed);
      let x = ((i * gap + (r - 0.5) * gap * jitter + t * speed * face) % span + span) % span + x0;
      const hh = h * (1 - vary + 2 * vary * h1(i * 3.7 + seed + 9));
      const o = typeof opts === 'function' ? opts(i, r) : opts;
      figure(g, x, gy ? gy(x) : 0, hh, Object.assign({ walk: (x / (hh * 0.62) * face + r) % 1, face }, o));
    }
  }

  // ---------------------------------------------------------------------------
  // Animals and wagons
  // ---------------------------------------------------------------------------
  /** Ox, shoulder about 60 units high. */
  function ox(g, x, y, s, ph = 0, face = 1) {
    g.save(); g.translate(x, y); g.scale(face * s, s); both(g);
    const sw = k => Math.sin((ph + k) * TAU);
    const leg = (lx, k) => {
      const a = sw(k) * 0.32, kx = lx + Math.sin(a) * 15, ky = -30 + Math.cos(a) * 15;
      const b = a - Math.max(0, -Math.cos((ph + k) * TAU)) * 0.5;
      g.lineWidth = 6.2; g.beginPath(); g.moveTo(lx, -32); g.lineTo(kx, ky); g.lineTo(kx + Math.sin(b) * 15, ky + Math.cos(b) * 15); g.stroke();
    };
    leg(-27, 0); leg(-20, 0.5); leg(20, 0.25); leg(27, 0.75);
    g.beginPath();
    g.moveTo(-36, -34); g.bezierCurveTo(-40, -60, -30, -62, -10, -60);
    g.bezierCurveTo(8, -58, 18, -68, 30, -64); g.bezierCurveTo(40, -62, 44, -58, 46, -54);
    g.lineTo(60, -50); g.bezierCurveTo(66, -46, 66, -38, 60, -35); g.lineTo(50, -36);
    g.bezierCurveTo(44, -34, 40, -30, 36, -28); g.bezierCurveTo(20, -24, -20, -24, -34, -28); g.closePath(); g.fill();
    g.lineWidth = 2.6; g.beginPath(); g.moveTo(48, -54); g.quadraticCurveTo(52, -66, 60, -64); g.stroke();
    g.lineWidth = 2.4; g.beginPath(); g.moveTo(-37, -52); g.quadraticCurveTo(-44, -40, -41 + sw(0.3) * 2, -22); g.stroke();
    g.restore();
  }
  /** Horse at a walk or trot, about 62 units at the withers. */
  function horse(g, x, y, s, ph = 0, face = 1) {
    g.save(); g.translate(x, y); g.scale(face * s, s); both(g);
    const leg = (lx, k, len = 17) => {
      const c = (ph + k) * TAU, a = Math.sin(c) * 0.45, kx = lx + Math.sin(a) * len, ky = -34 + Math.cos(a) * len;
      const b = a - Math.max(0, -Math.cos(c)) * 0.9;
      g.lineWidth = 4.6; g.beginPath(); g.moveTo(lx, -36); g.lineTo(kx, ky); g.lineTo(kx + Math.sin(b) * len, ky + Math.cos(b) * len); g.stroke();
    };
    leg(-24, 0); leg(-19, 0.5); leg(19, 0.3); leg(24, 0.8);
    g.beginPath();
    g.moveTo(-32, -38); g.bezierCurveTo(-36, -60, -24, -64, -8, -61); g.bezierCurveTo(6, -59, 14, -64, 24, -66);
    g.bezierCurveTo(30, -76, 36, -88, 44, -96); g.lineTo(49, -98); g.lineTo(49, -92); g.bezierCurveTo(56, -86, 62, -80, 64, -74);
    g.lineTo(59, -71); g.bezierCurveTo(52, -76, 48, -76, 45, -72); g.bezierCurveTo(42, -60, 38, -48, 30, -40);
    g.bezierCurveTo(14, -32, -18, -32, -32, -38); g.closePath(); g.fill();
    g.lineWidth = 3; g.beginPath(); g.moveTo(-33, -58); g.quadraticCurveTo(-46, -50, -44 + Math.sin(ph * TAU) * 3, -30); g.stroke();
    g.restore();
  }
  /** Prairie schooner. coverCss paints the canvas tilt separately (it glows when backlit). */
  function wagon(g, x, y, s, rot = 0, face = 1, coverCss = null) {
    g.save(); g.translate(x, y); g.scale(face * s, s); both(g);
    const body = g.fillStyle;
    if (coverCss) g.fillStyle = coverCss;
    g.beginPath(); g.moveTo(-64, -62); g.bezierCurveTo(-74, -128, -26, -136, 0, -131);
    g.bezierCurveTo(30, -137, 80, -128, 70, -62); g.closePath(); g.fill();
    g.fillStyle = body; g.strokeStyle = body;
    g.lineWidth = 2.2;
    for (const bx of [-38, -12, 14, 40]) { g.beginPath(); g.moveTo(bx - 2, -62); g.quadraticCurveTo(bx - 1, -110, bx + 2, -131); g.stroke(); }
    fillPoly(g, [[-62, -66], [66, -66], [60, -40], [-56, -40]]);
    rrect(g, 56, -74, 18, 8, 2);
    g.lineWidth = 4; line(g, 58, -42, 118, -36);
    wheel(g, -34, -27, 27, rot, 12); wheel(g, 36, -21, 21, rot * 1.28, 10);
    rrect(g, -6, -52, 14, 18, 3);
    g.restore();
  }

  // ---------------------------------------------------------------------------
  // Ships
  // ---------------------------------------------------------------------------
  /** 17th-century merchant ship under sail, heading -x (west). (x, y) = waterline amidships. */
  function ship(g, x, y, s, { t = 0, seed = 0, sailCss = null, roll = 0 } = {}) {
    g.save(); g.translate(x, y); g.rotate(roll); g.scale(s, s); both(g);
    const hull = g.fillStyle;
    // hull
    g.beginPath();
    g.moveTo(-124, 6); g.quadraticCurveTo(-150, -8, -156, -34); g.lineTo(-150, -50); g.lineTo(-98, -48); g.lineTo(-94, -36);
    g.lineTo(38, -36); g.lineTo(42, -56); g.lineTo(96, -58); g.lineTo(100, -78); g.lineTo(152, -84); g.lineTo(150, -44);
    g.quadraticCurveTo(146, -10, 134, 6); g.closePath(); g.fill();
    // lanterns / rail
    g.lineWidth = 3; line(g, 150, -84, 158, -100);
    // spars
    g.lineWidth = 5; line(g, -142, -46, -236, -86);
    const masts = [[-88, -48, -262], [4, -36, -318], [98, -78, -226]];
    for (const [mx, y0, y1] of masts) { g.lineWidth = 5; line(g, mx, y0, mx, y1); }
    // rigging
    g.lineWidth = 1.1; g.globalAlpha *= 0.85;
    for (const [mx, y0, y1] of masts) {
      for (const k of [-1, 1]) for (const d of [16, 26, 36]) line(g, mx, y1 + 60, mx + k * d, y0 + 2);
    }
    line(g, -236, -86, -88, -262); line(g, -88, -262, 4, -318); line(g, 4, -318, 98, -226); line(g, 98, -226, 152, -84);
    line(g, -236, -86, -88, -180); line(g, -200, -70, 4, -250);
    g.globalAlpha /= 0.85;
    // sails
    g.fillStyle = sailCss || hull;
    const puff = 0.5 + 0.5 * Math.sin(t * 0.6 + seed);
    const sail = (cx, top, bot, wt, wb, belly = 12) => {
      const b = belly * (0.8 + 0.3 * puff);
      g.beginPath();
      g.moveTo(cx - wt / 2, top); g.lineTo(cx + wt / 2, top);
      g.quadraticCurveTo(cx + wb / 2 - b, (top + bot) / 2, cx + wb / 2, bot);
      g.quadraticCurveTo(cx - b * 0.6, bot - b * 0.9, cx - wb / 2, bot);
      g.quadraticCurveTo(cx - wb / 2 - b * 1.5, (top + bot) / 2, cx - wt / 2, top);
      g.closePath(); g.fill();
    };
    sail(-88, -168, -78, 92, 108); sail(-88, -250, -176, 60, 86, 9);
    sail(4, -190, -66, 116, 134, 14); sail(4, -290, -198, 70, 108, 10);
    // lateen mizzen and spritsail
    g.beginPath(); g.moveTo(70, -214); g.quadraticCurveTo(98, -150, 146, -112); g.lineTo(94, -98); g.quadraticCurveTo(70, -150, 70, -214); g.fill();
    g.beginPath(); g.moveTo(-226, -86); g.lineTo(-176, -66); g.quadraticCurveTo(-184, -44, -196, -34); g.lineTo(-238, -52); g.closePath(); g.fill();
    g.fillStyle = hull; g.strokeStyle = hull;
    g.lineWidth = 3; line(g, -134, -168, -42, -168); line(g, -118, -250, -58, -250); line(g, -54, -190, 62, -190); line(g, -31, -290, 39, -290);
    // pennants
    const pen = (px, py, L) => {
      g.beginPath(); g.moveTo(px, py);
      for (let i = 0; i <= 8; i++) g.lineTo(px - (i / 8) * L, py + 3 + Math.sin(t * 5 + i * 0.9 + seed) * 3 * (i / 8));
      for (let i = 8; i >= 0; i--) g.lineTo(px - (i / 8) * L, py + 9 * (1 - i / 9) + Math.sin(t * 5 + i * 0.9 + seed) * 3 * (i / 8));
      g.closePath(); g.fill();
    };
    pen(4, -318, 46); pen(-88, -262, 30);
    g.restore();
  }

  /** Statue of Liberty with pedestal and star fort; (x, y) = centre of the base. ~930 units tall. */
  function statue(g, x, y, s, { base = true, flame = null } = {}) {
    g.save(); g.translate(x, y); g.scale(s, s); both(g);
    if (base) {
      fillPoly(g, [[-300, 0], [-270, -42], [-150, -42], [-128, -86], [128, -86], [150, -42], [270, -42], [300, 0]]);
      fillPoly(g, [[-112, -86], [-112, -150], [-96, -150], [-96, -196], [96, -196], [96, -150], [112, -150], [112, -86]]);
      fillPoly(g, [[-86, -196], [-70, -420], [70, -420], [86, -196]]);
      fillPoly(g, [[-92, -420], [-92, -444], [-78, -444], [-78, -470], [78, -470], [78, -444], [92, -444], [92, -420]]);
    }
    // robe
    g.beginPath();
    g.moveTo(-64, -468); g.bezierCurveTo(-72, -540, -60, -610, -54, -672);
    g.bezierCurveTo(-52, -705, -58, -730, -52, -752); g.lineTo(-30, -776); g.lineTo(-10, -786);
    g.lineTo(16, -786); g.bezierCurveTo(38, -780, 50, -770, 56, -752);
    g.bezierCurveTo(66, -728, 74, -702, 72, -674); g.bezierCurveTo(70, -640, 60, -628, 64, -600);
    g.bezierCurveTo(70, -550, 72, -510, 68, -468); g.closePath(); g.fill();
    // tablet (her left arm)
    g.save(); g.translate(58, -706); g.rotate(-0.2); rrect(g, -15, -42, 30, 78, 2); g.restore();
    // head and crown
    ellipse(g, 4, -806, 19, 24);
    rrect(g, -6, -790, 20, 12, 3);
    g.beginPath(); g.ellipse(4, -816, 22, 13, 0, Math.PI, 0); g.closePath(); g.fill();
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * (0.14 + 0.72 * i / 6), L = 50 + 6 * Math.sin(Math.PI * i / 6);
      const bx = 4 + Math.cos(a) * 17, by = -818 + Math.sin(a) * 10;
      fillPoly(g, [[bx - Math.sin(a) * 5, by + Math.cos(a) * 5], [bx + Math.sin(a) * 5, by - Math.cos(a) * 5], [4 + Math.cos(a) * L, -820 + Math.sin(a) * L]]);
    }
    // raised arm and torch
    fillPoly(g, [[-52, -752], [-28, -778], [-52, -866], [-80, -872], [-90, -860]]);
    fillPoly(g, [[-88, -862], [-58, -866], [-62, -888], [-84, -888]]);
    rrect(g, -79, -912, 12, 30, 2);
    fillPoly(g, [[-92, -912], [-54, -912], [-48, -924], [-98, -924]]);
    if (flame) g.fillStyle = flame;
    g.beginPath(); g.moveTo(-88, -924); g.bezierCurveTo(-98, -944, -84, -952, -76, -972);
    g.bezierCurveTo(-66, -952, -52, -944, -58, -924); g.closePath(); g.fill();
    g.restore();
  }

  /** Liberty Bell hanging from its yoke; (x, y) = pivot, ang = swing. ~300 units tall. */
  function bell(g, x, y, s, ang = 0, clap = 0) {
    g.save(); g.translate(x, y); g.scale(s, s); g.rotate(ang); both(g);
    rrect(g, -120, -14, 240, 58, 10);
    for (const k of [-1, 1]) rrect(g, k * 46 - 7, 30, 14, 40, 3);
    g.translate(0, 62);
    g.beginPath();
    g.moveTo(-40, 0); g.bezierCurveTo(-74, 8, -74, 70, -82, 126); g.bezierCurveTo(-88, 172, -112, 196, -124, 222);
    g.lineTo(-124, 238); g.lineTo(124, 238); g.lineTo(124, 222);
    g.bezierCurveTo(112, 196, 88, 172, 82, 126); g.bezierCurveTo(74, 70, 74, 8, 40, 0); g.closePath(); g.fill();
    g.save(); g.rotate(clap); g.lineWidth = 9; line(g, 0, 150, 0, 250); circle(g, 0, 258, 17); g.restore();
    g.restore();
  }

  // ---------------------------------------------------------------------------
  // Railroad
  // ---------------------------------------------------------------------------
  /** 4-4-0 "American" locomotive and tender; (x, y) = rail top under the cab. ~360 units long. */
  function loco(g, x, y, s, rot = 0, face = 1, funnel = true) {
    g.save(); g.translate(x, y); g.scale(face * s, s); both(g);
    // tender
    rrect(g, -196, -96, 100, 56, 4); fillPoly(g, [[-190, -96], [-176, -110], [-118, -108], [-104, -96]]);
    for (const wx of [-180, -156, -134, -110]) wheel(g, wx, -13, 13, rot * 2.3, 8, 0.2);
    rrect(g, -200, -44, 110, 8, 2);
    // frame, boiler, cab
    rrect(g, -86, -50, 236, 10, 2);
    rrect(g, -36, -102, 172, 50, 22);
    g.beginPath(); g.rect(-90, -130, 58, 84); g.rect(-80, -120, 16, 26); g.rect(-58, -120, 16, 26); g.fill('evenodd');
    rrect(g, -98, -138, 76, 9, 3);
    // domes, bell, stack, lamp
    for (const dx of [8, 62]) { g.beginPath(); g.arc(dx, -104, 12, Math.PI, 0); g.lineTo(dx + 12, -98); g.lineTo(dx - 12, -98); g.closePath(); g.fill(); rrect(g, dx - 3, -122, 6, 8, 2); }
    g.lineWidth = 2.5; g.beginPath(); g.arc(36, -112, 7, Math.PI, 0); g.stroke(); circle(g, 36, -112, 4.5);
    if (funnel) fillPoly(g, [[102, -100], [102, -128], [84, -168], [88, -178], [132, -178], [136, -168], [118, -128], [118, -100]]);
    else { rrect(g, 102, -168, 18, 70, 2); rrect(g, 98, -174, 26, 8, 2); }
    rrect(g, 128, -132, 22, 24, 3); rrect(g, 134, -110, 6, 12, 1);
    // cylinders, pilot
    rrect(g, 106, -48, 30, 18, 3);
    fillPoly(g, [[146, -46], [190, -3], [146, -3]]);
    g.lineWidth = 2; for (let i = 1; i < 5; i++) line(g, 146, -46 + i * 2, 146 + i * 9, -3);
    // wheels and rods
    const R = 31;
    wheel(g, -46, -R, R, rot, 14, 0.13); wheel(g, 26, -R, R, rot, 14, 0.13);
    wheel(g, 96, -13, 13, rot * 2.3, 8, 0.2); wheel(g, 126, -13, 13, rot * 2.3, 8, 0.2);
    const cx = Math.cos(rot) * 15, cy = Math.sin(rot) * 15;
    g.lineWidth = 4.5; line(g, -46 + cx, -R + cy, 26 + cx, -R + cy); line(g, 26 + cx, -R + cy, 112, -39);
    g.restore();
  }
  /** Simple rolling stock behind a locomotive. kind: box | coach | flat */
  function railcar(g, x, y, s, rot = 0, kind = 'box') {
    g.save(); g.translate(x, y); g.scale(s, s); both(g);
    if (kind === 'coach') {
      g.beginPath(); g.rect(-82, -104, 164, 62);
      for (let i = 0; i < 7; i++) g.rect(-70 + i * 21, -92, 12, 22);
      g.fill('evenodd'); rrect(g, -88, -112, 176, 10, 4);
    } else if (kind === 'box') { rrect(g, -80, -104, 160, 62, 3); }
    else { rrect(g, -80, -52, 160, 10, 2); }
    rrect(g, -84, -46, 168, 8, 2);
    for (const wx of [-62, -38, 38, 62]) wheel(g, wx, -13, 13, rot * 2.3, 8, 0.2);
    g.restore();
  }
  /** Track: rails and ties between x0 and x1 at height y. */
  function track(g, x0, x1, y, off = 0) {
    g.fillRect(x0, y, x1 - x0, 5);
    for (let x = x0 - ((off % 26) + 26) % 26; x < x1; x += 26) g.fillRect(x, y + 5, 12, 7);
  }
  /** Telegraph pole line. */
  function poles(g, x0, x1, y, { gap = 240, h = 150, off = 0, sag = 16 } = {}) {
    both(g);
    const xs = [];
    for (let x = x0 - ((off % gap) + gap) % gap; x < x1 + gap; x += gap) xs.push(x);
    for (const x of xs) { g.fillRect(x - 3, y - h, 6, h); g.fillRect(x - 22, y - h + 10, 44, 4); g.fillRect(x - 16, y - h + 26, 32, 4); }
    g.lineWidth = 1.2;
    for (let i = 0; i < xs.length - 1; i++) for (const [dx, dy] of [[-20, 10], [20, 10], [-14, 26], [14, 26]]) {
      g.beginPath(); g.moveTo(xs[i] + dx, y - h + dy); g.quadraticCurveTo((xs[i] + xs[i + 1]) / 2 + dx, y - h + dy + sag * 2, xs[i + 1] + dx, y - h + dy); g.stroke();
    }
  }

  // ---------------------------------------------------------------------------
  // Structures
  // ---------------------------------------------------------------------------
  /** Procedural skyline. Returns the building list so a scene can light windows. */
  function skyline(g, { x0 = -50, x1 = W + 50, base, hMin = 60, hMax = 300, wMin = 30, wMax = 90, seed = 1, grow = 1, era = 0, gap = 0, draw = true }) {
    const r = rng(seed * 7919 + 13), out = [];
    let x = x0;
    while (x < x1) {
      const w = lerp(wMin, wMax, r()), k = r();
      const h = lerp(hMin, hMax, k * k) * clamp(grow * (1.25 - 0.25 * r()));
      const top = r(), b = { x, w, h, top, s: r() };
      if (draw && h > 1) {
        g.fillRect(x, base - h, w, h + 2);
        if (era > 0 && top > 0.55 && w > 40) { // setbacks and spires on taller towers
          g.fillRect(x + w * 0.18, base - h * 1.12, w * 0.64, h * 0.14);
          if (top > 0.8) { g.fillRect(x + w * 0.36, base - h * 1.22, w * 0.28, h * 0.12); g.fillRect(x + w * 0.48, base - h * 1.36, Math.max(2, w * 0.04), h * 0.16); }
        } else if (top < 0.18) { fillPoly(g, [[x, base - h], [x + w / 2, base - h - w * 0.35], [x + w, base - h]]); }
        else if (top < 0.3) { g.fillRect(x + w * 0.3, base - h - 10, w * 0.14, 12); }
      }
      out.push(b);
      x += w + gap * r();
    }
    return out;
  }
  /** Lit windows for a skyline (additive). k = fraction of windows on. */
  function windows(g, list, base, { k = 1, col = [1, 0.8, 0.45], a = 0.9, seed = 3, cw = 5, ch = 7, gx = 11, gy = 14, t = 0 }) {
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const b of list) {
      if (b.h < 20) continue;
      const cols = Math.floor((b.w - 6) / gx), rows = Math.floor((b.h - 8) / gy);
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const h = h2(b.x * 0.37 + i * 1.7 + seed, j * 2.3 + b.w);
        if (h > k * 0.72) continue;
        const fl = 0.75 + 0.25 * h2(i + b.x, j + Math.floor(t * 0.5 + h * 9));
        g.fillStyle = css(col, a * fl * (0.5 + 0.5 * h2(i * 3.1 + b.x, j * 5.7)));
        g.fillRect(b.x + 4 + i * gx, base - b.h + 6 + j * gy, cw, ch);
      }
    }
    g.restore();
  }
  /** Suspension-bridge tower with twin gothic arches (Brooklyn Bridge). (x, y) = waterline centre. */
  function bridgeTower(g, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.beginPath();
    g.moveTo(-70, 0); g.lineTo(-62, -420); g.lineTo(-70, -428); g.lineTo(-70, -446); g.lineTo(70, -446); g.lineTo(70, -428); g.lineTo(62, -420); g.lineTo(70, 0); g.closePath();
    for (const k of [-1, 1]) { // arches cut out
      const cx = k * 27;
      g.moveTo(cx - 17, -170); g.lineTo(cx - 17, -330); g.quadraticCurveTo(cx - 17, -372, cx, -396); g.quadraticCurveTo(cx + 17, -372, cx + 17, -330); g.lineTo(cx + 17, -170); g.closePath();
    }
    g.fill('evenodd');
    g.fillRect(-84, -176, 168, 14);
    g.restore();
  }
  function barn(g, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s);
    fillPoly(g, [[-60, 0], [-60, -62], [-44, -92], [0, -112], [44, -92], [60, -62], [60, 0]]);
    g.fillRect(74, -150, 34, 150); g.beginPath(); g.arc(91, -150, 17, Math.PI, 0); g.fill();
    g.restore();
  }
  function windmill(g, x, y, s, rot) {
    g.save(); g.translate(x, y); g.scale(s, s); both(g);
    g.lineWidth = 3; line(g, -18, 0, -3, -150); line(g, 18, 0, 3, -150); line(g, -13, -50, 13, -50); line(g, -8, -100, 8, -100); line(g, -13, -50, 8, -100); line(g, 13, -50, -8, -100);
    g.translate(0, -152);
    fillPoly(g, [[0, -3], [46, -14], [46, 14], [0, 3]]);
    g.rotate(rot);
    for (let i = 0; i < 14; i++) { g.rotate(TAU / 14); fillPoly(g, [[5, -2], [34, -7], [34, 5]]); }
    g.restore();
  }
  function tree(g, x, y, s, seed = 0, bare = false) {
    g.save(); g.translate(x, y); g.scale(s, s); both(g);
    g.lineWidth = 9; line(g, 0, 0, 2, -70);
    if (bare) {
      const br = (x0, y0, a, L, w, d) => {
        const x1 = x0 + Math.sin(a) * L, y1 = y0 - Math.cos(a) * L;
        g.lineWidth = w; line(g, x0, y0, x1, y1);
        if (d > 0) { br(x1, y1, a - 0.5 - 0.3 * h1(seed + d * 3.1 + x1), L * 0.72, w * 0.62, d - 1); br(x1, y1, a + 0.45 + 0.3 * h1(seed + d * 7.7 + y1), L * 0.7, w * 0.62, d - 1); }
      };
      br(2, -60, -0.1, 46, 7, 4);
    } else {
      for (let i = 0; i < 9; i++) circle(g, (h1(seed + i) - 0.5) * 80, -90 - h1(seed + i * 3.3) * 70, 28 + h1(seed + i * 1.7) * 22);
    }
    g.restore();
  }
  /** Lattice derrick (oil) — (x, y) base centre. */
  function derrick(g, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s); both(g);
    g.lineWidth = 4; line(g, -34, 0, -7, -210); line(g, 34, 0, 7, -210);
    g.lineWidth = 2;
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = i / n, b = (i + 1) / n, wa = lerp(34, 7, a), wb = lerp(34, 7, b), ya = -210 * a, yb = -210 * b;
      line(g, -wa, ya, wa, ya); line(g, -wa, ya, wb, yb); line(g, wa, ya, -wb, yb);
    }
    g.fillRect(-11, -226, 22, 16); g.fillRect(-44, -4, 88, 6);
    g.restore();
  }

  // ---------------------------------------------------------------------------
  // Flags
  // ---------------------------------------------------------------------------
  const flagCache = {};
  /** Flat flag artwork on an offscreen canvas. kind: 13 (Betsy Ross) | 50 */
  function flagArt(kind) {
    if (flagCache[kind]) return flagCache[kind];
    const c = document.createElement('canvas'); c.width = 1140; c.height = 600;
    const g = c.getContext('2d'), sh = 600 / 13;
    for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? '#f2ece0' : '#b01f30'; g.fillRect(0, i * sh, 1140, sh + 1); }
    g.fillStyle = '#27305e'; g.fillRect(0, 0, 456, sh * 7);
    g.fillStyle = '#f2ece0';
    if (kind === 13) for (let i = 0; i < 13; i++) { const a = i * TAU / 13 - Math.PI / 2; star(g, 228 + Math.cos(a) * 112, sh * 3.5 + Math.sin(a) * 112, 25, a); }
    else for (let r = 0; r < 9; r++) for (let k = 0; k < (r % 2 ? 5 : 6); k++) star(g, 38 + (r % 2 ? 38 : 0) + k * 76, 32 + r * 32.4, 15);
    // weave: faint cloth texture so the flag never looks like a flat fill
    const r = rng(kind);
    g.globalAlpha = 0.05;
    for (let i = 0; i < 2600; i++) { g.fillStyle = r() > 0.5 ? '#000' : '#fff'; g.fillRect(r() * 1140, r() * 600, 30 + r() * 60, 1); }
    return (flagCache[kind] = c);
  }

  // ---------------------------------------------------------------------------
  // Particles (stateless: positions are functions of time)
  // ---------------------------------------------------------------------------
  /** Continuous fountain of streaks (sparks, embers). */
  function sparks(g, { x, y, t, n = 60, seed = 0, life = 1, spd = 300, grav = 500, dir = -Math.PI / 2, spread = 1, col = [1, 0.75, 0.35], size = 2, t0 = null, a = 1 }) {
    g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const r1 = h1(i * 1.37 + seed), r2 = h1(i * 2.91 + seed + 5), r3 = h1(i * 4.3 + seed + 9);
      let age, ph;
      if (t0 === null) { ph = ((t / life + r1) % 1 + 1) % 1; age = ph * life; }
      else { age = (t - t0) * (0.6 + 0.8 * r1); if (age < 0) continue; ph = age / life; if (ph > 1) continue; }
      const ang = dir + (r2 - 0.5) * spread, v = spd * (0.35 + 0.65 * r3);
      const vx = Math.cos(ang) * v, vy = Math.sin(ang) * v + grav * age;
      const px = x + Math.cos(ang) * v * age, py = y + Math.sin(ang) * v * age + 0.5 * grav * age * age;
      const al = a * (1 - ph) * (1 - ph);
      g.strokeStyle = css(col, al); g.lineWidth = size * (0.5 + r3);
      g.beginPath(); g.moveTo(px, py); g.lineTo(px - vx * 0.022, py - vy * 0.022); g.stroke();
    }
    g.restore();
  }
  /** Drifting motes (dust in light, embers, snow, confetti). */
  function motes(g, { t, n = 80, seed = 0, x = 0, y = 0, w = W, h = H, vx = 10, vy = -6, size = 2, col = [1, 0.9, 0.7], a = 0.6, sway = 20, op = 'lighter', tw = 1 }) {
    g.save(); g.globalCompositeOperation = op;
    for (let i = 0; i < n; i++) {
      const r1 = h1(i * 1.11 + seed), r2 = h1(i * 2.23 + seed + 3), r3 = h1(i * 3.71 + seed + 7);
      const px = x + (((r1 * w + t * vx * (0.5 + r3)) % w) + w) % w + Math.sin(t * (0.5 + r2) + r1 * 20) * sway;
      const py = y + (((r2 * h + t * vy * (0.5 + r1)) % h) + h) % h;
      const al = a * (0.35 + 0.65 * r3) * (1 - tw * 0.5 + tw * 0.5 * Math.sin(t * (1 + 3 * r2) + r3 * 30));
      g.fillStyle = css(col, Math.max(0, al));
      const s = size * (0.4 + 1.2 * r3);
      g.beginPath(); g.arc(px, py, s, 0, TAU); g.fill();
    }
    g.restore();
  }
  /** Soft puffs rising along a wind-bent path (steam, dust, chimney smoke). */
  function puffs(g, { x, y, t, n = 16, seed = 0, rise = 200, drift = 120, r0 = 10, r1 = 70, col = [0.8, 0.8, 0.8], a = 0.35, spd = 0.35, op = 'source-over', turb = 14 }) {
    g.save(); g.globalCompositeOperation = op;
    for (let i = 0; i < n; i++) {
      const r = h1(i * 3.3 + seed), ph = ((t * spd + i / n + r * 0.3) % 1 + 1) % 1;
      const px = x + drift * ph * ph + Math.sin(ph * 9 + r * 20 + t) * turb * ph, py = y - rise * ph;
      const rad = lerp(r0, r1, Math.sqrt(ph)) * (0.8 + 0.4 * r);
      const al = a * Math.sin(Math.min(1, ph * 6) * Math.PI / 2) * (1 - ph);
      const gr = g.createRadialGradient(px, py, 0, px, py, rad);
      gr.addColorStop(0, css(col, al)); gr.addColorStop(0.6, css(col, al * 0.5)); gr.addColorStop(1, css(col, 0));
      g.fillStyle = gr; g.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    }
    g.restore();
  }
  /** Grass blades along the bottom edge. */
  function grass(g, { y, t = 0, n = 220, hMin = 30, hMax = 90, seed = 0, x0 = -20, x1 = W + 20, wind = 10 }) {
    both(g);
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const r = h1(i * 1.9 + seed), x = lerp(x0, x1, (i + r) / n), hh = lerp(hMin, hMax, h1(i * 3.3 + seed + 2));
      const bend = Math.sin(t * 1.3 + x * 0.006 + r * 5) * wind + (r - 0.5) * 18;
      g.moveTo(x - 2.4, y); g.quadraticCurveTo(x + bend * 0.3, y - hh * 0.6, x + bend, y - hh); g.quadraticCurveTo(x + bend * 0.4, y - hh * 0.5, x + 2.4, y);
    }
    g.fill();
  }
  /** Fog band: horizontal gradient strip. */
  function haze(g, y0, y1, col, a0, a1 = 0) {
    g.save();
    g.fillStyle = vgrad(g, y0, y1, [[0, css(col, a0)], [1, css(col, a1)]]);
    g.fillRect(-200, Math.min(y0, y1), W + 400, Math.abs(y1 - y0)); g.restore();
  }

  return { star, wheel, figure, column, ox, horse, wagon, ship, statue, bell, loco, railcar, track, poles, skyline, windows, bridgeTower, barn, windmill, tree, derrick, flagArt, sparks, motes, puffs, grass, haze, both };
})();
