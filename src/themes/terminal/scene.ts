/**
 * TERMINAL NOIR — background GL scene.
 *
 * A sparse phosphor point-cloud globe (fibonacci sphere + wireframe
 * icosahedron) drifting in slow rotation behind the dossier DOM, plus a
 * faint glyph-dust shell for depth. Rendered through a CRT post chain:
 * phosphor bloom → custom CRT effect (barrel distortion, scanlines,
 * edge chromatic aberration, vignette, subtle flicker).
 *
 * Reduced motion: rotation/parallax/flicker freeze — a static composed
 * frame keeps rendering so theme switches and resizes stay correct.
 */

import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  HalfFloatType,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineSegments,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  Uniform,
  WireframeGeometry,
  type WebGLRenderer,
} from 'three'
import {
  BlendFunction,
  BloomEffect,
  Effect,
  EffectAttribute,
  EffectComposer,
  EffectPass,
  RenderPass,
} from 'postprocessing'
import { damp } from '../../utils/math'
import crtFragment from './crt.frag'

const GLOBE_POINTS_DESKTOP = 1500
const GLOBE_POINTS_MOBILE = 620
const DUST_DESKTOP = 320
const DUST_MOBILE = 130
const GLOBE_RADIUS = 1.12

class CRTEffect extends Effect {
  constructor() {
    super('TerminalCRTEffect', crtFragment, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([
        ['uTime', new Uniform(0)],
        ['uFlicker', new Uniform(0)],
        ['uScanCount', new Uniform(1200)],
        ['uScanIntensity', new Uniform(0.11)],
        ['uDistortion', new Uniform(0.085)],
        ['uAberration', new Uniform(0.0022)],
        ['uVignette', new Uniform(0.8)],
      ]),
    })
  }
}

/** Fibonacci-distributed points on a sphere with phosphor/amber colors. */
function buildGlobePoints(count: number): BufferGeometry {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const green = new Color('#33ff66')
  const amber = new Color('#ffb000')
  const golden = Math.PI * (3 - Math.sqrt(5))

  for (let i = 0; i < count; i++) {
    const y = count > 1 ? 1 - (i / (count - 1)) * 2 : 0
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i
    positions[i * 3] = Math.cos(theta) * r * GLOBE_RADIUS
    positions[i * 3 + 1] = y * GLOBE_RADIUS
    positions[i * 3 + 2] = Math.sin(theta) * r * GLOBE_RADIUS

    // ~5% amber beacons among the phosphor green.
    const c = Math.random() < 0.05 ? amber : green
    const dim = 0.45 + Math.random() * 0.55
    colors[i * 3] = c.r * dim
    colors[i * 3 + 1] = c.g * dim
    colors[i * 3 + 2] = c.b * dim
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return geometry
}

/** Sparse dust shell around the globe for parallax depth. */
function buildDust(count: number): BufferGeometry {
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const radius = 1.9 + Math.random() * 3.2
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(Math.random() * 2 - 1)
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = radius * Math.cos(phi) * 0.7
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta) - 1.2
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  return geometry
}

export class TerminalScene {
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(55, 1, 0.1, 30)
  private readonly group = new Group()

  private composer: EffectComposer | null = null
  private readonly geometries: BufferGeometry[] = []
  private readonly materials: Array<PointsMaterial | LineBasicMaterial> = []

  private crtTime: Uniform = new Uniform(0)
  private crtFlicker: Uniform = new Uniform(0)
  private crtScanCount: Uniform = new Uniform(1200)

  private reduced = false
  private rotY = 0
  private camX = 0
  private camY = 0
  /** Dust shell kept separate so it parallaxes at its own rate vs the globe. */
  private dust: Points | null = null
  /** Layout anchor for the group, set in resize(); scroll drift adds on top. */
  private baseY = 0
  /** Degauss wobble clock — >= DEGAUSS_S means inactive. */
  private degaussT = 99
  /** Frozen shader clock for the reduced-motion static frame. */
  private readonly frozenTime = 37.3

  constructor(renderer: WebGLRenderer) {
    this.renderer = renderer
  }

