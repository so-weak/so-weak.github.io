// Star-knot halos — one instanced quad per star, additively blended under
// the stroke field so the warm glow reads as paint catching light, not lens
// bloom. Star 0 (the brightest) carries the supernova→sunflower egg.

attribute float aIndex;

uniform vec4 uStars[8]; // x,y: field pos — z: radius — w: strength
uniform float uAspect;
uniform float uTime;
uniform float uVortex;
uniform float uNovaT; // supernova progress on star 0 (0 = inactive)

varying vec2 vUv;
varying float vStrength;
varying float vSeed;
varying float vNova;

void main() {
  vec4 s = uStars[int(aIndex + 0.5)];
  float pulse = 0.92 + 0.08 * sin(uTime * (0.6 + aIndex * 0.17) + aIndex * 11.0);
  float nova = aIndex < 0.5 ? uNovaT : 0.0;
  float scale = s.z * (2.7 + uVortex * 1.5) * pulse * (1.0 + nova * 2.6);
  vec2 world = s.xy + position.xy * scale;
  gl_Position = vec4(world.x / uAspect, world.y, 0.0, 1.0);
  vUv = uv;
  vStrength = s.w * (1.0 + uVortex * 1.3);
  vSeed = aIndex;
  vNova = nova;
}
