/* Noblesville 3D — explorable map. Data: Overture Maps (incl. OpenStreetMap), Mapzen/USGS terrain. */
(function () {
'use strict';
const $ = id => document.getElementById(id);
const D = JSON.parse($('nbdata').textContent);
const HX = D.hx, HY = D.hy, QI = 1 / D.q, EX = 1.5;
function dec(b, T) {
  const s = atob(b), n = s.length, u = new Uint8Array(n);
  for (let i = 0; i < n; i++) u[i] = s.charCodeAt(i);
  return T === Uint8Array ? u : new T(u.buffer);
}
function hash(i) { let x = Math.imul(i + 1, 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; return (x >>> 0) / 4294967296; }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const tick = () => new Promise(r => setTimeout(r, 0));
function status(t, p) { $('loadmsg').textContent = t; $('bar').style.width = (p * 100) + '%'; }

/* ---------------- terrain ---------------- */
const NG = D.terrain.n, TH = dec(D.terrain.h, Uint16Array);
const CW = 2 * HX / (NG - 1), CH = 2 * HY / (NG - 1);
function hAt(x, y) {
  let fx = clamp((x + HX) / CW, 0, NG - 1.001), fy = clamp((y + HY) / CH, 0, NG - 1.001);
  const i = fx | 0, j = fy | 0; fx -= i; fy -= j;
  const k = j * NG + i, a = TH[k], b = TH[k + 1], c = TH[k + NG], d = TH[k + NG + 1];
  return (fx >= fy ? a + fx * (b - a) + fy * (d - b) : a + fy * (c - a) + fx * (d - c)) * 0.05 * EX;
}

/* ---------------- renderer / scene ---------------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(innerWidth, innerHeight);
document.body.insertBefore(renderer.domElement, document.body.firstChild);
const canvas = renderer.domElement;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfe3f5, 600, 7000);
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.4, 30000);
camera.rotation.order = 'YXZ';
const hemi = new THREE.HemisphereLight(0xdfeeff, 0x6b7355, 1.5); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3dd, 2.6); scene.add(sun); scene.add(sun.target);
const MAXANI = renderer.capabilities.getMaxAnisotropy();

function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function geo(attrs, index) {
  const g = new THREE.BufferGeometry();
  for (const k in attrs) { const [arr, n, norm] = attrs[k]; g.setAttribute(k, new THREE.BufferAttribute(arr, n, !!norm)); }
  if (index) g.setIndex(new THREE.BufferAttribute(index, 1));
  return g;
}
/* merge simple primitives into one flat-shaded, vertex-coloured geometry */
function merged(parts) {
  const P = [], C = [];
  for (const [g0, col, m] of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0; if (m) g.applyMatrix4(m);
    const a = g.attributes.position.array, c = new THREE.Color(col);
    for (let i = 0; i < a.length; i += 3) { P.push(a[i], a[i + 1], a[i + 2]); C.push(c.r, c.g, c.b); }
  }
  const g = geo({ position: [new Float32Array(P), 3], color: [new Float32Array(C), 3] });
  g.computeVertexNormals(); return g;
}
const M4 = (x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

/* ---------------- generic polygon set ---------------- */
function readPolys(S) {
  const cls = dec(S.cls, Uint8Array), rc = dec(S.rc, Uint8Array), pc = dec(S.pc, Uint32Array), co = dec(S.co, Int16Array);
  const out = []; let ri = 0, ci = 0;
  for (let p = 0; p < S.n; p++) {
    const rings = [];
    for (let r = 0; r < rc[p]; r++) { const n = pc[ri++]; rings.push(co.subarray(ci, ci + n * 2)); ci += n * 2; }
    out.push({ c: cls[p], rings });
  }
  return out;
}
const landPolys = readPolys(D.land), waterPolys = readPolys(D.water);

/* ---------------- roads data ---------------- */
const RW = [13, 11, 10, 8.5, 7.5, 6.5, 4, 2.2, 3.2];
const RCOL = [0x3b3e43, 0x3f4247, 0x45484d, 0x4b4e53, 0x505358, 0x5a5d61, 0x6d6f72, 0xcfc6ab, 0x7a7166];
const segs = [];
(function () {
  const R = D.roads, cls = dec(R.cls, Uint8Array), nm = dec(R.name, Uint16Array), pc = dec(R.pc, Uint16Array), co = dec(R.co, Int16Array);
  let o = 0;
  for (let i = 0; i < R.n; i++) {
    const n = pc[i], pts = new Float32Array(n * 2), cum = new Float32Array(n);
    for (let k = 0; k < n * 2; k++) pts[k] = co[o + k] * QI;
    for (let k = 1; k < n; k++) cum[k] = cum[k - 1] + Math.hypot(pts[k * 2] - pts[k * 2 - 2], pts[k * 2 + 1] - pts[k * 2 - 1]);
    segs.push({ c: cls[i], name: R.names[nm[i]], pts, cum, len: cum[n - 1], k0: co[o] + ',' + co[o + 1], k1: co[o + n * 2 - 2] + ',' + co[o + n * 2 - 1] });
    o += n * 2;
  }
})();
/* spatial grid of road segments */
const RG = 60, RGW = Math.ceil(2 * HX / RG), RGH = Math.ceil(2 * HY / RG), roadGrid = new Array(RGW * RGH);
function rgAdd(x, y, i) { const k = clamp((y + HY) / RG | 0, 0, RGH - 1) * RGW + clamp((x + HX) / RG | 0, 0, RGW - 1); const a = roadGrid[k] || (roadGrid[k] = []); if (a[a.length - 1] !== i) a.push(i); }
segs.forEach((s, i) => {
  for (let k = 0; k < s.pts.length / 2 - 1; k++) {
    const ax = s.pts[k * 2], ay = s.pts[k * 2 + 1], bx = s.pts[k * 2 + 2], by = s.pts[k * 2 + 3], n = Math.ceil(Math.hypot(bx - ax, by - ay) / 25) || 1;
    for (let t = 0; t <= n; t++) rgAdd(lerp(ax, bx, t / n), lerp(ay, by, t / n), i);
  }
});
function nearestRoad(x, y, maxD, maxC) {
  const cx = (x + HX) / RG | 0, cy = (y + HY) / RG | 0; let best = null, bd = maxD;
  for (let j = cy - 1; j <= cy + 1; j++) for (let i = cx - 1; i <= cx + 1; i++) {
    if (i < 0 || j < 0 || i >= RGW || j >= RGH) continue; const a = roadGrid[j * RGW + i]; if (!a) continue;
    for (const si of a) {
      const s = segs[si]; if (maxC !== undefined && s.c > maxC) continue;
      for (let k = 0; k < s.pts.length / 2 - 1; k++) {
        const ax = s.pts[k * 2], ay = s.pts[k * 2 + 1], dx = s.pts[k * 2 + 2] - ax, dy = s.pts[k * 2 + 3] - ay, l2 = dx * dx + dy * dy || 1;
        const t = clamp(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1), d = Math.hypot(ax + dx * t - x, ay + dy * t - y);
        if (d < bd) { bd = d; best = { s, d, x: ax + dx * t, y: ay + dy * t, dx, dy }; }
      }
    }
  }
  return best;
}

/* ---------------- ground texture ---------------- */
const TS = 4096, gcan = mkCanvas(TS, TS), gx = gcan.getContext('2d');
const LCOL = { 1: '#b3ad74', 2: '#62824c', 3: '#8a9a62', 4: '#9ba98a', 5: '#b7a98a', 6: '#86a35c', 10: '#8cab68', 11: '#bdb47a', 12: '#7cae5e', 13: '#80b262', 14: '#8fc46b', 15: '#a6d87e', 16: '#e6dcae', 17: '#9ccc74', 18: '#6fb558', 19: '#9ab58a', 20: '#a0b27a', 21: '#b1ac9f', 22: '#a8a59d', 23: '#b59f7c', 24: '#bdb7aa', 25: '#c9a66b', 26: '#55783f', 27: '#7f9560', 28: '#e2d6a8', 29: '#7b7d80', 30: '#5c5e62', 31: '#b5553f', 32: '#a6b084', 33: '#c8c2b4', 34: '#94b266', 35: '#6f8f6a' };
const WATER = '#3d6c8a';
const SX = TS / (2 * HX), SY = TS / (2 * HY);
function pathPoly(ctx, p) {
  ctx.beginPath();
  for (const r of p.rings) { for (let i = 0; i < r.length; i += 2) { const x = (r[i] * QI + HX) * SX, y = (HY - r[i + 1] * QI) * SY; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); }
}
function paintGround() {
  gx.fillStyle = '#93a765'; gx.fillRect(0, 0, TS, TS);
  for (const p of landPolys) { gx.fillStyle = LCOL[p.c]; pathPoly(gx, p); gx.fill('evenodd'); }
  gx.lineCap = gx.lineJoin = 'round';
  const st = D.streams, sco = dec(st.co, Int16Array); let o = 0;
  gx.strokeStyle = WATER;
  for (let i = 0; i < st.w.length; i++) {
    gx.lineWidth = Math.max(1.2, st.w[i] * SX); gx.beginPath();
    for (let k = 0; k < st.pc[i]; k++) { const x = (sco[o] * QI + HX) * SX, y = (HY - sco[o + 1] * QI) * SY; o += 2; k ? gx.lineTo(x, y) : gx.moveTo(x, y); }
    gx.stroke();
  }
  for (const p of waterPolys) { gx.fillStyle = p.c ? '#58c4e6' : WATER; pathPoly(gx, p); gx.fill('evenodd'); }
  for (const pass of [7, 6, 5, 4, 3, 2, 1, 0, 8]) {
    gx.strokeStyle = '#' + RCOL[pass].toString(16).padStart(6, '0'); gx.lineWidth = Math.max(1, RW[pass] * SX); gx.beginPath();
    for (const s of segs) if (s.c === pass) for (let k = 0; k < s.pts.length; k += 2) { const x = (s.pts[k] + HX) * SX, y = (HY - s.pts[k + 1]) * SY; k ? gx.lineTo(x, y) : gx.moveTo(x, y); }
    gx.stroke();
  }
}
function buildTerrain() {
  const pos = new Float32Array(NG * NG * 3), uv = new Float32Array(NG * NG * 2), idx = new Uint32Array((NG - 1) * (NG - 1) * 6);
  for (let j = 0; j < NG; j++) for (let i = 0; i < NG; i++) {
    const k = j * NG + i; pos[k * 3] = -HX + i * CW; pos[k * 3 + 1] = TH[k] * 0.05 * EX; pos[k * 3 + 2] = HY - j * CH;
    uv[k * 2] = i / (NG - 1); uv[k * 2 + 1] = j / (NG - 1);
  }
  let o = 0;
  for (let j = 0; j < NG - 1; j++) for (let i = 0; i < NG - 1; i++) { const a = j * NG + i; idx[o++] = a; idx[o++] = a + 1; idx[o++] = a + NG + 1; idx[o++] = a; idx[o++] = a + NG + 1; idx[o++] = a + NG; }
  const g = geo({ position: [pos, 3], uv: [uv, 2] }, idx); g.computeVertexNormals();
  const tex = new THREE.CanvasTexture(gcan); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = MAXANI;
  const dc = mkCanvas(128, 128), dx = dc.getContext('2d'), im = dx.createImageData(128, 128);
  for (let i = 0; i < 128 * 128; i++) { const v = 150 + hash(i) * 105 | 0; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
  dx.putImageData(im, 0, 0);
  const dt = new THREE.CanvasTexture(dc); dt.wrapS = dt.wrapT = THREE.RepeatWrapping;
  const m = new THREE.MeshLambertMaterial({ map: tex });
  m.onBeforeCompile = sh => {
    sh.uniforms.detailTex = { value: dt };
    sh.fragmentShader = 'uniform sampler2D detailTex;\n' + sh.fragmentShader.replace('#include <map_fragment>',
      '#include <map_fragment>\n float dA = texture2D(detailTex, vMapUv * 2300.0).r; float dB = texture2D(detailTex, vMapUv * 173.0).r;\n diffuseColor.rgb *= 0.80 + 0.22 * dA + 0.14 * dB;');
  };
  const mesh = new THREE.Mesh(g, m); scene.add(mesh);
  /* skirt so the map edge isn't see-through */
  const base = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), new THREE.MeshLambertMaterial({ color: 0x8fa066 }));
  base.rotation.x = -Math.PI / 2; base.position.y = -2; scene.add(base);
}

/* ---------------- triangulation helper ---------------- */
let triFail = 0;
function triangulate(rings) {
  const cont = [], holes = [], all = [];
  rings.forEach((r, ri) => {
    const a = []; for (let i = 0; i < r.length; i += 2) a.push(new THREE.Vector2(r[i] * QI, r[i + 1] * QI));
    if (ri) holes.push(a); else cont.push(...a); all.push(...a);
  });
  let f; try { f = THREE.ShapeUtils.triangulateShape(cont, holes); } catch (e) { f = []; triFail++; }
  return { pts: all, faces: f };
}

/* ---------------- water + flat detail polygons ---------------- */
let waterMat;
function buildWater() {
  const P = [], I = []; const PP = [], PI = [];
  for (const p of waterPolys) {
    const { pts, faces } = triangulate(p.rings); const tp = p.c ? PP : P, ti = p.c ? PI : I; const b = tp.length / 3;
    let lvl = null;
    if (pts.length < 400) { const hs = pts.map(q => hAt(q.x, q.y)).sort((a, b) => a - b); lvl = hs[hs.length * 0.5 | 0] + (p.c ? 0.3 : 0.15); }
    for (const q of pts) {
      let h = lvl;
      if (h === null) h = hAt(q.x, q.y) + 0.3;
      tp.push(q.x, h, -q.y);
    }
    for (const f of faces) ti.push(b + f[0], b + f[1], b + f[2]);
  }
  const up = n => { const a = new Float32Array(n); for (let i = 1; i < n; i += 3) a[i] = 1; return a; };
  waterMat = new THREE.MeshPhongMaterial({ color: 0x3a6f92, specular: 0xaaccdd, shininess: 90, transparent: true, opacity: 0.93, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const m = new THREE.Mesh(geo({ position: [new Float32Array(P), 3], normal: [up(P.length), 3] }, new Uint32Array(I)), waterMat); m.renderOrder = 2; scene.add(m);
  const pm = new THREE.Mesh(geo({ position: [new Float32Array(PP), 3], normal: [up(PP.length), 3] }, new Uint32Array(PI)),
    new THREE.MeshPhongMaterial({ color: 0x4fc6ea, specular: 0xffffff, shininess: 120, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 })); scene.add(pm);
}
function buildDetail() {
  const want = { 15: 1, 16: 1, 17: 1, 18: 1, 25: 1, 29: 1, 31: 1, 30: 1, 33: 1 }; const P = [], C = [], I = []; const col = new THREE.Color();
  for (const p of landPolys) {
    if (!want[p.c]) continue; const { pts, faces } = triangulate(p.rings); const b = P.length / 3; col.set(LCOL[p.c]);
    for (const q of pts) { P.push(q.x, hAt(q.x, q.y) + 0.07, -q.y); C.push(col.r, col.g, col.b); }
    for (const f of faces) I.push(b + f[0], b + f[1], b + f[2]);
  }
  const N = new Float32Array(P.length); for (let i = 1; i < N.length; i += 3) N[i] = 1;
  const m = new THREE.Mesh(geo({ position: [new Float32Array(P), 3], normal: [N, 3], color: [new Float32Array(C), 3] }, new Uint32Array(I)),
    new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
  scene.add(m);
}

/* ---------------- road meshes ---------------- */
function buildRoads() {
  const CS = 2400, chunks = new Map(); const col = new THREE.Color();
  function ribbon(ch, pts, w, lat, yo, hex, ext) {
    const n = pts.length / 2; if (n < 2) return; col.set(hex);
    const dn = [];
    for (let k = 0; k < n - 1; k++) {
      const ax = pts[k * 2], ay = pts[k * 2 + 1], bx = pts[k * 2 + 2], by = pts[k * 2 + 3], L = Math.hypot(bx - ax, by - ay), m = Math.max(1, Math.ceil(L / 14));
      if (k === 0) { const e = ext / (L || 1); dn.push(ax - (bx - ax) * e, ay - (by - ay) * e); }
      for (let t = k === 0 ? 1 : 1; t <= m; t++) dn.push(lerp(ax, bx, t / m), lerp(ay, by, t / m));
      if (k === 0 && false) dn.push(ax, ay);
      if (k === n - 2) { const e = ext / (L || 1); dn[dn.length - 2] = bx + (bx - ax) * e; dn[dn.length - 1] = by + (by - ay) * e; }
    }
    const N = dn.length / 2, b = ch.P.length / 3;
    for (let k = 0; k < N; k++) {
      const x = dn[k * 2], y = dn[k * 2 + 1];
      let d1x = 0, d1y = 0, d2x = 0, d2y = 0;
      if (k > 0) { d1x = x - dn[k * 2 - 2]; d1y = y - dn[k * 2 - 1]; const l = Math.hypot(d1x, d1y) || 1; d1x /= l; d1y /= l; }
      if (k < N - 1) { d2x = dn[k * 2 + 2] - x; d2y = dn[k * 2 + 3] - y; const l = Math.hypot(d2x, d2y) || 1; d2x /= l; d2y /= l; }
      if (k === 0) { d1x = d2x; d1y = d2y; } if (k === N - 1) { d2x = d1x; d2y = d1y; }
      let tx = d1x + d2x, ty = d1y + d2y; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const mit = Math.min(1.7, 1 / Math.max(0.3, tx * d1x + ty * d1y));
      const nx = -ty, ny = tx, hw = w / 2 * mit;
      const lx = x + nx * (lat + hw), ly = y + ny * (lat + hw), rx = x + nx * (lat - hw), ry = y + ny * (lat - hw);
      ch.P.push(lx, hAt(lx, ly) + yo, -ly, rx, hAt(rx, ry) + yo, -ry);
      ch.C.push(col.r, col.g, col.b, col.r, col.g, col.b);
      if (k < N - 1) { const a = b + k * 2; ch.I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
  }
  for (const s of segs) {
    const key = ((s.pts[0] + HX) / CS | 0) + ',' + ((s.pts[1] + HY) / CS | 0);
    let ch = chunks.get(key); if (!ch) chunks.set(key, ch = { P: [], C: [], I: [] });
    const c = s.c, yo = c === 7 ? 0.1 : c === 8 ? 0.34 : 0.34 - c * 0.03;
    ribbon(ch, s.pts, RW[c], 0, yo, RCOL[c], c === 7 ? 0.3 : RW[c] * 0.3);
    if (c >= 2 && c <= 4) { ribbon(ch, s.pts, 0.16, 0.14, yo + 0.05, 0xd9b53a, 0); ribbon(ch, s.pts, 0.16, -0.14, yo + 0.05, 0xd9b53a, 0); }
    if (c <= 1) { ribbon(ch, s.pts, 0.2, RW[c] / 2 - 0.8, yo + 0.05, 0xdddddd, 0); ribbon(ch, s.pts, 0.2, -RW[c] / 2 + 0.8, yo + 0.05, 0xd9b53a, 0); }
    if (c === 5 && s.len > 60) ribbon(ch, s.pts, 0.14, 0, yo + 0.04, 0x8f8a6a, 0);
    if (c === 8) { ribbon(ch, s.pts, 0.16, 0.72, yo + 0.12, 0x2b2b2e, 0); ribbon(ch, s.pts, 0.16, -0.72, yo + 0.12, 0x2b2b2e, 0); }
  }
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8, side: THREE.DoubleSide });
  for (const ch of chunks.values()) {
    const N = new Float32Array(ch.P.length); for (let i = 1; i < N.length; i += 3) N[i] = 1;
    const m = new THREE.Mesh(geo({ position: [new Float32Array(ch.P), 3], normal: [N, 3], color: [new Float32Array(ch.C), 3] }, new Uint32Array(ch.I)), mat);
    m.renderOrder = 1; scene.add(m);
  }
}

/* ---------------- buildings ---------------- */
const BG = 40, BGW = Math.ceil(2 * HX / BG), BGH = Math.ceil(2 * HY / BG), bldGrid = new Array(BGW * BGH);
let bPc, bCo, bOff, bTop;
function inBuilding(x, y) {
  const i = (x + HX) / BG | 0, j = (y + HY) / BG | 0; if (i < 0 || j < 0 || i >= BGW || j >= BGH) return -1;
  const a = bldGrid[j * BGW + i]; if (!a) return -1;
  for (const b of a) {
    const n = bPc[b], o = bOff[b]; let ins = false;
    for (let k = 0, l = n - 1; k < n; l = k++) {
      const xi = bCo[o + k * 2] * QI, yi = bCo[o + k * 2 + 1] * QI, xj = bCo[o + l * 2] * QI, yj = bCo[o + l * 2 + 1] * QI;
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
    }
    if (ins) return b;
  }
  return -1;
}
const wallMats = [], nightMats = [];
function wallTextures() {
  const defs = [
    (c, e, x, y, lit) => { c.fillStyle = '#e9e9e6'; for (let k = 6; k < 64; k += 9) c.fillRect(x, y + k, 64, 1); c.fillStyle = '#fbfbf8'; c.fillRect(x + 19, y + 15, 26, 30); c.fillStyle = '#2f3d4c'; c.fillRect(x + 21, y + 17, 22, 26); c.fillStyle = '#fbfbf8'; c.fillRect(x + 31, y + 17, 2, 26); c.fillRect(x + 21, y + 29, 22, 2); if (lit) { e.fillStyle = '#ffd68a'; e.fillRect(x + 21, y + 17, 22, 26); } },
    (c, e, x, y, lit) => { c.fillStyle = '#dcdcd8'; c.fillRect(x, y + 50, 64, 3); c.fillStyle = '#31475a'; c.fillRect(x + 4, y + 16, 56, 30); c.fillStyle = '#c9ccd0'; c.fillRect(x + 31, y + 16, 2, 30); if (lit) { e.fillStyle = '#ffe9b8'; e.fillRect(x + 4, y + 16, 56, 30); } },
    (c, e, x, y) => { c.fillStyle = '#e4e4e1'; c.fillRect(x + 31, y, 1, 64); c.fillRect(x, y + 60, 64, 2); }];
  defs.forEach((fn, di) => {
    const c = mkCanvas(256, 256), e = mkCanvas(256, 256), cx = c.getContext('2d'), ex = e.getContext('2d');
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, 256, 256); ex.fillStyle = '#000'; ex.fillRect(0, 0, 256, 256);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) fn(cx, ex, i * 64, j * 64, hash(di * 31 + j * 4 + i) < (di ? 0.6 : 0.4));
    const t = new THREE.CanvasTexture(c), et = new THREE.CanvasTexture(e);
    for (const x of [t, et]) { x.wrapS = x.wrapT = THREE.RepeatWrapping; x.anisotropy = 4; x.colorSpace = THREE.SRGBColorSpace; }
    const m = new THREE.MeshLambertMaterial({ map: t, vertexColors: true, emissive: 0xffffff, emissiveMap: et, emissiveIntensity: 0 });
    wallMats.push(m); if (di < 2) nightMats.push(m);
  });
}
const HOUSE_W = [0xe8dcc4, 0xf1ece0, 0xcfd3d6, 0xb9c7d4, 0xa8583f, 0xc9b28f, 0xf7f5ef, 0xa9b89a, 0x8f6a52, 0xd8c7a3, 0x9aa7b0, 0xb5463a];
const HOUSE_R = [0x4b4744, 0x5c4a3d, 0x3c3f44, 0x6a5a4e, 0x55504a, 0x444a52];
const COM_W = [0xd9d2c3, 0xc8c4bb, 0xe3ded2, 0xb9a48c, 0xcfc9c0, 0xa7614a], COM_R = [0xb8b8b4, 0xa4a6a8, 0xc9c7c0, 0x8e9092];
const IND_W = [0xb8bcc0, 0xa9b3bb, 0xc7c2b6, 0x9fa6a0], BRICK = [0xa5563f, 0x9c5b45, 0xb06a4f, 0xc4a585];
function buildBuildings() {
  const B = D.bld; bPc = dec(B.pc, Uint8Array); bCo = dec(B.co, Int16Array); const bh = dec(B.h, Uint8Array), bt = dec(B.t, Uint8Array);
  bOff = new Uint32Array(B.n); bTop = new Float32Array(B.n);
  const CS = 1000, chunks = new Map(); const cw = new THREE.Color(), cr = new THREE.Color();
  const X = new Float32Array(256), Y = new Float32Array(256), bc = new THREE.Color();
  let o = 0;
  function tri(R, ax, ay, az, bx, by, bz, cx, cy, cz, col, ox, oz) {
    let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay), ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az), nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const flip = ny < -1e-4 || (Math.abs(ny) <= 1e-4 && (nx * ((ax + bx + cx) / 3 - ox) + nz * ((az + bz + cz) / 3 - oz)) < 0);
    if (flip) { R.P.push(ax, ay, az, cx, cy, cz, bx, by, bz); R.N.push(-nx, -ny, -nz, -nx, -ny, -nz, -nx, -ny, -nz); }
    else { R.P.push(ax, ay, az, bx, by, bz, cx, cy, cz); R.N.push(nx, ny, nz, nx, ny, nz, nx, ny, nz); }
    for (let i = 0; i < 3; i++) R.C.push(col.r, col.g, col.b);
  }
  for (let b = 0; b < B.n; b++) {
    const n = bPc[b]; bOff[b] = o;
    let cx = 0, cy = 0, base = 1e9, area = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (let k = 0; k < n; k++) {
      const x = X[k] = bCo[o + k * 2] * QI, y = Y[k] = bCo[o + k * 2 + 1] * QI; cx += x; cy += y; base = Math.min(base, hAt(x, y));
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    for (let k = 0, l = n - 1; k < n; l = k++) area += X[l] * Y[k] - X[k] * Y[l];
    area = Math.abs(area) / 2; cx /= n; cy /= n;
    for (let j = (y0 + HY) / BG | 0; j <= ((y1 + HY) / BG | 0); j++) for (let i = (x0 + HX) / BG | 0; i <= ((x1 + HX) / BG | 0); i++) {
      if (i < 0 || j < 0 || i >= BGW || j >= BGH) continue; (bldGrid[j * BGW + i] || (bldGrid[j * BGW + i] = [])).push(b);
    }
    const t = bt[b], H = Math.max(2.4, bh[b] / 4), r1 = hash(b), r2 = hash(b + 77777), r3 = hash(b + 31337);
    const key = ((cx + HX) / CS | 0) + ',' + ((cy + HY) / CS | 0);
    let ch = chunks.get(key);
    if (!ch) chunks.set(key, ch = { W: [0, 1, 2].map(() => ({ P: [], N: [], C: [], U: [], I: [] })), R: { P: [], N: [], C: [] } });
    /* colours */
    let wm = 0;
    if (t === 0) { cw.set(HOUSE_W[r1 * HOUSE_W.length | 0]); cr.set(HOUSE_R[r2 * HOUSE_R.length | 0]); }
    else if (t === 1) { cw.set(HOUSE_W[r1 * HOUSE_W.length | 0]).multiplyScalar(0.92); cr.set(HOUSE_R[r2 * HOUSE_R.length | 0]); wm = 2; }
    else if (t === 2) { cw.set(r1 < 0.5 ? BRICK[r2 * 4 | 0] : HOUSE_W[r2 * 4 | 0]); cr.set(HOUSE_R[r3 * HOUSE_R.length | 0]); }
    else if (t === 3) { cw.set(COM_W[r1 * COM_W.length | 0]); cr.set(COM_R[r2 * COM_R.length | 0]); wm = 1; }
    else if (t === 4) { cw.set(IND_W[r1 * IND_W.length | 0]); cr.set(COM_R[r2 * COM_R.length | 0]); wm = 2; }
    else if (t === 5) { cw.set(BRICK[r1 * 4 | 0]); cr.set(COM_R[r2 * COM_R.length | 0]); wm = 1; }
    else if (t === 6) { cw.set(r1 < 0.6 ? BRICK[r2 * 4 | 0] : 0xf2efe6); cr.set(HOUSE_R[r3 * HOUSE_R.length | 0]); wm = 1; }
    else if (t === 7) { cw.set(r1 < 0.5 ? 0x9b3a2e : 0xe7e2d6); cr.set(r2 < 0.5 ? 0x8d9094 : 0x5c4a3d); wm = 2; }
    else { cw.set(0xbfc2c4); cr.set(0xd6d6d2); wm = 2; }
    /* oriented bounding box → pitched roof? */
    let obb = null;
    if ((t === 0 || t === 1 || t === 6 || t === 7 || (t === 2 && area < 500)) && area < 1100 && n <= 20) {
      let ba = 1e18;
      for (let k = 0, l = n - 1; k < n; l = k++) {
        let dx = X[k] - X[l], dy = Y[k] - Y[l]; const L = Math.hypot(dx, dy); if (L < 0.8) continue; dx /= L; dy /= L;
        let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
        for (let q = 0; q < n; q++) { const u = X[q] * dx + Y[q] * dy, v = -X[q] * dy + Y[q] * dx; if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v; }
        const A = (u1 - u0) * (v1 - v0);
        if (A < ba) { ba = A; obb = { dx, dy, u0, u1, v0, v1 }; }
      }
      if (!obb || area / ba < 0.68) obb = null;
    }
    const wallH = obb ? Math.max(2.5, H * 0.62) : (t === 8 ? H : H);
    const yb = base * 1 - 1.5, yt = base + wallH; bTop[b] = base + H;
    /* walls */
    if (t !== 8) {
      const Wm = ch.W[wm], stories = Math.max(1, Math.round(wallH / 3.1)), uo = (r3 * 4 | 0) / 4, vo = (r2 * 4 | 0) / 4, vb = -1.5 / wallH * stories;
      for (let k = 0, l = n - 1; k < n; l = k++) {
        const ax = X[l], ay = Y[l], bx = X[k], by = Y[k], L = Math.hypot(bx - ax, by - ay); if (L < 0.05) continue;
        const nx = (by - ay) / L, nz = (bx - ax) / L, nw = L < 1.7 ? 0 : Math.max(1, Math.round(L / 3.2)), vi = Wm.P.length / 3;
        Wm.P.push(ax, yb, -ay, bx, yb, -by, bx, yt, -by, ax, yt, -ay);
        Wm.N.push(nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz);
        for (let i = 0; i < 4; i++) Wm.C.push(cw.r, cw.g, cw.b);
        Wm.U.push(uo, vo + vb / 4, uo + nw / 4, vo + vb / 4, uo + nw / 4, vo + stories / 4, uo, vo + stories / 4);
        Wm.I.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
      }
    }
    /* roof */
    const R = ch.R;
    if (obb) {
      const { dx, dy, u0, u1, v0, v1 } = obb; let ax = dx, ay = dy, hl = (u1 - u0) / 2, hw = (v1 - v0) / 2;
      const mu = (u0 + u1) / 2, mv = (v0 + v1) / 2, ox = mu * dx - mv * dy, oy = mu * dy + mv * dx;
      let bx = -dy, by = dx; if (hw > hl) { const tx = ax, ty = ay; ax = bx; ay = by; bx = -tx; by = -ty; const th = hl; hl = hw; hw = th; }
      const rh = Math.min(hw * 0.8, Math.max(1.2, H - wallH + 0.6)), hip = r3 < 0.45 ? Math.min(hw, hl * 0.7) : 0, e = 0.35;
      const Pt = (s, w) => [ox + ax * s * (hl + e) + bx * w * (hw + e), yt, -(oy + ay * s * (hl + e) + by * w * (hw + e))];
      const Rg = s => [ox + ax * s * (hl + e - hip), yt + rh, -(oy + ay * s * (hl + e - hip))];
      const A = Pt(-1, 1), Bq = Pt(1, 1), C = Pt(1, -1), Dq = Pt(-1, -1), R1 = Rg(1), R0 = Rg(-1), ec = hip ? cr : cw;
      tri(R, ...A, ...Bq, ...R1, cr, ox, -oy); tri(R, ...A, ...R1, ...R0, cr, ox, -oy);
      tri(R, ...C, ...Dq, ...R0, cr, ox, -oy); tri(R, ...C, ...R0, ...R1, cr, ox, -oy);
      tri(R, ...Bq, ...C, ...R1, ec, ox, -oy); tri(R, ...Dq, ...A, ...R0, ec, ox, -oy);
      bTop[b] = yt + rh;
      if (t === 6 && area > 150) { /* steeple */
        const sx = ox + ax * (hl - 2.5), sz = -(oy + ay * (hl - 2.5)), s = 1.6, ty = yt + rh + 2, ap = ty + 9; const wc = cw;
        const q = [[sx - s, sz - s], [sx + s, sz - s], [sx + s, sz + s], [sx - s, sz + s]];
        for (let k = 0; k < 4; k++) { const [x1, z1] = q[k], [x2, z2] = q[(k + 1) % 4]; tri(R, x1, yt, z1, x2, yt, z2, x2, ty, z2, wc, sx, sz); tri(R, x1, yt, z1, x2, ty, z2, x1, ty, z1, wc, sx, sz); tri(R, x1, ty, z1, x2, ty, z2, sx, ap, sz, cr, sx, sz); }
        bTop[b] = ap;
      }
    } else {
      const ring = bCo.subarray(o, o + n * 2); const { pts, faces } = triangulate([ring]);
      for (const f of faces) { const a = pts[f[0]], bq = pts[f[1]], c = pts[f[2]]; tri(R, a.x, yt, -a.y, bq.x, yt, -bq.y, c.x, yt, -c.y, cr, cx, -cy); }
      if (t === 8) for (const f of faces) { const a = pts[f[0]], bq = pts[f[1]], c = pts[f[2]]; R.P.push(a.x, yt - 0.3, -a.y, bq.x, yt - 0.3, -bq.y, c.x, yt - 0.3, -c.y); R.N.push(0, -1, 0, 0, -1, 0, 0, -1, 0); for (let i = 0; i < 3; i++) R.C.push(cr.r * .7, cr.g * .7, cr.b * .7); }
      if ((t === 3 || t === 5 || t === 4) && area > 600) { /* rooftop units */
        const m = 1 + (r1 * 3 | 0);
        for (let u = 0; u < m; u++) {
          const px = cx + (hash(b * 7 + u) - 0.5) * Math.sqrt(area) * 0.4, pz = -(cy + (hash(b * 13 + u) - 0.5) * Math.sqrt(area) * 0.4), s = 1.3 + hash(b + u) * 1.2, h2 = yt + 1.3;
          if (inPolyXY(px, -pz, X, Y, n)) box(R, px - s, yt, pz - s, px + s, h2, pz + s, 0x9a9c9e);
        }
      }
    }
    o += n * 2;
  }
  function inPolyXY(x, y, X, Y, n) { let ins = false; for (let k = 0, l = n - 1; k < n; l = k++) if ((Y[k] > y) !== (Y[l] > y) && x < (X[l] - X[k]) * (y - Y[k]) / (Y[l] - Y[k]) + X[k]) ins = !ins; return ins; }
  function box(R, x0, y0, z0, x1, y1, z1, hex) {
    bc.set(hex); const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const q = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    for (let k = 0; k < 4; k++) { const [xa, za] = q[k], [xb, zb] = q[(k + 1) % 4]; tri(R, xa, y0, za, xb, y0, zb, xb, y1, zb, bc, cx, cz); tri(R, xa, y0, za, xb, y1, zb, xa, y1, za, bc, cx, cz); }
    tri(R, x0, y1, z0, x1, y1, z0, x1, y1, z1, bc, cx, cz); tri(R, x0, y1, z0, x1, y1, z1, x0, y1, z1, bc, cx, cz);
  }
  /* special: courthouse clock tower + Potter's covered bridge */
  const any = chunks.values().next().value.R;
  for (const k in B.names) if (B.names[k] === 'Hamilton County Courthouse') {
    const b = +k, n = bPc[b]; let cx = 0, cy = 0; for (let q = 0; q < n; q++) { cx += bCo[bOff[b] + q * 2] * QI; cy += bCo[bOff[b] + q * 2 + 1] * QI; } cx /= n; cy /= n;
    const y0 = bTop[b] - 1, z = -cy;
    box(any, cx - 3.6, y0, z - 3.6, cx + 3.6, y0 + 13, z + 3.6, 0xb0664c); box(any, cx - 4, y0 + 13, z - 4, cx + 4, y0 + 14, z + 4, 0xe8e2d2);
    box(any, cx - 2.6, y0 + 14, z - 2.6, cx + 2.6, y0 + 19, z + 2.6, 0xe8e2d2);
    const c2 = new THREE.Color(0x4d5a55), ap = y0 + 27; const q = [[cx - 3, z - 3], [cx + 3, z - 3], [cx + 3, z + 3], [cx - 3, z + 3]];
    for (let i = 0; i < 4; i++) tri(any, q[i][0], y0 + 19, q[i][1], q[(i + 1) % 4][0], y0 + 19, q[(i + 1) % 4][1], cx, ap, z, c2, cx, z);
    bTop[b] = ap;
  }
  if (D.potter) {
    const [x1, y1, x2, y2] = D.potter, L = Math.hypot(x2 - x1, y2 - y1), dx = (x2 - x1) / L, dy = (y2 - y1) / L, nx = -dy, ny = dx, w = 3.2;
    const y0 = Math.max(hAt(x1, y1), hAt(x2, y2)) + 0.6, red = new THREE.Color(0x8e2f25), rf = new THREE.Color(0x4a4744), dk = new THREE.Color(0x6b5a48);
    const c = (s, t, h) => [x1 + dx * s + nx * t, y0 + h, -(y1 + dy * s + ny * t)]; const mx = (x1 + x2) / 2, mz = -(y1 + y2) / 2;
    for (const t of [-w, w]) { tri(any, ...c(0, t, 0), ...c(L, t, 0), ...c(L, t, 4.2), red, mx, mz); tri(any, ...c(0, t, 0), ...c(L, t, 4.2), ...c(0, t, 4.2), red, mx, mz); }
    for (const t of [-1, 1]) { tri(any, ...c(-0.6, t * (w + 0.6), 4), ...c(L + 0.6, t * (w + 0.6), 4), ...c(L + 0.6, 0, 6.4), rf, mx, mz); tri(any, ...c(-0.6, t * (w + 0.6), 4), ...c(L + 0.6, 0, 6.4), ...c(-0.6, 0, 6.4), rf, mx, mz); }
    for (const s of [0, L]) tri(any, ...c(s, -w, 4.2), ...c(s, w, 4.2), ...c(s, 0, 6.3), red, mx + (s ? 1 : -1) * dx * -9999, mz);
    tri(any, ...c(-3, -w, 0.05), ...c(L + 3, -w, 0.05), ...c(L + 3, w, 0.05), dk, mx, mz); tri(any, ...c(-3, -w, 0.05), ...c(L + 3, w, 0.05), ...c(-3, w, 0.05), dk, mx, mz);
  }
  const roofMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  for (const ch of chunks.values()) {
    ch.W.forEach((Wm, i) => {
      if (!Wm.P.length) return;
      scene.add(new THREE.Mesh(geo({ position: [new Float32Array(Wm.P), 3], normal: [new Float32Array(Wm.N), 3], color: [new Float32Array(Wm.C), 3], uv: [new Float32Array(Wm.U), 2] }, new Uint32Array(Wm.I)), wallMats[i]));
    });
    const R = ch.R; scene.add(new THREE.Mesh(geo({ position: [new Float32Array(R.P), 3], normal: [new Float32Array(R.N), 3], color: [new Float32Array(R.C), 3] }), roofMat));
  }
}

/* ---------------- trees ---------------- */
const treeChunks = [];
function buildTrees() {
  const T = D.trees, co = dec(T.co, Int16Array), at = dec(T.a, Uint8Array), CS = 500, map = new Map();
  for (let i = 0; i < T.n; i++) {
    const x = co[i * 2] * QI, y = co[i * 2 + 1] * QI, con = at[i] >> 4, key = ((x + HX) / CS | 0) + ',' + ((y + HY) / CS | 0) + ',' + con;
    let a = map.get(key); if (!a) map.set(key, a = { con, list: [] }); a.list.push(x, y, at[i] & 15);
  }
  const ico = (r, d) => new THREE.IcosahedronGeometry(r, d);
  const gNear = [merged([[new THREE.CylinderGeometry(0.16, 0.3, 3.4, 5), 0x5a4632, M4(0, 1.7, 0)], [ico(2.7, 0), 0xffffff, M4(0, 5.2, 0, 1, 0.92, 1)], [ico(1.9, 0), 0xe6f0e0, M4(1, 6.6, 0.6, 1, 0.9, 1, 1)], [ico(1.7, 0), 0xd8e6d2, M4(-1.2, 4.6, -0.8, 1, 0.9, 1, 2)]]),
    merged([[new THREE.CylinderGeometry(0.14, 0.24, 2, 5), 0x4f3d2c, M4(0, 1, 0)], [new THREE.ConeGeometry(2.3, 4.6, 7), 0xffffff, M4(0, 3.8, 0)], [new THREE.ConeGeometry(1.7, 4, 7), 0xf0f6ee, M4(0, 6.4, 0)], [new THREE.ConeGeometry(1.0, 3, 7), 0xe4eee0, M4(0, 8.6, 0)]])];
  const gFar = [merged([[new THREE.OctahedronGeometry(2.8, 0), 0xffffff, M4(0, 5, 0, 1, 1.05, 1)]]), merged([[new THREE.ConeGeometry(2.2, 9, 5), 0xffffff, M4(0, 5.5, 0)]])];
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const dm = new THREE.Object3D(), col = new THREE.Color();
  const DEC = [0x4f7f3a, 0x5a8a3f, 0x48743a, 0x628f45, 0x557f33, 0x6a9648, 0x3f6e38, 0x739a4c], CON = [0x2f5a3a, 0x356243, 0x2a5235];
  for (const a of map.values()) {
    const n = a.list.length / 3, near = new THREE.InstancedMesh(gNear[a.con], mat, n); let sx = 0, sy = 0;
    for (let i = 0; i < n; i++) {
      const x = a.list[i * 3], y = a.list[i * 3 + 1], v = a.list[i * 3 + 2], s = 0.75 + v / 15 * 0.85; sx += x; sy += y;
      dm.position.set(x, hAt(x, y) - 0.1, -y); dm.rotation.y = v * 1.3; dm.scale.set(s, s * (0.9 + (v % 4) * 0.08), s); dm.updateMatrix(); near.setMatrixAt(i, dm.matrix);
      col.set(a.con ? CON[v % 3] : DEC[v % 8]); near.setColorAt(i, col);
    }
    const far = new THREE.InstancedMesh(gFar[a.con], mat, n); far.instanceMatrix = near.instanceMatrix; far.instanceColor = near.instanceColor;
    near.computeBoundingSphere(); far.boundingSphere = near.boundingSphere.clone(); far.visible = false; near.visible = false;
    scene.add(near, far); treeChunks.push({ x: sx / n, y: sy / n, near, far });
  }
}

/* ---------------- street furniture ---------------- */
let beaconMat;
function buildInfra() {
  const P = D.pts, dm = new THREE.Object3D(), mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const cyl = (r1, r2, h, s = 6) => new THREE.CylinderGeometry(r1, r2, h, s), bx = (a, b, c) => new THREE.BoxGeometry(a, b, c);
  function inst(g, list, rot, m) {
    const n = list.length / 2; if (!n) return; const im = new THREE.InstancedMesh(g, m || mat, n);
    for (let i = 0; i < n; i++) { const x = list[i * 2] * QI, y = list[i * 2 + 1] * QI; dm.position.set(x, hAt(x, y), -y); dm.rotation.y = rot ? rot(x, y, i) : hash(i) * 6.28; dm.updateMatrix(); im.setMatrixAt(i, dm.matrix); }
    im.computeBoundingSphere(); scene.add(im);
  }
  const roadRot = (x, y) => { const r = nearestRoad(x, y, 40, 6); return r ? Math.atan2(r.dx, -r.dy) : 0; };
  /* power lines: orientation from line direction */
  const towerDir = new Map(); const LP = [];
  for (const l of D.plines) for (let i = 0; i < l.length; i += 2) {
    const j = Math.min(i + 2, l.length - 2), k = Math.max(i - 2, 0); towerDir.set(l[i] + ',' + l[i + 1], Math.atan2(l[j] - l[k], l[j + 1] - l[k + 1]));
    if (i + 2 < l.length) {
      const ax = l[i] * QI, ay = l[i + 1] * QI, bx2 = l[i + 2] * QI, by2 = l[i + 3] * QI, L = Math.hypot(bx2 - ax, by2 - ay) || 1, nx = -(by2 - ay) / L, ny = (bx2 - ax) / L, ha = hAt(ax, ay), hb = hAt(bx2, by2);
      for (const [off, hh] of [[-6, 22], [6, 22], [-4, 27], [4, 27]]) for (let s = 0; s < 6; s++) {
        const t0 = s / 6, t1 = (s + 1) / 6, sag = t => -Math.min(7, L * 0.03) * 4 * t * (1 - t);
        LP.push(lerp(ax, bx2, t0) + nx * off, lerp(ha, hb, t0) + hh + sag(t0), -(lerp(ay, by2, t0) + ny * off), lerp(ax, bx2, t1) + nx * off, lerp(ha, hb, t1) + hh + sag(t1), -(lerp(ay, by2, t1) + ny * off));
      }
    }
  }
  scene.add(new THREE.LineSegments(geo({ position: [new Float32Array(LP), 3] }), new THREE.LineBasicMaterial({ color: 0x33363a, transparent: true, opacity: 0.7 })));
  const pyl = merged([[cyl(0.5, 2.2, 30, 4), 0x9aa0a6, M4(0, 15, 0, 1, 1, 1, Math.PI / 4)], [bx(13, 0.5, 0.5), 0x9aa0a6, M4(0, 22.3, 0)], [bx(9, 0.5, 0.5), 0x9aa0a6, M4(0, 27.3, 0)]]);
  inst(pyl, P.tower, (x, y, i) => (towerDir.get(P.tower[i * 2] + ',' + P.tower[i * 2 + 1]) || 0));
  inst(merged([[cyl(0.11, 0.15, 9.5, 5), 0x6b5642, M4(0, 4.75, 0)], [bx(2.4, 0.14, 0.14), 0x6b5642, M4(0, 8.7, 0)]]), P.pole, roadRot);
  inst(merged([[cyl(0.25, 0.9, 58, 4), 0xc9cdd2, M4(0, 29, 0)], [bx(3, 3, 3), 0xd94a3a, M4(0, 52, 0, 0.4, 1, 0.4)]]), P.comm);
  beaconMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  inst(new THREE.SphereGeometry(0.8, 6, 5).translate(0, 58.5, 0), P.comm, null, beaconMat);
  const legs = [0, 1, 2, 3, 4, 5].map(i => [cyl(0.4, 0.5, 30, 5), 0xdfe5ea, M4(Math.cos(i * 1.047) * 6, 15, Math.sin(i * 1.047) * 6)]);
  inst(merged([...legs, [cyl(1.4, 1.4, 30, 8), 0xdfe5ea, M4(0, 15, 0)], [new THREE.SphereGeometry(9, 14, 10), 0xcfe3f2, M4(0, 34, 0, 1, 0.62, 1)]]), P.wtower);
  inst(merged([[cyl(0.1, 0.13, 6, 5), 0x3a3d40, M4(0, 3, 0)], [bx(0.12, 0.12, 6), 0x3a3d40, M4(0, 5.8, 3)], [bx(0.35, 1, 0.35), 0x222426, M4(0, 5.2, 2.2)], [bx(0.35, 1, 0.35), 0x222426, M4(0, 5.2, 5)], [bx(0.2, 0.2, 0.37), 0x38d24a, M4(0, 4.9, 2.2)], [bx(0.2, 0.2, 0.37), 0xe03c2c, M4(0, 5.5, 5)]]), P.signal, roadRot);
  inst(merged([[cyl(0.04, 0.04, 2.2, 4), 0x888c90, M4(0, 1.1, 0)], [new THREE.CylinderGeometry(0.38, 0.38, 0.04, 8), 0xc8281e, M4(0, 2.2, 0, 1, 1, 1, 0.39, Math.PI / 2)]]), P.stop, roadRot);
}

/* ---------------- sky ---------------- */
let sky, sunMesh, stars, clouds, tod = 14.5;
function buildSky() {
  sky = new THREE.Mesh(new THREE.SphereGeometry(20000, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, glow: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 glow; varying vec3 d; void main(){ vec3 n = normalize(d); float t = pow(clamp(n.y,0.0,1.0),0.45); vec3 c = mix(hor, top, t); float s = max(dot(n, sunDir),0.0); c += glow * (pow(s,8.0)*0.35 + pow(s,400.0)*1.5); gl_FragColor = vec4(c,1.0); }' }));
  sky.renderOrder = -10; scene.add(sky);
  const sp = new Float32Array(1500 * 3);
  for (let i = 0; i < 1500; i++) { const a = hash(i) * 6.283, e = Math.asin(hash(i + 5000)); sp[i * 3] = Math.cos(a) * Math.cos(e) * 18000; sp[i * 3 + 1] = Math.sin(e) * 18000 + 200; sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 18000; }
  stars = new THREE.Points(geo({ position: [sp, 3] }), new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); scene.add(stars);
  const parts = []; for (let i = 0; i < 7; i++) parts.push([new THREE.IcosahedronGeometry(1, 1), 0xffffff, M4((hash(i) - 0.5) * 5, hash(i + 9) * 0.5, (hash(i + 20) - 0.5) * 2.4, 1 + hash(i + 3), 0.55 + hash(i + 4) * 0.3, 1 + hash(i + 6) * 0.6)]);
  clouds = new THREE.InstancedMesh(merged(parts), new THREE.MeshLambertMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.92, emissive: 0x556070 }), 70);
  const dm = new THREE.Object3D();
  for (let i = 0; i < 70; i++) { dm.position.set((hash(i * 3) - 0.5) * 30000, 1100 + hash(i * 3 + 1) * 700, (hash(i * 3 + 2) - 0.5) * 30000); const s = 90 + hash(i + 400) * 160; dm.scale.set(s, s * 0.6, s); dm.rotation.y = hash(i) * 6; dm.updateMatrix(); clouds.setMatrixAt(i, dm.matrix); }
  clouds.frustumCulled = false; scene.add(clouds);
}
const cDay = new THREE.Color(0x4f8fdc), cDayH = new THREE.Color(0xcfe3f5), cDusk = new THREE.Color(0x3a4f86), cDuskH = new THREE.Color(0xf2a065), cNight = new THREE.Color(0x05070f), cNightH = new THREE.Color(0x121a2c), tmpC = new THREE.Color();
let nightF = 0;
function setTime(h) {
  tod = h; const ang = (h - 6) / 12 * Math.PI, el = Math.sin(ang), dir = new THREE.Vector3(Math.cos(ang), el * 0.95, 0.38).normalize();
  const day = clamp(el * 3 + 0.15, 0, 1), dusk = clamp(1 - Math.abs(el) * 3.2, 0, 1); nightF = 1 - clamp(el * 4 + 0.6, 0, 1);
  const u = sky.material.uniforms;
  u.top.value.copy(cNight).lerp(cDusk, clamp(el * 5 + 0.9, 0, 1)).lerp(cDay, day);
  u.hor.value.copy(cNightH).lerp(cDuskH, clamp(el * 5 + 0.9, 0, 1) * dusk + 0).lerp(cDayH, day * (1 - dusk * 0.8));
  u.sunDir.value.copy(dir); u.glow.value.setRGB(1, 0.85 - dusk * 0.3, 0.6 - dusk * 0.35).multiplyScalar(el > -0.1 ? 1 : 0);
  scene.fog.color.copy(u.hor.value);
  sun.intensity = 2.7 * clamp(el * 2.5, 0, 1); sun.color.setRGB(1, 0.95 - dusk * 0.25, 0.86 - dusk * 0.45);
  sunDirV.copy(el > 0 ? dir : dir.clone().multiplyScalar(-1));
  hemi.intensity = 0.34 + 1.17 * day; hemi.color.copy(tmpC.setRGB(0.55, 0.65, 1).lerp(new THREE.Color(0xdfeeff), day));
  stars.material.opacity = nightF; for (const m of nightMats) m.emissiveIntensity = nightF * 0.95;
  clouds.material.emissive.setScalar(0.03 + 0.3 * day); clouds.material.color.copy(tmpC.setRGB(1, 1 - dusk * 0.2, 1 - dusk * 0.35)).multiplyScalar(0.25 + 0.75 * day);
  const hh = h | 0, mm = (h - hh) * 60 | 0; $('clock').textContent = ((hh + 11) % 12 + 1) + ':' + String(mm).padStart(2, '0') + (hh >= 12 && hh < 24 ? ' PM' : ' AM');
  $('tod').value = h;
}
const sunDirV = new THREE.Vector3(0.3, 1, 0.3);

/* ---------------- traffic ---------------- */
const NCARS = 140, cars = []; let carMesh; const nodes = new Map();
const carGeo = () => merged([[new THREE.BoxGeometry(1.85, 0.62, 4.4), 0xffffff, M4(0, 0.62, 0)], [new THREE.BoxGeometry(1.62, 0.56, 2.3), 0x2a3440, M4(0, 1.18, -0.25)],
  [new THREE.BoxGeometry(1.95, 0.5, 0.75), 0x16181a, M4(0, 0.36, 1.4)], [new THREE.BoxGeometry(1.95, 0.5, 0.75), 0x16181a, M4(0, 0.36, -1.4)],
  [new THREE.BoxGeometry(1.5, 0.14, 0.06), 0xfff6d0, M4(0, 0.72, 2.21)], [new THREE.BoxGeometry(1.5, 0.14, 0.06), 0xc0281e, M4(0, 0.72, -2.21)]]);
const CARCOL = [0xd8d8d8, 0x2b2e33, 0x9b1c1c, 0x1f4e8c, 0xf2f2f2, 0x6d7278, 0x234f38, 0xc7a23a, 0x111214, 0x8a8f96];
const CSPD = [29, 25, 19, 17, 14, 10];
function buildTraffic() {
  segs.forEach((s, i) => { if (s.c > 5 || s.len < 8) return; for (const [k, e] of [[s.k0, 0], [s.k1, 1]]) { let a = nodes.get(k); if (!a) nodes.set(k, a = []); a.push([i, e]); } });
  carMesh = new THREE.InstancedMesh(carGeo(), new THREE.MeshLambertMaterial({ vertexColors: true }), NCARS); carMesh.frustumCulled = false;
  const c = new THREE.Color();
  for (let i = 0; i < NCARS; i++) { cars.push({ s: null, t: 0, dir: 1, v: 10, k: 0 }); carMesh.setColorAt(i, c.set(CARCOL[i % CARCOL.length])); }
  scene.add(carMesh);
}
function spawnCar(car, px, py) {
  for (let tries = 0; tries < 12; tries++) {
    const a = Math.random() * 6.283, r = 150 + Math.random() * 1100, rd = nearestRoad(px + Math.cos(a) * r, py + Math.sin(a) * r, 60, 5);
    if (rd && rd.s.c <= 5 && rd.s.len > 8) { car.s = rd.s; car.t = Math.random() * rd.s.len; car.dir = rd.s.c <= 1 || Math.random() < 0.5 ? 1 : -1; car.v = CSPD[rd.s.c] * (0.8 + Math.random() * 0.35); return; }
  }
  car.s = null;
}
const cdm = new THREE.Object3D();
function updateTraffic(dt, px, py) {
  for (let i = 0; i < NCARS; i++) {
    const car = cars[i];
    if (!car.s) { spawnCar(car, px, py); if (!car.s) { cdm.position.set(0, -500, 0); cdm.updateMatrix(); carMesh.setMatrixAt(i, cdm.matrix); continue; } }
    let s = car.s; car.t += car.v * car.dir * dt;
    if (car.t > s.len || car.t < 0) {
      const key = car.t < 0 ? s.k0 : s.k1, opts = (nodes.get(key) || []).filter(o => segs[o[0]] !== s && (segs[o[0]].c > 1 || o[1] === 0));
      if (!opts.length) { if (s.c <= 1) { car.s = null; continue; } car.dir *= -1; car.t = clamp(car.t, 0, s.len); }
      else { const o = opts[Math.random() * opts.length | 0]; s = car.s = segs[o[0]]; car.dir = o[1] === 0 ? 1 : -1; car.t = o[1] === 0 ? 0 : s.len; car.v = CSPD[s.c] * (0.8 + Math.random() * 0.35); }
    }
    const cum = s.cum; let k = 0; while (k < cum.length - 2 && cum[k + 1] < car.t) k++;
    const f = (car.t - cum[k]) / ((cum[k + 1] - cum[k]) || 1), ax = s.pts[k * 2], ay = s.pts[k * 2 + 1], bx = s.pts[k * 2 + 2], by = s.pts[k * 2 + 3];
    let dx = (bx - ax), dy = (by - ay); const L = Math.hypot(dx, dy) || 1; dx = dx / L * car.dir; dy = dy / L * car.dir;
    const off = s.c <= 1 ? 0 : Math.min(RW[s.c] / 4, 2.1), x = lerp(ax, bx, f) + dy * off, y = lerp(ay, by, f) - dx * off;
    if (Math.abs(x - px) + Math.abs(y - py) > 2600) { car.s = null; continue; }
    cdm.position.set(x, hAt(x, y) + 0.3, -y); cdm.rotation.set(0, Math.atan2(dx, -dy), 0); cdm.updateMatrix(); carMesh.setMatrixAt(i, cdm.matrix);
  }
  carMesh.instanceMatrix.needsUpdate = true;
}

/* ---------------- labels ---------------- */
const PG = 150, PGW = Math.ceil(2 * HX / PG), PGH = Math.ceil(2 * HY / PG), placeGrid = new Array(PGW * PGH);
const places = [];
function buildPlaces() {
  const seen = new Set();
  const add = (x, y, name, cat, h) => { const k = name.toLowerCase() + '|' + (x / 60 | 0) + '|' + (y / 60 | 0); if (seen.has(k)) return; seen.add(k); const p = { x, y, name, cat, h }; places.push(p); const gi = clamp((y + HY) / PG | 0, 0, PGH - 1) * PGW + clamp((x + HX) / PG | 0, 0, PGW - 1); (placeGrid[gi] || (placeGrid[gi] = [])).push(p); };
  for (const k in D.bld.names) { const b = +k, n = bPc[b]; let cx = 0, cy = 0; for (let q = 0; q < n; q++) { cx += bCo[bOff[b] + q * 2] * QI; cy += bCo[bOff[b] + q * 2 + 1] * QI; } add(cx / n, cy / n, D.bld.names[k], 'building', bTop[b] + 2); }
  for (const [x, y, name, c] of D.places) { const b = inBuilding(x, y); add(x, y, name, (D.pcats[c] || '').replace(/_/g, ' '), b >= 0 ? bTop[b] + 2 : hAt(x, y) + 6); }
}
const LABN = 46, labEls = [];
function initLabels() { const L = $('labels'); for (let i = 0; i < LABN; i++) { const d = document.createElement('div'); d.className = 'lab'; L.appendChild(d); labEls.push(d); } }
let labList = [], showLabels = true; const v3 = new THREE.Vector3();
function pickLabels(px, py, alt) {
  labList = []; if (!showLabels) return;
  for (const [name, x, y] of D.landmarks) { const d = Math.hypot(x - px, y - py); if (d > 60 && d < (alt > 40 ? 1e9 : 2500)) labList.push({ x, y, h: hAt(x, y) + 45 + d * 0.02, name, sub: d > 1000 ? (d / 1609).toFixed(1) + ' mi' : Math.round(d * 3.28 / 10) * 10 + ' ft', cls: 'lm', pr: 0, d }); }
  const ar = alt > 120 ? 3500 : 900;
  for (const [x, y, name, r, c] of D.areas) { const d = Math.hypot(x - px, y - py); if (d < Math.max(ar, r * 2) && d > 30) labList.push({ x, y, h: hAt(x, y) + 22, name, sub: '', cls: 'ar', pr: 1, d }); }
  const R = alt > 250 ? 0 : 260 + alt * 1.5, c0 = (px - R + HX) / PG | 0, c1 = (px + R + HX) / PG | 0, r0 = (py - R + HY) / PG | 0, r1 = (py + R + HY) / PG | 0, near = [];
  if (R) for (let j = r0; j <= r1; j++) for (let i = c0; i <= c1; i++) {
    if (i < 0 || j < 0 || i >= PGW || j >= PGH) continue; const a = placeGrid[j * PGW + i]; if (!a) continue;
    for (const p of a) { const d = Math.hypot(p.x - px, p.y - py); if (d < R) near.push({ x: p.x, y: p.y, h: p.h, name: p.name, sub: p.cat, cls: 'pl', pr: 2, d }); }
  }
  near.sort((a, b) => a.d - b.d); labList.push(...near.slice(0, 30));
  labList.sort((a, b) => a.pr - b.pr || a.d - b.d); labList = labList.slice(0, LABN * 2);
}
function drawLabels() {
  const W = innerWidth, H = innerHeight, used = []; let n = 0;
  for (const l of labList) {
    if (n >= LABN) break;
    v3.set(l.x, l.h, -l.y).project(camera); if (v3.z > 1 || v3.z < -1 || Math.abs(v3.x) > 1.05 || Math.abs(v3.y) > 1.05) continue;
    const sx = (v3.x + 1) / 2 * W, sy = (1 - v3.y) / 2 * H, w = l.name.length * (l.cls === 'lm' ? 4.2 : 3.4) + 10, hh = l.cls === 'pl' ? 15 : 12;
    let hit = false; for (const u of used) if (Math.abs(u[0] - sx) < u[2] + w && Math.abs(u[1] - sy) < u[3] + hh) { hit = true; break; }
    if (hit) continue; used.push([sx, sy, w, hh]);
    const e = labEls[n++]; if (e._l !== l) { e._l = l; e.className = 'lab ' + l.cls; e.innerHTML = ''; const b = document.createElement('b'); b.textContent = l.name; e.appendChild(b); if (l.sub) { const s = document.createElement('i'); s.textContent = l.sub; e.appendChild(s); } }
    e.style.display = 'block'; e.style.transform = 'translate(-50%,-100%) translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px)';
    e.style.opacity = l.cls === 'pl' ? clamp(1.6 - l.d / 220, 0.35, 1) : 1;
  }
  for (; n < LABN; n++) { labEls[n].style.display = 'none'; labEls[n]._l = null; }
}

/* ---------------- player ---------------- */
const P = { mode: 'walk', x: -1375, y: -112, alt: 0, vy: 0, yaw: 0, pitch: 0, ground: true };
const car = { x: 0, y: 0, yaw: 0, v: 0, steer: 0, mesh: null, camYaw: 0 };
const keys = {};
function safeSpot(x, y) { for (let r = 0; r < 80; r += 3) for (let a = 0; a < 6.28; a += 0.7) { const X = x + Math.cos(a) * r, Y = y + Math.sin(a) * r; if (inBuilding(X, Y) < 0) return [X, Y]; if (!r) break; } return [x, y]; }
function setMode(m) {
  if (m === P.mode) return; const prev = P.mode;
  if (prev === 'drive') { P.x = car.x + Math.cos(car.yaw) * 2.6; P.y = car.y + Math.sin(car.yaw) * 2.6; P.yaw = car.yaw; P.pitch = 0; }
  if (m === 'drive') {
    const rd = nearestRoad(P.x, P.y, 45, 5) || nearestRoad(P.x, P.y, 45, 6); car.x = P.x; car.y = P.y; car.yaw = P.yaw; car.v = 0;
    if (rd) { car.x = rd.x; car.y = rd.y; let a = Math.atan2(-rd.dx, rd.dy); if (Math.cos(a - P.yaw) < 0) a += Math.PI; car.yaw = a; const off = Math.min(RW[rd.s.c] / 4, 2.1); car.x += Math.cos(car.yaw) * off; car.y += Math.sin(car.yaw) * off; }
    else [car.x, car.y] = safeSpot(P.x, P.y);
    car.camYaw = 0;
  }
  if (m === 'fly' && prev !== 'fly') { P.alt = hAt(P.x, P.y) + (prev === 'walk' ? P.alt - hAt(P.x, P.y) : 0) + 70; P.pitch = Math.min(P.pitch, -0.35); }
  if (m === 'walk') { [P.x, P.y] = safeSpot(P.x, P.y); if (prev === 'fly') { P.vy = 0; P.ground = false; } else { P.alt = hAt(P.x, P.y); } P.pitch = clamp(P.pitch, -1.2, 1.2); }
  P.mode = m; car.mesh.visible = m === 'drive';
  for (const b of document.querySelectorAll('#modes button')) b.classList.toggle('on', b.dataset.m === m);
  $('speedo').style.display = m === 'drive' ? 'block' : 'none';
  $('hint').textContent = { walk: 'WASD move · Shift run · Space jump', drive: 'W/S gas & brake · A/D steer · Space handbrake', fly: 'WASD fly · Space up · C down · Shift fast' }[m];
}
function teleport(x, y) {
  x = clamp(x, -HX + 20, HX - 20); y = clamp(y, -HY + 20, HY - 20);
  if (P.mode === 'drive') { const rd = nearestRoad(x, y, 150, 5) || nearestRoad(x, y, 150, 6); if (rd) { x = rd.x; y = rd.y; car.yaw = Math.atan2(-rd.dx, rd.dy); } else[x, y] = safeSpot(x, y); car.x = x; car.y = y; car.v = 0; }
  else if (P.mode === 'fly') { P.x = x; P.y = y - 160; P.alt = hAt(x, y) + 140; P.yaw = 0; P.pitch = -0.6; }
  else { [P.x, P.y] = safeSpot(x, y); P.alt = hAt(P.x, P.y); P.vy = 0; }
  camSnap = true; labT = 0; hudT = 0;
}
let camSnap = true;
function collide(x, y, nx, ny) { /* returns allowed new position (slide along walls) */
  if (inBuilding(nx, ny) < 0) return [nx, ny]; if (inBuilding(nx, y) < 0) return [nx, y]; if (inBuilding(x, ny) < 0) return [x, ny]; return [x, y];
}
const touch = { mx: 0, my: 0, on: false };
function update(dt) {
  const turn = (keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0);
  let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  if (touch.on) { f = -touch.my; s = touch.mx; }
  const fast = keys.ShiftLeft || keys.ShiftRight;
  if (P.mode === 'walk') {
    P.yaw += turn * 1.8 * dt;
    const sp = (fast ? 16 : 5.5) * (keys.KeyW && keys.ShiftLeft && keys.ControlLeft ? 3 : 1), fx = -Math.sin(P.yaw), fy = Math.cos(P.yaw), l = Math.hypot(f, s) || 1;
    const dx = (fx * f + fy * s) / l * sp * dt, dy = (fy * f - fx * s) / l * sp * dt;
    if (f || s) [P.x, P.y] = collide(P.x, P.y, clamp(P.x + dx, -HX + 5, HX - 5), clamp(P.y + dy, -HY + 5, HY - 5));
    const g = hAt(P.x, P.y);
    if (P.ground) { P.alt = g; if (keys.Space) { P.vy = 6.5; P.ground = false; } }
    else { P.vy -= 18 * dt; P.alt += P.vy * dt; if (P.alt <= g) { P.alt = g; P.vy = 0; P.ground = true; } }
    camera.position.set(P.x, P.alt + 1.7, -P.y); camera.rotation.set(P.pitch, P.yaw, 0);
  } else if (P.mode === 'fly') {
    P.yaw += turn * 1.5 * dt;
    const g = hAt(P.x, P.y), agl = Math.max(0, P.alt - g), sp = (fast ? 4 : 1) * (25 + agl * 0.55), cp = Math.cos(P.pitch);
    const fx = -Math.sin(P.yaw), fy = Math.cos(P.yaw);
    P.x += (fx * cp * f + fy * s) * sp * dt; P.y += (fy * cp * f - fx * s) * sp * dt;
    P.alt += (Math.sin(P.pitch) * f + ((keys.Space ? 1 : 0) - (keys.KeyC || keys.ControlLeft ? 1 : 0)) * 0.8) * sp * dt;
    P.x = clamp(P.x, -HX - 3000, HX + 3000); P.y = clamp(P.y, -HY - 3000, HY + 3000);
    const b = inBuilding(P.x, P.y), fl = Math.max(hAt(P.x, P.y), b >= 0 ? bTop[b] : -1e9) + 1.5;
    P.alt = clamp(P.alt, fl, 6000);
    camera.position.set(P.x, P.alt, -P.y); camera.rotation.set(P.pitch, P.yaw, 0);
  } else {
    const steerIn = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0) - (touch.on ? touch.mx : 0);
    car.steer = lerp(car.steer, steerIn, Math.min(1, dt * 6));
    const onRoad = !!nearestRoad(car.x, car.y, 9, 6), vmax = (onRoad ? 52 : 24) * (fast ? 1.25 : 1);
    if (f > 0) car.v += (car.v < 0 ? 22 : 9.5 * (1 - car.v / vmax)) * dt * f;
    else if (f < 0) car.v += (car.v > 0 ? -24 : -6 * (1 + car.v / 12)) * dt * -f;
    car.v -= car.v * (onRoad ? 0.12 : 0.5) * dt; if (keys.Space) car.v -= car.v * 3.5 * dt;
    if (!f && Math.abs(car.v) < 0.3) car.v = 0;
    car.yaw += car.steer * car.v / (4.2 + Math.abs(car.v) * 0.38) * dt;
    const fx = -Math.sin(car.yaw), fy = Math.cos(car.yaw), nx = clamp(car.x + fx * car.v * dt, -HX + 5, HX - 5), ny = clamp(car.y + fy * car.v * dt, -HY + 5, HY - 5);
    const sg = car.v >= 0 ? 2.3 : -2.3;
    if (inBuilding(nx + fx * sg, ny + fy * sg) >= 0) car.v *= -0.25; else { car.x = nx; car.y = ny; }
    const hf = hAt(car.x + fx * 1.6, car.y + fy * 1.6), hb = hAt(car.x - fx * 1.6, car.y - fy * 1.6), hc = (hf + hb) / 2;
    car.mesh.position.set(car.x, hc + 0.36, -car.y); car.mesh.rotation.set(-Math.atan2(hf - hb, 3.2), car.yaw + Math.PI, 0, 'YXZ');
    if (Math.abs(car.v) > 2 && !mouseDown && !locked) car.camYaw *= Math.exp(-dt * 1.5);
    const cy = car.yaw + car.camYaw, bx = Math.sin(cy), by = -Math.cos(cy), dist = 8.5 + Math.abs(car.v) * 0.06, ch = 3.1 - P.pitch * 5;
    let tx = car.x + bx * dist, ty = car.y + by * dist; const th = Math.max(hAt(tx, ty) + 0.8, hc + clamp(ch, 0.8, 9));
    const k = camSnap ? 1 : 1 - Math.exp(-dt * 9);
    camera.position.set(lerp(camera.position.x, tx, k), lerp(camera.position.y, th, k), lerp(camera.position.z, -ty, k));
    camera.lookAt(car.x - bx * 3, hc + 1.3, -(car.y - by * 3));
    P.x = car.x; P.y = car.y; P.yaw = cy; P.alt = hc;
    $('mph').textContent = Math.abs(car.v * 2.237) | 0;
  }
  camSnap = false;
}

/* ---------------- minimap + big map ---------------- */
const mm = $('mini'), mx = mm.getContext('2d'); let mmZoom = 900;
function drawMini() {
  const S = mm.width, w = mmZoom * SX, h = mmZoom * SY, cx = (P.x + HX) * SX, cy = (HY - P.y) * SY;
  mx.fillStyle = '#8fa066'; mx.fillRect(0, 0, S, S);
  mx.drawImage(gcan, cx - w / 2, cy - h / 2, w, h, 0, 0, S, S);
  mx.fillStyle = '#ffd34d'; mx.strokeStyle = '#000'; mx.lineWidth = 1;
  for (const [n, x, y] of D.landmarks) { const px = S / 2 + (x - P.x) / mmZoom * S, py = S / 2 - (y - P.y) / mmZoom * S; if (px > 0 && py > 0 && px < S && py < S) { mx.beginPath(); mx.arc(px, py, 3.5, 0, 6.3); mx.fill(); mx.stroke(); } }
  mx.save(); mx.translate(S / 2, S / 2); mx.rotate(-P.yaw); mx.fillStyle = '#ff3b30'; mx.strokeStyle = '#fff'; mx.lineWidth = 2;
  mx.beginPath(); mx.moveTo(0, -11); mx.lineTo(7, 8); mx.lineTo(0, 4); mx.lineTo(-7, 8); mx.closePath(); mx.stroke(); mx.fill(); mx.restore();
  mx.fillStyle = '#fff'; mx.font = 'bold 12px system-ui,sans-serif'; mx.textAlign = 'center'; mx.shadowColor = '#000'; mx.shadowBlur = 3; mx.fillText('N', S / 2, 14); mx.shadowBlur = 0;
}
const big = $('bigmap'), bx2 = big.getContext('2d'); let mapOpen = false;
function openMap(o) {
  mapOpen = o; $('mapwrap').style.display = o ? 'flex' : 'none'; if (!o) return; if (document.pointerLockElement) document.exitPointerLock();
  const S = Math.min(innerHeight - 110, innerWidth - (innerWidth > 800 ? 330 : 30)); big.width = big.height = Math.max(300, S) * Math.min(2, devicePixelRatio || 1); big.style.width = big.style.height = Math.max(300, S) + 'px';
  const W = big.width; bx2.drawImage(gcan, 0, 0, W, W); const k = W / Math.max(300, S);
  bx2.lineCap = bx2.lineJoin = 'round';
  for (const [cs, colr, lw] of [[[4, 3], '#f4f1e6', 1.1], [[2], '#ffe9a8', 1.7], [[0, 1], '#ffb347', 2.4], [[8], '#333', 1]]) {
    bx2.strokeStyle = colr; bx2.lineWidth = lw * k; bx2.beginPath();
    for (const s of segs) if (cs.includes(s.c)) for (let i = 0; i < s.pts.length; i += 2) { const x = (s.pts[i] + HX) / (2 * HX) * W, y = (HY - s.pts[i + 1]) / (2 * HY) * W; i ? bx2.lineTo(x, y) : bx2.moveTo(x, y); }
    bx2.stroke();
  }
  bx2.font = 'bold ' + 11 * k + 'px system-ui,sans-serif'; bx2.textAlign = 'center'; bx2.lineWidth = 3 * k; bx2.strokeStyle = 'rgba(0,0,0,.75)';
  for (const [n, x, y] of D.landmarks) { const px = (x + HX) / (2 * HX) * W, py = (HY - y) / (2 * HY) * W; bx2.fillStyle = '#ffd34d'; bx2.beginPath(); bx2.arc(px, py, 4 * k, 0, 6.3); bx2.fill(); bx2.strokeText(n, px, py - 7 * k); bx2.fillStyle = '#fff'; bx2.fillText(n, px, py - 7 * k); }
  const px = (P.x + HX) / (2 * HX) * W, py = (HY - P.y) / (2 * HY) * W; bx2.save(); bx2.translate(px, py); bx2.rotate(-P.yaw); bx2.fillStyle = '#ff3b30'; bx2.strokeStyle = '#fff'; bx2.lineWidth = 2 * k;
  bx2.beginPath(); bx2.moveTo(0, -12 * k); bx2.lineTo(8 * k, 9 * k); bx2.lineTo(0, 4 * k); bx2.lineTo(-8 * k, 9 * k); bx2.closePath(); bx2.stroke(); bx2.fill(); bx2.restore();
}
big.addEventListener('click', e => { const r = big.getBoundingClientRect(); teleport((e.clientX - r.left) / r.width * 2 * HX - HX, HY - (e.clientY - r.top) / r.height * 2 * HY); openMap(false); });

/* ---------------- input ---------------- */
let locked = false, mouseDown = false, started = false;
function look(dx, dy) {
  const s = 0.0023;
  if (P.mode === 'drive') { car.camYaw -= dx * s; P.pitch = clamp(P.pitch - dy * s, -1.1, 0.4); }
  else { P.yaw -= dx * s; P.pitch = clamp(P.pitch - dy * s, -1.55, 1.55); }
}
canvas.addEventListener('mousedown', () => { mouseDown = true; if (started && !locked && canvas.requestPointerLock) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (e) { } } });
addEventListener('mouseup', () => mouseDown = false);
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; });
addEventListener('mousemove', e => { if (locked || mouseDown) look(e.movementX, e.movementY); });
canvas.addEventListener('wheel', e => { if (P.mode === 'fly') { const sp = 20 + (P.alt - hAt(P.x, P.y)) * 0.25, d = -Math.sign(e.deltaY) * sp; P.x += -Math.sin(P.yaw) * Math.cos(P.pitch) * d; P.y += Math.cos(P.yaw) * Math.cos(P.pitch) * d; P.alt += Math.sin(P.pitch) * d; } else mmZoom = clamp(mmZoom * (e.deltaY > 0 ? 1.25 : 0.8), 250, 6000); e.preventDefault(); }, { passive: false });
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
  keys[e.code] = true; if (!started) return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'Digit1') setMode('walk'); else if (e.code === 'Digit2') setMode('drive'); else if (e.code === 'Digit3' || e.code === 'KeyF') setMode(P.mode === 'fly' && e.code === 'KeyF' ? 'walk' : 'fly');
  else if (e.code === 'Tab') setMode({ walk: 'drive', drive: 'fly', fly: 'walk' }[P.mode]);
  else if (e.code === 'KeyM') openMap(!mapOpen); else if (e.code === 'Escape') { openMap(false); $('help').style.display = 'none'; }
  else if (e.code === 'KeyL') { showLabels = !showLabels; labT = 0; } else if (e.code === 'KeyH') $('help').style.display = $('help').style.display === 'block' ? 'none' : 'block';
  else if (e.code === 'KeyT') setTime(tod >= 21.5 ? 6 : tod + 1.5); else if (e.code === 'KeyR' && P.mode === 'drive') { car.v = 0; const rd = nearestRoad(car.x, car.y, 300, 5); if (rd) { car.x = rd.x; car.y = rd.y; car.yaw = Math.atan2(-rd.dx, rd.dy); } }
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
/* touch: left half = move stick, right half = look */
const tids = {};
canvas.addEventListener('touchstart', e => { for (const t of e.changedTouches) tids[t.identifier] = { x0: t.clientX, y0: t.clientY, lx: t.clientX, ly: t.clientY, left: t.clientX < innerWidth / 2 }; e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchmove', e => { for (const t of e.changedTouches) { const s = tids[t.identifier]; if (!s) continue; if (s.left) { touch.on = true; touch.mx = clamp((t.clientX - s.x0) / 60, -1, 1); touch.my = clamp((t.clientY - s.y0) / 60, -1, 1); } else look((t.clientX - s.lx) * 2.2, (t.clientY - s.ly) * 2.2); s.lx = t.clientX; s.ly = t.clientY; } e.preventDefault(); }, { passive: false });
const tend = e => { for (const t of e.changedTouches) { const s = tids[t.identifier]; if (s && s.left) { touch.on = false; touch.mx = touch.my = 0; } delete tids[t.identifier]; } };
canvas.addEventListener('touchend', tend); canvas.addEventListener('touchcancel', tend);
for (const b of document.querySelectorAll('#modes button')) b.addEventListener('click', () => { setMode(b.dataset.m); b.blur(); });
$('tod').addEventListener('input', e => setTime(+e.target.value));
$('mapbtn').addEventListener('click', () => openMap(!mapOpen)); $('closemap').addEventListener('click', () => openMap(false));
$('helpbtn').addEventListener('click', () => { $('help').style.display = $('help').style.display === 'block' ? 'none' : 'block'; });
$('help').addEventListener('click', () => $('help').style.display = 'none');
mm.addEventListener('click', () => openMap(true));

/* ---------------- main loop ---------------- */
let last = performance.now(), labT = 0, hudT = 0, frames = 0, fpsT = 0, trafT = 0;
const COMP = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = (now - last) / 1000, dt = Math.min(0.05, rdt); last = now;
  if (started && !mapOpen) update(dt);
  const cx = camera.position.x, cy = -camera.position.z, agl = camera.position.y - hAt(cx, cy);
  camera.near = clamp(agl * 0.04, 0.4, 20); camera.far = 30000; camera.updateProjectionMatrix();
  scene.fog.near = 500 + agl * 2; scene.fog.far = clamp(6500 + agl * 14, 6500, 26000);
  sky.position.copy(camera.position); stars.position.copy(camera.position);
  sun.position.set(cx, 0, -cy).addScaledVector(sunDirV, 1000); sun.target.position.set(cx, 0, -cy);
  const nearD = 520 + Math.min(agl, 300) * 0.5, farD = 2600 + Math.min(agl * 4, 5000);
  for (const t of treeChunks) { const d = Math.hypot(t.x - cx, t.y - cy); t.near.visible = d < nearD; t.far.visible = d >= nearD && d < farD; }
  trafT += dt; if (trafT > 0.033) { updateTraffic(trafT, P.x, P.y); trafT = 0; }
  if (beaconMat) beaconMat.color.setScalar(0).setRGB((Math.sin(now / 400) > 0 ? 1 : 0.25), 0.05, 0.03);
  clouds.position.x = ((now / 1000 * 6) % 6000) - 3000;
  renderer.render(scene, camera);
  labT -= dt; if (labT <= 0) { labT = 0.35; pickLabels(P.x, P.y, agl); }
  drawLabels();
  hudT -= dt;
  if (hudT <= 0) {
    hudT = 0.12; drawMini();
    const rd = nearestRoad(P.x, P.y, 22); let area = '';
    let best = 1e9; for (const [x, y, name, r] of D.areas) { const d = Math.hypot(x - P.x, y - P.y); if (d < r * 1.05 && r < best) { best = r; area = name; } }
    $('street').textContent = P.mode === 'fly' && agl > 60 ? Math.round(agl * 3.281) + ' ft above ground' : (rd && rd.s.name) || (rd ? ['Highway', 'Highway', 'Road', 'Road', 'Road', 'Street', 'Driveway / lot', 'Trail', 'Railroad'][rd.s.c] : '—');
    $('area').textContent = area;
    const brg = ((-P.yaw * 180 / Math.PI) % 360 + 360) % 360; $('comp').textContent = COMP[Math.round(brg / 45) % 8] + ' ' + Math.round(brg) + '°';
    $('coords').textContent = (D.lat0 + P.y / D.ky).toFixed(5) + '°N  ' + Math.abs(D.lon0 + P.x / D.kx).toFixed(5) + '°W';
  }
  frames++; fpsT += rdt; if (fpsT > 1) { $('fps').textContent = Math.round(frames / fpsT) + ' fps'; frames = 0; fpsT = 0; }
}

/* ---------------- boot ---------------- */
async function boot() {
  const steps = [['Painting the ground…', paintGround], ['Shaping terrain…', buildTerrain], ['Filling the White River & Morse Reservoir…', buildWater], ['Laying parking lots & ball fields…', buildDetail],
  ['Paving ' + segs.length.toLocaleString() + ' road segments…', buildRoads], ['Raising ' + D.bld.n.toLocaleString() + ' buildings…', () => { wallTextures(); buildBuildings(); }],
  ['Planting ' + D.trees.n.toLocaleString() + ' trees…', buildTrees], ['Power lines, signals & towers…', buildInfra], ['Sky, traffic & labels…', () => { buildSky(); buildTraffic(); buildPlaces(); initLabels(); }]];
  for (let i = 0; i < steps.length; i++) { status(steps[i][0], i / steps.length); await tick(); await tick(); steps[i][1](); }
  car.mesh = new THREE.Mesh(carGeo(), new THREE.MeshLambertMaterial({ vertexColors: true, color: 0xd23a2a })); car.mesh.visible = false; scene.add(car.mesh);
  const lm = $('lmlist'); for (const [n, x, y] of D.landmarks) { const b = document.createElement('button'); b.textContent = n; b.onclick = () => { teleport(x, y); openMap(false); }; lm.appendChild(b); }
  setTime(14.5); [P.x, P.y] = safeSpot(P.x, P.y); P.alt = hAt(P.x, P.y); P.yaw = 1.2;
  P.mode = ''; setMode('walk');
  status('Ready', 1); $('loading').style.display = 'none'; $('start').style.display = 'flex';
  $('start').addEventListener('click', () => { $('start').style.display = 'none'; $('hud').style.display = 'block'; started = true; });
  window.NB = { triFail: () => triFail, P, car, teleport, setMode, setTime, hAt, start: () => $('start').click(), scene, renderer, camera };
  requestAnimationFrame(frame);
}
boot().catch(e => { status('Error: ' + e.message, 0); console.error(e); });
})();
