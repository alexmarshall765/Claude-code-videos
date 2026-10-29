// OBS 14 · ACT IV · THE PROOF — APOLLO. 24 seconds, the film's summit.
//   81–84  the Saturn V stacks stage by stage on the pad, with callouts
//   84.3   countdown, one number per beat
//   87.1   ignition: a white-cored, gold-edged plume; the camera tilts with the climb; staging
//   88–90  trajectory diagram: Earth orbit → translunar injection → lunar orbit → descent;
//          a landing-site crosshair locks on as the altitude readout runs to zero
//   91.1   touchdown. Stillness.   92  Earthrise.

import { scene, zoomAbout } from './common.js';
import { W, H, rgba } from '../theme.js';
import { ease, clamp, lerp, sub, span, TAU, mulberry32, noise1 } from '../engine.js';
import { stroke, circle, arcPts, bezierPts, pointAt, glow, dot, hatch, dimension, ellipsePts } from '../draw/paths.js';
import { camera3d, saturnV, nozzles, SATURN_GROUPS, SATURN_BASE } from '../draw/wireframe3d.js';
import { plume, billows, sparks, flameCone } from '../draw/particles.js';
import { globe } from '../draw/motif.js';
import { card, text } from '../draw/type.js';

// Shot A geometry (screen units at zoom 1)
const XR = 820, YB = 830, KF = 1.75; // rocket axis, nozzle-exit line, px per foot
const DECK = 834, GROUND = 872;
const TOWER_X = XR - 150;

// Shot B geometry
const E = [470, 600], RE = 200, RPARK = 250;
const MOON = [1490, 470], RM = 62, RLO = 100;
const LAND = [MOON[0] - 30, MOON[1] + 6];
const P_TLI = [E[0] + RPARK * Math.cos(-1.4), E[1] + RPARK * Math.sin(-1.4)];
const P_LOI = [MOON[0], MOON[1] + RLO];
const TRANS = bezierPts(P_TLI, [P_TLI[0] + 420, P_TLI[1] - 40], [P_LOI[0] - 330, P_LOI[1] + 60], P_LOI, 90);

// Times (local seconds) of the shot boundaries
const LIFT = 12.3;      // hold-down release, a sixteenth after ignition
const A_OUT = 15.0;     // shot A has handed over to the diagram
const B_IN = 14.45;
const C_IN = 20.0;      // touchdown: hard cut to the surface

const altitudeFt = t => (t < LIFT ? 0 : 85 * Math.pow(t - LIFT, 2));
const rocketCam = t => camera3d({ cx: XR, by: YB - altitudeFt(t) * KF, k: KF, yc: 150, D: 1300, yaw: 0.55 + 0.11 * t });
const SEP = 14.0;      // staging, on 88.1
const HANDOFF = 14.3;  // the climb starts handing over to the diagram
const rocketMid = t => YB - (altitudeFt(t) + 180) * KF;

/** Pad camera: slow push through stacking and countdown, then a tilt that follows the climb. */
function camPad(t) {
  const push = 1 + 0.03 * span(t, 0, 7, ease.inOut) + 0.05 * span(t, 7, 12, ease.inOut);
  const base = zoomAbout(XR + 60, 600, push);
  const follow = span(t, 12.6, 13.5, ease.inOut);
  const pull = span(t, 13.2, 14.4, ease.inOut);
  const shake = t > 12.0 && t < 13.2 ? 5 * Math.exp(-(t - 12.0) / 0.35) * noise1(t * 38, 5) : 0;
  return { x: lerp(base.x, XR + 230, follow) + shake, y: lerp(base.y, rocketMid(t) + 40, follow), zoom: lerp(push, 0.84, pull) };
}

