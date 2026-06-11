// Star halo: warm core, breathing concentric rings (the Starry Night ring
// signature), and — on the brightest star — the supernova that blooms into
// a brief sunflower: a petal burst riding an expanding ring.

precision highp float;

uniform float uTime;
uniform float uStarAmt;
uniform vec3 uWarm; // chrome yellow
uniform vec3 uEmber; // vermilion

varying vec2 vUv;
varying float vStrength;
varying float vSeed;
varying float vNova;

void main() {
  vec2 q = vUv - 0.5;
  float r = length(q) * 2.0; // 0 at center, 1 at quad edge
  float ang = atan(q.y, q.x);

  float core = exp(-r * r * 26.0) * 1.6;
  float halo = exp(-r * 2.6) * 0.5;
  float rings = sin(r * 21.0 - uTime * 1.6 + vSeed * 9.0) * 0.5 + 0.5;
  halo *= 0.62 + 0.38 * rings;

  vec3 col = uWarm * (core + halo) + vec3(1.0, 0.96, 0.82) * core * 0.6;
  float a = (core + halo) * vStrength * uStarAmt;

  if (vNova > 0.001) {
    float ring = exp(-pow((r - vNova * 0.85) * 5.0, 2.0));
    float petals = pow(abs(cos(ang * 6.0 + vSeed)), 2.2);
    float bloom = ring * (0.35 + petals) * smoothstep(0.0, 0.08, vNova) * (1.0 - vNova * 0.72);
    col += mix(uEmber, uWarm, petals) * bloom * 2.2;
    a += bloom * 1.6;
  }

  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
}