  async init(
    width: number,
    height: number,
    isMobile: boolean,
    reduced: boolean,
  ): Promise<void> {
    this.reduced = reduced
    this.camera.position.set(0, 0, 3)

    // Globe points.
    const globeGeometry = buildGlobePoints(
      isMobile ? GLOBE_POINTS_MOBILE : GLOBE_POINTS_DESKTOP,
    )
    const globeMaterial = new PointsMaterial({
      size: 0.021,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })
    const globe = new Points(globeGeometry, globeMaterial)
    this.geometries.push(globeGeometry)
    this.materials.push(globeMaterial)

    // Wireframe lattice under the points.
    const icosa = new IcosahedronGeometry(GLOBE_RADIUS * 0.995, isMobile ? 1 : 2)
    const wireGeometry = new WireframeGeometry(icosa)
    icosa.dispose()
    const wireMaterial = new LineBasicMaterial({
      color: 0x33ff66,
      transparent: true,
      opacity: 0.05,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    const wire = new LineSegments(wireGeometry, wireMaterial)
    this.geometries.push(wireGeometry)
    this.materials.push(wireMaterial)

    // Glyph dust.
    const dustGeometry = buildDust(isMobile ? DUST_MOBILE : DUST_DESKTOP)
    const dustMaterial = new PointsMaterial({
      size: 0.013,
      color: 0x2a9950,
      transparent: true,
      opacity: 0.45,
      blending: AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })
    const dust = new Points(dustGeometry, dustMaterial)
    this.geometries.push(dustGeometry)
    this.materials.push(dustMaterial)
    this.dust = dust

    this.group.add(globe, wire, dust)
    this.group.rotation.x = -0.18
    this.scene.add(this.group)

    this.renderer.setClearColor(0x050505, 1)

    // Post chain: render → phosphor bloom → CRT.
    const composer = new EffectComposer(this.renderer, {
      frameBufferType: HalfFloatType,
    })
    composer.addPass(new RenderPass(this.scene, this.camera))

    const bloom = new BloomEffect({
      intensity: 1.05,
      luminanceThreshold: 0.08,
      luminanceSmoothing: 0.35,
      mipmapBlur: true,
      radius: 0.72,
    })
    const crt = new CRTEffect()
    this.crtTime = crt.uniforms.get('uTime') ?? this.crtTime
    this.crtFlicker = crt.uniforms.get('uFlicker') ?? this.crtFlicker
    this.crtScanCount = crt.uniforms.get('uScanCount') ?? this.crtScanCount

    composer.addPass(new EffectPass(this.camera, bloom))
    composer.addPass(new EffectPass(this.camera, crt))
    this.composer = composer

    this.resize(width, height)

    // Compile while the transition overlay still covers the screen; one
    // warm-up composer pass compiles the post shaders too.
    await this.renderer.compileAsync(this.scene, this.camera)
    composer.render(0)
  }

  setReduced(reduced: boolean): void {
    this.reduced = reduced
    if (reduced) {
      // Settle to the layout anchor: no scroll drift, no wobble residue.
      this.group.position.y = this.baseY
      this.group.rotation.z = 0
      this.degaussT = 99
      if (this.dust) {
        this.dust.rotation.y = 0
        this.dust.position.y = 0
      }
    }
  }

  /** Konami spectacle — brief CRT degauss wobble + flicker surge. */
  degauss(): void {
    if (!this.reduced) this.degaussT = 0
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.composer?.setSize(width, height, false)

    // ~1 scanline per 3.5 physical-ish pixels, expressed for sin(uv.y * n).
    this.crtScanCount.value = (height * Math.PI * 2) / 3.5

    // Globe sits right-of-centre on desktop (content column is left-anchored),
    // centred and raised on narrow viewports.
    if (width < 768) {
      this.group.position.set(0, 0.45, -0.6)
      this.group.scale.setScalar(0.85)
      this.baseY = 0.45
    } else {
      const aspect = width / height
      this.group.position.set(Math.min(1.25, aspect * 0.46), 0.02, 0)
      this.group.scale.setScalar(1)
      this.baseY = 0.02
    }
  }

  update(
    dt: number,
    elapsed: number,
    scrollProgress: number,
    ndcX: number,
    ndcY: number,
  ): void {
    if (!this.composer) return

    if (this.reduced) {
      // Static composed frame: frozen clock, no flicker, no motion.
      this.crtTime.value = this.frozenTime
      this.crtFlicker.value = 0
    } else {
      this.rotY += dt * 0.045
      this.group.rotation.y = this.rotY + scrollProgress * 2.4
      this.group.rotation.x = -0.18 + scrollProgress * 0.3
      // Scroll parallax: the globe climbs while the dust shell counter-drifts
      // at its own rate, so the background visibly shears against the dossier.
      this.group.position.y = this.baseY + scrollProgress * 0.85
      if (this.dust) {
        this.dust.rotation.y = -this.rotY * 0.5 - scrollProgress * 1.3
        this.dust.position.y = scrollProgress * -0.55
      }

      this.camX = damp(this.camX, ndcX * 0.16, 2.5, dt)
      this.camY = damp(this.camY, ndcY * 0.1, 2.5, dt)
      this.camera.position.x = this.camX
      this.camera.position.y = this.camY
      // Slow dolly-in across the page — depth tied to scroll progress.
      this.camera.position.z = 3 - scrollProgress * 0.35
      this.camera.lookAt(0, 0, 0)

      this.crtTime.value = elapsed
      this.crtFlicker.value = 0.05

      // Degauss wobble: decaying camera roll + flicker surge for ~1.4 s.
      if (this.degaussT < 1.4) {
        this.degaussT += dt
        const k = Math.max(0, 1 - this.degaussT / 1.4)
        this.camera.rotateZ(Math.sin(this.degaussT * 46) * 0.02 * k)
        this.group.rotation.z = Math.sin(this.degaussT * 30) * 0.04 * k
        this.crtFlicker.value = 0.05 + 0.5 * k
        if (this.degaussT >= 1.4) this.group.rotation.z = 0
      }
    }

    this.composer.render(dt)
  }

  dispose(): void {
    this.composer?.dispose()
    this.composer = null
    this.dust = null
    for (const g of this.geometries) g.dispose()
    this.geometries.length = 0
    for (const m of this.materials) m.dispose()
    this.materials.length = 0
    this.scene.clear()
  }
}
