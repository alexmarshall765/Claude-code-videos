// Chicago 3D — a self-contained, offline, explorable model of downtown Chicago.
import * as THREE from 'three';

const CITY = JSON.parse(document.getElementById('city-data').textContent);
const $ = (id) => document.getElementById(id);
const [BX0, BY0, BX1, BY1] = CITY.bounds;
const [KX, KY] = CITY.k;
// Map space: x = metres east, y = metres north of the origin. World space: (x, up, -y).
const ll = (lat, lon) => [(lon - CITY.origin[0]) * KX, (lat - CITY.origin[1]) * KY];

function dec(a) {
  const out = new Float32Array(a.length);
  let x = 0, y = 0;
  for (let i = 0; i < a.length; i += 2) { x += a[i]; y += a[i + 1]; out[i] = x * 0.1; out[i + 1] = y * 0.1; }
  return out;
}
function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

// ───────────────────────────── renderer ─────────────────────────────
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.3, 80000);
camera.rotation.order = 'YXZ';

// ───────────────────────────── shared shading ─────────────────────────────
const U = {
  uSun: { value: new THREE.Vector3(0, 1, 0) },
  uSunCol: { value: new THREE.Vector3(1, 1, 1) },
  uAmbCol: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
  uSkyTop: { value: new THREE.Vector3(0.2, 0.4, 0.8) },
  uSkyHor: { value: new THREE.Vector3(0.7, 0.8, 0.9) },
  uNight: { value: 0 },
  uFog: { value: 0.00008 },
  uTime: { value: 0 },
};
const GLSL_COMMON = /* glsl */`
  uniform vec3 uSun, uSunCol, uAmbCol, uSkyTop, uSkyHor;
  uniform float uNight, uFog, uTime;
  float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec3 skyColor(vec3 d){
    float t = clamp(d.y, 0.0, 1.0);
    vec3 c = mix(uSkyHor, uSkyTop, pow(t, 0.5));
    float s = max(dot(d, uSun), 0.0);
    c += uSunCol * (pow(s, 24.0) * 0.22 + pow(s, 4.0) * 0.10) * (1.0 - 0.5 * uNight);
    return c;
  }
  vec3 lightOf(vec3 n){
    return uSunCol * max(dot(n, uSun), 0.0) * 0.8 + uAmbCol * (0.45 + 0.2 * n.y);
  }
  vec3 fogged(vec3 c, vec3 wp){
    vec3 v = wp - cameraPosition;
    float d = length(v);
    float f = 1.0 - exp(-d * uFog);
    vec3 dir = v / max(d, 0.001);
    return mix(c, skyColor(normalize(vec3(dir.x, 0.03, dir.z))), f);
  }
`;
function shader(vs, fs, opts = {}) {
  return new THREE.ShaderMaterial(Object.assign({
    uniforms: U,
    vertexShader: vs,
    fragmentShader: GLSL_COMMON + fs,
  }, opts));
}

// Sky dome
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(40000, 32, 16),
  shader(/* glsl */`
    varying vec3 vDir;
    void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `, /* glsl */`
    varying vec3 vDir;
    void main(){
      vec3 d = normalize(vDir);
      vec3 c = skyColor(d);
      if (d.y < 0.0) c = mix(c, uSkyHor * 0.8, clamp(-d.y * 6.0, 0.0, 1.0));
      float s = max(dot(d, uSun), 0.0);
      c += uSunCol * smoothstep(0.99965, 0.9998, s) * mix(3.0, 2.2, uNight);
      // stars
      vec3 p = d * 260.0; vec3 ip = floor(p);
      float h = fract(sin(dot(ip, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      float star = step(0.9975, h) * (1.0 - smoothstep(0.0, 0.45, length(fract(p) - 0.5)));
      c += vec3(0.9, 0.95, 1.0) * star * uNight * smoothstep(0.02, 0.3, d.y) * 1.3;
      gl_FragColor = vec4(c, 1.0);
    }
  `, { side: THREE.BackSide, depthWrite: false, depthTest: false }));
sky.renderOrder = -100;
sky.frustumCulled = false;
scene.add(sky);

// Flat ground layers (drawn first, no depth: everything else paints over them)
const flatMat = shader(/* glsl */`
  attribute vec3 aCol; varying vec3 vCol; varying vec3 vW;
  void main(){ vCol = aCol; vW = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }
`, /* glsl */`
  varying vec3 vCol; varying vec3 vW;
  void main(){
    vec3 c = vCol * lightOf(vec3(0.0, 1.0, 0.0));
    gl_FragColor = vec4(fogged(c, vW), 1.0);
  }
`, { depthTest: false, depthWrite: false });

const roadMat = shader(/* glsl */`
  attribute vec3 aCol; attribute vec3 aR; varying vec3 vCol; varying vec3 vW; varying vec3 vR;
  void main(){ vCol = aCol; vR = aR; vW = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }
`, /* glsl */`
  varying vec3 vCol; varying vec3 vW; varying vec3 vR;
  void main(){
    vec3 alb = vCol;
    float fw = fwidth(vR.x) + 0.001;
    float vis = 1.0 - smoothstep(0.25, 0.9, fw);
    if (vR.z > 0.5) {
      float cl = 1.0 - smoothstep(0.10, 0.10 + fw, abs(abs(vR.x) - 0.22));
      alb = mix(alb, vec3(0.86, 0.70, 0.22), cl * vis);
      if (vR.z > 1.5) {
        float ln = 1.0 - smoothstep(0.09, 0.09 + fw, abs(abs(vR.x) - 3.4));
        float dash = step(fract(vR.y / 9.0), 0.35);
        alb = mix(alb, vec3(0.85), ln * dash * vis);
      }
    }
    vec3 c = alb * lightOf(vec3(0.0, 1.0, 0.0));
    c += uNight * step(0.5, vR.z) * vec3(0.30, 0.20, 0.09) * (0.55 + 0.45 * sin(vR.y * 0.21) * sin(vR.y * 0.21));
    gl_FragColor = vec4(fogged(c, vW), 1.0);
  }
`, { depthTest: false, depthWrite: false });

const waterMat = shader(/* glsl */`
  varying vec3 vW;
  void main(){ vW = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }
`, /* glsl */`
  varying vec3 vW;
  void main(){
    vec2 p = vW.xz; float t = uTime;
    vec3 v = vW - cameraPosition; float d = length(v); v /= d;
    float amp = 0.10 / (1.0 + d * 0.0012);
    vec3 n = normalize(vec3(
      (cos(p.x * 0.23 + t * 1.1) + cos(p.x * 0.071 + p.y * 0.113 - t * 0.7) + cos(p.y * 0.61 + p.x * 0.37 + t * 1.9) * 0.6) * amp,
      1.0,
      (sin(p.y * 0.19 - t * 0.9) + sin(p.y * 0.083 - p.x * 0.097 + t * 0.6) + sin(p.x * 0.53 - p.y * 0.41 - t * 1.7) * 0.6) * amp));
    vec3 r = reflect(v, n); r.y = abs(r.y);
    float fres = 0.06 + 0.8 * pow(1.0 - max(dot(-v, n), 0.0), 4.0);
    vec3 deep = mix(vec3(0.07, 0.24, 0.36), vec3(0.015, 0.035, 0.07), uNight) * (0.5 + 0.5 * lightOf(vec3(0.0, 1.0, 0.0)));
    vec3 c = mix(deep, skyColor(r), fres);
    c += uSunCol * pow(max(dot(r, uSun), 0.0), 180.0) * 1.2;
    gl_FragColor = vec4(fogged(c, vW), 1.0);
  }
`, { depthTest: false, depthWrite: false });

// Buildings: procedural windows that light up at night
const buildingMat = shader(/* glsl */`
  attribute vec3 aNrm; attribute vec4 aCol; attribute vec3 aUv;
  varying vec3 vN; varying vec3 vCol; varying float vSeed; varying vec3 vUv; varying vec3 vW;
  void main(){ vN = aNrm; vCol = aCol.rgb; vSeed = aCol.a; vUv = aUv; vW = position;
    gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }
`, /* glsl */`
  varying vec3 vN; varying vec3 vCol; varying float vSeed; varying vec3 vUv; varying vec3 vW;
  void main(){
    vec3 n = normalize(vN);
    float style = floor(vUv.z + 0.5);
    vec3 view = normalize(vW - cameraPosition);
    vec3 c;
    if (style > 2.5) {                       // roofs
      vec3 alb = mix(vCol, vec3(0.44, 0.45, 0.47), 0.65);
      c = alb * lightOf(n);
    } else {
      float ao = mix(0.62, 1.0, smoothstep(0.0, 28.0, vW.y));
      vec3 wall = vCol * lightOf(n) * ao;
      c = wall;
      if (style < 1.5) {
        vec2 g = vUv.xy; vec2 f = fract(g); vec2 id = floor(g);
        bool ground = g.y < 1.0;
        vec2 lo = style < 0.5 ? vec2(0.24, 0.26) : vec2(0.05, 0.10);
        vec2 hi = style < 0.5 ? vec2(0.76, 0.80) : vec2(0.95, 0.90);
        if (ground) { lo = vec2(0.08, 0.06); hi = vec2(0.92, 0.80); }
        vec2 fw = fwidth(g) + 1e-4;
        vec2 m2 = smoothstep(lo - fw, lo + fw, f) * (1.0 - smoothstep(hi - fw, hi + fw, f));
        float avg = (hi.x - lo.x) * (hi.y - lo.y);
        float m = mix(m2.x * m2.y, avg, smoothstep(0.3, 0.9, max(fw.x, fw.y)));
        float h1 = hash21(id + vSeed * 91.7);
        float h2 = hash21(id * 1.7 + vSeed * 13.1 + 5.0);
        vec3 r = reflect(view, n); r.y = abs(r.y) * 0.8 + 0.1;
        vec3 glass = mix(vec3(0.09, 0.13, 0.18), vCol * 0.5, 0.35) * (0.75 + 0.5 * h1) * (0.35 + 0.65 * (1.0 - uNight));
        glass = mix(glass, skyColor(normalize(r)), 0.42) * ao;
        glass += uSunCol * pow(max(dot(reflect(view, n), uSun), 0.0), 40.0) * 0.9 * (1.0 - uNight);
        float litP = ground ? 0.75 : 0.42;
        float lit = step(1.0 - litP, h1) * uNight;
        vec3 warm = mix(vec3(1.0, 0.80, 0.46), vec3(0.78, 0.88, 1.0), step(0.78, h2));
        glass += warm * lit * (0.55 + 0.6 * h2);
        c = mix(wall, glass, m);
      }
    }
    gl_FragColor = vec4(fogged(c, vW), 1.0);
  }
`);

// Generic lit vertex-colour material (trees, trains, the L, props). Supports instancing.
const litMat = shader(/* glsl */`
  attribute vec3 aCol; varying vec3 vCol; varying vec3 vN; varying vec3 vW;
  void main(){
    vec4 p = vec4(position, 1.0); vec3 n = normal; vCol = aCol;
    #ifdef USE_INSTANCING
      p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
    #endif
    #ifdef USE_INSTANCING_COLOR
      vCol *= instanceColor;
    #endif
    p = modelMatrix * p; vN = normalize(mat3(modelMatrix) * n); vW = p.xyz;
    gl_Position = projectionMatrix * viewMatrix * p;
  }
`, /* glsl */`
  varying vec3 vCol; varying vec3 vN; varying vec3 vW;
  void main(){
    vec3 c = vCol * lightOf(normalize(vN));
    gl_FragColor = vec4(fogged(c, vW), 1.0);
  }
`);

const mirrorMat = shader(/* glsl */`
  varying vec3 vN; varying vec3 vW;
  void main(){ vec4 p = modelMatrix * vec4(position, 1.0); vW = p.xyz;
    vN = normalize(mat3(modelMatrix) * (normal / (vec3(10.0, 5.0, 6.5) * vec3(10.0, 5.0, 6.5)) * 25.0));
    gl_Position = projectionMatrix * viewMatrix * p; }
`, /* glsl */`
  varying vec3 vN; varying vec3 vW;
  void main(){
    vec3 n = normalize(vN); vec3 v = normalize(vW - cameraPosition);
    vec3 r = reflect(v, n);
    vec3 env = r.y > 0.0 ? skyColor(r) : mix(vec3(0.55, 0.54, 0.5) * lightOf(vec3(0., 1., 0.)), skyColor(vec3(r.x, 0.02, r.z)), 0.3);
    env += uSunCol * pow(max(dot(r, uSun), 0.0), 90.0) * 1.5;
    gl_FragColor = vec4(fogged(env * 0.92 + 0.03, vW), 1.0);
  }
`);

