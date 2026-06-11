// ===== src/themes/types.ts — THE THEME CONTRACT (scaffold writes this verbatim; themes implement it) =====
import type { WebGLRenderer } from 'three'
import type { Ticker } from '../app/Ticker'
import type { ScrollManager } from '../app/ScrollManager'
import type { CursorManager } from '../app/CursorManager'
import type { Viewport } from '../app/Viewport'
import type { SiteContent } from '../content/types'

export type ThemeId = 'electroform' | 'editorial' | 'terminal' | 'aurora' | 'vangogh' | 'neogrunge'

export interface ThemeContext {
  /** Theme builds its ENTIRE DOM inside this element. ThemeManager empties it after dispose(). */
  root: HTMLElement
  /** Shared fullscreen renderer. Its canvas is position:fixed, z-index 0, BEHIND root DOM. The theme owns its own Scene/Camera/EffectComposer and renders inside update(). Never call renderer.setSize/setPixelRatio — ThemeManager owns that. */
  renderer: WebGLRenderer
  ticker: Ticker
  scroll: ScrollManager
  cursor: CursorManager
  viewport: Viewport
  content: SiteContent
  /** Live snapshot of prefers-reduced-motion; subscribe via viewport for changes. */
  reducedMotion: boolean
}

export interface Theme {
  readonly id: ThemeId
  readonly name: string
  /** Build DOM into ctx.root and create the GL scene. Resolve when ready for first paint (shaders compiled via renderer.compileAsync if applicable). Runs while a transition overlay covers the screen. */
  init(ctx: ThemeContext): Promise<void>
  /** Reveal begins: start intro animations. */
  mount(): void
  /** Animate out fast (<=500ms), then resolve. */
  unmount(): Promise<void>
  /** Synchronously release EVERYTHING: ticker unsubscribes, event listeners, observers, geometries, materials, textures, render targets, composers. After this the theme object is garbage. */
  dispose(): void
  /** Called on viewport resize and once between init() and mount(). */
  resize(width: number, height: number, dpr: number): void
  /** Every frame while active, after scroll+cursor managers update. Render your composer here. dt = clamped delta seconds, elapsed = seconds since mount. */
  update(dt: number, elapsed: number): void
}

/** Each theme module default-exports a factory: () => Theme */
export type ThemeFactory = () => Theme
