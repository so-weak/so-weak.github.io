/**
 * Article page — long-form reading entry point (/article.html).
 *
 * Responsibilities:
 *   1. Adopt the persisted portfolio theme (localStorage 'sg-theme') and
 *      reflect it as html[data-theme]; the article stylesheet defines its
 *      own per-theme accent palette (theme CSS is NOT loaded on this page).
 *   2. Inject the article markup from the content module.
 *   3. Mount the hand-authored animated SVG diagrams (diagrams.ts). They
 *      are styled entirely with the live `--art-*` CSS variables, so theme
 *      changes in another tab restyle them with no re-render.
 *   4. Scroll reveals — skipped entirely under prefers-reduced-motion
 *      (diagrams.ts applies the same policy to drawing and particles).
 */

import '../styles/base.css'
import './styles.css'
import '@fontsource-variable/fraunces/full.css'
import '@fontsource-variable/fraunces/full-italic.css'
import '@fontsource-variable/hanken-grotesk'
import '@fontsource-variable/jetbrains-mono'

import { siteContent } from '../content/data'
import { renderArticlePage } from './content'
import { mountDiagrams } from './diagrams'

const THEME_STORAGE_KEY = 'sg-theme'
const KNOWN_THEMES = ['electroform', 'editorial', 'terminal', 'aurora'] as const

/* ---------------------------------------------------------------- theming */

function applyTheme(value: string | null): void {
  if (value && (KNOWN_THEMES as readonly string[]).includes(value)) {
    document.documentElement.dataset.theme = value
  } else {
    delete document.documentElement.dataset.theme
  }
}

function readStoredTheme(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY)
  } catch {
    return null
  }
}

/* ---------------------------------------------------------------- reveals */

function setupReveals(root: HTMLElement): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced || !('IntersectionObserver' in window)) return

  const targets = root.querySelectorAll<HTMLElement>(
    '.art-prose > section > *, .art-prose > .art-lede, .art-next-card',
  )
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in')
          io.unobserve(entry.target)
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
  )
  for (const el of targets) {
    el.classList.add('art-reveal')
    io.observe(el)
  }
}

/* ------------------------------------------------------------------- boot */

function boot(): void {
  // The inline <head> script already set data-theme pre-paint; re-assert in
  // case it was blocked, and validate the stored value.
  applyTheme(readStoredTheme())

  const root = document.getElementById('article-root')
  if (!root) {
    console.error('[article] #article-root mount point missing.')
    return
  }

  root.innerHTML = renderArticlePage(siteContent)

  mountDiagrams(root)
  setupReveals(root)

  // Palette-aware diagrams: if the portfolio tab switches themes, follow.
  // The SVGs read the `--art-*` vars live, so updating data-theme is enough.
  window.addEventListener('storage', (event) => {
    if (event.key !== THEME_STORAGE_KEY) return
    applyTheme(event.newValue)
  })
}

boot()
