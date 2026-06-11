/**
 * 005 SIGNED — raymarched SDF composition.
 *
 * The entire scene lives in one fragment shader: a smooth-min blend of
 * a rounded box, torus and orbiting spheres, sphere-traced with
 * penumbra soft shadows, four-tap AO and a fresnel rim. March depth is
 * compiled in via #define so mobile gets a cheaper kernel.
 */

import { Vector2 } from 'three'
import type { WebGLRenderer } from 'three'
import { damp } from '../../utils/math'
import type { Viewport } from '../../app/Viewport'
import type { CursorNdc, Experiment, ExperimentFactory } from '../types'
import { FullscreenPass } from '../fullscreen'
import signedFragRaw from '../shaders/signed.frag'

class Signed implements Experiment {
  private renderer!: WebGLRenderer
  private pass: FullscreenPass | null = null

  private readonly uTime = { value: 0 }
  private readonly uResolution = { value: new Vector2(1, 1) }
  private readonly uCursor = { value: new Vector2(0, 0) }

  init(renderer: WebGLRenderer, viewport: Viewport): void {
    this.renderer = renderer
    const maxSteps = viewport.isMobile ? 64 : 100
    const shadowSteps = viewport.isMobile ? 16 : 28
    const frag = `#define MAX_STEPS ${maxSteps}\n#define SHADOW_STEPS ${shadowSteps}\n${signedFragRaw}`
    this.pass = new FullscreenPass(frag, {
      uTime: this.uTime,
      uResolution: this.uResolution,
      uCursor: this.uCursor,
    })
  }

  update(dt: number, elapsed: number, cursor: CursorNdc): void {
    if (!this.pass) return
    const safeDt = Math.max(dt, 1e-4)
    this.uTime.value = elapsed
    // Damped orbit so the camera glides rather than snaps.
    this.uCursor.value.set(
      damp(this.uCursor.value.x, cursor.x, 3, safeDt),
      damp(this.uCursor.value.y, cursor.y, 3, safeDt),
    )
    this.pass.render(this.renderer, null)
  }

  resize(width: number, height: number, dpr: number): void {
    this.uResolution.value.set(width * dpr, height * dpr)
  }

  dispose(): void {
    this.pass?.dispose()
    this.pass = null
    this.renderer.setRenderTarget(null)
  }
}

const factory: ExperimentFactory = () => new Signed()
export default factory
