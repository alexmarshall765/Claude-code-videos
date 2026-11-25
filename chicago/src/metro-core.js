// Decodes the Chicagoland tile data and turns one 1 km tile at a time into ready-to-upload geometry.
// Runs inside a Web Worker (src/worker.js); main.js can also use it directly if workers are unavailable.
import earcut from 'earcut';

// palettes (0xRRGGBB)
const WALLS = [
  [0x9c5a43, 0x8a4b38, 0xa86b4f, 0xb98b65, 0xc9b38e, 0xe6e2d8, 0xd2cbbd, 0xb9c0c4, 0x9fb1bf, 0xc8c09a, 0x8f9a8a, 0xf0eee8, 0x7d5a48, 0xa79c8c], // house
  [0xd8d4ca, 0xbfb9ad, 0xa9a59c, 0x9c5a43, 0xe8e4da, 0x8f8a80, 0xc4b59a],                                                               // garage / shed
  [0x9a5d45, 0xb07a55, 0xc4a57c, 0x8c5a48, 0xa58a6e, 0xd0c3a8, 0x7b4f3f, 0xb89870],                                                     // apartments
  [0xb7a58f, 0xa58b74, 0xc9bfae, 0x8d6f5c, 0x9aa3aa, 0xd8d2c4, 0x7d8790, 0xa8967f],                                                     // commercial
  [0xc9c5bb, 0xb8b5ad, 0xa9adb0, 0xd8d4c8, 0x9a9488, 0xbcb3a2],                                                                         // industrial
  [0xc2b39c, 0xa67c68, 0xd6cfc0, 0x93654f, 0xb5a58a],                                                                                   // civic
];
const SHINGLES = [0x4a4a4c, 0x3b3d40, 0x5a524a, 0x6b5b4e, 0x2f3133, 0x55585c, 0x6e4a3a, 0x4d5a4a, 0x5e5f5a, 0x4a3f3a];
const FLAT_ROOF = [[0x3d3f42, 0x4a4b4d], [0x55575a, 0x6a6b6d], [0x3f4144, 0x515255], [0xc9cbcc, 0x9a9c9e, 0xb8babb], [0xd6d8d9, 0xa7a9aa, 0xbfc1c2], [0x8c8e90, 0xb4b6b8]];
const TALL = [0x6f8fa8, 0x5d7f99, 0x88a3b5, 0x4f6475, 0x9fb4c2, 0x465463, 0x7a8c99, 0xa9b7bf, 0xb0a892, 0x8fa39a, 0xc7c2b4, 0xb7a58f];
// road classes: 0 motorway 1 arterial 2 collector 3 residential 4 alley/service 6 rail 7 runway 8 taxiway
const RW = { 0: 22, 1: 14, 2: 11, 3: 9, 4: 4.5, 6: 3.2, 7: 45, 8: 22 };
const RCOL = { 0: [52, 55, 60], 1: [56, 59, 64], 2: [60, 63, 68], 3: [66, 68, 72], 4: [96, 92, 86], 6: [104, 94, 82], 7: [124, 126, 128], 8: [112, 114, 116] };
const RFLAG = { 0: 2, 1: 2, 2: 1, 3: 0, 4: 6, 6: 5, 7: 3, 8: 4 };
const ORDER = [6, 4, 8, 3, 2, 1, 0, 7];
// land classes
const LCOL = { 0: [96, 148, 84], 1: [118, 166, 98], 2: [104, 160, 108], 3: [196, 190, 176], 4: [128, 122, 114], 5: [88, 140, 86], 6: [74, 104, 62],
  7: [112, 172, 96], 8: [110, 150, 92], 10: [168, 168, 162], 12: [96, 128, 100] };
const TREE_DENS = { 0: 1 / 260, 1: 1 / 900, 5: 1 / 320, 6: 1 / 75, 7: 1 / 1400, 8: 1 / 300, 12: 1 / 500 };
const SIDEWALK = [178, 174, 165], PARKWAY = [104, 146, 82];