export default scene('14_apollo', {
  camera(s) {
    const t = s.t;
    if (t >= C_IN) return zoomAbout(960, 620, 1 + 0.035 * span(t, C_IN, 24, ease.sineInOut));
    if (t >= A_OUT) return { x: W / 2, y: H / 2, zoom: 1 };
    if (t < HANDOFF) return camPad(t);
    // Hand-off: the camera pulls far back while carrying the rocket onto the top of the
    // diagram's Earth, where it becomes the craft.
    const c0 = camPad(HANDOFF), e = span(t, HANDOFF, A_OUT - 0.05, ease.inOut);
    const zoom = Math.exp(lerp(Math.log(c0.zoom), Math.log(0.07), e));
    const S0 = [W / 2 + (XR - c0.x) * c0.zoom, H / 2 + (rocketMid(HANDOFF) - c0.y) * c0.zoom];
    const S = [lerp(S0[0], E[0], e), lerp(S0[1], E[1] - RE, e)];
    return { x: XR - (S[0] - W / 2) / zoom, y: rocketMid(t) - (S[1] - H / 2) / zoom, zoom };
  },

  draw(ctx, s) {
    const t = s.t;
    s.bloom = 0.46;
    // Space after the climb: navy glow and stars.
    const space = span(t, 13.0, 15.0);
    s.bg = { navy: 0.55 * space, stars: 0.25 + 0.55 * space };
    if (t < A_OUT) shotA(ctx, s, t);
    if (t >= B_IN && t < C_IN) {
      // The diagram has its own camera, which pushes into the landing site.
      const cb = camB(t);
      s.cam2 = cb;
      s.screen(() => {
        for (const g of [ctx, s.ui]) { g.save(); g.translate(W / 2, H / 2); g.scale(cb.zoom, cb.zoom); g.translate(-cb.x, -cb.y); }
        shotB(ctx, s, t);
        for (const g of [ctx, s.ui]) g.restore();
        overlayB(s, t);
      });
    }
    if (t >= C_IN) shotC(ctx, s, t);
    // Words, in screen space.
    s.screen(() => {
      card(s, 'card_moon', { lines: ['WE CHOOSE TO GO', 'TO THE MOON'], x: 1330, y: 300, size: 96 });
      card(s, 'attrib_kennedy', { x: 1330, y: 452, size: 26, alpha: 0.85 });
      card(s, 'card_left', { lines: ['WE LEFT', 'THE EARTH.'], x: 1370, y: 380, size: 120 });
      card(s, 'card_eagle', { x: 960, y: 196, size: 104 });
      card(s, 'data_landing', { x: 960, y: 296, size: 30, voice: 'dataBold' });
    });
  },
});

/** Diagram camera: holds while the craft crosses, then pushes into the landing site. */
function camB(t) {
  const e = span(t, 17.5, 19.0, ease.inOut);
  const zoom = Math.exp(Math.log(6) * e) * (1 + 0.18 * span(t, 19.0, 20.0, ease.sineInOut));
  return { x: lerp(W / 2, LAND[0], e), y: lerp(H / 2, LAND[1], e), zoom };
}

