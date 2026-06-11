// TERMINAL NOIR — CRT post pass (postprocessing custom Effect, CONVOLUTION).
// Barrel distortion → edge chromatic aberration → scanlines → rolling band
// → phosphor flicker → vignette. uTime is frozen under reduced motion and
// uFlicker is forced to 0, which yields a perfectly static composed frame.

uniform float uTime;
uniform float uFlicker;
uniform float uScanCount;
uniform float uScanIntensity;
uniform float uDistortion;
uniform float uAberration;
uniform float uVignette;

float trmHash(const in float n) {
  return fract(sin(n * 127.1) * 43758.5453123);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // Barrel distortion around the screen centre.
  vec2 cuv = uv * 2.0 - 1.0;
  float r2 = dot(cuv, cuv);
  vec2 duv = cuv * (1.0 + uDistortion * r2);
  vec2 suv = duv * 0.5 + 0.5;

  // Outside the tube: dead glass.
  if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) {
    outputColor = vec4(0.0, 0.0, 0.0, inputColor.a);
    return;
  }

  // Chromatic aberration, growing toward the edges only.
  vec2 shift = duv * r2 * uAberration;
  float cr = texture2D(inputBuffer, suv + shift).r;
  float cg = texture2D(inputBuffer, suv).g;
  float cb = texture2D(inputBuffer, suv - shift).b;
  vec3 col = vec3(cr, cg, cb);

  // Scanlines (count is set from viewport height on resize).
  float scan = 0.5 + 0.5 * sin(suv.y * uScanCount);
  col *= 1.0 - uScanIntensity * scan;

  // Slow rolling luminance band.
  float band = smoothstep(0.0, 0.4, abs(fract(suv.y * 0.35 + uTime * 0.05) - 0.5));
  col *= 0.965 + 0.035 * band;

  // Subtle phosphor flicker (0 under reduced motion).
  col *= 1.0 + uFlicker * (trmHash(floor(uTime * 24.0)) - 0.5);

  // Vignette + faint green phosphor lift in the centre.
  float vig = smoothstep(1.6, 0.25, r2);
  col *= mix(1.0, vig, uVignette);
  col += vec3(0.004, 0.012, 0.006) * vig;

  outputColor = vec4(col, inputColor.a);
}
