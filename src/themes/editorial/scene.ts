/**
 * EditorialScene — the WebGL whisper behind the printed page.
 *
 * Three quiet layers:
 *   1. A paper ground: the clear color IS the stock; a custom postprocessing
 *      Effect adds static fibre mottle, laid lines, animated print grain and
 *      a soft desk-light vignette (shaders/paper.frag).
 *   2. An ink dye field: a quarter-resolution ping-pong FBO advected each
 *      frame (shaders/ink.frag) — the damped cursor lays dye down like a nib
 *      resting on stock; it diffuses outward and slowly soaks away.
 *   3. One delicate object: a six-pointed extruded asterisk in matte ink,
 *      tumbling slowly in the hero, photographed through a very shallow
 *      depth of field. It drifts off the page as the reader scrolls.
 *
 * The theme drives everything through `apply(state)`; this module owns all
 * GL resources and releases them in `dispose()`.
 */

import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Camera,
  Color,
  DirectionalLight,
  ExtrudeGeometry,
  Group,
  HalfFloatType,
  LinearFilter,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  Shape,
  Uniform,
  Vector2,
  WebGLRenderTarget,
  type Texture,
  type WebGLRenderer,
} from 'three'
import {
  BlendFunction,
  DepthOfFieldEffect,
  Effect,
  EffectComposer,
  EffectPass,
  RenderPass,
} from 'postprocessing'
import paperFrag from './shaders/paper.frag'
import inkFrag from './shaders/ink.frag'
import quadVert from './shaders/quad.vert'

export interface EditorialState {
  /** Shader time in seconds (theme-scaled; frozen in static mode). */
  time: number
  /** Print grain amplitude. */
  grain: number
  /** Cursor parallax tilt, NDC-ish (-1..1). */
  tiltX: number
  tiltY: number
  /** Page scroll in px — floats the asterisk off the cover. */
  scrollPx: number
  /** Ink nib position in uv space (y up). */
  inkX: number
  inkY: number
  /** Dye laid down this frame (0 = pen up). */
  inkStrength: number
}

export interface EditorialSceneOptions {
  isMobile: boolean
  /** Skip the DoF pass entirely (mobile / reduced motion). */
  withDof: boolean
}

const PAPER = '#ddd0a8'   // aged newsprint — yellowed, not white
const INK = '#1a1508'    // warm brownish-black press ink
/** Oxidized iron-gall ink drying down to dark umber in the fibres. */
const DYE = '#3a2008'
const CAMERA_Z = 8
const INK_RES_SCALE = 0.25

class PaperEffect extends Effect {
  constructor() {
    super('EditorialPaperEffect', paperFrag, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ['uInk', new Uniform<Texture | null>(null)],
        ['uTime', new Uniform(0)],
        ['uGrainAmp', new Uniform(0.068)],  // heavier print grain on rougher stock
        ['uInkAmount', new Uniform(0.52)],  // ink soaks deeper into rougher fibres
        ['uInkColor', new Uniform(new Color(DYE))],
        ['uPx', new Uniform(new Vector2(1, 1))],
      ]),
    })
  }
}

/** Rounded-rectangle profile for one asterisk arm. */
function roundedBarShape(length: number, thickness: number): Shape {
  const w = length / 2
  const h = thickness / 2
  const r = h * 0.92
  const s = new Shape()
  s.moveTo(-w + r, -h)
  s.lineTo(w - r, -h)
  s.absarc(w - r, -h + r, r, -Math.PI / 2, 0, false)
  s.lineTo(w, h - r)
  s.absarc(w - r, h - r, r, 0, Math.PI / 2, false)
  s.lineTo(-w + r, h)
  s.absarc(-w + r, h - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(-w, -h + r)
  s.absarc(-w + r, -h + r, r, Math.PI, Math.PI * 1.5, false)
  return s
}

/** Clip-space fullscreen triangle — quad.vert ignores camera matrices. */
function fullscreenTriangle(): BufferGeometry {
  const geo = new BufferGeometry()
  geo.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
  )
  geo.setAttribute(
    'uv',
    new BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2),
  )
  return geo
}

export class EditorialScene {
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera: PerspectiveCamera
  private readonly composer: EffectComposer
  private readonly paper: PaperEffect
  private readonly dof: DepthOfFieldEffect | null

