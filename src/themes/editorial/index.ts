/**
 * EDITORIAL LIGHT — a printed magazine issue about an engineer.
 *
 * Art-directed annual report: warm paper, ink, rules and folios. Fraunces
 * carries the display voice (huge stacked cover lines, italic moments, a
 * working type specimen); Hanken Grotesk sets the meta. WebGL stays a
 * whisper — animated paper grain, an ink-bleed dye trail under the cursor,
 * and one slowly tumbling extruded asterisk photographed with shallow DoF.
 *
 * Choreography: headline lines slide up under clip masks, sections reveal
 * on intersection with per-item staggers, decorative elements drift at
 * their own scroll speeds, and a vermilion marquee strip runs between
 * chapters. A live folio in the corner tracks the current "page".
 */

import '@fontsource-variable/fraunces/full.css'
import '@fontsource-variable/fraunces/full-italic.css'
import '@fontsource-variable/hanken-grotesk'
import './styles.css'

import { clamp, damp } from '../../utils/math'
import type { Theme, ThemeContext, ThemeFactory, ThemeId } from '../types'
import {
  buildEditorialDom,
  FOLIO_LABELS,
  PAGE_NO,
  SECTION_IDS,
  type EditorialDom,
} from './dom'
import { EditorialScene, type EditorialState } from './scene'
import { sfxEditorialClick } from '../../utils/sound'

const UNMOUNT_MS = 360
/** Cursor speed (px/s) that saturates the ink flow. */
const INK_SPEED_FULL = 1500
/** Hovering the cover name this long flips it to katakana. */
const KANA_HOVER_MS = 1200
/** How long the Konami "PROOF" spectacle stays on press. */
const PROOF_MS = 3000
/** Scroll velocity → marquee surge (px per unit of Lenis velocity). */
const MARQUEE_KICK_SCALE = 2.2
/** Hard cap on the marquee surge offset (px). */
const MARQUEE_KICK_MAX = 110

interface ParallaxItem {
  el: HTMLElement
  speed: number
  center: number
  lastY: number
}

class EditorialTheme implements Theme {
  readonly id: ThemeId = 'editorial'
  readonly name = 'Editorial'

  private ctx!: ThemeContext
  private dom: EditorialDom | null = null
  private scene: EditorialScene | null = null

  private cleanups: Array<() => void> = []
  private io: IntersectionObserver | null = null
  private unmountTimer: number | null = null
  private disposed = false

  private staticMode = false
  private staticDirty = true
  /** Scroll position baked into the last static frame. */
  private staticScrollPx = 0

  private anchors: number[] = []
  private parallax: ParallaxItem[] = []
  private activeSection = -1
  private scrolledChrome = false
  private inkStarted = false
  private glTime = 2.0

  // Easter eggs + scroll-velocity marquee state.
  private kanaTimer: number | null = null
  private proofTimer: number | null = null
  private receiptShown = false
  private receiptLastFocus: HTMLElement | null = null
  private marqueeKick = 0
  private marqueeKickApplied = 0

  // Mutated in place every frame — no allocations in the hot path.
  private readonly state: EditorialState = {
    time: 2.0,
    grain: 0.045,
    tiltX: 0,
    tiltY: 0,
    scrollPx: 0,
    inkX: 0.5,
    inkY: 0.5,
    inkStrength: 0,
  }

  async init(ctx: ThemeContext): Promise<void> {
    this.ctx = ctx
    this.staticMode = ctx.reducedMotion

    // A touch crisper than default — paper should feel direct, not gooey.
    ctx.scroll.configure({ lerp: 0.11 })

    // --- DOM -------------------------------------------------------------------
    this.dom = buildEditorialDom(ctx.content)
    if (this.staticMode) this.dom.wrapper.classList.add('is-static')
    ctx.root.appendChild(this.dom.wrapper)

    this.cleanups.push(ctx.cursor.bind(ctx.root))
    this.bindEvents()
    this.bindEasterEggs()
    this.collectParallax()

    // --- GL ---------------------------------------------------------------------
    this.scene = new EditorialScene(ctx.renderer, {
      isMobile: ctx.viewport.isMobile,
      withDof: !ctx.viewport.isMobile && !ctx.reducedMotion,
    })
    await this.scene.compile()

    this.cleanups.push(
      ctx.viewport.onReducedMotionChange((rm) => {
        this.staticMode = rm
        this.staticDirty = true
        this.dom?.wrapper.classList.toggle('is-static', rm)
        if (rm) {
          this.revealEverything()
          this.clearMotionTransforms()
        }
      }),
    )

    // Fraunces shifts metrics once it lands — re-measure the issue.
    void document.fonts.ready.then(() => {
      if (this.disposed) return
      this.computeLayout()
      this.ctx.scroll.resize()
      this.staticDirty = true
    })
  }