// ---------------------------------------------------------------------------
// Shot A: the pad
// ---------------------------------------------------------------------------
function shotA(ctx, s, t) {
  const fadeA = 1 - span(t, 14.3, 14.6);
  const fadeRocket = 1 - span(t, 14.7, 14.95);
  ctx.save();
  ctx.globalAlpha *= fadeA;
  const h = altitudeFt(t);
  const yaw = 0.55 + 0.11 * t;
  const cam = camera3d({ cx: XR, by: YB - h * KF, k: KF, yc: 150, D: 1300, yaw });

  // Ground, deck and flame trench
  const pad = s.cue('pad', ease.out);
  stroke(ctx, [[-400, GROUND], [2400, GROUND]], pad, { pen: { color: 'GOLD', alpha: 0.7, width: 1.6 }, tip: false });
  hatch(ctx, [[-400, GROUND], [2400, GROUND], [2400, GROUND + 60], [-400, GROUND + 60]], pad, { angle: -Math.PI / 4, gap: 14, alpha: 0.1 });
  stroke(ctx, [[XR - 170, GROUND], [XR - 170, DECK], [XR - 40, DECK]], pad, { pen: 'structure', tip: false });
  stroke(ctx, [[XR + 40, DECK], [XR + 170, DECK], [XR + 170, GROUND]], pad, { pen: 'structure', tip: false });
  hatch(ctx, [[XR - 170, DECK], [XR - 40, DECK], [XR - 40, GROUND], [XR - 170, GROUND]], pad, { angle: Math.PI / 4, gap: 7, alpha: 0.3 });
  hatch(ctx, [[XR + 40, DECK], [XR + 170, DECK], [XR + 170, GROUND], [XR + 40, GROUND]], pad, { angle: Math.PI / 4, gap: 7, alpha: 0.3 });

  // Launch umbilical tower with its swing arms
  towerAndArms(ctx, s, t);

  // Construction: the vehicle's axis, and a station line for each stage as it is set.
  const axis = s.env(0, 0.8, ease.out) * (1 - 0.8 * span(t, 6.5, 7.5));
  stroke(ctx, [[XR, YB + 20], [XR, YB - 380 * KF]], axis, { pen: 'construction', tip: false, dash: [6, 7] });

  // Stacking: each group is lowered onto its seat and lands on its cue.
  const hits = s.hits('stack');
  const gp = [], dy = [];
  hits.forEach((hh, i) => {
    const land = hh.t0;
    if (i === 0) { gp[0] = span(t, land, land + 1.1, ease.inOut); dy[0] = 0; return; }
    gp[i] = span(t, land - 0.55, land + 0.35, ease.inOut);
    dy[i] = 34 * (1 - span(t, land - 0.55, land, ease.out));
    const sy = YB - SATURN_BASE[i] * KF;
    const st = span(t, land - 0.6, land - 0.2) * (1 - span(t, land + 0.3, land + 1.0));
    if (st > 0) stroke(ctx, [[XR - 70, sy], [XR + 70, sy]], st, { pen: 'construction', tip: false });
  });
  // Staging: the first stage drops away below the climbing stack.
  const sep = t >= SEP ? t - SEP : -1;
  const edge = span(t, 5.5, 6.5) * (1 - span(t, 11.8, 12.2));
  if (sep < 0) saturnV(ctx, cam, gp, dy, { yaw, edge });
  else {
    ctx.save(); ctx.globalAlpha = fadeRocket;
    saturnV(ctx, cam, gp, dy, { yaw, hide: [0] });
    ctx.restore();
    const fall = 320 * sep * sep + 70 * sep;
    ctx.save();
    const piv = cam.project(0, 70 - fall, 0);
    ctx.translate(piv[0], piv[1]); ctx.rotate(0.35 * sep * sep); ctx.translate(-piv[0], -piv[1]);
    saturnV(ctx, camera3d({ cx: XR, by: YB - (h - fall) * KF, k: KF, yc: 150, D: 1300, yaw }), [1], [], { yaw, hide: [1, 2, 3, 4, 5] });
    // Its engines gutter out as it falls.
    for (const [x, y] of nozzles(camera3d({ cx: XR, by: YB - (h - fall) * KF, k: KF, yc: 150, D: 1300, yaw }), 0)) flameCone(ctx, x, y, 140 * Math.exp(-sep / 0.12), 8, 22, Math.exp(-sep / 0.1));
    ctx.restore();
    const ring = cam.project(0, 138, 0);
    const k = Math.exp(-sep / 0.18);
    if (k > 0.02) { glow(ctx, ring[0], ring[1], 90 * k + 20, 'GOLD_HOT', 0.7 * k); circle(ctx, ring[0], ring[1], 40 + 160 * sep, 1, { pen: { color: 'GOLD_HOT', alpha: 0.7 * k, width: 2 }, tip: false }); }
  }

  // Callouts and the overall dimension
  const call = s.cue('callouts', ease.out) * (1 - span(t, 11.6, 12.1));
  if (call > 0) {
    SATURN_GROUPS.forEach((gr, i) => {
      const q = sub(call, (5 - i) * 0.08, (5 - i) * 0.08 + 0.55);
      if (q <= 0) return;
      const y = YB - gr.labelY * KF, x0 = XR + gr.r * KF + 8;
      stroke(ctx, [[x0, y], [905, y]], q, { pen: { color: 'GOLD', alpha: 0.6, width: 1 }, tip: false });
      dot(ctx, x0, y, 2.6, 'GOLD_HOT', q);
      text(s.ui, gr.name, 918, y, { voice: 'data', size: 24, align: 'left', alpha: 0.85 * sub(q, 0.5, 1), scale: s.S, reveal: i2 => ease.out(clamp((t - 6.0 - (5 - i) * 0.1 - i2 * 0.012) / 0.25)) });
    });
    // Overall height, dimensioned clear of the tower with dashed extension lines.
    const DX = TOWER_X - 78;
    stroke(ctx, [[XR - 4, YB - 363 * KF], [DX - 12, YB - 363 * KF]], call, { pen: 'construction', tip: false, dash: [4, 6] });
    stroke(ctx, [[XR - 40, YB], [DX - 12, YB]], call, { pen: 'construction', tip: false, dash: [4, 6] });
    dimension(ctx, s.ui, DX, YB, DX, YB - 363 * KF, call, { alpha: 0.8 });
  }
  card(s, 'data_height', { x: TOWER_X - 100, y: YB - 182 * KF, size: 30, voice: 'dataBold', align: 'right' });

  // Countdown: one number per beat, from 84.3.
  s.screen(() => {
    card(s, 'data_countdown', { x: 1350, y: 418, size: 30 });
    s.hits('countdown').forEach((hh, i) => {
      const end = i < 9 ? hh.t1 : hh.t0 + 0.5;
      if (t < hh.t0 || t > end + 0.06) return;
      const kIn = ease.expoOut(clamp((t - hh.t0) / 0.18)), kOut = 1 - clamp((t - end) / 0.06);
      const sc = 1.12 - 0.12 * kIn;
      s.lineCtx.save();
      s.lineCtx.translate(1350, 560); s.lineCtx.scale(sc, sc); s.lineCtx.translate(-1350, -560);
      text(s.lineCtx, String(10 - i), 1350, 560, { voice: 'title', size: 160, alpha: kIn * kOut, fact: 'structural:countdown', scale: s.S });
      s.lineCtx.restore();
    });
  });

  // Ignition and the climb
  if (t >= 12.0) ignition(ctx, s, t, cam, sep, fadeRocket);
  ctx.restore();
  // The vehicle becomes the craft: a point of light carried onto the diagram's Earth.
  if (t > 14.55) {
    const k = span(t, 14.55, 14.9), z = s.cam.zoom;
    ctx.save(); ctx.globalAlpha = 1 - span(t, 14.97, 15.0);
    glow(ctx, XR, rocketMid(t), 26 / z, 'GOLD_HOT', 0.8 * k);
    dot(ctx, XR, rocketMid(t), 3.4 / z, 'WHITE', k);
    ctx.restore();
  }
}

