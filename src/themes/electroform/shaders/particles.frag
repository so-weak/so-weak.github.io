// Electroform particle sprite — soft round falloff, additive.
// Accent (lime) particles surge with uFlash when the UI is touched.
// uDim (0..1) defocuses + fades the field behind dense text sections so
// body copy stays readable over the corridor.

uniform float uFlash;
uniform float uOpacity;
uniform float uDim;

varying vec3 vColor;
varying float vFade;
varying float vAccent;

void main() {
  float d = length(gl_PointCoord - 0.5);
  // Dimmed sections widen the falloff — sprites read as blurred, not lit.
  float edge = mix(0.04, 0.32, uDim);
  float a = smoothstep(0.5, edge, d);
  a *= a;

  float alpha = a * vFade * uOpacity;
  if (alpha < 0.004) discard;

  vec3 col = vColor * (1.0 + vAccent * uFlash * 2.6);
  gl_FragColor = vec4(col, alpha);
}
