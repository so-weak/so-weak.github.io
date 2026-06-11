/**
 * AURORA GLASS — soft, luminous, contemplative.
 *
 * Dawn-sky gradients (domain-warped fbm, four pastels over near-white)
 * breathe behind frosted-glass panels while transmissive orbs drift on
 * noise paths through a slowly breathing depth of field. The signature is
 * the tarot motif: hobbies dealt as full arcana cards with 3D tilt, section
 * heads as ornamented dividers, awards as readings, the writing queue as a
 * face-up published card beside two face-down drafts.
 *
 * Cursor: warps/brightens the gradient locally, sways the camera, and the
 * orbs shy away. Hovering a project card lifts it, shimmers the field and
 * nudges the orbs outward.
 *
 * Easter eggs: hold (or long-hover) the hero name and it flips letter by
 * letter to ソウビク・ゴーシュ; the face-down writing cards perform a real
 * tarot draw from a six-card deck; the footer moons advance phase on click
 * and a full moon fires a shooting star through the GL sky plus an
 * おつかれさま whisper-toast. The Higgsfield media manifest, when ok, blends
 * a generated dawn-sky clip beneath the gradient as a luminous underlay.
 */

import '@fontsource/cormorant-garamond/400.css'
import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource/cormorant-garamond/400-italic.css'
import '@fontsource/cormorant-garamond/500-italic.css'
import '@fontsource/cormorant-garamond/600-italic.css'
import '@fontsource-variable/outfit'
import './styles.css'

import { clamp, damp } from '../../utils/math'
import type { Theme, ThemeContext, ThemeFactory, ThemeId } from '../types'
import {
  buildAuroraDom,
  isFullMoonOffset,
  MOON_COUNT,
  renderMoonRow,
  type AuroraDom,
} from './dom'
import { loadAuroraSkyMedia } from './media'
import { AuroraScene, type AuroraState } from './scene'
import {
  sfxAuroraClick,
  sfxAuroraHover,
  sfxAuroraReveal,
  sfxAuroraFullMoon,
} from '../../utils/sound'

const UNMOUNT_MS = 380
const NAV_OFFSET = -96
const TILT_MAX_DEG = 8

/** Hover dwell before the hero name flips to katakana (ms). */
const KANA_HOVER_MS = 1200
/** Shooting-star flight time (s) and sky-underlay blend opacity. */
const STAR_DURATION_S = 1.3
const SKY_MIX = 0.16
const TOAST_MS = 2400

interface ArcanaCard {
  numeral: string
  name: string
  reading: string
}

/** The tarot-draw deck — one-line readings tied to his skills and hobbies. */
const DECK: readonly ArcanaCard[] = [
  {
    numeral: 'I',
    name: 'The Engineer',
    reading:
      'You will ship to 800 users before Friday, and the pager will stay silent.',
  },
  {
    numeral: 'II',
    name: 'The Debugger',
    reading:
      'The fault you seek lies upstream. Isolate the bar, slow it down, replay until it sings.',
  },
  {
    numeral: 'III',
    name: 'The Seeker',
    reading:
      'A new model card turns tonight. Read it with an evaluation harness in hand.',
  },
  {
    numeral: 'IV',
    name: 'The Polyglot',
    reading:
      'Words arrive in a new tongue. N3 is closer than the JLPT schedule admits.',
  },
  {
    numeral: 'V',
    name: 'The Architect',
    reading:
      'Draw the boundary first; the microservices will arrange themselves by dawn.',
  },
  {
    numeral: 'VI',
    name: 'The Wanderer',
    reading:
      'Step away from the terminal. The ukulele already knows the next chord.',
  },
]

class AuroraTheme implements Theme {
  readonly id: ThemeId = 'aurora'
  readonly name = 'Aurora'

  private ctx!: ThemeContext
  private dom: AuroraDom | null = null
  private scene: AuroraScene | null = null

  private cleanups: Array<() => void> = []
  private io: IntersectionObserver | null = null
  private unmountTimer: number | null = null
  private disposed = false

  // --- choreography state (mutated in place — no per-frame allocations) ----
  private readonly state: AuroraState = {
    time: 31,
    cursorX: 0,
    cursorY: 0,
    cursorStrength: 0,
    excite: 0,
    impulse: 0,
    scroll: 0,
    focus: 10,
    parallaxX: 0,
    parallaxY: 0,
    starT: 0,
    starSeed: 0,
    videoMix: 0,
  }

