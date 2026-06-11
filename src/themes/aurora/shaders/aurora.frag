/**
 * Aurora Glass — dawn-sky gradient mesh.
 * Domain-warped fbm blends four pastels over a near-white base.
 * Very slow drift; the cursor adds a gentle local warp + brightening;
 * grain is dithered in to avoid banding on the long soft ramps.
 */

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uCursor;          // ndc, -1..1, y up
uniform float uCursorStrength; // damped on the CPU
uniform float uExcite;         // project-card hover nudge
uniform float uScroll;         // 0..1 page progress
uniform float uStarT;          // shooting star: 0 inactive, else 0..1 progress
uniform float uStarSeed;       // randomizes the streak's path per shot
uniform float uVideoMix;       // generated dawn-sky underlay opacity (0 = off)
uniform sampler2D uVideo;      // generated dawn-sky clip (black placeholder when absent)
uniform vec3 uBase;
uniform vec3 uLav;
uniform vec3 uBlush;
uniform vec3 uMint;
uniform vec3 uSky;

varying vec2 vUv;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p = rot * p * 2.02;
    a *= 0.5;
  }
  return v;
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = vec2(vUv.x * aspect, vUv.y);
  float t = uTime * 0.02;

  // Cursor in the same aspect-corrected space.
  vec2 cur = vec2((uCursor.x * 0.5 + 0.5) * aspect, uCursor.y * 0.5 + 0.5);
  vec2 toCur = p - cur;
  float cd = length(toCur);
  float cw = exp(-cd * cd * 5.0) * uCursorStrength;
  vec2 curDir = toCur / max(cd, 1e-3);

  // Two-stage domain warp, drifting very slowly.
  vec2 q = vec2(
    fbm(p * 1.35 + vec2(t, -t * 0.7)),
    fbm(p * 1.35 + vec2(-t * 0.6, t * 1.1) + 3.7)
  );
  vec2 w = p + 0.85 * q + curDir * cw * 0.22;
  vec2 r = vec2(
    fbm(w * 1.1 + vec2(1.7, 9.2) + t * 0.5),
    fbm(w * 1.1 + vec2(8.3, 2.8) - t * 0.4)
  );

  float fLav = smoothstep(0.28, 0.88, fbm(w * 1.25 + r * 1.2 + uScroll * 0.7));
  float fBlush = smoothstep(0.24, 0.92, fbm(w * 1.6 - r + 4.2 - uScroll * 0.4));
  float fMint = smoothstep(0.32, 0.95, fbm(w * 0.95 + r * 1.6 + 9.1));
  float fSky = smoothstep(0.22, 0.9, fbm(w * 1.15 + vec2(-2.2, 5.5) - t));

  vec3 col = uBase;
  col = mix(col, uSky, fSky * 0.55);
  col = mix(col, uMint, fMint * 0.42);
  col = mix(col, uBlush, fBlush * 0.5);
  col = mix(col, uLav, fLav * 0.58);

  // Generated dawn-sky underlay (manifest-driven): screen-blended at low
  // opacity so the clip glows through the fbm field; a black placeholder
  // sampler screens to a no-op, so the branch is safe when media is absent.
  if (uVideoMix > 0.001) {
    vec3 sky = texture2D(uVideo, vUv).rgb;
    vec3 screened = 1.0 - (1.0 - col) * (1.0 - sky);
    col = mix(col, screened, uVideoMix);
  }

  // Dawn lift — the sky pales toward the top of the frame.
  col = mix(col, uBase, smoothstep(0.45, 1.08, vUv.y) * 0.38);

  // Gentle local brightening under the cursor; hover-nudge shimmer.
  col += cw * 0.085;
  col += uExcite * 0.045 * (fLav + fBlush) * 0.5;

  // Shooting star (full-moon easter egg): a bright head sliding along a
  // shallow diagonal with a soft trail, eased in/out over the shot.
  if (uStarT > 0.0) {
    vec2 origin = vec2(
      aspect * (0.08 + uStarSeed * 0.3),
      0.9 - uStarSeed * 0.14
    );
    vec2 dir = normalize(vec2(0.86, -0.36));
    float len = 0.62 * max(aspect, 1.0);
    float headAlong = len * uStarT;
    vec2 rel = p - origin;
    float along = clamp(dot(rel, dir), 0.0, headAlong);
    float dPerp = length(rel - dir * along);
    float fade = sin(3.14159 * uStarT);
    float trail = smoothstep(headAlong - 0.26, headAlong, along);
    float streak = exp(-dPerp * dPerp * 2400.0) * trail * fade;
    vec2 toHead = rel - dir * headAlong;
    float headGlow = exp(-dot(toHead, toHead) * 900.0) * fade;
    col += (streak * 0.8 + headGlow * 0.5) * vec3(1.0, 0.97, 0.9);
  }

  // Dithered grain — kills banding on the pastel ramps.
  float g = hash21(vUv * uResolution + fract(uTime) * 61.7) - 0.5;
  col += g * 0.012;

  gl_FragColor = vec4(col, 1.0);
}
