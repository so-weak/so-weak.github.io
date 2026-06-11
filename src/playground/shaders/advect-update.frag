// 002 ADVECT — feedback pass. rg = velocity (uv/s), b = dye.
// Each frame samples the previous field upstream of its own velocity
// (semi-Lagrangian advection), decays it, and splats the cursor in.

precision highp float;

varying vec2 vUv;

uniform sampler2D uPrev;
uniform float uDt;
uniform float uAspect;
uniform vec2 uCursor;     // uv space
uniform vec2 uCursorVel;  // uv/s, clamped on CPU
uniform float uRadius;
uniform float uDissipation;

void main() {
  vec4 here = texture2D(uPrev, vUv);

  // Advect: pull the field from upstream of the local velocity.
  vec2 backUv = vUv - here.xy * uDt * 0.55;
  vec4 f = texture2D(uPrev, backUv);

  vec2 vel = f.xy * 0.972;
  float dye = f.z * uDissipation;

  // Gaussian splat at the cursor, aspect-corrected so it stays round.
  vec2 d = vec2((vUv.x - uCursor.x) * uAspect, vUv.y - uCursor.y);
  float splat = exp(-dot(d, d) / uRadius);

  float speed = length(uCursorVel);
  vel += uCursorVel * splat * 0.85;
  dye += splat * min(0.08 + speed * 1.6, 1.35) * uDt * 22.0;

  gl_FragColor = vec4(vel, min(dye, 2.2), 1.0);
}
