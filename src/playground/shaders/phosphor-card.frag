// 003 PHOSPHOR — procedural broadcast test card (rendered to texture,
// then replayed through the CRT pass). Bars, ramp, crosshair, sweep,
// bouncing block — everything a tube needs for calibration.

precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform vec2 uResolution;

float box(vec2 uv, vec2 lo, vec2 hi) {
  vec2 s = step(lo, uv) * step(uv, hi);
  return s.x * s.y;
}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec3 col = vec3(0.02);

  // --- top 45%: colour bars -------------------------------------------------
  if (uv.y > 0.55) {
    float i = floor(uv.x * 7.0);
    vec3 bars[7];
    bars[0] = vec3(0.75, 0.75, 0.75);
    bars[1] = vec3(0.75, 0.75, 0.00);
    bars[2] = vec3(0.00, 0.75, 0.75);
    bars[3] = vec3(0.00, 0.75, 0.00);
    bars[4] = vec3(0.75, 0.00, 0.75);
    bars[5] = vec3(0.75, 0.00, 0.00);
    bars[6] = vec3(0.00, 0.00, 0.75);
    for (int k = 0; k < 7; k++) {
      if (float(k) == i) col = bars[k];
    }
  }
  // --- mid strip: grey ramp + frequency gratings ----------------------------
  else if (uv.y > 0.42) {
    float steps = floor(uv.x * 10.0) / 9.0;
    col = vec3(steps);
    if (uv.y < 0.47) {
      // Vertical resolution grating, frequency rises to the right.
      float f = mix(40.0, 420.0, uv.x);
      col = vec3(step(0.0, sin(uv.x * f * aspect)) * 0.8);
    }
  }
  // --- bottom: graph grid, crosshair circle, sweep, bouncing block ----------
  else {
    // Fine grid.
    vec2 g = fract(vec2(uv.x * aspect, uv.y) * 14.0);
    float grid = max(step(0.96, g.x), step(0.94, g.y));
    col = vec3(0.05) + vec3(0.10, 0.12, 0.11) * grid;

    // Crosshair circle with a radar sweep.
    vec2 c = vec2(0.5 * aspect, 0.21);
    vec2 d = vec2(uv.x * aspect, uv.y) - c;
    float r = length(d);
    float ring = smoothstep(0.012, 0.006, abs(r - 0.14)) + smoothstep(0.008, 0.004, abs(r - 0.05));
    float cross = (smoothstep(0.004, 0.002, abs(d.x)) + smoothstep(0.004, 0.002, abs(d.y))) * step(r, 0.17);
    float ang = atan(d.y, d.x);
    float sweep = smoothstep(0.5, 0.0, mod(ang - uTime * 1.4, 6.28318)) * step(r, 0.14);
    col += vec3(0.2, 0.9, 0.55) * (ring + cross * 0.7) * 0.8;
    col += vec3(0.2, 0.9, 0.55) * sweep * 0.35;

    // Bouncing luma block — motion for the CRT pass to smear.
    float bx = abs(fract(uTime * 0.21) * 2.0 - 1.0);
    col += vec3(0.95) * box(uv, vec2(mix(0.05, 0.85, bx), 0.31), vec2(mix(0.05, 0.85, bx) + 0.1, 0.385));
  }

  // Thin frame.
  float frame = box(uv, vec2(0.012), vec2(0.988));
  col *= mix(0.0, 1.0, frame);
  col += vec3(0.85) * (1.0 - frame) * box(uv, vec2(0.004), vec2(0.996));

  gl_FragColor = vec4(col, 1.0);
}
