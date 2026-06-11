// 002 ADVECT — composite pass. The settled velocity field displaces a fine
// diagonal line pattern; dye glows through it teal → ember by intensity.

precision highp float;

varying vec2 vUv;

uniform sampler2D uField;
uniform float uTime;
uniform vec2 uResolution;

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec4 field = texture2D(uField, vUv);

  // Displace the pattern domain by the velocity field.
  vec2 p = vUv + field.xy * 0.085;
  float diag = (p.x * aspect + p.y) * 90.0 - uTime * 0.35;
  float stripe = smoothstep(0.62, 1.0, sin(diag) * 0.5 + 0.5);

  // Second, coarser set at the opposite angle for moiré depth.
  float diag2 = (p.x * aspect - p.y) * 24.0 + uTime * 0.12;
  float stripe2 = smoothstep(0.8, 1.0, sin(diag2) * 0.5 + 0.5);

  vec3 col = vec3(0.043, 0.043, 0.055);
  col += vec3(0.085, 0.09, 0.11) * stripe;
  col += vec3(0.05, 0.055, 0.07) * stripe2;

  // Dye: teal at low intensity, ember where it is dense, white-hot core
  // where the velocity is still high.
  float dye = clamp(field.z, 0.0, 2.2);
  vec3 dyeCol = mix(vec3(0.12, 0.75, 0.62), vec3(0.95, 0.45, 0.18), clamp(dye * 0.65, 0.0, 1.0));
  col += dyeCol * dye * 0.55;

  float speed = length(field.xy);
  col += vec3(1.0, 0.96, 0.9) * pow(min(speed * 0.45, 1.0), 3.0) * 0.5;

  // The dye also lifts the stripes it passes through.
  col += vec3(stripe) * dye * 0.12;

  float g = hash21(vUv * uResolution + fract(uTime) * 41.7);
  col += (g - 0.5) * 0.016;

  gl_FragColor = vec4(col, 1.0);
}
