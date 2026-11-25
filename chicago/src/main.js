// Chicago 3D — a self-contained, offline, explorable model of downtown Chicago.
import * as THREE from 'three';
import { createCore } from './metro-core.js';
/* global __METRO_WORKER__ */

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
const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.3, 260000);
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
  uShadowMap: { value: null }, uShadowM: { value: new THREE.Matrix4() }, uShadowTexel: { value: 1 }, uShadowBias: { value: 0.001 }, uShadowOn: { value: 1 },
};
const GLSL_COMMON = /* glsl */`
  uniform vec3 uSun, uSunCol, uAmbCol, uSkyTop, uSkyHor;
  uniform float uNight, uFog, uTime;
  uniform sampler2D uShadowMap; uniform mat4 uShadowM; uniform float uShadowTexel, uShadowBias, uShadowOn;
  float hash21(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
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
  float n2(vec2 p){
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * n2(p); p = p * 2.03 + 17.0; a *= 0.5; } return s; }
  float shadowTap(vec2 uv, float z){ return step(z, texture2D(uShadowMap, uv).r); }
  float shadowPcf(vec2 uv, float z){          // bilinear-filtered comparison for soft edges
    vec2 st = uv * 2048.0 - 0.5, b = floor(st), f = st - b, o = (b + 0.5) / 2048.0; float t = 1.0 / 2048.0;
    return mix(mix(shadowTap(o, z), shadowTap(o + vec2(t, 0.0), z), f.x), mix(shadowTap(o + vec2(0.0, t), z), shadowTap(o + vec2(t, t), z), f.x), f.y);
  }
  float shadowAt(vec3 wp, vec3 n){
    if (uShadowOn < 0.5) return 1.0;
    vec4 sc = uShadowM * vec4(wp + n * uShadowTexel * 1.6 + uSun * uShadowTexel * 0.8, 1.0);
    vec3 p = sc.xyz * 0.5 + 0.5;
    if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
    float z = p.z - uShadowBias, t = 0.8 / 2048.0;
    float s = (shadowPcf(p.xy + vec2(t, t), z) + shadowPcf(p.xy + vec2(-t, t), z) + shadowPcf(p.xy + vec2(t, -t), z) + shadowPcf(p.xy + vec2(-t, -t), z)) * 0.25;
    vec2 e = min(p.xy, 1.0 - p.xy);
    return mix(1.0, s, smoothstep(0.0, 0.06, min(e.x, e.y)));
  }
  // sun + sky light with cast shadows
  vec3 lightSh(vec3 n, vec3 wp){
    float nd = max(dot(n, uSun), 0.0);
    float sh = nd > 0.0 ? shadowAt(wp, n) : 0.0;
    return uSunCol * nd * 0.92 * sh + uAmbCol * (0.45 + 0.2 * n.y);
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
      if (d.y > 0.012) {                       // drifting clouds
        vec2 cp = d.xz / (d.y + 0.09) * 1.05 + vec2(uTime * 0.006, uTime * 0.002);
        float dens = fbm(cp * 1.25);
        float cl = smoothstep(0.50, 0.80, dens) * smoothstep(0.012, 0.16, d.y);
        float lit = smoothstep(0.45, 0.95, fbm(cp * 1.25 + uSun.xz * 0.22));
        vec3 cc = uAmbCol * 0.95 + uSunCol * (0.75 - 0.5 * lit) + uSunCol * pow(s, 6.0) * 0.5;
        c = mix(c, cc, cl * 0.88);
      }
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
    float gr = mix(1.0, 0.86 + 0.28 * (n2(vW.xz * 1.9) * 0.6 + n2(vW.xz * 0.21) * 0.4), exp(-distance(vW, cameraPosition) * 0.006));
    vec3 c = vCol * gr * lightSh(vec3(0.0, 1.0, 0.0), vW);
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
    float fl = floor(vR.z + 0.5);
    if (fl > 0.5 && fl < 2.5) {
      float cl = 1.0 - smoothstep(0.10, 0.10 + fw, abs(abs(vR.x) - 0.22));
      alb = mix(alb, vec3(0.86, 0.70, 0.22), cl * vis);
      if (fl > 1.5) {
        float ln = 1.0 - smoothstep(0.09, 0.09 + fw, abs(abs(vR.x) - 3.4));
        float dash = step(fract(vR.y / 9.0), 0.35);
        alb = mix(alb, vec3(0.85), ln * dash * vis);
      }
    } else if (fl > 2.5 && fl < 3.5) {        // runway: centreline dashes and edge stripes
      float cl = (1.0 - smoothstep(0.5, 0.5 + fw, abs(vR.x))) * step(fract(vR.y / 60.0), 0.5);
      float edge = 1.0 - smoothstep(0.45, 0.45 + fw, abs(abs(vR.x) - 21.0));
      alb = mix(alb, vec3(0.93), max(cl, edge) * vis);
    } else if (fl > 3.5 && fl < 4.5) {        // taxiway: yellow centreline
      alb = mix(alb, vec3(0.86, 0.70, 0.22), (1.0 - smoothstep(0.16, 0.16 + fw, abs(vR.x))) * vis);
    } else if (fl > 4.5 && fl < 5.5) {        // railway: sleepers and two rails on ballast
      alb = mix(alb, vec3(0.30, 0.24, 0.18), step(fract(vR.y / 0.65), 0.35) * step(abs(vR.x), 1.3) * 0.8 * vis);
      alb = mix(alb, vec3(0.45, 0.43, 0.41), (1.0 - smoothstep(0.05, 0.05 + fw, abs(abs(vR.x) - 0.72))) * vis);
    }
    alb *= mix(1.0, 0.9 + 0.2 * (n2(vW.xz * 2.3) * 0.5 + n2(vW.xz * 0.31) * 0.5), exp(-distance(vW, cameraPosition) * 0.006));
    vec3 c = alb * lightSh(vec3(0.0, 1.0, 0.0), vW);
    float lamp = fl < 0.5 ? 0.6 : fl < 2.5 ? 1.0 : 0.0;
    c += uNight * lamp * vec3(0.30, 0.20, 0.09) * (0.55 + 0.45 * sin(vR.y * 0.21) * sin(vR.y * 0.21));
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

// Buildings: procedural facades (windows, blinds, mullions, shopfronts, parapets) that light up at night
const buildingMat = shader(/* glsl */`
  attribute vec3 aNrm; attribute vec4 aCol; attribute vec4 aUv;
  varying vec3 vN; varying vec3 vCol; varying float vSeed; varying vec4 vUv; varying vec3 vW;
  void main(){ vN = aNrm; vCol = aCol.rgb; vSeed = aCol.a; vUv = aUv; vW = position;
    gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }
`, /* glsl */`
  varying vec3 vN; varying vec3 vCol; varying float vSeed; varying vec4 vUv; varying vec3 vW;
  void main(){
    vec3 n = normalize(vN);
    float style = floor(vUv.z + 0.5);
    vec3 view = normalize(vW - cameraPosition);
    float near = exp(-distance(vW, cameraPosition) * 0.004);
    vec3 L = lightSh(n, vW);
    float sd = floor(vSeed * 255.0 + 0.5);          // exact per-building integer, so the hashes below are stable
    vec3 c;
    if (style > 3.5) {                       // pitched roofs: rows of asphalt shingles
      vec2 g = vUv.xy;
      float rowN = g.y / 0.3, fy = fwidth(rowN) + 1e-4, sharp = 1.0 - smoothstep(0.3, 0.9, fy);
      float row = fract(rowN), tab = fract(g.x / 0.95 + floor(rowN) * 0.5);
      float shade = 1.0 - 0.24 * (1.0 - smoothstep(0.0, 0.14 + fy, row)) * sharp;
      shade *= 1.0 - 0.12 * step(0.95, tab) * sharp;
      shade *= mix(1.0, 0.86 + 0.28 * hash21(vec2(floor(g.x / 0.95 + floor(rowN) * 0.5), floor(rowN)) + sd), sharp);
      c = vCol * mix(1.0, shade, near) * (0.92 + 0.16 * n2(vW.xz * 0.4)) * L;
    } else if (style > 2.5) {                // flat roofs
      vec3 alb = mix(vCol, vec3(0.44, 0.45, 0.47), 0.65);
      alb *= mix(1.0, 0.82 + 0.36 * n2(vW.xz * 0.8), near);
      c = alb * L;
    } else {
      float ao = mix(0.6, 1.0, smoothstep(0.0, 28.0, vW.y));
      vec2 g = vUv.xy;
      float grain = mix(1.0, 0.9 + 0.2 * n2(vec2(g.x * 9.0, g.y * 14.0) + sd), near);
      vec3 wall = vCol * grain * L * ao;
      c = wall;
      if (style < 1.5) {
        vec2 f = fract(g); vec2 id = floor(g);
        bool ground = g.y < 1.0;
        bool parapet = g.y > vUv.w;
        vec2 lo = style < 0.5 ? vec2(0.24, 0.26) : vec2(0.05, 0.10);
        vec2 hi = style < 0.5 ? vec2(0.76, 0.80) : vec2(0.95, 0.90);
        if (ground) { lo = vec2(0.08, 0.06); hi = vec2(0.92, 0.80); }
        vec2 fw = fwidth(g) + 1e-4;
        float far = smoothstep(0.3, 0.9, max(fw.x, fw.y));
        vec2 m2 = smoothstep(lo - fw, lo + fw, f) * (1.0 - smoothstep(hi - fw, hi + fw, f));
        float avg = (hi.x - lo.x) * (hi.y - lo.y);
        float m = parapet ? 0.0 : mix(m2.x * m2.y, avg, far);
        float h1 = hash21(id + sd * 3.0);
        float h2 = hash21(id * 2.0 + sd * 5.0 + 5.0);
        float h3 = hash21(id * 3.0 + sd * 7.0 + 11.0);
        vec3 r = reflect(view, n); r.y = abs(r.y) * 0.8 + 0.1;
        vec3 glass = mix(vec3(0.09, 0.13, 0.18), vCol * 0.5, 0.35) * (0.75 + 0.5 * h1) * (0.35 + 0.65 * (1.0 - uNight));
        glass = mix(glass, skyColor(normalize(r)), 0.42) * ao;
        glass += uSunCol * pow(max(dot(reflect(view, n), uSun), 0.0), 40.0) * 0.9 * (1.0 - uNight);
        float litP = ground ? 0.75 : 0.42;
        float lit = step(1.0 - litP, h1) * uNight;
        vec3 warm = mix(vec3(1.0, 0.80, 0.46), vec3(0.78, 0.88, 1.0), step(0.78, h2));
        glass += warm * lit * (0.55 + 0.6 * h2);
        if (!ground) {
          // window blinds drawn part-way down, and a centre mullion on curtain walls
          float wy = clamp((f.y - lo.y) / (hi.y - lo.y), 0.0, 1.0);
          float bl = step(0.45, h3) * (0.2 + 0.6 * h2);
          vec3 blind = vec3(0.80, 0.78, 0.72) * (L * 0.5 + 0.12 + warm * lit * 0.55);
          float bw = fw.y / (hi.y - lo.y);
          glass = mix(glass, blind, smoothstep(1.0 - bl - bw, 1.0 - bl + bw, wy) * step(0.01, bl) * 0.8 * (1.0 - far));
          if (style > 0.5) glass = mix(glass, wall * 0.65, (1.0 - smoothstep(0.012, 0.012 + fw.x, abs(f.x - 0.5))) * 0.85 * (1.0 - far));
        }
        c = mix(wall, glass, m);
        c *= 1.0 - 0.28 * (1.0 - smoothstep(0.0, 0.05 + fw.y, f.y)) * (1.0 - far);     // floor-slab shadow line
        if (parapet) c = wall * 0.8;
        if (ground && f.y > 0.83 && f.y < 0.96 && hash21(vec2(id.x, sd)) > 0.45) {   // shop signs
          vec3 sg = 0.22 + 0.55 * vec3(hash21(vec2(id.x, 1.0) + sd), hash21(vec2(id.x, 2.0) + sd), hash21(vec2(id.x, 3.0) + sd));
          c = mix(c, sg * (L * ao + 0.55 * uNight), (1.0 - far) * step(0.06, f.x) * step(f.x, 0.94));
        }
      }
    }
    gl_FragColor = vec4(fogged(c, vW), 1.0);
  }
