/**
 * TransitionOverlay — full-screen shader wipe that covers theme switches.
 *
 * Runs on its OWN small WebGL context (#transition-canvas, z-index 150) so
 * it can keep rendering while the shared theme renderer is being handed
 * from one theme to the next. A single fullscreen triangle + ShaderMaterial
 * draws an fbm-noise dissolve (near-black, subtle film grain) that is
 * deliberately theme-agnostic.
 *
 * `show()` animates uProgress 0 → 1 (~550 ms), `hide()` reverses it and
 * sets `display: none` when idle so the extra context costs nothing
 * between switches. With prefers-reduced-motion the wipe degrades to a
 * simple opacity fade.
 */

import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  OrthographicCamera,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
} from 'three'
import { clamp, easeInOutCubic } from '../utils/math'
import type { Ticker } from './Ticker'
import type { Viewport } from './Viewport'
import fragmentShader from './shaders/transition.frag'
import vertexShader from './shaders/transition.vert'

const WIPE_DURATION = 0.55 // seconds
const FADE_DURATION = 0.25 // reduced-motion fallback
const OVERLAY_DPR_CAP = 1.5 // noise doesn't need retina density

export class TransitionOverlay {
  private readonly canvas: HTMLCanvasElement
  private readonly ticker: Ticker
  private readonly viewport: Viewport
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private readonly material: ShaderMaterial
  private readonly geometry: BufferGeometry

  private unsubscribeViewport: () => void
  private unsubscribeTicker: (() => void) | null = null
  private pendingResolve: (() => void) | null = null
  private time = 0
  private visible = false

  constructor(canvas: HTMLCanvasElement, ticker: Ticker, viewport: Viewport) {
    this.canvas = canvas
    this.ticker = ticker
    this.viewport = viewport

    this.renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'low-power',
      depth: false,
      stencil: false,
    })
    this.renderer.setClearColor(0x000000, 0)

    // Fullscreen triangle — covers clip space with zero overdraw seams.
    this.geometry = new BufferGeometry()
    this.geometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    )

    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uProgress: { value: 0 },
        uTime: { value: 0 },
        uResolution: { value: new Vector2(1, 1) },
      },
    })

    const mesh = new Mesh(this.geometry, this.material)
    mesh.frustumCulled = false
    this.scene.add(mesh)

    this.applySize()
    this.unsubscribeViewport = viewport.on(() => this.applySize())
  }

  /** Animate the wipe in (0 → 1). Resolves when the screen is covered. */
  show(): Promise<void> {
    return this.viewport.reducedMotion ? this.fade(1) : this.wipe(1)
  }

  /** Animate the wipe out (1 → 0), then hide the canvas entirely. */
  async hide(): Promise<void> {
    if (this.viewport.reducedMotion) await this.fade(0)
    else await this.wipe(0)
    this.setVisible(false)
  }

  dispose(): void {
    this.unsubscribeTicker?.()
    this.unsubscribeTicker = null
    this.pendingResolve?.() // never leave an awaiting caller dangling
    this.pendingResolve = null
    this.unsubscribeViewport()
    this.geometry.dispose()
    this.material.dispose()
    this.renderer.dispose()
  }

  // --- internals ----------------------------------------------------------

  private get progress(): number {
    return this.material.uniforms.uProgress?.value as number
  }

  private set progress(v: number) {
    const uniform = this.material.uniforms.uProgress
    if (uniform) uniform.value = v
  }

  private wipe(target: 0 | 1): Promise<void> {
    this.canvas.style.opacity = '1'
    return this.animate(target, WIPE_DURATION, (t, from) => {
      this.progress = from + (target - from) * easeInOutCubic(t)
    })
  }

  /** Reduced-motion fallback: solid cover, opacity-only fade. */
  private fade(target: 0 | 1): Promise<void> {
    this.progress = 1
    const from = parseFloat(this.canvas.style.opacity || '0') || 0
    return this.animate(target, FADE_DURATION, (t) => {
      this.canvas.style.opacity = String(from + (target - from) * t)
    })
  }

  private animate(
    target: 0 | 1,
    duration: number,
    apply: (t: number, from: number) => void,
  ): Promise<void> {
    // Preempt any in-flight animation: stop its ticker AND resolve its
    // promise so an awaiting caller never dangles (latent leak/hang if
    // show()/hide() ever overlap).
    this.unsubscribeTicker?.()
    this.unsubscribeTicker = null
    this.pendingResolve?.()
    this.pendingResolve = null

    this.setVisible(true)
    const from = this.progress

    return new Promise((resolve) => {
      this.pendingResolve = resolve
      let t = 0
      this.unsubscribeTicker = this.ticker.add((dt) => {
        t = clamp(t + dt / duration, 0, 1)
        this.time += dt
        const uTime = this.material.uniforms.uTime
        if (uTime) uTime.value = this.time
        apply(t, from)
        this.render()
        if (t >= 1) {
          this.progress = target
          this.unsubscribeTicker?.()
          this.unsubscribeTicker = null
          this.pendingResolve = null
          resolve()
        }
      }, 100) // priority 100: render after everything else on the frame
    })
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera)
  }

  private setVisible(visible: boolean): void {
    if (this.visible === visible) return
    this.visible = visible
    this.canvas.style.display = visible ? 'block' : 'none'
  }

  private applySize(): void {
    const dpr = Math.min(this.viewport.dpr, OVERLAY_DPR_CAP)
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(this.viewport.width, this.viewport.height, false)
    const res = this.material.uniforms.uResolution?.value as Vector2
    res.set(this.viewport.width * dpr, this.viewport.height * dpr)
    if (this.visible) this.render()
  }
}
