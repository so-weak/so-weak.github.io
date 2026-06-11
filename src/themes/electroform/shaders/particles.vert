// Electroform particle field — soft additive sprites drifting in a deep
// z-corridor. Scroll dollies the field through the camera by wrapping each
// particle's z, so the tunnel is endless in both directions.

attribute float aSize;
attribute float aSeed;
attribute float aAccent;
attribute vec3 aColor;

uniform float uTime;
uniform float uPixelRatio;
uniform float uScrollZ;
uniform float uFlash;

varying vec3 vColor;
varying float vFade;
varying float vAccent;

void main() {
  vec3 p = position;

  // Weightless molten drift.
  float drift = uTime * 0.11 + aSeed * 6.2831;
  p.x += sin(drift * 1.15 + aSeed * 17.0) * 0.38;
  p.y += cos(drift * 0.85 + aSeed * 11.0) * 0.32;

  // Endless corridor: z wraps inside [-27, 7]; camera sits at z = 7.
  p.z = mod(p.z + uScrollZ + 27.0, 34.0) - 27.0;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = max(-mv.z, 0.001);

  float size = aSize * (1.0 + aAccent * uFlash * 1.5);
  gl_PointSize = min(size * uPixelRatio * (30.0 / dist), 64.0);

  float twinkle = 0.6 + 0.4 * sin(uTime * (0.5 + aSeed * 1.4) + aSeed * 41.0);
  // Fade near the camera plane and into the far haze.
  vFade = smoothstep(0.9, 3.2, dist) * smoothstep(33.0, 17.0, dist) * twinkle;

  vColor = aColor;
  vAccent = aAccent;
  gl_Position = projectionMatrix * mv;
}