`);

// Generic lit vertex-colour material (trees, trains, the L, cars, lamps, props). Supports instancing.
// Colours above 1.5 are treated as light sources that glow at night (lamp heads, head/tail lights).
const litMat = shader(/* glsl */`
  attribute vec3 aCol; varying vec3 vCol; varying vec3 vN; varying vec3 vW; varying float vE;
  void main(){
    vec4 p = vec4(position, 1.0); vec3 n = normal; vCol = aCol;
    vE = step(1.5, max(aCol.r, max(aCol.g, aCol.b)));
    #ifdef USE_INSTANCING
      p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
    #endif
    #ifdef USE_INSTANCING_COLOR
      if (vE < 0.5) vCol *= instanceColor;
    #endif
    p = modelMatrix * p; vN = normalize(mat3(modelMatrix) * n); vW = p.xyz;
    gl_Position = projectionMatrix * viewMatrix * p;
  }
`, /* glsl */`
  varying vec3 vCol; varying vec3 vN; varying vec3 vW; varying float vE;
  void main(){
    vec3 n = normalize(vN);
    vec3 c = vE > 0.5 ? vCol * (0.13 + 0.5 * uNight) : vCol * lightSh(n, vW);
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
let ROADS = [];
function buildGround() {
  const rnd = mulberry(7);
  mctx.fillStyle = '#39424d'; mctx.fillRect(0, 0, mapCv.width, mapCv.height);
  mctx.lineJoin = mctx.lineCap = 'round';

  const g = new FlatBuilder();
  // the base land is a grid of modest quads rather than one giant one
  const GT = 6000;
  if (!document.getElementById('metro-head')) for (let ix = -8; ix < 8; ix++) for (let iy = -8; iy < 8; iy++) {
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
  ROADS = roads;
  for (const rd of roads) if (rd.c <= 3) r.ribbon(rd.pts, ROAD_W[rd.c] + 6.5, [174, 170, 160]);     // sidewalks
  for (const rd of roads) {
    r.ribbon(rd.pts, ROAD_W[rd.c], C.roads[rd.c], rd.c <= 1 ? 2 : rd.c <= 2 ? 1 : 0);
    if (rd.c <= 4) mapLine(rd.pts, rd.c <= 1 ? 3.2 : rd.c <= 3 ? 2.2 : 1, rd.c <= 3 ? '#77818d' : '#566070');
    const hw = ROAD_W[rd.c] / 2, pts = rd.pts;
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const s = { x1: pts[i], y1: pts[i + 1], x2: pts[i + 2], y2: pts[i + 3], hw, ni: rd.ni, name: rd.ni >= 0 ? CITY.names[rd.ni] : null };
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
    const vEnd = H < 5.2 ? vTop : vTop + 0.3;
    const vert = (x, y, z, n, u, v, s) => { T.pos.push(x, y, z); T.nrm.push(n[0], n[1], n[2]); T.col.push(c[0], c[1], c[2], sd); T.uv.push(u, v, s, vTop); return T.n++; };

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
          const i0 = vert(ax, m, -ay, nn, 0, 0, st), i1 = vert(bx, m, -by, nn, nb, 0, st), i2 = vert(bx, wallTop, -by, nn, nb, vEnd, st), i3 = vert(ax, wallTop, -ay, nn, 0, vEnd, st);
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
    // rooftop plant rooms and lift overruns on larger flat roofs
    if (!rt && h > 16 && kind !== 8) {
      let area = 0, best = 0, ang = 0;
      for (let i = 0, n = outer.length; i < n; i += 2) {
        const ax = outer[i], ay = outer[i + 1], bx = outer[(i + 2) % n], by = outer[(i + 3) % n];
        area += ax * by - bx * ay;
        const len = Math.hypot(bx - ax, by - ay); if (len > best) { best = len; ang = Math.atan2(by - ay, bx - ax); }
      }
      area = Math.abs(area) / 2;
      if (area > 260) {
        const count = 1 + (area > 900 ? 1 : 0) + (area > 2600 ? 1 : 0) + (area > 6000 ? 2 : 0);
        const wallC = c, ca = Math.cos(ang), sa = Math.sin(ang), lim = Math.min(7, Math.sqrt(area) * 0.16);
        c = [c[0] * 0.45 + 62, c[1] * 0.45 + 64, c[2] * 0.45 + 68];
        for (let k = 0; k < count; k++) {
          const px = minx + (0.2 + rnd() * 0.6) * (maxx - minx), py = miny + (0.2 + rnd() * 0.6) * (maxy - miny);
          const bw = 1.4 + rnd() * lim, bd = 1.4 + rnd() * lim, bh = 1.6 + rnd() * 3.4;
          const q = [[-bw, -bd], [bw, -bd], [bw, bd], [-bw, bd]].map(([u, v]) => [px + u * ca - v * sa, py + u * sa + v * ca]);
          if (!q.every(([x, y]) => pip(outer, x, y)) || rings.slice(1).some((hr) => q.some(([x, y]) => pip(hr, x, y)))) continue;
          for (let e = 0; e < 4; e++) {
            const [ax, ay] = q[e], [bx, by] = q[(e + 1) % 4], dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
            const nn = [Math.round(dy / len * 127), 0, Math.round(dx / len * 127)];
            const i0 = vert(ax, h, -ay, nn, 0, 0, 2), i1 = vert(bx, h, -by, nn, 0, 0, 2), i2 = vert(bx, h + bh, -by, nn, 0, 0, 2), i3 = vert(ax, h + bh, -ay, nn, 0, 0, 2);
            T.idx.push(i0, i1, i2, i0, i2, i3);
          }
          const j = q.map(([x, y]) => vert(x, h + bh, -y, up, 0, 0, 3));
          T.idx.push(j[0], j[1], j[2], j[0], j[2], j[3]);
        }
        c = wallC;
      }
    }
    // collision / picking / minimap
    if (kind !== 8 && h >= 2.5) {
      const fp = { pts: outer, minx, miny, maxx, maxy, h, m, ni, kind, name: ni >= 0 ? CITY.names[ni] : null };
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
    g.setAttribute('aUv', new THREE.BufferAttribute(new Float32Array(T.uv), 4));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(T.idx), 1));
    g.computeBoundingSphere();
    const bmesh = new THREE.Mesh(g, buildingMat); bmesh.layers.enable(1); scene.add(bmesh);
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
    mesh.computeBoundingSphere(); mesh.layers.enable(1);
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
  const mesh = new THREE.Mesh(lb.geometry(), litMat); mesh.frustumCulled = false; mesh.layers.enable(1); scene.add(mesh);

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
  trainMesh.frustumCulled = false; trainMesh.layers.enable(1); scene.add(trainMesh);
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

// ───────────────────────────── street lamps and traffic ─────────────────────────────
let carMesh; const cars = []; let carRoads = [], carTotal = 0;
const _cm = new THREE.Matrix4(), _cq = new THREE.Quaternion(), _cp = new THREE.Vector3(), _c1 = new THREE.Vector3(1, 1, 1), _cY = new THREE.Vector3(0, 1, 0);
function buildStreetLife() {
  const lb = new LitBuilder(), steel = [0.2, 0.21, 0.23];
  lb.box(0, 4, 0, 0.2, 8, 0.2, 0, steel); lb.box(0.9, 7.95, 0, 1.9, 0.12, 0.12, 0, steel); lb.box(1.75, 7.85, 0, 0.7, 0.14, 0.34, 0, [3, 2.6, 1.8]);
  const geo = lb.geometry(), groups = new Map(), TT = 500;
  let side = 1, total = 0;
  for (const rd of ROADS) {
    if (rd.c > 2) continue;
    const pts = rd.pts, off = ROAD_W[rd.c] / 2 + 1.7; let carry = 20;
    for (let i = 0; i + 3 < pts.length && total < 6000; i += 2) {
      const ax = pts[i], ay = pts[i + 1], dx = pts[i + 2] - ax, dy = pts[i + 3] - ay, len = Math.hypot(dx, dy);
      if (len < 0.1) continue;
      const ux = dx / len, uy = dy / len;
      for (let d = carry; d < len; d += 46) {
        side = -side;
        const x = ax + ux * d - uy * off * side, y = ay + uy * d + ux * off * side;
        if (blockedAt(x, y, 0, 3)) continue;
        let inRoad = false; const cell = gridGet(rGrid, x, y);
        if (cell) for (const sg of cell) if (segDist(sg, x, y) < sg.hw + 0.4) { inRoad = true; break; }
        if (inRoad) continue;                       // never stand a lamp in a carriageway or crossing
        const k = Math.floor(x / TT) * 1000 + Math.floor(y / TT);
        let a = groups.get(k); if (!a) groups.set(k, a = []);
        a.push(x, y, Math.atan2(-ux * side, uy * side)); total++;
      }
      carry = (carry - len) % 46; if (carry < 0) carry += 46;
    }
  }
  for (const a of groups.values()) {
    const n = a.length / 3, mesh = new THREE.InstancedMesh(geo, litMat, n);
    for (let i = 0; i < n; i++) { _cp.set(a[i * 3], 0, -a[i * 3 + 1]); _cq.setFromAxisAngle(_cY, a[i * 3 + 2]); mesh.setMatrixAt(i, _cm.compose(_cp, _cq, _c1)); }
    mesh.computeBoundingSphere(); scene.add(mesh);
  }

  // traffic
  for (const rd of ROADS) {
    if (rd.c > 3) continue;
    const cum = [0]; for (let i = 2; i < rd.pts.length; i += 2) cum.push(cum[cum.length - 1] + Math.hypot(rd.pts[i] - rd.pts[i - 2], rd.pts[i + 1] - rd.pts[i - 1]));
    const len = cum[cum.length - 1]; if (len < 70) continue;
    carTotal += len; carRoads.push({ pts: rd.pts, cum, len, lane: Math.min(ROAD_W[rd.c] * 0.22, 3.2), acc: carTotal });
  }
  const cb = new LitBuilder(), paint = [1, 1, 1], tyre = [0.07, 0.07, 0.08];
  cb.box(0, 0.62, 0, 4.4, 0.62, 1.8, 0, paint); cb.box(-0.25, 1.2, 0, 2.3, 0.56, 1.62, 0, [0.1, 0.13, 0.17]); cb.box(-0.25, 1.5, 0, 2.1, 0.06, 1.5, 0, paint);
  for (const sx of [1.4, -1.4]) for (const sz of [0.85, -0.85]) cb.box(sx, 0.34, sz, 0.68, 0.68, 0.24, 0, tyre);
  for (const sz of [0.6, -0.6]) { cb.box(2.2, 0.7, sz, 0.06, 0.16, 0.36, 0, [3, 3, 2.6]); cb.box(-2.2, 0.72, sz, 0.06, 0.14, 0.36, 0, [3, 0.25, 0.2]); }
  const N = carRoads.length ? 1600 : 0, rnd = mulberry(4242), col = new THREE.Color();
  const pal = [[0.9, 0.9, 0.9], [0.12, 0.12, 0.13], [0.6, 0.62, 0.65], [0.35, 0.36, 0.38], [0.62, 0.1, 0.08], [0.1, 0.2, 0.42], [0.72, 0.66, 0.5], [0.95, 0.75, 0.1]];
  carMesh = new THREE.InstancedMesh(cb.geometry(), litMat, Math.max(1, N)); carMesh.count = N; carMesh.frustumCulled = false; carMesh.layers.enable(1); scene.add(carMesh);
  for (let i = 0; i < N; i++) {
    const c = { r: null, s: 0, v: 7 + rnd() * 6, dir: 1, seg: 0 }; respawnCar(c, rnd); c.s = rnd() * c.r.len; cars.push(c);
    const pc = pal[(rnd() * pal.length) | 0]; carMesh.setColorAt(i, col.setRGB(pc[0], pc[1], pc[2]));
  }
}
function respawnCar(c, rnd = Math.random) {
  const t = rnd() * carTotal; let lo = 0, hi = carRoads.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (carRoads[mid].acc < t) lo = mid + 1; else hi = mid; }
  c.r = carRoads[lo]; c.s = 0; c.dir = rnd() < 0.5 ? 1 : -1; c.seg = 0;
}
function updateCars(dt) {
  if (!carMesh || !cars.length) return;
  for (let i = 0; i < cars.length; i++) {
    const c = cars[i]; c.s += c.v * dt;
    if (c.s >= c.r.len) respawnCar(c);
    const r = c.r, q = c.dir > 0 ? c.s : r.len - c.s, cum = r.cum;
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= q) lo = mid; else hi = mid; }
    const ax = r.pts[lo * 2], ay = r.pts[lo * 2 + 1], bx = r.pts[hi * 2], by = r.pts[hi * 2 + 1], sl = cum[hi] - cum[lo] || 1, f = (q - cum[lo]) / sl;
    const tx = (bx - ax) / sl * c.dir, ty = (by - ay) / sl * c.dir;
    _cp.set(ax + (bx - ax) * f + ty * r.lane, 0, -(ay + (by - ay) * f - tx * r.lane));
    _cq.setFromAxisAngle(_cY, Math.atan2(ty, tx));
    carMesh.setMatrixAt(i, _cm.compose(_cp, _cq, _c1));
  }
  carMesh.instanceMatrix.needsUpdate = true;
}