function towerAndArms(ctx, s, t) {
  const pad = s.cue('pad', ease.out);
  const q = sub(pad, 0.1, 1);
  const top = YB - 395 * KF;
  const L = { color: 'GOLD', alpha: 0.85, width: 1.5 };
  stroke(ctx, [[TOWER_X - 24, DECK], [TOWER_X - 24, top]], q, { pen: L, tip: false });
  stroke(ctx, [[TOWER_X + 24, DECK], [TOWER_X + 24, top]], q, { pen: L, tip: false });
  ctx.strokeStyle = rgba('GOLD', 0.4); ctx.lineWidth = 1;
  ctx.beginPath();
  const n = 18, step = (DECK - top) / n;
  for (let i = 0; i < n * q; i++) {
    const y0 = DECK - i * step, y1 = y0 - step;
    ctx.moveTo(TOWER_X - 24, y0); ctx.lineTo(TOWER_X + 24, y1);
    ctx.moveTo(TOWER_X + 24, y0); ctx.lineTo(TOWER_X - 24, y1);
    ctx.moveTo(TOWER_X - 24, y1); ctx.lineTo(TOWER_X + 24, y1);
  }
  ctx.stroke();
  // Hammerhead crane
  stroke(ctx, [[TOWER_X - 60, top], [TOWER_X + 70, top], [TOWER_X + 70, top + 14], [TOWER_X - 60, top + 14]], sub(pad, 0.7, 1), { pen: L, closed: true, tip: false });
  // Swing arms: retract on the "arms" cue, just before ignition.
  const swing = s.cue('arms', ease.inOut);
  [60, 100, 140, 175, 205, 232, 262, 290, 322].forEach((ft, i) => {
    const y = YB - ft * KF;
    const reach = (XR - (ft < 212 ? 16.5 : ft < 280 ? 10.85 : 6.4) * KF) - (TOWER_X + 24);
    const a = -swing * (1.05 + 0.1 * (i % 3));
    const x1 = TOWER_X + 24 + Math.cos(a) * reach, y1 = y + Math.sin(a) * reach;
    const appear = sub(pad, 0.4 + i * 0.04, 0.6 + i * 0.04) * clamp(s.since('1.3') + 0.5);
    stroke(ctx, [[TOWER_X + 24, y], [x1, y1]], appear, { pen: { color: 'GOLD', alpha: 0.9, width: 1.8 }, tip: false });
    stroke(ctx, [[TOWER_X + 24, y + 6], [x1, y1 + 6]], appear, { pen: { color: 'GOLD', alpha: 0.45, width: 1 }, tip: false });
  });
}

function ignition(ctx, s, t, cam, sep, fadeRocket = 1) {
  const ig = t - 12.0;
  s.flash = 0.8 * Math.exp(-ig / 0.14);
  s.glow = 0.55 * Math.exp(-ig / 0.6) + 0.14;
  s.bloom = 0.56;
  const thrust = span(t, 12.0, 12.3, ease.out);
  // The plume never shows below the deck: it goes down the flame trench.
  ctx.save();
  ctx.beginPath(); ctx.rect(-4000, -40000, 9000, 40000 + DECK + 2); ctx.clip();
  if (sep < 0) {
    for (const [x, y] of nozzles(cam, 0)) {
      const fl = 0.5 + 0.5 * noise1(t * 31 + x, 3);
      flameCone(ctx, x, y, (230 + 120 * thrust) * (0.92 + 0.12 * fl), 9, 30 + 6 * fl, thrust);
    }
    plume(ctx, t, {
      seed: 87, rate: 700, t0: 12.0, t1: SEP, life: [0.25, 0.7],
      nozzle: (born, i) => nozzles(rocketCam(born), 0)[i % 5],
      dir: Math.PI / 2, spread: 0.45, speed: 1500 * (0.6 + 0.4 * thrust), drag: 2.0, size: 4.2, coreU: 0.15, alpha: 0.8,
    });
  }
  ctx.restore();
  // Second stage: five smaller flames once the first stage has fallen clear.
  if (sep >= 0.22) {
    const k = span(t, SEP + 0.22, SEP + 0.4, ease.out) * fadeRocket;
    for (const [x, y] of nozzles(cam, 138)) flameCone(ctx, x, y, 170 * (0.95 + 0.1 * noise1(t * 29 + x, 9)), 6, 18, k);
  }
  // Ground cloud: scalloped billows racing out of the trench, both ways, and rising.
  for (const [seed, x0, dir] of [[32, XR - 190, Math.PI], [33, XR + 190, 0]]) {
    billows(ctx, t, { seed, rate: 34, t0: 12.05, t1: 13.4, life: [1.6, 3.0], source: () => [x0, GROUND - 8], dir, spread: 0.35, speed: 560, r0: 14, grow: 90, alpha: 0.42, width: 1.3, drag: 1.25, rise: 46, scallop: true });
  }
  billows(ctx, t, { seed: 31, rate: 24, t0: 12.0, t1: 12.9, life: [1.2, 2.2], source: (b, i) => [XR + (i % 2 ? 1 : -1) * (40 + (i % 5) * 18), DECK - 4], dir: -Math.PI / 2, spread: 1.6, speed: 120, r0: 10, grow: 60, alpha: 0.38, width: 1.2, drag: 1.4, rise: 20, scallop: true });
  sparks(ctx, t, { seed: 41, rate: 120, t0: 12.0, t1: 13.0, life: [0.4, 1.0], source: (b, i) => [XR + (i % 2 ? 1 : -1) * 180, GROUND - 6], dir: -Math.PI / 2, spread: 2.2, speed: 760, gravity: 1200, alpha: 0.9 });
}