// ───────────────────────────── geometry builders ─────────────────────────────
const v2pool = [];
function triangulate(rings) {
  const contour = [], holes = [];
  for (let r = 0; r < rings.length; r++) {
    const pts = rings[r], arr = r === 0 ? contour : [];
    for (let i = 0; i < pts.length; i += 2) arr.push(new THREE.Vector2(pts[i], pts[i + 1]));
    if (r > 0) holes.push(arr);
  }
  let faces;
  try { faces = THREE.ShapeUtils.triangulateShape(contour, holes); } catch (e) { return null; }
  const flat = [];
  for (const r of rings) for (let i = 0; i < r.length; i++) flat.push(r[i]);
  return { faces, flat };
}

class FlatBuilder {
  constructor() { this.pos = []; this.col = []; this.idx = []; this.extra = null; this.n = 0; }
  poly(rings, c) {
    const t = triangulate(rings); if (!t) return null;
    const base = this.n, f = t.flat;
    for (let i = 0; i < f.length; i += 2) { this.pos.push(f[i], 0, -f[i + 1]); this.col.push(c[0], c[1], c[2]); this.n++; }
    for (const fc of t.faces) this.idx.push(base + fc[0], base + fc[1], base + fc[2]);
    return t;
  }
  // polyline ribbon with mitred joints; pts in map coords
  ribbon(pts, width, c, flag = 0) {
    const n = pts.length / 2; if (n < 2) return;
    if (!this.extra) this.extra = [];
    const hw = width / 2; let along = 0; const base = this.n;
    for (let i = 0; i < n; i++) {
      const x = pts[i * 2], y = pts[i * 2 + 1];
      let ax = 0, ay = 0, bx = 0, by = 0;
      if (i > 0) { ax = x - pts[i * 2 - 2]; ay = y - pts[i * 2 - 1]; const l = Math.hypot(ax, ay) || 1; along += l; ax /= l; ay /= l; }
      if (i < n - 1) { bx = pts[i * 2 + 2] - x; by = pts[i * 2 + 3] - y; const l = Math.hypot(bx, by) || 1; bx /= l; by /= l; }
      if (i === 0) { ax = bx; ay = by; } if (i === n - 1) { bx = ax; by = ay; }
      let nx = -(ay + by), ny = ax + bx; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      const cosh = Math.max(0.5, nx * -ay + ny * ax);
      const k = hw / cosh;
      this.pos.push(x + nx * k, 0, -(y + ny * k), x - nx * k, 0, -(y - ny * k));
      this.col.push(c[0], c[1], c[2], c[0], c[1], c[2]);
      this.extra.push(hw, along, flag, -hw, along, flag);
      this.n += 2;
      if (i > 0) { const a = base + (i - 1) * 2; this.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
  }
  mesh(mat, order) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('aCol', new THREE.BufferAttribute(new Uint8Array(this.col), 3, true));
    if (this.extra) g.setAttribute('aR', new THREE.BufferAttribute(new Float32Array(this.extra), 3));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(this.idx), 1));
    const m = new THREE.Mesh(g, mat); m.renderOrder = order; m.frustumCulled = false;
    scene.add(m); return m;
  }
}

class LitBuilder {
  constructor() { this.pos = []; this.nrm = []; this.col = []; }
  box(cx, cy, cz, sx, sy, sz, yaw, c) {
    const co = Math.cos(yaw), si = Math.sin(yaw), hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const P = (x, y, z) => [cx + x * co + z * si, cy + y, cz - x * si + z * co];
    const N = (x, y, z) => [x * co + z * si, y, -x * si + z * co];
    const faces = [
      [[1, 0, 0], [hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]],
      [[-1, 0, 0], [-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]],
      [[0, 1, 0], [-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]],
      [[0, -1, 0], [-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]],
      [[0, 0, 1], [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]],
      [[0, 0, -1], [hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]],
    ];
    for (const f of faces) {
      const n = N(...f[0]), q = [P(...f[1]), P(...f[2]), P(...f[3]), P(...f[4])];
      for (const i of [0, 1, 2, 0, 2, 3]) { this.pos.push(...q[i]); this.nrm.push(...n); this.col.push(c[0], c[1], c[2]); }
    }
  }
  geo(geometry, matrix, c) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    g.applyMatrix4(matrix); g.computeVertexNormals();
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i += 3) { this.pos.push(p[i], p[i + 1], p[i + 2]); this.nrm.push(n[i], n[i + 1], n[i + 2]); this.col.push(c[0], c[1], c[2]); }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.nrm), 3));
    g.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(this.col), 3));
    return g;
  }
}
const M4 = (x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz));

// ───────────────────────────── spatial grids ─────────────────────────────
const CELL = 50;
const bGrid = new Map();   // building footprints
const rGrid = new Map();   // road segments
const cellKey = (ix, iy) => ix * 4096 + iy;
function gridAdd(grid, minx, miny, maxx, maxy, item) {
  const x0 = Math.floor(minx / CELL), x1 = Math.floor(maxx / CELL), y0 = Math.floor(miny / CELL), y1 = Math.floor(maxy / CELL);
  for (let ix = x0; ix <= x1; ix++) for (let iy = y0; iy <= y1; iy++) {
    const k = cellKey(ix + 2048, iy + 2048); let c = grid.get(k); if (!c) grid.set(k, c = []); c.push(item);
  }
}
const gridGet = (grid, x, y) => grid.get(cellKey(Math.floor(x / CELL) + 2048, Math.floor(y / CELL) + 2048));
function pip(pts, x, y) {
  let inside = false;
  for (let i = 0, n = pts.length, j = n - 2; i < n; j = i, i += 2) {
    const yi = pts[i + 1], yj = pts[j + 1];
    if ((yi > y) !== (yj > y) && x < (pts[j] - pts[i]) * (y - yi) / (yj - yi) + pts[i]) inside = !inside;
  }
  return inside;
}

// ───────────────────────────── ground, water, parks, roads ─────────────────────────────
const C = {
  ground: [168, 165, 156], park: [96, 148, 84], grass: [118, 166, 98], pitch: [104, 160, 108], plaza: [196, 190, 176],
  railyard: [128, 122, 114], garden: [88, 140, 86], pier: [176, 168, 150], bridge: [84, 86, 92], rail: [78, 72, 66],
  roads: [[50, 53, 58], [54, 57, 62], [58, 61, 66], [64, 67, 72], [78, 80, 84], [206, 202, 190]],
};
const ROAD_W = [16, 13, 10, 8, 4.5, 2.4];
const mapCv = document.createElement('canvas');
const MAP_S = 0.34;                                     // minimap pixels per metre
mapCv.width = Math.ceil((BX1 - BX0) * MAP_S); mapCv.height = Math.ceil((BY1 - BY0) * MAP_S);
const mctx = mapCv.getContext('2d');
const mx = (x) => (x - BX0) * MAP_S, my = (y) => (BY1 - y) * MAP_S;
function mapPoly(rings, fill) {
  mctx.beginPath();
  for (const r of rings) { mctx.moveTo(mx(r[0]), my(r[1])); for (let i = 2; i < r.length; i += 2) mctx.lineTo(mx(r[i]), my(r[i + 1])); mctx.closePath(); }
  mctx.fillStyle = fill; mctx.fill('evenodd');
}
function mapLine(pts, w, stroke) {
  mctx.beginPath(); mctx.moveTo(mx(pts[0]), my(pts[1]));
  for (let i = 2; i < pts.length; i += 2) mctx.lineTo(mx(pts[i]), my(pts[i + 1]));
  mctx.lineWidth = w; mctx.strokeStyle = stroke; mctx.stroke();
}

const treeSpots = [];
function buildGround() {
  const rnd = mulberry(7);
  mctx.fillStyle = '#39424d'; mctx.fillRect(0, 0, mapCv.width, mapCv.height);
  mctx.lineJoin = mctx.lineCap = 'round';

  const g = new FlatBuilder();
  // the base land is a grid of modest quads rather than one giant one
  const GT = 6000;
  for (let ix = -8; ix < 8; ix++) for (let iy = -8; iy < 8; iy++) {
    const b = g.n, x = ix * GT, y = iy * GT;
    g.pos.push(x, 0, -y, x + GT, 0, -y, x + GT, 0, -(y + GT), x, 0, -(y + GT));
    for (let k = 0; k < 4; k++) g.col.push(...C.ground);
    g.idx.push(b, b + 1, b + 2, b, b + 2, b + 3); g.n += 4;
  }
  const lcol = [C.park, C.grass, C.pitch, C.plaza, C.railyard, C.garden];
  const lmap = ['#3f6b45', '#4a7a4c', '#4a7a4c', '#4b5560', '#3a3f47', '#3f6b45'];
  const density = [1 / 230, 1 / 700, 0, 0, 0, 1 / 320];
  for (const l of CITY.l) {
    const rings = l.slice(1).map(dec), type = l[0];
    const t = g.poly(rings, lcol[type]); mapPoly(rings, lmap[type]);
    if (!t || !density[type]) continue;
    // scatter candidate trees over the triangles
    const f = t.flat;
    for (const fc of t.faces) {
      const ax = f[fc[0] * 2], ay = f[fc[0] * 2 + 1], bx = f[fc[1] * 2], by = f[fc[1] * 2 + 1], cx = f[fc[2] * 2], cy = f[fc[2] * 2 + 1];
      const area = Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2;
      let cnt = area * density[type]; cnt = Math.floor(cnt) + (rnd() < cnt % 1 ? 1 : 0);
      for (let i = 0; i < cnt; i++) {
        let u = rnd(), v = rnd(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
        treeSpots.push(ax + (bx - ax) * u + (cx - ax) * v, ay + (by - ay) * u + (cy - ay) * v);
      }
    }
  }
  g.mesh(flatMat, -50);

  const w = new FlatBuilder();
  for (const poly of CITY.w) { const rings = poly.map(dec); w.poly(rings, [0, 0, 0]); mapPoly(rings, '#1f4f78'); }
  const wm = w.mesh(waterMat, -45); wm.geometry.deleteAttribute('aCol');

  const p = new FlatBuilder();
  for (const pv of CITY.pv) { const rings = pv.slice(1).map(dec); p.poly(rings, pv[0] ? C.pier : C.bridge); mapPoly(rings, pv[0] ? '#4b5560' : '#59626d'); }
  p.mesh(flatMat, -40);

  const r = new FlatBuilder();
  for (const pl of CITY.pl) { const pts = dec(pl); r.ribbon(pts, 2.6, C.pier); mapLine(pts, 1, '#59626d'); }
  for (const rl of CITY.rail) r.ribbon(dec(rl), 1.7, C.rail);
  const roads = CITY.r.map((a) => ({ c: a[0], ni: a[1], pts: dec(a.slice(2)) })).sort((a, b) => b.c - a.c);
  for (const rd of roads) {
    r.ribbon(rd.pts, ROAD_W[rd.c], C.roads[rd.c], rd.c <= 1 ? 2 : rd.c <= 2 ? 1 : 0);
    if (rd.c <= 4) mapLine(rd.pts, rd.c <= 1 ? 3.2 : rd.c <= 3 ? 2.2 : 1, rd.c <= 3 ? '#77818d' : '#566070');
    const hw = ROAD_W[rd.c] / 2, pts = rd.pts;
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const s = { x1: pts[i], y1: pts[i + 1], x2: pts[i + 2], y2: pts[i + 3], hw, ni: rd.ni };
      gridAdd(rGrid, Math.min(s.x1, s.x2) - hw - 4, Math.min(s.y1, s.y2) - hw - 4, Math.max(s.x1, s.x2) + hw + 4, Math.max(s.y1, s.y2) + hw + 4, s);
    }
  }
  r.mesh(roadMat, -35);
}
function segDist(s, x, y) {
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1, l2 = dx * dx + dy * dy || 1;
  const t = clamp(((x - s.x1) * dx + (y - s.y1) * dy) / l2, 0, 1);
  return Math.hypot(x - s.x1 - dx * t, y - s.y1 - dy * t);
}

