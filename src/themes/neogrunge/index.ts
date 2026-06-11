/**
 * NEOGRUNGE — comic-book panels on aged newsprint, grungy and loud.
 *
 * WebGL: animated halftone dot field — dots breathe with curl-noise, cursor
 * presses a dent, scroll churn sends tints rolling across the grid.
 *
 * Easter eggs:
 *   • Hero-name katakana flip: hold pointer (or hover 1.2s) → ソウビク・ゴーシュ
 *   • Konami code → BLAMMO! ink-splat overlay + splat bloom in GL field
 *   • Type "soweak" (global) → glitch flash (handled by EasterEggs.ts)
 */

import '@fontsource/bangers'
import '@fontsource/permanent-marker'
import './styles.css'

import { KONAMI_EVENT } from '../../app/EasterEggs'
import { damp } from '../../utils/math'
import type { Theme, ThemeContext, ThemeFactory, ThemeId } from '../types'
import { buildNeogrungeDom, type NeogrungeDom } from './dom'
import { sfxNeogrugeClick, sfxNeogrugeKonami } from '../../utils/sound'
import { NeogrugeScene, type NeogrugeSceneState } from './scene'

interface ParallaxItem {
  el: HTMLElement
  speed: number
  center: number
  lastY: number
}

const UNMOUNT_MS = 320
const KANA_HOVER_MS = 1200
const KANA_FIRST = 'ソウビク'
const KANA_LAST = 'ゴーシュ'
const TOAST_MS = 2600
const SPLAT_IN_MS = 800
const SPLAT_HOLD_MS = 1800
const SPLAT_OUT_MS = 600

class NeogrugeTheme implements Theme {
  readonly id: ThemeId = 'neogrunge'
  readonly name = 'Neogrunge'

  private ctx!: ThemeContext
  private dom: NeogrungeDom | null = null
  private scene: NeogrugeScene | null = null

  private cleanups: Array<() => void> = []
  private io: IntersectionObserver | null = null
  private disposed = false

  // --- timers ---------------------------------------------------------------
  private unmountTimer: number | null = null
  private hoverTimer: number | null = null
  private toastTimer: number | null = null
  private splatTimer: number | null = null

  // --- frame state ----------------------------------------------------------
  private readonly state: NeogrugeSceneState = {
    mouseX: 0.5,
    mouseY: 0.5,
    velocity: 0,
    splat: 0,
  }
  private parallax: ParallaxItem[] = []
  private nameKana = false
  private unsubscribeTicker: (() => void) | null = null
  private staticMode = false

  // --- init / mount ---------------------------------------------------------

  async init(ctx: ThemeContext): Promise<void> {
    this.ctx = ctx
    this.staticMode = ctx.reducedMotion
    this.dom = buildNeogrungeDom(ctx.content)
    ctx.root.appendChild(this.dom.wrapper)

    this.scene = new NeogrugeScene()
    this.scene.resize(ctx.viewport.width, ctx.viewport.height)

    this.cleanups.push(ctx.cursor.bind(ctx.root))
    this.bindEvents()
    this.observeReveals()
    this.collectParallax()
  }

  mount(): void {
    this.dom?.wrapper.classList.add('is-mounted')
    this.unsubscribeTicker = this.ctx.ticker.add(this.onTick)
  }

  async unmount(): Promise<void> {
    this.dom?.wrapper.classList.remove('is-mounted')
    this.dom?.wrapper.classList.add('is-unmounting')
    return new Promise((resolve) => {
      this.unmountTimer = window.setTimeout(resolve, UNMOUNT_MS)
    })
  }

  dispose(): void {
    this.disposed = true
    this.unsubscribeTicker?.()
    this.unsubscribeTicker = null
    for (const fn of this.cleanups) fn()
    this.cleanups = []
    for (const id of [this.unmountTimer, this.hoverTimer, this.toastTimer, this.splatTimer]) {
      if (id !== null) clearTimeout(id)
    }
    this.io?.disconnect()
    this.scene?.dispose()
    this.dom = null
    this.scene = null
  }