  mount(): void {
    if (!this.dom) return
    this.dom.wrapper.classList.add('is-mounted')
    this.computeLayout()
    if (this.staticMode) {
      this.revealEverything()
    } else {
      this.observeReveals()
    }
    this.staticDirty = true
  }

  unmount(): Promise<void> {
    this.dom?.wrapper.classList.add('is-leaving')
    const wait = this.ctx.reducedMotion ? 0 : UNMOUNT_MS
    return new Promise((resolve) => {
      this.unmountTimer = window.setTimeout(resolve, wait)
    })
  }

  dispose(): void {
    this.disposed = true
    if (this.receiptShown) this.closeReceipt()
    if (this.unmountTimer !== null) {
      clearTimeout(this.unmountTimer)
      this.unmountTimer = null
    }
    if (this.kanaTimer !== null) {
      clearTimeout(this.kanaTimer)
      this.kanaTimer = null
    }
    if (this.proofTimer !== null) {
      clearTimeout(this.proofTimer)
      this.proofTimer = null
    }
    this.io?.disconnect()
    this.io = null
    for (const cleanup of this.cleanups) cleanup()
    this.cleanups = []
    this.scene?.dispose()
    this.scene = null
    this.parallax = []
    this.anchors = []
    this.dom = null
  }

  resize(width: number, height: number, dpr: number): void {
    this.scene?.resize(width, height, dpr)
    this.computeLayout()
    this.staticDirty = true
  }

  update(dt: number, _elapsed: number): void {
    if (!this.scene || !this.dom) return
    const { scroll, cursor, viewport } = this.ctx
    const s = this.state

    this.updateChrome(this.sectionFloat(scroll.scroll), scroll.scroll)

    if (this.staticMode) {
      // Reduced motion: composed still frames — frozen grain and tumble,
      // no tilt, no dye. The frame still follows the real scroll (re-shot
      // when it moves) so the asterisk drifts off the cover as designed
      // instead of sitting frozen, ink-on-ink, behind the body text.
      if (Math.abs(scroll.scroll - this.staticScrollPx) > 4) {
        this.staticDirty = true
      }
      if (this.staticDirty) {
        s.time = 3.7
        s.grain = 0.04
        s.tiltX = 0
        s.tiltY = 0
        s.scrollPx = scroll.scroll
        s.inkStrength = 0
        this.scene.apply(s)
        this.scene.render(1 / 60, false)
        this.staticScrollPx = scroll.scroll
        this.staticDirty = false
      }
      return
    }

    // --- cursor: gentle parallax on the asterisk, dye under the nib ----------
    const touch = viewport.isTouch
    s.tiltX = damp(s.tiltX, touch ? 0 : cursor.ndc.x, 3, dt)
    s.tiltY = damp(s.tiltY, touch ? 0 : cursor.ndc.y, 3, dt)

    if (!touch) {
      if (!this.inkStarted && (cursor.pos.x !== 0 || cursor.pos.y !== 0)) {
        this.inkStarted = true
      }
      s.inkX = cursor.lerped.x / viewport.width
      s.inkY = 1 - cursor.lerped.y / viewport.height
      if (this.inkStarted) {
        const speed = Math.hypot(cursor.velocity.x, cursor.velocity.y)
        // A resting nib soaks faintly; a moving one draws a fading stroke.
        s.inkStrength = 0.012 + clamp(speed / INK_SPEED_FULL, 0, 1) * 0.2
      } else {
        s.inkStrength = 0
      }
    } else {
      s.inkStrength = 0
    }

    this.glTime += dt * 0.5
    s.time = this.glTime
    s.grain = 0.045
    s.scrollPx = scroll.scroll

    if (!viewport.isMobile) {
      this.applyParallax(scroll.scroll)
      this.applyMarqueeKick(dt)
    }

    this.scene.apply(s)
    this.scene.render(dt, true)
  }

  // --- interaction ----------------------------------------------------------------

  private bindEvents(): void {
    const root = this.ctx.root

    const onClick = (e: Event): void => {
      const target = e.target
      if (!(target instanceof Element)) return

      const nav = target.closest<HTMLAnchorElement>('[data-nav]')
      if (nav) {
        const href = nav.getAttribute('href')
        if (href && href.startsWith('#')) {
          e.preventDefault()
          const dest = root.querySelector<HTMLElement>(href)
          if (dest) this.ctx.scroll.scrollTo(dest, { duration: 1.2 })
        }
        sfxEditorialClick()
        return
      }

      const expand = target.closest<HTMLButtonElement>('[data-expand]')
      if (expand) {
        const row = expand.parentElement
        if (!row) return
        const open = row.classList.toggle('is-open')
        expand.setAttribute('aria-expanded', String(open))
        sfxEditorialClick()
        // Row heights changed — let Lenis re-measure once it settles.
        window.setTimeout(() => this.ctx.scroll.resize(), 650)
        return
      }

      // Barcode → colophon receipt modal (and its close affordances).
      if (target.closest('[data-receipt-open]')) {
        sfxEditorialClick()
        this.openReceipt()
        return
      }
      if (target.closest('[data-receipt-close]')) {
        sfxEditorialClick()
        this.closeReceipt()
      }
    }

    root.addEventListener('click', onClick)
    this.cleanups.push(() => root.removeEventListener('click', onClick))
  }