// ───────────────────────────── cast shadows ─────────────────────────────
const SH_SIZE = 2048;
const shadowRT = new THREE.WebGLRenderTarget(SH_SIZE, SH_SIZE, { depthBuffer: true });
shadowRT.depthTexture = new THREE.DepthTexture(SH_SIZE, SH_SIZE);
shadowRT.depthTexture.minFilter = shadowRT.depthTexture.magFilter = THREE.NearestFilter;
U.uShadowMap.value = shadowRT.depthTexture;
const shadowCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1000);
shadowCam.layers.set(1);
const depthMat = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
const _sv = new THREE.Vector3(), _sc = new THREE.Vector3(), _sr = new THREE.Vector3(), _su = new THREE.Vector3();
function renderShadow() {
  if (!U.uShadowOn.value) return;
  const sun = U.uSun.value;
  const half = clamp(camera.position.y * 2.0 + 230, 260, 4200);
  camera.getWorldDirection(_sv); _sv.y = 0; if (_sv.lengthSq() < 1e-4) _sv.set(0, 0, -1); _sv.normalize();
  _sc.set(camera.position.x + _sv.x * half * 0.55, 0, camera.position.z + _sv.z * half * 0.55);
  const k = Math.min(9, Math.sqrt(Math.max(0, 1 - sun.y * sun.y)) / Math.max(0.05, sun.y)), D = half * k + 900;
  shadowCam.position.copy(_sc).addScaledVector(sun, D); shadowCam.up.set(0, 1, 0); shadowCam.lookAt(_sc); shadowCam.updateMatrixWorld();
  const tex = 2 * half / SH_SIZE;                         // snap to whole texels so shadows do not shimmer
  _sr.setFromMatrixColumn(shadowCam.matrixWorld, 0); _su.setFromMatrixColumn(shadowCam.matrixWorld, 1);
  const px = shadowCam.position.dot(_sr), py = shadowCam.position.dot(_su);
  shadowCam.position.addScaledVector(_sr, Math.round(px / tex) * tex - px).addScaledVector(_su, Math.round(py / tex) * tex - py);
  shadowCam.left = -half; shadowCam.right = half; shadowCam.top = half; shadowCam.bottom = -half; shadowCam.near = 1; shadowCam.far = 2 * half * k + 1600;
  shadowCam.updateProjectionMatrix(); shadowCam.updateMatrixWorld(true);
  U.uShadowM.value.multiplyMatrices(shadowCam.projectionMatrix, shadowCam.matrixWorldInverse);
  U.uShadowTexel.value = tex; U.uShadowBias.value = (tex * 0.6 + 0.12) / (shadowCam.far - shadowCam.near);
  renderer.setRenderTarget(shadowRT); renderer.clear();
  scene.overrideMaterial = depthMat; renderer.render(scene, shadowCam); scene.overrideMaterial = null;
  renderer.setRenderTarget(null);
}

// ───────────────────────────── Chicagoland: streamed metro tiles ─────────────────────────────
// The whole metro area ships as 1 km tiles. A worker decodes the tiles near the camera into geometry;
// everything further away is a ground texture (with a built-up mask and night lights).
const MH = (() => { const el = $('metro-head'); try { return el ? JSON.parse(el.textContent) : null; } catch (e) { return null; } })();
const METRO_KIND = [1, 5, 2, 10, 9, 6];            // metro building kind -> KIND_NAMES index
const metro = { ready: false, tiles: new Map(), inflight: 0, queue: [], client: null, R: 2000, TR: 1000, mapDirty: true, tilesTex: null, overview: null, failed: false };
const inDowntown = (x, y) => x > BX0 && x < BX1 && y > BY0 && y < BY1;
function metroTileId(x, y) {
  if (!MH) return -1;
  const i = Math.floor((x - MH.x0) / MH.tile), j = Math.floor((y - MH.y0) / MH.tile);
  return i < 0 || j < 0 || i >= MH.nx || j >= MH.ny ? -1 : i * MH.ny + j;
}
// true once the buildings around (x, y) exist, so it is safe to put the player on the ground there
function areaReady(x, y) {
  if (!MH || metro.failed || inDowntown(x, y)) return true;
  const id = metroTileId(x, y); if (id < 0) return true;
  const t = metro.tiles.get(id); return !!(t && t.state === 'ready');
}
const metroStatus = (t) => { const el = $('metroStatus'); if (el) el.textContent = t; };

async function b64Bytes(id) {
  const el = $(id); const s = el.textContent.trim(); el.textContent = '';
  try { return new Uint8Array(await (await fetch('data:application/octet-stream;base64,' + s)).arrayBuffer()); } catch (e) {
    const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u;
  }
}
async function b64Image(id) {
  const el = $(id); const img = new Image(); img.src = 'data:image/webp;base64,' + el.textContent.trim(); el.textContent = '';
  await img.decode(); return img;
}

// worker client, with an in-page fallback for browsers that refuse workers on file:// pages
function makeClient(onmsg) {
  let core = null;
  const local = {
    worker: false,
    post(m) {
      setTimeout(async () => {
        try {
          if (m.type === 'init') {
            const st = new Blob([m.gz]).stream().pipeThrough(new DecompressionStream('gzip'));
            core = createCore(m.head, new Uint8Array(await new Response(st).arrayBuffer()), m.downtown);
            onmsg({ type: 'ready', g: core.globals() });
          } else if (m.type === 'tile') onmsg({ type: 'tile', id: m.id, t: core.tile(m.id, m.trees) });
          else if (m.type === 'trees') onmsg({ type: 'trees', id: m.id, tr: core.trees(m.id) });
        } catch (err) { onmsg({ type: 'error', id: m.id, msg: String(err) }); }
      }, 0);
    },
  };
  let w = null;
  try { w = new Worker(URL.createObjectURL(new Blob([__METRO_WORKER__], { type: 'text/javascript' }))); } catch (e) { w = null; }
  if (!w) return local;
  const client = { worker: true, post: (m) => w.postMessage(m) };
  let initMsg = null, switched = false;
  const toLocal = () => { if (switched) return; switched = true; try { w.terminate(); } catch (e) { /* ignore */ } client.worker = false; client.post = local.post; if (initMsg) local.post(initMsg); };
  w.onmessage = (e) => onmsg(e.data);
  w.onerror = (e) => { console.warn('tile worker failed, building tiles on the main thread', e.message); toLocal(); };
  client.post = (m) => { if (m.type === 'init') initMsg = m; w.postMessage(m); };
  return client;
}

async function startMetro() {
  if (!MH) return;
  try {
    metroStatus('Unpacking Chicagoland…');
    const gz = await b64Bytes('metro-bin');
    const [color, lights, m00, m01, m10, m11] = await Promise.all(['metro-color', 'metro-lights', 'metro-mask-00', 'metro-mask-01', 'metro-mask-10', 'metro-mask-11'].map(b64Image));
    buildMetroGround(color, [[m00, m01], [m10, m11]], lights);
    buildOverview(color, [[m00, m01], [m10, m11]]);
    metro.client = makeClient(onMetroMsg);
    metro.client.post({ type: 'init', head: MH, gz: gz.buffer, downtown: [BX0, BY0, BX1, BY1] });
  } catch (err) {
    console.error(err); metro.failed = true; metroStatus('The metro area could not be loaded in this browser — downtown still works.');
  }
}

