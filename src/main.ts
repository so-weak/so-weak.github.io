/**
 * Boot sequence:
 *   1. Construct managers (Ticker → Viewport → Scroll → Cursor → Overlay
 *      → ThemeManager) and the global UI (Preloader, ThemeSwitcher).
 *   2. Start the ticker.
 *   3. Resolve the initial theme (?theme= → localStorage 'sg-theme' →
 *      'electroform') and switch to it. The preloader covers everything
 *      (z 300) while the first theme loads, then animates away (min 800 ms
 *      on screen).
 */

import './styles/base.css'
import '@fontsource-variable/archivo' // global chrome font (preloader, fallbacks)

import { trackEvent } from './utils/analytics'

import { CursorManager } from './app/CursorManager'
import { EasterEggs } from './app/EasterEggs'
import { ScrollManager } from './app/ScrollManager'
import { ThemeManager } from './app/ThemeManager'
import { Ticker } from './app/Ticker'
import { TransitionOverlay } from './app/TransitionOverlay'
import { Viewport } from './app/Viewport'
import { siteContent } from './content/data'
import { Preloader } from './ui/Preloader'
import { ThemeSwitcher } from './ui/ThemeSwitcher'

function requireElement<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector)
  if (!el) {
    throw new Error(`[boot] Required mount point "${selector}" is missing.`)
  }
  return el
}

async function boot(): Promise<void> {
  // Preloader first — it must own the screen before anything heavy happens.
  const preloader = new Preloader(requireElement<HTMLElement>('#preloader'))

  const ticker = new Ticker()
  const viewport = new Viewport(ticker)
  const scroll = new ScrollManager(ticker)
  const cursor = new CursorManager(
    ticker,
    viewport,
    requireElement<HTMLElement>('#cursor'),
  )
  const overlay = new TransitionOverlay(
    requireElement<HTMLCanvasElement>('#transition-canvas'),
    ticker,
    viewport,
  )

  const themeManager = new ThemeManager({
    canvas: requireElement<HTMLCanvasElement>('#gl-canvas'),
    root: requireElement<HTMLElement>('#theme-root'),
    ticker,
    scroll,
    cursor,
    viewport,
    overlay,
    content: siteContent,
  })

  new ThemeSwitcher(requireElement<HTMLElement>('#ui-global'), themeManager)

  // Global hidden interactions (Konami code, console banner, "soweak").
  new EasterEggs({
    viewport,
    themeManager,
    identity: siteContent.identity,
  })

  ticker.start()

  try {
    await themeManager.switch(ThemeManager.resolveInitialTheme())
  } catch (error) {
    // A failed boot still removes the preloader — never trap the user on it.
    console.error('[boot] Initial theme failed to activate:', error)
  }

  trackEvent('page_view')
  await preloader.hide(viewport.reducedMotion)
}

void boot()