  /** Katakana name flip + Konami PROOF mode. All cleaned up in dispose(). */
  private bindEasterEggs(): void {
    if (!this.dom) return
    const title = this.dom.coverTitle

    const flip = (on: boolean): void => {
      title.classList.toggle('is-kana', on)
    }
    const clearHold = (): void => {
      if (this.kanaTimer !== null) {
        clearTimeout(this.kanaTimer)
        this.kanaTimer = null
      }
    }
    const onEnter = (): void => {
      clearHold()
      this.kanaTimer = window.setTimeout(() => flip(true), KANA_HOVER_MS)
    }
    const onLeave = (): void => {
      clearHold()
      flip(false)
    }
    const onDown = (): void => {
      clearHold()
      flip(true)
    }
    const onUp = (): void => {
      clearHold()
      flip(false)
    }

    title.addEventListener('pointerenter', onEnter)
    title.addEventListener('pointerleave', onLeave)
    title.addEventListener('pointerdown', onDown)
    title.addEventListener('pointerup', onUp)
    title.addEventListener('pointercancel', onUp)
    this.cleanups.push(() => {
      clearHold()
      title.removeEventListener('pointerenter', onEnter)
      title.removeEventListener('pointerleave', onLeave)
      title.removeEventListener('pointerdown', onDown)
      title.removeEventListener('pointerup', onUp)
      title.removeEventListener('pointercancel', onUp)
    })

    // Core dispatches `sg:konami` on the Konami code — 3s of press-check
    // PROOF mode (registration marks, crop marks, a MISPRINT stamp).
    const onKonami = (): void => {
      this.runProofMode()
    }
    window.addEventListener('sg:konami', onKonami)
    this.cleanups.push(() => {
      window.removeEventListener('sg:konami', onKonami)
      this.dom?.wrapper.classList.remove('is-proof')
    })
  }

  private runProofMode(): void {
    if (!this.dom || this.proofTimer !== null) return
    this.dom.wrapper.classList.add('is-proof')
    this.proofTimer = window.setTimeout(() => {
      this.proofTimer = null
      this.dom?.wrapper.classList.remove('is-proof')
    }, PROOF_MS)
  }

  // --- colophon receipt modal -------------------------------------------------

  private openReceipt(): void {
    if (!this.dom || this.receiptShown) return
    this.receiptShown = true
    const active = document.activeElement
    this.receiptLastFocus = active instanceof HTMLElement ? active : null
    this.dom.receipt.hidden = false
    this.ctx.scroll.configure({ enabled: false })
    document.addEventListener('keydown', this.onReceiptKeydown, true)
    this.dom.receiptClose.focus()
  }

  private closeReceipt(): void {
    if (!this.dom || !this.receiptShown) return
    this.receiptShown = false
    this.dom.receipt.hidden = true
    this.ctx.scroll.configure({ enabled: true })
    document.removeEventListener('keydown', this.onReceiptKeydown, true)
    this.receiptLastFocus?.focus()
    this.receiptLastFocus = null
  }

