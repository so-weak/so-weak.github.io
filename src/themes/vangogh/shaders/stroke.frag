// Procedural impasto stroke — a soft-edged, slightly ragged, tapered daub.
//
// The quad's UV space carries a signed-distance stroke: a gently bowed
// centerline, a sine-tapered width profile roughened by value noise, bristle
// streaks dragged along the length, and an impasto ridge lit from the upper
// edge so overlapping strokes read as thick paint rather than glow.

precision highp float;

varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
varying float vSeed;
varying float vArc;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

void main() {
  float x = vUv.x;
  float y = vUv.y - 0.5;

  // Gentle bow along the stroke's length.
  float bend = vArc * sin(x * 3.14159);
  float d = abs(y - bend);

  // Tapered width profile with a ragged, paint-pulled edge.
  float prof = pow(max(sin(x * 3.14159), 0.0), 0.62);
  float rag = (vnoise(vec2(x * 7.0 + vSeed * 43.0, vSeed * 89.0)) - 0.5) * 0.22;
  float halfW = max((0.30 + rag) * prof, 0.0);

  float alpha = smoothstep(halfW, halfW - 0.14, d);

  // Bristle streaks running with the stroke.
  float bristle = 0.74 + 0.26 * vnoise(vec2((y - bend) * 24.0 + vSeed * 53.0, x * 3.0 + vSeed * 17.0));
  alpha *= bristle;

  // Impasto ridge: lit from the upper edge, shadowed below, with a wet
  // highlight line just under the top rim.
  float lift = (y - bend) / max(halfW, 1e-3);
  vec3 col = vColor * (0.84 + 0.32 * smoothstep(-1.0, 1.0, lift));
  col += vColor * 0.2 * smoothstep(0.45, 0.92, lift) * prof;

  float a = alpha * vAlpha;
  if (a < 0.012) discard;
  gl_FragColor = vec4(col, a * 0.92);
}