  resize(w: number, h: number): void {
    this.scene?.resize(w, h)
  }

  update(dt: number, elapsed: number): void {
    if (!this.scene || this.disposed) return

    // Mouse tracking — cursor.pos is raw pixels.
    const { cursor, viewport } = this.ctx
    const tx = cursor.pos.x / viewport.width
    const ty = 1 - cursor.pos.y / viewport.height
    this.state.mouseX = damp(this.state.mouseX, tx, 6, dt)
    this.state.mouseY = damp(this.state.mouseY, ty, 6, dt)

    // Scroll churn.
    const velNorm = Math.min(Math.abs(this.ctx.scroll.velocity) / 40, 1)
    this.state.velocity = damp(this.state.velocity, velNorm, 4, dt)

    // CSS cursor vars — drive DOM parallax and comic-panel drift.
    if (this.dom && !viewport.isTouch) {
      const cx = ((this.state.mouseX * 2 - 1)).toFixed(3)
      const cy = ((this.state.mouseY * 2 - 1)).toFixed(3)
      this.dom.wrapper.style.setProperty('--cx', cx)
      this.dom.wrapper.style.setProperty('--cy', cy)
    }

    // Scroll-driven DOM parallax (desktop only).
    if (!viewport.isMobile && !this.staticMode) {
      this.applyParallax(this.ctx.scroll.scroll)
    }

    this.scene.update(
      this.ctx.renderer,
      this.state,
      elapsed,
      viewport.width,
      viewport.height,
    )
  }

  // --- event binding --------------------------------------------------------

  private bindEvents(): void {
    const root = this.ctx.root
    const onClick = (e: Event): void => {
      const target = e.target
      if (!(target instanceof Element)) return
      const nav = target.closest<HTMLAnchorElement>('[data-nav]')
      if (!nav) return
      const href = nav.getAttribute('href')
      if (!href || !href.startsWith('#')) return
      e.preventDefault()
      sfxNeogrugeClick()
      const dest = root.querySelector<HTMLElement>(href)
      if (dest) this.ctx.scroll.scrollTo(dest, { duration: 1.4 })
    }
    root.addEventListener('click', onClick)
    this.cleanups.push(() => root.removeEventListener('click', onClick))
    this.bindNameEgg()
    this.bindKonami()
    this.bindScroll()
  }

  private bindNameEgg(): void {
    if (!this.dom) return
    const name = this.dom.nameEgg

    const flip = (on: boolean): void => {
      if (this.nameKana === on) return
      this.nameKana = on
      const first = name.querySelector<HTMLElement>('.ng-hero__first')
      const last = name.querySelector<HTMLElement>('.ng-hero__last')
      if (first) first.textContent = on ? KANA_FIRST : (name.dataset['first'] ?? '')
      if (last) last.textContent = on ? KANA_LAST : (name.dataset['last'] ?? '')
      name.classList.toggle('is-kana', on)
    }

    const clearHover = (): void => {
      if (this.hoverTimer !== null) { clearTimeout(this.hoverTimer); this.hoverTimer = null }
    }

    const onDown = (e: PointerEvent): void => {
      if (e.pointerType === 'mouse') e.preventDefault()
      clearHover(); flip(true)
    }
    const onRelease = (): void => { clearHover(); flip(false) }
    const onEnter = (): void => {
      clearHover()
      if (this.staticMode) return
      this.hoverTimer = window.setTimeout(() => { this.hoverTimer = null; flip(true) }, KANA_HOVER_MS)
    }

    name.addEventListener('pointerdown', onDown)
    name.addEventListener('pointerup', onRelease)
    name.addEventListener('pointercancel', onRelease)
    name.addEventListener('pointerenter', onEnter)
    name.addEventListener('pointerleave', onRelease)
    this.cleanups.push(() => {
      clearHover()
      name.removeEventListener('pointerdown', onDown)
      name.removeEventListener('pointerup', onRelease)
      name.removeEventListener('pointercancel', onRelease)
      name.removeEventListener('pointerenter', onEnter)
      name.removeEventListener('pointerleave', onRelease)
    })
  }

