/**
 * EasterEggs — global hidden interactions, deliberately theme-agnostic.
 *
 *   1. Konami code (↑↑↓↓←→←→ b a) → dispatches `sg:konami` on window so the
 *      active theme can react its own way, plus a neutral toast as fallback.
 *      10 s cooldown. Ignored while typing in inputs/editable elements.
 *   2. Styled console banner on boot (monogram, links, a teaser).
 *   3. Typing "soweak" anywhere (not in inputs) → 1.5 s CSS glitch flash
 *      (skipped under prefers-reduced-motion) + a clickable toast linking to
 *      the soweak repo.
 *
 * Also home to a tiny reusable toast utility (aria-live polite, stacking,
 * auto-dismiss, neutral glass styling). All styling is injected in a single
 * <style> tag so this file is self-contained and never fights a theme.
 *
 * No frame loop here — the Ticker owns the only rAF loop on the page;
 * everything below runs on events, CSS animations and timeouts.
 */

import type { Identity } from '../content/types'
import { THEME_META } from '../themes/registry'
import type { ThemeManager } from './ThemeManager'
import type { Viewport } from './Viewport'

/** Fired on window when the Konami code completes. Themes react themselves. */
export const KONAMI_EVENT = 'sg:konami'

const KONAMI_SEQUENCE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
] as const

const KONAMI_COOLDOWN_MS = 10_000
const GLITCH_DURATION_MS = 1_500
const TOAST_DURATION_MS = 4_000
const TOAST_LEAVE_MS = 350 // matches --dur-base + slack
const MAX_TOASTS = 4

const SOWEAK_WORD = 'soweak'
const SOWEAK_REPO = 'https://github.com/so-weak/soweak'

const STYLE_ID = 'sg-easter-eggs-style'

export interface EasterEggsDeps {
  viewport: Viewport
  themeManager: ThemeManager
  identity: Identity
}

interface ToastOptions {
  /** Makes the toast a clickable link (new tab, rel noopener). */
  href?: string
  /** Time on screen before auto-dismiss. */
  duration?: number
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

export class EasterEggs {
  private readonly deps: EasterEggsDeps

  private konamiIndex = 0
  private konamiFiredAt = -Infinity
  private typedBuffer = ''
  private glitchEl: HTMLElement | null = null
  private toastContainer: HTMLElement | null = null
  private readonly timeouts = new Set<ReturnType<typeof setTimeout>>()

  constructor(deps: EasterEggsDeps) {
    this.deps = deps
    this.injectStyles()
    this.printBanner()
    // Capture phase: themes may stopPropagation on keydown; the egg layer
    // should still see keys. Typing targets are filtered in the handler.
    window.addEventListener('keydown', this.onKeyDown, true)
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown, true)
    for (const id of this.timeouts) clearTimeout(id)
    this.timeouts.clear()
    this.glitchEl?.remove()
    this.glitchEl = null
    this.toastContainer?.remove()
    this.toastContainer = null
    document.getElementById(STYLE_ID)?.remove()
  }

  // --- input handling -------------------------------------------------------

  private onKeyDown = (e: KeyboardEvent): void => {
    if (isTypingTarget(e.target)) {
      // Typing in a field resets sequences instead of feeding them.
      this.konamiIndex = 0
      this.typedBuffer = ''
      return
    }
    this.trackKonami(e)
    this.trackSoweak(e)
  }

  private trackKonami(e: KeyboardEvent): void {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
    const expected = KONAMI_SEQUENCE[this.konamiIndex]

    if (key === expected) {
      this.konamiIndex += 1
    } else {
      // Mismatch — but the key might restart the sequence (e.g. ArrowUp).
      this.konamiIndex = key === KONAMI_SEQUENCE[0] ? 1 : 0
    }

    if (this.konamiIndex < KONAMI_SEQUENCE.length) return
    this.konamiIndex = 0

    const now = performance.now()
    if (now - this.konamiFiredAt < KONAMI_COOLDOWN_MS) return
    this.konamiFiredAt = now

    window.dispatchEvent(new CustomEvent(KONAMI_EVENT))

    const activeId = this.deps.themeManager.activeId
    const themeName = activeId ? THEME_META[activeId].name : 'the void'
    this.toast(`KONAMI // ${themeName} responds`)
  }

  private trackSoweak(e: KeyboardEvent): void {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key.length !== 1 || !/[a-z]/i.test(e.key)) return

    this.typedBuffer = (this.typedBuffer + e.key.toLowerCase()).slice(
      -SOWEAK_WORD.length,
    )
    if (this.typedBuffer !== SOWEAK_WORD) return
    this.typedBuffer = ''

