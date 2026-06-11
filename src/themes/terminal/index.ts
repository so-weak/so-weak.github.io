/**
 * TERMINAL NOIR — a classified dossier on a phosphor CRT.
 *
 * Controller: builds the dossier DOM (dom.ts), drives the GL globe + CRT
 * post chain (scene.ts), and owns all interaction state — the typed
 * `whoami` intro, scroll-reveals, DECODE-IN text scrambles, scroll-driven
 * DOM parallax ([data-speed] panels), the velocity-reactive scanline sweep
 * + activity LED, the cursor-reactive glyph field, the live status bar
 * (mode / section / scroll % / clock), vim-style j/k · gg · G navigation,
 * the intercepted-feed media panel (when generated media exists), and the
 * easter eggs: katakana name flip, hidden command mode, and the Konami
 * "ACCESS GRANTED" degauss spectacle.
 *
 * All per-frame work runs through update() — no rAF, no transitions chased
 * by timers. Reduced motion: typing/decodes resolve instantly, reveals are
 * static, parallax/sweep/glyph ripple are off, the feed video pauses on its
 * poster, and the GL scene renders a frozen composed frame.
 */

import '@fontsource-variable/jetbrains-mono'
import '@fontsource/chakra-petch/500.css'
import '@fontsource/chakra-petch/700.css'
import type { Theme, ThemeContext, ThemeFactory } from '../types'
import { clamp, damp } from '../../utils/math'
import { renderShell } from './dom'
import { TerminalScene } from './scene'
import { sfxTerminalClick, sfxTerminalKonami } from '../../utils/sound'
import './styles.css'

const TYPED_CMD = 'whoami'
const TYPE_DELAY = 0.4 // s after mount before the first character
const TYPE_CPS = 13.5 // characters per second
const TYPE_SETTLE = 0.32 // pause after the last char before the id block
const UNMOUNT_MS = 360
const TOAST_MS = 3000
const SCROLL_STEP = 0.62 // viewport heights per j/k press
const GG_WINDOW_MS = 450

// --- motion tuning -----------------------------------------------------------
const PAR_MAX_PX = 44 // parallax drift is clamped to stay subtle
const SWEEP_H = 150 // px height of the travelling scanline band
const SWEEP_BASE_SPEED = 26 // px/s drift when the page is still
const GLYPH_COUNT = 44
const GLYPH_RADIUS = 170 // px radius of cursor influence on the glyph field

// --- easter eggs ---------------------------------------------------------------
const KANA_NAME = 'ソウビク・ゴーシュ' // JLPT N4 nod — hold the hero name
const NAME_HOVER_MS = 1200
const CMD_IDLE_MS = 2000 // command-mode buffer reset
const RAIN_MS = 4000 // matrix overlay duration

const DECODE_GLYPHS = '#$%&@*+=<>/\\|10XZKR'
const RAIN_GLYPHS =
  'アィウェオカキクケコサシスセソタチツテトナニヌネノハヒフヘホ0123456789'