  private glTime = 31
  private exciteTarget = 0
  private staticMode = false
  private staticDirty = true

  private anchors: number[] = []
  private activeNav = -1
  private scrolledHint = false

  // --- easter eggs + generated media ------------------------------------------
  private hoverTimer: number | null = null
  private toastTimer: number | null = null
  private moonOffset = 0
  private starPlaying = false
  private skyVideo: HTMLVideoElement | null = null
  private videoMixTarget = 0

  // --- tarot-card tilt --------------------------------------------------------
  private tiltEl: HTMLElement | null = null
  private tiltStyledEl: HTMLElement | null = null
  private tiltRect: DOMRect | null = null
  private tiltRX = 0
  private tiltRY = 0

  async init(ctx: ThemeContext): Promise<void> {
    this.ctx = ctx
    this.staticMode = ctx.reducedMotion

    // Dreamier, slightly heavier scroll for the glass feel.
    ctx.scroll.configure({ lerp: 0.08 })

    // --- DOM -----------------------------------------------------------------
    this.dom = buildAuroraDom(ctx.content)
    ctx.root.appendChild(this.dom.wrapper)

    this.cleanups.push(ctx.cursor.bind(ctx.root))
    this.bindEvents()
    this.bindNameEgg()
    this.bindTarotDraw()
    this.bindMoons()

    // --- GL --------------------------------------------------------------------
    this.scene = new AuroraScene(ctx.renderer, {
      isMobile: ctx.viewport.isMobile,
      withDof: !ctx.viewport.isMobile && !ctx.reducedMotion,
    })
    await this.scene.compile()

    // Generated dawn-sky underlay — non-blocking; skips when manifest says no.
    this.loadSkyMedia()

    // Live reduced-motion switching.
    this.cleanups.push(
      ctx.viewport.onReducedMotionChange((rm) => {
        this.staticMode = rm
        this.staticDirty = true
        if (rm) {
          this.revealEverything()
          this.clearTilt()
          this.starPlaying = false
          this.state.starT = 0
        }
        this.syncSkyVideo()
      }),
    )

    // Cormorant shifts layout once it lands — re-measure.
    void document.fonts.ready.then(() => {
      if (this.disposed) return
      this.computeAnchors()
      this.ctx.scroll.resize()
      this.staticDirty = true
    })
  }

  mount(): void {
    if (!this.dom) return
    this.dom.wrapper.classList.add('is-mounted')
    this.computeAnchors()

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
    if (this.hoverTimer !== null) {
      clearTimeout(this.hoverTimer)
      this.hoverTimer = null
    }
    if (this.toastTimer !== null) {
      clearTimeout(this.toastTimer)
      this.toastTimer = null
    }
    if (this.skyVideo) {
      this.skyVideo.pause()
      this.skyVideo.removeAttribute('src')
      this.skyVideo.load()
      this.skyVideo = null
    }
    this.io?.disconnect()
    this.io = null
    for (const cleanup of this.cleanups) cleanup()
    this.cleanups = []
    this.scene?.dispose()
    this.scene = null
    this.anchors = []
    this.tiltEl = null
    this.tiltStyledEl = null
    this.tiltRect = null
    this.dom = null
  }

  resize(width: number, height: number, dpr: number): void {
    this.scene?.resize(width, height, dpr)
    this.computeAnchors()
    this.staticDirty = true
  }

