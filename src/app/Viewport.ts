/**
 * Viewport — single source of truth for window dimensions, device pixel
 * ratio, input modality and the `prefers-reduced-motion` media query.
 *
 * Resize events are coalesced through a one-shot Ticker subscription so
 * listeners (renderer sizing, theme layout) fire at most once per frame —
 * the Ticker owns the only rAF loop on the page.
 */

import type { Ticker } from './Ticker'

export type ViewportCallback = (v: Viewport) => void
export type ReducedMotionCallback = (reduced: boolean) => void

const MOBILE_BREAKPOINT = 768
const DPR_CAP = 2

export class Viewport {
  private widthPx: number
  private heightPx: number
  private dprValue: number
  private touch: boolean
  private reduced: boolean

  private listeners = new Set<ViewportCallback>()
  private rmListeners = new Set<ReducedMotionCallback>()
  private offResizeTick: (() => void) | null = null
  private readonly rmQuery: MediaQueryList
  private dprQuery: MediaQueryList | null = null

  constructor(private readonly ticker: Ticker) {
    this.widthPx = window.innerWidth
    this.heightPx = window.innerHeight
    this.dprValue = Math.min(window.devicePixelRatio || 1, DPR_CAP)
    this.touch =
      window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window

    this.rmQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    this.reduced = this.rmQuery.matches

    window.addEventListener('resize', this.onResize)
    this.rmQuery.addEventListener('change', this.onReducedMotion)
    this.watchDpr()
  }

  get width(): number {
    return this.widthPx
  }

  get height(): number {
    return this.heightPx
  }

  /** Device pixel ratio, capped at 2 — anything higher is wasted fill rate. */
  get dpr(): number {
    return this.dprValue
  }

  get isMobile(): boolean {
    return this.widthPx < MOBILE_BREAKPOINT
  }

  get isTouch(): boolean {
    return this.touch
  }

  get reducedMotion(): boolean {
    return this.reduced
  }

  /** Subscribe to coalesced resize events. Returns unsubscribe. */
  on(cb: ViewportCallback): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  /** Subscribe to `prefers-reduced-motion` changes. Returns unsubscribe. */
  onReducedMotionChange(cb: ReducedMotionCallback): () => void {
    this.rmListeners.add(cb)
    return () => this.rmListeners.delete(cb)
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize)
    this.rmQuery.removeEventListener('change', this.onReducedMotion)
    this.dprQuery?.removeEventListener('change', this.onDprChange)
    this.dprQuery = null
    this.offResizeTick?.()
    this.offResizeTick = null
    this.listeners.clear()
    this.rmListeners.clear()
  }

  private onResize = (): void => {
    if (this.offResizeTick) return
    // One-shot, priority -1: after scroll/cursor, before the theme renders,
    // so the frame draws at the new size.
    this.offResizeTick = this.ticker.add(() => {
      this.offResizeTick?.()
      this.offResizeTick = null
      this.widthPx = window.innerWidth
      this.heightPx = window.innerHeight
      this.dprValue = Math.min(window.devicePixelRatio || 1, DPR_CAP)
      for (const cb of this.listeners) cb(this)
    }, -1)
  }

  private onReducedMotion = (e: MediaQueryListEvent): void => {
    this.reduced = e.matches
    for (const cb of this.rmListeners) cb(this.reduced)
  }

  /**
   * DPR-only changes (e.g. dragging the window between monitors with
   * different pixel densities) don't reliably fire a window resize event.
   * Watch a `resolution` media query matching the CURRENT DPR — it flips
   * to non-matching the moment the DPR changes — and re-arm it for the
   * new value each time.
   */
  private watchDpr(): void {
    this.dprQuery?.removeEventListener('change', this.onDprChange)
    this.dprQuery = window.matchMedia(
      `(resolution: ${window.devicePixelRatio}dppx)`,
    )
    this.dprQuery.addEventListener('change', this.onDprChange)
  }

  private onDprChange = (): void => {
    this.watchDpr() // re-arm against the new DPR
    this.onResize() // same coalesced path: re-reads size + DPR, notifies
  }
}