// ───────────────────────────── buildings ─────────────────────────────
const PAL_TALL = [0x6f8fa8, 0x5d7f99, 0x88a3b5, 0x4f6475, 0x9fb4c2, 0x465463, 0x7a8c99, 0xa9b7bf, 0x39444f, 0xb0a892, 0x8fa39a, 0xc7c2b4];
const PAL_MID = [0xb7a58f, 0xa58b74, 0xc9bfae, 0x8d6f5c, 0x9aa3aa, 0xd8d2c4, 0x7d8790, 0xa8967f, 0x8f7a68, 0xbcc3c9];
const PAL_LOW = [0xb08a72, 0x9c6f5a, 0xc2b39c, 0xd6cfc0, 0xa39a8e, 0x8a8f96, 0xa67c68, 0x93654f, 0xc8b8a0];
const TILE = 700;
function buildBuildings() {
  const tiles = new Map();
  const rnd = mulberry(1871);
  const up = [0, 127, 0];
  for (const b of CITY.b) {
    const h = b[0] * 0.1, m = b[1] * 0.1, kind = b[3], ni = b[4], rt = b[5], rh = b[6] * 0.1;
    const rings = []; for (let i = 7; i < b.length; i++) rings.push(dec(b[i]));
    const outer = rings[0];
    const tk = Math.floor((outer[0] - BX0) / TILE) * 64 + Math.floor((outer[1] - BY0) / TILE);
    let T = tiles.get(tk); if (!T) tiles.set(tk, T = { pos: [], nrm: [], col: [], uv: [], idx: [], n: 0 });

    // colour + facade style
    const seed = rnd();
    let c, style;
    if (b[2] >= 0) { c = hex(b[2]); const lum = c[0] + c[1] + c[2]; if (lum < 90) c = [c[0] + 34, c[1] + 38, c[2] + 44]; style = h > 55 ? 1 : 0; }
    else if (h > 75) { c = hex(PAL_TALL[(rnd() * PAL_TALL.length) | 0]); style = rnd() < 0.8 ? 1 : 0; }
    else if (h > 22) { c = hex(PAL_MID[(rnd() * PAL_MID.length) | 0]); style = rnd() < 0.3 ? 1 : 0; }
    else { c = hex(PAL_LOW[(rnd() * PAL_LOW.length) | 0]); style = 0; }
    const j = 0.9 + rnd() * 0.2; c = [clamp(c[0] * j, 0, 255), clamp(c[1] * j, 0, 255), clamp(c[2] * j, 0, 255)];
    if (kind === 8 || h - m < 3.2) style = 2;
    const sd = seed * 255;

    const wallTop = rt ? Math.max(m, h - rh) : h;
    const H = wallTop - m;
    const vTop = H < 5.2 ? 1 : 1 + Math.max(1, Math.round((H - 4.2) / 3.6));
    const vert = (x, y, z, n, u, v, s) => { T.pos.push(x, y, z); T.nrm.push(n[0], n[1], n[2]); T.col.push(c[0], c[1], c[2], sd); T.uv.push(u, v, s); return T.n++; };

    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9, sx = 0, sy = 0;
    for (let r = 0; r < rings.length; r++) {
      const pts = rings[r], n = pts.length;
      for (let i = 0; i < n; i += 2) {
        const ax = pts[i], ay = pts[i + 1], bx = pts[(i + 2) % n], by = pts[(i + 3) % n];
        if (r === 0) { if (ax < minx) minx = ax; if (ax > maxx) maxx = ax; if (ay < miny) miny = ay; if (ay > maxy) maxy = ay; sx += ax; sy += ay; }
        const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
        if (len < 0.05) continue;
        const nn = [Math.round(dy / len * 127), 0, Math.round(dx / len * 127)];
        if (H > 0.05) {
          const st = len < 1.7 ? 2 : style, nb = Math.max(1, Math.round(len / 3.3));
          const i0 = vert(ax, m, -ay, nn, 0, 0, st), i1 = vert(bx, m, -by, nn, nb, 0, st), i2 = vert(bx, wallTop, -by, nn, nb, vTop, st), i3 = vert(ax, wallTop, -ay, nn, 0, vTop, st);
          T.idx.push(i0, i1, i2, i0, i2, i3);
        }
        if (rt && r === 0) {   // pyramidal / domed cap: fan to the centroid
          const cxm = outer.reduce((s, v, k) => k % 2 === 0 ? s + v : s, 0) / (outer.length / 2);
          const cym = outer.reduce((s, v, k) => k % 2 === 1 ? s + v : s, 0) / (outer.length / 2);
          const run = Math.max(0.1, Math.abs((cxm - ax) * dy / len - (cym - ay) * dx / len)), sl = Math.hypot(run, rh);
          const pn = [Math.round(dy / len * rh / sl * 127), Math.round(run / sl * 127), Math.round(dx / len * rh / sl * 127)];
          const i0 = vert(ax, wallTop, -ay, pn, 0, 0, 3), i1 = vert(bx, wallTop, -by, pn, 0, 0, 3), i2 = vert(cxm, h, -cym, pn, 0, 0, 3);
          T.idx.push(i0, i1, i2);
        }
      }
    }
    if (!rt || m > 0.5) {
      const t = triangulate(rings);
      if (t) {
        const f = t.flat;
        const add = (y, n, flip) => {
          const base = T.n;
          for (let i = 0; i < f.length; i += 2) vert(f[i], y, -f[i + 1], n, 0, 0, 3);
          for (const fc of t.faces) {
            const a = fc[0], bb = fc[1], cc = fc[2];
            const ccw = (f[bb * 2] - f[a * 2]) * (f[cc * 2 + 1] - f[a * 2 + 1]) - (f[cc * 2] - f[a * 2]) * (f[bb * 2 + 1] - f[a * 2 + 1]) > 0;
            if (ccw !== flip) T.idx.push(base + a, base + bb, base + cc); else T.idx.push(base + a, base + cc, base + bb);
          }
        };
        if (!rt) add(h, up, false);
        if (m > 0.5) add(m, [0, -127, 0], true);
      }
    }
    // collision / picking / minimap
    if (kind !== 8 && h >= 2.5) {
      const fp = { pts: outer, minx, miny, maxx, maxy, h, m, ni, kind };
      gridAdd(bGrid, minx, miny, maxx, maxy, fp);
    }
    const shade = clamp(70 + h * 0.55, 70, 205) | 0;
    mapPoly([outer], `rgb(${shade},${shade + 6},${shade + 14})`);
  }
  for (const T of tiles.values()) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(T.pos), 3));
    g.setAttribute('aNrm', new THREE.BufferAttribute(new Int8Array(T.nrm), 3, true));
    g.setAttribute('aCol', new THREE.BufferAttribute(new Uint8Array(T.col), 4, true));
    g.setAttribute('aUv', new THREE.BufferAttribute(new Float32Array(T.uv), 3));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(T.idx), 1));
    g.computeBoundingSphere();
    scene.add(new THREE.Mesh(g, buildingMat));
  }
}

// collision helpers (map coords; feet/head are heights in metres)
function blockedAt(x, y, feet, head) {
  const cell = gridGet(bGrid, x, y); if (!cell) return null;
  for (const f of cell) {
    if (x < f.minx || x > f.maxx || y < f.miny || y > f.maxy) continue;
    if (f.m < head && f.h > feet + 0.6 && pip(f.pts, x, y)) return f;
  }
  return null;
}
function floorAt(x, y, feet) {
  const cell = gridGet(bGrid, x, y); let fl = 0; if (!cell) return 0;
  for (const f of cell) {
    if (x < f.minx || x > f.maxx || y < f.miny || y > f.maxy) continue;
    if (f.h <= feet + 0.6 && f.h > fl && pip(f.pts, x, y)) fl = f.h;
  }
  return fl;
}

// ───────────────────────────── trees ─────────────────────────────
function buildTrees() {
  const lb = new LitBuilder();
  lb.geo(new THREE.CylinderGeometry(0.22, 0.34, 3, 5), M4(0, 1.5, 0), [0.36, 0.27, 0.2]);
  lb.geo(new THREE.IcosahedronGeometry(2.3, 0), M4(0, 4.6, 0, 1, 1.25, 1), [1, 1, 1]);
  lb.geo(new THREE.IcosahedronGeometry(1.5, 0), M4(0.9, 3.6, 0.5, 1, 1, 1, 1), [0.9, 0.95, 0.9]);
  const keep = [];
  for (let i = 0; i < treeSpots.length && keep.length < 28000; i += 2) {
    const x = treeSpots[i], y = treeSpots[i + 1];
    if (blockedAt(x, y, 0, 2)) continue;
    const cell = gridGet(rGrid, x, y); let ok = true;
    if (cell) for (const s of cell) if (segDist(s, x, y) < s.hw + 1.6) { ok = false; break; }
    if (ok) keep.push(x, y);
  }
  const geo = lb.geometry(), groups = new Map(), TT = 500;
  for (let i = 0; i < keep.length; i += 2) {
    const k = Math.floor(keep[i] / TT) * 1000 + Math.floor(keep[i + 1] / TT);
    let a = groups.get(k); if (!a) groups.set(k, a = []); a.push(keep[i], keep[i + 1]);
  }
  const rnd = mulberry(99), m = new THREE.Matrix4(), col = new THREE.Color();
  const q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (const a of groups.values()) {
    const n = a.length / 2, mesh = new THREE.InstancedMesh(geo, litMat, n);
    for (let i = 0; i < n; i++) {
      const sc = 0.75 + rnd() * 0.85;
      e.set(0, rnd() * 6.28, 0); q.setFromEuler(e); s.set(sc, sc * (0.9 + rnd() * 0.4), sc); p.set(a[i * 2], 0, -a[i * 2 + 1]);
      mesh.setMatrixAt(i, m.compose(p, q, s));
      const t = rnd();
      col.setRGB(0.36 + t * 0.2, 0.62 + rnd() * 0.2, 0.26 + t * 0.1);
      mesh.setColorAt(i, col);
    }
    mesh.computeBoundingSphere();
    scene.add(mesh);
  }
}

// ───────────────────────────── the L (elevated trains) ─────────────────────────────
const trains = [];
let trainMesh;
function buildEl() {
  const lb = new LitBuilder(), steel = [0.26, 0.28, 0.3], deck = [0.36, 0.34, 0.31];
  const DECK_Y = 6.4;
  for (const e of CITY.el) {
    const pts = dec(e); let carry = 0;
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const ax = pts[i], ay = pts[i + 1], dx = pts[i + 2] - ax, dy = pts[i + 3] - ay, len = Math.hypot(dx, dy);
      if (len < 0.2) continue;
      const yaw = Math.atan2(dy, dx);
      lb.box(ax + dx / 2, DECK_Y - 0.45, -(ay + dy / 2), len + 0.6, 0.9, 4.2, yaw, deck);
      for (let d = carry; d < len; d += 24) {
        const px = ax + dx * d / len, py = ay + dy * d / len;
        lb.box(px, (DECK_Y - 0.9) / 2, -py, 0.55, DECK_Y - 0.9, 0.55, yaw, steel);
      }
      carry = (carry - len) % 24; if (carry < 0) carry += 24;
    }
    mapLine(pts, 1.6, '#c9824a');
  }
  const mesh = new THREE.Mesh(lb.geometry(), litMat); mesh.frustumCulled = false; scene.add(mesh);

  // trains shuttle along the longest stretches of track
  const car = new LitBuilder();
  car.box(0, 1.75, 0, 14.6, 2.9, 2.8, 0, [0.76, 0.78, 0.8]);
  car.box(0, 2.25, 0, 13.4, 0.95, 2.86, 0, [0.1, 0.13, 0.17]);
  car.box(0, 0.25, 0, 11, 0.5, 2.2, 0, [0.15, 0.15, 0.16]);
  car.box(0, 3.3, 0, 13.8, 0.25, 2.3, 0, [0.6, 0.62, 0.64]);
  const CARS = 4;
  for (const t of CITY.tr) {
    const pts = dec(t), cum = [0];
    for (let i = 2; i < pts.length; i += 2) cum.push(cum[cum.length - 1] + Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]));
    const len = cum[cum.length - 1];
    const count = len > 1400 ? 2 : 1;
    for (let k = 0; k < count; k++) trains.push({ pts, cum, len, phase: k * len + trains.length * 137 });
  }
  trainMesh = new THREE.InstancedMesh(car.geometry(), litMat, trains.length * CARS);
  trainMesh.frustumCulled = false; scene.add(trainMesh);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  updateTrains = (time) => {
    let k = 0;
    for (const tr of trains) {
      const span = tr.len - 70, cyc = (time * 15 + tr.phase) % (span * 2);
      const head = 66 + (cyc < span ? cyc : span * 2 - cyc);
      for (let c = 0; c < CARS; c++) {
        const s = clamp(head - c * 15.6 - 8, 0, tr.len);
        let lo = 0, hi = tr.cum.length - 1;
        while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (tr.cum[mid] <= s) lo = mid; else hi = mid; }
        const f = (s - tr.cum[lo]) / (tr.cum[hi] - tr.cum[lo] || 1);
        const ax = tr.pts[lo * 2], ay = tr.pts[lo * 2 + 1], bx = tr.pts[hi * 2], by = tr.pts[hi * 2 + 1];
        p.set(ax + (bx - ax) * f, DECK_Y, -(ay + (by - ay) * f));
        e.set(0, Math.atan2(by - ay, bx - ax), 0); q.setFromEuler(e);
        trainMesh.setMatrixAt(k++, m.compose(p, q, one));
      }
    }
    trainMesh.instanceMatrix.needsUpdate = true;
  };
}
let updateTrains = () => {};