// ---------------------------------------------------------------------------
// Shot B: the trajectory diagram
// ---------------------------------------------------------------------------
function shotB(ctx, s, t) {
  const fadeIn = span(t, B_IN, B_IN + 0.45, ease.out);
  ctx.save();
  ctx.globalAlpha *= fadeIn;
  s.bloom = 0.5;
  const rot = t * 0.22;
  // Earth: the motif circle as a globe; it draws on from the top, where the rocket was.
  const ep = span(t, B_IN, 15.3, ease.inOut);
  globe(ctx, E[0], E[1], RE, ep, rot, { night: 1, sun: Math.PI * 0.95, phase: -0.15, a0: -Math.PI / 2, sym: true });
  // Parking orbit
  const po = span(t, 14.9, 15.6, ease.inOut);
  circle(ctx, E[0], E[1], RPARK, po, { pen: { color: 'GOLD', alpha: 0.55, width: 1.2 }, tip: false, a0: -Math.PI / 2 });
  // Ascent from the top of the Earth into the parking orbit
  const asc = bezierPts([E[0], E[1] - RE], [E[0] + 10, E[1] - RE - 40], [E[0] + 60, E[1] - RPARK - 6], [E[0] + RPARK * Math.cos(-1.3), E[1] + RPARK * Math.sin(-1.3)], 30);
  const ap = span(t, 15.0, 15.3, ease.inOut);
  stroke(ctx, asc, ap, { pen: { color: 'GOLD_HOT', alpha: 0.95, width: 2 }, tip: false });
  // The craft: up from the pad, one orbit, then translunar injection at 16.0 (89.1).
  let craft = t >= 15.0 && t < 15.3 ? pointAt(asc, ap) : null;
  const orbitP = span(t, 15.3, 16.0, ease.linear);
  if (t >= 15.3 && t < 16.0) {
    const a = -1.3 + orbitP * (TAU - 0.1);
    craft = [E[0] + RPARK * Math.cos(a), E[1] + RPARK * Math.sin(a)];
    stroke(ctx, arcPts(E[0], E[1], RPARK, -1.3, a, 120), 1, { pen: { color: 'GOLD_HOT', alpha: 0.8, width: 1.8 }, tip: false });
  }
  const preZoom = 1 - span(t, 17.3, 17.6);
  if (t >= 15.3) text(s.ui, 'EARTH ORBIT', E[0], E[1] + RPARK + 40, { voice: 'data', size: 24, alpha: 0.85 * span(t, 15.3, 15.7) * preZoom, scale: s.S });
  // Translunar coast
  const tli = s.cue('tli', ease.out);
  const coast = span(t, 16.0, 17.1, ease.inOut);
  if (t >= 16.0) {
    ctx.save(); ctx.globalAlpha *= 1 - span(t, 17.9, 18.4);
    stroke(ctx, arcPts(E[0], E[1], RPARK, -1.3, -1.3 + TAU - 0.1, 120), 1, { pen: { color: 'GOLD_HOT', alpha: 0.5, width: 1.4 }, tip: false });
    const tip = stroke(ctx, TRANS, coast, { pen: { color: 'GOLD_HOT', alpha: 0.95, width: 2.2 }, tip: false });
    craft = coast < 1 ? (tip || pointAt(TRANS, coast)) : craft;
    const k = Math.exp(-(t - 16.0) / 0.25);
    glow(ctx, P_TLI[0], P_TLI[1], 60 * k + 10, 'GOLD_HOT', 0.8 * k + 0.15 * tli);
    text(s.ui, 'TRANSLUNAR INJECTION', P_TLI[0] + 40, P_TLI[1] - 46, { voice: 'data', size: 24, align: 'left', alpha: 0.85 * span(t, 16.0, 16.4) * preZoom, scale: s.S });
    ctx.restore();
  }
  // The Moon and lunar orbit
  const lw = Math.pow(s.cam2.zoom, -0.85);
  const mp = span(t, 16.2, 16.9, ease.inOut);
  moonDisc(ctx, s, MOON[0], MOON[1], RM, mp, lw);
  const lo = span(t, 17.0, 17.7, ease.inOut);
  const thin = 1 - span(t, 17.9, 18.4);
  if (lo > 0 && thin > 0) {
    ctx.save(); ctx.globalAlpha *= thin;
    const a = Math.PI / 2 - lo * (TAU * 0.62);
    stroke(ctx, arcPts(MOON[0], MOON[1], RLO, Math.PI / 2, a, 120), 1, { pen: { color: 'GOLD_HOT', alpha: 0.8, width: 1.6 }, tip: false });
    circle(ctx, MOON[0], MOON[1], RLO, lo, { pen: 'construction', tip: false, a0: Math.PI / 2, dir: -1 });
    if (t < 17.75) craft = [MOON[0] + RLO * Math.cos(a), MOON[1] + RLO * Math.sin(a)];
    text(s.ui, 'LUNAR ORBIT', MOON[0], MOON[1] - RLO - 34, { voice: 'data', size: 24, alpha: 0.85 * sub(lo, 0.2, 0.6) * (1 - span(t, 17.6, 17.9)), scale: s.S });
    ctx.restore();
  }
  // Descent to the surface
  const des = s.cue('descent', ease.inOut);
  if (t >= 18.0) {
    const a0 = Math.PI / 2 - TAU * 0.62 * 1;
    const start = [MOON[0] + RLO * Math.cos(a0), MOON[1] + RLO * Math.sin(a0)];
    const arc = bezierPts(start, [start[0] + 30, start[1] - 10], [LAND[0] - 26, LAND[1] - 30], LAND, 60);
    const tip = stroke(ctx, arc, Math.max(0.001, ease.out(des)), { pen: { color: 'GOLD_HOT', alpha: 0.95, width: 2 * lw }, tip: false });
    craft = des < 1 ? tip : null;
    if (craft) lmIcon(ctx, craft[0], craft[1], 0.14, 1, lw);
  }
  if (craft && t < 18.0) { glow(ctx, craft[0], craft[1], 22, 'GOLD_HOT', 0.7); dot(ctx, craft[0], craft[1], 3.2, 'WHITE', 1); }
  ctx.restore();
}