  private bindKonami(): void {
    const onKonami = (): void => {
      if (!this.dom) return

      // Show the BLAMMO! SVG splat overlay.
      const { splat } = this.dom
      splat.hidden = false
      splat.classList.remove('is-out')
      splat.classList.add('is-in')
      sfxNeogrugeKonami()

      // Animate the GL splat factor: ease in → hold → ease out.
      if (this.splatTimer !== null) clearTimeout(this.splatTimer)
      this.state.splat = 1
      this.splatTimer = window.setTimeout(() => {
        splat.classList.remove('is-in')
        splat.classList.add('is-out')
        this.state.splat = 0
        this.splatTimer = window.setTimeout(() => {
          splat.hidden = true
          splat.classList.remove('is-out')
          this.splatTimer = null
        }, SPLAT_OUT_MS)
      }, SPLAT_IN_MS + SPLAT_HOLD_MS)

      this.showToast('BLAMMO! // コナミ ENGAGED')
    }

    window.addEventListener(KONAMI_EVENT, onKonami)
    this.cleanups.push(() => window.removeEventListener(KONAMI_EVENT, onKonami))
  }

  private bindScroll(): void {
    if (!this.dom) return
    const unsubscribe = this.ctx.scroll.on(() => {
      if (!this.dom) return
      const y = this.ctx.scroll.scroll
      const h = this.ctx.viewport.height
      this.dom.wrapper.classList.toggle('is-scrolled', y > h * 0.15)
    })
    this.cleanups.push(unsubscribe)
  }

  // --- scroll reveal --------------------------------------------------------

  private observeReveals(): void {
    if (!this.dom) return

    if (this.staticMode) {
      for (const el of this.dom.panels) el.classList.add('is-in')
      for (const el of this.dom.wrapper.querySelectorAll('.ng-panel-reveal')) {
        el.classList.add('is-in')
      }
      return
    }

    this.io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in')
            this.io?.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.12 },
    )

    for (const el of this.dom.panels) this.io.observe(el)

    // Per-element reveals inside panels.
    const reveals = this.dom.wrapper.querySelectorAll('.ng-panel-reveal')
    const revealIo = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in')
            revealIo.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.08 },
    )
    for (const el of reveals) revealIo.observe(el)
    this.cleanups.push(() => revealIo.disconnect())
  }

  // --- scroll parallax -----------------------------------------------------

  private collectParallax(): void {
    if (!this.dom) return
    const sc = this.ctx.scroll.scroll
    this.parallax = Array.from(
      this.dom.wrapper.querySelectorAll<HTMLElement>('[data-speed]'),
    ).map((el) => {
      const rect = el.getBoundingClientRect()
      return {
        el,
        speed: Number(el.dataset.speed) || 1,
        center: rect.top + sc + rect.height / 2,
        lastY: 0,
      }
    })
  }

  private applyParallax(scrollY: number): void {
    const vh = this.ctx.viewport.height
    const mid = scrollY + vh * 0.5
    for (const item of this.parallax) {
      const rel = mid - item.center
      if (Math.abs(rel) > vh * 1.5) continue
      const y = rel * (1 - item.speed)
      if (Math.abs(y - item.lastY) < 0.3) continue
      item.lastY = y
      item.el.style.setProperty('translate', `0px ${y.toFixed(1)}px`)
    }
  }

  // --- toast ----------------------------------------------------------------

  private showToast(text: string): void {
    const el = this.dom?.toast
    if (!el) return
    el.textContent = text
    el.classList.add('is-on')
    if (this.toastTimer !== null) clearTimeout(this.toastTimer)
    this.toastTimer = window.setTimeout(() => {
      this.toastTimer = null
      el.classList.remove('is-on')
    }, TOAST_MS)
  }

  // --- ticker ---------------------------------------------------------------

  private onTick = (dt: number, elapsed: number): void => {
    if (!this.disposed) this.update(dt, elapsed)
  }
}

const factory: ThemeFactory = () => new NeogrugeTheme()
export default factory