  // --- asterisk -------------------------------------------------------------
  private readonly asterisk = new Group()
  private readonly barGeo: ExtrudeGeometry
  private readonly barMat: MeshStandardMaterial
  private baseX = 0
  private baseY = 0
  private baseScale = 1

  // --- ink dye ping-pong ------------------------------------------------------
  private inkRead: WebGLRenderTarget
  private inkWrite: WebGLRenderTarget
  private readonly inkScene = new Scene()
  private readonly inkCamera = new Camera()
  private readonly inkGeo: BufferGeometry
  private readonly inkMat: ShaderMaterial
  private readonly inkPoint = new Vector2(0.5, 0.5)
  private readonly inkPrev = new Vector2(0.5, 0.5)
  private inkPrimed = false

  // Cached uniform handles (paper effect map lookups done once).
  private readonly uPaperInk: Uniform
  private readonly uPaperTime: Uniform
  private readonly uPaperGrain: Uniform
  private readonly uPaperPx: Uniform

  constructor(renderer: WebGLRenderer, opts: EditorialSceneOptions) {
    this.renderer = renderer

    this.scene.background = new Color(PAPER)
    this.camera = new PerspectiveCamera(35, 1, 0.1, 40)
    this.camera.position.set(0, 0, CAMERA_Z)

    // --- the ink asterisk ----------------------------------------------------
    this.barGeo = new ExtrudeGeometry(roundedBarShape(2.5, 0.5), {
      depth: 0.32,
      curveSegments: 12,
      bevelEnabled: true,
      bevelThickness: 0.055,
      bevelSize: 0.05,
      bevelSegments: 3,
    })
    this.barGeo.center()
    this.barMat = new MeshStandardMaterial({
      color: new Color(INK),
      roughness: 0.34,
      metalness: 0.14,
    })
    for (let i = 0; i < 3; i++) {
      const bar = new Mesh(this.barGeo, this.barMat)
      bar.rotation.z = (i * Math.PI) / 3
      this.asterisk.add(bar)
    }
    this.scene.add(this.asterisk)

    // Soft desk light + a faint vermilion bounce off the page.
    this.scene.add(new AmbientLight(0xf4f1ec, 1.0))
    const key = new DirectionalLight(0xfff4e4, 2.4)
    key.position.set(2.5, 3.5, 4.5)
    this.scene.add(key)
    const rim = new DirectionalLight(0xe0451f, 0.55)
    rim.position.set(-3, -2, 2)
    this.scene.add(rim)

    // --- ink dye sim ------------------------------------------------------------
    const rtOpts = {
      type: HalfFloatType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    } as const
    this.inkRead = new WebGLRenderTarget(2, 2, rtOpts)
    this.inkWrite = new WebGLRenderTarget(2, 2, rtOpts)

    this.inkGeo = fullscreenTriangle()
    this.inkMat = new ShaderMaterial({
      vertexShader: quadVert,
      fragmentShader: inkFrag,
      uniforms: {
        uPrev: { value: null },
        uTexel: { value: new Vector2(0.5, 0.5) },
        uPoint: { value: this.inkPoint },
        uPrevPoint: { value: this.inkPrev },
        uAspect: { value: 1 },
        uRadius: { value: 0.016 },
        uStrength: { value: 0 },
        uDecay: { value: 0.993 },
      },
      depthTest: false,
      depthWrite: false,
    })
    const tri = new Mesh(this.inkGeo, this.inkMat)
    tri.frustumCulled = false
    this.inkScene.add(tri)

    // --- post stack ----------------------------------------------------------------
    this.composer = new EffectComposer(renderer, {
      frameBufferType: HalfFloatType,
    })
    this.composer.addPass(new RenderPass(this.scene, this.camera))

    this.dof = opts.withDof
      ? new DepthOfFieldEffect(this.camera, {
          bokehScale: 2.3,
          resolutionScale: 0.5,
        })
      : null
    if (this.dof) {
      // Focus a touch in front of the asterisk plane — edges melt softly.
      this.dof.cocMaterial.worldFocusDistance = CAMERA_Z - 0.7
      this.dof.cocMaterial.worldFocusRange = 2.2
    }

    this.paper = new PaperEffect()
    const u = this.paper.uniforms
    const grab = (name: string): Uniform => {
      const found = u.get(name)
      if (!found) throw new Error(`[editorial] missing uniform ${name}`)
      return found
    }
    this.uPaperInk = grab('uInk')
    this.uPaperTime = grab('uTime')
    this.uPaperGrain = grab('uGrainAmp')
    this.uPaperPx = grab('uPx')

    const effects = this.dof ? [this.dof, this.paper] : [this.paper]
    this.composer.addPass(new EffectPass(this.camera, ...effects))

    this.placeAsterisk(opts.isMobile)
  }

