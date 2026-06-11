// 003 PHOSPHOR — the CRT pass. Barrel distortion, radial RGB shift,
// scanlines, phosphor triad mask, rolling band, flicker, bezel vignette.

precision highp float;

varying vec2 vUv;

uniform sampler2D uTex;
uniform float uTime;
uniform vec2 uResolution;
uniform float uCurvature;  // cursor X
uniform float uChroma;     // cursor Y

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  return fract(p * (p + p));
}

void main() {
  // Barrel distortion around the centre.
  vec2 uv = vUv * 2.0 - 1.0;
  float r2 = dot(uv, uv);
  uv *= 1.0 + uCurvature * r2 + uCurvature * 0.6 * r2 * r2;
  uv = uv / (1.0 + uCurvature * 1.15); // re-zoom so corners survive
  vec2 suv = uv * 0.5 + 0.5;

  // Outside the tube: bezel black.
  if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // Radial RGB shift — stronger at the edges.
  float shift = uChroma * (0.0012 + 0.004 * r2);
  vec2 dir = r2 > 0.0001 ? normalize(uv) : vec2(0.0);
  float cr = texture2D(uTex, suv + dir * shift).r;
  float cg = texture2D(uTex, suv).g;
  float cb = texture2D(uTex, suv - dir * shift).b;
  vec3 col = vec3(cr, cg, cb);

  // Scanlines + phosphor triad mask.
  float scan = 0.80 + 0.20 * sin(suv.y * uResolution.y * 2.2);
  float triad = mod(gl_FragCoord.x, 3.0);
  vec3 mask = vec3(
    triad < 1.0 ? 1.12 : 0.92,
    triad >= 1.0 && triad < 2.0 ? 1.12 : 0.92,
    triad >= 2.0 ? 1.12 : 0.92
  );
  col *= scan * mask;

  // Rolling band drifting up the tube.
  float band = exp(-pow((fract(suv.y * 0.6 + uTime * 0.10) - 0.5) * 14.0, 2.0));
  col += col * band * 0.22;

  // Mains flicker + static.
  float flick = 0.965 + 0.035 * sin(uTime * 87.0) * sin(uTime * 11.0);
  col *= flick;
  float snow = hash11(dot(suv, vec2(12.9898, 78.233)) + fract(uTime) * 113.0);
  col += (snow - 0.5) * 0.035;

  // Vignette + phosphor green lift in the blacks.
  float vig = smoothstep(1.6, 0.35, r2);
  col *= vig;
  col += vec3(0.012, 0.03, 0.02) * vig;

  // Soft bezel edge.
  vec2 e = min(suv, 1.0 - suv);
  float bezel = smoothstep(0.0, 0.012, min(e.x, e.y));
  col *= bezel;

  gl_FragColor = vec4(col, 1.0);
}