/** Altitude readout and the landing-site crosshair, in screen space. */
function overlayB(s, t) {
  if (t < 18.0) return;
  const alt = Math.round((50000 * Math.pow(1 - clamp((t - 18.0) / 2.0), 1.6)) / 10) * 10;
  card(s, 'data_altitude', { text: alt > 0 ? `ALT ≈ ${alt.toLocaleString('en-US')} FT` : 'ALT 0 FT', x: 150, y: 820, size: 30, align: 'left', voice: 'dataBold' });
  crosshair(s, t);
}

function moonDisc(ctx, s, cx, cy, r, p, lw = 1) {
  if (p <= 0) return;
  circle(ctx, cx, cy, r, p, { pen: { color: 'GOLD_HOT', alpha: 0.95, width: 2.2 * lw }, tip: p < 1 });
  const q = sub(p, 0.4, 1);
  if (q <= 0) return;
  // Maria, engraved; Tranquility on the left of the face.
  const R = mulberry32(1969);
  const maria = [[-0.42, 0.05, 0.36, 0.26], [-0.1, -0.35, 0.3, 0.2], [0.25, 0.1, 0.28, 0.22], [-0.25, 0.42, 0.22, 0.14]];
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r - 0.5, 0, TAU); ctx.clip();
  maria.forEach(([u, v, a, b], i) => {
    const pts = ellipsePts(cx + u * r, cy + v * r, a * r, b * r, R() * 0.6, 0, TAU, 40);
    hatch(ctx, pts, sub(q, i * 0.1, i * 0.1 + 0.5), { angle: -Math.PI / 3, gap: Math.max(0.8, 3.2 * lw), alpha: 0.35, width: 0.8 * lw });
    stroke(ctx, pts, sub(q, i * 0.1, i * 0.1 + 0.5), { pen: { color: 'GOLD', alpha: 0.4, width: 0.8 * lw }, tip: false });
  });
  // Close in, the landing site gets its own small craters.
  const close = clamp((s.cam2 ? s.cam2.zoom : 1) / 2 - 0.6);
  if (close > 0) {
    const R2 = mulberry32(2017);
    for (let i = 0; i < 40; i++) {
      const u = LAND[0] + (R2() - 0.5) * 70, v = LAND[1] + (R2() - 0.5) * 60, rr = 0.8 + R2() * 3.2;
      if (Math.hypot(u - cx, v - cy) > r - rr - 1) continue;
      stroke(ctx, ellipsePts(u, v, rr, rr * 0.85, 0, 0, TAU, 14), 1, { pen: { color: 'GOLD', alpha: 0.5 * close, width: 1.1 * lw }, tip: false });
    }
  }
  for (let i = 0; i < 22; i++) {
    const u = (R() - 0.5) * 1.7, v = (R() - 0.5) * 1.7;
    if (u * u + v * v > 0.8) continue;
    const rr = (0.03 + R() * 0.07) * r;
    stroke(ctx, ellipsePts(cx + u * r, cy + v * r, rr, rr * 0.85, 0, 0, TAU, 18), sub(q, 0.4, 1), { pen: { color: 'GOLD', alpha: 0.45, width: 1.1 * lw }, tip: false });
  }
  ctx.restore();
}