  update(dt: number, elapsed: number): void {
    if (!this.scene || !this.dom) return
    const { scroll, cursor, viewport } = this.ctx
    const s = this.state

    this.updateNav(scroll.scroll)
    this.updateScrollHint(scroll.scroll)

    if (this.staticMode) {
      // Reduced motion: one composed static frame — gradients frozen at a
      // gentle moment, orbs resting, no drift, no DoF breathing.
      if (this.staticDirty) {
        s.time = 47
        s.cursorX = 0
        s.cursorY = 0
        s.cursorStrength = 0
        s.excite = 0
        s.impulse = 0
        s.scroll = 0.25
        s.focus = 10
        s.parallaxX = 0
        s.parallaxY = 0
        s.starT = 0
        s.videoMix = 0 // poster-quiet: no moving sky in the static frame
        this.scene.apply(s, 1)
        this.scene.render(1 / 60)
        this.staticDirty = false
      }
      return
    }

    // --- cursor: local warp + camera sway + orb avoidance ----------------------
    const present = viewport.isTouch ? 0 : 1
    s.cursorStrength = damp(s.cursorStrength, present, 2.0, dt)
    s.cursorX = cursor.ndc.x
    s.cursorY = cursor.ndc.y
    s.parallaxX = damp(s.parallaxX, cursor.ndc.x * present, 2.2, dt)
    s.parallaxY = damp(s.parallaxY, cursor.ndc.y * present, 2.2, dt)

    // --- shimmer + orb nudge decay ----------------------------------------------
    s.excite = damp(s.excite, this.exciteTarget, 4.0, dt)
    s.impulse = damp(s.impulse, 0, 2.5, dt)

    // --- slow drift + breathing focus -------------------------------------------
    this.glTime += dt
    s.time = this.glTime
    s.focus = 10 + Math.sin(elapsed * 0.13) * 3.4

    const progress = scroll.progress
    s.scroll = Number.isFinite(progress) ? progress : 0

    // --- shooting star + generated-sky blend --------------------------------------
    if (this.starPlaying) {
      s.starT += dt / STAR_DURATION_S
      if (s.starT >= 1) {
        s.starT = 0
        this.starPlaying = false
      }
    }
    s.videoMix = damp(s.videoMix, this.videoMixTarget, 1.6, dt)

    // CSS cursor vars — hero name and fan card drift with cursor.
    if (this.dom) {
      this.dom.wrapper.style.setProperty('--cx', s.parallaxX.toFixed(3))
      this.dom.wrapper.style.setProperty('--cy', s.parallaxY.toFixed(3))
    }

    this.updateTilt(dt)

    this.scene.apply(s, dt)
    this.scene.render(dt)
  }