    if (!this.deps.viewport.reducedMotion) this.flashGlitch()
    this.toast(`soweak framework: armed. // github.com/so-weak/soweak`, {
      href: SOWEAK_REPO,
      duration: 7_000,
    })
  }

  // --- console banner -------------------------------------------------------

  private printBanner(): void {
    const { identity } = this.deps
    const monogram = [
      '███████╗  ██████╗ ',
      '██╔════╝ ██╔════╝ ',
      '███████╗ ██║  ███╗',
      '╚════██║ ██║   ██║',
      '███████║ ╚██████╔╝',
      '╚══════╝  ╚═════╝ ',
    ].join('\n')

    console.log(
      `%c${monogram}\n\n` +
        `%c${identity.name} — ${identity.role}%c\n\n` +
        `GitHub    ${identity.github}\n` +
        `LinkedIn  ${identity.linkedin}\n\n` +
        `%cpsst — try the Konami code. or type soweak. there is more hidden here.`,
      'color:#8a8a93;font-family:monospace;line-height:1.25',
      'color:#e8e8ec;font-weight:600;font-size:13px',
      'color:#8a8a93;font-size:12px',
      'color:#5d5d66;font-style:italic;font-size:12px',
    )
  }

  // --- glitch flash ---------------------------------------------------------

  private flashGlitch(): void {
    if (this.glitchEl) return // one at a time
    const el = document.createElement('div')
    el.className = 'sg-glitch'
    el.setAttribute('aria-hidden', 'true')
    document.body.appendChild(el)
    this.glitchEl = el
    this.after(GLITCH_DURATION_MS, () => {
      el.remove()
      this.glitchEl = null
    })
  }

  // --- toast utility ----------------------------------------------------------

  /** Show a small neutral toast. Pass `href` to make it a clickable link. */
  toast(message: string, options: ToastOptions = {}): void {
    const container = this.ensureToastContainer()

    let el: HTMLAnchorElement | HTMLDivElement
    if (options.href) {
      const a = document.createElement('a')
      a.href = options.href
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      el = a
    } else {
      el = document.createElement('div')
    }
    el.className = 'sg-toast'
    el.textContent = message
    container.appendChild(el)

    // Cap the stack — drop the oldest toasts immediately.
    while (container.children.length > MAX_TOASTS) {
      container.firstElementChild?.remove()
    }

    // Force a style flush so the entrance transition runs (no rAF — the
    // Ticker owns the only animation loop on the page).
    void el.offsetHeight
    el.classList.add('is-visible')

    this.after(options.duration ?? TOAST_DURATION_MS, () => {
      el.classList.remove('is-visible')
      el.classList.add('is-leaving')
      this.after(TOAST_LEAVE_MS, () => el.remove())
    })
  }

  private ensureToastContainer(): HTMLElement {
    if (this.toastContainer?.isConnected) return this.toastContainer
    const container = document.createElement('div')
    container.className = 'sg-toasts'
    container.setAttribute('aria-live', 'polite')
    document.body.appendChild(container)
    this.toastContainer = container
    return container
  }

  // --- internals --------------------------------------------------------------

  /** setTimeout wrapper so dispose() can cancel every pending callback. */
  private after(ms: number, fn: () => void): void {
    const id = setTimeout(() => {
      this.timeouts.delete(id)
      fn()
    }, ms)
    this.timeouts.add(id)
  }

  private injectStyles(): void {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = /* css */ `
/* Easter-egg chrome — neutral glass, sits on any theme.
   z-index 190: above #ui-global (100) / #transition-canvas (150),
   below #cursor (--z-cursor: 200). */

.sg-toasts {
  position: fixed;
  left: 50%;
  bottom: max(24px, env(safe-area-inset-bottom));
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  z-index: 190;
  pointer-events: none;
  max-width: min(92vw, 480px);
}

.sg-toast {
  display: block;
  pointer-events: none;
  font: 500 var(--step--1) / 1.4 'Archivo Variable', system-ui, sans-serif;
  letter-spacing: 0.04em;
  color: var(--paper);
  background: color-mix(in srgb, var(--ink) 78%, transparent);
  border: 1px solid color-mix(in srgb, var(--paper) 18%, transparent);
  border-radius: 10px;
  padding: 10px 16px;
  backdrop-filter: blur(14px) saturate(1.2);
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
  text-decoration: none;
  text-align: center;
  opacity: 0;
  translate: 0 8px;
  transition:
    opacity var(--dur-base) var(--ease-out-expo),
    translate var(--dur-base) var(--ease-out-expo),
    border-color var(--dur-fast) ease;
}

.sg-toast.is-visible {
  opacity: 1;
  translate: 0 0;
}

.sg-toast.is-leaving {
  opacity: 0;
  translate: 0 -6px;
}

a.sg-toast {
  pointer-events: auto;
  cursor: pointer;
}

a.sg-toast:hover,
a.sg-toast:focus-visible {
  border-color: color-mix(in srgb, var(--paper) 45%, transparent);
}

/* 1.5s fullscreen glitch flash — scanlines + RGB-split layers.
   Only ever created when prefers-reduced-motion is NOT set. */

.sg-glitch {
  position: fixed;
  inset: 0;
  z-index: 190;
  pointer-events: none;
  background: repeating-linear-gradient(
    to bottom,
    rgba(232, 232, 236, 0.07) 0,
    rgba(232, 232, 236, 0.07) 1px,
    transparent 1px,
    transparent 3px
  );
  animation: sg-glitch-flicker 1.5s steps(14) both;
}

.sg-glitch::before,
.sg-glitch::after {
  content: '';
  position: absolute;
  inset: 0;
  mix-blend-mode: screen;
}

.sg-glitch::before {
  background: rgba(255, 0, 60, 0.09);
  animation: sg-glitch-shift-r 1.5s steps(9) both;
}

.sg-glitch::after {
  background: rgba(0, 220, 255, 0.09);
  animation: sg-glitch-shift-c 1.5s steps(9) both;
}

@keyframes sg-glitch-flicker {
  0% { opacity: 1; }
  18% { opacity: 0.55; }
  34% { opacity: 0.95; }
  52% { opacity: 0.4; }
  68% { opacity: 0.8; }
  84% { opacity: 0.25; }
  100% { opacity: 0; }
}

@keyframes sg-glitch-shift-r {
  0% { transform: translateX(0); }
  16% { transform: translateX(9px); }
  33% { transform: translateX(-5px); }
  54% { transform: translateX(12px); }
  72% { transform: translateX(-3px); }
  100% { transform: translateX(0); }
}

@keyframes sg-glitch-shift-c {
  0% { transform: translateX(0); }
  16% { transform: translateX(-9px); }
  33% { transform: translateX(6px); }
  54% { transform: translateX(-11px); }
  72% { transform: translateX(4px); }
  100% { transform: translateX(0); }
}
`
    document.head.appendChild(style)
  }
}