  /** Pre-compile while the transition overlay covers the screen. */
  async compile(): Promise<void> {
    await this.renderer.compileAsync(this.scene, this.camera)
    // Zero both dye targets (strength 0, decay 0 writes pure black) and
    // warm up the sim + post shaders with one throwaway pass each.
    const decay = this.inkMat.uniforms['uDecay']
    const prevDecay = (decay?.value as number) ?? 0.993
    if (decay) decay.value = 0
    this.stepInk()
    this.stepInk()
    if (decay) decay.value = prevDecay
    this.composer.render(1 / 60)
  }

  apply(s: EditorialState): void {
    this.uPaperTime.value = s.time
    this.uPaperGrain.value = s.grain

    // Asterisk: slow tumble, cursor breathes on it, scroll floats it away.
    const a = this.asterisk
    a.rotation.x = s.time * 0.22 + s.tiltY * 0.22
    a.rotation.y = s.time * 0.17 + s.tiltX * 0.3
    a.rotation.z = s.time * 0.05
    a.position.x = this.baseX + s.tiltX * 0.1
    a.position.y =
      this.baseY + Math.sin(s.time * 0.6) * 0.07 + s.scrollPx * 0.0045
    a.scale.setScalar(this.baseScale)

    // Ink nib.
    this.inkPoint.set(s.inkX, s.inkY)
    if (!this.inkPrimed && s.inkStrength > 0) {
      this.inkPrev.copy(this.inkPoint)
      this.inkPrimed = true
    }
    const strength = this.inkMat.uniforms['uStrength']
    if (strength) strength.value = s.inkStrength
  }

  /** Render the frame. `advectInk` = run the dye sim (off in static mode). */
  render(dt: number, advectInk: boolean): void {
    if (advectInk) {
      this.stepInk()
      this.inkPrev.copy(this.inkPoint)
    }
    this.composer.render(dt)
  }

  resize(width: number, height: number, _dpr: number): void {
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.composer.setSize(width, height, false)

    const iw = Math.max(2, Math.round(width * INK_RES_SCALE))
    const ih = Math.max(2, Math.round(height * INK_RES_SCALE))
    this.inkRead.setSize(iw, ih)
    this.inkWrite.setSize(iw, ih)

    const texel = this.inkMat.uniforms['uTexel']
    if (texel) (texel.value as Vector2).set(1 / iw, 1 / ih)
    const aspect = this.inkMat.uniforms['uAspect']
    if (aspect) aspect.value = width / height
    ;(this.uPaperPx.value as Vector2).set(width, height)

    this.placeAsterisk(width < 768)
  }

  dispose(): void {
    this.composer.dispose()
    this.inkRead.dispose()
    this.inkWrite.dispose()
    this.inkGeo.dispose()
    this.inkMat.dispose()
    this.barGeo.dispose()
    this.barMat.dispose()
    this.scene.clear()
    this.inkScene.clear()
  }

  // --- internals --------------------------------------------------------------

  /** One dye advection step: read → write, swap, hand the result to paper. */
  private stepInk(): void {
    const prev = this.inkMat.uniforms['uPrev']
    if (prev) prev.value = this.inkRead.texture

    const previousTarget = this.renderer.getRenderTarget()
    this.renderer.setRenderTarget(this.inkWrite)
    this.renderer.render(this.inkScene, this.inkCamera)
    this.renderer.setRenderTarget(previousTarget)

    const swap = this.inkRead
    this.inkRead = this.inkWrite
    this.inkWrite = swap
    this.uPaperInk.value = this.inkRead.texture
  }

  private placeAsterisk(isMobile: boolean): void {
    if (isMobile) {
      this.baseX = 0
      this.baseY = 1.55
      this.baseScale = 0.52
    } else {
      this.baseX = 2.15
      this.baseY = -0.62
      this.baseScale = 0.92
    }
  }
}
