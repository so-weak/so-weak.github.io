// Fullscreen triangle — no camera, no matrices. Geometry provides three
// vertices at (-1,-1), (3,-1), (-1,3); clip space covers the viewport.
varying vec2 vUv;

void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
