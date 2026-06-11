/**
 * VanGoghScene — the living Starry Night, painted in three layers.
 *
 * LAYER 0 — UNDERPAINTING: the generated Higgsfield paint clip (VideoTexture;
 * poster frame on mobile/reduced motion) sampled through a domain-warped fbm
 * sky shader and palette-graded toward the active chapter — a structural
 * layer, not a garnish. LAYER 1 — GLAZE: a DAWN-style procedural fbm glaze
 * (prussian/cyan, rare chrome-yellow blooms, dithered grain) fused over it in
 * the same fullscreen pass, so the sky stands alone when the manifest says
 * no. LAYER 2 — IMPASTO: a single instanced draw of 950–3400 tapered
 * brush-stroke quads advected by a curl-noise flow field, eight star knots
 * whose vortices tighten the paint into spirals, and additive halos beneath.
 *
 * The theme drives everything through `apply(state)` once per frame; chapter
 * palettes (night → wheat → café terrace → calm night) are lerped on the CPU
 * into shared uniforms that feed sky and strokes alike. All GL resources are
 * released in `dispose()`.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  DataTexture,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  NormalBlending,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  Vector4,
  VideoTexture,
  type Texture,
  type WebGLRenderer,
} from 'three'
import { clamp, lerp } from '../../utils/math'
import strokeVert from './shaders/stroke.vert'
import strokeFrag from './shaders/stroke.frag'
import haloVert from './shaders/halo.vert'
import haloFrag from './shaders/halo.frag'
import skyVert from './shaders/sky.vert'
import skyFrag from './shaders/sky.frag'

export interface VanGoghState {
  /** Field time in seconds (frozen in the reduced-motion static frame). */
  time: number
  /** Cursor stir: position in field space + scaled velocity + strength. */
  stirX: number
  stirY: number
  stirVX: number
  stirVY: number
  stirAmt: number
  /** Konami STARRY VORTEX envelope 0..1. */
  vortex: number
  /** Scroll chapter 0..3 (hero night → wheat → café → calm night). */
  chapter: number
  /** Supernova progress on the brightest star: 0 = inactive, else 0..1. */
  novaT: number
  /** Underpainting (generated clip / poster) prominence 0..1 (0 = layer off). */
  videoMix: number
}

export interface VanGoghSceneOptions {
  /** Instanced stroke count (the theme passes ~3400 desktop / ~950 mobile). */
  instances: number
  /** Base stroke length in field units (mobile uses fewer, larger strokes). */
  strokeSize: number
}

interface ChapterDef {
  bg: Color
  a: Color
  b: Color
  c: Color
  warm: Color
  bias: number
  swirl: number
  starAmt: number
  flowScale: number
  crawl: number
}

const ch = (
  bg: string,
  a: string,
  b: string,
  c: string,
  warm: string,
  bias: number,
  swirl: number,
  starAmt: number,
  flowScale: number,
  crawl: number,
): ChapterDef => ({
  bg: new Color(bg),
  a: new Color(a),
  b: new Color(b),
  c: new Color(c),
  warm: new Color(warm),
  bias,
  swirl,
  starAmt,
  flowScale,
  crawl,
})

/**
 * Chapter keyframes — hero (full-swirl night), about/experience (wheat-field
 * ochres, horizontal sweep), projects (café-terrace warm yellows on deep
 * blue), contact (the calmest night).
 *
 * Chapter 1's swirl mid + bloom are clamped to ~0.82 of the raw wheat ochres
 * (#d9a441 / #f0d27e): the DOM paints its ochre eyebrows and ivory titles
 * STRAIGHT onto this sky through about/experience, and the unclamped glaze
 * could brighten to the exact luminance of that text. The warm stroke accent
 * keeps the full #e8b54a, so the impasto still glints like ripe wheat.
 */
const CHAPTERS: readonly ChapterDef[] = [
  ch('#0e1a3a', '#1a2a52', '#4f7bd9', '#f5c842', '#f5c842', 0.0, 1.0, 1.0, 1.55, 0.34),
  ch('#1d1610', '#6b4d1d', '#b28635', '#c5ac67', '#e8b54a', 0.85, 0.28, 0.35, 1.1, 0.42),
  ch('#16213f', '#23355f', '#e3a93c', '#ffd95e', '#f5c842', 0.18, 0.6, 0.8, 1.4, 0.3),
  ch('#0c1733', '#13224a', '#3f66bd', '#f5c842', '#f5c842', 0.0, 0.45, 0.9, 1.2, 0.22),
] as const

/**
 * Art-directed star knots in normalized square space (x scaled by aspect on
 * resize). Index 0 is the brightest — the supernova egg target.
 * Components: x, y, radius (field units), strength.
 */
