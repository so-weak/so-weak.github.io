/**
 * 002 ADVECT — ping-pong FBO cursor fluid-trail.
 *
 * Two half-float render targets alternate read/write. The update pass
 * performs semi-Lagrangian self-advection of a velocity + dye field and
 * splats the cursor in; the composite pass uses the settled field to
 * displace a fine line pattern and glow the dye through it.
 */

import {
  ClampToEdgeWrapping,
  HalfFloatType,
  LinearFilter,
  RGBAFormat,
  Vector2,
  WebGLRenderTarget,
} from 'three'
import type { WebGLRenderer } from 'three'
import { clamp } from '../../utils/math'
import type { Viewport } from '../../app/Viewport'
import type { CursorNdc, Experiment, ExperimentFactory } from '../types'
import { FullscreenPass } from '../fullscreen'
import updateFrag from '../shaders/advect-update.frag'
import compositeFrag from '../shaders/advect-composite.frag'

const MAX_FIELD_SIZE = 720

class Advect implements Experiment {
  private renderer!: WebGLRenderer
  private rtA: WebGLRenderTarget | null = null
  private rtB: WebGLRenderTarget | null = null
  private updatePass: FullscreenPass | null = null
  private compositePass: FullscreenPass | null = null

  private readonly uDt = { value: 1 / 60 }
  private readonly uAspect = { value: 1 }
  private readonly uCursor = { value: new Vector2(0.5, 0.5) }
  private readonly uCursorVel = { value: new Vector2(0, 0) }
  private readonly uTime = { value: 0 }
  private readonly uResolution = { value: new Vector2(1, 1) }

  private readonly prevUv = { x: 0.5, y: 0.5 }
  private hasCursor = false

  init(renderer: WebGLRenderer, viewport: Viewport): void {
    this.renderer = renderer

    this.updatePass = new FullscreenPass(updateFrag, {
      uPrev: { value: null },
      uDt: this.uDt,
      uAspect: this.uAspect,
      uCursor: this.uCursor,
      uCursorVel: this.uCursorVel,
      uRadius: { value: viewport.isMobile ? 0.006 : 0.0035 },
      uDissipation: { value: 0.965 },
    })
    this.compositePass = new FullscreenPass(compositeFrag, {
      uField: { value: null },
      uTime: this.uTime,
      uResolution: this.uResolution,
    })

    this.allocateTargets(viewport.width, viewport.height)
  }

  private allocateTargets(width: number, height: number): void {
    this.rtA?.dispose()
    this.rtB?.dispose()
    const scale = Math.min(1, MAX_FIELD_SIZE / Math.max(width, height))
    const rw = Math.max(64, Math.round(width * scale))
    const rh = Math.max(64, Math.round(height * scale))
    const options = {
      type: HalfFloatType,
      format: RGBAFormat,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      wrapS: ClampToEdgeWrapping,
      wrapT: ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
    } as const
    this.rtA = new WebGLRenderTarget(rw, rh, options)
    this.rtB = new WebGLRenderTarget(rw, rh, options)
  }

  update(dt: number, elapsed: number, cursor: CursorNdc): void {
    if (!this.rtA || !this.rtB || !this.updatePass || !this.compositePass) return

    const u = cursor.x * 0.5 + 0.5
    const v = cursor.y * 0.5 + 0.5
    if (!this.hasCursor) {
      this.hasCursor = true
      this.prevUv.x = u
      this.prevUv.y = v
    }
    const safeDt = Math.max(dt, 1e-3)
    const velScale = 1 / safeDt
    const vx = clamp((u - this.prevUv.x) * velScale, -3, 3)
    const vy = clamp((v - this.prevUv.y) * velScale, -3, 3)
    this.prevUv.x = u
    this.prevUv.y = v

    this.uDt.value = safeDt
    this.uTime.value = elapsed
    this.uCursor.value.set(u, v)
    this.uCursorVel.value.set(vx, vy)

    // Feedback: read A, write B, swap.
    const uniforms = this.updatePass.material.uniforms
    if (uniforms.uPrev) uniforms.uPrev.value = this.rtA.texture
    this.updatePass.render(this.renderer, this.rtB)
    const tmp = this.rtA
    this.rtA = this.rtB
    this.rtB = tmp

    // Composite the settled field to screen.
    const cUniforms = this.compositePass.material.uniforms
    if (cUniforms.uField) cUniforms.uField.value = this.rtA.texture
    this.compositePass.render(this.renderer, null)
  }

  resize(width: number, height: number, dpr: number): void {
    this.uAspect.value = width / height
    this.uResolution.value.set(width * dpr, height * dpr)
    this.allocateTargets(width, height)
  }

  dispose(): void {
    this.rtA?.dispose()
    this.rtB?.dispose()
    this.rtA = null
    this.rtB = null
    this.updatePass?.dispose()
    this.updatePass = null
    this.compositePass?.dispose()
    this.compositePass = null
    this.renderer.setRenderTarget(null)
  }
}

const factory: ExperimentFactory = () => new Advect()
export default factory
