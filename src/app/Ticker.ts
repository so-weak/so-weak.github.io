/**
 * Ticker — owns THE ONLY requestAnimationFrame loop on the page.
 *
 * Everything that animates (Lenis, cursor smoothing, theme update, transition
 * overlay) subscribes here with a priority so the frame order is explicit:
 *
 *   -10  ScrollManager  (Lenis raf — scroll state must precede everything)
 *    -5  CursorManager  (lerped position / velocity / ndc)
 *     0  ThemeManager   (active theme update + render)
 *   100  TransitionOverlay (renders above everything on its own canvas)
 *
 * dt is clamped to 1/20 s so a background-tab pause or GC stall never
 * produces a physics/animation spike. The loop pauses on `document.hidden`
 * and resumes with a fresh timestamp — no dt jump on return.
 */

export type TickerCallback = (dt: number, elapsed: number) => void

interface TickerEntry {
  fn: TickerCallback
  priority: number
}

const MAX_DT = 1 / 20 // 50 ms

export class Ticker {
  private entries: TickerEntry[] = []
  private rafId: number | null = null
  private running = false
  private last = 0
  private elapsedTime = 0

  constructor() {
    document.addEventListener('visibilitychange', this.onVisibilityChange)
  }

  /** Seconds the ticker has been running (sum of clamped dts). */
  get elapsed(): number {
    return this.elapsedTime
  }

  /**
   * Subscribe a frame callback. Lower priority runs first.
   * Returns an unsubscribe function — always call it in `dispose()`.
   */
  add(fn: TickerCallback, priority = 0): () => void {
    const entry: TickerEntry = { fn, priority }
    this.entries.push(entry)
    // Stable order for equal priorities: sort is stable per spec since ES2019.
    this.entries.sort((a, b) => a.priority - b.priority)
    return () => {
      const i = this.entries.indexOf(entry)
      if (i !== -1) this.entries.splice(i, 1)
    }
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.last = performance.now()
    this.rafId = requestAnimationFrame(this.loop)
  }

  stop(): void {
    this.running = false
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  dispose(): void {
    this.stop()
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    this.entries.length = 0
  }

  private loop = (now: number): void => {
    if (!this.running) return
    this.rafId = requestAnimationFrame(this.loop)

    const dt = Math.min((now - this.last) / 1000, MAX_DT)
    this.last = now
    this.elapsedTime += dt

    // Iterate a snapshot so callbacks can safely unsubscribe mid-frame.
    const snapshot = this.entries.slice()
    for (const entry of snapshot) entry.fn(dt, this.elapsedTime)
  }

  private onVisibilityChange = (): void => {
    if (document.hidden) {
      // Halt the loop entirely — don't burn frames in a hidden tab.
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId)
        this.rafId = null
      }
    } else if (this.running && this.rafId === null) {
      // Resume with a fresh timestamp so dt doesn't spike.
      this.last = performance.now()
      this.rafId = requestAnimationFrame(this.loop)
    }
  }
}