// ───────────────────────────── landmarks ─────────────────────────────
const LANDMARKS = [
  ['Willis Tower', 41.8789, -87.6359, 442, '110 stories and 442 m to the roof. The tallest building in the world from 1973 until 1998 — many locals still call it the Sears Tower.'],
  ['Cloud Gate', 41.88268, -87.62332, 12, 'Anish Kapoor’s mirror-polished sculpture, nicknamed “The Bean”, is made of 168 welded stainless-steel plates.'],
  ['Jay Pritzker Pavilion', 41.88325, -87.62175, 36, 'Frank Gehry’s billowing steel bandshell has anchored Millennium Park since 2004.'],
  ['Art Institute of Chicago', 41.87962, -87.62372, 28, 'Founded in 1879. Two bronze lions have guarded the Michigan Avenue entrance since 1894.'],
  ['Buckingham Fountain', 41.87579, -87.61894, 30, 'Dedicated in 1927, it is one of the largest fountains in the world. Its centre jet shoots about 150 feet high.'],
  ['Navy Pier', 41.89166, -87.60745, 62, 'Opened in 1916 and stretching more than 3,000 feet into Lake Michigan. The Centennial Wheel stands nearly 200 feet tall.'],
  ['875 North Michigan Avenue', 41.89886, -87.62293, 344, 'The former John Hancock Center (1969): 100 stories wrapped in its famous X-bracing.'],
  ['Chicago Water Tower', 41.89720, -87.62440, 47, 'Built in 1869, this limestone tower is one of the few structures that survived the Great Chicago Fire of 1871.'],
  ['Tribune Tower', 41.89045, -87.62360, 141, 'A neo-Gothic skyscraper finished in 1925. Fragments of famous buildings from around the world are set into its walls.'],
  ['Wrigley Building', 41.88960, -87.62470, 130, 'Gleaming white terra-cotta towers from the early 1920s, at the foot of the Magnificent Mile.'],
  ['Trump International Hotel & Tower', 41.88885, -87.62640, 423, 'Completed in 2009, it is the second-tallest building in Chicago.'],
  ['Marina City', 41.88810, -87.62870, 179, 'Bertrand Goldberg’s twin “corncob” towers from the 1960s, with a marina at river level.'],
  ['Merchandise Mart', 41.88850, -87.63540, 104, 'When it opened in 1930 it was the largest building in the world by floor area.'],
  ['Chicago Theatre', 41.88540, -87.62750, 40, 'Opened in 1921. Its six-storey vertical “C-H-I-C-A-G-O” sign is an unofficial emblem of the city.'],
  ['Aon Center', 41.88530, -87.62150, 346, 'An 83-storey tower completed in 1973, among the tallest buildings in Chicago.'],
  ['The St. Regis Chicago', 41.88735, -87.61770, 363, 'Designed by Jeanne Gang’s Studio Gang and finished in 2020 — the third-tallest building in the city.'],
  ['Chicago Board of Trade Building', 41.87775, -87.63225, 184, 'An Art Deco landmark from 1930, capped by a statue of Ceres, the Roman goddess of grain.'],
  ['Harold Washington Library', 41.87630, -87.62820, 50, 'Chicago’s central public library, opened in 1991 and named after the city’s first Black mayor.'],
  ['Union Station', 41.87870, -87.64030, 35, 'Opened in 1925. Its Great Hall has a barrel-vaulted skylight soaring over the waiting room.'],
  ['Field Museum', 41.86630, -87.61700, 35, 'One of the world’s great natural history museums and home to SUE, a remarkably complete T. rex.'],
  ['Shedd Aquarium', 41.86760, -87.61400, 30, 'Opened in 1930 on the lakefront Museum Campus.'],
  ['Adler Planetarium', 41.86635, -87.60680, 25, 'Opened in 1930 as the first planetarium in the Western Hemisphere.'],
  ['Soldier Field', 41.86230, -87.61670, 45, 'Opened in 1924 and home of the Chicago Bears.'],
].map(([name, lat, lon, h, fact], i) => { const [x, y] = ll(lat, lon); return { i, name, x, y, h, fact, found: false }; });

const SAVE_KEY = 'chicago3d.found.v1';
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || '[]'); for (const n of s) { const l = LANDMARKS.find((q) => q.name === n); if (l) l.found = true; } } catch (e) { /* storage unavailable */ }
const saveFound = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(LANDMARKS.filter((l) => l.found).map((l) => l.name))); } catch (e) { /* ignore */ } };

let wheel, jet;
function buildProps() {
  // beacons
  const beamGeo = new THREE.CylinderGeometry(5, 5, 1, 14, 1, true); beamGeo.translate(0, 0.5, 0);
  for (const l of LANDMARKS) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uC: { value: new THREE.Vector3(1, 0.78, 0.3) }, uT: U.uTime, uA: { value: 1 } },
      vertexShader: 'varying float vY; varying vec3 vN2; varying vec3 vV; void main(){ vY = position.y; vec4 w = modelMatrix * vec4(position,1.0); vN2 = normalize(mat3(modelMatrix)*vec3(normal.x,0.0,normal.z)); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform vec3 uC; uniform float uT, uA; varying float vY; varying vec3 vN2; varying vec3 vV; void main(){ float a = (1.0 - vY) * (0.22 + 0.12 * sin(uT * 2.0 + vY * 30.0)); a *= 0.35 + 0.65 * abs(dot(normalize(vN2), normalize(vec3(vV.x, 0.0, vV.z)))); gl_FragColor = vec4(uC * a * uA, 1.0); }',
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const beam = new THREE.Mesh(beamGeo, mat);
    beam.position.set(l.x, l.h + 4, -l.y); beam.scale.set(1, 520, 1);
    beam.frustumCulled = false; scene.add(beam); l.beam = beam;
    setBeam(l);
  }
  // Cloud Gate
  const bean = LANDMARKS[1];
  const bm = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), mirrorMat);
  bm.scale.set(10, 5, 6.5); bm.position.set(bean.x, 5.2, -bean.y); bm.rotation.y = 0.05; scene.add(bm);

  // Buckingham Fountain
  const bf = LANDMARKS[4], lb = new LitBuilder(), stone = [0.82, 0.74, 0.68], wat = [0.45, 0.68, 0.8];
  lb.geo(new THREE.CylinderGeometry(27, 28, 1.0, 28), M4(bf.x, 0.5, -bf.y), stone);
  lb.geo(new THREE.CylinderGeometry(25.5, 25.5, 0.3, 28), M4(bf.x, 1.0, -bf.y), wat);
  lb.geo(new THREE.CylinderGeometry(11, 12, 1.6, 20), M4(bf.x, 2.0, -bf.y), stone);
  lb.geo(new THREE.CylinderGeometry(6.5, 7.5, 1.6, 16), M4(bf.x, 3.6, -bf.y), stone);
  lb.geo(new THREE.CylinderGeometry(3, 3.6, 1.6, 12), M4(bf.x, 5.2, -bf.y), stone);
  // Centennial Wheel supports
  const np = LANDMARKS[5], WR = 27, WY = 33;
  for (const sgn of [-1, 1]) for (const lean of [-1, 1]) {
    const g = new THREE.CylinderGeometry(0.6, 0.8, 36, 6);
    const mm = new THREE.Matrix4().compose(new THREE.Vector3(np.x + lean * 7, WY / 2, -np.y + sgn * 3.2), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, lean * 0.42)), new THREE.Vector3(1, 1, 1));
    lb.geo(g, mm, [0.9, 0.9, 0.92]);
  }
  const props = new THREE.Mesh(lb.geometry(), litMat); props.frustumCulled = false; scene.add(props);

  const wb = new LitBuilder(), white = [0.93, 0.93, 0.95];
  wb.geo(new THREE.TorusGeometry(WR, 0.45, 6, 48), M4(0, 0, -1.6), white);
  wb.geo(new THREE.TorusGeometry(WR, 0.45, 6, 48), M4(0, 0, 1.6), white);
  wb.geo(new THREE.CylinderGeometry(1.6, 1.6, 7, 10), new THREE.Matrix4().makeRotationX(Math.PI / 2), [0.75, 0.2, 0.2]);
  const N = 21;
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2;
    for (const z of [-1.6, 1.6]) {
      const mm = new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * WR / 2, Math.sin(a) * WR / 2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, a + Math.PI / 2)), new THREE.Vector3(1, 1, 1));
      wb.geo(new THREE.CylinderGeometry(0.14, 0.14, WR, 4), mm, white);
    }
    wb.geo(new THREE.IcosahedronGeometry(1.9, 1), M4(Math.cos(a) * (WR + 0.4), Math.sin(a) * (WR + 0.4), 0, 1, 0.95, 1), i % 2 ? [0.16, 0.3, 0.62] : [0.12, 0.22, 0.48]);
  }
  wheel = new THREE.Mesh(wb.geometry(), litMat);
  wheel.position.set(np.x, WY, -np.y); wheel.rotation.y = 0.12; wheel.frustumCulled = false; scene.add(wheel);

  // fountain jet
  const jg = new THREE.CylinderGeometry(0.25, 1.6, 1, 10, 1, true); jg.translate(0, 0.5, 0);
  jet = new THREE.Mesh(jg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }));
  jet.position.set(bf.x, 6, -bf.y); scene.add(jet);
}
function setBeam(l) {
  if (!l.beam) return;
  const u = l.beam.material.uniforms;
  if (l.found) { u.uC.value.set(0.3, 0.85, 0.75); u.uA.value = 0.3; l.beam.scale.set(0.5, 260, 0.5); }
  else { u.uC.value.set(1, 0.78, 0.3); u.uA.value = 1; l.beam.scale.set(1, 520, 1); }
}

// ───────────────────────────── time of day ─────────────────────────────
const sunDir = (az, el) => { const a = az * Math.PI / 180, e = el * Math.PI / 180; return [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)]; };
const TOD = [
  { name: 'Day', sun: sunDir(150, 50), sunCol: [1.0, 0.95, 0.86], amb: [0.60, 0.66, 0.76], top: [0.17, 0.42, 0.84], hor: [0.70, 0.83, 0.95], night: 0, fog: 0.00007 },
  { name: 'Golden hour', sun: sunDir(258, 7), sunCol: [1.0, 0.60, 0.30], amb: [0.52, 0.44, 0.50], top: [0.15, 0.23, 0.50], hor: [0.97, 0.64, 0.40], night: 0.32, fog: 0.00011 },
  { name: 'Night', sun: sunDir(125, 42), sunCol: [0.22, 0.28, 0.44], amb: [0.11, 0.13, 0.21], top: [0.012, 0.02, 0.05], hor: [0.075, 0.09, 0.16], night: 1, fog: 0.00008 },
];
let todIdx = 0;
const tod = JSON.parse(JSON.stringify(TOD[0]));
function applyTod(k) {
  const t = TOD[todIdx];
  for (const key of ['sun', 'sunCol', 'amb', 'top', 'hor']) for (let i = 0; i < 3; i++) tod[key][i] += (t[key][i] - tod[key][i]) * k;
  tod.night += (t.night - tod.night) * k; tod.fog += (t.fog - tod.fog) * k;
  U.uSun.value.set(...tod.sun).normalize(); U.uSunCol.value.set(...tod.sunCol); U.uAmbCol.value.set(...tod.amb);
  U.uSkyTop.value.set(...tod.top); U.uSkyHor.value.set(...tod.hor); U.uNight.value = tod.night; U.uFog.value = tod.fog;
}
applyTod(1);

// ───────────────────────────── player ─────────────────────────────
const player = { x: 0, y: 0, alt: 260, yaw: 0, pitch: -0.2, vx: 0, vy: 0, vz: 0, mode: 'fly', flySpeed: 55, onGround: false };
const keys = Object.create(null);
const touch = { mx: 0, my: 0, up: false, down: false, boost: false };
let started = false, mapOpen = false, labelsOn = true;
const EYE = 1.72;

