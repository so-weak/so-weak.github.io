/**
 * createStubTheme — shared scaffolding for the four phase-1 theme stubs.
 *
 * Each stub satisfies the FULL Theme contract (init/mount/unmount/dispose/
 * resize/update) so ThemeManager, the switcher, and the transition overlay
 * can be exercised end-to-end before the real themes land:
 *
 * - DOM: a full-viewport hero (theme name + Soubhik Ghosh) inside ctx.root
 * - GL: clear color only — the page background you see IS the shared
 *   renderer, proving the canvas-behind-DOM layering works
 * - Cursor: binds delegated hover detection and cleans it up in dispose()
 *
 * Phase 2: each theme folder replaces its stub with a real implementation.
 * When the last stub is gone, delete this file.
 */

import { Color } from 'three'
import type { Theme, ThemeContext, ThemeId } from './types'

export interface StubConfig {
  id: ThemeId
  name: string
  /** Renderer clear color — doubles as the page background. */
  clearColor: string
  /** One short line shown under the wordmark. */
  blurb: string
}

const UNMOUNT_MS = 320 // contract allows <= 500ms

export function createStubTheme(config: StubConfig): Theme {
  return new StubTheme(config)
}

class StubTheme implements Theme {
  readonly id: ThemeId
  readonly name: string

  private readonly config: StubConfig
  private readonly baseColor: Color
  private readonly frameColor = new Color()
  private ctx!: ThemeContext
  private heroEl: HTMLElement | null = null
  private cleanups: Array<() => void> = []

  constructor(config: StubConfig) {
    this.config = config
    this.id = config.id
    this.name = config.name
    this.baseColor = new Color(config.clearColor)
  }

  async init(ctx: ThemeContext): Promise<void> {
    this.ctx = ctx
    const { identity } = ctx.content

    const hero = document.createElement('section')
    hero.className = 'stub-hero'
    hero.innerHTML = `
      <p class="stub-hero__kicker">${this.name} · ${this.config.blurb}</p>
      <h1 class="stub-hero__name">${identity.name}</h1>
      <p class="stub-hero__role">${identity.role} — ${identity.location}</p>
      <p class="stub-hero__note">
        Scaffold stub. The full ${this.name} experience replaces this in phase&nbsp;2.
        Switch themes below, or press <kbd>1</kbd>–<kbd>4</kbd>.
      </p>
      <a class="stub-hero__link" href="${identity.github}" target="_blank" rel="noopener noreferrer">
        github.com/${identity.github.split('/').pop() ?? identity.handle}
      </a>
    `
    ctx.root.appendChild(hero)
    this.heroEl = hero

    this.cleanups.push(ctx.cursor.bind(ctx.root))
  }

  mount(): void {
    this.heroEl?.classList.add('is-mounted')
  }

  unmount(): Promise<void> {
    this.heroEl?.classList.remove('is-mounted')
    this.heroEl?.classList.add('is-leaving')
    const wait = this.ctx.reducedMotion ? 0 : UNMOUNT_MS
    return new Promise((resolve) => setTimeout(resolve, wait))
  }

  dispose(): void {
    for (const cleanup of this.cleanups) cleanup()
    this.cleanups = []
    this.heroEl = null
    // No GL resources to release — stubs only clear the framebuffer.
  }

  resize(_width: number, _height: number, _dpr: number): void {
    // Clear-color-only scene: nothing depends on viewport size.
  }

  update(_dt: number, elapsed: number): void {
    // Subtle luminance breathing proves the render loop is alive.
    const pulse = this.ctx.reducedMotion ? 0 : Math.sin(elapsed * 0.8) * 0.012
    this.frameColor.copy(this.baseColor).offsetHSL(0, 0, pulse)

    const { renderer } = this.ctx
    renderer.setClearColor(this.frameColor, 1)
    renderer.clear(true, true, false)
  }
}
