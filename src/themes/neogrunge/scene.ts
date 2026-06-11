/**
 * NeogrungScene — full-screen animated halftone dot field.
 *
 * A grid of circles rendered via GLSL. Each dot's radius is driven by a
 * sine wave + curl-noise function, making the field breathe and shift.
 * The cursor presses a "dent" into the field; fast scroll velocity
 * kicks the whole field into overdrive. Konami drives a full splat bloom.
 */

import {
  BufferGeometry,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from 'three'

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const FRAG = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;    /* 0-1 UV of cursor */
uniform float uVelocity; /* 0-1 scroll churn */
uniform float uSplat;   /* 0-1 Konami splat factor */

// --- halftone grid sizes
const float GRID = 28.0;
const float MAX_R = 0.45;  /* fraction of cell */
const float MIN_R = 0.02;

// 2D value noise helper
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1,0)), f.x),
    mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x),
    f.y
  );
}

// Approximate curl noise — simple fbm-displaced field
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.1 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
  vec2 uv = vUv * aspect;

  // cell-space coords
  vec2 cell = uv * GRID;
  vec2 cellId = floor(cell);
  vec2 cellUv = fract(cell) - 0.5;

  // noise-driven radius
  float t = uTime * 0.18;
  float n = fbm(cellId * 0.12 + vec2(t * 0.4, t * 0.31));
  float vel = uVelocity * 0.6;
  float r = mix(MIN_R, MAX_R, n + vel * fbm(cellId * 0.08 - vec2(t, 0.0)));

  // cursor dent: press dots down near cursor
  vec2 mUv = uMouse * aspect;
  vec2 cellCenter = (cellId + 0.5) / GRID;
  float mouseDist = distance(cellCenter * aspect, mUv);
  float mousePush = smoothstep(0.28, 0.0, mouseDist) * 0.38;
  r -= mousePush;

  // Konami splat: force-expand a blob in the centre
  if (uSplat > 0.0) {
    vec2 centre = vec2(0.5, 0.5) * aspect;
    float splatDist = distance(cellCenter * aspect, centre);
    float splatPush = smoothstep(0.7, 0.0, splatDist) * uSplat * MAX_R * 2.2;
    r += splatPush;
  }

  r = clamp(r, MIN_R, MAX_R + uSplat * MAX_R);

  // SDF circle in cell
  float d = length(cellUv) - r;
  float aa = fwidth(d) * 1.0;
  float dot = 1.0 - smoothstep(-aa, aa, d);

  // Colour: very dark bg + barely visible dot tint
  vec3 bg = vec3(0.09, 0.085, 0.08);
  // Tint cycles slowly through red → yellow → blue as scroll churn builds
  float tintT = uVelocity;
  vec3 tintA = vec3(0.90, 0.21, 0.27); // red
  vec3 tintB = vec3(0.12, 0.25, 0.54); // blue
  vec3 dotCol = mix(tintA, tintB, fbm(cellId * 0.04 + uTime * 0.05));

  float dotAlpha = mix(0.06, 0.18, n) + uVelocity * 0.12;
  vec3 col = mix(bg, dotCol, dot * dotAlpha);

  gl_FragColor = vec4(col, 1.0);
}
`

export interface NeogrugeSceneState {
  mouseX: number
  mouseY: number
  velocity: number
  splat: number
}

export class NeogrugeScene {
  private scene: Scene
  private camera: OrthographicCamera
  private material: ShaderMaterial
  private mesh: Mesh

  constructor() {
    this.scene = new Scene()
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)

    this.material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: [800, 600] },
        uMouse: { value: [0.5, 0.5] },
        uVelocity: { value: 0 },
        uSplat: { value: 0 },
      },
    })

    const geo = new PlaneGeometry(2, 2)
    this.mesh = new Mesh(geo, this.material)
    this.scene.add(this.mesh)
  }

  update(
    renderer: WebGLRenderer,
    state: NeogrugeSceneState,
    elapsed: number,
    w: number,
    h: number,
  ): void {
    const u = this.material.uniforms
    u['uTime']!.value = elapsed
    u['uResolution']!.value = [w, h]
    u['uMouse']!.value = [state.mouseX, state.mouseY]
    u['uVelocity']!.value = state.velocity
    u['uSplat']!.value = state.splat

    renderer.render(this.scene, this.camera)
  }

  resize(w: number, h: number): void {
    this.material.uniforms['uResolution']!.value = [w, h]
  }

  dispose(): void {
    this.material.dispose()
    ;(this.mesh.geometry as BufferGeometry).dispose()
    this.scene.clear()
  }
}