  /** Esc closes; Tab is trapped inside the receipt card while open. */
  private readonly onReceiptKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      this.closeReceipt()
      return
    }
    if (e.key !== 'Tab' || !this.dom) return
    const card = this.dom.receiptCard
    const focusables = Array.from(
      card.querySelectorAll<HTMLElement>('button, a[href]'),
    )
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (!first || !last) return
    const current = document.activeElement
    if (e.shiftKey) {
      if (current === first || !card.contains(current)) {
        e.preventDefault()
        last.focus()
      }
    } else if (current === last || !card.contains(current)) {
      e.preventDefault()
      first.focus()
    }
  }

  // --- reveals ----------------------------------------------------------------------

  private observeReveals(): void {
    if (!this.dom || this.io) return
    this.io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in')
            this.io?.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -8% 0px' },
    )
    const targets = this.dom.wrapper.querySelectorAll('.ed-reveal, .ed-lines')
    targets.forEach((el) => this.io?.observe(el))
  }

  private revealEverything(): void {
    this.dom?.wrapper
      .querySelectorAll('.ed-reveal, .ed-lines')
      .forEach((el) => el.classList.add('is-in'))
  }

  // --- layout / scroll choreography ----------------------------------------------------

  private collectParallax(): void {
    if (!this.dom) return
    this.parallax = Array.from(
      this.dom.wrapper.querySelectorAll<HTMLElement>('[data-speed]'),
    ).map((el) => ({
      el,
      speed: Number(el.dataset.speed) || 1,
      center: 0,
      lastY: 0,
    }))
  }

  private computeLayout(): void {
    if (!this.dom) return
    const sc = this.ctx.scroll.scroll
    const vh = this.ctx.viewport.height

    this.anchors = this.dom.sections.map((el, i) => {
      const top = el.getBoundingClientRect().top + sc
      return i === 0 ? 0 : Math.max(0, top - vh * 0.4)
    })

    for (const item of this.parallax) {
      // Strip the parallax offset before measuring the true center.
      item.el.style.transform = ''
      item.lastY = 0
      const rect = item.el.getBoundingClientRect()
      item.center = rect.top + sc + rect.height / 2
    }
  }

  /** Continuous page index — 0 on the cover, 7 at the colophon. */
  private sectionFloat(s: number): number {
    const a = this.anchors
    if (a.length < 2) return 0
    const first = a[0] ?? 0
    if (s <= first) return 0
    for (let i = 0; i < a.length - 1; i++) {
      const lo = a[i] ?? 0
      const hi = a[i + 1] ?? lo + 1
      if (s < hi) return i + (s - lo) / Math.max(1, hi - lo)
    }
    return a.length - 1
  }

  private applyParallax(scrollY: number): void {
    const vh = this.ctx.viewport.height
    const mid = scrollY + vh * 0.5
    for (let i = 0; i < this.parallax.length; i++) {
      const item = this.parallax[i]
      if (!item) continue
      const rel = mid - item.center
      if (Math.abs(rel) > vh * 1.6) continue
      const y = rel * (1 - item.speed)
      if (Math.abs(y - item.lastY) < 0.4) continue
      item.lastY = y
      item.el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`
    }
  }

  /** Scroll velocity surges the marquee strips along their direction of travel. */
  private applyMarqueeKick(dt: number): void {
    if (!this.dom) return
    const v = Math.abs(this.ctx.scroll.velocity)
    const target = -Math.min(v * MARQUEE_KICK_SCALE, MARQUEE_KICK_MAX)
    this.marqueeKick = damp(this.marqueeKick, target, 6, dt)
    if (Math.abs(this.marqueeKick - this.marqueeKickApplied) < 0.3) return
    this.marqueeKickApplied = this.marqueeKick
    const x = this.marqueeKick.toFixed(1)
    for (const kick of this.dom.marqueeKicks) {
      kick.style.transform = `translate3d(${x}px, 0, 0)`
    }
  }

  /** Strip per-frame transforms so reduced motion shows a clean static page. */
  private clearMotionTransforms(): void {
    for (const item of this.parallax) {
      item.el.style.transform = ''
      item.lastY = 0
    }
    this.marqueeKick = 0
    this.marqueeKickApplied = 0
    for (const kick of this.dom?.marqueeKicks ?? []) {
      kick.style.transform = ''
    }
  }

  /** Folio readout, masthead nav state, compact-masthead toggle. */
  private updateChrome(f: number, scrollY: number): void {
    if (!this.dom) return

    const scrolled = scrollY > 48
    if (scrolled !== this.scrolledChrome) {
      this.scrolledChrome = scrolled
      this.dom.wrapper.classList.toggle('is-scrolled', scrolled)
    }

    const sec = clamp(Math.round(f), 0, SECTION_IDS.length - 1)
    if (sec === this.activeSection) return

    const prev = this.dom.navLinks[this.activeSection - 1]
    if (prev) {
      prev.classList.remove('is-active')
      prev.removeAttribute('aria-current')
    }
    const next = this.dom.navLinks[sec - 1]
    if (next) {
      next.classList.add('is-active')
      next.setAttribute('aria-current', 'true')
    }

    const id = SECTION_IDS[sec] ?? 'hero'
    this.dom.folioPage.textContent = `P. ${PAGE_NO[id]}`
    this.dom.folioLabel.textContent = FOLIO_LABELS[sec] ?? ''

    // The corner folio ticks like an odometer as pages pass. Skipped on the
    // first paint and in static mode (reduced motion swaps instantly).
    if (!this.staticMode && this.activeSection !== -1) {
      const page = this.dom.folioPage
      page.classList.remove('is-tick')
      void page.offsetWidth // restart the keyframe
      page.classList.add('is-tick')
    }

    this.activeSection = sec
  }
}

const createEditorialTheme: ThemeFactory = () => new EditorialTheme()

export default createEditorialTheme
