/**
 * 001 MOLTEN — chrome blob.
 *
 * MeshPhysicalMaterial (metal, iridescent, clearcoat) displaced by 3D
 * simplex noise in the vertex stage via onBeforeCompile. Normals are
 * rebuilt analytically from two displaced tangent-space neighbours —
 * exact on the unit icosphere where normal == position. Lit entirely by
 * a PMREM-filtered RoomEnvironment, resolved through a depth-of-field
 * pass (desktop only).
 */

import {
  ACESFilmicToneMapping,
  Color,
  HalfFloatType,
  IcosahedronGeometry,
  Mesh,
  MeshPhysicalMaterial,
  PMREMGenerator,
  PerspectiveCamera,
  Scene,
  Vector3,
} from 'three'
import type { ToneMapping, WebGLRenderer, WebGLRenderTarget } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import {
  DepthOfFieldEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
} from 'postprocessing'
import { clamp, damp } from '../../utils/math'
import type { Viewport } from '../../app/Viewport'
import type { CursorNdc, Experiment, ExperimentFactory } from '../types'

/** Ashima/IQ 3D simplex noise — public domain. */
const SNOISE = /* glsl */ `
vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0 / 7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`

class Molten implements Experiment {
  private renderer!: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(42, 1, 0.1, 30)

  private geometry: IcosahedronGeometry | null = null
  private material: MeshPhysicalMaterial | null = null
  private mesh: Mesh | null = null
  private envRT: WebGLRenderTarget | null = null
  private composer: EffectComposer | null = null

  private readonly uTime = { value: 0 }
  private readonly uAmp = { value: 0.3 }
  private readonly uFreq = { value: 1.35 }

  private prevToneMapping: ToneMapping = ACESFilmicToneMapping
  private readonly prevCursor = { x: 0, y: 0 }
  private speed = 0
  private hasCursor = false

  async init(renderer: WebGLRenderer, viewport: Viewport): Promise<void> {
    this.renderer = renderer
    this.prevToneMapping = renderer.toneMapping
    renderer.toneMapping = ACESFilmicToneMapping

    this.scene.background = new Color(0x0b0b0e)

    // Image-based lighting from the procedural room.
    const pmrem = new PMREMGenerator(renderer)
    const room = new RoomEnvironment()
    // Keep the whole render target — disposing only its texture would leak
    // the target's framebuffers and depth renderbuffer on every activation.
    this.envRT = pmrem.fromScene(room, 0.04)
    pmrem.dispose()
    room.dispose()
    this.scene.environment = this.envRT.texture
    this.scene.environmentIntensity = 1.15

    this.geometry = new IcosahedronGeometry(1, viewport.isMobile ? 4 : 6)
    this.material = new MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 1.0,
      roughness: 0.16,
      clearcoat: 0.55,
      clearcoatRoughness: 0.25,
      iridescence: 1.0,
      iridescenceIOR: 1.35,
      envMapIntensity: 1.2,
    })

    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uTime
      shader.uniforms.uAmp = this.uAmp
      shader.uniforms.uFreq = this.uFreq
      shader.vertexShader =
        `
uniform float uTime;
uniform float uAmp;
uniform float uFreq;
${SNOISE}
vec3 moltenDisplace(vec3 p) {
  float n1 = snoise(p * uFreq + vec3(0.0, uTime * 0.42, uTime * 0.21));
  float n2 = snoise(p * uFreq * 2.6 + vec3(uTime * 0.55, 0.0, 0.0));
  return p * (1.0 + (n1 * 0.78 + n2 * 0.22) * uAmp);
}
` + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace(
        '#include <beginnormal_vertex>',
        /* glsl */ `
vec3 mPos = normalize(position);
vec3 mTan = normalize(cross(abs(mPos.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0), mPos));
vec3 mBit = normalize(cross(mPos, mTan));
float mEps = 0.018;
vec3 mD0 = moltenDisplace(mPos);
vec3 mD1 = moltenDisplace(normalize(mPos + mTan * mEps));
vec3 mD2 = moltenDisplace(normalize(mPos + mBit * mEps));
vec3 objectNormal = normalize(cross(mD1 - mD0, mD2 - mD0));
`,
      )
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        'vec3 transformed = mD0;',
      )
    }
    this.material.customProgramCacheKey = () => 'lab-molten-v1'

    this.mesh = new Mesh(this.geometry, this.material)
    this.scene.add(this.mesh)

    this.camera.position.set(0, 0, 3.4)
    this.camera.lookAt(0, 0, 0)

    if (!viewport.isMobile) {
      this.composer = new EffectComposer(renderer, {
        frameBufferType: HalfFloatType,
        multisampling: 4,
      })
      this.composer.addPass(new RenderPass(this.scene, this.camera))
      const dof = new DepthOfFieldEffect(this.camera, {
        focusDistance: 3.4,
        focusRange: 1.1,
        bokehScale: 2.6,
        resolutionScale: 0.75,
      })
      dof.target = new Vector3(0, 0, 0)
      this.composer.addPass(new EffectPass(this.camera, dof))
    }

    await renderer.compileAsync(this.scene, this.camera)
  }

  update(dt: number, elapsed: number, cursor: CursorNdc): void {
    this.uTime.value = elapsed * 0.6

    // Cursor speed (NDC units/s) feeds displacement amplitude.
    if (dt > 0) {
      if (!this.hasCursor) {
        this.hasCursor = true
        this.prevCursor.x = cursor.x
        this.prevCursor.y = cursor.y
      }
      const dx = (cursor.x - this.prevCursor.x) / dt
      const dy = (cursor.y - this.prevCursor.y) / dt
      this.prevCursor.x = cursor.x
      this.prevCursor.y = cursor.y
      this.speed = damp(this.speed, Math.min(Math.hypot(dx, dy), 8), 4, dt)
      const ampTarget = clamp(0.26 + this.speed * 0.16, 0.26, 0.72)
      this.uAmp.value = damp(this.uAmp.value, ampTarget, 2.4, dt)
    }

    if (this.mesh) {
      this.mesh.rotation.y += dt * 0.16
      this.mesh.rotation.x = Math.sin(elapsed * 0.13) * 0.25
    }

    // Cursor parallax — the camera leans, the blob stays put.
    this.camera.position.x = damp(this.camera.position.x, cursor.x * 0.55, 3, Math.max(dt, 1e-4))
    this.camera.position.y = damp(this.camera.position.y, cursor.y * 0.4, 3, Math.max(dt, 1e-4))
    this.camera.lookAt(0, 0, 0)

    if (this.composer) {
      this.composer.render(dt)
    } else {
      this.renderer.setRenderTarget(null)
      this.renderer.render(this.scene, this.camera)
    }
  }

  resize(width: number, height: number, _dpr: number): void {
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.composer?.setSize(width, height)
  }

  dispose(): void {
    this.composer?.dispose()
    this.composer = null
    if (this.mesh) this.scene.remove(this.mesh)
    this.mesh = null
    this.geometry?.dispose()
    this.geometry = null
    this.material?.dispose()
    this.material = null
    this.envRT?.dispose() // also frees the env texture
    this.envRT = null
    this.scene.environment = null
    this.renderer.toneMapping = this.prevToneMapping
    this.renderer.setRenderTarget(null)
  }
}

const factory: ExperimentFactory = () => new Molten()
export default factory