/** The landing-site crosshair: only here, because here we are aiming. */
function crosshair(s, t) {
  const g = s.ui, cam = s.cam2;
  const x = (LAND[0] - cam.x) * cam.zoom + W / 2, y = (LAND[1] - cam.y) * cam.zoom + H / 2;
  const conv = span(t, 18.45, 19.0, ease.inOut);
  const lock = t >= 19.0 ? 1 : 0;
  const a = span(t, 18.35, 18.6) * (1 - span(t, 19.85, 20.0));
  if (a <= 0) return;
  const r = lerp(260, 48, conv);
  const col = lock ? 'GOLD_HOT' : 'GOLD';
  const P = { color: col, alpha: 0.9 * a, width: lock ? 2 : 1.4 };
  circle(g, x, y, r, 1, { pen: P, tip: false });
  for (let k = 0; k < 4; k++) {
    const ang = (k * Math.PI) / 2 + (1 - conv) * 0.8;
    stroke(g, [[x + Math.cos(ang) * (r + 8), y + Math.sin(ang) * (r + 8)], [x + Math.cos(ang) * (r + 34), y + Math.sin(ang) * (r + 34)]], 1, { pen: P, tip: false });
    stroke(g, [[x + Math.cos(ang) * (r - 8), y + Math.sin(ang) * (r - 8)], [x + Math.cos(ang) * (r * 0.45), y + Math.sin(ang) * (r * 0.45)]], 1, { pen: { ...P, alpha: 0.5 * a, width: 1 }, tip: false });
  }
  // Brackets snap in on the lock.
  const snap = lock ? ease.expoOut(clamp((t - 19.0) / 0.2)) : 0;
  const b = lerp(r + 70, r + 18, snap), L = 18;
  if (lock) for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    stroke(g, [[x + sx * b, y + sy * (b - L)], [x + sx * b, y + sy * b], [x + sx * (b - L), y + sy * b]], 1, { pen: { color: 'GOLD_HOT', alpha: 0.95 * a, width: 2 }, tip: false });
  }
  if (lock) glow(g, x, y, 60 * Math.exp(-(t - 19.0) / 0.2) + 6, 'GOLD_HOT', 0.6);
  if (snap > 0) {
    g.fillStyle = rgba('INK', 0.75 * a * snap);
    g.fillRect(x - 150, y + r + 40, 300, 36);
  }
  text(g, 'TRANQUILITY BASE', x, y + r + 58, { voice: 'data', size: 24, alpha: 0.95 * a * snap, scale: s.S });
}

/** The lunar module in line art. Anchor = surface point between the footpads. */
function lmIcon(g, x, y, sc, p, lw = 1) {
  const M = (u, v) => [x + u * sc * 10, y + v * sc * 10];
  const P = { color: 'GOLD_HOT', alpha: 1, width: 1.6 * lw };
  stroke(g, [M(-6, -3), M(-4.6, -6.6), M(4.6, -6.6), M(6, -3), M(4.6, -1.6), M(-4.6, -1.6)], p, { pen: P, closed: true, tip: false });
  stroke(g, [M(-3.6, -6.6), M(-4.2, -9.8), M(-1.4, -12), M(2.6, -11.6), M(4.4, -8.8), M(3.6, -6.6)], p, { pen: P, tip: false });
  for (const sd of [-1, 1]) {
    stroke(g, [M(sd * 5.2, -2.6), M(sd * 8.6, 0)], p, { pen: P, tip: false });
    stroke(g, [M(sd * 7.6, 0), M(sd * 9.6, 0)], p, { pen: P, tip: false });
  }
}

