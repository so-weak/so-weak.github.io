/**
 * ElectroformScene — the molten chrome blob, the particle corridor and the
 * cinematic post stack (depth of field rack-focus + bloom + tone map + SMAA).
 *
 * The theme drives everything through `apply(state)` once per frame; this
 * module owns all GL resources and releases them in `dispose()`.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  HalfFloatType,
  IcosahedronGeometry,
  Mesh,
  MeshPhysicalMaterial,
  PMREMGenerator,
  PerspectiveCamera,
  PointLight,
  Points,
  Raycaster,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  type WebGLRenderTarget,
  type WebGLRenderer,
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  BloomEffect,
  DepthOfFieldEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
  ToneMappingEffect,
  ToneMappingMode,
} from 'postprocessing'
import blobChunk from './shaders/blobChunk.glsl'
import particlesVert from './shaders/particles.vert'
import particlesFrag from './shaders/particles.frag'

export interface SceneState {
  /** Shader time (seconds-ish, theme-scaled). */
  time: number
  /** Blob displacement amplitude. */
  amp: number
  /** Blob noise frequency. */
  freq: number
  /** Cursor-velocity boost 0..1 — calm = mirror, fast = molten. */
  swirl: number
  /** Scroll-driven dolly offset for the particle corridor. */
  scrollZ: number
  /** Accent flash 0..1 — lime surge in particles + kicker light. */
  flash: number
  blobX: number
  blobY: number
  blobScale: number
  camX: number
  camY: number
  /** DoF focus distance in world units (camera sits at z = 7). */
  focus: number
  /** DoF bokeh scale. */
  bokeh: number
  /**
   * 0..1 — how much to dim/defocus the particle field and tame the bloom
   * behind the current section (1 = densest text). Driven by the theme
   * from the continuous section index.
   */
  dim: number
  /**
   * 0..1 MOLTEN OVERDRIVE envelope — noise amplitude + iridescence surge,
   * lime flash through the particles. Decays in the theme.
   */
  overdrive: number
}

export interface SceneOptions {
  isMobile: boolean
  /** Skip the DoF pass entirely (mobile). */
  withDof: boolean
}

const CAMERA_Z = 7
const BASE_BG = '#0a0a0c'

/** Vertex-stage normal reconstruction via tangent-plane neighbor sampling. */
const BEGINNORMAL_CHUNK = /* glsl */ `
  vec3 efBase = normalize(position);
  float efR = length(position);
  vec3 efPos = efDisplaced(position, efBase);
  vec3 efT = efOrthogonal(efBase);
  vec3 efB = normalize(cross(efBase, efT));
  vec3 efN1 = normalize(position + efT * 0.07);
  vec3 efN2 = normalize(position + efB * 0.07);
  vec3 efP1 = efDisplaced(efN1 * efR, efN1);
  vec3 efP2 = efDisplaced(efN2 * efR, efN2);
  vec3 objectNormal = normalize(cross(efP1 - efPos, efP2 - efPos));
`

const BEGIN_VERTEX_CHUNK = /* glsl */ `
  vec3 transformed = efPos;
`

export class ElectroformScene {
  readonly scene: Scene
  readonly camera: PerspectiveCamera

  private readonly renderer: WebGLRenderer

  private readonly blob: Mesh
  private readonly blobGeo: BufferGeometry
  private readonly blobMat: MeshPhysicalMaterial

  private readonly points: Points
  private readonly pointsGeo: BufferGeometry
  private readonly pointsMat: ShaderMaterial

  private readonly composer: EffectComposer
  private readonly dof: DepthOfFieldEffect | null
  private readonly bloom: BloomEffect

  private readonly keyLight: DirectionalLight
  private readonly accentLight: PointLight

  // Blob hit-testing for the MOLTEN OVERDRIVE egg.
  private readonly raycaster = new Raycaster()
  private readonly rayNdc = new Vector2()

  // Kept as the render target (not just its texture) so dispose() can free
  // the underlying framebuffer too — texture.dispose() alone leaks the FBO.
  private envRT: WebGLRenderTarget | null = null

  private readonly lookTarget = new Vector3()

  // Shared uniform objects — wired into both the injected blob shader and
  // the particle material, updated once per frame from `apply()`.
  private readonly uTime = { value: 0 }
  private readonly uAmp = { value: 0.3 }
  private readonly uFreq = { value: 1.1 }
  private readonly uSwirl = { value: 0 }
  private readonly uScrollZ = { value: 0 }
  private readonly uFlash = { value: 0 }
  private readonly uPixelRatio = { value: 1 }
  private readonly uOpacity = { value: 0.85 }
  private readonly uDim = { value: 0 }

