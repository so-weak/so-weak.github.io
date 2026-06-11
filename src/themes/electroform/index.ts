/**
 * ELECTROFORM CHROME — flagship theme.
 *
 * Dark retro-futurist liquid metal: a molten chrome blob (simplex-displaced
 * MeshPhysicalMaterial, iridescent thin-film, RoomEnvironment reflections)
 * floating in an endless particle corridor, photographed through a shallow
 * depth of field that rack-focuses as you scroll between chapters.
 *
 * Cursor velocity melts the blob's surface; hovering anything interactive
 * fires a lime surge through the particle field. Scroll drives the dolly,
 * the morph keyframes, DOM parallax and the dot-nav state.
 */

import '@fontsource-variable/unbounded'
import '@fontsource-variable/archivo'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import './styles.css'

import { clamp, damp, lerp } from '../../utils/math'
import type { Theme, ThemeContext, ThemeFactory, ThemeId } from '../types'
import { buildElectroformDom, type ElectroformDom } from './dom'
import { ElectroformScene, type SceneState } from './scene'
import {
  sfxElectroformClick,
  sfxElectroformHover,
  sfxElectroformKonami,
} from '../../utils/sound'

const UNMOUNT_MS = 380

/**
 * Per-chapter GL keyframes (hero → contact). Sampled with a smoothstep
 * between neighbors and damped per-frame, so every section change becomes
 * a slow cinematic rack-focus + morph instead of a hard cut.
 */
const KF = {
  amp: [0.34, 0.16, 0.26, 0.44, 0.2, 0.13, 0.28, 0.38],
  freq: [1.05, 1.7, 0.95, 1.85, 2.5, 1.25, 1.5, 0.8],
  x: [0.85, -2.3, 2.45, -2.5, 0.0, 2.3, -2.2, 0.0],
  y: [-0.1, 0.25, -0.2, 0.15, -0.45, 0.3, 0.1, 0.1],
  scale: [1.0, 0.8, 0.9, 0.95, 0.55, 0.7, 0.8, 1.08],
  focus: [7.0, 2.2, 7.0, 4.2, 11.0, 7.5, 3.2, 7.0],
  bokeh: [3.2, 5.2, 2.4, 4.4, 5.6, 2.8, 4.6, 2.2],
  // Readability: particle dim/defocus + bloom reduction per chapter —
  // near zero on the sparse hero/contact, high behind dense text.
  dim: [0.0, 0.72, 0.85, 0.85, 0.55, 0.78, 0.72, 0.2],
} as const

/** Katakana lines for the hero-name egg — ソウビク / ゴーシュ (JLPT N4 nod). */
const KANA_LINES = ['ソウビク', 'ゴーシュ'] as const

/** Letter-flip stagger (ms) and half-flip duration (ms). */
const FLIP_STAGGER_MS = 45
const FLIP_HALF_MS = 130

const OVERDRIVE_CLICKS = 5
const OVERDRIVE_WINDOW_MS = 3000
const KONAMI_EVENT = 'sg:konami'
const KONAMI_SECONDS = 3

function sampleKF(arr: readonly number[], f: number): number {
  const i = Math.floor(f)
  const a = arr[clamp(i, 0, arr.length - 1)] ?? 0
  const b = arr[clamp(i + 1, 0, arr.length - 1)] ?? a
  const t = clamp(f - i, 0, 1)
  return lerp(a, b, t * t * (3 - 2 * t))
}

interface ParallaxItem {
  el: HTMLElement
  speed: number
  center: number
  lastY: number
}

class ElectroformTheme implements Theme {
  readonly id: ThemeId = 'electroform'
  readonly name = 'Electroform'

  private ctx!: ThemeContext
  private dom: ElectroformDom | null = null
  private scene: ElectroformScene | null = null

  private cleanups: Array<() => void> = []
  private io: IntersectionObserver | null = null
  private unmountTimer: number | null = null
  private disposed = false

