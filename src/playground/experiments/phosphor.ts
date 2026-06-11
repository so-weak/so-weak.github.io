/**
 * 003 PHOSPHOR — CRT emulation.
 *
 * A procedural broadcast test card (fullscreen pass) plus a rotating
 * wireframe torus knot are rendered into an offscreen target, then the
 * whole frame is replayed through a CRT pass: barrel distortion, radial
 * RGB shift, scanlines, phosphor triad mask, rolling band, flicker.
 */

import {
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  TorusKnotGeometry,
  Vector2,
  WebGLRenderTarget,
} from 'three'
import type { WebGLRenderer } from 'three'
import { damp } from '../../utils/math'
import type { Viewport } from '../../app/Viewport'
import type { CursorNdc, Experiment, ExperimentFactory } from '../types'
import { FullscreenPass } from '../fullscreen'
import cardFrag from '../shaders/phosphor-card.frag'
import crtFrag from '../shaders/phosphor-crt.frag'

class Phosphor implements Experiment {
  private renderer!: WebGLRenderer
  private rt: WebGLRenderTarget | null = null
  private cardPass: FullscreenPass | null = null
  private crtPass: FullscreenPass | null = null

  private readonly knotScene = new Scene()
  private readonly knotCamera = new PerspectiveCamera(50, 1, 0.1, 20)
  private knotGeometry: TorusKnotGeometry | null = null
  private knotMaterial: MeshBasicMaterial | null = null
  private knot: Mesh | null = null

  private readonly uCardTime = { value: 0 }
  private readonly uCardResolution = { value: new Vector2(1, 1) }
  private readonly uCrtTime = { value: 0 }
  private readonly uCrtResolution = { value: new Vector2(1, 1) }
  private readonly uCurvature = { value: 0.12 }
  private readonly uChroma = { value: 1 }

  init(renderer: WebGLRenderer, viewport: Viewport): void {
    this.renderer = renderer

    this.cardPass = new FullscreenPass(cardFrag, {
      uTime: this.uCardTime,
      uResolution: this.uCardResolution,
    })
    this.crtPass = new FullscreenPass(crtFrag, {
      uTex: { value: null },
      uTime: this.uCrtTime,
      uResolution: this.uCrtResolution,
      uCurvature: this.uCurvature,
      uChroma: this.uChroma,
    })

    this.knotGeometry = new TorusKnotGeometry(
      0.55,
      0.16,
      viewport.isMobile ? 90 : 160,
      viewport.isMobile ? 12 : 18,
    )
    this.knotMaterial = new MeshBasicMaterial({
      color: 0x9cffd0,
      wireframe: true,
      transparent: true,
      opacity: 0.85,
    })
    this.knot = new Mesh(this.knotGeometry, this.knotMaterial)
    this.knot.position.set(0, 0.18, 0)
    this.knotScene.add(this.knot)
    this.knotCamera.position.set(0, 0, 2.7)
  }

  update(dt: number, elapsed: number, cursor: CursorNdc): void {
    if (!this.rt || !this.cardPass || !this.crtPass) return

    this.uCardTime.value = elapsed
    this.uCrtTime.value = elapsed

    // Cursor X bends the tube, cursor Y splits the beams.
    const safeDt = Math.max(dt, 1e-4)
    this.uCurvature.value = damp(this.uCurvature.value, 0.1 + (cursor.x * 0.5 + 0.5) * 0.18, 4, safeDt)
    this.uChroma.value = damp(this.uChroma.value, 0.4 + (cursor.y * 0.5 + 0.5) * 2.4, 4, safeDt)

    if (this.knot) {
      this.knot.rotation.x += dt * 0.5
      this.knot.rotation.y += dt * 0.34
    }

    // Pass 1: test card into the target (autoClear wipes it first).
    this.cardPass.render(this.renderer, this.rt)

    // Pass 2: knot on top of the card, same target, no clear.
    const prevAutoClear = this.renderer.autoClear
    this.renderer.autoClear = false
    this.renderer.render(this.knotScene, this.knotCamera)
    this.renderer.autoClear = prevAutoClear

    // Pass 3: CRT replay to screen.
    const uniforms = this.crtPass.material.uniforms
    if (uniforms.uTex) uniforms.uTex.value = this.rt.texture
    this.crtPass.render(this.renderer, null)
  }

  resize(width: number, height: number, dpr: number): void {
    const rw = Math.max(2, Math.round(width * dpr))
    const rh = Math.max(2, Math.round(height * dpr))
    this.rt?.dispose()
    this.rt = new WebGLRenderTarget(rw, rh, {
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
    })
    this.uCardResolution.value.set(rw, rh)
    this.uCrtResolution.value.set(rw, rh)
    this.knotCamera.aspect = width / height
    this.knotCamera.updateProjectionMatrix()
  }

  dispose(): void {
    this.rt?.dispose()
    this.rt = null
    this.cardPass?.dispose()
    this.cardPass = null
    this.crtPass?.dispose()
    this.crtPass = null
    if (this.knot) this.knotScene.remove(this.knot)
    this.knot = null
    this.knotGeometry?.dispose()
    this.knotGeometry = null
    this.knotMaterial?.dispose()
    this.knotMaterial = null
    this.renderer.setRenderTarget(null)
    this.renderer.autoClear = true
  }
}

const factory: ExperimentFactory = () => new Phosphor()
export default factory
