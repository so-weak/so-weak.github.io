// Ink dye advection — ping-pong pass at quarter resolution.
// Each frame: diffuse the previous dye field slightly (ink soaking into
// paper fibres), decay it slowly, and splat new dye along the segment the
// damped cursor travelled this frame.
precision highp float;

uniform sampler2D uPrev;
uniform vec2 uTexel;
uniform vec2 uPoint;
uniform vec2 uPrevPoint;
uniform float uAspect;
uniform float uRadius;
uniform float uStrength;
uniform float uDecay;

varying vec2 vUv;

float distToSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  // 5-tap diffusion — half the weight on the centre so the blot spreads.
  float c = texture2D(uPrev, vUv).r * 4.0;
  c += texture2D(uPrev, vUv + vec2(uTexel.x, 0.0)).r;
  c += texture2D(uPrev, vUv - vec2(uTexel.x, 0.0)).r;
  c += texture2D(uPrev, vUv + vec2(0.0, uTexel.y)).r;
  c += texture2D(uPrev, vUv - vec2(0.0, uTexel.y)).r;
  c *= 0.125;
  c *= uDecay;

  // Splat along the cursor's path, aspect-corrected so blots stay round.
  vec2 p = vec2(vUv.x * uAspect, vUv.y);
  vec2 a = vec2(uPrevPoint.x * uAspect, uPrevPoint.y);
  vec2 b = vec2(uPoint.x * uAspect, uPoint.y);
  float d = distToSegment(p, a, b);
  c += exp(-(d * d) / max(uRadius * uRadius, 1e-8)) * uStrength;

  gl_FragColor = vec4(min(c, 1.35), 0.0, 0.0, 1.0);
}