  // --- choreography state (mutated in place — no per-frame allocations) ----
  private readonly state: SceneState = {
    time: 7.3,
    amp: KF.amp[0],
    freq: KF.freq[0],
    swirl: 0,
    scrollZ: 0,
    flash: 0,
    blobX: KF.x[0],
    blobY: KF.y[0],
    blobScale: KF.scale[0],
    camX: 0,
    camY: 0,
    focus: KF.focus[0],
    bokeh: KF.bokeh[0],
    dim: KF.dim[0],
    overdrive: 0,
  }

  private glTime = 7.3
  private staticMode = false
  private staticDirty = true

  private anchors: number[] = []
  private parallax: ParallaxItem[] = []
  private activeNav = -1
  private scrolledHint = false
  private hoverFlashEl: Element | null = null

  // --- easter-egg state -----------------------------------------------------
  /** Roman letters of the hero name, per line — restored after the flip. */
  private romanLines: string[][] = []
  private nameKana = false
  private flipTimers: number[] = []
  private holdTimer: number | null = null
  private toastTimer: number | null = null
  private konamiClassTimer: number | null = null
  private blobClicks: number[] = []
  /** Remaining seconds of the Konami spectacle (0 = idle). */
  private knTime = 0

  async init(ctx: ThemeContext): Promise<void> {
    this.ctx = ctx
    this.staticMode = ctx.reducedMotion

    // Slightly heavier scroll for the liquid-metal feel.
    ctx.scroll.configure({ lerp: 0.085 })

    // --- DOM -----------------------------------------------------------------
    this.dom = buildElectroformDom(ctx.content)
    ctx.root.appendChild(this.dom.wrapper)

    this.cleanups.push(ctx.cursor.bind(ctx.root))
    this.bindEvents()
    this.bindNameEgg()
    this.bindKonami()
    this.collectParallax()

    // --- GL --------------------------------------------------------------------
    this.scene = new ElectroformScene(ctx.renderer, {
      isMobile: ctx.viewport.isMobile,
      withDof: !ctx.viewport.isMobile,
    })
    await this.scene.compile()

    // Live reduced-motion switching.
    this.cleanups.push(
      ctx.viewport.onReducedMotionChange((rm) => {
        this.staticMode = rm
        this.staticDirty = true
        if (rm) this.revealEverything()
      }),
    )

    // Web fonts shift layout — re-measure once they settle.
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
    if (this.unmountTimer !== null) {
      clearTimeout(this.unmountTimer)
      this.unmountTimer = null
    }
    this.clearFlipTimers()
    this.clearHoldTimer()
    if (this.toastTimer !== null) {
      clearTimeout(this.toastTimer)
      this.toastTimer = null
    }
    if (this.konamiClassTimer !== null) {
      clearTimeout(this.konamiClassTimer)
      this.konamiClassTimer = null
    }
    this.io?.disconnect()
    this.io = null
    for (const cleanup of this.cleanups) cleanup()
    this.cleanups = []
    this.scene?.dispose()
    this.scene = null
    this.parallax = []
    this.anchors = []
    this.romanLines = []
    this.blobClicks = []
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

    const f = this.sectionFloat(scroll.scroll)
    this.updateNav(f)

    if (this.staticMode) {
      // Reduced motion: one composed frame — blob frozen mid-morph, no
      // parallax, no dolly. Re-render only when something invalidates it.
      if (this.staticDirty) {
        s.time = 4.2
        s.amp = 0.26
        s.freq = 1.15
        s.swirl = 0
        s.scrollZ = 0
        s.flash = 0
        s.blobX = viewport.isMobile ? 0 : 0.85
        s.blobY = -0.1
        s.blobScale = 1
        s.camX = 0
        s.camY = 0
        s.focus = 7
        s.bokeh = 2.4
        // One composed frame must stay readable behind every section.
        s.dim = 0.6
        s.overdrive = 0
        this.scene.apply(s)
        this.scene.render(1 / 60)
        this.staticDirty = false
      }
      return
    }

    // --- cursor: velocity melts the chrome; ndc steers the camera ----------
    const speed = viewport.isTouch
      ? 0
      : Math.min(1, Math.hypot(cursor.velocity.x, cursor.velocity.y) / 2300)
    s.swirl = damp(s.swirl, speed, 3.5, dt)
    s.camX = damp(s.camX, viewport.isTouch ? 0 : cursor.ndc.x * 0.6, 2.8, dt)
    s.camY = damp(s.camY, viewport.isTouch ? 0 : cursor.ndc.y * 0.35, 2.8, dt)

    // --- accent flash + overdrive decay ------------------------------------------
    s.flash = damp(s.flash, 0, 3.0, dt)
    s.overdrive = damp(s.overdrive, 0, 1.4, dt)
    if (s.overdrive < 0.01) s.overdrive = 0

    // --- per-section morph + rack focus -----------------------------------------
    const lam = 3.0
    const mobileScale = viewport.isMobile ? 0.78 : 1
    s.amp = damp(s.amp, sampleKF(KF.amp, f), lam, dt)
    s.freq = damp(s.freq, sampleKF(KF.freq, f), lam, dt)
    s.blobX = damp(s.blobX, sampleKF(KF.x, f) * mobileScale, lam, dt)
    s.blobY = damp(s.blobY, sampleKF(KF.y, f), lam, dt)
    s.blobScale = damp(s.blobScale, sampleKF(KF.scale, f), lam, dt)
    s.focus = damp(s.focus, sampleKF(KF.focus, f), 2.4, dt)
    s.bokeh = damp(s.bokeh, sampleKF(KF.bokeh, f), 2.4, dt)
    // Readability: dim/defocus the particle field behind dense text.
    s.dim = damp(s.dim, sampleKF(KF.dim, f), 2.2, dt)

    // --- dolly + time ------------------------------------------------------------
    s.scrollZ = scroll.progress * 46
    this.glTime += dt * (0.55 + s.swirl * 1.5)

    // --- Konami spectacle: rack-focus whip + particle storm (~3s) -----------------
    if (this.knTime > 0) {
      this.knTime = Math.max(0, this.knTime - dt)
      const kn = clamp(
        Math.min(
          (KONAMI_SECONDS - this.knTime) / 0.35,
          this.knTime / 0.45,
        ),
        0,
        1,
      )
      s.swirl = Math.max(s.swirl, kn * 0.85)
      s.flash = Math.max(s.flash, kn * 0.9)
      s.focus = lerp(s.focus, 6.5 + 4.8 * Math.sin(this.glTime * 5.2), kn)
      s.bokeh = lerp(s.bokeh, 5.4, kn * 0.8)
      this.glTime += dt * kn * 2.6
    }

    // --- MOLTEN OVERDRIVE: brief camera shake while the surge rings out ----------
    if (s.overdrive > 0.02) {
      const shake = s.overdrive * 0.07
      s.camX += Math.sin(this.glTime * 43) * shake
      s.camY += Math.cos(this.glTime * 51) * shake * 0.7
    }

    s.time = this.glTime

    this.applyParallax(scroll.scroll)
    this.updateScrollHint(scroll.scroll)

    this.scene.apply(s)
    this.scene.render(dt)
  }