const KONAMI = [
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

const pad3 = (n: number): string => String(n).padStart(3, '0')

const randomGlyph = (set: string): string =>
  set.charAt(Math.floor(Math.random() * set.length))

/** DECODE-IN: resolved head + scrambled tail (spaces stay spaces). */
const renderDecode = (to: string, p: number): string => {
  const n = to.length
  const resolved = Math.floor(p * n)
  let out = to.slice(0, resolved)
  for (let i = resolved; i < n; i++) {
    out += to.charAt(i) === ' ' ? ' ' : randomGlyph(DECODE_GLYPHS)
  }
  return out
}

/** Letter-by-letter flip between two strings with a scramble at the seam. */
const renderMorph = (from: string, to: string, p: number): string => {
  const n = Math.max(from.length, to.length)
  const k = Math.floor(p * (n + 1))
  let out = ''
  for (let i = 0; i < n; i++) {
    if (i < k) out += to.charAt(i)
    else if (i === k && p < 1) out += randomGlyph(RAIN_GLYPHS)
    else out += from.charAt(i)
  }
  return out
}

interface TextJob {
  mode: 'decode' | 'morph'
  el: HTMLElement
  from: string
  to: string
  start: number // theme-elapsed seconds
  dur: number
}

interface ParItem {
  el: HTMLElement
  speed: number
  center: number // document-space centre, measured lazily
  last: number // last applied offset px
}

interface GlyphItem {
  el: HTMLElement
  fx: number // viewport-fraction position
  fy: number
  x: number // px position, refreshed on resize
  y: number
  base: number
  cur: number
  lastOp: number
  nudged: boolean
}

class TerminalTheme implements Theme {
  readonly id = 'terminal' as const
  readonly name = 'Terminal'

  private ctx!: ThemeContext
  private scene: TerminalScene | null = null
  private app: HTMLElement | null = null
  private reduced = false

  private cleanups: Array<() => void> = []
  private observers: IntersectionObserver[] = []
  private timeouts = new Set<number>()

  // Typed intro state.
  private typedEl: HTMLElement | null = null
  private sessionEl: HTMLElement | null = null
  private typedCount = 0
  private typingDone = false
  private mounted = false

  // Status bar refs + caches (write to the DOM only on change).
  private clockEl: HTMLElement | null = null
  private scrollEl: HTMLElement | null = null
  private modeEl: HTMLElement | null = null
  private secEl: HTMLElement | null = null
  private clockAcc = 10 // > 1 → first update() paints the clock immediately
  private lastClock = ''
  private lastScrollPct = -1
  private lastMode = ''
  private rootModeUntil = 0

  // Sidebar nav.
  private navItems = new Map<string, HTMLElement>()
  private activeNav = ''

  // Keyboard state.
  private lastG = 0
  private konamiIdx = 0
  private toastEl: HTMLElement | null = null
  private toastTimerId = 0

  // Scroll-driven DOM parallax.
  private parItems: ParItem[] = []
  private parDirty = true
  private lastParScroll = -1

  // Scanline sweep band + status LED.
  private sweepEl: HTMLElement | null = null
  private sweepY = -SWEEP_H
  private sweepOp = 0
  private ledEl: HTMLElement | null = null
  private ledVal = 0
  private ledLast = -1

  // Cursor-reactive glyph field.
  private glyphField: HTMLElement | null = null
  private glyphs: GlyphItem[] = []
  private glyphsDirty = true

  // Ticker-driven text jobs (decode-in reveals + katakana name morph).
  private jobs: TextJob[] = []
  private elapsedNow = 0

  // Easter eggs.
  private nameEl: HTMLElement | null = null
  private nameOriginal = ''
  private nameHoverId = 0
  private cmdBuffer = ''
  private cmdTimerId = 0
  private rainEl: HTMLElement | null = null
  private spectacleUntil = 0

  // Intercepted feed (generated media; skipped when manifest.ok is false).
  private feedVideo: HTMLVideoElement | null = null

  async init(ctx: ThemeContext): Promise<void> {
    this.ctx = ctx
    this.reduced = ctx.reducedMotion
    const { root, viewport, content } = ctx

    ctx.scroll.configure({ lerp: 0.12 })

    // --- DOM -------------------------------------------------------------
    const app = document.createElement('div')
    app.className = 'trm-app'
    if (ctx.reducedMotion) app.classList.add('trm-reduced')
    app.innerHTML = renderShell(content)

    const toast = document.createElement('div')
    toast.className = 'trm-toast'
    toast.setAttribute('role', 'status')
    toast.setAttribute('aria-live', 'polite')
    app.appendChild(toast)
    this.toastEl = toast

    // Travelling scanline sweep band (velocity-reactive, desktop only).
    const sweep = document.createElement('div')
    sweep.className = 'trm-sweep'
    sweep.setAttribute('aria-hidden', 'true')
    app.appendChild(sweep)
    this.sweepEl = sweep

    // Cursor-reactive glyph field — pointer devices only, sits between the
    // GL canvas and the dossier text (.trm-main carries z-index: 1).
    if (!viewport.isTouch && !viewport.isMobile) this.buildGlyphField(app)

    root.appendChild(app)
    this.app = app

    // --- refs ------------------------------------------------------------
    this.typedEl = app.querySelector<HTMLElement>('[data-typed]')
    this.sessionEl = app.querySelector<HTMLElement>('[data-session]')
    this.clockEl = app.querySelector<HTMLElement>('[data-status-clock]')
    this.scrollEl = app.querySelector<HTMLElement>('[data-status-scroll]')
    this.modeEl = app.querySelector<HTMLElement>('[data-status-mode]')
    this.secEl = app.querySelector<HTMLElement>('[data-status-sec]')
    this.ledEl = app.querySelector<HTMLElement>('[data-status-led]')

    this.navItems.clear()
    for (const el of app.querySelectorAll<HTMLElement>('[data-nav]')) {
      this.navItems.set(el.dataset.nav ?? '', el)
    }

    this.nameEl = app.querySelector<HTMLElement>('.trm-id__name')
    this.nameOriginal = this.nameEl?.textContent ?? ''
    this.bindNameFlip()

    // --- GL --------------------------------------------------------------
    this.scene = new TerminalScene(ctx.renderer)
    await this.scene.init(
      viewport.width,
      viewport.height,
      viewport.isMobile,
      ctx.reducedMotion,
    )

    // --- listeners / observers -------------------------------------------
    this.cleanups.push(ctx.cursor.bind(root))

    window.addEventListener('keydown', this.onKeydown)
    this.cleanups.push(() => window.removeEventListener('keydown', this.onKeydown))

    // Core dispatches this on the Konami code; the local tracker below stays
    // as a fallback — grantAccess() is guarded against double-fire.
    window.addEventListener('sg:konami', this.onKonami)
    this.cleanups.push(() => window.removeEventListener('sg:konami', this.onKonami))

    app.addEventListener('click', this.onClick)
    this.cleanups.push(() => app.removeEventListener('click', this.onClick))

    // <details> toggling reflows everything below it — re-measure parallax.
    app.addEventListener('toggle', this.onLayoutShift, true)
    this.cleanups.push(() =>
      app.removeEventListener('toggle', this.onLayoutShift, true),
    )

    this.cleanups.push(ctx.scroll.on((s) => this.onScroll(s.progress, s.velocity)))

    this.cleanups.push(
      ctx.viewport.onReducedMotionChange((rm) => {
        this.reduced = rm
        this.scene?.setReduced(rm)
        this.app?.classList.toggle('trm-reduced', rm)
        if (rm) {
          this.finishTyping()
          this.finalizeJobs()
          this.clearMotionStyles()
          this.feedVideo?.pause()
        } else {
          this.parDirty = true
          void this.feedVideo?.play().catch(() => undefined)
        }
      }),
    )

    this.setupReveals(app)
    this.setupSectionTracking(app)
    this.setupDecode(app)
    this.collectParallax(app)

    // Web fonts settle late and shift layout — re-measure once ready.
    void document.fonts.ready.then(() => {
      this.parDirty = true
    })

    // Intercepted feed: reads the generated-media manifest at runtime and
    // degrades silently when ok:false / missing (current state).
    void this.loadFeed()
  }

  mount(): void {
    this.mounted = true
    this.app?.classList.add('is-mounted')
    if (this.ctx.reducedMotion) this.finishTyping()
  }

  unmount(): Promise<void> {
    this.app?.classList.remove('is-mounted')
    this.app?.classList.add('is-leaving')
    const wait = this.ctx.reducedMotion ? 0 : UNMOUNT_MS
    return new Promise((resolve) => {
      const id = window.setTimeout(() => {
        this.timeouts.delete(id)
        resolve()
      }, wait)
      this.timeouts.add(id)
    })
  }

  dispose(): void {
    for (const cleanup of this.cleanups) cleanup()
    this.cleanups = []
    for (const o of this.observers) o.disconnect()
    this.observers = []
    for (const id of this.timeouts) window.clearTimeout(id)
    this.timeouts.clear()

    if (this.feedVideo) {
      this.feedVideo.pause()
      this.feedVideo.removeAttribute('src')
      this.feedVideo.load()
      this.feedVideo = null
    }

    this.scene?.dispose()
    this.scene = null

    this.navItems.clear()
    this.jobs = []
    this.parItems = []
    this.glyphs = []
    this.glyphField = null
    this.rainEl = null
    this.sweepEl = null
    this.ledEl = null
    this.nameEl = null
    this.cmdBuffer = ''
    this.app = null
    this.typedEl = null
    this.sessionEl = null
    this.clockEl = null
    this.scrollEl = null
    this.modeEl = null
    this.secEl = null
    this.toastEl = null
  }

  resize(width: number, height: number, _dpr: number): void {
    this.scene?.resize(width, height)
    this.parDirty = true
    this.glyphsDirty = true
  }

  update(dt: number, elapsed: number): void {
    this.elapsedNow = elapsed

    // Typed intro — character count derived from mount-elapsed time.
    if (this.mounted && !this.typingDone) {
      const count = clamp(
        Math.floor((elapsed - TYPE_DELAY) * TYPE_CPS),
        0,
        TYPED_CMD.length,
      )
      if (count !== this.typedCount && this.typedEl) {
        this.typedCount = count
        this.typedEl.textContent = TYPED_CMD.slice(0, count)
      }
      if (elapsed >= TYPE_DELAY + TYPED_CMD.length / TYPE_CPS + TYPE_SETTLE) {
        this.finishTyping()
      }
    }

    // Status-bar clock, repainted once per second.
    this.clockAcc += dt
    if (this.clockAcc >= 1 && this.clockEl) {
      this.clockAcc = 0
      const d = new Date()
      const text = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
      if (text !== this.lastClock) {
        this.lastClock = text
        this.clockEl.textContent = text
      }
    }

    // DECODE-IN scrambles + katakana morphs.
    this.processJobs(elapsed)

    // Motion systems — ticker-driven, all off under reduced motion.
    if (!this.reduced) {
      if (!this.ctx.viewport.isMobile) {
        this.updateParallax()
        this.updateSweep(dt)
        this.updateGlyphs(dt)
      }
      this.updateLed(dt, elapsed)
    } else if (this.ledEl && this.ledLast !== 1) {
      this.ledLast = 1
      this.ledEl.style.opacity = '1'
    }

    const { scroll, cursor } = this.ctx
    this.scene?.update(dt, elapsed, scroll.progress, cursor.ndc.x, cursor.ndc.y)
  }

  // --- internals -----------------------------------------------------------

  private later(fn: () => void, ms: number): number {
    const id = window.setTimeout(() => {
      this.timeouts.delete(id)
      fn()
    }, ms)
    this.timeouts.add(id)
    return id
  }

  private cancelLater(id: number): void {
    window.clearTimeout(id)
    this.timeouts.delete(id)
  }

  private finishTyping(): void {
    if (this.typingDone) return
    this.typingDone = true
    if (this.typedEl) this.typedEl.textContent = TYPED_CMD
    this.sessionEl?.classList.add('is-done')
  }

  /** Staggered scroll-reveals; observers unhook each element after firing. */
  private setupReveals(app: HTMLElement): void {
    const targets = app.querySelectorAll<HTMLElement>('.trm-reveal')
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-in')
          io.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    )
    for (const el of targets) io.observe(el)
    this.observers.push(io)
  }

  /** Track the section under the viewport centre → sidebar + status bar. */
  private setupSectionTracking(app: HTMLElement): void {
    const sections = app.querySelectorAll<HTMLElement>('section[id]')
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) this.setActiveSection(entry.target.id)
        }
      },
      { rootMargin: '-42% 0px -50% 0px', threshold: 0 },
    )
    for (const el of sections) io.observe(el)
    this.observers.push(io)
  }

  /**
   * DECODE-IN: [data-decode] text scrambles from random glyphs to its final
   * characters when it enters the viewport — staggered per element, driven
   * from update(). Skipped entirely under reduced motion (text is already
   * final in the DOM). The original text is pinned to aria-label while the
   * scramble runs so AT never reads glyph noise.
   */
  private setupDecode(app: HTMLElement): void {
    const io = new IntersectionObserver(
      (entries) => {
        let batch = 0
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          io.unobserve(entry.target)
          if (this.reduced || !(entry.target instanceof HTMLElement)) continue
          const el = entry.target
          const text = el.textContent ?? ''
          if (!text.trim()) continue
          el.setAttribute('aria-label', text)
          this.jobs.push({
            mode: 'decode',
            el,
            from: '',
            to: text,
            start: this.elapsedNow + batch * 0.07,
            dur: clamp(0.38 + text.length * 0.022, 0.4, 1.05),
          })
          batch += 1
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.1 },
    )
    for (const el of app.querySelectorAll<HTMLElement>('[data-decode]')) {
      io.observe(el)
    }
    this.observers.push(io)
  }

  private processJobs(elapsed: number): void {
    if (this.jobs.length === 0) return
    for (let i = this.jobs.length - 1; i >= 0; i--) {
      const job = this.jobs[i]
      if (!job || elapsed < job.start) continue
      const p = clamp((elapsed - job.start) / job.dur, 0, 1)
      job.el.textContent =
        job.mode === 'decode'
          ? renderDecode(job.to, p)
          : renderMorph(job.from, job.to, p)
      if (p >= 1) {
        this.finishJob(job)
        this.jobs.splice(i, 1)
      }
    }
  }

  private finishJob(job: TextJob): void {
    job.el.textContent = job.to
    if (job.mode === 'decode') job.el.removeAttribute('aria-label')
    else job.el.dataset.text = job.to // keep the hover-glitch echoes in sync
  }

  private finalizeJobs(): void {
    for (const job of this.jobs) this.finishJob(job)
    this.jobs = []
  }

  // --- scroll-driven parallax ------------------------------------------------

  private collectParallax(app: HTMLElement): void {
    this.parItems = []
    for (const el of app.querySelectorAll<HTMLElement>('[data-speed]')) {
      const speed = Number.parseFloat(el.dataset.speed ?? '0')
      if (speed) this.parItems.push({ el, speed, center: 0, last: 0 })
    }
    this.parDirty = true
  }

  /** Cache document-space centres (undoing any offset currently applied). */
  private measureParallax(): void {
    const scroll = this.ctx.scroll.scroll
    for (const it of this.parItems) {
      const r = it.el.getBoundingClientRect()
      it.center = r.top + scroll + r.height / 2 - it.last
    }
  }

  private updateParallax(): void {
    const s = this.ctx.scroll.scroll
    if (this.parDirty) {
      this.parDirty = false
      this.measureParallax()
    } else if (Math.abs(s - this.lastParScroll) < 0.05) {
      return
    }
    this.lastParScroll = s
    const vh = this.ctx.viewport.height
    const mid = s + vh / 2
    for (const it of this.parItems) {
      if (it.center < s - vh || it.center > s + vh * 2) continue
      const off = clamp((mid - it.center) * it.speed, -PAR_MAX_PX, PAR_MAX_PX)
      if (Math.abs(off - it.last) < 0.1) continue
      it.last = off
      it.el.style.transform =
        off === 0 ? '' : `translate3d(0, ${off.toFixed(2)}px, 0)`
    }
  }

  // --- scanline sweep + activity LED -----------------------------------------

  private updateSweep(dt: number): void {
    const el = this.sweepEl
    if (!el) return
    const vh = this.ctx.viewport.height
    const vel = Math.abs(this.ctx.scroll.velocity)
    this.sweepY += dt * (SWEEP_BASE_SPEED + Math.min(vel, 50) * 9)
    if (this.sweepY > vh + SWEEP_H) this.sweepY = -SWEEP_H
    this.sweepOp = damp(
      this.sweepOp,
      clamp(0.05 + vel * 0.012, 0.05, 0.3),
      4,
      dt,
    )
    el.style.transform = `translate3d(0, ${this.sweepY.toFixed(1)}px, 0)`
    el.style.opacity = this.sweepOp.toFixed(3)
  }

  private updateLed(dt: number, elapsed: number): void {
    const el = this.ledEl
    if (!el) return
    const v = Math.min(Math.abs(this.ctx.scroll.velocity) / 22, 1)
    this.ledVal = damp(this.ledVal, v, 6, dt)
    // Idle: slow heartbeat blink. Scrolling: brightness tracks velocity.
    const idle = elapsed % 1.2 < 0.6 ? 0.55 : 0.16
    const target = this.ledVal > 0.04 ? 0.35 + 0.65 * this.ledVal : idle
    if (Math.abs(target - this.ledLast) > 0.03) {
      this.ledLast = target
      el.style.opacity = target.toFixed(3)
    }
  }

  // --- cursor-reactive glyph field --------------------------------------------

  private buildGlyphField(app: HTMLElement): void {
    const field = document.createElement('div')
    field.className = 'trm-glyphs'
    field.setAttribute('aria-hidden', 'true')
    const frag = document.createDocumentFragment()
    for (let i = 0; i < GLYPH_COUNT; i++) {
      const span = document.createElement('span')
      const fx = Math.random()
      const fy = Math.random()
      const base = 0.04 + Math.random() * 0.08
      span.textContent = randomGlyph(RAIN_GLYPHS)
      span.style.left = `${(fx * 100).toFixed(2)}%`
      span.style.top = `${(fy * 100).toFixed(2)}%`
      span.style.fontSize = `${(10 + Math.random() * 5).toFixed(1)}px`
      span.style.opacity = base.toFixed(3)
      frag.appendChild(span)
      this.glyphs.push({
        el: span,
        fx,
        fy,
        x: 0,
        y: 0,
        base,
        cur: base,
        lastOp: base,
        nudged: false,
      })
    }
    field.appendChild(frag)
    app.appendChild(field)
    this.glyphField = field
  }

  private updateGlyphs(dt: number): void {
    if (!this.glyphField || this.ctx.viewport.isTouch) return
    const { width, height } = this.ctx.viewport
    if (this.glyphsDirty) {
      this.glyphsDirty = false
      for (const g of this.glyphs) {
        g.x = g.fx * width
        g.y = g.fy * height
      }
    }
    const cx = this.ctx.cursor.lerped.x
    const cy = this.ctx.cursor.lerped.y
    const r2 = GLYPH_RADIUS * GLYPH_RADIUS
    for (const g of this.glyphs) {
      const dx = g.x - cx
      const dy = g.y - cy
      const d2 = dx * dx + dy * dy
      const influence = d2 < r2 * 9 ? Math.exp(-d2 / r2) : 0
      g.cur = damp(g.cur, g.base + influence * 0.85, 8, dt)
      if (Math.abs(g.cur - g.lastOp) > 0.012) {
        g.lastOp = g.cur
        g.el.style.opacity = g.cur.toFixed(3)
      }
      if (influence > 0.04) {
        const d = Math.sqrt(d2) || 1
        const push = influence * 7
        g.el.style.transform = `translate(${((dx / d) * push).toFixed(1)}px, ${((dy / d) * push).toFixed(1)}px)`
        g.nudged = true
      } else if (g.nudged) {
        g.nudged = false
        g.el.style.transform = ''
      }
    }
  }

  /** Reduced motion flipped on: zero out every inline motion style. */
  private clearMotionStyles(): void {
    for (const it of this.parItems) {
      it.el.style.transform = ''
      it.last = 0
    }
    this.lastParScroll = -1
    for (const g of this.glyphs) {
      g.cur = g.base
      g.lastOp = g.base
      g.nudged = false
      g.el.style.opacity = g.base.toFixed(3)
      g.el.style.transform = ''
    }
    if (this.sweepEl) this.sweepEl.style.opacity = '0'
    if (this.ledEl) {
      this.ledEl.style.opacity = '1'
      this.ledLast = 1
    }
    this.rainEl?.remove()
    this.rainEl = null
  }

  private onLayoutShift = (): void => {
    this.parDirty = true
  }

  // --- intercepted feed (generated media) -------------------------------------

  private async loadFeed(): Promise<void> {
    if (this.ctx.viewport.isMobile) return // heavy layer: poster-less skip
    let video = ''
    let poster = ''
    try {
      const res = await fetch('/media/terminal/manifest.json')
      if (!res.ok) return
      const raw: unknown = await res.json()
      if (typeof raw !== 'object' || raw === null) return
      const m = raw as Record<string, unknown>
      if (m.ok !== true) return // graceful skip (current manifest state)
      const str = (v: unknown): string => (typeof v === 'string' ? v : '')
      video = str(m.video) || str(m.src) || str(m.url)
      poster = str(m.poster)
      if (!video && Array.isArray(m.assets)) {
        for (const a of m.assets) {
          if (typeof a !== 'object' || a === null) continue
          const rec = a as Record<string, unknown>
          video = video || str(rec.video) || str(rec.src) || str(rec.url)
          poster = poster || str(rec.poster)
        }
      }
    } catch {
      return
    }
    if (!video || !this.app) return // missing media or disposed mid-fetch

    const fig = document.createElement('figure')
    fig.className = 'trm-feed'
    fig.setAttribute('aria-hidden', 'true') // decorative dossier garnish
    fig.innerHTML = `
      <div class="trm-feed__bar">
        <span class="trm-feed__led"></span>
        <span>feed_07.raw // LIVE</span>
        <span class="trm-feed__lock">[SIGNAL LOCKED]</span>
      </div>
      <div class="trm-feed__screen"><div class="trm-feed__scan"></div></div>
      <figcaption class="trm-feed__cap trm-dim">[SIGNAL LOCKED] · intercepted uplink · 480 lines · phosphor decay nominal</figcaption>`

    const v = document.createElement('video')
    v.muted = true
    v.loop = true
    v.playsInline = true
    v.preload = 'metadata'
    v.setAttribute('muted', '')
    if (poster) v.poster = poster
    v.src = video
    fig.querySelector('.trm-feed__screen')?.prepend(v)

    const head = this.app.querySelector('#experience .trm-sec__head')
    if (!head) return
    head.after(fig)
    this.feedVideo = v
    this.parItems.push({ el: fig, speed: -0.03, center: 0, last: 0 })
    this.parDirty = true
    if (!this.reduced) void v.play().catch(() => undefined)
  }

  // --- status bar / nav --------------------------------------------------------

  private setActiveSection(id: string): void {
    if (id === this.activeNav) return
    this.navItems.get(this.activeNav)?.classList.remove('is-active')
    this.navItems.get(id)?.classList.add('is-active')
    this.activeNav = id
    if (this.secEl) this.secEl.textContent = id.toUpperCase()
  }

  private onScroll(progress: number, velocity: number): void {
    const pct = Math.round(clamp(progress, 0, 1) * 100)
    if (pct !== this.lastScrollPct && this.scrollEl) {
      this.lastScrollPct = pct
      this.scrollEl.textContent = `${pad3(pct)}%`
    }

    if (this.modeEl && performance.now() > this.rootModeUntil) {
      const mode = Math.abs(velocity) > 2 ? 'SCROLL' : 'NORMAL'
      if (mode !== this.lastMode) {
        this.lastMode = mode
        this.modeEl.textContent = mode
      }
    }
  }

  /** Smooth-scroll in-page anchors through Lenis. */
  private onClick = (e: MouseEvent): void => {
    const target = e.target
    if (!(target instanceof Element)) return
    const link = target.closest<HTMLAnchorElement>('a[href^="#"]')
    if (!link) return
    const hash = link.getAttribute('href')
    if (!hash || hash === '#') return
    e.preventDefault()
    const offset = this.ctx.viewport.isMobile ? -72 : -4
    this.ctx.scroll.scrollTo(hash, { offset, duration: 1.1 })
    sfxTerminalClick()
  }

  // --- keyboard: vim nav + Konami + hidden command mode ------------------------

  private onKeydown = (e: KeyboardEvent): void => {
    // Konami sequence tracking (arrows + b a), independent of modifiers.
    if (e.key === KONAMI[this.konamiIdx]) {
      this.konamiIdx += 1
      if (this.konamiIdx === KONAMI.length) {
        this.konamiIdx = 0
        this.grantAccess()
      }
    } else {
      this.konamiIdx = e.key === KONAMI[0] ? 1 : 0
    }

    if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return
    const t = e.target
    if (
      t instanceof HTMLElement &&
      (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
    ) {
      return
    }

    // Hidden command mode — buffer plain keystrokes, reset after 2 s idle.
    if (e.key.length === 1 && e.key !== ' ') {
      this.cmdBuffer = (this.cmdBuffer + e.key.toLowerCase()).slice(-16)
      if (this.cmdTimerId) this.cancelLater(this.cmdTimerId)
      this.cmdTimerId = this.later(() => {
        this.cmdTimerId = 0
        this.cmdBuffer = ''
      }, CMD_IDLE_MS)
      this.checkCommand()
    }

    const { scroll, viewport } = this.ctx
    const step = viewport.height * SCROLL_STEP

    switch (e.key) {
      case 'j':
        scroll.scrollTo(scroll.scroll + step, { duration: 0.5 })
        break
      case 'k':
        scroll.scrollTo(scroll.scroll - step, { duration: 0.5 })
        break
      case 'G':
        scroll.scrollTo(scroll.limit, { duration: 1.2 })
        break
      case 'g': {
        const now = performance.now()
        if (now - this.lastG < GG_WINDOW_MS) {
          this.lastG = 0
          scroll.scrollTo(0, { duration: 1.2 })
        } else {
          this.lastG = now
        }
        break
      }
    }
  }

  private checkCommand(): void {
    const b = this.cmdBuffer
    if (b.endsWith('sudo')) {
      this.runCommand(() =>
        this.toast('$ sudo', 'PERMISSION DENIED: nice try.'),
      )
    } else if (b.endsWith('whoami')) {
      this.runCommand(() =>
        this.toast('$ whoami', 'soweak // clearance: PRODUCTION'),
      )
    } else if (b.endsWith('nihongo')) {
      this.runCommand(() =>
        this.toast('$ nihongo', '日本語 N4 // べんきょうちゅう'),
      )
    } else if (b.endsWith('matrix')) {
      this.runCommand(() => this.matrixRain())
    }
  }

  private runCommand(fn: () => void): void {
    this.cmdBuffer = ''
    if (this.cmdTimerId) {
      this.cancelLater(this.cmdTimerId)
      this.cmdTimerId = 0
    }
    fn()
  }

  /** Amber toast styled as terminal output. Static theme strings only. */
  private toast(title: string, sub: string): void {
    const el = this.toastEl
    if (!el) return
    el.innerHTML = `<b>${title}</b><span>${sub}</span>`
    el.classList.add('is-on')
    if (this.toastTimerId) this.cancelLater(this.toastTimerId)
    this.toastTimerId = this.later(() => {
      this.toastTimerId = 0
      el.classList.remove('is-on')
    }, TOAST_MS)
  }

  /** `matrix` — 4 s glyph-rain overlay, then ACCESS GRANTED. */
  private matrixRain(): void {
    if (this.reduced) {
      this.toast('ACCESS GRANTED', 'wake up, operator. the dossier has you')
      return
    }
    if (this.rainEl || !this.app) return
    const overlay = document.createElement('div')
    overlay.className = 'trm-rain'
    overlay.setAttribute('aria-hidden', 'true')
    const cols = Math.min(
      36,
      Math.max(10, Math.floor(this.ctx.viewport.width / 38)),
    )
    let html = ''
    for (let i = 0; i < cols; i++) {
      let chars = ''
      const len = 26 + Math.floor(Math.random() * 22)
      for (let j = 0; j < len; j++) chars += `${randomGlyph(RAIN_GLYPHS)}\n`
      const dur = (1.1 + Math.random() * 1.8).toFixed(2)
      const delay = (-Math.random() * 3).toFixed(2)
      const op = (0.25 + Math.random() * 0.65).toFixed(2)
      html += `<span style="left:${(((i + 0.5) / cols) * 100).toFixed(2)}%;animation-duration:${dur}s;animation-delay:${delay}s;opacity:${op}">${chars}</span>`
    }
    overlay.innerHTML = html
    this.app.appendChild(overlay)
    this.rainEl = overlay
    this.later(() => {
      this.rainEl?.remove()
      this.rainEl = null
      this.toast('ACCESS GRANTED', 'wake up, operator. the dossier has you')
    }, RAIN_MS)
  }

  // --- katakana name flip --------------------------------------------------------

  private bindNameFlip(): void {
    const el = this.nameEl
    if (!el || !this.nameOriginal) return
    const down = (e: PointerEvent): void => {
      this.cancelNameTimer()
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        /* capture unsupported — release still lands via pointerleave */
      }
      this.flipName(true)
    }
    const up = (): void => this.flipName(false)
    const enter = (): void => {
      this.cancelNameTimer()
      this.nameHoverId = this.later(() => {
        this.nameHoverId = 0
        this.flipName(true)
      }, NAME_HOVER_MS)
    }
    const leave = (): void => {
      this.cancelNameTimer()
      this.flipName(false)
    }
    const menu = (e: Event): void => e.preventDefault() // long-press hold

    el.addEventListener('pointerdown', down)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('pointerenter', enter)
    el.addEventListener('pointerleave', leave)
    el.addEventListener('contextmenu', menu)
    this.cleanups.push(() => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('pointerenter', enter)
      el.removeEventListener('pointerleave', leave)
      el.removeEventListener('contextmenu', menu)
    })
  }

  private cancelNameTimer(): void {
    if (this.nameHoverId) {
      this.cancelLater(this.nameHoverId)
      this.nameHoverId = 0
    }
  }

  private flipName(toKana: boolean): void {
    const el = this.nameEl
    if (!el || !this.nameOriginal) return
    const target = toKana ? KANA_NAME : this.nameOriginal
    this.jobs = this.jobs.filter((j) => j.el !== el) // drop in-flight morph
    if (this.reduced) {
      el.textContent = target
      el.dataset.text = target
      return
    }
    const from = el.textContent ?? ''
    if (from === target) return
    this.jobs.push({
      mode: 'morph',
      el,
      from,
      to: target,
      start: this.elapsedNow,
      dur: 0.4 + Math.max(from.length, target.length) * 0.045,
    })
  }

  // --- Konami spectacle ------------------------------------------------------------

  private onKonami = (): void => {
    this.grantAccess()
  }

  /** Degauss wobble + amber ROOT phase + ACCESS GRANTED stamp (~3 s). */
  private grantAccess(): void {
    const now = performance.now()
    if (now < this.spectacleUntil) return // core event + local tracker overlap
    this.spectacleUntil = now + TOAST_MS

    this.toast('ACCESS GRANTED', 'root shell unlocked · welcome, operator')
    sfxTerminalKonami()
    if (this.modeEl) {
      this.modeEl.textContent = 'ROOT'
      this.lastMode = 'ROOT'
      this.rootModeUntil = now + TOAST_MS
    }

    const app = this.app
    if (!app) return
    app.classList.add('trm-rootmode')
    if (!this.reduced) {
      app.classList.add('trm-degauss')
      this.scene?.degauss()
    }
    this.later(() => {
      app.classList.remove('trm-rootmode', 'trm-degauss')
    }, TOAST_MS)
  }
}

const createTerminalTheme: ThemeFactory = () => new TerminalTheme()

export default createTerminalTheme
