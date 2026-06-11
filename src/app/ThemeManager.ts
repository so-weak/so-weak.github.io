/**
 * ThemeManager — owns the shared WebGL renderer and the theme lifecycle.
 *
 * Renderer ownership: the manager is the ONLY code allowed to call
 * `setSize` / `setPixelRatio` on the shared renderer (DPR capped at 2 on
 * desktop, 1.5 on mobile). Themes own their Scene/Camera/Composer and
 * render inside `update()`.
 *
 * Switch sequence (see `switch()`):
 *   guard → announce sg:switching → [overlay.show() ∥ active.unmount()]
 *   → active.dispose() → empty root → reset scroll → lazy-load module
 *   (cached) → theme.init(ctx) (falls back to previous theme on error) →
 *   persist data-theme + localStorage + ?theme= → theme.resize() →
 *   theme.mount() → scroll.resize() → overlay.hide() → announce done →
 *   focus #theme-root (unless focus is on live UI). On failure the overlay
 *   is always hidden before the error propagates.
 */

import { WebGLRenderer } from 'three'
import type { SiteContent } from '../content/types'
import {
  DEFAULT_THEME,
  isThemeId,
  themeRegistry,
  type ThemeModule,
} from '../themes/registry'
import type { Theme, ThemeContext, ThemeFactory, ThemeId } from '../themes/types'
import type { CursorManager } from './CursorManager'
import { SCROLL_DEFAULTS, type ScrollManager } from './ScrollManager'
import type { Ticker } from './Ticker'
import type { TransitionOverlay } from './TransitionOverlay'
import type { Viewport } from './Viewport'

export const THEME_STORAGE_KEY = 'sg-theme'

/** Fired on window with detail `{ switching: boolean }`. */
export const SWITCHING_EVENT = 'sg:switching'
/** Fired on window with detail `{ id: ThemeId }` once a theme is active. */
export const THEME_EVENT = 'sg:theme'

export interface ThemeManagerDeps {
  canvas: HTMLCanvasElement
  root: HTMLElement
  ticker: Ticker
  scroll: ScrollManager
  cursor: CursorManager
  viewport: Viewport
  overlay: TransitionOverlay
  content: SiteContent
}

const MOBILE_DPR_CAP = 1.5
const DESKTOP_DPR_CAP = 2

export class ThemeManager {
  readonly renderer: WebGLRenderer

  private readonly deps: ThemeManagerDeps
  private readonly factoryCache = new Map<ThemeId, ThemeFactory>()

  private active: Theme | null = null
  private activeIdValue: ThemeId | null = null
  private switching = false
  private sinceMount = 0

  private readonly unsubscribeTicker: () => void
  private readonly unsubscribeViewport: () => void

  constructor(deps: ThemeManagerDeps) {
    this.deps = deps

    this.renderer = new WebGLRenderer({
      canvas: deps.canvas,
      antialias: false, // post-processing handles AA where themes want it
      powerPreference: 'high-performance',
      stencil: false,
    })
    this.renderer.setClearColor(0x0a0a0c, 1)
    this.applyRendererSize()

    this.unsubscribeViewport = deps.viewport.on(() => {
      this.applyRendererSize()
      this.active?.resize(deps.viewport.width, deps.viewport.height, this.dpr)
    })

    // Priority 0: after scroll (-10) and cursor (-5) managers. `active` is
    // null between dispose() and the next mount, so this also runs during
    // the tail of a switch — intro frames render under the hiding overlay.
    this.unsubscribeTicker = deps.ticker.add((dt) => {
      if (!this.active) return
      this.sinceMount += dt
      this.active.update(dt, this.sinceMount)
    }, 0)
  }

  get activeId(): ThemeId | null {
    return this.activeIdValue
  }

  get isSwitching(): boolean {
    return this.switching
  }

  /** Effective DPR after the per-device cap. */
  private get dpr(): number {
    const cap = this.deps.viewport.isMobile ? MOBILE_DPR_CAP : DESKTOP_DPR_CAP
    return Math.min(this.deps.viewport.dpr, cap)
  }