function placeAt(x, y, alt, lookX, lookY, lookH = 0) {
  player.x = clamp(x, BX0 - 800, BX1 + 800); player.y = clamp(y, BY0 - 800, BY1 + 800); player.alt = alt;
  player.vx = player.vy = player.vz = 0;
  if (lookX !== undefined) {
    const dx = lookX - player.x, dy = lookY - player.y;
    player.yaw = Math.atan2(-dx, dy);
    player.pitch = clamp(Math.atan2(lookH - alt, Math.hypot(dx, dy)), -1.3, 1.3);
  }
}
function tryMove(dx, dy, feet, head) {
  const r = 0.7;
  const free = (x, y) => !blockedAt(x + r, y, feet, head) && !blockedAt(x - r, y, feet, head) && !blockedAt(x, y + r, feet, head) && !blockedAt(x, y - r, feet, head);
  if (free(player.x + dx, player.y + dy)) { player.x += dx; player.y += dy; return; }
  if (free(player.x + dx, player.y)) { player.x += dx; player.vz *= 0.5; return; }
  if (free(player.x, player.y + dy)) { player.y += dy; player.vx *= 0.5; return; }
  player.vx = player.vz = 0;
}
function updatePlayer(dt) {
  let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - touch.my;
  let s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + touch.mx;
  const il = Math.hypot(f, s); if (il > 1) { f /= il; s /= il; }
  const boost = keys.ShiftLeft || keys.ShiftRight || touch.boost;
  const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  // forward in map coords = (-sin yaw, cos yaw); right = (cos yaw, sin yaw)
  if (player.mode === 'fly') {
    const sp = player.flySpeed * (boost ? 4 : 1), cp = Math.cos(player.pitch), spt = Math.sin(player.pitch);
    const upIn = (keys.Space || keys.KeyE || touch.up ? 1 : 0) - (keys.KeyQ || keys.KeyC || touch.down ? 1 : 0);
    const tx = (-sy * cp * f + cy * s) * sp, ty = (cy * cp * f + sy * s) * sp, tz = (spt * f + upIn * 0.8) * sp;
    const k = 1 - Math.exp(-dt * 5);
    player.vx += (tx - player.vx) * k; player.vz += (ty - player.vz) * k; player.vy += (tz - player.vy) * k;
    tryMove(player.vx * dt, player.vz * dt, player.alt - 1.5, player.alt + 1);
    let na = player.alt + player.vy * dt;
    const fl = floorAt(player.x, player.y, player.alt - 1.2) + 2;
    if (na < fl) { na = fl; if (player.vy < 0) player.vy = 0; }
    player.alt = Math.min(na, 3000);
  } else {
    const sp = boost ? 15 : 6.5;
    const tx = (-sy * f + cy * s) * sp, ty = (cy * f + sy * s) * sp;
    const k = 1 - Math.exp(-dt * (player.onGround ? 12 : 3));
    player.vx += (tx - player.vx) * k; player.vz += (ty - player.vz) * k;
    const feet = player.alt - EYE;
    tryMove(player.vx * dt, player.vz * dt, feet, feet + 1.8);
    player.vy -= 26 * dt;
    if ((keys.Space || touch.up) && player.onGround) { player.vy = 8.5; player.onGround = false; }
    let nf = feet + player.vy * dt;
    const fl = floorAt(player.x, player.y, Math.max(feet, nf));
    if (nf <= fl) { nf = fl; player.vy = 0; player.onGround = true; } else player.onGround = false;
    player.alt = nf + EYE;
  }
  player.x = clamp(player.x, BX0 - 2500, BX1 + 2500); player.y = clamp(player.y, BY0 - 2500, BY1 + 2500);
  camera.position.set(player.x, player.alt, -player.y);
  camera.rotation.set(player.pitch, player.yaw, 0);
}
function setMode(m) {
  player.mode = m; player.onGround = false;
  if (m === 'fly') { player.vy = 6; }
  refreshKeys();
}
function refreshKeys() {
  if (shooter.on) {
    $('modeLine').innerHTML = 'Mode: <i>Shooter</i>';
    $('keyLines').innerHTML = '<kbd>Click</kbd> fire · <kbd>R</kbd> reload · <kbd>WASD</kbd> move · <kbd>Shift</kbd> sprint<br><kbd>Space</kbd> jump · <kbd>G</kbd> quit shooter · <kbd>T</kbd> time · <kbd>H</kbd> help';
    return;
  }
  const fly = player.mode === 'fly';
  $('modeLine').innerHTML = `Mode: <i>${fly ? 'Flying' : 'On foot'}</i>`;
  $('keyLines').innerHTML = fly
    ? '<kbd>WASD</kbd> fly · <kbd>Space</kbd>/<kbd>Q</kbd> up/down · <kbd>Shift</kbd> boost<br><kbd>F</kbd> drop in & walk · <kbd>G</kbd> shooter · <kbd>M</kbd> map · <kbd>T</kbd> time'
    : '<kbd>WASD</kbd> walk · <kbd>Space</kbd> jump · <kbd>Shift</kbd> sprint<br><kbd>F</kbd> take off · <kbd>G</kbd> shooter · <kbd>M</kbd> map · <kbd>T</kbd> time';
  const tb = document.querySelector('#tbtns [data-k=mode]'); if (tb) tb.textContent = fly ? 'Walk' : 'Fly';
}

// ───────────────────────────── HUD ─────────────────────────────
const HOODS = [
  ['The Loop', 41.8805, -87.6300], ['The Loop', 41.8770, -87.6330], ['River North', 41.8925, -87.6330], ['Streeterville', 41.8935, -87.6190],
  ['Magnificent Mile', 41.8950, -87.6243], ['Gold Coast', 41.9035, -87.6275], ['West Loop', 41.8825, -87.6480], ['Fulton Market', 41.8868, -87.6520],
  ['Greektown', 41.8785, -87.6470], ['South Loop', 41.8640, -87.6270], ['Printers Row', 41.8732, -87.6292], ['Museum Campus', 41.8655, -87.6130],
  ['Grant Park', 41.8745, -87.6200], ['Millennium Park', 41.8826, -87.6226], ['Lakeshore East', 41.8862, -87.6172], ['Navy Pier', 41.8917, -87.6040],
  ['Near North Side', 41.9005, -87.6400], ['Goose Island', 41.9030, -87.6560], ['River West', 41.8935, -87.6510], ['University Village', 41.8650, -87.6500],
  ['Near West Side', 41.8720, -87.6560], ['Northerly Island', 41.8585, -87.6090], ['Old Town', 41.9045, -87.6370], ['Monroe Harbor', 41.8790, -87.6130],
  ['Lake Michigan', 41.8800, -87.6000], ['Lake Michigan', 41.9000, -87.6080], ['Lake Michigan', 41.8600, -87.5990], ['Prairie District', 41.8570, -87.6220],
  ['Chinatown', 41.8540, -87.6330], ['Pilsen', 41.8560, -87.6550],
].map(([n, lat, lon]) => [n, ...ll(lat, lon)]);
const KIND_NAMES = ['Building', 'House', 'Residential building', 'Office building', 'Shops', 'Garage / utility building', 'Civic building', 'Hotel', 'Canopy'];

const labelBox = $('labels'), labelPool = [];
for (let i = 0; i < 20; i++) { const d = document.createElement('div'); d.className = 'lab'; labelBox.appendChild(d); labelPool.push(d); }
const labelCands = [];
function buildLabels() {
  const seen = new Set();
  for (const l of LANDMARKS) { labelCands.push({ name: l.name, x: l.x, y: l.y, h: l.h, lm: l }); seen.add(l.name); }
  const lmNear = (x, y) => LANDMARKS.some((l) => Math.hypot(l.x - x, l.y - y) < 70);
  const sorted = CITY.labels.map((a) => ({ name: CITY.names[a[0]], x: a[1] * 0.1, y: a[2] * 0.1, h: a[3] * 0.1, lm: null })).sort((a, b) => b.h - a.h);
  for (const c of sorted) { if (seen.has(c.name) || lmNear(c.x, c.y)) continue; seen.add(c.name); labelCands.push(c); }
}
const tmpV = new THREE.Vector3();
function updateLabels() {
  const W = window.innerWidth, H = window.innerHeight, walk = player.mode === 'walk';
  const picks = [];
  if (labelsOn) for (const c of labelCands) {
    const d = Math.hypot(c.x - player.x, c.y - player.y, c.h - player.alt);
    const range = c.lm ? 3200 : (walk ? 140 + c.h * 3.5 : 260 + c.h * 9);
    if (d > range) continue;
    tmpV.set(c.x, c.h + 6, -c.y).project(camera);
    if (tmpV.z > 1 || tmpV.x < -1.05 || tmpV.x > 1.05 || tmpV.y < -1.05 || tmpV.y > 1.05) continue;
    picks.push({ c, d, sx: (tmpV.x * 0.5 + 0.5) * W, sy: (-tmpV.y * 0.5 + 0.5) * H, score: (c.lm ? 4 : 1) * (c.h + 40) / (d + 120) });
  }
  picks.sort((a, b) => b.score - a.score);
  const placed = []; let k = 0;
  for (const p of picks) {
    if (k >= labelPool.length) break;
    const w = p.c.name.length * 7.2 + 60, x0 = p.sx - w / 2, y0 = p.sy - 40;
    let hit = false;
    for (const q of placed) if (x0 < q[0] + q[2] && x0 + w > q[0] && y0 < q[1] + 26 && y0 + 26 > q[1]) { hit = true; break; }
    if (hit) continue;
    placed.push([x0, y0, w]);
    const el = labelPool[k++];
    const txt = p.c.name + '|' + (p.d > 999 ? (p.d / 1000).toFixed(1) + ' km' : Math.round(p.d / 10) * 10 + ' m');
    if (el._t !== txt) { el._t = txt; el.innerHTML = ''; el.append(p.c.name); const sm = document.createElement('small'); sm.textContent = txt.split('|')[1]; el.append(sm); }
    const cls = 'lab' + (p.c.lm ? (p.c.lm.found ? ' lm done' : ' lm') : '');
    if (el.className !== cls) el.className = cls;
    el.style.display = 'block';
    el.style.transform = `translate(${Math.round(p.sx)}px,${Math.round(p.sy - 38)}px) translate(-50%,-100%)`;
  }
  for (; k < labelPool.length; k++) if (labelPool[k].style.display !== 'none') labelPool[k].style.display = 'none';
}

function updateTarget() {
  const el = $('target');
  const dx = -Math.sin(player.yaw) * Math.cos(player.pitch), dy = Math.cos(player.yaw) * Math.cos(player.pitch), dz = Math.sin(player.pitch);
  let hit = null, dist = 0;
  for (let t = 3; t < 1600; t += t < 200 ? 2 : 5) {
    const h = player.alt + dz * t; if (h < 0) break;
    const f = blockedAt(player.x + dx * t, player.y + dy * t, h - 0.6, h);
    if (f) { hit = f; dist = t; break; }
  }
  if (!hit) { el.classList.remove('on'); return; }
  const name = hit.ni >= 0 ? CITY.names[hit.ni] : KIND_NAMES[hit.kind] || 'Building';
  const txt = `${name}|${Math.round(hit.h)} m tall · ${Math.round(dist)} m away`;
  if (el._t !== txt) { el._t = txt; el.innerHTML = ''; el.append(name + ' '); const s = document.createElement('span'); s.textContent = '· ' + txt.split('|')[1]; el.append(s); }
  el.classList.add('on');
}

function updateLocation() {
  let best = null, bd = 1e9;
  for (const h of HOODS) { const d = Math.hypot(h[1] - player.x, h[2] - player.y); if (d < bd) { bd = d; best = h[0]; } }
  $('hood').textContent = best;
  let street = null, sd = 40;
  for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
    const cell = gridGet(rGrid, player.x + ox * CELL, player.y + oy * CELL); if (!cell) continue;
    for (const s of cell) { if (s.ni < 0) continue; const d = segDist(s, player.x, player.y) - s.hw; if (d < sd) { sd = d; street = CITY.names[s.ni]; } }
  }
  const under = blockedAt(player.x, player.y, -1, 5000);
  let txt = street || (best === 'Lake Michigan' ? 'Over the water' : 'Chicago');
  if (player.mode === 'walk' && player.onGround && player.alt - EYE > 3) {
    const roof = blockedAt(player.x, player.y, -1, player.alt);
    txt = 'Rooftop' + (roof && roof.ni >= 0 ? ' · ' + CITY.names[roof.ni] : '');
  } else if (under && under.ni >= 0 && player.mode === 'fly' && !street) txt = 'Above ' + CITY.names[under.ni];
  $('street').textContent = txt;
  $('alt').textContent = Math.round(player.mode === 'walk' ? player.alt - EYE : player.alt);
  $('spd').textContent = Math.round(Math.hypot(player.vx, player.vy, player.vz) * 3.6);
}

