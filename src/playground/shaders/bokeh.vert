// 006 BOKEH — per-vertex circle of confusion. Sprite size attenuates with
// distance AND grows with |depth - focus|; energy falls as blur grows so
// defocused points read as dim soft discs, not white blobs.

attribute float aSeed;

uniform float uTime;
uniform float uFocus;
uniform float uSize;
uniform float uDpr;
uniform float uBokeh;

varying float vBlur;
varying float vEnergy;
varying vec3 vColor;

void main() {
  vec3 pos = position;

  // Slow drift — each point on its own phase.
  pos.y += sin(uTime * (0.12 + aSeed * 0.25) + aSeed * 6.2831) * 0.4;
  pos.x += cos(uTime * 0.09 + aSeed * 12.56) * 0.3;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float dist = max(-mv.z, 0.1);

  // Circle of confusion: 0 at the focal plane, 1 fully defocused.
  float coc = clamp(abs(dist - uFocus) / 7.0, 0.0, 1.0);
  vBlur = coc;

  // Energy conservation: same light, bigger disc => dimmer disc.
  float twinkle = 0.75 + 0.25 * sin(uTime * (0.6 + aSeed * 1.5) + aSeed * 40.0);
  vEnergy = mix(1.0, 0.10, coc) * twinkle;

  // Warm / cool split with a little per-point variance.
  vec3 warm = vec3(1.0, 0.72, 0.42);
  vec3 cool = vec3(0.45, 0.62, 1.0);
  vColor = mix(warm, cool, fract(aSeed * 7.31)) * (0.55 + 0.45 * fract(aSeed * 3.7));

  float size = uSize * (1.0 + coc * uBokeh);
  gl_PointSize = clamp(size * uDpr / dist, 1.0, 90.0);
  gl_Position = projectionMatrix * mv;
}
