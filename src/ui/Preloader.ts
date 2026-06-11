/**
 * Preloader — covers the page (z 300) from first paint until the initial
 * theme has mounted. Guarantees a minimum 800 ms display so the wordmark
 * never strobes, then animates away (opacity + clip-path) and removes
 * itself from the DOM. Reduced motion: a quick fade.
 */

import './preloader.css'

const MIN_DISPLAY_MS = 800
const EXIT_MS = 700
const EXIT_REDUCED_MS = 200

export class Preloader {
  private readonly el: HTMLElement
  private readonly shownAt: number
  private hidden = false

  constructor(el: HTMLElement) {
    this.el = el
    this.shownAt = performance.now()

    this.el.innerHTML = `
      <div class="sg-preloader__inner">
        <p class="sg-preloader__wordmark">Soubhik&nbsp;Ghosh</p>
        <p class="sg-preloader__role">AI/ML Engineer</p>
        <div class="sg-preloader__bar" role="presentation">
          <span class="sg-preloader__shimmer"></span>
        </div>
      </div>
    `
  }

  /**
   * Resolve once the preloader has fully animated out and been removed.
   * Call after the first theme mounts.
   */
  async hide(reducedMotion: boolean): Promise<void> {
    if (this.hidden) return
    this.hidden = true

    // Honor the minimum display time.
    const shownFor = performance.now() - this.shownAt
    const remaining = Math.max(0, MIN_DISPLAY_MS - shownFor)
    if (remaining > 0) await delay(remaining)

    this.el.classList.add(reducedMotion ? 'is-leaving-reduced' : 'is-leaving')
    await delay(reducedMotion ? EXIT_REDUCED_MS : EXIT_MS)
    this.el.remove()
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