// ── ground: four 55 km quadrants sharing one colour texture, each with its own built-up mask
function buildMetroGround(color, masks, lights) {
  const tex = (img) => {
    const t = new THREE.Texture(img); t.colorSpace = THREE.NoColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t;
  };
  const cT = tex(color), lT = tex(lights);
  const tt = new THREE.DataTexture(new Uint8Array(MH.nx * MH.ny), MH.nx, MH.ny, THREE.RedFormat);
  tt.magFilter = tt.minFilter = THREE.NearestFilter; tt.needsUpdate = true; metro.tilesTex = tt;
  const G = MH.ground, half = G.ext / 2;
  const vs = 'varying vec3 vW; void main(){ vW = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }';
  const fs = /* glsl */`
    uniform sampler2D uColor, uMask, uLights, uTiles; uniform vec4 uG, uQ, uTG, uDown; varying vec3 vW;
    void main(){
      vec2 m = vec2(vW.x, -vW.z);
      vec2 guv = (m - uG.xy) / uG.z;
      vec3 col = texture2D(uColor, guv).rgb;
      float built = texture2D(uMask, (m - uQ.xy) / uQ.z).r;
      float loaded = texture2D(uTiles, (m - uTG.xy) / uTG.zw).r;
      if (m.x > uDown.x && m.x < uDown.z && m.y > uDown.y && m.y < uDown.w) loaded = 1.0;
      float d = distance(vW, cameraPosition);
      float gr = mix(1.0, 0.88 + 0.24 * (n2(vW.xz * 1.7) * 0.6 + n2(vW.xz * 0.19) * 0.4), exp(-d * 0.005));
      vec3 alb = mix(col * gr, vec3(0.34, 0.35, 0.37), built * 0.92 * (1.0 - loaded));
      vec3 c = alb * lightSh(vec3(0.0, 1.0, 0.0), vW);
      float lt = texture2D(uLights, guv).r;
      c += uNight * vec3(1.0, 0.55, 0.2) * smoothstep(0.08, 0.9, lt) * pow(lt, 1.4) * 1.5 * mix(1.0, 0.15, loaded);
      gl_FragColor = vec4(fogged(c, vW), 1.0);
    }`;
  for (const i of [0, 1]) for (const j of [0, 1]) {
    const qx = G.x0 + i * half, qy = G.y0 + (1 - j) * half;          // j = 0 is the northern half
    const mat = new THREE.ShaderMaterial({
      uniforms: Object.assign({}, U, { uColor: { value: cT }, uMask: { value: tex(masks[i][j]) }, uLights: { value: lT }, uTiles: { value: tt },
        uG: { value: new THREE.Vector4(G.x0, G.y0, G.ext, 0) }, uQ: { value: new THREE.Vector4(qx, qy, half, 0) },
        uTG: { value: new THREE.Vector4(MH.x0, MH.y0, MH.nx * MH.tile, MH.ny * MH.tile) }, uDown: { value: new THREE.Vector4(BX0, BY0, BX1, BY1) } }),
      vertexShader: vs, fragmentShader: GLSL_COMMON + fs, depthTest: false, depthWrite: false,
    });
    const geo = new THREE.PlaneGeometry(half, half, 28, 28); geo.rotateX(-Math.PI / 2); geo.translate(qx + half / 2, 0, -(qy + half / 2));
    const m = new THREE.Mesh(geo, mat); m.renderOrder = -60; scene.add(m);
  }
  // land beyond the metro area
  const og = new THREE.PlaneGeometry(700000, 700000, 40, 40); og.rotateX(-Math.PI / 2);
  const col = new Uint8Array(og.attributes.position.count * 3); for (let k = 0; k < col.length; k += 3) col.set([150, 148, 132], k);
  og.setAttribute('aCol', new THREE.BufferAttribute(col, 3, true));
  const om = new THREE.Mesh(og, flatMat); om.renderOrder = -62; om.frustumCulled = false; scene.add(om);
}

// ── overview map (dark theme) for the full map and the far minimap, made from the ground textures
function buildOverview(color, masks) {
  const S = 4096, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(color, 0, 0, S, S);
  const base = ctx.getImageData(0, 0, S, S);
  for (const i of [0, 1]) for (const j of [0, 1]) ctx.drawImage(masks[i][j], i * S / 2, j * S / 2, S / 2, S / 2);
  const mk = ctx.getImageData(0, 0, S, S), a = base.data, b = mk.data;
  for (let k = 0; k < a.length; k += 4) {
    const r = a[k], g = a[k + 1], bl = a[k + 2], m = b[k] / 255 * 0.8;
    let R = 50, Gc = 58, Bc = 68;
    if (bl > r + 40) { R = 31; Gc = 79; Bc = 120; } else if (g > r + 8) { R = 52; Gc = 90; Bc = 60; }
    a[k] = R + (150 - R) * m; a[k + 1] = Gc + (158 - Gc) * m; a[k + 2] = Bc + (170 - Bc) * m;
  }
  ctx.putImageData(base, 0, 0);
  metro.overview = cv;
}
const ovx = (x) => (x - MH.ground.x0) / MH.ground.ext * 4096, ovy = (y) => (MH.ground.y0 + MH.ground.ext - y) / MH.ground.ext * 4096;

// ── messages from the worker
function onMetroMsg(m) {
  if (m.type === 'ready') { onMetroReady(m.g); return; }
  if (m.type === 'error') {
    console.error('tile worker:', m.msg);
    if (m.id === undefined) { metro.failed = true; metroStatus('The metro area could not be loaded — downtown still works.'); return; }
    metro.inflight = Math.max(0, metro.inflight - 1); const t = metro.tiles.get(m.id); if (t) t.state = 'failed'; return;
  }
  metro.queue.push(m);
}
let tallMesh = null;
function onMetroReady(g) {
  if (g.water.idx.length) {
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.BufferAttribute(g.water.pos, 3)); wg.setIndex(new THREE.BufferAttribute(g.water.idx, 1));
    const wm = new THREE.Mesh(wg, waterMat); wm.renderOrder = -46; wm.frustumCulled = false; scene.add(wm);
  }
  tallMesh = addBuildingMesh(g.tall);
  const fp = g.tallFp;
  for (let k = 0; k < fp.h.length; k++) {
    const item = footprint(fp, k, -1); const ni = g.tallNames[k];
    item.name = ni >= 0 ? MH.names[ni] : null;
    gridAdd(bGrid, item.minx, item.miny, item.maxx, item.maxy, item);
    if (item.name && !labelSeen.has(item.name)) { labelSeen.add(item.name); labelCands.push({ name: item.name, x: (item.minx + item.maxx) / 2, y: (item.miny + item.maxy) / 2, h: item.h, lm: null }); }
  }
  metro.ready = true;
  metroStatus(`Chicagoland ready — ${(MH.nRect + MH.nPoly + fp.h.length).toLocaleString()} buildings streamed in as you explore.`);
}
function footprint(fp, k, tile) {
  const pts = fp.xy.subarray(fp.start[k], fp.start[k + 1]);
  let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
  for (let i = 0; i < pts.length; i += 2) { const x = pts[i], y = pts[i + 1]; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
  return { pts, minx, miny, maxx, maxy, h: fp.h[k], m: 0, ni: -1, name: null, kind: METRO_KIND[fp.kind[k]] || 0, tile };
}
function addBuildingMesh(b) {
  if (!b.idx.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(b.pos, 3));
  g.setAttribute('aNrm', new THREE.BufferAttribute(b.nrm, 3, true));
  g.setAttribute('aCol', new THREE.BufferAttribute(b.col, 4, true));
  g.setAttribute('aUv', new THREE.BufferAttribute(b.uv, 4));
  g.setIndex(new THREE.BufferAttribute(b.idx, 1));
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, buildingMat); m.layers.enable(1); scene.add(m); return m;
}
function addFlatMesh(f, mat, order) {
  if (!f.idx.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(f.pos, 3));
  if (f.col && f.col.length) g.setAttribute('aCol', new THREE.BufferAttribute(f.col, 3, true));
  if (f.ex) g.setAttribute('aR', new THREE.BufferAttribute(f.ex, 3));
  g.setIndex(new THREE.BufferAttribute(f.idx, 1));
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, mat); m.renderOrder = order; scene.add(m); return m;
}
function gridAddK(grid, minx, miny, maxx, maxy, item, keys) {
  const x0 = Math.floor(minx / CELL), x1 = Math.floor(maxx / CELL), y0 = Math.floor(miny / CELL), y1 = Math.floor(maxy / CELL);
  for (let ix = x0; ix <= x1; ix++) for (let iy = y0; iy <= y1; iy++) {
    const k = cellKey(ix + 2048, iy + 2048); let c = grid.get(k); if (!c) grid.set(k, c = []); c.push(item); keys.add(k);
  }
}
function gridRemoveTile(grid, keys, id) {
  for (const k of keys) {
    const c = grid.get(k); if (!c) continue;
    let w = 0; for (let r = 0; r < c.length; r++) if (c[r].tile !== id) c[w++] = c[r];
    c.length = w; if (!w) grid.delete(k);
  }
}
function setTileTex(id, v) {
  const i = Math.floor(id / MH.ny), j = id % MH.ny;
  metro.tilesTex.image.data[j * MH.nx + i] = v; metro.tilesTex.needsUpdate = true;
}
function applyTile(m) {
  const rec = metro.tiles.get(m.id);
  metro.inflight = Math.max(0, metro.inflight - 1);
  if (!rec || rec.state !== 'pending') return;
  const t = m.t;
  rec.meshes = [addBuildingMesh(t.b), addFlatMesh(t.land, flatMat, -52), addFlatMesh(t.sw, flatMat, -39), addFlatMesh(t.pk, flatMat, -38), addFlatMesh(t.rd, roadMat, -36)].filter(Boolean);
  rec.bKeys = new Set(); rec.rKeys = new Set(); rec.fp = t.fp; rec.segs = t.segs;
  for (let k = 0; k < t.fp.h.length; k++) { const it = footprint(t.fp, k, m.id); gridAddK(bGrid, it.minx, it.miny, it.maxx, it.maxy, it, rec.bKeys); }
  const sg = t.segs;
  for (let i = 0; i < sg.length; i += 7) {
    const s = { x1: sg[i], y1: sg[i + 1], x2: sg[i + 2], y2: sg[i + 3], hw: sg[i + 4], ni: -1, name: sg[i + 5] >= 0 ? MH.names[sg[i + 5]] : null, tile: m.id };
    gridAddK(rGrid, Math.min(s.x1, s.x2) - s.hw - 4, Math.min(s.y1, s.y2) - s.hw - 4, Math.max(s.x1, s.x2) + s.hw + 4, Math.max(s.y1, s.y2) + s.hw + 4, s, rec.rKeys);
  }
  if (t.trees) addTrees(rec, t.trees);
  rec.state = 'ready'; setTileTex(m.id, 255); metro.mapDirty = true;
}
function unloadTile(id) {
  const rec = metro.tiles.get(id); if (!rec) return;
  if (rec.state === 'ready') {
    for (const m of rec.meshes) { scene.remove(m); m.geometry.dispose(); }
    removeTrees(rec);
    gridRemoveTile(bGrid, rec.bKeys, id); gridRemoveTile(rGrid, rec.rKeys, id);
    setTileTex(id, 0); metro.mapDirty = true;
  }
  metro.tiles.delete(id);
}

