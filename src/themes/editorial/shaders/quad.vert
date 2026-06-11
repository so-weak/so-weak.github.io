// Fullscreen-triangle passthrough — clip-space positions baked into the
// geometry, so no camera matrices are needed.
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