  // --- interaction -------------------------------------------------------------

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
      const dest = root.querySelector<HTMLElement>(href)
      if (dest) {
        sfxAuroraClick()
        this.ctx.scroll.scrollTo(dest, {
          duration: 1.5,
          offset: href === '#hero' ? 0 : NAV_OFFSET,
        })
      }
    }

    const onPointerOver = (e: Event): void => {
      const target = e.target
      if (!(target instanceof Element)) return

      const excite = target.closest('[data-excite]')
      if (excite) {
        if (this.exciteTarget === 0) {
          this.state.impulse = 1
          sfxAuroraHover()
        }
        this.exciteTarget = 1
      }

      if (!this.ctx.viewport.isTouch && !this.staticMode) {
        const tilt = target.closest<HTMLElement>('[data-tilt]')
        if (tilt && tilt !== this.tiltEl) {
          // A fast hop between cards can re-target before the damped tilt
          // settles: clear the abandoned card (else it freezes mid-pose) and
          // start the new one from rest instead of the old residual angles.
          if (this.tiltStyledEl && this.tiltStyledEl !== tilt) {
            this.tiltStyledEl.style.transform = ''
            this.tiltRX = 0
            this.tiltRY = 0
          }
          this.tiltEl = tilt
          this.tiltStyledEl = tilt
          this.tiltRect = tilt.getBoundingClientRect()
        }
      }
    }

    const onPointerOut = (e: Event): void => {
      const target = e.target
      if (!(target instanceof Element)) return
      const related = (e as PointerEvent).relatedTarget

      const excite = target.closest('[data-excite]')
      if (
        excite &&
        !(related instanceof Node && excite.contains(related))
      ) {
        this.exciteTarget = 0
      }

      const tilt = target.closest<HTMLElement>('[data-tilt]')
      if (
        tilt &&
        tilt === this.tiltEl &&
        !(related instanceof Node && tilt.contains(related))
      ) {
        this.tiltEl = null
        this.tiltRect = null
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

  // --- easter eggs ---------------------------------------------------------------

  /**
   * Hero-name katakana flip — hold the pointer down (or hover for 1.2s) and
   * the letters flip one by one to ソウビク・ゴーシュ, flipping back on
   * release/leave. The stagger lives in CSS (per-letter --kd delays);
   * reduced motion swaps instantly via the theme's reduced-motion rules.
   */
  private bindNameEgg(): void {
    if (!this.dom) return
    const name = this.dom.nameEgg

    const flip = (on: boolean): void => {
      name.classList.toggle('is-kana', on)
    }
    const clearHover = (): void => {
      if (this.hoverTimer !== null) {
        clearTimeout(this.hoverTimer)
        this.hoverTimer = null
      }
    }
    const onDown = (e: Event): void => {
      e.preventDefault() // keep press-and-hold from starting a text selection
      clearHover()
      flip(true)
    }
    const onRelease = (): void => {
      clearHover()
      flip(false)
    }
    const onEnter = (): void => {
      clearHover()
      this.hoverTimer = window.setTimeout(() => {
        this.hoverTimer = null
        flip(true)
      }, KANA_HOVER_MS)
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

  /**
   * Tarot draw — the two coming-soon writing cards are face-down. A click
   * (or Enter/Space; they are real buttons) flips one over to reveal a
   * random arcana; clicking again returns it to the deck. Results are
   * announced through the polite live region.
   */
  private bindTarotDraw(): void {
    if (!this.dom) return
    for (const btn of this.dom.drawButtons) {
      const nameEl = btn.querySelector<HTMLElement>('.au-draw__name')
      const readingEl = btn.querySelector<HTMLElement>('.au-draw__reading')
      const numeralEl = btn.querySelector<HTMLElement>('.au-draw__numeral')
      const restLabel = btn.getAttribute('aria-label') ?? 'Draw a tarot card'

      const onClick = (): void => {
        if (btn.classList.contains('is-flipped')) {
          btn.classList.remove('is-flipped')
          btn.setAttribute('aria-label', restLabel)
          this.announce('The card slips back into the deck and reshuffles.')
          return
        }
        const prev = Number(btn.dataset.lastDraw ?? '-1')
        let idx = Math.floor(Math.random() * DECK.length)
        if (DECK.length > 1 && idx === prev) {
          idx = (idx + 1 + Math.floor(Math.random() * (DECK.length - 1))) % DECK.length
        }
        const card = DECK[idx]
        if (!card) return
        btn.dataset.lastDraw = String(idx)
        if (numeralEl) numeralEl.textContent = card.numeral
        if (nameEl) nameEl.textContent = card.name
        if (readingEl) readingEl.textContent = card.reading
        btn.classList.add('is-flipped')
        sfxAuroraReveal()
        btn.setAttribute(
          'aria-label',
          `${card.name}. ${card.reading} Activate to return the card to the deck.`,
        )
        this.announce(`You drew ${card.name}. ${card.reading}`)
      }

      btn.addEventListener('click', onClick)
      this.cleanups.push(() => btn.removeEventListener('click', onClick))
    }
  }

  /**
   * Footer moons — each click advances the phase glyphs one step; when the
   * centre moon turns full, a shooting star streaks across the gradient
   * (skipped under reduced motion) and a whisper-toast says おつかれさま.
   */
  private bindMoons(): void {
    if (!this.dom) return
    const { moonsButton, moonsRow } = this.dom

    const onClick = (): void => {
      this.moonOffset = (this.moonOffset + 1) % MOON_COUNT
      moonsRow.innerHTML = renderMoonRow(this.moonOffset)
      if (!isFullMoonOffset(this.moonOffset)) return
      if (!this.staticMode) {
        this.state.starSeed = Math.random()
        this.state.starT = 1e-4
        this.starPlaying = true
      }
      sfxAuroraFullMoon()
      this.showToast()
      this.announce('Full moon. おつかれさま, good work tonight.')
    }

    moonsButton.addEventListener('click', onClick)
    this.cleanups.push(() => moonsButton.removeEventListener('click', onClick))
  }

  private showToast(): void {
    const toast = this.dom?.toast
    if (!toast) return
    toast.classList.add('is-shown')
    if (this.toastTimer !== null) clearTimeout(this.toastTimer)
    this.toastTimer = window.setTimeout(() => {
      this.toastTimer = null
      toast.classList.remove('is-shown')
    }, TOAST_MS)
  }

  private announce(message: string): void {
    const live = this.dom?.live
    if (live) live.textContent = message
  }

  // --- generated media -------------------------------------------------------------

  /**
   * Higgsfield dawn-sky clip: when the media manifest reports ok, the clip
   * becomes a luminous underlay beneath the gradient mesh (screen-blended in
   * the shader, grain dithering on top). Mobile and reduced motion never see
   * the moving layer — the GLSL sky alone is the poster. Skips silently when
   * the manifest says ok:false or is missing.
   */
  private loadSkyMedia(): void {
    if (this.ctx.viewport.isMobile) return
    void loadAuroraSkyMedia().then((media) => {
      if (!media || this.disposed || !this.scene) return
      const video = document.createElement('video')
      video.muted = true
      video.loop = true
      video.playsInline = true
      video.setAttribute('playsinline', '')
      // Reduced motion never plays the clip — don't fetch it eagerly either;
      // play() after a live preference change triggers the load then.
      video.preload = this.staticMode ? 'none' : 'auto'
      if (media.poster) video.poster = media.poster
      video.src = media.video
      this.skyVideo = video
      this.scene.setSkyVideo(video)
      this.syncSkyVideo()
    })
  }

  /** Reduced motion pauses the clip and fades the underlay out entirely. */
  private syncSkyVideo(): void {
    if (!this.skyVideo) return
    if (this.staticMode) {
      this.skyVideo.pause()
      this.videoMixTarget = 0
      this.state.videoMix = 0
      this.staticDirty = true
    } else {
      void this.skyVideo.play().catch(() => {
        /* autoplay veto: the shader sky stands alone */
      })
      this.videoMixTarget = SKY_MIX
    }
  }

  /** Damped 3D tilt of the hovered tarot card toward the cursor. */
  private updateTilt(dt: number): void {
    const styled = this.tiltStyledEl
    if (!styled) return

    let targetRX = 0
    let targetRY = 0
    if (this.tiltEl && this.tiltRect) {
      const r = this.tiltRect
      const nx = clamp(
        (this.ctx.cursor.pos.x - (r.left + r.width / 2)) / (r.width / 2),
        -1,
        1,
      )
      const ny = clamp(
        (this.ctx.cursor.pos.y - (r.top + r.height / 2)) / (r.height / 2),
        -1,
        1,
      )
      targetRY = nx * TILT_MAX_DEG
      targetRX = -ny * TILT_MAX_DEG
    }

    this.tiltRX = damp(this.tiltRX, targetRX, 9, dt)
    this.tiltRY = damp(this.tiltRY, targetRY, 9, dt)

    if (
      !this.tiltEl &&
      Math.abs(this.tiltRX) < 0.02 &&
      Math.abs(this.tiltRY) < 0.02
    ) {
      styled.style.transform = ''
      this.tiltStyledEl = null
      this.tiltRX = 0
      this.tiltRY = 0
      return
    }

    styled.style.transform = `perspective(900px) rotateX(${this.tiltRX.toFixed(2)}deg) rotateY(${this.tiltRY.toFixed(2)}deg)`
  }

  private clearTilt(): void {
    if (this.tiltStyledEl) this.tiltStyledEl.style.transform = ''
    this.tiltEl = null
    this.tiltStyledEl = null
    this.tiltRect = null
    this.tiltRX = 0
    this.tiltRY = 0
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
      { threshold: 0.1, rootMargin: '0px 0px -8% 0px' },
    )
    const targets = this.dom.wrapper.querySelectorAll('.au-reveal')
    targets.forEach((el) => this.io?.observe(el))
  }

  private revealEverything(): void {
    this.dom?.wrapper
      .querySelectorAll('.au-reveal')
      .forEach((el) => el.classList.add('is-in'))
  }

  // --- scroll choreography --------------------------------------------------------

  private computeAnchors(): void {
    if (!this.dom) return
    const sc = this.ctx.scroll.scroll
    this.anchors = this.dom.sections.map(
      (el) => el.getBoundingClientRect().top + sc,
    )
  }

  private updateNav(scrollY: number): void {
    if (!this.dom || this.anchors.length === 0) return
    const probe = scrollY + this.ctx.viewport.height * 0.38
    let idx = 0
    for (let i = 0; i < this.anchors.length; i++) {
      const top = this.anchors[i]
      if (top !== undefined && probe >= top) idx = i
    }
    if (idx === this.activeNav) return

    const prev = this.dom.navLinks[this.activeNav - 1]
    if (prev) {
      prev.classList.remove('is-active')
      prev.removeAttribute('aria-current')
    }
    const next = this.dom.navLinks[idx - 1]
    if (next) {
      next.classList.add('is-active')
      next.setAttribute('aria-current', 'true')
    }
    this.activeNav = idx
  }

  private updateScrollHint(scrollY: number): void {
    if (!this.dom) return
    const scrolled = scrollY > 60
    if (scrolled !== this.scrolledHint) {
      this.scrolledHint = scrolled
      this.dom.wrapper.classList.toggle('is-scrolled', scrolled)
    }
  }
}

const createAuroraTheme: ThemeFactory = () => new AuroraTheme()

export default createAuroraTheme
