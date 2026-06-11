/**
 * ScrollManager — wraps a single Lenis instance on the window root.
 *
 * Lenis runs with `autoRaf: false`; the Ticker drives `lenis.raf()` at
 * priority -10 so smooth-scroll state is fully resolved before the cursor,
 * the active theme, or anything else reads it on the same frame.
 *
 * Themes may retune the feel in `init()` via `configure()`; the
 * ThemeManager restores defaults and scrolls to top on every switch.
 */

import Lenis from 'lenis'
import type { Ticker } from './Ticker'

export interface ScrollState {
  scroll: number
  limit: number
  progress: number
  velocity: number
}

export interface ScrollToOptions {
  offset?: number
  immediate?: boolean
  duration?: number
}

export interface ScrollConfig {
  lerp?: number
  smoothWheel?: boolean
  enabled?: boolean
}

export const SCROLL_DEFAULTS = Object.freeze({
  lerp: 0.1,
  smoothWheel: true,
  enabled: true,
} satisfies Required<ScrollConfig>)

export class ScrollManager {
  readonly lenis: Lenis

  private readonly unsubscribeTicker: () => void

  constructor(ticker: Ticker) {
    this.lenis = new Lenis({
      autoRaf: false,
      lerp: SCROLL_DEFAULTS.lerp,
      smoothWheel: SCROLL_DEFAULTS.smoothWheel,
    })

    // Priority -10: scroll state precedes every other frame consumer.
    this.unsubscribeTicker = ticker.add(() => {
      this.lenis.raf(performance.now())
    }, -10)
  }

  get scroll(): number {
    return this.lenis.scroll
  }

  get limit(): number {
    return this.lenis.limit
  }

  get progress(): number {
    return this.lenis.progress
  }

  get velocity(): number {
    return this.lenis.velocity
  }

  /** Subscribe to scroll updates. Returns unsubscribe. */
  on(cb: (s: ScrollState) => void): () => void {
    return this.lenis.on('scroll', () => {
      cb({
        scroll: this.lenis.scroll,
        limit: this.lenis.limit,
        progress: this.lenis.progress,
        velocity: this.lenis.velocity,
      })
    })
  }

  scrollTo(
    target: number | string | HTMLElement,
    opts?: ScrollToOptions,
  ): void {
    this.lenis.scrollTo(target, opts)
  }

  /**
   * Retune scroll feel at runtime. Themes may call this in `init()`;
   * ThemeManager calls `configure(SCROLL_DEFAULTS)` on every switch.
   */
  configure(opts: ScrollConfig): void {
    if (opts.lerp !== undefined) this.lenis.options.lerp = opts.lerp
    if (opts.smoothWheel !== undefined) {
      this.lenis.options.smoothWheel = opts.smoothWheel
    }
    if (opts.enabled !== undefined) {
      if (opts.enabled) this.lenis.start()
      else this.lenis.stop()
    }
  }

  /** Recompute scroll limits — call after building or altering theme DOM. */
  resize(): void {
    this.lenis.resize()
  }

  dispose(): void {
    this.unsubscribeTicker()
    this.lenis.destroy()
  }
}
