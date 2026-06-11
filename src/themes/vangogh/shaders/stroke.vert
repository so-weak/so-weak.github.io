// Instanced impasto brush strokes — a living Starry Night.
//
// Each instance is one short tapered stroke advected through a curl-noise
// flow field. Star knots inject vortices (strokes tighten into spirals
// around them), the cursor stirs the field like a brush through wet oil,
// the Konami vortex accelerates everything, and the supernova egg sends a
// shockwave through the paint. Field space: x in [-aspect, aspect], y in
// [-1, 1]; the final position is emitted directly in clip space.

attribute vec4 aSeed; // x,y: base position 0..1 — z: phase — w: palette mix
attribute vec4 aShape; // x: length jitter — y: width jitter — z: speed — w: ragged seed

uniform float uTime;
uniform float uAspect;
uniform float uSize; // base stroke length in field units
uniform float uCrawl; // crawl distance along the flow per cycle
uniform float uFlowScale; // noise frequency
uniform float uBiasAmt; // 0 = free swirl, 1 = horizontal wheat sweep
uniform float uSwirl; // star-vortex strength multiplier
uniform float uVortex; // Konami STARRY VORTEX envelope 0..1
uniform float uStirAmt; // cursor stir strength 0..1
uniform vec4 uStir; // x,y: cursor in field space — z,w: scaled velocity
uniform vec4 uNova; // x,y: nova in field space — z: progress — w: strength
uniform vec4 uStars[8]; // x,y: field pos — z: radius — w: strength
uniform float uStarAmt; // chapter star presence 0..1
uniform vec3 uColA; // deep base
uniform vec3 uColB; // swirl mid
uniform vec3 uColC; // rare bright
uniform vec3 uWarm; // star warmth

varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
varying float vSeed;
varying float vArc;

// 2D simplex noise — Ian McEwan, Ashima Arts (MIT).
vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec2 base = (aSeed.xy * 2.0 - 1.0) * vec2(uAspect * 1.08 + 0.1, 1.12);
  float t = uTime * (1.0 + uVortex * 1.7);

  // --- flow field: wandering curl angle + chapter bias -----------------------
  float ang = snoise(base * uFlowScale + vec2(t * 0.045, -t * 0.028)) * 6.28318;
  vec2 dir = vec2(cos(ang), sin(ang));
  vec2 lateral = normalize(vec2(dir.x >= 0.0 ? 1.0 : -1.0, 0.22 * sin(base.y * 3.1 + t * 0.1)));
  dir = normalize(mix(dir, lateral, uBiasAmt));

  // --- star knots: vortices tighten the paint around each one ----------------
  float glow = 0.0;
  for (int i = 0; i < 8; i++) {
    vec4 s = uStars[i];
    vec2 off = base - s.xy;
    float r = length(off) + 1e-4;
    float fall = exp(-(r * r) / (s.z * s.z));
    vec2 tang = vec2(-off.y, off.x) / r;
    float vstr = s.w * fall * uSwirl * (1.0 + uVortex * 2.4);
    dir += tang * vstr * 1.9 - (off / r) * vstr * (0.22 + uVortex * 0.55);
    glow += fall * s.w;
  }

  // --- cursor stirring the wet oil -------------------------------------------
  vec2 soff = base - uStir.xy;
  float sr2 = dot(soff, soff);
  float sfall = exp(-sr2 / 0.14);
  vec2 stang = vec2(-soff.y, soff.x) / (sqrt(sr2) + 1e-3);
  dir += (uStir.zw + stang * uStirAmt * 1.3) * sfall;

  dir = normalize(dir + vec2(1e-4, 0.0));

  // --- crawl along the flow: the advection illusion ---------------------------
  float cyc = fract(t * (0.045 + aShape.z * 0.05) + aSeed.z);
  float fade = smoothstep(0.0, 0.14, cyc) * (1.0 - smoothstep(0.82, 1.0, cyc));
  vec2 p = base + dir * (cyc - 0.5) * uCrawl;

  // --- supernova shockwave displaces and warms nearby paint -------------------
  if (uNova.w > 0.001) {
    vec2 noff = p - uNova.xy;
    float nr = length(noff) + 1e-4;
    float wave = exp(-pow((nr - uNova.z * 0.85) * 7.0, 2.0)) * (1.0 - uNova.z);
    p += (noff / nr) * wave * 0.1 * uNova.w;
    glow += wave * 2.4 * uNova.w;
  }

  // --- build the oriented quad -------------------------------------------------
  float len = uSize * (0.65 + aShape.x * 0.85) * (1.0 + glow * 0.12);
  float wid = len * (0.2 + aShape.y * 0.16);
  vec2 local = vec2(position.x * len, position.y * wid);
  vec2 world = p + vec2(local.x * dir.x - local.y * dir.y, local.x * dir.y + local.y * dir.x);
  gl_Position = vec4(world.x / uAspect, world.y, 0.0, 1.0);

  // --- mix the paint ------------------------------------------------------------
  float m = aSeed.w;
  vec3 col = mix(uColA, uColB, smoothstep(0.04, 0.78, m));
  col = mix(col, uColC, smoothstep(0.87, 0.985, m));
  col = mix(col, uWarm, clamp(glow * uStarAmt * 0.6, 0.0, 0.85));

  vUv = uv;
  vColor = col;
  vAlpha = fade * (0.62 + 0.38 * m);
  vSeed = aShape.w;
  vArc = (aSeed.z - 0.5) * 0.36;
}