/** The lunar module, larger and engraved, for the surface shot. */
function lander(g, x, y, sc, p) {
  const M = (u, v) => [x + u * sc, y + v * sc];
  const S = { color: 'GOLD_HOT', alpha: 1, width: 2.2 };
  const F = { color: 'GOLD', alpha: 0.85, width: 1.4 };
  // Silhouette first, so the horizon behind does not show through.
  g.fillStyle = rgba('INK', 1);
  g.beginPath();
  [M(-56, -22), M(-46, -58), M(-40, -58), M(-46, -92), M(-22, -112), M(20, -112), M(42, -96), M(38, -58), M(46, -58), M(56, -22), M(46, -14), M(-46, -14)].forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])));
  g.closePath(); g.fill();
  // Descent stage
  const ds = [M(-56, -22), M(-46, -58), M(46, -58), M(56, -22), M(46, -14), M(-46, -14)];
  stroke(g, ds, sub(p, 0, 0.4), { pen: S, closed: true, tip: false });
  hatch(g, ds, sub(p, 0.3, 0.6), { angle: Math.PI / 3, gap: 5, alpha: 0.35 });
  // Legs and footpads
  for (const sd of [-1, 1]) {
    stroke(g, [M(sd * 48, -30), M(sd * 92, 0)], sub(p, 0.2, 0.5), { pen: S, tip: false });
    stroke(g, [M(sd * 40, -16), M(sd * 82, -6)], sub(p, 0.25, 0.55), { pen: F, tip: false });
    stroke(g, ellipsePts(...M(sd * 92, 1), 13 * sc, 3.2 * sc, 0, 0, TAU, 24), sub(p, 0.4, 0.6), { pen: S, tip: false });
  }
  stroke(g, [M(-8, -14), M(-10, 2)], sub(p, 0.35, 0.55), { pen: F, tip: false }); // probe
  // Ascent stage
  const as = [M(-40, -58), M(-46, -92), M(-22, -112), M(20, -112), M(42, -96), M(38, -58)];
  stroke(g, as, sub(p, 0.4, 0.8), { pen: S, closed: true, tip: false });
  stroke(g, [M(-30, -92), M(-16, -104), M(-4, -104), M(-4, -88), M(-30, -88)], sub(p, 0.6, 0.85), { pen: F, closed: true, tip: false });
  hatch(g, [M(20, -112), M(42, -96), M(38, -58), M(16, -58)], sub(p, 0.6, 0.9), { angle: -Math.PI / 4, gap: 5, alpha: 0.3 });
  // Antenna dish
  stroke(g, [M(18, -112), M(28, -134)], sub(p, 0.75, 0.9), { pen: F, tip: false });
  stroke(g, ellipsePts(...M(31, -140), 11 * sc, 5 * sc, -0.5, 0, TAU, 20), sub(p, 0.8, 1), { pen: F, tip: false });
}

// ---------------------------------------------------------------------------
// Shot C: Tranquility Base, then Earthrise
// ---------------------------------------------------------------------------
const HZ = { cx: 960, cy: 2780, r: 2060 };
const horizonY = x => HZ.cy - Math.sqrt(HZ.r * HZ.r - (x - HZ.cx) * (x - HZ.cx));

function shotC(ctx, s, t) {
  s.bloom = 0.44;
  const u = t - C_IN;
  // Earthrise first, so the Moon's limb occludes it.
  const rise = s.cue('earthrise', ease.out);
  const ex = 1330, er = 116;
  const ey = lerp(horizonY(ex) + er + 6, horizonY(ex) - er * 0.72, rise);
  if (rise > 0) {
    globe(ctx, ex, ey, er, 1, s.T * 0.12, { night: 1, sun: Math.PI * 1.05, phase: 0.05, tilt: 0.42, meridians: 10 });
    glow(ctx, ex, ey, er * 1.6, 'GOLD_HOT', 0.12 * rise);
  }
  // The lunar surface occludes everything below the horizon.
  ctx.fillStyle = rgba('INK', 1);
  ctx.beginPath(); ctx.arc(HZ.cx, HZ.cy, HZ.r, 0, TAU); ctx.fill();
  const limb = arcPts(HZ.cx, HZ.cy, HZ.r, -Math.PI / 2 - 0.62, -Math.PI / 2 + 0.62, 160);
  stroke(ctx, limb, 1, { pen: { color: 'GOLD_HOT', alpha: 0.95, width: 2.4 }, tip: false });
  // Regolith: craters foreshortened toward the horizon, sparse engraving.
  const R = mulberry32(1120);
  for (let i = 0; i < 26; i++) {
    const x = 80 + R() * 1760, depth = Math.pow(R(), 1.6);
    const y = horizonY(x) + 22 + depth * 300;
    if (y > 930) continue;
    const rx = 14 + depth * 70 + R() * 20, ry = rx * (0.12 + depth * 0.22);
    stroke(ctx, ellipsePts(x, y, rx, ry, 0, 0, TAU, 32), 1, { pen: { color: 'GOLD', alpha: 0.28 + 0.25 * depth, width: 1 }, tip: false });
    stroke(ctx, ellipsePts(x, y + ry * 0.25, rx * 0.8, ry * 0.6, 0, 0.1, Math.PI - 0.1, 16), 1, { pen: { color: 'GOLD', alpha: 0.18, width: 1 }, tip: false });
  }
  // The lander, already down; dust settles from the touchdown.
  const lx = 690, ly = horizonY(lx) + 70;
  lander(ctx, lx, ly, 1.25, 1);
  billows(ctx, t, { seed: 91, rate: 40, t0: C_IN, t1: C_IN + 0.35, life: [0.9, 1.6], source: (b, i) => [lx + (i % 2 ? 1 : -1) * 115, ly], dir: Math.PI, spread: TAU, speed: 160, drag: 2.5, r0: 4, grow: 26, alpha: 0.45, width: 1 });
  const k = Math.exp(-u / 0.12);
  if (k > 0.02) glow(ctx, lx, ly, 160 * k, 'GOLD_HOT', 0.5 * k);
  s.bg = { navy: 0.5, stars: 0.7 };
}

