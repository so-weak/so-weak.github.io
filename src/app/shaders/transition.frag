// Theme-agnostic transition wipe: an fbm-noise dissolve with a soft
// threshold edge over near-black (#0a0a0c), plus a whisper of film grain.
// uProgress 0 → fully transparent, 1 → fully covered.

precision highp float;

varying vec2 vUv;

uniform float uProgress;
uniform float uTime;
uniform vec2 uResolution;

// --- hash / value noise / fbm -------------------------------------------

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
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
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amplitude * valueNoise(p);
    p = p * 2.03 + vec2(13.7, 7.3);
    amplitude *= 0.5;
  }
  return value;
}

// -------------------------------------------------------------------------

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = vUv * vec2(aspect, 1.0) * 3.5;

  // Slowly drifting organic field, biased slightly by vertical position so
  // the wipe reads as directional without being a hard line.
  float n = fbm(p + uTime * 0.06) * 0.85 + vUv.y * 0.15;

  // Dissolve threshold sweeps past the noise range with a soft edge.
  float threshold = mix(1.15, -0.2, uProgress);
  float coverage = smoothstep(threshold, threshold + 0.16, n);

  // Film grain, time-jittered per pixel.
  float grain = (hash21(vUv * uResolution + fract(uTime) * 61.7) - 0.5) * 0.045;

  vec3 color = vec3(0.0392, 0.0392, 0.0471) + grain; // #0a0a0c + grain

  gl_FragColor = vec4(color, coverage);
}