  constructor(renderer: WebGLRenderer, opts: SceneOptions) {
    this.renderer = renderer

    this.scene = new Scene()
    this.scene.background = new Color(BASE_BG)

    this.camera = new PerspectiveCamera(opts.isMobile ? 52 : 42, 1, 0.1, 60)
    this.camera.position.set(0, 0, CAMERA_Z)

    // --- environment (chrome needs something to reflect) --------------------
    const pmrem = new PMREMGenerator(renderer)
    const room = new RoomEnvironment()
    this.envRT = pmrem.fromScene(room, 0.04)
    this.scene.environment = this.envRT.texture
    room.dispose()
    pmrem.dispose()

    // --- molten chrome blob --------------------------------------------------
    // mergeVertices collapses the icosahedron's non-indexed triangle soup
    // (3 verts/face, zero reuse) into a shared-vertex indexed mesh — ~23x
    // less vertex-shader work for the 6-snoise displacement, and a smooth
    // displaced sphere at this detail is indistinguishable behind the DoF.
    const radius = opts.isMobile ? 1.05 : 1.4
    const detail = opts.isMobile ? 24 : 48
    this.blobGeo = mergeVertices(new IcosahedronGeometry(radius, detail))
    this.blobMat = new MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 1,
      roughness: 0.06,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      iridescence: 1,
      iridescenceIOR: 1.32,
      envMapIntensity: 1.15,
    })
    this.blobMat.iridescenceThicknessRange = [120, 480]
    this.blobMat.onBeforeCompile = (shader) => {
      shader.uniforms.uEfTime = this.uTime
      shader.uniforms.uEfAmp = this.uAmp
      shader.uniforms.uEfFreq = this.uFreq
      shader.uniforms.uEfSwirl = this.uSwirl
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${blobChunk}`)
        .replace('#include <beginnormal_vertex>', BEGINNORMAL_CHUNK)
        .replace('#include <begin_vertex>', BEGIN_VERTEX_CHUNK)
    }
    this.blobMat.customProgramCacheKey = () => 'electroform-blob'

    this.blob = new Mesh(this.blobGeo, this.blobMat)
    this.scene.add(this.blob)

    // --- particle corridor ----------------------------------------------------
    const count = opts.isMobile ? 1200 : 2800
    this.pointsGeo = buildParticleGeometry(count)
    this.pointsMat = new ShaderMaterial({
      vertexShader: particlesVert,
      fragmentShader: particlesFrag,
      uniforms: {
        uTime: this.uTime,
        uPixelRatio: this.uPixelRatio,
        uScrollZ: this.uScrollZ,
        uFlash: this.uFlash,
        uOpacity: this.uOpacity,
        uDim: this.uDim,
      },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    this.points = new Points(this.pointsGeo, this.pointsMat)
    this.points.frustumCulled = false
    this.scene.add(this.points)

    // --- lights (env does the heavy lifting; these sculpt + react) -----------
    this.keyLight = new DirectionalLight(0xbfd9ff, 1.4)
    this.keyLight.position.set(3, 4, 5)
    this.scene.add(this.keyLight)

    this.accentLight = new PointLight(0xccff00, 0, 14, 2)
    this.accentLight.position.set(-2.6, -1.8, 2.4)
    this.scene.add(this.accentLight)

    // --- post stack ------------------------------------------------------------
    this.composer = new EffectComposer(renderer, {
      frameBufferType: HalfFloatType,
    })
    this.composer.addPass(new RenderPass(this.scene, this.camera))

    this.dof = opts.withDof
      ? new DepthOfFieldEffect(this.camera, {
          focusDistance: CAMERA_Z,
          focusRange: 2.6,
          bokehScale: 3.2,
          resolutionScale: 0.5,
        })
      : null

    this.bloom = new BloomEffect({
      intensity: 0.5,
      luminanceThreshold: 0.8,
      luminanceSmoothing: 0.25,
      mipmapBlur: true,
      radius: 0.72,
    })
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC })
    const smaa = new SMAAEffect({ preset: SMAAPreset.HIGH })

    const effects = this.dof
      ? [this.dof, this.bloom, tone, smaa]
      : [this.bloom, tone, smaa]
    this.composer.addPass(new EffectPass(this.camera, ...effects))
  }

  /** Pre-compile shaders while the transition overlay covers the screen. */
  async compile(): Promise<void> {
    await this.renderer.compileAsync(this.scene, this.camera)
    // One warm render so the post-processing shaders compile too.
    this.composer.render(1 / 60)
  }

  apply(s: SceneState): void {
    // Overdrive surges amplitude + flash on top of the choreographed values.
    const kick = Math.max(s.flash, s.overdrive)

    this.uTime.value = s.time
    this.uAmp.value = s.amp * (1 + s.overdrive * 1.35)
    this.uFreq.value = s.freq
    this.uSwirl.value = s.swirl
    this.uScrollZ.value = s.scrollZ
    this.uFlash.value = kick

    // Readability: dim + defocus the particle field and tame the bloom
    // behind dense text sections.
    this.uDim.value = s.dim
    this.uOpacity.value = 0.85 * (1 - s.dim * 0.55)
    this.bloom.intensity = 0.5 * (1 - s.dim * 0.7) + s.overdrive * 0.55

    // Iridescence / reflection surge while overdrive rings out — these are
    // uniform-backed physical-material params, no shader recompile.
    this.blobMat.envMapIntensity = 1.15 + s.overdrive * 1.4
    this.blobMat.iridescenceIOR = 1.32 + s.overdrive * 0.45
    this.blobMat.clearcoatRoughness = 0.12 - s.overdrive * 0.08

    this.blob.position.set(s.blobX, s.blobY, 0)
    this.blob.scale.setScalar(s.blobScale)
    this.blob.rotation.y = s.time * 0.06
    this.blob.rotation.z = s.time * 0.022

    this.camera.position.set(s.camX, s.camY, CAMERA_Z)
    this.lookTarget.set(s.blobX * 0.25, s.blobY * 0.25, 0)
    this.camera.lookAt(this.lookTarget)

    this.accentLight.intensity = kick * 36

    if (this.dof) {
      this.dof.cocMaterial.focusDistance = s.focus
      this.dof.bokehScale = s.bokeh
    }
  }

  /**
   * True when a click at the given NDC coords lands on the blob —
   * the MOLTEN OVERDRIVE egg trigger.
   */
  hitTestBlob(ndcX: number, ndcY: number): boolean {
    this.rayNdc.set(ndcX, ndcY)
    this.raycaster.setFromCamera(this.rayNdc, this.camera)
    return this.raycaster.intersectObject(this.blob, false).length > 0
  }

  render(dt: number): void {
    this.composer.render(dt)
  }

  resize(width: number, height: number, dpr: number): void {
    this.camera.aspect = width / height
    this.camera.fov = width < 768 ? 52 : 42
    this.camera.updateProjectionMatrix()
    this.uPixelRatio.value = dpr
    // Same dimensions the ThemeManager already applied to the renderer —
    // this only resizes the composer's internal buffers.
    this.composer.setSize(width, height, false)
  }

  dispose(): void {
    this.composer.dispose()
    this.blobGeo.dispose()
    this.blobMat.dispose()
    this.pointsGeo.dispose()
    this.pointsMat.dispose()
    if (this.envRT) {
      // Render-target dispose also disposes its texture and frees the FBO.
      this.envRT.dispose()
      this.envRT = null
    }
    this.scene.environment = null
    this.scene.clear()
  }
}

// --- helpers -------------------------------------------------------------------

const SILVER = new Color('#c2ccdb')
const ICE = new Color('#7fa8ff')
const LIME = new Color('#ccff00')

function buildParticleGeometry(count: number): BufferGeometry {
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const seeds = new Float32Array(count)
  const accents = new Float32Array(count)
  const colors = new Float32Array(count * 3)

  const tmp = new Color()

  for (let i = 0; i < count; i++) {
    // Ring distribution around the corridor axis — keeps the blob's core
    // clear while filling the dolly path with depth.
    const angle = Math.random() * Math.PI * 2
    const ring = 1.9 + Math.pow(Math.random(), 0.65) * 6.4
    positions[i * 3] = Math.cos(angle) * ring
    positions[i * 3 + 1] = Math.sin(angle) * ring * 0.78
    positions[i * 3 + 2] = -27 + Math.random() * 34

    sizes[i] = 0.55 + Math.random() * 1.45
    seeds[i] = Math.random()

    const isAccent = Math.random() < 0.04
    accents[i] = isAccent ? 1 : 0

    if (isAccent) {
      tmp.copy(LIME)
    } else {
      tmp.copy(SILVER).lerp(ICE, Math.random())
      tmp.multiplyScalar(0.5 + Math.random() * 0.6)
    }
    colors[i * 3] = tmp.r
    colors[i * 3 + 1] = tmp.g
    colors[i * 3 + 2] = tmp.b
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(positions, 3))
  geo.setAttribute('aSize', new BufferAttribute(sizes, 1))
  geo.setAttribute('aSeed', new BufferAttribute(seeds, 1))
  geo.setAttribute('aAccent', new BufferAttribute(accents, 1))
  geo.setAttribute('aColor', new BufferAttribute(colors, 3))
  return geo
}