const compassCv = $('compassCv'), cctx = compassCv.getContext('2d');
function drawCompass() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2), w = compassCv.clientWidth, h = compassCv.clientHeight;
  if (compassCv.width !== Math.round(w * dpr)) { compassCv.width = Math.round(w * dpr); compassCv.height = Math.round(h * dpr); }
  cctx.setTransform(dpr, 0, 0, dpr, 0, 0); cctx.clearRect(0, 0, w, h);
  const head = ((-player.yaw * 180 / Math.PI) % 360 + 360) % 360, ppd = w / 150;
  cctx.textAlign = 'center'; cctx.textBaseline = 'middle';
  const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  for (let d = 0; d < 360; d += 15) {
    let off = d - head; if (off > 180) off -= 360; if (off < -180) off += 360;
    const x = w / 2 + off * ppd; if (x < -20 || x > w + 20) continue;
    if (names[d]) { cctx.fillStyle = d === 0 ? '#ffc94d' : d % 90 === 0 ? '#fff' : '#a9b4c2'; cctx.font = `${d % 90 === 0 ? 700 : 500} ${d % 90 === 0 ? 14 : 11}px system-ui, sans-serif`; cctx.fillText(names[d], x, h / 2 + 1); }
    else { cctx.fillStyle = 'rgba(255,255,255,.35)'; cctx.fillRect(x - 0.5, h / 2 - 4, 1, 8); }
  }
  cctx.fillStyle = '#ffc94d'; cctx.beginPath(); cctx.moveTo(w / 2 - 5, 0); cctx.lineTo(w / 2 + 5, 0); cctx.lineTo(w / 2, 6); cctx.fill();
}

const miniCv = $('miniCv'), nctx = miniCv.getContext('2d');
function drawMini() {
  const S = miniCv.width, c = S / 2, zoom = 1.05;
  nctx.setTransform(1, 0, 0, 1, 0, 0); nctx.fillStyle = '#39424d'; nctx.fillRect(0, 0, S, S);
  nctx.translate(c, c); nctx.rotate(player.yaw); nctx.scale(zoom, zoom); nctx.translate(-mx(player.x), -my(player.y));
  {
    // only blit the part of the map that can be visible
    const rad = c / zoom * 1.45, px = mx(player.x), py = my(player.y);
    const sx0 = Math.max(0, Math.floor(px - rad)), sy0 = Math.max(0, Math.floor(py - rad));
    const sx1 = Math.min(mapCv.width, Math.ceil(px + rad)), sy1 = Math.min(mapCv.height, Math.ceil(py + rad));
    if (sx1 > sx0 && sy1 > sy0) nctx.drawImage(mapCv, sx0, sy0, sx1 - sx0, sy1 - sy0, sx0, sy0, sx1 - sx0, sy1 - sy0);
  }
  let near = null, nd = 1e9;
  for (const l of LANDMARKS) {
    nctx.fillStyle = l.found ? '#58d6c0' : '#ffc94d'; nctx.strokeStyle = 'rgba(0,0,0,.6)'; nctx.lineWidth = 2;
    nctx.beginPath(); nctx.arc(mx(l.x), my(l.y), 7, 0, 6.3); nctx.fill(); nctx.stroke();
    if (!l.found) { const d = Math.hypot(l.x - player.x, l.y - player.y); if (d < nd) { nd = d; near = l; } }
  }
  if (shooter.on) { nctx.fillStyle = '#ff4d3d'; for (const b of shooter.bots) if (!(b.dead > 0)) { nctx.beginPath(); nctx.arc(mx(b.x), my(b.y), 6, 0, 6.3); nctx.fill(); } }
  nctx.setTransform(1, 0, 0, 1, 0, 0);
  // pointer to the nearest undiscovered landmark when it is off the minimap
  if (near && nd * MAP_S * zoom > c - 14) {
    const ang = Math.atan2(near.x - player.x, near.y - player.y) + player.yaw;
    nctx.save(); nctx.translate(c + Math.sin(ang) * (c - 16), c - Math.cos(ang) * (c - 16)); nctx.rotate(ang);
    nctx.fillStyle = '#ffc94d'; nctx.beginPath(); nctx.moveTo(0, -11); nctx.lineTo(9, 8); nctx.lineTo(-9, 8); nctx.fill(); nctx.restore();
  }
  nctx.fillStyle = '#fff'; nctx.strokeStyle = '#10151d'; nctx.lineWidth = 3;
  nctx.beginPath(); nctx.moveTo(c, c - 15); nctx.lineTo(c + 10, c + 11); nctx.lineTo(c, c + 5); nctx.lineTo(c - 10, c + 11); nctx.closePath(); nctx.stroke(); nctx.fill();
  // north marker
  const na = player.yaw;
  nctx.fillStyle = '#ff6b5e'; nctx.font = '700 22px system-ui, sans-serif'; nctx.textAlign = 'center'; nctx.textBaseline = 'middle';
  nctx.fillText('N', c - Math.sin(-na) * (c - 20) * 1, c - Math.cos(na) * (c - 20));
  const left = LANDMARKS.filter((l) => !l.found).length;
  $('questN').textContent = `${LANDMARKS.length - left} / ${LANDMARKS.length}`;
  $('questNext').textContent = near ? `Nearest: ${near.name} · ${nd > 999 ? (nd / 1000).toFixed(1) + ' km' : Math.round(nd / 10) * 10 + ' m'}` : 'You found them all!';
}

let toastTimer = 0;
function toast(kicker, title, body, ms = 7000) {
  const t = $('toast'); t.querySelector('.k').textContent = kicker; t.querySelector('.h').textContent = title; t.querySelector('.f').textContent = body;
  t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), ms);
}
function checkDiscoveries() {
  for (const l of LANDMARKS) {
    if (l.found) continue;
    if (Math.hypot(l.x - player.x, l.y - player.y) < 130 && player.alt < l.h + 260) {
      l.found = true; setBeam(l); saveFound(); renderLmList();
      const n = LANDMARKS.filter((q) => q.found).length;
      toast(`Landmark discovered · ${n} of ${LANDMARKS.length}`, l.name, l.fact);
      if (n === LANDMARKS.length) setTimeout(() => toast('Explorer complete', 'You found every landmark!', 'All of downtown Chicago is yours. Try it again at night (press T).', 10000), 7500);
    }
  }
}

// ───────────────────────────── full map / fast travel ─────────────────────────────
const bigCv = $('bigCv'), bctx = bigCv.getContext('2d');
function renderLmList() {
  const box = $('lmlist'); box.innerHTML = '';
  for (const l of LANDMARKS) {
    const b = document.createElement('button'); if (l.found) b.className = 'done';
    const dot = document.createElement('span'); dot.className = 'dot'; b.append(dot, l.found ? l.name : l.name);
    b.onclick = () => { travelTo(l); };
    box.appendChild(b);
  }
}
function travelTo(l) {
  const a = 2.2, d = 300 + l.h * 0.9;
  placeAt(l.x + Math.sin(a) * d, l.y + Math.cos(a) * d, Math.max(90, l.h * 0.75 + 60), l.x, l.y, l.h * 0.55);
  if (player.mode !== 'fly') setMode('fly');
  toggleMap(false);
}
function drawBig() {
  bigCv.width = mapCv.width; bigCv.height = mapCv.height;
  bctx.drawImage(mapCv, 0, 0);
  for (const l of LANDMARKS) {
    bctx.fillStyle = l.found ? '#58d6c0' : '#ffc94d'; bctx.strokeStyle = 'rgba(0,0,0,.7)'; bctx.lineWidth = 3;
    bctx.beginPath(); bctx.arc(mx(l.x), my(l.y), 11, 0, 6.3); bctx.fill(); bctx.stroke();
  }
  bctx.save(); bctx.translate(mx(player.x), my(player.y)); bctx.rotate(-player.yaw);
  bctx.fillStyle = '#fff'; bctx.strokeStyle = '#e5484d'; bctx.lineWidth = 6;
  bctx.beginPath(); bctx.moveTo(0, -30); bctx.lineTo(20, 22); bctx.lineTo(0, 10); bctx.lineTo(-20, 22); bctx.closePath(); bctx.stroke(); bctx.fill(); bctx.restore();
}
function toggleMap(on) {
  mapOpen = on === undefined ? !mapOpen : on;
  $('bigmap').classList.toggle('on', mapOpen);
  if (mapOpen) { if (document.pointerLockElement) document.exitPointerLock(); drawBig(); }
}
bigCv.addEventListener('click', (e) => {
  const r = bigCv.getBoundingClientRect();
  const x = BX0 + (e.clientX - r.left) / r.width * (BX1 - BX0), y = BY1 - (e.clientY - r.top) / r.height * (BY1 - BY0);
  const top = floorAt(x, y, 1e6);
  if (player.mode === 'fly') placeAt(x, y, Math.max(player.alt, top + 40));
  else placeAt(x, y, top + EYE + 0.5);
  toggleMap(false);
});
$('closemap').onclick = () => toggleMap(false);
$('mini').addEventListener('click', () => { if (!shooter.on) toggleMap(true); });

// ───────────────────────────── input ─────────────────────────────
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');

function cycleTime() { todIdx = (todIdx + 1) % TOD.length; $('clock').textContent = TOD[todIdx].name; }
function showHelp(on) {
  $('start').classList.toggle('hidden', !on);
  if (on) { $('loading').textContent = started ? 'Resume' : 'Start exploring'; if (document.pointerLockElement) document.exitPointerLock(); }
}
window.addEventListener('keydown', (e) => {
  if (e.repeat) { if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault(); return; }
  keys[e.code] = true;
  if (!started) { if (e.code === 'Enter' && !$('go').disabled) begin(); return; }
  switch (e.code) {
    case 'KeyF': if (!shooter.on) setMode(player.mode === 'fly' ? 'walk' : 'fly'); break;
    case 'KeyM': if (!shooter.on || mapOpen) toggleMap(); break;
    case 'KeyG': if ($('start').classList.contains('hidden') && !mapOpen) toggleShooter(); break;
    case 'KeyR': reloadGun(); break;
    case 'KeyT': cycleTime(); break;
    case 'KeyL': labelsOn = !labelsOn; break;
    case 'KeyH': showHelp($('start').classList.contains('hidden')); break;
    case 'Escape': if (mapOpen) toggleMap(false); break;
    case 'Enter': if (!$('start').classList.contains('hidden')) begin(); else if (shooter.on && shooter.dead) startShooter(false); break;
  }
  if (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Tab') e.preventDefault();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; shooter.firing = false; });

let dragging = false;
const look = (dx, dy, k) => { player.yaw -= dx * k; player.pitch = clamp(player.pitch - dy * k, -1.5, 1.5); };
canvas.addEventListener('mousedown', (e) => {
  if (!started || mapOpen) return;
  dragging = true;
  if (shooter.on && e.button === 0) { audioInit(); if (shooter.dead) { if (shooter.t - shooter.deadT > 1.2) startShooter(false); } else shooter.firing = true; }
  if (!isTouch && !document.pointerLockElement && canvas.requestPointerLock) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* drag-look fallback */ } }
});
window.addEventListener('mouseup', () => { dragging = false; shooter.firing = false; });
window.addEventListener('mousemove', (e) => {
  if (!started || mapOpen) return;
  if (document.pointerLockElement === canvas) look(e.movementX, e.movementY, 0.0022);
  else if (dragging) look(-e.movementX, -e.movementY, 0.004);
});
window.addEventListener('wheel', (e) => {
  if (!started || mapOpen) return;
  player.flySpeed = clamp(player.flySpeed * (e.deltaY > 0 ? 0.87 : 1.15), 8, 400);
}, { passive: true });

// touch: left stick moves, dragging elsewhere looks
const stick = $('stick'), knob = $('knob');
let stickId = null, lookId = null, lx = 0, ly = 0, scx = 0, scy = 0;
const setKnob = (x, y) => { knob.style.transform = `translate(${x * 40}px,${y * 40}px)`; touch.mx = x; touch.my = y; };
window.addEventListener('touchstart', (e) => {
  if (!started || mapOpen || !$('start').classList.contains('hidden')) return;
  for (const t of e.changedTouches) {
    if (t.target.closest && t.target.closest('#tbtns, #mini')) continue;
    const r = stick.getBoundingClientRect();
    if (stickId === null && t.clientX < r.right + 50 && t.clientY > r.top - 50) { stickId = t.identifier; scx = r.left + r.width / 2; scy = r.top + r.height / 2; }
    else if (lookId === null) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; }
  }
}, { passive: true });
window.addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === stickId) { let x = (t.clientX - scx) / 50, y = (t.clientY - scy) / 50; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } setKnob(x, y); }
    else if (t.identifier === lookId) { look(t.clientX - lx, t.clientY - ly, 0.005); lx = t.clientX; ly = t.clientY; }
  }
}, { passive: true });
const touchEnd = (e) => { for (const t of e.changedTouches) { if (t.identifier === stickId) { stickId = null; setKnob(0, 0); } if (t.identifier === lookId) lookId = null; } };
window.addEventListener('touchend', touchEnd); window.addEventListener('touchcancel', touchEnd);
for (const b of document.querySelectorAll('#tbtns button')) {
  const k = b.dataset.k;
  const down = (e) => { e.preventDefault(); if (k === 'up' || k === 'down') touch[k] = true; else if (k === 'boost') { touch.boost = !touch.boost; b.style.background = touch.boost ? 'rgba(255,201,77,.6)' : ''; } else if (k === 'mode') { if (!shooter.on) setMode(player.mode === 'fly' ? 'walk' : 'fly'); } else if (k === 'fire') { audioInit(); shooter.firing = true; } else if (k === 'reload') reloadGun(); else if (k === 'fps') { if (shooter.on && shooter.dead) startShooter(false); else toggleShooter(); } else if (k === 'map') { if (!shooter.on) toggleMap(); } else if (k === 'time') cycleTime(); };
  const upf = (e) => { e.preventDefault(); if (k === 'up' || k === 'down') touch[k] = false; if (k === 'fire') shooter.firing = false; };
  b.addEventListener('touchstart', down, { passive: false }); b.addEventListener('touchend', upf, { passive: false });
  b.addEventListener('mousedown', down); b.addEventListener('mouseup', upf);
}

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
});