// push earcut triangles so they wind counter-clockwise in map space (front-facing from above)
function ccwPush(idx, base, t, f) {
  for (let i = 0; i < t.length; i += 3) {
    const a = t[i], b = t[i + 1], c = t[i + 2];
    const cr = (f[b * 2] - f[a * 2]) * (f[c * 2 + 1] - f[a * 2 + 1]) - (f[c * 2] - f[a * 2]) * (f[b * 2 + 1] - f[a * 2 + 1]);
    if (cr >= 0) idx.push(base + a, base + b, base + c); else idx.push(base + a, base + c, base + b);
  }
}
function h32(a) {
  a = Math.imul(a ^ (a >>> 16), 0x45d9f3b); a = Math.imul(a ^ (a >>> 16), 0x45d9f3b); return (a ^ (a >>> 16)) >>> 0;
}
const rgb = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

class Geo {          // growable vertex/index lists
  constructor(stride) { this.s = stride; this.v = []; this.i = []; this.n = 0; }
}
class BGeo {         // building geometry in the same layout as main.js (pos, nrm i8, col u8x4, uv f32x4)
  constructor() { this.pos = []; this.nrm = []; this.col = []; this.uv = []; this.idx = []; this.n = 0; }
  v(x, y, z, nx, ny, nz, c, sd, u, w, st, top) {
    this.pos.push(x, y, z); this.nrm.push(nx, ny, nz); this.col.push(c[0], c[1], c[2], sd); this.uv.push(u, w, st, top); return this.n++;
  }
  out() {
    return { pos: new Float32Array(this.pos), nrm: new Int8Array(this.nrm), col: new Uint8Array(this.col), uv: new Float32Array(this.uv), idx: new Uint32Array(this.idx) };
  }
}
class FGeo {         // flat ground geometry (pos, col u8x3, optional aR f32x3)
  constructor(withR) { this.pos = []; this.col = []; this.ex = withR ? [] : null; this.idx = []; this.n = 0; }
  out() {
    return { pos: new Float32Array(this.pos), col: new Uint8Array(this.col), ex: this.ex ? new Float32Array(this.ex) : null, idx: new Uint32Array(this.idx) };
  }
  poly(flat, holes, c) {
    const t = earcut(flat, holes, 2); if (!t.length) return null;
    const base = this.n;
    for (let i = 0; i < flat.length; i += 2) { this.pos.push(flat[i], 0, -flat[i + 1]); if (c) this.col.push(c[0], c[1], c[2]); this.n++; }
    ccwPush(this.idx, base, t, flat);
    return t;
  }
  ribbon(pts, width, c, flag) {
    const n = pts.length / 2; if (n < 2) return;
    const hw = width / 2; let along = 0; const base = this.n;
    for (let i = 0; i < n; i++) {
      const x = pts[i * 2], y = pts[i * 2 + 1];
      let ax = 0, ay = 0, bx = 0, by = 0;
      if (i > 0) { ax = x - pts[i * 2 - 2]; ay = y - pts[i * 2 - 1]; const l = Math.hypot(ax, ay) || 1; along += l; ax /= l; ay /= l; }
      if (i < n - 1) { bx = pts[i * 2 + 2] - x; by = pts[i * 2 + 3] - y; const l = Math.hypot(bx, by) || 1; bx /= l; by /= l; }
      if (i === 0) { ax = bx; ay = by; } if (i === n - 1) { bx = ax; by = ay; }
      let nx = -(ay + by), ny = ax + bx; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      const k = hw / Math.max(0.5, nx * -ay + ny * ax);
      this.pos.push(x + nx * k, 0, -(y + ny * k), x - nx * k, 0, -(y - ny * k));
      if (c) this.col.push(c[0], c[1], c[2], c[0], c[1], c[2]);
      if (this.ex) this.ex.push(hw, along, flag, -hw, along, flag);
      this.n += 2;
      if (i > 0) { const a = base + (i - 1) * 2; this.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
  }
}

export function createCore(head, buf, downtown) {
  const NX = head.nx, NY = head.ny, T = head.tile, X0 = head.x0, Y0 = head.y0, NT = NX * NY;
  const sec = (k) => buf.subarray(head.offs[k][0], head.offs[k][0] + head.offs[k][1]);
  const S = { idx: sec('idx'), rc: sec('rc'), rw: sec('rw'), rl: sec('rl'), ra: sec('ra'), rh: sec('rh'), rf: sec('rf'), ph: sec('ph'), pf: sec('pf'), pv: sec('pv'),
    road: sec('road'), land: sec('land'), water: sec('water'), wline: sec('wline'), tall: sec('tall') };
  const ph16 = new Uint16Array(S.ph.buffer.slice(S.ph.byteOffset, S.ph.byteOffset + S.ph.byteLength));
  let p = 0, B = null;
  const rv = () => { let r = 0, s = 1, x; do { x = B[p++]; r += (x & 127) * s; s *= 128; } while (x & 128); return r; };
  const rz = () => { const r = rv(); return r % 2 ? -(r + 1) / 2 : r / 2; };
  // per-tile index -> prefix offsets
  const cols = 9, I = new Float64Array(NT * cols);   // nRect rectStart rcOff nPoly polyStart pvOff roadOff nRoad landOff (+nLand at the end)
  const nLand = new Int32Array(NT);
  B = S.idx; p = 0;
  let rs = 0, rco = 0, ps = 0, pvo = 0, ro = 0, lo = 0;
  for (let t = 0; t < NT; t++) {
    const nR = rv(), rcB = rv(), nP = rv(), pvB = rv(), nRd = rv(), rdB = rv(), nL = rv(), lB = rv();
    const o = t * cols;
    I[o] = nR; I[o + 1] = rs; I[o + 2] = rco; I[o + 3] = nP; I[o + 4] = ps; I[o + 5] = pvo; I[o + 6] = ro; I[o + 7] = nRd; I[o + 8] = lo; nLand[t] = nL;
    rs += nR; rco += rcB; ps += nP; pvo += pvB; ro += rdB; lo += lB;
  }
  const [DX0, DY0, DX1, DY1] = downtown || [0, 0, 0, 0];
  const inDown = (x, y) => x > DX0 && x < DX1 && y > DY0 && y < DY1;

  // ── decoders
  function rects(t) {
    const o = t * cols, n = I[o], s0 = I[o + 1], ox = X0 + Math.floor(t / NY) * T, oy = Y0 + (t % NY) * T;
    B = S.rc; p = I[o + 2];
    let qx = 0, qy = 0; const out = [];
    for (let k = 0; k < n; k++) {
      qx += rz(); qy += rz(); const g = s0 + k;
      out.push({ cx: ox + qx * 0.25, cy: oy + qy * 0.25, w: S.rw[g] * 0.25, l: S.rl[g] * 0.25, a: S.ra[g] / 256 * Math.PI / 2, h: S.rh[g] * 0.25, f: S.rf[g], id: g });
    }
    return out;
  }
  function polysOf(t) {
    const o = t * cols, n = I[o + 3], s0 = I[o + 4], ox = X0 + Math.floor(t / NY) * T, oy = Y0 + (t % NY) * T;
    B = S.pv; p = I[o + 5]; const out = [];
    for (let k = 0; k < n; k++) {
      const nv = rv(), pts = new Float64Array(nv * 2); let x = 0, y = 0;
      for (let i = 0; i < nv; i++) { x += rz(); y += rz(); pts[i * 2] = ox + x * 0.25; pts[i * 2 + 1] = oy + y * 0.25; }
      const g = s0 + k; out.push({ pts, h: ph16[g] * 0.1, f: S.pf[g], id: 3000000 + g });
    }
    return out;
  }
  function roadsOf(t) {
    const o = t * cols, n = I[o + 7], ox = X0 + Math.floor(t / NY) * T, oy = Y0 + (t % NY) * T;
    B = S.road; p = I[o + 6]; const out = [];
    for (let k = 0; k < n; k++) {
      const c = rv(), ni = rv() - 1, nv = rv(), pts = new Float64Array(nv * 2); let x = 0, y = 0;
      for (let i = 0; i < nv; i++) { x += rz(); y += rz(); pts[i * 2] = ox + x * 0.5; pts[i * 2 + 1] = oy + y * 0.5; }
      out.push({ c, ni, pts });
    }
    return out;
  }
  function landOf(t) {
    const o = t * cols, n = nLand[t], ox = X0 + Math.floor(t / NY) * T, oy = Y0 + (t % NY) * T;
    B = S.land; p = I[o + 8]; const out = [];
    for (let k = 0; k < n; k++) {
      const c = rv(), nv = rv(), pts = new Float64Array(nv * 2); let x = 0, y = 0;
      for (let i = 0; i < nv; i++) { x += rz(); y += rz(); pts[i * 2] = ox + x * 0.5; pts[i * 2 + 1] = oy + y * 0.5; }
      out.push({ c, pts });
    }
    return out;
  }

  // ── buildings
  const UP = [0, 127, 0];
  function wall(G, ax, ay, bx, by, z0, z1, c, sd, st, v0, vTop, vEnd) {
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy); if (len < 0.05) return;
    const nx = Math.round(dy / len * 127), nz = Math.round(dx / len * 127);
    const nb = Math.max(1, Math.round(len / 3.3)), s = len < 1.7 ? 2 : st;
    const i0 = G.v(ax, z0, -ay, nx, 0, nz, c, sd, 0, v0, s, vTop), i1 = G.v(bx, z0, -by, nx, 0, nz, c, sd, nb, v0, s, vTop);
    const i2 = G.v(bx, z1, -by, nx, 0, nz, c, sd, nb, vEnd, s, vTop), i3 = G.v(ax, z1, -ay, nx, 0, nz, c, sd, 0, vEnd, s, vTop);
    G.idx.push(i0, i1, i2, i0, i2, i3);
  }
  function flatTop(G, pts, z, c, sd) {
    const t = earcut(pts, null, 2); const base = G.n;
    for (let i = 0; i < pts.length; i += 2) G.v(pts[i], z, -pts[i + 1], 0, 127, 0, c, sd, 0, 0, 3, 0);
    ccwPush(G.idx, base, t, pts);
  }
  function tri(G, a, b, c, col, sd, st, uvs) {   // a,b,c = [x, y(map), z(height)]; normal from the winding
    const ux = b[0] - a[0], uy = b[2] - a[2], uz = -(b[1] - a[1]), vx = c[0] - a[0], vy = c[2] - a[2], vz = -(c[1] - a[1]);
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
    nx = Math.round(nx / l * 127); ny = Math.round(ny / l * 127); nz = Math.round(nz / l * 127);
    const k = [a, b, c].map((q, i) => G.v(q[0], q[2], -q[1], nx, ny, nz, col, sd, uvs ? uvs[i][0] : 0, uvs ? uvs[i][1] : 0, st, 0));
    G.idx.push(k[0], k[1], k[2]);
  }
  function quad(G, a, b, c, d, col, sd, st, uvs) { tri(G, a, b, c, col, sd, st, uvs && [uvs[0], uvs[1], uvs[2]]); tri(G, a, c, d, col, sd, st, uvs && [uvs[0], uvs[2], uvs[3]]); }

  function styleOf(kind, H, r) {
    if (kind === 1 || kind === 4 && r % 3) return 2;          // garages and most industrial: plain walls
    return 0;
  }
  function building(G, fp, b, isRect) {
    const kind = b.f >> 2, roof = b.f & 3, r = h32(b.id * 7 + 13), sd = r & 255;
    let wc = rgb(WALLS[kind][r % WALLS[kind].length]);
    const j = 0.9 + ((r >>> 8) & 255) / 255 * 0.2; wc = [Math.min(255, wc[0] * j), Math.min(255, wc[1] * j), Math.min(255, wc[2] * j)];
    const fr = FLAT_ROOF[kind], rc = rgb(fr[(r >>> 16) % fr.length]);
    let pts;
    if (isRect) {
      const ux = Math.cos(b.a), uy = Math.sin(b.a), vx = -uy, vy = ux, hw = b.w / 2, hl = b.l / 2;
      pts = [b.cx - ux * hw - vx * hl, b.cy - uy * hw - vy * hl, b.cx + ux * hw - vx * hl, b.cy + uy * hw - vy * hl,
        b.cx + ux * hw + vx * hl, b.cy + uy * hw + vy * hl, b.cx - ux * hw + vx * hl, b.cy - uy * hw + vy * hl];
    } else pts = b.pts;
    const h = b.h;
    let rh = 0;
    if (isRect && roof) { const short = Math.min(b.w, b.l); rh = Math.min(short * 0.36, h - 2.6); if (rh < 0.9) rh = 0; }
    const eave = h - rh, st = styleOf(kind, eave, r);
    const resi = kind === 0 || kind === 2 || kind === 5;
    const v0 = resi || kind === 4 ? 1 : 0;                       // no shopfront row on homes
    const floors = Math.max(1, Math.round((eave - (v0 ? 0.6 : 0.8)) / (kind === 0 ? 3.0 : 3.6)));
    const vTop = v0 + floors, vEnd = !rh && eave >= 5.2 ? vTop + 0.3 : vTop;
    const n = pts.length;
    for (let i = 0; i < n; i += 2) wall(G, pts[i], pts[i + 1], pts[(i + 2) % n], pts[(i + 3) % n], 0, eave, wc, sd, st, v0, vTop, vEnd);
    if (!rh) flatTop(G, pts, h, rc, sd);
    else {
      const sc = rgb(SHINGLES[(r >>> 12) % SHINGLES.length]);
      // ridge along the long side
      let ax = Math.cos(b.a), ay = Math.sin(b.a), L = b.w, Wd = b.l;
      if (b.l > b.w) { ax = -Math.sin(b.a); ay = Math.cos(b.a); L = b.l; Wd = b.w; }
      const px = -ay, py = ax, hl = L / 2, hs = Wd / 2, o = 0.35, drop = o * rh / hs;
      const hip = roof === 2 ? Math.min(hs, hl) : 0;
      const C = (s, t, z) => [b.cx + ax * s + px * t, b.cy + ay * s + py * t, z];
      const e = eave - drop, EL = hl + o, ES = hs + o;
      // the two long slopes
      const r0 = C(-hl + hip, 0, h), r1 = C(hl - hip, 0, h);
      const slope = Math.hypot(hs + o, rh + drop);
      quad(G, C(-EL, -ES, e), C(EL, -ES, e), r1, r0, sc, sd, 4, [[-EL, 0], [EL, 0], [hl - hip, slope], [-hl + hip, slope]]);
      quad(G, C(EL, ES, e), C(-EL, ES, e), r0, r1, sc, sd, 4, [[EL, 0], [-EL, 0], [-hl + hip, slope], [hl - hip, slope]]);
      if (hip > 0) {   // hipped ends
        tri(G, C(-EL, ES, e), C(-EL, -ES, e), r0, sc, sd, 4, [[ES, 0], [-ES, 0], [0, slope]]);
        tri(G, C(EL, -ES, e), C(EL, ES, e), r1, sc, sd, 4, [[-ES, 0], [ES, 0], [0, slope]]);
      } else {         // gable ends: wall triangles up to the ridge
        tri(G, C(-hl, hs, eave), C(-hl, -hs, eave), C(-hl, 0, h), wc, sd, 2);
        tri(G, C(hl, -hs, eave), C(hl, hs, eave), C(hl, 0, h), wc, sd, 2);
      }
    }
    // footprint for collisions / map
    fp.push(pts, h, kind);
  }
  function packFp(fp) {
    let nv = 0; for (let i = 0; i < fp.length; i += 3) nv += fp[i].length;
    const xy = new Float32Array(nv), start = new Int32Array(fp.length / 3 + 1), hh = new Float32Array(fp.length / 3), kk = new Uint8Array(fp.length / 3);
    let o = 0;
    for (let i = 0, k = 0; i < fp.length; i += 3, k++) { start[k] = o; xy.set(fp[i], o); o += fp[i].length; hh[k] = fp[i + 1]; kk[k] = fp[i + 2]; }
    start[fp.length / 3] = o;
    return { xy, start, h: hh, kind: kk };
  }

  // ── tile
  function tile(t, wantTrees) {
    const G = new BGeo(), fp = [];
    const rs_ = rects(t), ps_ = polysOf(t);
    for (const b of rs_) building(G, fp, b, true);
    for (const b of ps_) building(G, fp, b, false);
    const rd = roadsOf(t);
    const sw = new FGeo(false), pk = new FGeo(false), rg = new FGeo(true);
    rd.sort((a, b) => ORDER.indexOf(a.c) - ORDER.indexOf(b.c));
    const segs = [];
    for (const r of rd) {
      const w = RW[r.c] || 6;
      if (r.c >= 1 && r.c <= 3) { sw.ribbon(r.pts, w + 7.6, SIDEWALK, 0); pk.ribbon(r.pts, w + 4.4, PARKWAY, 0); }
      else if (r.c === 0) sw.ribbon(r.pts, w + 4, [150, 148, 140], 0);
      rg.ribbon(r.pts, w, RCOL[r.c] || RCOL[3], RFLAG[r.c] || 0);
      if (r.c <= 4) for (let i = 0; i + 3 < r.pts.length; i += 2) segs.push(r.pts[i], r.pts[i + 1], r.pts[i + 2], r.pts[i + 3], w / 2, r.ni, r.c);
    }
    const land = new FGeo(false);
    const ld = landOf(t);
    ld.sort((a, b) => (a.c === 6 ? -1 : 0) - (b.c === 6 ? -1 : 0));
    for (const l of ld) if (LCOL[l.c]) land.poly(l.pts, null, LCOL[l.c]);
    const res = { b: G.out(), fp: packFp(fp), sw: sw.out(), pk: pk.out(), rd: rg.out(), land: land.out(), segs: new Float32Array(segs) };
    if (wantTrees) res.trees = trees(t, rs_, ps_, rd, ld, res.fp);
    return res;
  }

  // ── trees: street trees in the parkways, yard trees round houses, and trees in parks and woods
  function trees(t, rs_, ps_, rd, ld, fpk) {
    rs_ = rs_ || rects(t); ps_ = ps_ || polysOf(t); rd = rd || roadsOf(t); ld = ld || landOf(t);
    if (!fpk) { const fp = []; for (const b of rs_) fp.push(rectPts(b), b.h, 0); for (const b of ps_) fp.push(b.pts, b.h, 0); fpk = packFp(fp); }
    const ox = X0 + Math.floor(t / NY) * T, oy = Y0 + (t % NY) * T, GC = 20, GN = Math.ceil(T / GC) + 6;
    const cellOf = (x, y) => { const i = Math.floor((x - ox) / GC) + 3, j = Math.floor((y - oy) / GC) + 3; return i < 0 || j < 0 || i >= GN || j >= GN ? -1 : i * GN + j; };
    const bgrid = new Map(), sgrid = new Map();
    const add = (g, x0, y0, x1, y1, v) => {
      for (let i = Math.floor((x0 - ox) / GC) + 3; i <= Math.floor((x1 - ox) / GC) + 3; i++) for (let j = Math.floor((y0 - oy) / GC) + 3; j <= Math.floor((y1 - oy) / GC) + 3; j++) {
        if (i < 0 || j < 0 || i >= GN || j >= GN) continue; const k = i * GN + j; let a = g.get(k); if (!a) g.set(k, a = []); a.push(v);
      }
    };
    const nb = fpk.h.length;
    for (let k = 0; k < nb; k++) {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = fpk.start[k]; i < fpk.start[k + 1]; i += 2) { const x = fpk.xy[i], y = fpk.xy[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      add(bgrid, x0 - 1.5, y0 - 1.5, x1 + 1.5, y1 + 1.5, k);
    }
    for (const r of rd) for (let i = 0; i + 3 < r.pts.length; i += 2) {
      const a = r.pts[i], b = r.pts[i + 1], c = r.pts[i + 2], d = r.pts[i + 3], w = (RW[r.c] || 6) / 2;
      add(sgrid, Math.min(a, c) - w - 2, Math.min(b, d) - w - 2, Math.max(a, c) + w + 2, Math.max(b, d) + w + 2, [a, b, c, d, w]);
    }
    const inB = (x, y) => {
      const a = bgrid.get(cellOf(x, y)); if (!a) return false;
      for (const k of a) {
        let ins = false;
        for (let i = fpk.start[k], e = fpk.start[k + 1], jj = e - 2; i < e; jj = i, i += 2) {
          const yi = fpk.xy[i + 1], yj = fpk.xy[jj + 1];
          if ((yi > y) !== (yj > y) && x < (fpk.xy[jj] - fpk.xy[i]) * (y - yi) / (yj - yi) + fpk.xy[i]) ins = !ins;
        }
        if (ins) return true;
        // keep a little clearance from walls
        for (let i = fpk.start[k], e = fpk.start[k + 1]; i < e; i += 2) {
          const i2 = i + 2 < e ? i + 2 : fpk.start[k];
          if (segD(fpk.xy[i], fpk.xy[i + 1], fpk.xy[i2], fpk.xy[i2 + 1], x, y) < 1.4) return true;
        }
      }
      return false;
    };
    const onRoad = (x, y, pad) => {
      const a = sgrid.get(cellOf(x, y)); if (!a) return false;
      for (const s of a) if (segD(s[0], s[1], s[2], s[3], x, y) < s[4] + pad) return true;
      return false;
    };
    let seed = h32(t * 977 + 5); const rnd = () => (seed = h32(seed + 0x9e3779b9)) / 4294967296;
    const out = [];
    const put = (x, y, sc, kind) => {
      if (out.length > 9000 * 7) return;
      if (inDown(x, y)) return;
      const g = rnd();
      out.push(x, y, sc, rnd() * 6.283, kind, 0.85 + g * 0.3, rnd());
    };
    // parkway trees
    for (const r of rd) {
      if (r.c < 1 || r.c > 3) continue;
      const w = RW[r.c] / 2 + 2.2, pts = r.pts; let carry = rnd() * 10;
      for (let i = 0; i + 3 < pts.length; i += 2) {
        const ax = pts[i], ay = pts[i + 1], dx = pts[i + 2] - ax, dy = pts[i + 3] - ay, len = Math.hypot(dx, dy); if (len < 1) continue;
        const ux = dx / len, uy = dy / len;
        for (let d = carry; d < len; d += 10 + rnd() * 5) {
          for (const side of [-1, 1]) {
            if (rnd() < (r.c === 1 ? 0.55 : 0.2)) continue;
            const x = ax + ux * d - uy * w * side, y = ay + uy * d + ux * w * side;
            if (!onRoad(x, y, 0.8) && !inB(x, y)) put(x, y, 0.85 + rnd() * 0.5, 0);
          }
        }
        carry = 0;
      }
    }
    // yard trees round houses
    for (const b of rs_) {
      if ((b.f >> 2) !== 0) continue;
      const cnt = rnd() < 0.35 ? 2 : rnd() < 0.75 ? 1 : 0;
      for (let k = 0; k < cnt; k++) {
        const a = rnd() * 6.283, d = Math.max(b.w, b.l) / 2 + 3 + rnd() * 6;
        const x = b.cx + Math.cos(a) * d, y = b.cy + Math.sin(a) * d;
        if (!onRoad(x, y, 2.5) && !inB(x, y)) put(x, y, 0.8 + rnd() * 0.6, rnd() < 0.15 ? 1 : 0);
      }
    }
    // parks, woods, cemeteries
    for (const l of ld) {
      const dens = TREE_DENS[l.c]; if (!dens) continue;
      const tr = earcut(l.pts, null, 2), f = l.pts;
      for (let i = 0; i < tr.length; i += 3) {
        const ax = f[tr[i] * 2], ay = f[tr[i] * 2 + 1], bx = f[tr[i + 1] * 2], by = f[tr[i + 1] * 2 + 1], cx = f[tr[i + 2] * 2], cy = f[tr[i + 2] * 2 + 1];
        const area = Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2;
        let cnt = area * dens; cnt = Math.floor(cnt) + (rnd() < cnt % 1 ? 1 : 0);
        for (let k = 0; k < cnt; k++) {
          let u = rnd(), v = rnd(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
          const x = ax + (bx - ax) * u + (cx - ax) * v, y = ay + (by - ay) * u + (cy - ay) * v;
          if (!onRoad(x, y, 1.5) && !inB(x, y)) put(x, y, (l.c === 6 ? 0.9 : 0.75) + rnd() * 0.7, rnd() < (l.c === 6 ? 0.25 : 0.1) ? 1 : 0);
        }
      }
    }
    return new Float32Array(out);
  }
  function rectPts(b) {
    const ux = Math.cos(b.a), uy = Math.sin(b.a), vx = -uy, vy = ux, hw = b.w / 2, hl = b.l / 2;
    return [b.cx - ux * hw - vx * hl, b.cy - uy * hw - vy * hl, b.cx + ux * hw - vx * hl, b.cy + uy * hw - vy * hl,
      b.cx + ux * hw + vx * hl, b.cy + uy * hw + vy * hl, b.cx - ux * hw + vx * hl, b.cy - uy * hw + vy * hl];
  }
  function segD(ax, ay, bx, by, x, y) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
    return Math.hypot(x - ax - dx * t, y - ay - dy * t);
  }

  // ── globals: water everywhere, and every tall building so skylines show from afar
  function globals() {
    const wg = new FGeo(false);
    B = S.water; p = 0;
    while (p < B.length) {
      const nr = rv(), flat = [], holes = [];
      for (let r = 0; r < nr; r++) {
        if (r > 0) holes.push(flat.length / 2);
        const nv = rv(); let x = 0, y = 0;
        for (let i = 0; i < nv; i++) { x += rz(); y += rz(); flat.push(x * 0.5, y * 0.5); }
      }
      wg.poly(flat, holes.length ? holes : null, null);
    }
    B = S.wline; p = 0;
    while (p < B.length) {
      const w = rv() / 10; rv(); const nv = rv(), pts = []; let x = 0, y = 0;
      for (let i = 0; i < nv; i++) { x += rz(); y += rz(); pts.push(x * 0.5, y * 0.5); }
      wg.ribbon(pts, w, null, 0);
    }
    const G = new BGeo(), fp = [], names = [];
    B = S.tall; p = 0; let k = 0;
    while (p < B.length) {
      const h = rv() / 10, ni = rv() - 1, kind = rv(); rv(); const nv = rv(), pts = []; let x = 0, y = 0;
      for (let i = 0; i < nv; i++) { x += rz(); y += rz(); pts.push(x * 0.1, y * 0.1); }
      const r = h32(k * 31 + 7), sd = r & 255;
      const c = rgb(TALL[r % TALL.length]), st = h > 60 && r % 5 ? 1 : 0;
      const vTop = 1 + Math.max(1, Math.round((h - 4.2) / 3.6));
      for (let i = 0; i < pts.length; i += 2) wall(G, pts[i], pts[i + 1], pts[(i + 2) % pts.length], pts[(i + 3) % pts.length], 0, h, c, sd, st, 0, vTop, vTop + 0.3);
      flatTop(G, pts, h, rgb(0x6a6b6d), sd);
      fp.push(pts, h, kind); names.push(ni); k++;
    }
    return { water: wg.out(), tall: G.out(), tallFp: packFp(fp), tallNames: new Int32Array(names) };
  }

  return { tile, trees: (t) => trees(t), globals };
}

export function transferables(o, out = []) {
  if (!o) return out;
  if (ArrayBuffer.isView(o)) { out.push(o.buffer); return out; }
  if (typeof o === 'object') for (const k in o) transferables(o[k], out);
  return out;
}
