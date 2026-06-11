/**
 * AuroraScene — the dawn-sky gradient field and the drifting glass orbs.
 *
 * A fullscreen domain-warped fbm plane (shaders/aurora.frag) sits far behind
 * 5–7 transmissive MeshPhysicalMaterial orbs photographed through a shallow
 * depth of field whose focal distance breathes on a long sine. Orbs shy away
 * gently from the cursor and get nudged outward when project cards are
 * hovered. The theme drives everything through `apply(state, dt)` once per
 * frame; this module owns all GL resources and releases them in `dispose()`.
 */

import {
  Color,
  DataTexture,
  DirectionalLight,
  HalfFloatType,
  MathUtils,
  Mesh,
  MeshPhysicalMaterial,
  PMREMGenerator,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
  VideoTexture,
  type Texture,
  type WebGLRenderer,
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import {
  DepthOfFieldEffect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
} from 'postprocessing'
import { clamp, damp } from '../../utils/math'
import auroraVert from './shaders/aurora.vert'
import auroraFrag from './shaders/aurora.frag'

export interface AuroraState {
  /** Shader/drift time in seconds. */
  time: number
  /** Cursor in NDC (-1..1, y up). */
  cursorX: number
  cursorY: number
  /** Damped cursor presence 0..1 — 0 on touch devices. */
  cursorStrength: number
  /** Project-card hover shimmer 0..1 (damped on the CPU). */
  excite: number
  /** Orb push impulse 0..1 — decays after each project hover. */
  impulse: number
  /** Page scroll progress 0..1 — slowly re-seeds the gradient field. */
  scroll: number
  /** DoF focal distance in world units (camera sits at z = 10). */
  focus: number
  /** Camera sway targets (already damped by the theme). */
  parallaxX: number
  parallaxY: number
  /** Shooting-star progress: 0 = inactive, else 0..1 along its arc. */
  starT: number
  /** Per-shot randomization of the streak's path. */
  starSeed: number
  /** Generated dawn-sky video underlay opacity 0..1 (0 = layer off). */
  videoMix: number
}

export interface AuroraSceneOptions {
  isMobile: boolean
  /** Skip the DoF pass entirely (mobile / reduced motion). */
  withDof: boolean
}

const CAMERA_Z = 10
const PLANE_Z = -9
const FOV_DESKTOP = 38
const FOV_MOBILE = 52

// Deep midnight palette — the starfield sky, not a dawn sky.
const COL_BASE = new Color('#0b0813')
const COL_LAV = new Color('#4a2890')   // deep amethyst
const COL_BLUSH = new Color('#7a1e42') // deep rose/ruby
const COL_MINT = new Color('#0e4a32')  // deep emerald
const COL_SKY = new Color('#0d1e5c')   // deep midnight navy

interface OrbSeed {
  x: number
  y: number
  z: number
  r: number
  /** Drift speed. */
  sp: number
  /** Phase offset so paths never sync. */
  ph: number
  /** Drift amplitudes. */
  ax: number
  ay: number
}

const ORB_SEEDS: readonly OrbSeed[] = [
  { x: -4.7, y: 1.7, z: 1.2, r: 0.95, sp: 0.21, ph: 0.0, ax: 0.55, ay: 0.4 },
  { x: 4.5, y: -1.3, z: 0.4, r: 1.15, sp: 0.16, ph: 1.7, ax: 0.45, ay: 0.55 },
  { x: 0.7, y: -0.5, z: 3.6, r: 0.5, sp: 0.19, ph: 2.3, ax: 0.65, ay: 0.5 },
  { x: -2.7, y: -2.1, z: -2.6, r: 0.72, sp: 0.27, ph: 3.1, ax: 0.6, ay: 0.35 },
  { x: 3.1, y: 2.3, z: -3.4, r: 0.58, sp: 0.24, ph: 4.4, ax: 0.5, ay: 0.45 },
  { x: -5.6, y: -0.9, z: 2.8, r: 0.78, sp: 0.14, ph: 5.2, ax: 0.4, ay: 0.6 },
  { x: 5.8, y: 1.2, z: -1.2, r: 0.46, sp: 0.3, ph: 0.9, ax: 0.55, ay: 0.4 },
] as const

/** Mobile: fewer orbs, pulled toward the narrow frustum's center. */
const MOBILE_ORB_COUNT = 3
const MOBILE_X_SCALE = 0.4

interface Orb {
  mesh: Mesh
  seed: OrbSeed
  /** Damped avoidance offset (mutated in place — no per-frame allocations). */
  ox: number
  oy: number
}

export class AuroraScene {
  readonly scene: Scene
  readonly camera: PerspectiveCamera

  private readonly renderer: WebGLRenderer
  private readonly isMobile: boolean

  private readonly gradientGeo: PlaneGeometry
  private readonly gradientMat: ShaderMaterial
  private readonly gradient: Mesh

  private readonly orbGeo: SphereGeometry
  private readonly orbMat: MeshPhysicalMaterial
  private readonly orbs: Orb[]

  private readonly keyLight: DirectionalLight
  private envTexture: Texture | null = null

  private readonly composer: EffectComposer
  private readonly dof: DepthOfFieldEffect | null

  private readonly lookTarget = new Vector3(0, 0, 0)
  private aspect = 1

  // Shared uniform objects — updated once per frame from `apply()`.
  private readonly uTime = { value: 0 }
  private readonly uResolution = { value: new Vector2(1, 1) }
  private readonly uCursor = { value: new Vector2(0, 0) }
  private readonly uCursorStrength = { value: 0 }
  private readonly uExcite = { value: 0 }
  private readonly uScroll = { value: 0 }
  private readonly uStarT = { value: 0 }
  private readonly uStarSeed = { value: 0 }
  private readonly uVideoMix = { value: 0 }
  private readonly uVideo: { value: Texture }

  /** 1×1 black placeholder so the video sampler is always bound. */
  private readonly videoFallback: DataTexture
  private videoTexture: VideoTexture | null = null

  constructor(renderer: WebGLRenderer, opts: AuroraSceneOptions) {
    this.renderer = renderer
    this.isMobile = opts.isMobile

    this.videoFallback = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1)
    this.videoFallback.needsUpdate = true
    this.uVideo = { value: this.videoFallback }

    this.scene = new Scene()
    this.camera = new PerspectiveCamera(
      opts.isMobile ? FOV_MOBILE : FOV_DESKTOP,
      1,
      0.1,
      60,
    )
    this.camera.position.set(0, 0, CAMERA_Z)

    // --- environment (glass needs soft highlights to read as glass) ---------
    const pmrem = new PMREMGenerator(renderer)
    const room = new RoomEnvironment()
    this.envTexture = pmrem.fromScene(room, 0.04).texture
    this.scene.environment = this.envTexture
    room.dispose()
    pmrem.dispose()

    // --- dawn gradient field -------------------------------------------------
    this.gradientGeo = new PlaneGeometry(1, 1)
    this.gradientMat = new ShaderMaterial({
      vertexShader: auroraVert,
      fragmentShader: auroraFrag,
      uniforms: {
        uTime: this.uTime,
        uResolution: this.uResolution,
        uCursor: this.uCursor,
        uCursorStrength: this.uCursorStrength,
        uExcite: this.uExcite,
        uScroll: this.uScroll,
        uStarT: this.uStarT,
        uStarSeed: this.uStarSeed,
        uVideoMix: this.uVideoMix,
        uVideo: this.uVideo,
        uBase: { value: COL_BASE },
        uLav: { value: COL_LAV },
        uBlush: { value: COL_BLUSH },
        uMint: { value: COL_MINT },
        uSky: { value: COL_SKY },
      },
      depthWrite: false,
      depthTest: false,
    })
    this.gradient = new Mesh(this.gradientGeo, this.gradientMat)
    this.gradient.position.z = PLANE_Z
    this.gradient.renderOrder = -1
    this.gradient.frustumCulled = false
    this.scene.add(this.gradient)

    // --- glass orbs ------------------------------------------------------------
    const segments = opts.isMobile ? 32 : 48
    this.orbGeo = new SphereGeometry(1, segments, segments)
    this.orbMat = new MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: 1,
      thickness: 1.4,
      roughness: 0.12,
      ior: 1.42,
      iridescence: 0.4,
      iridescenceIOR: 1.3,
      clearcoat: 0.5,
      clearcoatRoughness: 0.3,
      envMapIntensity: 0.55,
      attenuationColor: new Color('#6630c0'), /* deep amethyst glass */
      attenuationDistance: 5,
    })

    const seeds = opts.isMobile
      ? ORB_SEEDS.slice(0, MOBILE_ORB_COUNT)
      : ORB_SEEDS
    this.orbs = seeds.map((seed) => {
      const mesh = new Mesh(this.orbGeo, this.orbMat)
      const x = opts.isMobile ? seed.x * MOBILE_X_SCALE : seed.x
      mesh.position.set(x, seed.y, seed.z)
      mesh.scale.setScalar(seed.r)
      this.scene.add(mesh)
      return { mesh, seed, ox: 0, oy: 0 }
    })

    // --- light (env does most of it; this sculpts one warm dawn highlight) ---
    this.keyLight = new DirectionalLight(0xfff3e4, 0.85)
    this.keyLight.position.set(4, 6, 8)
    this.scene.add(this.keyLight)

    // --- post stack ------------------------------------------------------------
    this.composer = new EffectComposer(renderer, {
      frameBufferType: HalfFloatType,
    })
    this.composer.addPass(new RenderPass(this.scene, this.camera))

    this.dof = opts.withDof
      ? new DepthOfFieldEffect(this.camera, {
          focusDistance: CAMERA_Z,
          focusRange: 4.2,
          bokehScale: 3,
          resolutionScale: 0.5,
        })
      : null

    // Post-DoF film grain re-dithers the pastel ramps wherever the bokeh
    // softened the in-shader grain; SMAA cleans the orb silhouettes.
    const noise = new NoiseEffect({ premultiply: true })
    noise.blendMode.opacity.value = 0.16
    const smaa = new SMAAEffect({ preset: SMAAPreset.MEDIUM })

    const effects = this.dof ? [this.dof, noise, smaa] : [noise, smaa]
    this.composer.addPass(new EffectPass(this.camera, ...effects))
  }

  /** Pre-compile shaders while the transition overlay covers the screen. */
  async compile(): Promise<void> {
    await this.renderer.compileAsync(this.scene, this.camera)
    // One warm render so transmission targets + post shaders exist too.
    this.composer.render(1 / 60)
  }

  /**
   * Adopt the generated dawn-sky clip as the gradient's luminous underlay.
   * The scene owns the resulting texture; the caller keeps the element
   * (play/pause + teardown of the media itself).
   */
  setSkyVideo(video: HTMLVideoElement): void {
    this.videoTexture?.dispose()
    this.videoTexture = new VideoTexture(video)
    this.videoTexture.colorSpace = SRGBColorSpace
    this.uVideo.value = this.videoTexture
  }

  apply(s: AuroraState, dt: number): void {
    this.uTime.value = s.time
    this.uCursor.value.set(s.cursorX, s.cursorY)
    this.uCursorStrength.value = s.cursorStrength
    this.uExcite.value = s.excite
    this.uScroll.value = s.scroll
    this.uStarT.value = s.starT
    this.uStarSeed.value = s.starSeed
    this.uVideoMix.value = s.videoMix

    const t = s.time
    const fovHalf = MathUtils.degToRad(this.camera.fov * 0.5)
    const tanHalf = Math.tan(fovHalf)

    for (let i = 0; i < this.orbs.length; i++) {
      const orb = this.orbs[i]
      if (!orb) continue
      const { seed, mesh } = orb

      // Noise-ish drift: incommensurate sines so paths never repeat visibly.
      const baseX = this.isMobile ? seed.x * MOBILE_X_SCALE : seed.x
      const px =
        baseX +
        Math.sin(t * seed.sp + seed.ph) * seed.ax +
        Math.sin(t * seed.sp * 0.53 + seed.ph * 2.1) * seed.ax * 0.4
      const py =
        seed.y +
        Math.cos(t * seed.sp * 0.81 + seed.ph) * seed.ay +
        Math.sin(t * seed.sp * 0.37 + seed.ph * 1.4) * seed.ay * 0.35
      const pz = seed.z + Math.sin(t * seed.sp * 0.45 + seed.ph) * 0.5

      // Cursor projected onto this orb's depth plane — orbs shy away.
      const dist = CAMERA_Z - pz
      const halfH = tanHalf * dist
      const cx = s.cursorX * halfH * this.aspect
      const cy = s.cursorY * halfH
      const dx = px - cx
      const dy = py - cy
      const d2 = dx * dx + dy * dy
      const push = Math.min(
        Math.exp(-d2 / 5.5) * 2.4 * s.cursorStrength,
        1.8,
      )
      const invLen = 1 / Math.max(Math.sqrt(d2), 0.001)

      // Project-hover impulse nudges orbs gently away from center.
      const cLen = Math.max(Math.hypot(px, py), 0.001)
      const ix = (px / cLen) * s.impulse * 0.7
      const iy = (py / cLen) * s.impulse * 0.7

      orb.ox = damp(orb.ox, dx * invLen * push + ix, 2.0, dt)
      orb.oy = damp(orb.oy, dy * invLen * push + iy, 2.0, dt)

      mesh.position.set(px + orb.ox, py + orb.oy, pz)
      mesh.scale.setScalar(seed.r * (1 + Math.sin(t * 0.5 + seed.ph) * 0.03))
    }

    // Gentle camera sway toward the cursor (already damped by the theme).
    this.camera.position.set(s.parallaxX * 0.55, s.parallaxY * 0.35, CAMERA_Z)
    this.camera.lookAt(this.lookTarget)

    if (this.dof) {
      this.dof.cocMaterial.focusDistance = clamp(s.focus, 1, 30)
      this.dof.bokehScale = 3 + s.excite * 0.8
    }
  }

  render(dt: number): void {
    this.composer.render(dt)
  }

  resize(width: number, height: number, dpr: number): void {
    this.aspect = width / Math.max(height, 1)
    this.camera.aspect = this.aspect
    this.camera.fov = width < 768 ? FOV_MOBILE : FOV_DESKTOP
    this.camera.updateProjectionMatrix()

    // Scale the gradient plane to overfill the frustum at its depth, with
    // margin for the camera sway.
    const planeDist = CAMERA_Z - PLANE_Z
    const halfH = Math.tan(MathUtils.degToRad(this.camera.fov * 0.5)) * planeDist
    this.gradient.scale.set(
      halfH * 2 * this.aspect * 1.12,
      halfH * 2 * 1.12,
      1,
    )

    this.uResolution.value.set(width * dpr, height * dpr)
    // Same dimensions ThemeManager already applied to the renderer — this
    // only resizes the composer's internal buffers.
    this.composer.setSize(width, height, false)
  }

  dispose(): void {
    this.composer.dispose()
    this.gradientGeo.dispose()
    this.gradientMat.dispose()
    this.orbGeo.dispose()
    this.orbMat.dispose()
    this.videoTexture?.dispose()
    this.videoTexture = null
    this.uVideo.value = this.videoFallback
    this.videoFallback.dispose()
    if (this.envTexture) {
      this.envTexture.dispose()
      this.envTexture = null
    }
    this.scene.environment = null
    this.scene.clear()
  }
}