function begin() {
  if (!started) {
    started = true;
    const [sx, sy] = ll(41.8690, -87.6130);
    placeAt(sx, sy, 230, ...ll(41.8820, -87.6310), 120);
    $('hud').classList.remove('hidden'); refreshKeys();
    setTimeout(() => !shooter.on && toast('Welcome to Chicago', 'Find the golden beacons', 'Each beam of light marks a landmark. Fly close to discover it — the arrow on the minimap points to the nearest one.', 8000), 600);
  }
  showHelp(false);
  if (!isTouch && canvas.requestPointerLock) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } }
}
$('go').addEventListener('click', begin);
$('goFps').addEventListener('click', () => { const fresh = !started; begin(); startShooter(fresh); });

// ───────────────────────────── shooter mode ─────────────────────────────
// A simple wave-based first-person shooter against bots, played on the streets of the map.
const MAX_BOTS = 28, MAG = 30;
const shooter = { on: false, dead: false, deadT: 0, firing: false, hp: 100, ammo: MAG, reload: 0, cool: 0, wave: 0, score: 0, kills: 0,
  waveT: 0, pending: false, lastHurt: -99, recoil: 0, vig: 0, t: 0, bots: [], best: 0, savedLabels: true, msgT: 0 };
try { shooter.best = +localStorage.getItem('chicago3d.best.v1') || 0; } catch (e) { /* ignore */ }

const botMat = shader(/* glsl */`
  attribute vec3 aCol; varying vec3 vCol; varying vec3 vN; varying vec3 vW;
  void main(){
    vec4 p = instanceMatrix * vec4(position, 1.0); vN = normalize(mat3(instanceMatrix) * normal);
    vCol = aCol * instanceColor; vW = p.xyz; gl_Position = projectionMatrix * viewMatrix * p;
  }
`, /* glsl */`
  varying vec3 vCol; varying vec3 vN; varying vec3 vW;
  void main(){ vec3 c = vCol * (lightOf(normalize(vN)) + 0.32); gl_FragColor = vec4(fogged(c, vW), 1.0); }
`);
let botMesh, gun, flash, tracerMesh;
const TR_N = 24, trPos = new Float32Array(TR_N * 6), trCol = new Float32Array(TR_N * 6), trLife = new Float32Array(TR_N), trBase = new Float32Array(TR_N * 3);
let trNext = 0;
function tracer(ax, ay, az, bx, by, bz, r, g, b) {
  const i = trNext++ % TR_N;
  trPos.set([ax, az, -ay, bx, bz, -by], i * 6); trBase.set([r, g, b], i * 3); trLife[i] = 1;
}
function initShooter() {
  // bot model: local +x is forward, feet at y = 0
  const lb = new LitBuilder(), red = [0.82, 0.2, 0.14], dark = [0.16, 0.17, 0.2], pale = [0.78, 0.8, 0.84];
  lb.box(0, 0.43, 0.15, 0.24, 0.86, 0.22, 0, dark); lb.box(0, 0.43, -0.15, 0.24, 0.86, 0.22, 0, dark);
  lb.box(0, 1.2, 0, 0.34, 0.68, 0.6, 0, red);
  lb.box(0, 1.2, 0.37, 0.2, 0.6, 0.14, 0, dark); lb.box(0.14, 1.28, -0.37, 0.48, 0.16, 0.14, 0, dark);
  lb.box(0, 1.71, 0, 0.3, 0.3, 0.3, 0, pale); lb.box(0.14, 1.73, 0, 0.06, 0.09, 0.26, 0, [1.0, 0.85, 0.2]);
  lb.box(0.5, 1.28, -0.37, 0.5, 0.09, 0.09, 0, [0.08, 0.08, 0.09]);
  botMesh = new THREE.InstancedMesh(lb.geometry(), botMat, MAX_BOTS);
  const one = new THREE.Color(1, 1, 1); for (let i = 0; i < MAX_BOTS; i++) botMesh.setColorAt(i, one);
  botMesh.count = 0; botMesh.frustumCulled = false; scene.add(botMesh);

  // first-person gun, attached to the camera
  scene.add(camera);
  const gb = new LitBuilder(), gd = [0.13, 0.14, 0.16], gm = [0.32, 0.33, 0.36];
  gb.box(0, 0, -0.05, 0.055, 0.08, 0.34, 0, gd); gb.box(0, 0.012, -0.28, 0.03, 0.03, 0.14, 0, gm);
  gb.box(0, -0.09, 0.07, 0.045, 0.13, 0.06, 0, gd); gb.box(0, -0.085, -0.08, 0.04, 0.11, 0.07, 0, gm); gb.box(0, 0.055, -0.02, 0.02, 0.03, 0.1, 0, gm);
  gun = new THREE.Mesh(gb.geometry(), litMat); gun.frustumCulled = false; gun.visible = false; gun.scale.setScalar(0.62); camera.add(gun);
  flash = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  flash.position.set(0, 0.012, -0.37); flash.visible = false; gun.add(flash);

  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.BufferAttribute(trPos, 3)); tg.setAttribute('color', new THREE.BufferAttribute(trCol, 3));
  tracerMesh = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  tracerMesh.frustumCulled = false; scene.add(tracerMesh);
}

// tiny synthesised sound effects (no files needed)
let actx = null, noiseBuf = null;
function audioInit() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    noiseBuf = actx.createBuffer(1, Math.floor(actx.sampleRate * 0.3), actx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { actx = null; }
}
function sfxShot(vol, rate) {
  if (!actx) return; const t = actx.currentTime, s = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
  s.buffer = noiseBuf; s.playbackRate.value = rate; f.type = 'lowpass'; f.frequency.setValueAtTime(4200, t); f.frequency.exponentialRampToValueAtTime(260, t + 0.13);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
  s.connect(f); f.connect(g); g.connect(actx.destination); s.start(t); s.stop(t + 0.2);
}
function sfxTone(freq, dur, vol, type = 'square', to = freq) {
  if (!actx) return; const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
}

