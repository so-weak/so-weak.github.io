/**
 * AmbientField — the idle-state shader strip glowing behind the index.
 * Implements the Experiment contract so the app treats it like any other
 * scene, plus a `setMood()` hook: hovering row N drifts the tint.
 */

import { Vector2 } from 'three'
import type { WebGLRenderer } from 'three'
import { damp } from '../utils/math'
import type { Viewport } from '../app/Viewport'
import type { CursorNdc, Experiment } from './types'
import { FullscreenPass } from './fullscreen'
import ambientFrag from './shaders/ambient.frag'

export class AmbientField implements Experiment {
  private renderer!: WebGLRenderer
  private pass: FullscreenPass | null = null

  private readonly uTime = { value: 0 }
  private readonly uResolution = { value: new Vector2(1, 1) }
  private readonly uCursor = { value: new Vector2(0, 0) }
  private readonly uMood = { value: 0 }
  private moodTarget = 0

  init(renderer: WebGLRenderer, _viewport: Viewport): void {
    this.renderer = renderer
    this.pass = new FullscreenPass(ambientFrag, {
      uTime: this.uTime,
      uResolution: this.uResolution,
      uCursor: this.uCursor,
      uMood: this.uMood,
    })
  }

  /** 0..1 across the index — shifts the field's tint toward the hovered row. */
  setMood(value: number): void {
    this.moodTarget = value
  }

  update(dt: number, elapsed: number, cursor: CursorNdc): void {
    if (!this.pass) return
    const safeDt = Math.max(dt, 1e-4)
    this.uTime.value = elapsed
    this.uMood.value = damp(this.uMood.value, this.moodTarget, 1.6, safeDt)
    this.uCursor.value.set(
      damp(this.uCursor.value.x, cursor.x, 2, safeDt),
      damp(this.uCursor.value.y, cursor.y, 2, safeDt),
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
