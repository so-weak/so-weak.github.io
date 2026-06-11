// Ambient index field — a barely-there drifting fbm band behind the list.
// uMood shifts the tint as rows are hovered (0..1 across the index).

precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uCursor;
uniform float uMood;

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
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
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = r * p * 2.03;
    a *= 0.5;
  }
  return v;
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = vec2(vUv.x * aspect, vUv.y);
  float t = uTime * 0.045;

  float warp = fbm(p * 2.1 - t * 0.7);
  float n = fbm(p * 1.5 + vec2(t, -t * 0.55) + warp * 0.65);

  // Emphasise a wide horizontal band through the middle of the page.
  float band = smoothstep(0.02, 0.42, vUv.y) * smoothstep(0.98, 0.55, vUv.y);

  vec3 base = vec3(0.043, 0.043, 0.055); // #0b0b0e
  vec3 tintA = vec3(0.18, 0.62, 0.50);   // signal teal
  vec3 tintB = vec3(0.82, 0.46, 0.24);   // ember
  vec3 tintC = vec3(0.46, 0.38, 0.88);   // violet
  vec3 tint = uMood < 0.5
    ? mix(tintA, tintB, uMood * 2.0)
    : mix(tintB, tintC, (uMood - 0.5) * 2.0);

  float glow = pow(n, 3.2) * band * 0.42;
  vec3 col = base + tint * glow;

  // Faint halo trailing the pointer.
  vec2 c = vec2((uCursor.x * 0.5 + 0.5) * aspect, uCursor.y * 0.5 + 0.5);
  float d = distance(p, c);
  col += tint * exp(-d * d * 9.0) * 0.05;

  // Grain keeps the gradients from banding on the dark end.
  float g = hash21(vUv * uResolution + fract(uTime) * 61.7);
  col += (g - 0.5) * 0.014;

  gl_FragColor = vec4(col, 1.0);
}
