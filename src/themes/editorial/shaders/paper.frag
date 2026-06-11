// Editorial paper effect (postprocessing Effect snippet).
// Adds: static fibre mottle, faint laid-paper lines, animated print grain,
// the cursor ink-bleed dye field, and a soft page vignette.
uniform sampler2D uInk;
uniform float uTime;
uniform float uGrainAmp;
uniform float uInkAmount;
uniform vec3 uInkColor;
uniform vec2 uPx;

float edHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float edNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = edHash(i);
  float b = edHash(i + vec2(1.0, 0.0));
  float c = edHash(i + vec2(0.0, 1.0));
  float d = edHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 col = inputColor.rgb;
  vec2 px = uv * uPx;

  // Paper fibre mottle — three octaves for rougher aged stock.
  float fibre = edNoise(px * 0.011) * 0.55 + edNoise(px * 0.047) * 0.30 + edNoise(px * 0.12) * 0.15;
  col += (fibre - 0.5) * 0.042;

  // Laid lines — visible in aged newsprint, like chain lines in antique stock.
  col -= smoothstep(0.88, 1.0, sin(px.y * 0.78) * 0.5 + 0.5) * 0.016;
  // Faint cross-laid (wire lines at 90°) for rough newsprint texture.
  col -= smoothstep(0.94, 1.0, sin(px.x * 0.92) * 0.5 + 0.5) * 0.006;

  // Animated print grain.
  float g = edHash(px + vec2(fract(uTime * 7.13) * 911.7, fract(uTime * 3.77) * 433.3));
  col += (g - 0.5) * uGrainAmp;

  // Ink dye — soft body with a slightly darker soaking ring at the edge.
  float dye = texture2D(uInk, uv).r;
  float body = smoothstep(0.015, 0.85, dye);
  float ring = body * (1.0 - body) * 4.0;
  float soak = clamp(body * 0.8 + ring * 0.45, 0.0, 1.0) * uInkAmount;
  col = mix(col, uInkColor, soak);

  // Page vignette, biased slightly upward like light over a desk.
  float v = distance(uv, vec2(0.5, 0.46));
  col *= 1.0 - v * v * 0.21;

  outputColor = vec4(col, inputColor.a);
}