// ── trees (instanced, per tile)
let treeGeoD = null, treeGeoC = null;
function treeGeos() {
  if (treeGeoD) return;
  const d = new LitBuilder();
  d.geo(new THREE.CylinderGeometry(0.22, 0.34, 3, 5), M4(0, 1.5, 0), [0.36, 0.27, 0.2]);
  d.geo(new THREE.IcosahedronGeometry(2.3, 0), M4(0, 4.6, 0, 1, 1.25, 1), [1, 1, 1]);
  d.geo(new THREE.IcosahedronGeometry(1.5, 0), M4(0.9, 3.6, 0.5, 1, 1, 1, 1), [0.9, 0.95, 0.9]);
  treeGeoD = d.geometry();
  const c = new LitBuilder();
  c.geo(new THREE.CylinderGeometry(0.18, 0.26, 2.4, 5), M4(0, 1.2, 0), [0.32, 0.24, 0.18]);
  c.geo(new THREE.ConeGeometry(2.4, 4.2, 7), M4(0, 3.6, 0), [1, 1, 1]);
  c.geo(new THREE.ConeGeometry(1.8, 3.6, 7), M4(0, 5.6, 0), [1, 1, 1]);
  c.geo(new THREE.ConeGeometry(1.1, 2.8, 7), M4(0, 7.4, 0), [1, 1, 1]);
  treeGeoC = c.geometry();
}
const _tm = new THREE.Matrix4(), _tq = new THREE.Quaternion(), _ts = new THREE.Vector3(), _tp = new THREE.Vector3(), _tc = new THREE.Color(), _tY = new THREE.Vector3(0, 1, 0);
function addTrees(rec, tr) {
  treeGeos(); removeTrees(rec);
  const n = tr.length / 7; let nc = 0; for (let i = 0; i < n; i++) if (tr[i * 7 + 4] > 0.5) nc++;
  rec.trees = [];
  const mk = (geo, cnt) => { if (!cnt) return null; const m = new THREE.InstancedMesh(geo, litMat, cnt); m.layers.enable(1); rec.trees.push(m); return m; };
  const md = mk(treeGeoD, n - nc), mc = mk(treeGeoC, nc); let kd = 0, kc = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 7, sc = tr[o + 2], con = tr[o + 4] > 0.5, br = tr[o + 5], hue = tr[o + 6];
    _tq.setFromAxisAngle(_tY, tr[o + 3]); _ts.set(sc, sc * (0.9 + hue * 0.35), sc); _tp.set(tr[o], 0, -tr[o + 1]);
    _tm.compose(_tp, _tq, _ts);
    if (con) { _tc.setRGB(0.2 * br, 0.38 * br, 0.24 * br); mc.setMatrixAt(kc, _tm); mc.setColorAt(kc++, _tc); }
    else { _tc.setRGB((0.34 + hue * 0.22) * br, (0.6 + hue * 0.12) * br, (0.24 + hue * 0.1) * br); md.setMatrixAt(kd, _tm); md.setColorAt(kd++, _tc); }
  }
  for (const m of rec.trees) { m.computeBoundingSphere(); scene.add(m); }
}
function removeTrees(rec) {
  if (rec.trees) for (const m of rec.trees) { scene.remove(m); m.dispose(); }
  rec.trees = null;
}

// ── which tiles to have loaded: everything within R of the camera, trees within TR
function updateMetro() {
  if (!metro.ready || !metro.client) return;
  const cx = camera.position.x, cy = -camera.position.z, alt = Math.max(0, camera.position.y);
  const R = metro.R = clamp(1900 + alt * 1.7, 1900, 5200), TR = metro.TR = alt < 900 ? 1000 : 0;
  const T = MH.tile, fx = -Math.sin(player.yaw), fy = Math.cos(player.yaw);
  const i0 = Math.max(0, Math.floor((cx - R - MH.x0) / T)), i1 = Math.min(MH.nx - 1, Math.floor((cx + R - MH.x0) / T));
  const j0 = Math.max(0, Math.floor((cy - R - MH.y0) / T)), j1 = Math.min(MH.ny - 1, Math.floor((cy + R - MH.y0) / T));
  const want = [];
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const tx = MH.x0 + (i + 0.5) * T, ty = MH.y0 + (j + 0.5) * T;
    const d = Math.hypot(Math.max(0, Math.abs(cx - tx) - T / 2), Math.max(0, Math.abs(cy - ty) - T / 2));
    if (d > R) continue;
    const id = i * MH.ny + j, rec = metro.tiles.get(id);
    if (!rec) { const ahead = (tx - cx) * fx + (ty - cy) * fy > 0; want.push({ id, d, pri: d * (ahead ? 1 : 1.7) }); }
    else if (rec.state === 'ready' && TR && d < TR && !rec.trees && !rec.treesPending && metro.inflight < 3) {
      rec.treesPending = true; metro.inflight++; metro.client.post({ type: 'trees', id });
    }
  }
  want.sort((a, b) => a.pri - b.pri);
  for (const w of want) {
    if (metro.inflight >= 3) break;
    metro.tiles.set(w.id, { state: 'pending', trees: null });
    metro.inflight++; metro.client.post({ type: 'tile', id: w.id, trees: TR > 0 && w.d < TR });
  }
  for (const [id, rec] of metro.tiles) {
    const i = Math.floor(id / MH.ny), j = id % MH.ny, tx = MH.x0 + (i + 0.5) * T, ty = MH.y0 + (j + 0.5) * T;
    const d = Math.hypot(Math.max(0, Math.abs(cx - tx) - T / 2), Math.max(0, Math.abs(cy - ty) - T / 2));
    if (d > R + 1200) unloadTile(id);
    else if (rec.trees && d > TR + 500) removeTrees(rec);
  }
}
function processMetroQueue() {
  const t0 = performance.now(), had = metro.queue.length;
  while (metro.queue.length && performance.now() - t0 < 6) {
    const m = metro.queue.shift();
    if (m.type === 'tile') applyTile(m);
    else if (m.type === 'trees') {
      metro.inflight = Math.max(0, metro.inflight - 1);
      const rec = metro.tiles.get(m.id); if (rec) { rec.treesPending = false; if (rec.state === 'ready' && metro.TR) addTrees(rec, m.tr); }
    }
  }
  if (had) updateMetro();        // keep the worker busy regardless of frame rate
}

// ── local street map around the player (minimap / zoomed-in full map)
const LM = { cv: document.createElement('canvas'), S: 0.36, cx: 1e9, cy: 1e9, t: 0 };
LM.cv.width = LM.cv.height = 1200;
const lmx = (x) => (x - LM.cx) * LM.S + 600, lmy = (y) => (LM.cy - y) * LM.S + 600;
function renderLocalMap(force) {
  const now = performance.now();
  const moved = Math.hypot(player.x - LM.cx, player.y - LM.cy) > 650;
  if (!force && !moved && !(metro.mapDirty && now - LM.t > 1500)) return;
  LM.cx = player.x; LM.cy = player.y; LM.t = now; metro.mapDirty = false;
  const c = LM.cv.getContext('2d'), k = LM.S;
  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#39424d'; c.fillRect(0, 0, 1200, 1200);
  if (metro.overview) {
    const s = 4096 / MH.ground.ext;          // overview px per metre
    const x0 = LM.cx - 600 / k, y1 = LM.cy + 600 / k;
    c.drawImage(metro.overview, ovx(x0), ovy(y1), 1200 / k * s, 1200 / k * s, 0, 0, 1200, 1200);
  }
  if (BX1 > LM.cx - 600 / k && BX0 < LM.cx + 600 / k && BY1 > LM.cy - 600 / k && BY0 < LM.cy + 600 / k)
    c.drawImage(mapCv, lmx(BX0), lmy(BY1), (BX1 - BX0) * k, (BY1 - BY0) * k);
  c.lineCap = c.lineJoin = 'round';
  for (const rec of metro.tiles.values()) {
    if (rec.state !== 'ready') continue;
    const sg = rec.segs;
    for (const cls of [4, 3, 2, 1, 0]) {
      c.beginPath();
      for (let i = 0; i < sg.length; i += 7) if (sg[i + 6] === cls) { c.moveTo(lmx(sg[i]), lmy(sg[i + 1])); c.lineTo(lmx(sg[i + 2]), lmy(sg[i + 3])); }
      c.lineWidth = cls === 0 ? 4 : cls === 1 ? 3 : cls <= 3 ? 2.2 : 1; c.strokeStyle = cls === 0 ? '#c9a24a' : cls <= 3 ? '#77818d' : '#566070'; c.stroke();
    }
    const fp = rec.fp; c.fillStyle = '#7d848d'; c.beginPath();
    for (let b = 0; b < fp.h.length; b++) {
      const s0 = fp.start[b], s1 = fp.start[b + 1];
      c.moveTo(lmx(fp.xy[s0]), lmy(fp.xy[s0 + 1]));
      for (let i = s0 + 2; i < s1; i += 2) c.lineTo(lmx(fp.xy[i]), lmy(fp.xy[i + 1]));
      c.closePath();
    }
    c.fill();
  }
}

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
  ['Wrigley Field', 41.94840, -87.65530, 30, 'Home of the Chicago Cubs since 1916, famous for its ivy-covered outfield walls and hand-turned scoreboard.', 220],
  ['Lincoln Park Zoo', 41.92110, -87.63400, 15, 'Founded in 1868, it is one of the oldest zoos in North America — and still free to visit.', 300],
  ['United Center', 41.88070, -87.67420, 40, 'Home of the Bulls and the Blackhawks since it opened in 1994.', 200],
  ['Garfield Park Conservatory', 41.88630, -87.71730, 20, 'Opened in 1908, one of the largest greenhouse conservatories in the United States.', 220],
  ['Rate Field', 41.82990, -87.63380, 40, 'The White Sox ballpark on the South Side, opened in 1991.', 220],
  ['Museum of Science and Industry', 41.79060, -87.58300, 35, 'Housed in the Palace of Fine Arts, built for the 1893 World’s Columbian Exposition.', 250],
  ['University of Chicago', 41.78860, -87.59870, 35, 'Founded in 1890 in Hyde Park, known for its Gothic stone quadrangles.', 350],
  ['Midway International Airport', 41.78680, -87.75220, 15, 'Chicago’s first airport, opened in 1927 on a single square mile of the Southwest Side.', 900],
  ['O’Hare International Airport', 41.97860, -87.90480, 20, 'Opened to commercial flights in 1955 and now one of the busiest airports in the world.', 1500],
  ['Northwestern University', 42.05650, -87.67530, 30, 'Founded in 1851, its campus runs along the Lake Michigan shore in Evanston.', 450],
  ['Bahá’í House of Worship', 42.07380, -87.68450, 40, 'A nine-sided, domed temple in Wilmette, dedicated in 1953.', 200],
  ['Chicago Botanic Garden', 42.14780, -87.79000, 15, 'Some 385 acres of gardens spread across islands in Glencoe, opened in 1972.', 700],
  ['Six Flags Great America', 42.37040, -87.93580, 60, 'The theme park in Gurnee, opened in 1976.', 550],
  ['Woodfield Mall', 42.04690, -88.03780, 20, 'Opened in Schaumburg in 1971, one of the largest shopping malls in the United States.', 450],
  ['Brookfield Zoo', 41.83230, -87.83370, 15, 'Opened in 1934 and known for exhibits without bars.', 600],
  ['Morton Arboretum', 41.81600, -88.06850, 20, 'About 1,700 acres of trees in Lisle, founded in 1922 by Joy Morton of Morton Salt.', 900],
  ['Naperville Riverwalk', 41.77280, -88.14790, 15, 'A brick path along the DuPage River, built for the city’s 150th birthday in 1981.', 400],
].map(([name, lat, lon, h, fact, r], i) => { const [x, y] = ll(lat, lon); return { i, name, x, y, h, fact, r: r || 130, found: false }; });

