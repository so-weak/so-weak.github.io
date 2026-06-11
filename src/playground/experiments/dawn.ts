/**
 * 004 DAWN — domain-warped fbm gradient field.
 *
 * One fullscreen fragment shader: fbm warped through itself twice,
 * indexing a slowly cycling cosine palette, finished with hash-dithered
 * grain. The cursor drifts the domain; cursor Y deepens the warp.
 */

import { Vector2 } from 'three'
import type { WebGLRenderer } from 'three'
import { damp } from '../../utils/math'
import type { Viewport } from '../../app/Viewport'
import type { CursorNdc, Experiment, ExperimentFactory } from '../types'
import { FullscreenPass } from '../fullscreen'
import dawnFrag from '../shaders/dawn.frag'

class Dawn implements Experiment {
  private renderer!: WebGLRenderer
  private pass: FullscreenPass | null = null

  private readonly uTime = { value: 0 }
  private readonly uPhase = { value: 0 }
  private readonly uWarp = { value: 1 }
  private readonly uResolution = { value: new Vector2(1, 1) }
  private readonly uCursor = { value: new Vector2(0, 0) }

  init(renderer: WebGLRenderer, _viewport: Viewport): void {
    this.renderer = renderer
    this.pass = new FullscreenPass(dawnFrag, {
      uTime: this.uTime,
      uPhase: this.uPhase,
      uWarp: this.uWarp,
      uResolution: this.uResolution,
      uCursor: this.uCursor,
    })
  }

  update(dt: number, elapsed: number, cursor: CursorNdc): void {
    if (!this.pass) return
    const safeDt = Math.max(dt, 1e-4)

    this.uTime.value = elapsed
    // Palette cycles on its own; cursor X nudges it through the spectrum.
    this.uPhase.value = elapsed * 0.012 + cursor.x * 0.07
    this.uWarp.value = damp(this.uWarp.value, 0.85 + (cursor.y * 0.5 + 0.5) * 0.5, 3, safeDt)
    this.uCursor.value.set(
      damp(this.uCursor.value.x, cursor.x, 2.5, safeDt),
      damp(this.uCursor.value.y, cursor.y, 2.5, safeDt),
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

const factory: ExperimentFactory = () => new Dawn()
export default factory
