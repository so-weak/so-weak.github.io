// 006 BOKEH — sprite shading. Sharp points are hard discs; defocused ones
// soften and develop a bright rim, like a real lens iris.

precision highp float;

varying float vBlur;
varying float vEnergy;
varying vec3 vColor;

void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;

  float soft = mix(0.08, 0.65, vBlur);
  float disc = 1.0 - smoothstep(1.0 - soft, 1.0, d);

  // Bokeh rim: defocused discs are brighter at the edge than the centre.
  float rim = smoothstep(0.45, 0.95, d) * (1.0 - smoothstep(0.95, 1.0, d));
  disc += rim * vBlur * 0.8;

  float a = disc * vEnergy;
  if (a < 0.003) discard;

  gl_FragColor = vec4(vColor * a, a);
}