const STAR_SEEDS: readonly [number, number, number, number][] = [
  [0.52, 0.55, 0.3, 1.25],
  [-0.62, 0.62, 0.22, 0.95],
  [-0.25, 0.38, 0.16, 0.7],
  [0.15, 0.68, 0.14, 0.65],
  [0.82, 0.18, 0.15, 0.6],
  [-0.85, 0.1, 0.13, 0.55],
  [0.3, 0.05, 0.12, 0.5],
  [-0.45, -0.35, 0.11, 0.45],
] as const

const STAR_COUNT = STAR_SEEDS.length
const STAR_X_FIT = 0.88

/** Smoothstep for the chapter blend. */
const smooth = (t: number): number => t * t * (3 - 2 * t)

/** Build a unit quad (positions + uv + index) into a geometry. */
function unitQuad(geo: InstancedBufferGeometry): void {
  const positions = new Float32Array([
    -0.5, -0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 0,
  ])
  const uvs = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])
  geo.setAttribute('position', new BufferAttribute(positions, 3))
  geo.setAttribute('uv', new BufferAttribute(uvs, 2))
  geo.setIndex(new BufferAttribute(new Uint16Array([0, 1, 2, 2, 1, 3]), 1))
}

export class VanGoghScene {
  readonly scene: Scene
  readonly camera: OrthographicCamera

  private readonly renderer: WebGLRenderer

  private readonly skyGeo: PlaneGeometry
  private readonly skyMat: ShaderMaterial
  private readonly strokeGeo: InstancedBufferGeometry
  private readonly strokeMat: ShaderMaterial
  private readonly haloGeo: InstancedBufferGeometry
  private readonly haloMat: ShaderMaterial

  /** 1×1 deep-prussian placeholder so the media sampler is always bound. */
  private readonly mapFallback: DataTexture
  private videoTexture: VideoTexture | null = null
  private posterTexture: Texture | null = null
  private posterAspect = 16 / 9
  private videoEl: HTMLVideoElement | null = null

  private aspect = 1

  // Shared uniforms — mutated in place every frame, never reallocated.
  // `bg` doubles as the clear color AND the sky shader's chapter ground.
  private readonly bg = new Color('#0e1a3a')
  private readonly uBg = { value: this.bg }
  private readonly uTime = { value: 0 }
  private readonly uAspect = { value: 1 }
  private readonly uResolution = { value: new Vector2(1, 1) }
  private readonly uSize = { value: 0.085 }
  private readonly uCrawl = { value: 0.34 }
  private readonly uFlowScale = { value: 1.55 }
  private readonly uBiasAmt = { value: 0 }
  private readonly uSwirl = { value: 1 }
  private readonly uVortex = { value: 0 }
  private readonly uStirAmt = { value: 0 }
  private readonly uStir = { value: new Vector4(0, 0, 0, 0) }
  private readonly uNova = { value: new Vector4(0, 0, 0, 0) }
  private readonly uNovaT = { value: 0 }
  private readonly uStars = {
    value: STAR_SEEDS.map(([x, y, r, s]) => new Vector4(x, y, r, s)),
  }
  private readonly uStarAmt = { value: 1 }
  private readonly uColA = { value: new Color() }
  private readonly uColB = { value: new Color() }
  private readonly uColC = { value: new Color() }
  private readonly uWarm = { value: new Color() }
  private readonly uEmber = { value: new Color('#d4502e') }
  private readonly uMix = { value: 0 }
  private readonly uMediaAspect = { value: 16 / 9 }
  private readonly uMap: { value: Texture }

