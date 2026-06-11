// 004 DAWN — domain-warped fbm gradient field, cycling cosine palette,
// hash-dithered grain. fbm(p + 3.6*fbm(p + 3.6*fbm(p))) — the classic
// Quilez construction, tuned for slow atmospheric drift.

precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform float uPhase;
uniform float uWarp;
uniform vec2 uResolution;
uniform vec2 uCursor;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p = r * p * 2.02;
    a *= 0.5;
  }
  return v;
}

vec3 palette(float t) {
  // IQ cosine palette — dawn set: plum shadows, rose mids, amber highs.
  vec3 a = vec3(0.52, 0.42, 0.47);
  vec3 b = vec3(0.45, 0.34, 0.36);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.02, 0.16, 0.40);
  return a + b * cos(6.28318 * (c * t + d + uPhase));
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = vec2(vUv.x * aspect, vUv.y) * 1.7;
  p += uCursor * 0.35;
  float t = uTime * 0.05;

  vec2 q = vec2(fbm(p + vec2(0.0, 0.0)), fbm(p + vec2(5.2, 1.3)));
  vec2 r = vec2(
    fbm(p + 3.6 * q * uWarp + vec2(1.7, 9.2) + t * 1.4),
    fbm(p + 3.6 * q * uWarp + vec2(8.3, 2.8) + t)
  );
  float f = fbm(p + 3.2 * r * uWarp);

  vec3 col = palette(f * 1.15 + q.x * 0.25);
  // Light follows the second warp layer — gives the field its weather.
  col *= 0.62 + 0.55 * smoothstep(0.2, 0.85, r.x);
  col = mix(col, col * vec3(1.06, 0.98, 0.9), q.y * 0.5);

  // Horizon weighting: darker floor, brighter sky line.
  col *= 0.78 + 0.3 * smoothstep(0.0, 0.85, vUv.y);

  // Dithered grain — break banding, add tooth.
  float g = hash21(vUv * uResolution + fract(uTime) * 113.1);
  col += (g - 0.5) * 0.045;

  gl_FragColor = vec4(col, 1.0);
}
