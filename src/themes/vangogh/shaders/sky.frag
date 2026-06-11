// The sky of the retrospective — underpainting + glaze in one pass.
//
// LAYER 0 — UNDERPAINTING: the generated Higgsfield paint clip (or its
// poster frame on mobile/reduced motion) sampled through a DAWN-style
// domain-warped fbm field, so the footage churns far beyond its 4-second
// loop, then palette-graded toward the active scroll chapter.
// LAYER 1 — GLAZE: the same warp field drives a procedural prussian/cyan
// fbm glaze with rare chrome-yellow blooms; the two layers interleave along
// the swirl bands so video and procedural fuse into one painted sky.
// Hash-dithered grain breaks banding and gives the ramps tooth. When uMix
// is 0 (manifest ok:false / clip missing) the glaze carries the sky alone.

precision highp float;

uniform sampler2D uMap;    // generated clip or poster (deep-blue placeholder when absent)
uniform float uMix;        // underpainting prominence 0..1 (0 = layer off)
uniform float uMediaAspect;// aspect of the bound media (w / h)
uniform float uTime;
uniform float uAspect;     // viewport aspect (w / h)
uniform vec2 uResolution;  // physical pixels, for the dither grain
uniform vec4 uStir;        // x,y: cursor in field space — z,w: scaled velocity
uniform float uStirAmt;    // cursor stir strength 0..1
uniform float uVortex;     // Konami STARRY VORTEX envelope 0..1
uniform vec3 uBg;          // chapter ground (deep prussian night → wheat umber…)
uniform vec3 uColA;        // chapter deep
uniform vec3 uColB;        // chapter swirl mid (cyan / ochre / café gold)
uniform vec3 uColC;        // chapter rare bright (chrome yellow)

varying vec2 vUv;

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

void main() {
  vec2 p = vec2(vUv.x * uAspect, vUv.y) * 1.7;
  float t = uTime * (0.045 + uVortex * 0.12);

  // Cursor stirs the sky too — same field space as the strokes.
  vec2 fieldPos = vec2((vUv.x * 2.0 - 1.0) * uAspect, vUv.y * 2.0 - 1.0);
  vec2 toCur = fieldPos - uStir.xy;
  float cd2 = dot(toCur, toCur);
  float cw = exp(-cd2 / 0.55) * uStirAmt;

  // --- the Quilez construction: fbm(p + 3.6*fbm(p + 3.6*fbm(p))) -------------
  vec2 q = vec2(fbm(p), fbm(p + vec2(5.2, 1.3)));
  vec2 r = vec2(
    fbm(p + 3.6 * q + vec2(1.7, 9.2) + t * 1.4 + uStir.zw * cw * 0.8),
    fbm(p + 3.6 * q + vec2(8.3, 2.8) + t)
  );
  float f = fbm(p + 3.2 * r);

  // --- LAYER 0: underpainting — the generated clip churned by the warp --------
  // Cover-fit the media, then displace the sample by the warp field so the
  // paint footage keeps swirling past its loop seam.
  vec2 muv = vUv - 0.5;
  if (uAspect > uMediaAspect) {
    muv.y *= uMediaAspect / uAspect;
  } else {
    muv.x *= uAspect / uMediaAspect;
  }
  muv *= 0.92; // headroom so the warp never samples off the frame
  vec2 warp = (r - 0.5) * 0.16 + (q - 0.5) * 0.05 + toCur * cw * 0.04;
  vec3 tex = texture2D(uMap, muv + 0.5 + warp).rgb;

  // Palette-grade the footage toward the chapter: keep its swirl structure
  // (luma) but pull its color into the chapter ramp.
  float luma = dot(tex, vec3(0.299, 0.587, 0.114));
  vec3 ramp = mix(uBg, uColA, smoothstep(0.0, 0.30, luma));
  ramp = mix(ramp, uColB, smoothstep(0.26, 0.72, luma));
  ramp = mix(ramp, uColC, smoothstep(0.74, 0.97, luma));
  vec3 under = mix(ramp, tex, 0.38);

  // --- LAYER 1: glaze — prussian/cyan fbm with rare chrome blooms --------------
  vec3 glaze = mix(uBg, uColA, smoothstep(0.12, 0.55, f));
  glaze = mix(glaze, uColB, smoothstep(0.42, 0.86, f) * 0.85);
  // Rare chrome-yellow blooms where both warp layers peak together.
  float bloom = smoothstep(0.72, 0.93, f) * smoothstep(0.55, 0.85, r.x);
  glaze = mix(glaze, uColC, bloom * 0.7);
  // Weather: light rides the second warp layer.
  glaze *= 0.78 + 0.38 * smoothstep(0.25, 0.85, r.y);

  // --- fuse: the underpainting shows through along the swirl bands -------------
  float band = smoothstep(0.30, 0.74, fbm(p * 0.9 + r * 1.8 + 2.4));
  float show = uMix * (0.42 + 0.58 * band);
  vec3 col = mix(glaze, under, show);

  // The glaze's brightest blooms stay on top — paint over the film.
  col = mix(col, uColC, bloom * 0.30);

  // Horizon weighting: darker floor so the DOM's gallery wall reads.
  col *= 0.66 + 0.34 * smoothstep(0.0, 0.8, vUv.y);

  // Local brightening where the brush stirs the wet sky.
  col += uColB * cw * 0.12;

  // Soft vignette holds the eye in the frame.
  float vig = smoothstep(1.55, 0.45, length(vUv - 0.5) * 2.0);
  col *= 0.82 + 0.18 * vig;

  // Dithered grain — tooth for the canvas, death to banding.
  float g = hash21(vUv * uResolution + fract(uTime) * 113.1) - 0.5;
  col += g * 0.035;

  gl_FragColor = vec4(col, 1.0);
}