  constructor(renderer: WebGLRenderer, opts: VanGoghSceneOptions) {
    this.renderer = renderer
    this.scene = new Scene()
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.uSize.value = opts.strokeSize

    this.mapFallback = new DataTexture(
      new Uint8Array([14, 26, 58, 255]), // #0e1a3a — the deep prussian ground
      1,
      1,
    )
    this.mapFallback.needsUpdate = true
    this.uMap = { value: this.mapFallback }

    // --- LAYERS 0+1: underpainting + glaze (one fullscreen pass) --------------
    this.skyGeo = new PlaneGeometry(2, 2)
    this.skyMat = new ShaderMaterial({
      vertexShader: skyVert,
      fragmentShader: skyFrag,
      uniforms: {
        uMap: this.uMap,
        uMix: this.uMix,
        uMediaAspect: this.uMediaAspect,
        uTime: this.uTime,
        uAspect: this.uAspect,
        uResolution: this.uResolution,
        uStir: this.uStir,
        uStirAmt: this.uStirAmt,
        uVortex: this.uVortex,
        uBg: this.uBg,
        uColA: this.uColA,
        uColB: this.uColB,
        uColC: this.uColC,
      },
      depthWrite: false,
      depthTest: false,
    })
    const sky = new Mesh(this.skyGeo, this.skyMat)
    sky.frustumCulled = false
    sky.renderOrder = -2
    this.scene.add(sky)

    // --- LAYER 2: instanced stroke field ----------------------------------------
    const count = Math.max(64, Math.floor(opts.instances))
    this.strokeGeo = new InstancedBufferGeometry()
    unitQuad(this.strokeGeo)
    this.strokeGeo.instanceCount = count

    const seeds = new Float32Array(count * 4)
    const shapes = new Float32Array(count * 4)
    for (let i = 0; i < count; i++) {
      seeds[i * 4 + 0] = Math.random()
      seeds[i * 4 + 1] = Math.random()
      seeds[i * 4 + 2] = Math.random()
      seeds[i * 4 + 3] = Math.random()
      shapes[i * 4 + 0] = Math.random()
      shapes[i * 4 + 1] = Math.random()
      shapes[i * 4 + 2] = Math.random()
      shapes[i * 4 + 3] = Math.random()
    }
    this.strokeGeo.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 4))
    this.strokeGeo.setAttribute('aShape', new InstancedBufferAttribute(shapes, 4))

    this.strokeMat = new ShaderMaterial({
      vertexShader: strokeVert,
      fragmentShader: strokeFrag,
      uniforms: {
        uTime: this.uTime,
        uAspect: this.uAspect,
        uSize: this.uSize,
        uCrawl: this.uCrawl,
        uFlowScale: this.uFlowScale,
        uBiasAmt: this.uBiasAmt,
        uSwirl: this.uSwirl,
        uVortex: this.uVortex,
        uStirAmt: this.uStirAmt,
        uStir: this.uStir,
        uNova: this.uNova,
        uStars: this.uStars,
        uStarAmt: this.uStarAmt,
        uColA: this.uColA,
        uColB: this.uColB,
        uColC: this.uColC,
        uWarm: this.uWarm,
      },
      transparent: true,
      blending: NormalBlending,
      depthWrite: false,
      depthTest: false,
    })
    const strokes = new Mesh(this.strokeGeo, this.strokeMat)
    strokes.frustumCulled = false
    strokes.renderOrder = 0
    this.scene.add(strokes)

    // --- star halos (between sky and paint) ---------------------------------------
    this.haloGeo = new InstancedBufferGeometry()
    unitQuad(this.haloGeo)
    this.haloGeo.instanceCount = STAR_COUNT
    const indices = new Float32Array(STAR_COUNT)
    for (let i = 0; i < STAR_COUNT; i++) indices[i] = i
    this.haloGeo.setAttribute('aIndex', new InstancedBufferAttribute(indices, 1))

    this.haloMat = new ShaderMaterial({
      vertexShader: haloVert,
      fragmentShader: haloFrag,
      uniforms: {
        uStars: this.uStars,
        uAspect: this.uAspect,
        uTime: this.uTime,
        uVortex: this.uVortex,
        uNovaT: this.uNovaT,
        uStarAmt: this.uStarAmt,
        uWarm: this.uWarm,
        uEmber: this.uEmber,
      },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    })
    const halos = new Mesh(this.haloGeo, this.haloMat)
    halos.frustumCulled = false
    halos.renderOrder = -1
    this.scene.add(halos)

    this.applyChapter(0)
  }

  /** Pre-compile shaders while the transition overlay covers the screen. */
  async compile(): Promise<void> {
    await this.renderer.compileAsync(this.scene, this.camera)
  }

  /**
   * Adopt the generated paint clip as the sky's underpainting. The scene
   * owns the resulting texture; the caller keeps the element (play/pause +
   * teardown of the media itself).
   */
  setSkyVideo(video: HTMLVideoElement): void {
    this.videoTexture?.dispose()
    this.videoTexture = new VideoTexture(video)
    this.videoTexture.colorSpace = SRGBColorSpace
    this.videoEl = video
    this.uMap.value = this.videoTexture
    this.syncMediaAspect()
  }

  /**
   * Adopt a still (the clip's poster frame) as the underpainting — the
   * mobile / reduced-motion path; the warp field churns it instead of the
   * footage. Ownership of the texture transfers to the scene.
   */
  setSkyPoster(texture: Texture, aspect: number): void {
    this.posterTexture?.dispose()
    this.posterTexture = texture
    this.posterTexture.colorSpace = SRGBColorSpace
    // A paused/never-started video may sit behind a live poster; the still wins.
    this.videoEl = null
    this.uMap.value = this.posterTexture
    if (aspect > 0) {
      this.posterAspect = aspect
      this.uMediaAspect.value = aspect
    }
  }

  /**
   * Re-bind the already-adopted poster still as the underpainting — the
   * fallback when the clip dies or holds no decoded frame yet (a frameless
   * VideoTexture samples black and would dim the sky). Returns false when
   * no poster has ever been adopted.
   */
  rebindSkyPoster(): boolean {
    if (!this.posterTexture) return false
    this.videoEl = null
    this.uMap.value = this.posterTexture
    this.uMediaAspect.value = this.posterAspect
    return true
  }

  apply(s: VanGoghState): void {
    this.uTime.value = s.time
    this.uVortex.value = s.vortex
    this.uStirAmt.value = s.stirAmt
    this.uStir.value.set(s.stirX, s.stirY, s.stirVX, s.stirVY)
    this.uMix.value = s.videoMix
    this.syncMediaAspect()

    // Supernova rides the brightest star (index 0).
    const star = this.uStars.value[0]
    if (star && s.novaT > 0) {
      this.uNova.value.set(star.x, star.y, s.novaT, 1)
    } else {
      this.uNova.value.set(0, 0, 0, 0)
    }
    this.uNovaT.value = s.novaT

    this.applyChapter(s.chapter)
  }

  render(): void {
    this.renderer.setClearColor(this.bg, 1)
    this.renderer.render(this.scene, this.camera)
  }

  resize(width: number, height: number, dpr: number): void {
    this.aspect = width / Math.max(height, 1)
    this.uAspect.value = this.aspect
    this.uResolution.value.set(width * dpr, height * dpr)
    // Re-fit the art-directed stars into the visible field.
    for (let i = 0; i < STAR_COUNT; i++) {
      const seed = STAR_SEEDS[i]
      const v = this.uStars.value[i]
      if (!seed || !v) continue
      v.set(seed[0] * this.aspect * STAR_X_FIT, seed[1], seed[2], seed[3])
    }
  }

  /** Screen-space position (CSS px) of the brightest star — the egg target. */
  brightestStarScreen(width: number, height: number): { x: number; y: number } {
    const star = this.uStars.value[0]
    if (!star) return { x: -9999, y: -9999 }
    const ndcX = star.x / Math.max(this.aspect, 1e-4)
    const ndcY = star.y
    return {
      x: (ndcX * 0.5 + 0.5) * width,
      y: (1 - (ndcY * 0.5 + 0.5)) * height,
    }
  }

  dispose(): void {
    this.skyGeo.dispose()
    this.skyMat.dispose()
    this.strokeGeo.dispose()
    this.strokeMat.dispose()
    this.haloGeo.dispose()
    this.haloMat.dispose()
    this.videoTexture?.dispose()
    this.videoTexture = null
    this.posterTexture?.dispose()
    this.posterTexture = null
    this.videoEl = null
    this.uMap.value = this.mapFallback
    this.mapFallback.dispose()
    this.scene.clear()
  }

  // --- internals ---------------------------------------------------------------

  /** Track the clip's true aspect once metadata lands (cheap property reads). */
  private syncMediaAspect(): void {
    const v = this.videoEl
    if (v && v.videoWidth > 0 && v.videoHeight > 0) {
      this.uMediaAspect.value = v.videoWidth / v.videoHeight
    }
  }

  private applyChapter(chapter: number): void {
    const c = clamp(chapter, 0, CHAPTERS.length - 1)
    const i0 = Math.min(Math.floor(c), CHAPTERS.length - 2)
    const f = smooth(clamp(c - i0, 0, 1))
    const a = CHAPTERS[i0] ?? CHAPTERS[0]
    const b = CHAPTERS[i0 + 1] ?? a
    if (!a || !b) return

    this.bg.lerpColors(a.bg, b.bg, f)
    this.uColA.value.lerpColors(a.a, b.a, f)
    this.uColB.value.lerpColors(a.b, b.b, f)
    this.uColC.value.lerpColors(a.c, b.c, f)
    this.uWarm.value.lerpColors(a.warm, b.warm, f)
    this.uBiasAmt.value = lerp(a.bias, b.bias, f)
    this.uSwirl.value = lerp(a.swirl, b.swirl, f)
    this.uStarAmt.value = lerp(a.starAmt, b.starAmt, f)
    this.uFlowScale.value = lerp(a.flowScale, b.flowScale, f)
    this.uCrawl.value = lerp(a.crawl, b.crawl, f)
  }
}