const SAVE_KEY = 'chicago3d.found.v1';
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || '[]'); for (const n of s) { const l = LANDMARKS.find((q) => q.name === n); if (l) l.found = true; } } catch (e) { /* storage unavailable */ }
const saveFound = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(LANDMARKS.filter((l) => l.found).map((l) => l.name))); } catch (e) { /* ignore */ } };

let wheel, jet;
function buildProps() {
  // beacons
  const beamGeo = new THREE.CylinderGeometry(3, 3, 1, 14, 1, true); beamGeo.translate(0, 0.5, 0);
  for (const l of LANDMARKS) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uC: { value: new THREE.Vector3(1, 0.78, 0.3) }, uT: U.uTime, uA: { value: 1 } },
      vertexShader: 'varying float vY; varying vec3 vN2; varying vec3 vV; void main(){ vY = position.y; vec4 w = modelMatrix * vec4(position,1.0); vN2 = normalize(mat3(modelMatrix)*vec3(normal.x,0.0,normal.z)); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform vec3 uC; uniform float uT, uA; varying float vY; varying vec3 vN2; varying vec3 vV; void main(){ float a = (1.0 - vY) * (0.16 + 0.08 * sin(uT * 2.0 + vY * 30.0)); a *= 0.35 + 0.65 * abs(dot(normalize(vN2), normalize(vec3(vV.x, 0.0, vV.z)))); gl_FragColor = vec4(uC * a * uA, 1.0); }',
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
  const props = new THREE.Mesh(lb.geometry(), litMat); props.frustumCulled = false; props.layers.enable(1); scene.add(props);

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
  wheel.position.set(np.x, WY, -np.y); wheel.rotation.y = 0.12; wheel.frustumCulled = false; wheel.layers.enable(1); scene.add(wheel);

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
const LIM = MH ? [MH.x0 - 3000, MH.y0 - 3000, MH.x1 + 30000, MH.y1 + 3000] : [BX0 - 2500, BY0 - 2500, BX1 + 2500, BY1 + 2500];