// distance along a ray until it hits a building or the ground (map coords + height)
function rayWall(ox, oy, oz, dx, dy, dz, max) {
  for (let t = 0.5; t < max; t += t < 80 ? 0.5 : 2) {
    const h = oz + dz * t; if (h < 0) return t;
    if (blockedAt(ox + dx * t, oy + dy * t, h - 0.6, h)) return t;
  }
  return max;
}
function seesPlayer(x, y) {
  const dx = player.x - x, dy = player.y - y, dz = player.alt - 0.2 - 1.6, d = Math.hypot(dx, dy, dz) || 1;
  return rayWall(x, y, 1.6, dx / d, dy / d, dz / d, d) >= d - 0.6;
}
const clearSpot = (x, y) => !blockedAt(x, y, 0, 2) && !blockedAt(x + 1.1, y, 0, 2) && !blockedAt(x - 1.1, y, 0, 2) && !blockedAt(x, y + 1.1, 0, 2) && !blockedAt(x, y - 1.1, 0, 2);
function findStreet(x, y) {
  for (let r = 0; r < 200; r += 5) for (let k = 0; k < 12; k++) {
    const a = k / 12 * 6.283, px = x + Math.sin(a) * r, py = y + Math.cos(a) * r;
    if (clearSpot(px, py)) return [px, py];
  }
  return [x, y];
}
function spawnSpot() {
  for (let k = 0; k < 80; k++) {
    const a = Math.random() * 6.283, d = 45 + Math.random() * 95, x = player.x + Math.sin(a) * d, y = player.y + Math.cos(a) * d;
    if (!clearSpot(x, y)) continue;
    if (k < 45 && seesPlayer(x, y)) continue;       // prefer spawning out of sight
    return [x, y];
  }
  return null;
}
function fpsMsg(big, small, secs) {
  const el = $('fpsMsg'); el.innerHTML = '';
  if (big) { const b = document.createElement('b'); b.textContent = big; el.append(b); }
  if (small) { const s = document.createElement('span'); s.textContent = small; el.append(s); }
  shooter.msgT = secs || 0; el.classList.toggle('on', !!big);
}
function startWave() {
  const S = shooter; S.wave++;
  const n = Math.min(MAX_BOTS, 2 + S.wave * 2);
  for (let i = 0; i < n; i++) {
    const p = spawnSpot(); if (!p) continue;
    S.bots.push({ x: p[0], y: p[1], yaw: 0, hp: 100, dead: 0, flash: 0, los: false, losT: Math.random() * 0.3, cool: 1 + Math.random(),
      detT: 0, dhx: 0, dhy: 0, strT: 0, str: 1, side: Math.random() < 0.5 ? -1 : 1, speed: Math.min(5.6, 3.5 + S.wave * 0.18) * (0.9 + Math.random() * 0.2) });
  }
  fpsMsg('Wave ' + S.wave, n + ' bots incoming', 2.5);
  sfxTone(440, 0.25, 0.12, 'triangle', 660);
}
function startShooter(atDefault) {
  const S = shooter; audioInit();
  if (atDefault) { const [x, y] = ll(41.8822, -87.6246); player.x = x; player.y = y; player.yaw = 0; }
  const [sx, sy] = findStreet(player.x, player.y);
  player.x = sx; player.y = sy; player.alt = EYE; player.vx = player.vy = player.vz = 0; player.pitch = 0; player.mode = 'walk'; player.onGround = true;
  if (!S.on) { S.savedLabels = labelsOn; labelsOn = false; }
  Object.assign(S, { on: true, dead: false, firing: false, hp: 100, ammo: MAG, reload: 0, cool: 0, wave: 0, score: 0, kills: 0, waveT: 2.5, pending: true, lastHurt: -99, vig: 0 });
  S.bots.length = 0; gun.visible = true; document.body.classList.add('shooter');
  fpsMsg('Shooter mode', isTouch ? 'Hold Fire to shoot. Bots are on their way.' : 'Click to fire · R to reload · G to quit', 2.4);
  refreshKeys();
}
function stopShooter() {
  const S = shooter; S.on = false; S.dead = false; S.firing = false; S.bots.length = 0; botMesh.count = 0; gun.visible = false;
  document.body.classList.remove('shooter'); labelsOn = S.savedLabels; fpsMsg('', '', 0); $('vignette').style.opacity = 0; refreshKeys();
}
function hurtPlayer(d) {
  const S = shooter; if (S.dead) return;
  S.hp -= d; S.lastHurt = S.t; S.vig = 1; sfxTone(150, 0.14, 0.22, 'sawtooth', 70);
  if (S.hp <= 0) {
    S.hp = 0; S.dead = true; S.deadT = S.t; S.firing = false;
    if (S.score > S.best) { S.best = S.score; try { localStorage.setItem('chicago3d.best.v1', String(S.best)); } catch (e) { /* ignore */ } }
    fpsMsg('You were taken down', `Wave ${S.wave} · ${S.kills} bot${S.kills === 1 ? '' : 's'} down · Score ${S.score} · Best ${S.best} — ${isTouch ? 'tap Shoot to play again' : 'press Enter to play again, G to quit'}`, 0);
    sfxTone(300, 0.6, 0.2, 'sawtooth', 60);
  }
}
function playerFire() {
  const S = shooter; S.ammo--; S.cool = 0.105; S.recoil = 1;
  const spread = 0.005 + Math.min(0.03, Math.hypot(player.vx, player.vz) * 0.0016) + (player.onGround ? 0 : 0.02);
  const yaw = player.yaw + (Math.random() - 0.5) * spread * 2, pitch = player.pitch + (Math.random() - 0.5) * spread * 2;
  const dx = -Math.sin(yaw) * Math.cos(pitch), dy = Math.cos(yaw) * Math.cos(pitch), dz = Math.sin(pitch);
  const ox = player.x, oy = player.y, oz = player.alt;
  let tHit = rayWall(ox, oy, oz, dx, dy, dz, 400), target = null, head = false;
  const h2 = dx * dx + dy * dy;
  if (h2 > 1e-6) for (const b of S.bots) {
    if (b.dead > 0) continue;
    const t = ((b.x - ox) * dx + (b.y - oy) * dy) / h2; if (t <= 0 || t >= tHit) continue;
    if (Math.hypot(ox + dx * t - b.x, oy + dy * t - b.y) > 0.52) continue;
    const hh = oz + dz * t; if (hh < -0.1 || hh > 1.95) continue;
    tHit = t; target = b; head = hh > 1.5;
  }
  const cy = Math.cos(player.yaw), sy = Math.sin(player.yaw);
  tracer(ox + dx * 0.9 + cy * 0.2, oy + dy * 0.9 + sy * 0.2, oz + dz * 0.9 - 0.17, ox + dx * tHit, oy + dy * tHit, oz + dz * tHit, 1, 0.85, 0.45);
  sfxShot(0.3, 1);
  if (target) {
    target.hp -= head ? 100 : 34; target.flash = 1;
    $('cross').classList.add('hit'); clearTimeout(playerFire._h); playerFire._h = setTimeout(() => $('cross').classList.remove('hit'), 110);
    if (target.hp <= 0) { target.dead = 0.001; S.kills++; S.score += head ? 150 : 100; sfxTone(620, 0.12, 0.12, 'square', 930); }
    else sfxTone(1100, 0.04, 0.07);
  }
  player.pitch = Math.min(1.5, player.pitch + 0.011); player.yaw += (Math.random() - 0.5) * 0.006;
}
const _bm = new THREE.Matrix4(), _bq = new THREE.Quaternion(), _bf = new THREE.Quaternion(), _bp = new THREE.Vector3(), _b1 = new THREE.Vector3(1, 1, 1);
const _bc = new THREE.Color(), AX_Y = new THREE.Vector3(0, 1, 0), AX_Z = new THREE.Vector3(0, 0, 1);
let hudCache = '';
function updateShooter(dt) {
  const S = shooter; if (!S.on) return;
  S.t += dt;
  if (!S.dead) {
    S.cool -= dt;
    if (S.reload > 0) { S.reload -= dt; if (S.reload <= 0) S.ammo = MAG; }
    else if (S.firing && S.cool <= 0) { if (S.ammo > 0) playerFire(); else reloadGun(); }
    if (S.t - S.lastHurt > 5 && S.hp < 100) S.hp = Math.min(100, S.hp + dt * 6);
  }
  S.recoil = Math.max(0, S.recoil - dt * 9); S.vig = Math.max(0, S.vig - dt * 1.6);

  // bots
  let alive = 0;
  const pspeed = Math.hypot(player.vx, player.vz);
  for (const b of S.bots) {
    if (b.dead > 0) { b.dead += dt; continue; }
    alive++; b.flash = Math.max(0, b.flash - dt * 6);
    let dx = player.x - b.x, dy = player.y - b.y, dist = Math.hypot(dx, dy) || 1;
    if (dist > 260) { const p = spawnSpot(); if (p) { b.x = p[0]; b.y = p[1]; b.los = false; } continue; }
    b.losT -= dt;
    if (b.losT <= 0) {
      b.losT = 0.2 + Math.random() * 0.15; const had = b.los;
      b.los = !S.dead && dist < 140 && seesPlayer(b.x, b.y);
      if (b.los && !had) b.cool = Math.max(b.cool, 0.45 + Math.random() * 0.6);
    }
    let hx = 0, hy = 0;
    if (b.detT > 0) { b.detT -= dt; hx = b.dhx; hy = b.dhy; }
    else if (!b.los || dist > 38) { hx = dx / dist; hy = dy / dist; }
    else if (dist < 11) { hx = -dx / dist; hy = -dy / dist; }
    else {
      b.strT -= dt; if (b.strT <= 0) { b.strT = 1 + Math.random() * 2; b.str = Math.random() < 0.25 ? 0 : Math.random() < 0.5 ? -1 : 1; }
      hx = -dy / dist * b.str; hy = dx / dist * b.str;
    }
    if (hx || hy) {
      const sp = b.speed * dt, free = (ux, uy) => !blockedAt(b.x + ux * sp, b.y + uy * sp, 0, 1.9) && !blockedAt(b.x + ux * 0.8, b.y + uy * 0.8, 0, 1.9);
      if (free(hx, hy)) { b.x += hx * sp; b.y += hy * sp; }
      else for (const a of [0.9, -0.9, 1.7, -1.7, 2.6, -2.6]) {      // slide around the obstacle
        const an = a * b.side, c = Math.cos(an), s = Math.sin(an), ux = hx * c - hy * s, uy = hx * s + hy * c;
        if (free(ux, uy)) { b.x += ux * sp; b.y += uy * sp; b.dhx = ux; b.dhy = uy; b.detT = 0.6 + Math.random() * 0.7; hx = ux; hy = uy; break; }
      }
    }
    // unstick: if a bot has barely moved for a while, send it off in a fresh direction
    b.stT = (b.stT || 0) + dt;
    if (b.stT > 1.5) {
      if ((!b.los || dist > 38) && Math.hypot(b.x - (b.sx || 0), b.y - (b.sy || 0)) < 1.2) { const a = Math.random() * 6.283; b.dhx = Math.cos(a); b.dhy = Math.sin(a); b.detT = 1.2; b.side = -b.side; }
      b.stT = 0; b.sx = b.x; b.sy = b.y;
    }
    b.yaw = b.los ? Math.atan2(dy, dx) : (hx || hy) ? Math.atan2(hy, hx) : b.yaw;
    if (b.los && !S.dead) {
      b.cool -= dt;
      if (b.cool <= 0) {
        b.cool = 0.75 + Math.random() * 0.9;
        const p = clamp(0.72 - dist / 150, 0.1, 0.68) * (pspeed > 9 ? 0.55 : 1) * Math.min(1.25, 0.8 + S.wave * 0.05);
        const hit = Math.random() < p, gx = b.x + dx / dist * 0.7, gy = b.y + dy / dist * 0.7;
        if (hit) tracer(gx, gy, 1.3, player.x, player.y, player.alt - 0.35, 1, 0.3, 0.2);
        else { const o = (Math.random() < 0.5 ? -1 : 1) * (0.7 + Math.random() * 1.5); tracer(gx, gy, 1.3, player.x - dy / dist * o + dx / dist * 12, player.y + dx / dist * o + dy / dist * 12, player.alt - 0.3 + Math.random(), 1, 0.3, 0.2); }
        sfxShot(clamp(0.24 * (1 - dist / 170), 0.03, 0.24), 0.72);
        if (hit) hurtPlayer(Math.min(14, 8 + S.wave * 0.5));
      }
    }
  }
  for (let i = S.bots.length - 1; i >= 0; i--) if (S.bots[i].dead > 1.6) S.bots.splice(i, 1);

  // waves
  if (alive === 0 && !S.dead) {
    if (!S.pending) {
      S.pending = true; S.waveT = 4; S.score += S.wave * 150; S.hp = Math.min(100, S.hp + 35);
      fpsMsg('Wave ' + S.wave + ' cleared', 'Next wave in a moment…', 2.5);
    } else { S.waveT -= dt; if (S.waveT <= 0) { S.pending = false; startWave(); } }
  }
  if (S.msgT > 0) { S.msgT -= dt; if (S.msgT <= 0) fpsMsg('', '', 0); }

  // draw bots, tracers, gun
  let n = 0;
  for (const b of S.bots) {
    _bp.set(b.x, b.dead > 0 ? -Math.max(0, b.dead - 0.9) * 2.6 : 0, -b.y); _bq.setFromAxisAngle(AX_Y, b.yaw);
    if (b.dead > 0) { _bf.setFromAxisAngle(AX_Z, Math.min(1, b.dead / 0.3) * 1.5); _bq.multiply(_bf); }
    botMesh.setMatrixAt(n, _bm.compose(_bp, _bq, _b1));
    const f = 1 + b.flash * 2.2; botMesh.setColorAt(n, _bc.setRGB(f, f, f)); n++;
  }
  botMesh.count = n; botMesh.instanceMatrix.needsUpdate = true; botMesh.instanceColor.needsUpdate = true;
  const rl = S.reload > 0 ? Math.sin((1 - S.reload / 1.4) * Math.PI) : 0, bob = Math.sin(S.t * 9) * Math.min(1, pspeed / 7) * 0.006;
  gun.position.set(0.17, -0.15 - rl * 0.14 + bob, -0.42 + S.recoil * 0.03); gun.rotation.set(S.recoil * 0.05 - rl * 0.9, 0, rl * 0.3);
  flash.visible = S.recoil > 0.55; if (flash.visible) flash.rotation.z = S.t * 37;
  $('vignette').style.opacity = S.dead ? 0.85 : Math.max(S.vig * 0.8, S.hp < 35 ? 0.35 : 0);
  const hud = `${Math.ceil(S.hp)}|${S.reload > 0 ? 'Reloading…' : S.ammo + ' / ' + MAG}|Wave ${Math.max(1, S.wave)} · ${alive} bot${alive === 1 ? '' : 's'} left · Score ${S.score}`;
  if (hud !== hudCache) {
    hudCache = hud; const p = hud.split('|');
    $('hpTxt').textContent = '✚ ' + p[0]; $('ammoTxt').textContent = p[1]; $('fpsInfo').textContent = p[2];
    $('hpFill').style.width = p[0] + '%'; $('hpFill').style.background = S.hp < 35 ? '#ff5a4d' : '#58d6c0';
  }
}
function updateTracers(dt) {
  if (!tracerMesh) return;
  for (let i = 0; i < TR_N; i++) {
    const l = trLife[i] = Math.max(0, trLife[i] - dt * 9);
    for (let k = 0; k < 2; k++) for (let c = 0; c < 3; c++) trCol[i * 6 + k * 3 + c] = trBase[i * 3 + c] * l;
  }
  tracerMesh.geometry.attributes.position.needsUpdate = true; tracerMesh.geometry.attributes.color.needsUpdate = true;
}
function reloadGun() { const S = shooter; if (S.on && !S.dead && S.reload <= 0 && S.ammo < MAG) { S.reload = 1.4; sfxTone(240, 0.08, 0.08, 'square', 180); } }
function toggleShooter() { if (shooter.on && !shooter.dead) stopShooter(); else startShooter(false); }

// ───────────────────────────── boot ─────────────────────────────
function init() {
  buildGround();
  buildBuildings();
  buildTrees();
  buildEl();
  buildProps();
  buildLabels();
  initShooter();
  renderLmList();
  $('go').disabled = false; $('goFps').disabled = false; $('loading').textContent = 'Start exploring';
  if (isTouch) $('helpGrid').innerHTML = '<div>Left stick</div><div>Move</div><div>Drag</div><div>Look around</div><div>▲ ▼</div><div>Fly up / down, or jump on foot</div><div>Walk / Fly</div><div>Drop in anywhere and explore at street level</div><div>Map</div><div>Full map and fast travel</div><div>Shoot</div><div>Shooter mode: fight waves of bots (hold Fire)</div>';
}

let last = performance.now(), slow = 0, tick = 0;
const clock0 = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const time = (now - clock0) / 1000;
  U.uTime.value = time;
  applyTod(1 - Math.exp(-dt * 1.6));
  if (!started) {
    const a = time * 0.045 + 2.4;
    camera.position.set(Math.sin(a) * 2300 + 200, 640, Math.cos(a) * 2300 - 300);
    camera.lookAt(200, 120, -300);
  } else if (!mapOpen && $('start').classList.contains('hidden')) {
    if (!shooter.dead) updatePlayer(dt);
    checkDiscoveries();
    updateShooter(dt);
  }
  sky.position.copy(camera.position);
  updateTracers(dt);
  updateTrains(time);
  if (wheel) wheel.rotation.z = time * 0.12;
  if (jet) { const s = 26 + Math.sin(time * 2.3) * 3 + Math.sin(time * 7.1); jet.scale.set(1, s, 1); jet.material.opacity = 0.55 * (1 - 0.6 * tod.night); }
  renderer.render(scene, camera);
  if (started) {
    camera.updateMatrixWorld();
    updateLabels();
    drawMini(); drawCompass();
    if (tick % 6 === 0) updateTarget();
    if (tick % 10 === 0) updateLocation();
    if (mapOpen && tick % 15 === 0) drawBig();
  }
  tick++;
  // drop resolution if the machine is struggling
  if (dt > 0.045) { if (++slow === 90 && renderer.getPixelRatio() > 1) { renderer.setPixelRatio(1); renderer.setSize(window.innerWidth, window.innerHeight, false); } } else if (slow > 0) slow--;
}

// let the start card paint before the heavy build
requestAnimationFrame(() => setTimeout(() => {
  try { init(); } catch (err) { $('loading').textContent = 'Could not start: ' + err.message; console.error(err); return; }
  window.__chi = { shooter, startShooter, player, placeAt, setMode, LANDMARKS, ll, cycleTime, begin };
  requestAnimationFrame(frame);
}, 30));
