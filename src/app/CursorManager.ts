/**
 * CursorManager — global custom cursor + pointer state for shaders.
 *
 * - `pos`      raw pointer position (px, immediately updated on pointermove)
 * - `lerped`   damped position (drives the #cursor element)
 * - `velocity` lightly smoothed pointer velocity in px/s
 * - `ndc`      normalized device coords in -1..1, y up — feed straight into
 *              shader uniforms or camera parallax
 *
 * The #cursor element is fixed, pointer-events: none, z-index 200. Themes
 * style it via `[data-theme='<id>'] #cursor .cursor-dot { ... }` and switch
 * modes with `setMode()` (reflected as `data-mode` on the element).
 *
 * On touch devices the element is hidden and tracking is effectively inert.
 */

import { damp } from '../utils/math'
import type { Ticker } from './Ticker'
import type { Viewport } from './Viewport'

export interface Vec2 {
  x: number
  y: number
}

/** Damping lambdas — tuned for a trailing-but-attentive feel. */
const POSITION_LAMBDA = 14
const VELOCITY_LAMBDA = 8

/**
 * Below this (px and px/s) the damping has converged on an idle pointer —
 * skip the math and, crucially, the per-frame style.transform write.
 */
const SETTLE_EPSILON = 0.05

const INTERACTIVE_SELECTOR = 'a[href], button, [data-cursor]'

export class CursorManager {
  readonly pos: Vec2 = { x: 0, y: 0 }
  readonly lerped: Vec2 = { x: 0, y: 0 }
  readonly velocity: Vec2 = { x: 0, y: 0 }
  readonly ndc: Vec2 = { x: 0, y: 0 }
  readonly el: HTMLElement

  private readonly viewport: Viewport
  private readonly unsubscribeTicker: () => void
  private readonly prev: Vec2 = { x: 0, y: 0 }
  private hasMoved = false

  constructor(ticker: Ticker, viewport: Viewport, el: HTMLElement) {
    this.viewport = viewport
    this.el = el

    this.el.dataset.mode = 'default'
    const dot = document.createElement('span')
    dot.className = 'cursor-dot'
    this.el.appendChild(dot)

    if (viewport.isTouch) {
      // No custom cursor on touch — the element stays hidden, state stays 0,
      // and there is nothing for the ticker to update.
      this.el.style.display = 'none'
      this.setMode('hidden')
      this.unsubscribeTicker = () => {}
    } else {
      window.addEventListener('pointermove', this.onPointerMove, {
        passive: true,
      })
      // Priority -5: after scroll (-10), before theme update (0).
      this.unsubscribeTicker = ticker.add(this.update, -5)
    }
  }

  /** Set the cursor mode ('default' | 'hover' | 'hidden' | any custom). */
  setMode(mode: string): void {
    this.el.dataset.mode = mode
  }

  /**
   * Delegated hover detection for interactive elements inside `rootEl`
   * (a[href], button, [data-cursor]). A `data-cursor="<mode>"` attribute
   * selects a custom mode. Returns a cleanup function — themes MUST call
   * it in `dispose()`.
   */
  bind(rootEl: HTMLElement): () => void {
    const onOver = (e: Event): void => {
      const target = e.target
      if (!(target instanceof Element)) return
      const interactive = target.closest(INTERACTIVE_SELECTOR)
      if (!interactive || !rootEl.contains(interactive)) return
      const custom = interactive.getAttribute('data-cursor')
      this.setMode(custom !== null && custom !== '' ? custom : 'hover')
    }

    const onOut = (e: Event): void => {
      const target = e.target
      if (!(target instanceof Element)) return
      if (target.closest(INTERACTIVE_SELECTOR)) this.setMode('default')
    }

    rootEl.addEventListener('pointerover', onOver, { passive: true })
    rootEl.addEventListener('pointerout', onOut, { passive: true })

    return () => {
      rootEl.removeEventListener('pointerover', onOver)
      rootEl.removeEventListener('pointerout', onOut)
      this.setMode('default')
    }
  }

  dispose(): void {
    window.removeEventListener('pointermove', this.onPointerMove)
    this.unsubscribeTicker()
  }

  private onPointerMove = (e: PointerEvent): void => {
    this.pos.x = e.clientX
    this.pos.y = e.clientY
    if (!this.hasMoved) {
      // Snap everything to the first known position — no fly-in from (0,0).
      this.hasMoved = true
      this.lerped.x = this.pos.x
      this.lerped.y = this.pos.y
      this.prev.x = this.pos.x
      this.prev.y = this.pos.y
      this.el.classList.add('is-active')
    }
  }

  private update = (dt: number): void => {
    if (!this.hasMoved || dt <= 0) return

    // Settled: pointer idle and damping converged to sub-pixel residue.
    // Skip everything (including the style.transform write) — the next
    // pointermove breaks the position check and updates resume.
    if (
      Math.abs(this.pos.x - this.lerped.x) < SETTLE_EPSILON &&
      Math.abs(this.pos.y - this.lerped.y) < SETTLE_EPSILON &&
      Math.abs(this.velocity.x) < SETTLE_EPSILON &&
      Math.abs(this.velocity.y) < SETTLE_EPSILON
    ) {
      return
    }

    // Damped position (framerate independent).
    this.lerped.x = damp(this.lerped.x, this.pos.x, POSITION_LAMBDA, dt)
    this.lerped.y = damp(this.lerped.y, this.pos.y, POSITION_LAMBDA, dt)

    // Velocity in px/s, lightly smoothed.
    const vx = (this.pos.x - this.prev.x) / dt
    const vy = (this.pos.y - this.prev.y) / dt
    this.velocity.x = damp(this.velocity.x, vx, VELOCITY_LAMBDA, dt)
    this.velocity.y = damp(this.velocity.y, vy, VELOCITY_LAMBDA, dt)
    this.prev.x = this.pos.x
    this.prev.y = this.pos.y

    // NDC: -1..1, y up — shader-ready.
    this.ndc.x = (this.lerped.x / this.viewport.width) * 2 - 1
    this.ndc.y = -((this.lerped.y / this.viewport.height) * 2 - 1)

    this.el.style.transform = `translate3d(${this.lerped.x}px, ${this.lerped.y}px, 0)`
  }
}