function placeAt(x, y, alt, lookX, lookY, lookH = 0) {
  player.x = clamp(x, LIM[0], LIM[2]); player.y = clamp(y, LIM[1], LIM[3]); player.alt = alt;
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
    player.alt = Math.min(na, 8000);
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
  player.x = clamp(player.x, LIM[0], LIM[2]); player.y = clamp(player.y, LIM[1], LIM[3]);
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
    $('keyLines').innerHTML = '<kbd>Click</kbd> fire · <kbd>Right-click</kbd> aim · <kbd>R</kbd> reload · <kbd>Shift</kbd> sprint<br><kbd>Space</kbd> jump · <kbd>G</kbd> quit shooter · <kbd>T</kbd> time · <kbd>H</kbd> help';
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
const KIND_NAMES = ['Building', 'House', 'Residential building', 'Office building', 'Shops', 'Garage / outbuilding', 'Civic building', 'Hotel', 'Canopy', 'Industrial building', 'Commercial building'];

const labelBox = $('labels'), labelPool = [];
for (let i = 0; i < 20; i++) { const d = document.createElement('div'); d.className = 'lab'; labelBox.appendChild(d); labelPool.push(d); }
const labelCands = [], labelSeen = new Set();
function buildLabels() {
  const seen = labelSeen;
  for (const l of LANDMARKS) { labelCands.push({ name: l.name, x: l.x, y: l.y, h: l.h, lm: l }); seen.add(l.name); }
  const lmNear = (x, y) => LANDMARKS.some((l) => Math.hypot(l.x - x, l.y - y) < 70);
  const sorted = CITY.labels.map((a) => ({ name: CITY.names[a[0]], x: a[1] * 0.1, y: a[2] * 0.1, h: a[3] * 0.1, lm: null })).sort((a, b) => b.h - a.h);
  for (const c of sorted) { if (seen.has(c.name) || lmNear(c.x, c.y)) continue; seen.add(c.name); labelCands.push(c); }
  if (MH) for (const p of MH.places) if (p[3] === 0 || p[3] === 1) labelCands.push({ name: p[0], x: p[1], y: p[2], h: 0, lm: null, place: p[3] === 0 ? 1 : 2, pop: p[4] });
}
const tmpV = new THREE.Vector3();
function updateLabels() {
  const W = window.innerWidth, H = window.innerHeight, walk = player.mode === 'walk';
  const picks = [];
  const high = player.alt > 160 && !walk;
  if (labelsOn) for (const c of labelCands) {
    if (c.place && !high) continue;
    const d = Math.hypot(c.x - player.x, c.y - player.y, c.h - player.alt);
    const range = c.lm ? 3200 + c.r * 4 : c.place === 1 ? Math.min(45000, 4000 + Math.sqrt(c.pop) * 40) * Math.min(1, player.alt / 900) : c.place === 2 ? 2600 : (walk ? 140 + c.h * 3.5 : 260 + c.h * 9);
    if (d > range) continue;
    tmpV.set(c.x, c.h + 6, -c.y).project(camera);
    if (tmpV.z > 1 || tmpV.x < -1.05 || tmpV.x > 1.05 || tmpV.y < -1.05 || tmpV.y > 1.05) continue;
    const score = c.place === 1 ? Math.log10(c.pop + 10) * 220 / (d + 1500) : c.place === 2 ? 300 / (d + 1500) : (c.lm ? 4 : 1) * (c.h + 40) / (d + 120);
    picks.push({ c, d, sx: (tmpV.x * 0.5 + 0.5) * W, sy: (-tmpV.y * 0.5 + 0.5) * H, score });
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
    const txt = p.c.name + '|' + (p.c.place ? '' : p.d > 999 ? (p.d / 1000).toFixed(1) + ' km' : Math.round(p.d / 10) * 10 + ' m');
    if (el._t !== txt) { el._t = txt; el.innerHTML = ''; el.append(p.c.name); const sm = document.createElement('small'); sm.textContent = txt.split('|')[1]; if (sm.textContent) el.append(sm); }
    const cls = 'lab' + (p.c.lm ? (p.c.lm.found ? ' lm done' : ' lm') : p.c.place ? (p.c.place === 1 && p.c.pop > 60000 ? ' pl big' : ' pl') : '');
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
  const name = hit.name || KIND_NAMES[hit.kind] || 'Building';
  const txt = `${name}|${Math.round(hit.h)} m tall · ${Math.round(dist)} m away`;
  if (el._t !== txt) { el._t = txt; el.innerHTML = ''; el.append(name + ' '); const s = document.createElement('span'); s.textContent = '· ' + txt.split('|')[1]; el.append(s); }
  el.classList.add('on');
}

function updateLocation() {
  let best = null, bd = 1e9;
  for (const h of HOODS) { const d = Math.hypot(h[1] - player.x, h[2] - player.y); if (d < bd) { bd = d; best = h[0]; } }
  if (bd > 1300 && MH) {
    // the nearest neighbourhood if one is close, otherwise the nearest town
    let nb = null, nd = 1600, tb = null, td = 1e9;
    for (const p of MH.places) {
      const d = Math.hypot(p[1] - player.x, p[2] - player.y);
      if (p[3] === 0) { if (d < td) { td = d; tb = p[0]; } } else if (d < nd) { nd = d; nb = p[0]; }
    }
    best = nb || (td < 9000 ? tb : 'Lake Michigan');
  }
  $('hood').textContent = best;
  let street = null, sd = 40;
  for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
    const cell = gridGet(rGrid, player.x + ox * CELL, player.y + oy * CELL); if (!cell) continue;
    for (const s of cell) { if (!s.name) continue; const d = segDist(s, player.x, player.y) - s.hw; if (d < sd) { sd = d; street = s.name; } }
  }
  const under = blockedAt(player.x, player.y, -1, 5000);
  let txt = street || (best === 'Lake Michigan' ? 'Over the water' : 'Chicago');
  if (player.mode === 'walk' && player.onGround && player.alt - EYE > 3) {
    const roof = blockedAt(player.x, player.y, -1, player.alt);
    txt = 'Rooftop' + (roof && roof.name ? ' · ' + roof.name : '');
  } else if (under && under.name && player.mode === 'fly' && !street) txt = 'Above ' + under.name;
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
// world -> minimap transform: scale grows with altitude so the map zooms out as you climb
function drawMini() {
  const S = miniCv.width, c = S / 2;
  const ms = player.mode === 'walk' || player.alt < 420 ? 0.36 : Math.max(0.018, 0.36 * 420 / player.alt);
  nctx.setTransform(1, 0, 0, 1, 0, 0); nctx.fillStyle = '#39424d'; nctx.fillRect(0, 0, S, S);
  nctx.translate(c, c); nctx.rotate(player.yaw);
  const P = (x, y) => [(x - player.x) * ms, (player.y - y) * ms];
  if (metro.overview) {
    const k = ms * MH.ground.ext / 4096, [ox, oy] = P(MH.ground.x0, MH.ground.y0 + MH.ground.ext);
    nctx.imageSmoothingEnabled = true; nctx.drawImage(metro.overview, ox, oy, 4096 * k, 4096 * k);
  }
  if (ms >= 0.1) {
    renderLocalMap(false);
    const k = ms / LM.S, [lx, ly] = P(LM.cx - 600 / LM.S, LM.cy + 600 / LM.S);
    nctx.drawImage(LM.cv, lx, ly, 1200 * k, 1200 * k);
  } else if (!metro.overview) {
    const [dx, dy] = P(BX0, BY1); nctx.drawImage(mapCv, dx, dy, (BX1 - BX0) * ms, (BY1 - BY0) * ms);
  }
  let near = null, nd = 1e9;
  for (const l of LANDMARKS) {
    const [x, y] = P(l.x, l.y);
    nctx.fillStyle = l.found ? '#58d6c0' : '#ffc94d'; nctx.strokeStyle = 'rgba(0,0,0,.6)'; nctx.lineWidth = 2;
    nctx.beginPath(); nctx.arc(x, y, 7, 0, 6.3); nctx.fill(); nctx.stroke();
    if (!l.found) { const d = Math.hypot(l.x - player.x, l.y - player.y); if (d < nd) { nd = d; near = l; } }
  }
  if (shooter.on) { nctx.fillStyle = '#ff4d3d'; for (const b of shooter.bots) if (!(b.dead > 0)) { const [x, y] = P(b.x, b.y); nctx.beginPath(); nctx.arc(x, y, 6, 0, 6.3); nctx.fill(); } }
  nctx.setTransform(1, 0, 0, 1, 0, 0);
  // pointer to the nearest undiscovered landmark when it is off the minimap
  if (near && nd * ms > c - 14) {
    const ang = Math.atan2(near.x - player.x, near.y - player.y) + player.yaw;
    nctx.save(); nctx.translate(c + Math.sin(ang) * (c - 16), c - Math.cos(ang) * (c - 16)); nctx.rotate(ang);
    nctx.fillStyle = '#ffc94d'; nctx.beginPath(); nctx.moveTo(0, -11); nctx.lineTo(9, 8); nctx.lineTo(-9, 8); nctx.fill(); nctx.restore();
  }
  nctx.fillStyle = '#fff'; nctx.strokeStyle = '#10151d'; nctx.lineWidth = 3;
  nctx.beginPath(); nctx.moveTo(c, c - 15); nctx.lineTo(c + 10, c + 11); nctx.lineTo(c, c + 5); nctx.lineTo(c - 10, c + 11); nctx.closePath(); nctx.stroke(); nctx.fill();
  const na = player.yaw;
  nctx.fillStyle = '#ff6b5e'; nctx.font = '700 22px system-ui, sans-serif'; nctx.textAlign = 'center'; nctx.textBaseline = 'middle';
  nctx.fillText('N', c + Math.sin(na) * (c - 20), c - Math.cos(na) * (c - 20));
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
    if (Math.hypot(l.x - player.x, l.y - player.y) < l.r && player.alt < l.h + Math.max(260, l.r * 0.6)) {
      l.found = true; setBeam(l); saveFound(); renderLmList();
      const n = LANDMARKS.filter((q) => q.found).length;
      toast(`Landmark discovered · ${n} of ${LANDMARKS.length}`, l.name, l.fact);
      if (n === LANDMARKS.length) setTimeout(() => toast('Explorer complete', 'You found every landmark!', 'All of Chicagoland is yours. Try it again at night (press T).', 10000), 7500);
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
// full map: pan / zoom over the whole metro area, click to travel
const BM = { cx: 0, cy: 0, s: 0.05, drag: null, moved: false };
function bigSize() {
  const r = bigCv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(50, Math.round(r.width * d)), h = Math.max(50, Math.round(r.height * d));
  if (bigCv.width !== w || bigCv.height !== h) { bigCv.width = w; bigCv.height = h; }
  return d;
}
function bigToWorld(px, py) { const d = Math.min(2, window.devicePixelRatio || 1); return [BM.cx + (px * d - bigCv.width / 2) / BM.s, BM.cy - (py * d - bigCv.height / 2) / BM.s]; }
function drawBig() {
  const d = bigSize(), W = bigCv.width, H = bigCv.height;
  const X = (x) => (x - BM.cx) * BM.s + W / 2, Y = (y) => (BM.cy - y) * BM.s + H / 2;
  bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.fillStyle = '#1c2633'; bctx.fillRect(0, 0, W, H);
  bctx.imageSmoothingEnabled = true;
  if (metro.overview) { const G = MH.ground; bctx.drawImage(metro.overview, X(G.x0), Y(G.y0 + G.ext), G.ext * BM.s, G.ext * BM.s); }
  if (BM.s > 0.12) {
    bctx.drawImage(mapCv, X(BX0), Y(BY1), (BX1 - BX0) * BM.s, (BY1 - BY0) * BM.s);
    if (LM.cx < 1e8) bctx.drawImage(LM.cv, X(LM.cx - 600 / LM.S), Y(LM.cy + 600 / LM.S), 1200 / LM.S * BM.s, 1200 / LM.S * BM.s);
  } else if (!metro.overview) bctx.drawImage(mapCv, X(BX0), Y(BY1), (BX1 - BX0) * BM.s, (BY1 - BY0) * BM.s);
  // town names
  if (MH) {
    bctx.textAlign = 'center'; bctx.textBaseline = 'middle';
    const minPop = BM.s < 0.02 ? 60000 : BM.s < 0.05 ? 15000 : BM.s < 0.12 ? 3000 : 0;
    for (const p of MH.places) {
      if (p[3] !== 0 || p[4] < minPop) continue;
      const x = X(p[1]), y = Y(p[2]); if (x < -50 || y < -20 || x > W + 50 || y > H + 20) continue;
      bctx.font = `${p[4] > 100000 ? 700 : 600} ${Math.round((p[4] > 100000 ? 15 : 12) * d)}px system-ui, sans-serif`;
      bctx.lineWidth = 3 * d; bctx.strokeStyle = 'rgba(10,14,22,.85)'; bctx.strokeText(p[0], x, y); bctx.fillStyle = '#e8edf3'; bctx.fillText(p[0], x, y);
    }
  }
  for (const l of LANDMARKS) {
    bctx.fillStyle = l.found ? '#58d6c0' : '#ffc94d'; bctx.strokeStyle = 'rgba(0,0,0,.7)'; bctx.lineWidth = 2 * d;
    bctx.beginPath(); bctx.arc(X(l.x), Y(l.y), 6 * d, 0, 6.3); bctx.fill(); bctx.stroke();
  }
  bctx.save(); bctx.translate(X(player.x), Y(player.y)); bctx.rotate(-player.yaw); bctx.scale(d * 0.6, d * 0.6);
  bctx.fillStyle = '#fff'; bctx.strokeStyle = '#e5484d'; bctx.lineWidth = 6;
  bctx.beginPath(); bctx.moveTo(0, -30); bctx.lineTo(20, 22); bctx.lineTo(0, 10); bctx.lineTo(-20, 22); bctx.closePath(); bctx.stroke(); bctx.fill(); bctx.restore();
}
function toggleMap(on) {
  mapOpen = on === undefined ? !mapOpen : on;
  $('bigmap').classList.toggle('on', mapOpen);
  if (mapOpen) {
    if (document.pointerLockElement) document.exitPointerLock();
    BM.cx = player.x; BM.cy = player.y; BM.s = MH ? 0.06 : 0.3;
    renderLocalMap(true); drawBig();
  }
}
function travelToPoint(x, y) {
  const top = floorAt(x, y, 1e6);
  placeAt(x, y, Math.max(player.mode === 'fly' ? player.alt : 0, top + 60, 150));
  if (player.mode !== 'fly') setMode('fly');
  toggleMap(false);
}
bigCv.addEventListener('pointerdown', (e) => { BM.drag = [e.clientX, e.clientY]; BM.moved = false; bigCv.setPointerCapture(e.pointerId); });
bigCv.addEventListener('pointermove', (e) => {
  if (!BM.drag) return;
  const d = Math.min(2, window.devicePixelRatio || 1), dx = e.clientX - BM.drag[0], dy = e.clientY - BM.drag[1];
  if (Math.abs(dx) + Math.abs(dy) > 4) BM.moved = true;
  if (BM.moved) { BM.cx -= dx * d / BM.s; BM.cy += dy * d / BM.s; BM.drag = [e.clientX, e.clientY]; drawBig(); }
});
bigCv.addEventListener('pointerup', (e) => {
  const was = BM.drag; BM.drag = null; if (!was || BM.moved) return;
  const r = bigCv.getBoundingClientRect(); const [x, y] = bigToWorld(e.clientX - r.left, e.clientY - r.top);
  travelToPoint(x, y);
});
bigCv.addEventListener('wheel', (e) => {
  e.preventDefault();
  const r = bigCv.getBoundingClientRect(), [wx, wy] = bigToWorld(e.clientX - r.left, e.clientY - r.top);
  BM.s = clamp(BM.s * (e.deltaY > 0 ? 0.85 : 1.18), MH ? 0.006 : 0.15, 2);
  const [nx, ny] = bigToWorld(e.clientX - r.left, e.clientY - r.top); BM.cx += wx - nx; BM.cy += wy - ny; drawBig();
}, { passive: false });
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
  if (shooter.on && e.button === 2) shooter.aim = true;
  if (shooter.on && e.button === 0) { audioInit(); if (shooter.dead) { if (shooter.t - shooter.deadT > 1.2) startShooter(false); } else shooter.firing = true; }
  if (!isTouch && !document.pointerLockElement && canvas.requestPointerLock) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* drag-look fallback */ } }
});
window.addEventListener('mouseup', (e) => { dragging = false; if (e.button === 2) shooter.aim = false; else shooter.firing = false; });
window.addEventListener('contextmenu', (e) => { if (started) e.preventDefault(); });
window.addEventListener('mousemove', (e) => {
  if (!started || mapOpen) return;
  if (document.pointerLockElement === canvas) look(e.movementX, e.movementY, 0.0022 * (1 - 0.5 * shooter.ads));
  else if (dragging) look(-e.movementX, -e.movementY, 0.004);
});
window.addEventListener('wheel', (e) => {
  if (!started || mapOpen) return;
  player.flySpeed = clamp(player.flySpeed * (e.deltaY > 0 ? 0.87 : 1.15), 8, 1500);
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
  const down = (e) => { e.preventDefault(); if (k === 'up' || k === 'down') touch[k] = true; else if (k === 'boost') { touch.boost = !touch.boost; b.style.background = touch.boost ? 'rgba(255,201,77,.6)' : ''; } else if (k === 'mode') { if (!shooter.on) setMode(player.mode === 'fly' ? 'walk' : 'fly'); } else if (k === 'fire') { audioInit(); shooter.firing = true; } else if (k === 'reload') reloadGun(); else if (k === 'aim') { shooter.aim = !shooter.aim; } else if (k === 'fps') { if (shooter.on && shooter.dead) startShooter(false); else toggleShooter(); } else if (k === 'map') { if (!shooter.on) toggleMap(); } else if (k === 'time') cycleTime(); };
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
const MAX_BOTS = 28, MAG = 30, FOV = 68;
const shooter = { on: false, dead: false, deadT: 0, firing: false, hp: 100, ammo: MAG, reload: 0, cool: 0, wave: 0, score: 0, kills: 0,
  waveT: 0, pending: false, lastHurt: -99, recoil: 0, vig: 0, t: 0, aim: false, ads: 0, dmgT: 0, dmgX: 0, dmgY: 0, bots: [], best: 0, savedLabels: true, msgT: 0 };
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
let botMesh, legL, legR, gun, flash, tracerMesh;
const TR_N = 80, trPos = new Float32Array(TR_N * 6), trCol = new Float32Array(TR_N * 6), trLife = new Float32Array(TR_N), trBase = new Float32Array(TR_N * 3);
let trNext = 0;
function tracer(ax, ay, az, bx, by, bz, r, g, b) {
  const i = trNext++ % TR_N;
  trPos.set([ax, az, -ay, bx, bz, -by], i * 6); trBase.set([r, g, b], i * 3); trLife[i] = 1;
}
function initShooter() {
  // bot model: local +x is forward, feet at y = 0
  const lb = new LitBuilder(), red = [0.82, 0.2, 0.14], dark = [0.16, 0.17, 0.2], pale = [0.78, 0.8, 0.84];
  lb.box(-0.2, 1.25, 0, 0.16, 0.5, 0.42, 0, [0.3, 0.33, 0.25]); lb.box(0, 1.9, 0, 0.36, 0.1, 0.36, 0, dark);      // backpack, helmet
  lb.box(0, 1.2, 0, 0.34, 0.68, 0.6, 0, red);
  lb.box(0, 1.2, 0.37, 0.2, 0.6, 0.14, 0, dark); lb.box(0.14, 1.28, -0.37, 0.48, 0.16, 0.14, 0, dark);
  lb.box(0, 1.71, 0, 0.3, 0.3, 0.3, 0, pale); lb.box(0.14, 1.73, 0, 0.06, 0.09, 0.26, 0, [1.0, 0.85, 0.2]);
  lb.box(0.5, 1.28, -0.37, 0.5, 0.09, 0.09, 0, [0.08, 0.08, 0.09]);
  botMesh = new THREE.InstancedMesh(lb.geometry(), botMat, MAX_BOTS);
  const one = new THREE.Color(1, 1, 1); for (let i = 0; i < MAX_BOTS; i++) botMesh.setColorAt(i, one);
  botMesh.count = 0; botMesh.frustumCulled = false; botMesh.layers.enable(1); scene.add(botMesh);
  const lg = new LitBuilder(); lg.box(0, -0.43, 0, 0.24, 0.86, 0.22, 0, dark); lg.box(0.05, -0.8, 0, 0.34, 0.14, 0.25, 0, [0.05, 0.05, 0.06]);
  const legGeo = lg.geometry();
  legL = new THREE.InstancedMesh(legGeo, botMat, MAX_BOTS); legR = new THREE.InstancedMesh(legGeo, botMat, MAX_BOTS);
  for (const l of [legL, legR]) { for (let i = 0; i < MAX_BOTS; i++) l.setColorAt(i, one); l.count = 0; l.frustumCulled = false; l.layers.enable(1); scene.add(l); }

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
let shooterWait = 0;
function startShooter(atDefault) {
  const S = shooter; audioInit();
  if (atDefault) { const [x, y] = ll(41.8822, -87.6246); player.x = x; player.y = y; player.yaw = 0; }
  if (!areaReady(player.x, player.y)) {            // streamed tiles not built yet: try again shortly
    shooterWait = 1; fpsMsg('Loading this neighbourhood…', 'The shooter starts as soon as the buildings around you are ready.', 0); return;
  }
  shooterWait = 0;
  const [sx, sy] = findStreet(player.x, player.y);
  player.x = sx; player.y = sy; player.alt = EYE; player.vx = player.vy = player.vz = 0; player.pitch = 0; player.mode = 'walk'; player.onGround = true;
  if (!S.on) { S.savedLabels = labelsOn; labelsOn = false; }
  Object.assign(S, { on: true, dead: false, firing: false, hp: 100, ammo: MAG, reload: 0, cool: 0, wave: 0, score: 0, kills: 0, waveT: 2.5, pending: true, lastHurt: -99, vig: 0 });
  S.bots.length = 0; gun.visible = true; document.body.classList.add('shooter');
  fpsMsg('Shooter mode', isTouch ? 'Hold Fire to shoot. Bots are on their way.' : 'Click to fire · right-click to aim · R to reload · G to quit', 2.4);
  refreshKeys();
}
function stopShooter() {
  const S = shooter; S.on = false; S.dead = false; S.firing = false; S.bots.length = 0; botMesh.count = legL.count = legR.count = 0; gun.visible = false; S.aim = false; S.ads = 0; camera.fov = FOV; camera.updateProjectionMatrix(); $('dmgDir').style.opacity = 0;
  document.body.classList.remove('shooter'); labelsOn = S.savedLabels; fpsMsg('', '', 0); $('vignette').style.opacity = 0; refreshKeys();
}
function hurtPlayer(d, fx, fy) {
  const S = shooter; if (S.dead) return;
  S.dmgT = 1; S.dmgX = fx; S.dmgY = fy;
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
  const spread = (0.005 + Math.min(0.03, Math.hypot(player.vx, player.vz) * 0.0016) + (player.onGround ? 0 : 0.02)) * (1 - 0.75 * S.ads);
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
  if (!target && tHit < 399) {                       // sparks where the round strikes
    const hx = ox + dx * (tHit - 0.3), hy = oy + dy * (tHit - 0.3), hz = oz + dz * (tHit - 0.3);
    for (let k = 0; k < 5; k++) tracer(hx, hy, hz, hx + (Math.random() - 0.5) * 0.9, hy + (Math.random() - 0.5) * 0.9, hz + Math.random() * 0.7, 1, 0.75, 0.35);
  }
  if (target) {
    target.hp -= head ? 100 : 34; target.flash = 1;
    $('cross').classList.add('hit'); clearTimeout(playerFire._h); playerFire._h = setTimeout(() => $('cross').classList.remove('hit'), 110);
    if (target.hp <= 0) { target.dead = 0.001; S.kills++; S.score += head ? 150 : 100; sfxTone(620, 0.12, 0.12, 'square', 930); }
    else sfxTone(1100, 0.04, 0.07);
  }
  const kick = 1 - 0.5 * S.ads;
  player.pitch = Math.min(1.5, player.pitch + 0.011 * kick); player.yaw += (Math.random() - 0.5) * 0.006 * kick;
}
const _lm = new THREE.Matrix4();
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
  S.ads += ((S.aim && !S.dead && S.reload <= 0 ? 1 : 0) - S.ads) * (1 - Math.exp(-dt * 14));
  const fov = FOV - 28 * S.ads; if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
  if (S.dmgT > 0) {
    S.dmgT = Math.max(0, S.dmgT - dt * 0.9);
    const el = $('dmgDir'); el.style.opacity = S.dmgT; el.style.transform = `rotate(${Math.atan2(S.dmgX - player.x, S.dmgY - player.y) + player.yaw}rad)`;
  }

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
    let hx = 0, hy = 0; const ox0 = b.x, oy0 = b.y;
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
    b.walk = (b.walk || 0) + Math.hypot(b.x - ox0, b.y - oy0) * 3.1;
    // unstick: if a bot has barely moved for a while, send it off in a fresh direction
    b.stT = (b.stT || 0) + dt;
    if (b.stT > 1.5) {
      if ((!b.los || dist > 38) && Math.hypot(b.x - (b.sx || 0), b.y - (b.sy || 0)) < 1.2) { const a = Math.random() * 6.283; b.dhx = Math.cos(a); b.dhy = Math.sin(a); b.detT = 1.2; b.side = -b.side; }
      b.stT = 0; b.sx = b.x; b.sy = b.y;
    }
    b.yaw = b.los ? Math.atan2(dy, dx) : (hx || hy) ? Math.atan2(hy, hx) : b.yaw;
    if (b.los && !S.dead) {
      b.cool -= dt;
      if (b.cool <= 0) { b.cool = 1.3 + Math.random() * 1.3; b.burst = 3; b.bt = 0; }
    }
    if (b.burst > 0 && !S.dead) {                   // three-round bursts
      b.bt -= dt;
      if (b.bt <= 0) {
        b.bt = 0.1; b.burst--;
        const p = clamp(0.5 - dist / 210, 0.05, 0.45) * (pspeed > 9 ? 0.55 : 1) * Math.min(1.25, 0.8 + S.wave * 0.05) * (b.los ? 1 : 0);
        const hit = Math.random() < p, gx = b.x + dx / dist * 0.7, gy = b.y + dy / dist * 0.7;
        if (hit) tracer(gx, gy, 1.3, player.x, player.y, player.alt - 0.35, 1, 0.3, 0.2);
        else { const o = (Math.random() < 0.5 ? -1 : 1) * (0.7 + Math.random() * 1.5); tracer(gx, gy, 1.3, player.x - dy / dist * o + dx / dist * 12, player.y + dx / dist * o + dy / dist * 12, player.alt - 0.3 + Math.random(), 1, 0.3, 0.2); }
        sfxShot(clamp(0.24 * (1 - dist / 170), 0.03, 0.24), 0.72);
        if (hit) hurtPlayer(Math.min(8, 4.5 + S.wave * 0.3), b.x, b.y);
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
    const sw = b.dead > 0 ? 0 : Math.sin(b.walk || 0) * 0.6;
    legL.setMatrixAt(n, _lm.makeRotationZ(sw).setPosition(0, 0.86, 0.15).premultiply(_bm));
    legR.setMatrixAt(n, _lm.makeRotationZ(-sw).setPosition(0, 0.86, -0.15).premultiply(_bm));
    const f = 1 + b.flash * 2.2; botMesh.setColorAt(n, _bc.setRGB(f, f, f)); n++;
  }
  legL.count = legR.count = n; legL.instanceMatrix.needsUpdate = legR.instanceMatrix.needsUpdate = true;
  botMesh.count = n; botMesh.instanceMatrix.needsUpdate = true; botMesh.instanceColor.needsUpdate = true;
  const rl = S.reload > 0 ? Math.sin((1 - S.reload / 1.4) * Math.PI) : 0, bob = Math.sin(S.t * 9) * Math.min(1, pspeed / 7) * 0.006;
  gun.position.set(0.17 * (1 - S.ads), -0.15 + 0.052 * S.ads - rl * 0.14 + bob * (1 - S.ads), -0.42 + 0.06 * S.ads + S.recoil * 0.03); gun.rotation.set(S.recoil * 0.05 - rl * 0.9, 0, rl * 0.3);
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
let bobT = 0;
function walkBob(dt) {
  if (player.mode !== 'walk' || !player.onGround) return;
  const sp = Math.hypot(player.vx, player.vz); if (sp < 0.6) return;
  const prev = bobT; bobT += sp * dt * 1.15;
  camera.position.y += Math.sin(bobT * 2) * 0.03 * Math.min(1, sp / 6);
  if (Math.floor(bobT / Math.PI) !== Math.floor(prev / Math.PI)) sfxShot(0.03, 0.22);      // footstep
}
function reloadGun() { const S = shooter; if (S.on && !S.dead && S.reload <= 0 && S.ammo < MAG) { S.reload = 1.4; sfxTone(240, 0.08, 0.08, 'square', 180); } }
function toggleShooter() { if (shooter.on && !shooter.dead) stopShooter(); else startShooter(false); }

// ───────────────────────────── boot ─────────────────────────────
function init() {
  buildGround();
  buildBuildings();
  buildTrees();
  buildEl();
  buildStreetLife();
  buildProps();
  buildLabels();
  initShooter();
  startMetro();
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
  U.uFog.value = tod.fog / (1 + Math.max(0, camera.position.y - 150) / 450);
  const near = clamp(camera.position.y * 0.0015, 0.3, 6); if (Math.abs(near - camera.near) > camera.near * 0.15) { camera.near = near; camera.updateProjectionMatrix(); }
  processMetroQueue();
  if (tick % 8 === 0) updateMetro();
  if (shooterWait && tick % 15 === 0 && areaReady(player.x, player.y)) startShooter(false);
  if (!started) {
    const a = time * 0.045 + 2.4;
    camera.position.set(Math.sin(a) * 2300 + 200, 640, Math.cos(a) * 2300 - 300);
    camera.lookAt(200, 120, -300);
  } else if (!mapOpen && $('start').classList.contains('hidden')) {
    if (!shooter.dead) { updatePlayer(dt); walkBob(dt); }
    checkDiscoveries();
    updateShooter(dt);
  }
  sky.position.copy(camera.position);
  updateTracers(dt);
  updateTrains(time);
  updateCars(dt);
  if (wheel) wheel.rotation.z = time * 0.12;
  if (jet) { const s = 26 + Math.sin(time * 2.3) * 3 + Math.sin(time * 7.1); jet.scale.set(1, s, 1); jet.material.opacity = 0.55 * (1 - 0.6 * tod.night); }
  renderShadow();
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
  if (dt > 0.045) { slow++; if (slow === 90 && renderer.getPixelRatio() > 1) { renderer.setPixelRatio(1); renderer.setSize(window.innerWidth, window.innerHeight, false); } if (slow === 260) U.uShadowOn.value = 0; } else if (slow > 0) slow--;
}

// let the start card paint before the heavy build
requestAnimationFrame(() => setTimeout(() => {
  try { init(); } catch (err) { $('loading').textContent = 'Could not start: ' + err.message; console.error(err); return; }
  window.__chi = { metro, MH, shooter, startShooter, player, renderer, toggleMap, placeAt, setMode, LANDMARKS, ll, cycleTime, begin };
  requestAnimationFrame(frame);
}, 30));
