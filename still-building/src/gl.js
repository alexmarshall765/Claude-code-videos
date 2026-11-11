/* =============================================================================
 *  STILL BUILDING — WebGL2 layer.
 *  1. Procedural shader plates (sky, ocean, plume, flag, planet ...) that scenes
 *     blit into the 2D canvas underneath / between their silhouettes.
 *  2. The post chain every frame goes through: bright pass → bloom → light
 *     shafts → anamorphic streak → grade → vignette → grain.
 *  Shaders work in the film's logical pixel space (1920×1080, y down) so scene
 *  code can hand them the same coordinates it draws with.
 * ========================================================================== */
'use strict';
const GLX = (() => {
  let gl, cv, quad, SC = 1;
  const progs = {}, fbos = {}, texs = {}, SRC = {};

  const VS = `#version 300 es
in vec2 a; out vec2 vUV;
void main(){ vUV = a*.5+.5; gl_Position = vec4(a,0.,1.); }`;

  const HEAD = `#version 300 es
precision highp float;
in vec2 vUV; out vec4 o;
uniform float T; uniform vec2 R;
#define PI 3.14159265
#define P (vec2(vUV.x, 1.-vUV.y)*R)
float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
const mat2 ROT = mat2(.8,-.6,.6,.8);
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*noise(p); p=ROT*p*2.02; a*=.5; } return s; }
float fbm3(vec2 p){ float a=.5,s=0.; for(int i=0;i<3;i++){ s+=a*noise(p); p=ROT*p*2.02; a*=.5; } return s; }
float luma(vec3 c){ return dot(c, vec3(.2126,.7152,.0722)); }
`;

  // ---------------------------------------------------------------------------
  // Plates
  // ---------------------------------------------------------------------------

  /* Sky: three-stop gradient, sun with glow, perspective cloud deck lit from the sun, stars. */
  SRC.sky = `
uniform vec3 c0, c1, c2, sc, cd, cb;
uniform vec2 sun, cv;
uniform float hy, ss, sg, cl, cs, ch, st, seed;
float cdens(vec2 p){
  float v = clamp((hy-p.y)/hy, 0., 1.);
  float persp = 1./(v*ch + .12);
  vec2 q = vec2((p.x-R.x*.5)*persp*.0012, persp*1.3)*cs + cv*T + seed;
  float d = fbm(q) + .25*fbm3(q*3.3+7.);
  return smoothstep(1.05-cl*.9, 1.42-cl*.9, d) * smoothstep(0., .05, v);
}
void main(){
  vec2 p = P;
  float v = clamp((hy-p.y)/hy, 0., 1.);
  vec3 col = mix(c2, c1, smoothstep(0., .42, v));
  col = mix(col, c0, smoothstep(.3, 1., v));
  float r = length(p - sun);
  float g = exp(-r/(ss*4.))*sg + exp(-r/(ss*13.))*sg*.3;
  float band = exp(-abs(p.y-hy)/90.) * exp(-abs(p.x-sun.x)/700.) * sg * .4;
  col += sc*(g + band);
  if (st > 0.) {
    vec2 gp = floor(p/2.5); float h = hash(gp+seed);
    float s = step(.9972, h) * (.55+.45*sin(T*2.3+h*90.)) * (.4 + 1.6*fract(h*37.));
    col += vec3(s)*st*smoothstep(.02,.5,v);
  }
  float dn = 0.;
  if (cl > 0.) {
    vec2 ld = normalize(sun - p + .001);
    dn = cdens(p);
    float dl = cdens(p + ld*30.);
    float lit = clamp((dn - dl)*2.6, 0., 1.);
    float prox = exp(-r/650.);
    vec3 cc = mix(cd, cb, clamp(lit + prox*.55*(1.-dn*.55), 0., 1.));
    cc += sc * prox * (1.-dn) * .6;
    col = mix(col, cc, dn*.94);
  }
  float disc = smoothstep(ss, ss*.82, r);
  col = mix(col, sc*1.5+.25, disc*(1.-dn*.8));
  o = vec4(col, 1.);
}`;

  /* Ocean: perspective swell below the horizon line, sky reflection, sun glitter path. */
  SRC.ocean = `
uniform vec3 deep, refl, sc, fog;
uniform vec2 sun;
uniform float hy, spd, cam, chop, glit, fogA;
void main(){
  vec2 p = P;
  if (p.y < hy) { o = vec4(0.); return; }
  float d = (p.y-hy)/(R.y-hy);
  float z = 1./(d + .016);
  vec2 w = vec2((p.x-R.x*.5)*z*.0034 + cam, z*2.3 - T*spd);
  float hA = fbm(w*vec2(.55,1.5)*chop);
  float hB = noise(w*vec2(2.6,8.)*chop + vec2(T*.45, T*.8));
  float hC = noise(w*vec2(8.,24.)*chop - vec2(T*.6, T*1.2));
  float slope = (hA-.5)*1.3 + (hB-.5)*.65 + (hC-.5)*.3;
  float fres = pow(1.-d, 2.2);
  vec3 col = mix(deep, refl, clamp(fres*.9 + slope*.3*(1.-fres) + .06, 0., 1.));
  col *= .82 + slope*.55;
  float gw = 26. + d*560.;
  float gx = (p.x-sun.x)/gw;
  float path = exp(-gx*gx);
  float spark = smoothstep(.12, .55, slope + .22*path);
  col += sc*path*spark*glit*(.3 + 1.7*pow(1.-d,1.4));
  col += sc*path*glit*.10;
  col = mix(col, fog, exp(-d*13.)*fogA);
  float edge = smoothstep(hy, hy+1.5, p.y);
  o = vec4(col*edge, edge);
}`;

  /* Fire and smoke plume. A jet from a nozzle at "src" pointing down, a ground cloud that
     spreads from "gy", and turbulent smoke lit orange from within. Premultiplied output. */
  SRC.plume = `
uniform vec2 src;        // nozzle position
uniform float gy;        // ground line (smoke spreads along it)
uniform float pw;        // power 0..1 (flame length / brightness)
uniform float spread;    // ground cloud half-width in px
uniform float rise;      // ground cloud height in px
uniform float jw;        // jet width px
uniform vec3 hot, smokeLit, smokeDark;
uniform float seed;
void main(){
  vec2 p = P;
  vec3 col = vec3(0.); float a = 0.;
  // ---- ground cloud
  if (spread > 1.) {
    vec2 q = vec2((p.x-src.x)/spread, (gy-p.y)/max(rise,1.));
    float t = T*.35;
    vec2 wq = q*vec2(2.6,1.9) + seed;
    float n = fbm(wq + vec2(sign(q.x)*-t, -t*.6) + .8*vec2(fbm3(wq*1.7+t), fbm3(wq*1.9-t)));
    float env = (1.-smoothstep(.45,1.,abs(q.x))) * smoothstep(-.08,.08,q.y) * (1.-smoothstep(.25,1.,q.y + abs(q.x)*.55));
    float dens = smoothstep(.34,.72, n*env*1.9 + env*.25);
    float heat = exp(-length(vec2(q.x*1.5, q.y*2.2))*2.2) * pw;
    vec3 sc_ = mix(smokeDark, smokeLit, clamp(n*1.3 - .2 + q.y*.6, 0., 1.));
    sc_ = mix(sc_, hot, clamp(heat*1.5,0.,1.));
    sc_ += hot*heat*1.2;
    col = sc_*dens; a = dens;
  }
  // ---- jet
  float len = max(gy - src.y, 1.);
  float u = (p.y - src.y)/len;
  if (u > -.02 && pw > 0.) {
    float wv = jw*(1. + u*2.2);
    float x = (p.x-src.x)/wv;
    float n = fbm3(vec2(x*1.6, u*5. - T*9.) + seed);
    float core = exp(-x*x*3.5) * smoothstep(-.02,.03,u) * (1.-smoothstep(.75,1.25,u*(1.1-pw*.2)));
    float fl = core*(.65 + .7*n)*pw;
    vec3 fc = mix(hot, vec3(1.), clamp(fl*1.3-.25,0.,1.));
    col = col*(1.-clamp(fl,0.,1.)) + fc*fl*1.6;
    a = max(a, clamp(fl*1.4,0.,1.));
  }
  o = vec4(col, a);
}`;

  /* Rising smoke / steam column drifting with the wind. Premultiplied. */
  SRC.smoke = `
uniform vec2 src; uniform float w0, grow, height, wind, dens, seed, spd;
uniform vec3 lit, dark, glowc; uniform float glowA;
void main(){
  vec2 p = P;
  float u = (src.y-p.y)/height;
  if (u < -.02 || u > 1.05) { o = vec4(0.); return; }
  float cx = src.x + wind*u*u*height;
  float wd = w0 + grow*u*height;
  float x = (p.x-cx)/wd;
  vec2 q = vec2(x*1.2, u*height/wd*.25 + 0.) ;
  float t = T*spd;
  float n = fbm(vec2(x*1.4 + seed, u*4.5 - t) + .7*fbm3(vec2(x*2.+t*.3, u*7.-t*1.3)+seed));
  float e = exp(-x*x*2.2) * smoothstep(-.02,.04,u) * (1.-smoothstep(.55,1.,u));
  float d = smoothstep(.3,.75, n*e*2.1 + e*.2) * dens;
  vec3 c = mix(dark, lit, clamp(n*1.4-.25 + x*.35, 0., 1.));
  c += glowc * glowA * exp(-u*5.);
  o = vec4(c*d, d);
}`;

  /* Waving flag. "tex" holds the flat flag artwork; the cloth is displaced and shaded by a
     travelling wave that grows from the hoist to the fly. Premultiplied output. */
  SRC.flag = `
uniform sampler2D tex;
uniform vec4 rect;       // x, y, w, h of the flag at rest
uniform float amp, back, spd, shade;
uniform vec3 tint;
void main(){
  vec2 p = P;
  vec2 q = (p - rect.xy)/rect.zw;
  float ph = q.x*7.5 - T*spd;
  float a = amp*(.25 + .75*q.x);
  // invert the displacement approximately (two fixed-point steps)
  vec2 uv = q;
  for (int i=0;i<3;i++){
    float w = sin(uv.x*7.5 - T*spd + uv.y*1.7) + .45*sin(uv.x*15. - T*spd*1.6 + uv.y*4. + 1.3);
    float ax = amp*(.25+.75*uv.x);
    uv = q - vec2(ax*.25*cos(uv.x*7.5 - T*spd)*uv.x, ax*w);
  }
  if (uv.x < 0. || uv.x > 1. || uv.y < 0. || uv.y > 1.) { o = vec4(0.); return; }
  float w = sin(uv.x*7.5 - T*spd + uv.y*1.7) + .45*sin(uv.x*15. - T*spd*1.6 + uv.y*4. + 1.3);
  float dw = cos(uv.x*7.5 - T*spd + uv.y*1.7) + .9*cos(uv.x*15. - T*spd*1.6 + uv.y*4. + 1.3);
  vec3 c = texture(tex, vec2(uv.x, 1.-uv.y)).rgb;
  float sh = 1. + dw*shade*(.3+.7*uv.x);
  c *= sh;
  c = mix(c, c*tint*1.9, back);                 // translucent, sun behind the cloth
  c += tint*back*.25*max(dw,0.)*(.3+.7*uv.x);
  float e = smoothstep(0.,.004,uv.x)*smoothstep(1.,.996,uv.x)*smoothstep(0.,.006,uv.y)*smoothstep(1.,.994,uv.y);
  o = vec4(c*e, e);
}`;

  /* Planet: an orthographic sphere textured from an equirectangular map (land mask in r,
     city lights in g), with ocean, clouds, atmosphere rim, terminator and night lights. */
  SRC.planet = `
uniform sampler2D map;
uniform vec2 ctr; uniform float rad;
uniform float lon0, lat0;      // sub-camera point (radians)
uniform vec3 sunDir;           // in view space (x right, y up, z toward camera)
uniform float cloudA, lightsA, roll, atmoA;
uniform float seed;
mat3 rotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
mat3 rotX(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
void main(){
  vec2 p = P;
  vec2 d = (p-ctr)/rad; d.y = -d.y;
  float cr = cos(roll), sr = sin(roll);
  d = vec2(d.x*cr - d.y*sr, d.x*sr + d.y*cr);
  float r2 = dot(d,d);
  vec3 col = vec3(0.); float a = 0.;
  vec3 sd = normalize(sunDir);
  if (r2 < 1.) {
    vec3 n = vec3(d, sqrt(1.-r2));
    vec3 w = rotY(lon0) * (rotX(-lat0) * n);
    float lat = asin(clamp(w.y,-1.,1.)), lon = atan(w.x, w.z);
    vec2 uv = vec2(lon/(2.*PI)+.5, lat/PI+.5);
    vec4 m = texture(map, uv);
    float land = smoothstep(.35,.65,m.r);
    float nl = dot(n, sd);
    float day = smoothstep(-.12, .22, nl);
    vec2 sp = uv*vec2(2.,1.);
    float relief = fbm(sp*60.+seed);
    float veg = fbm3(sp*14.+3.);
    float arid = smoothstep(.42,.6, fbm3(sp*7.+11.) + .25*cos(lat*2.)-.1);
    vec3 landc = mix(vec3(.10,.22,.07), vec3(.36,.30,.17), arid);
    landc = mix(landc, vec3(.9,.92,.95), smoothstep(1.02,1.2,abs(lat)+relief*.15));
    landc *= .65 + relief*.7;
    vec3 sea = mix(vec3(.012,.05,.16), vec3(.03,.13,.3), veg) ;
    vec3 surf = mix(sea, landc, land);
    vec3 hv = normalize(sd + vec3(0.,0.,1.));
    surf += (1.-land)*pow(max(dot(n,hv),0.),60.)*vec3(1.,.85,.6)*.55;
    // clouds
    vec2 cq = sp*vec2(9.,11.) + vec2(T*.004, 0.) + seed;
    float cn = fbm(cq + .9*vec2(fbm3(cq*1.3), fbm3(cq*1.3+5.)));
    float cdn = smoothstep(.5,.78,cn)*cloudA;
    vec3 lit = mix(surf, vec3(1.), cdn) * (max(nl,0.)*1.15 + .03);
    // sunset band along the terminator
    lit += vec3(1.,.42,.15) * smoothstep(.25,0.,abs(nl-.04)) * .16 * (.4+cdn);
    // night side: city lights
    float city = m.g;
    vec3 night = vec3(1.,.74,.38) * city * lightsA * (1.-cdn*.7) * (1.-day);
    night += surf*.035*(1.-day);
    col = lit*day + night;
    // atmosphere (inside limb)
    float rim = pow(1.-n.z, 3.2);
    col += vec3(.25,.5,1.)*rim*(day*.9+.06)*atmoA;
    a = 1.;
  }
  // atmosphere halo outside the limb
  float rr = sqrt(r2);
  float halo = exp(-max(rr-1.,0.)*55.) * step(1., rr);
  vec3 nh = normalize(vec3(d/max(rr,1e-4), 0.));
  float hl = smoothstep(-.35,.5,dot(nh, sd));
  col += vec3(.3,.55,1.)*halo*(hl*.9+.04)*atmoA;
  a = max(a, halo*(hl*.9+.04)*atmoA);
  float aa = smoothstep(1.+2./rad, 1.-1./rad, rr);
  a = max(a*step(1.,rr), aa);
  o = vec4(col, a);
}`;

  /* Lunar surface: cratered grey regolith under raking light, with a curved horizon. */
  SRC.lunar = `
uniform float hy, curve, scl, seed, cam;
uniform vec2 light;     // light direction in the surface plane
uniform float bright;
float crater(vec2 p, float s){
  vec2 i = floor(p), f = fract(p) - .5; float h = 0.;
  for (int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
    vec2 g = vec2(float(x),float(y));
    vec2 c = g + vec2(hash(i+g+s), hash(i+g+s+7.3))*.8 - .4;
    float rad = .12 + .3*hash(i+g+s+3.1);
    float d = length(f-c)/rad;
    h += (smoothstep(1.25,1.,d)*.5 - smoothstep(1.,.2,d)) * rad * step(.35, hash(i+g+s+9.));
  }
  return h;
}
float height(vec2 w){
  return crater(w*.5,seed)*1.6 + crater(w*1.3,seed+3.)*.7 + crater(w*3.4,seed+5.)*.3 + fbm(w*2.)*.5 + fbm3(w*9.)*.08;
}
void main(){
  vec2 p = P;
  float yh = hy + curve*pow((p.x-R.x*.5)/R.x, 2.)*4.;
  if (p.y < yh) { o = vec4(0.); return; }
  float d = (p.y-yh)/(R.y-hy);
  float z = 1./(d + .02);
  vec2 w = vec2((p.x-R.x*.5)*z*.004 + cam, z*2.) * scl;
  float e = .015*z*scl*.15 + .01;
  float h0 = height(w);
  float sl = (height(w + light*e) - h0)/e;
  float sh = clamp(.5 - sl*.55, 0., 1.);
  float alb = .55 + .3*fbm3(w*1.7+4.) + .1*noise(w*40.);
  vec3 col = vec3(.78,.76,.72) * alb * sh * bright;
  col *= mix(.5, 1.15, smoothstep(0., .5, d));
  float edge = smoothstep(yh, yh+1.5, p.y);
  o = vec4(col*edge, edge);
}`;

  /* Volumetric light beams from a window bank (interiors). Premultiplied additive-ish. */
  SRC.beams = `
uniform vec2 src; uniform float ang, wid, len, dens, seed, n;
uniform vec3 col;
void main(){
  vec2 p = P; vec2 d = p - src;
  float ca = cos(ang), sa = sin(ang);
  float along = d.x*ca + d.y*sa, across = -d.x*sa + d.y*ca;
  float u = along/len;
  if (u < 0. || u > 1.) { o = vec4(0.); return; }
  float spread = wid*(1.+u*.9);
  float x = across/spread;
  float stripes = 0.;
  for (float i=0.; i<8.; i++) {
    if (i >= n) break;
    float c = (i - (n-1.)*.5) * 2.2/n;
    stripes += smoothstep(.11,.0,abs(x-c)-.05);
  }
  float dust = .55 + .6*fbm(vec2(across*.006, along*.004 - T*.05) + seed);
  float a = stripes * dust * dens * smoothstep(0.,.05,u) * pow(1.-u, 1.3);
  o = vec4(col*a, a*.0);
}`;

  // ---------------------------------------------------------------------------
  // Post chain
  // ---------------------------------------------------------------------------
  SRC.bright = `
uniform sampler2D src; uniform float th;
void main(){
  vec2 px = 1./vec2(textureSize(src,0));
  vec3 c = vec3(0.);
  c += texture(src, vUV + px*vec2(-1.,-1.)).rgb; c += texture(src, vUV + px*vec2(1.,-1.)).rgb;
  c += texture(src, vUV + px*vec2(-1., 1.)).rgb; c += texture(src, vUV + px*vec2(1., 1.)).rgb;
  c *= .25;
  float l = max(c.r, max(c.g, c.b));
  o = vec4(c*smoothstep(th, th+.28, l), 1.);
}`;
  SRC.blur = `
uniform sampler2D src; uniform vec2 dir;
void main(){
  vec2 px = dir/vec2(textureSize(src,0));
  vec3 c = texture(src, vUV).rgb*.2270270;
  c += (texture(src, vUV+px*1.3846).rgb + texture(src, vUV-px*1.3846).rgb)*.3162162;
  c += (texture(src, vUV+px*3.2308).rgb + texture(src, vUV-px*3.2308).rgb)*.0702703;
  o = vec4(c,1.);
}`;
  SRC.rays = `
uniform sampler2D src; uniform vec2 sun; uniform float dens, decay;
void main(){
  vec2 s = vec2(sun.x/R.x, 1.-sun.y/R.y);
  const int N = 56;
  vec2 dl = (vUV - s)*dens/float(N);
  float j = hash(vUV*R + T*60.);
  vec2 q = vUV - dl*j;
  vec3 acc = vec3(0.); float w = 1.;
  for (int i=0;i<N;i++){ q -= dl; acc += texture(src, q).rgb*w; w *= decay; }
  o = vec4(acc/float(N)*1.7, 1.);
}`;
  SRC.grade = `
uniform sampler2D src, b1, b2, ry, st;
uniform float bloom, rays, streak, expo, con, sat, vig, ca;
uniform vec3 shadow, high, rayc, lift;
vec3 shoulder(vec3 c){ vec3 k = max(c-.72, 0.); return min(c, vec3(.72)) + .28*(1.-exp(-k/.28)); }
void main(){
  vec2 uv = vUV;
  vec2 cc = uv-.5;
  vec3 c;
  c.r = texture(src, uv + cc*ca).r;
  c.g = texture(src, uv).g;
  c.b = texture(src, uv - cc*ca).b;
  vec3 bl = texture(b1, uv).rgb*.55 + texture(b2, uv).rgb*.75;
  c += bl*bloom;
  c += texture(ry, uv).rgb*rayc*rays;
  c += texture(st, uv).rgb*vec3(.55,.75,1.)*streak;
  c *= expo;
  c = shoulder(max(c, 0.));                       // filmic highlight roll-off, keeps hue in the sun
  float l = luma(c);
  c = mix(vec3(l), c, sat);
  c = clamp(c, 0., 1.);
  c = mix(c, c*c*(3.-2.*c), con);
  l = luma(c);
  c += (shadow-.5)*.28*(1.-l)*(1.-l) + (high-.5)*.3*l*l;
  c = max(c, 0.) + lift;
  float v = length(cc*vec2(1.15,1.));
  c *= mix(1., smoothstep(.98,.28,v), vig);
  o = vec4(max(c,0.), 1.);
}`;
  SRC.present = `
uniform sampler2D A, B, txt;
uniform float mixk, fade, flash, grain, useB;
void main(){
  vec3 c = texture(A, vUV).rgb;
  if (useB > .5) c = mix(texture(B, vUV).rgb, c, mixk);
  c = c*fade + vec3(1.,.97,.9)*flash;
  vec4 t = texture(txt, vUV);
  c = c*(1.-t.a) + t.rgb;
  vec2 p = vUV*R;
  float g = hash(floor(p*.8) + fract(T*7.31)*371.) + hash(floor(p*.8)*1.7 + fract(T*3.17)*113.) - 1.;
  float l = luma(c);
  c += g*grain*(.35 + .9*(1.-l));
  o = vec4(c, 1.);
}`;
  SRC.copy = `uniform sampler2D src; void main(){ o = texture(src, vUV); }`;

  // ---------------------------------------------------------------------------
  // Plumbing
  // ---------------------------------------------------------------------------
  function init(canvas, scale) {
    cv = canvas; SC = scale;
    cv.width = Math.round(W * SC); cv.height = Math.round(H * SC);
    gl = cv.getContext('webgl2', { premultipliedAlpha: true, alpha: true, preserveDrawingBuffer: true, antialias: false });
    if (!gl) throw new Error('WebGL2 unavailable');
    quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
  }
  function prog(name) {
    if (progs[name]) return progs[name];
    const mk = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error(`shader ${name}: ${gl.getShaderInfoLog(s)}`);
      }
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, HEAD + SRC[name]));
    gl.bindAttribLocation(p, 0, 'a');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`link ${name}: ${gl.getProgramInfoLog(p)}`);
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const inf = gl.getActiveUniform(p, i);
      u[inf.name] = { loc: gl.getUniformLocation(p, inf.name), type: inf.type };
    }
    return (progs[name] = { p, u });
  }
  function fbo(name, w, h) {
    const k = fbos[name];
    if (k && k.w === w && k.h === h) return k;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return (fbos[name] = { fb, tex, w, h });
  }
  /** Upload a canvas (or image) into a named texture. */
  function tex(name, source, repeatX = false) {
    let t = texs[name];
    if (!t) {
      t = texs[name] = { tex: gl.createTexture() };
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeatX ? gl.REPEAT : gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    return t;
  }
  /** Run a fullscreen pass. target: fbo object, or null for the canvas (optionally a sub-viewport). */
  function pass(name, uni, target, vp) {
    const pr = prog(name);
    gl.useProgram(pr.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    if (target) gl.viewport(0, 0, target.w, target.h);
    else if (vp) gl.viewport(vp[0], vp[1], vp[2], vp[3]);
    else gl.viewport(0, 0, cv.width, cv.height);
    let unit = 0;
    const all = Object.assign({ R: [W, H], T: 0 }, uni);
    for (const k in all) {
      const u = pr.u[k]; if (!u) continue;
      const v = all[k];
      if (v && v.tex) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, v.tex); gl.uniform1i(u.loc, unit++); }
      else if (typeof v === 'number') gl.uniform1f(u.loc, v);
      else if (v.length === 2) gl.uniform2fv(u.loc, v);
      else if (v.length === 3) gl.uniform3fv(u.loc, v);
      else if (v.length === 4) gl.uniform4fv(u.loc, v);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  /** Render a plate and blit it into a 2D context (logical coordinates). res < 1 renders smaller and upscales. */
  function plate(g, name, uni, { res = 0.5, op = 'source-over', alpha = 1 } = {}) {
    const w = Math.max(2, Math.round(cv.width * res)), h = Math.max(2, Math.round(cv.height * res));
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.enable(gl.SCISSOR_TEST); gl.scissor(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.SCISSOR_TEST);
    pass(name, uni, null, [0, 0, w, h]);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = op; g.globalAlpha = alpha;
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(cv, 0, cv.height - h, w, h, 0, 0, g.canvas.width, g.canvas.height);
    g.restore();
  }

  const POST_DEFAULT = {
    sun: [W / 2, H / 2], rays: 0, rayc: [1, 0.9, 0.75], rayDens: 0.85, rayDecay: 0.972,
    bloom: 0.45, th: 0.7, streak: 0.0, expo: 1, con: 0.35, sat: 1.05, vig: 0.55, ca: 0.0018,
    shadow: [0.46, 0.5, 0.58], high: [0.56, 0.52, 0.44], lift: [0, 0, 0],
  };
  /** Scene canvas → graded frame in fbo `dst`. */
  function post(sceneCanvas, P, dst, t) {
    const p = Object.assign({}, POST_DEFAULT, P);
    const s = tex('scene', sceneCanvas);
    const qw = Math.round(cv.width / 4), qh = Math.round(cv.height / 4);
    const A = fbo('qA', qw, qh), B = fbo('qB', qw, qh), C = fbo('qC', qw, qh);
    const E1 = fbo('eA', qw >> 1, qh >> 1), E2 = fbo('eB', qw >> 1, qh >> 1);
    const RY = fbo('ry', qw, qh), S1 = fbo('sA', qw >> 1, qh >> 1), S2 = fbo('sB', qw >> 1, qh >> 1);
    pass('bright', { src: s, th: p.th }, A);
    pass('blur', { src: A, dir: [1.2, 0] }, B);
    pass('blur', { src: B, dir: [0, 1.2] }, C);             // small bloom (C)
    pass('blur', { src: C, dir: [2.2, 0] }, E1);
    pass('blur', { src: E1, dir: [0, 2.2] }, E2);
    pass('blur', { src: E2, dir: [3.2, 0] }, E1);
    pass('blur', { src: E1, dir: [0, 3.2] }, E2);           // wide bloom (E2)
    if (p.rays > 0) pass('rays', { src: A, sun: p.sun, dens: p.rayDens, decay: p.rayDecay, T: t }, RY);
    else { gl.bindFramebuffer(gl.FRAMEBUFFER, RY.fb); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
    if (p.streak > 0) {
      pass('blur', { src: C, dir: [6, 0] }, S1);
      pass('blur', { src: S1, dir: [14, 0] }, S2);
      pass('blur', { src: S2, dir: [26, 0] }, S1);
    } else { gl.bindFramebuffer(gl.FRAMEBUFFER, S1.fb); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
    pass('grade', {
      src: s, b1: C, b2: E2, ry: RY, st: S1, bloom: p.bloom, rays: p.rays, rayc: p.rayc, streak: p.streak,
      expo: p.expo, con: p.con, sat: p.sat, vig: p.vig, ca: p.ca, shadow: p.shadow, high: p.high, lift: p.lift,
    }, dst);
  }
  function present(A, B, textCanvas, o, t) {
    const tx = tex('text', textCanvas);
    pass('present', {
      A, B: B || A, txt: tx, useB: B ? 1 : 0, mixk: o.mix === undefined ? 1 : o.mix,
      fade: o.fade === undefined ? 1 : o.fade, flash: o.flash || 0, grain: o.grain === undefined ? 0.05 : o.grain, T: t,
    }, null);
  }
  const full = name => fbo(name, cv.width, cv.height);
  return { init, pass, plate, tex, fbo, full, post, present, get gl() { return gl; }, SRC };
})();