  /**
   * Resolve the boot theme: `?theme=` URL param → localStorage → default.
   */
  static resolveInitialTheme(): ThemeId {
    const fromUrl = new URLSearchParams(window.location.search).get('theme')
    if (isThemeId(fromUrl)) return fromUrl
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY)
      if (isThemeId(stored)) return stored
    } catch {
      /* private mode / storage disabled — fall through */
    }
    return DEFAULT_THEME
  }

  /**
   * Switch to a theme. No-ops while a switch is in flight or if `id` is
   * already active. If the incoming theme fails to init, falls back to a
   * fresh instance of the previous theme.
   */
  async switch(id: ThemeId): Promise<void> {
    if (this.switching || id === this.activeIdValue) return
    this.switching = true
    this.announceSwitching(true)

    const { overlay, root, scroll } = this.deps
    const previousId = this.activeIdValue

    try {
      // Cover the screen while (in parallel) the old theme animates out.
      if (this.active) {
        await Promise.all([overlay.show(), this.active.unmount()])
        this.active.dispose()
        this.active = null
        this.activeIdValue = null
      } else {
        await overlay.show()
      }

      root.replaceChildren()
      scroll.configure(SCROLL_DEFAULTS)
      scroll.scrollTo(0, { immediate: true })

      let theme = await this.instantiate(id)
      let actualId = id

      if (!theme && previousId !== null && previousId !== id) {
        console.warn(`[ThemeManager] Falling back to "${previousId}".`)
        root.replaceChildren()
        theme = await this.instantiate(previousId)
        actualId = previousId
      }

      if (!theme) {
        throw new Error(
          `[ThemeManager] Could not activate "${id}"${previousId ? ` or fall back to "${previousId}"` : ''}.`,
        )
      }

      theme.resize(this.deps.viewport.width, this.deps.viewport.height, this.dpr)

      this.active = theme
      this.activeIdValue = actualId
      this.sinceMount = 0

      theme.mount()
      scroll.resize()

      window.dispatchEvent(
        new CustomEvent(THEME_EVENT, { detail: { id: actualId } }),
      )

      await overlay.hide()
    } catch (error) {
      // Never strand the opaque overlay over the page — whatever failed
      // (init, fallback, mount), clear the cover before surfacing the error.
      try {
        await overlay.hide()
      } catch (hideError) {
        console.error('[ThemeManager] Overlay cleanup failed:', hideError)
      }
      throw error
    } finally {
      this.switching = false
      this.announceSwitching(false)
      // A11y: a theme switch replaces the whole page — move focus to the
      // new document region so keyboard/screen-reader users aren't lost.
      // Skip it when focus is still on live UI (e.g. the ThemeSwitcher's
      // radios) so consecutive arrow-key presses keep cycling themes.
      const focused = document.activeElement
      const focusIsLost =
        !focused ||
        focused === document.body ||
        focused === document.documentElement ||
        !focused.isConnected
      if (focusIsLost) root.focus({ preventScroll: true })
    }
  }

  dispose(): void {
    this.unsubscribeTicker()
    this.unsubscribeViewport()
    if (this.active) {
      this.active.dispose()
      this.active = null
    }
    this.renderer.dispose()
  }

  // --- internals ----------------------------------------------------------

  /**
   * Load the module (cached), construct the theme, and run init(). The
   * theme id is persisted + reflected (html[data-theme], localStorage,
   * ?theme=) only AFTER init() succeeds, so a broken theme is never
   * written to storage and retried on every reload. Returns null if init
   * throws — the partially-built theme is disposed and the root emptied.
   */
  private async instantiate(id: ThemeId): Promise<Theme | null> {
    let theme: Theme | null = null
    try {
      let factory = this.factoryCache.get(id)
      if (!factory) {
        const mod: ThemeModule = await themeRegistry[id]()
        factory = mod.default
        this.factoryCache.set(id, factory)
      }
      theme = factory()
      await theme.init(this.buildContext())
      this.persist(id)
      return theme
    } catch (error) {
      console.error(`[ThemeManager] Theme "${id}" failed to initialize:`, error)
      try {
        theme?.dispose()
      } catch (disposeError) {
        console.error(
          `[ThemeManager] Cleanup of failed theme "${id}" also threw:`,
          disposeError,
        )
      }
      // Don't leave partial DOM from the failed init() behind.
      this.deps.root.replaceChildren()
      return null
    }
  }

  /** Reflect + persist the active theme id (html[data-theme], localStorage, ?theme=). */
  private persist(id: ThemeId): void {
    document.documentElement.dataset.theme = id
    try {
      localStorage.setItem(THEME_STORAGE_KEY, id)
    } catch {
      /* storage unavailable — non-fatal */
    }
    const url = new URL(window.location.href)
    url.searchParams.set('theme', id)
    history.replaceState(null, '', url)
  }

  private buildContext(): ThemeContext {
    const { root, ticker, scroll, cursor, viewport, content } = this.deps
    return {
      root,
      renderer: this.renderer,
      ticker,
      scroll,
      cursor,
      viewport,
      content,
      reducedMotion: viewport.reducedMotion,
    }
  }

  private applyRendererSize(): void {
    const { viewport } = this.deps
    this.renderer.setPixelRatio(this.dpr)
    this.renderer.setSize(viewport.width, viewport.height, false)
  }

  private announceSwitching(switching: boolean): void {
    window.dispatchEvent(
      new CustomEvent(SWITCHING_EVENT, { detail: { switching } }),
    )
  }
}