  // --- interaction -------------------------------------------------------------

  /** Kick the lime surge (particles + kicker light). */
  private flashKick(): void {
    this.state.flash = 1
  }

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
          if (dest) this.ctx.scroll.scrollTo(dest, { duration: 1.4 })
        }
        sfxElectroformClick()
        return
      }

      const expand = target.closest<HTMLButtonElement>('[data-expand]')
      if (expand) {
        const row = expand.parentElement
        if (!row) return
        const open = row.classList.toggle('is-open')
        expand.setAttribute('aria-expanded', String(open))
        this.flashKick()
        sfxElectroformClick()
        return
      }

      // MOLTEN OVERDRIVE egg: 5 raycast hits on the blob within 3s.
      if (!target.closest('a, button') && e instanceof MouseEvent) {
        this.registerBlobClick(e.clientX, e.clientY)
      }
    }

    const onPointerOver = (e: Event): void => {
      const target = e.target
      if (!(target instanceof Element)) return
      const el = target.closest('[data-flash]')
      if (el && el !== this.hoverFlashEl) {
        this.hoverFlashEl = el
        this.flashKick()
        sfxElectroformHover()
      }
    }

    const onPointerOut = (e: Event): void => {
      const target = e.target
      if (!(target instanceof Element)) return
      const el = target.closest('[data-flash]')
      const related = (e as PointerEvent).relatedTarget
      if (
        el === this.hoverFlashEl &&
        el &&
        !(related instanceof Node && el.contains(related))
      ) {
        this.hoverFlashEl = null
      }
    }

    root.addEventListener('click', onClick)
    root.addEventListener('pointerover', onPointerOver, { passive: true })
    root.addEventListener('pointerout', onPointerOut, { passive: true })
    this.cleanups.push(() => {
      root.removeEventListener('click', onClick)
      root.removeEventListener('pointerover', onPointerOver)
      root.removeEventListener('pointerout', onPointerOut)
    })
  }

  // --- easter eggs ----------------------------------------------------------------

  /**
   * Hero-name egg: holding the pointer down (or hovering >1.2s) flips the
   * name letter-by-letter to katakana ソウビク・ゴーシュ, back on release.
   */
  private bindNameEgg(): void {
    if (!this.dom) return
    const name = this.dom.heroName
    this.romanLines = this.dom.heroLetterLines.map((line) =>
      line.map((span) => span.textContent ?? ''),
    )

    const onDown = (e: PointerEvent): void => {
      // Keep mouse holds from starting a text-selection drag.
      if (e.pointerType === 'mouse') e.preventDefault()
      this.clearHoldTimer()
      this.flipName(true)
    }
    const onEnter = (e: PointerEvent): void => {
      if (e.pointerType !== 'mouse' || this.nameKana) return
      this.clearHoldTimer()
      this.holdTimer = window.setTimeout(() => {
        this.holdTimer = null
        this.flipName(true)
      }, 1200)
    }
    const release = (): void => {
      this.clearHoldTimer()
      this.flipName(false)
    }

    name.addEventListener('pointerdown', onDown)
    name.addEventListener('pointerenter', onEnter)
    name.addEventListener('pointerup', release)
    name.addEventListener('pointercancel', release)
    name.addEventListener('pointerleave', release)
    this.cleanups.push(() => {
      name.removeEventListener('pointerdown', onDown)
      name.removeEventListener('pointerenter', onEnter)
      name.removeEventListener('pointerup', release)
      name.removeEventListener('pointercancel', release)
      name.removeEventListener('pointerleave', release)
    })
  }

  /** Flip the hero letters to katakana (or back), with a small stagger. */
  private flipName(toKana: boolean): void {
    if (!this.dom || this.nameKana === toKana) return
    this.nameKana = toKana
    this.clearFlipTimers()

    let gi = 0
    this.dom.heroLetterLines.forEach((letters, li) => {
      const kana = KANA_LINES[li] ?? ''
      letters.forEach((span, ci) => {
        // Kana is shorter than the roman name — surplus letters collapse.
        const target = toKana
          ? kana.charAt(ci)
          : (this.romanLines[li]?.[ci] ?? '')

        if (this.staticMode) {
          // Reduced motion: instant swap, no animation.
          span.textContent = target
          return
        }

        const delay = gi * FLIP_STAGGER_MS
        gi += 1
        this.flipTimers.push(
          window.setTimeout(() => span.classList.add('is-flip'), delay),
        )
        this.flipTimers.push(
          window.setTimeout(() => {
            span.textContent = target
            span.classList.remove('is-flip')
          }, delay + FLIP_HALF_MS),
        )
      })
    })
  }

  private clearFlipTimers(): void {
    for (const id of this.flipTimers) clearTimeout(id)
    this.flipTimers = []
  }

  private clearHoldTimer(): void {
    if (this.holdTimer !== null) {
      clearTimeout(this.holdTimer)
      this.holdTimer = null
    }
  }

  /** Raycast a click against the blob; 5 hits inside 3s trigger overdrive. */
  private registerBlobClick(clientX: number, clientY: number): void {
    if (!this.scene) return
    const { width, height } = this.ctx.viewport
    if (width <= 0 || height <= 0) return
    const ndcX = (clientX / width) * 2 - 1
    const ndcY = -((clientY / height) * 2 - 1)
    if (!this.scene.hitTestBlob(ndcX, ndcY)) return

    const now = performance.now()
    this.blobClicks = this.blobClicks.filter(
      (t) => now - t < OVERDRIVE_WINDOW_MS,
    )
    this.blobClicks.push(now)

    if (this.blobClicks.length >= OVERDRIVE_CLICKS) {
      this.blobClicks = []
      this.triggerOverdrive()
    } else {
      // Affirm each registered hit with a small lime kick.
      this.flashKick()
    }
  }

  /** MOLTEN OVERDRIVE — surge + shake + toast, then settles via damping. */
  private triggerOverdrive(): void {
    this.showToast('OVERDRIVE // UNLOCKED')
    if (this.staticMode) return
    this.state.overdrive = 1
    this.state.flash = 1
  }

  /** Konami: ~3s rack-focus whip + particle storm + chrome→lime inversion. */
  private bindKonami(): void {
    const onKonami = (): void => {
      const wrapper = this.dom?.wrapper
      if (!wrapper) return
      wrapper.classList.add('is-konami')
      if (this.konamiClassTimer !== null) clearTimeout(this.konamiClassTimer)
      this.konamiClassTimer = window.setTimeout(() => {
        this.konamiClassTimer = null
        this.dom?.wrapper.classList.remove('is-konami')
      }, KONAMI_SECONDS * 1000)

      sfxElectroformKonami()
      this.showToast('コナミ // CHROME INVERTED')
      // Reduced motion: palette swap + toast only, no GL storm.
      if (!this.staticMode) this.knTime = KONAMI_SECONDS
    }

    window.addEventListener(KONAMI_EVENT, onKonami)
    this.cleanups.push(() => window.removeEventListener(KONAMI_EVENT, onKonami))
  }

  /** Mono toast (role=status) — announces egg unlocks politely. */
  private showToast(text: string): void {
    const toast = this.dom?.toast
    if (!toast) return
    toast.textContent = text
    toast.classList.add('is-on')
    if (this.toastTimer !== null) clearTimeout(this.toastTimer)
    this.toastTimer = window.setTimeout(() => {
      this.toastTimer = null
      this.dom?.toast.classList.remove('is-on')
    }, 2600)
  }

  // --- reveals -----------------------------------------------------------------

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
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    const targets = this.dom.wrapper.querySelectorAll('.ef-reveal')
    targets.forEach((el) => this.io?.observe(el))
  }

  private revealEverything(): void {
    this.dom?.wrapper
      .querySelectorAll('.ef-reveal')
      .forEach((el) => el.classList.add('is-in'))
  }

  // --- layout / scroll choreography ----------------------------------------------

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
      return i === 0 ? 0 : Math.max(0, top - vh * 0.45)
    })

    for (const item of this.parallax) {
      const rect = item.el.getBoundingClientRect()
      item.center = rect.top + sc + rect.height / 2
    }
  }

  /** Continuous chapter index — 0 at hero, 7 at contact. */
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
      if (Math.abs(rel) > vh * 1.5) continue
      const y = rel * (1 - item.speed)
      if (Math.abs(y - item.lastY) < 0.4) continue
      item.lastY = y
      item.el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`
    }
  }

  private updateNav(f: number): void {
    if (!this.dom) return
    const idx = clamp(Math.round(f), 0, this.dom.navLinks.length - 1)
    if (idx === this.activeNav) return
    const prev = this.dom.navLinks[this.activeNav]
    if (prev) {
      prev.classList.remove('is-active')
      prev.removeAttribute('aria-current')
    }
    const next = this.dom.navLinks[idx]
    if (next) {
      next.classList.add('is-active')
      next.setAttribute('aria-current', 'true')
    }
    this.activeNav = idx
  }

  private updateScrollHint(s: number): void {
    if (!this.dom) return
    const scrolled = s > 60
    if (scrolled !== this.scrolledHint) {
      this.scrolledHint = scrolled
      this.dom.wrapper.classList.toggle('is-scrolled', scrolled)
    }
  }
}

const createElectroformTheme: ThemeFactory = () => new ElectroformTheme()

export default createElectroformTheme
