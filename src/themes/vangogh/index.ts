/**
 * VAN GOGH — the retrospective the painter never got.
 *
 * A living Starry Night: thousands of instanced impasto brush strokes
 * advected by a curl-noise flow field, tightening into vortices around
 * star knots, stirred by the cursor like a brush through wet oil. Scroll
 * walks the palette through chapters — night sky → wheat-field ochres →
 * café-terrace yellows → the calmest night — while the DOM hangs the work
 * as a museum: gallery masthead with ROOM links and a wax-seal résumé,
 * gilt salon frames with brass plaques, a wooden palette of paint daubs,
 * a medals cabinet, unfinished canvases turned to the wall, and a
 * guestbook signed in a handwritten Caveat line.
 *
 * Easter eggs: hold (or long-hover) the hero name and it flips letter by
 * letter to ソウビク・ゴーシュ; the Konami code spins the whole field into
 * a 3-second STARRY VORTEX; clicking the brightest star three times sends
 * it supernova into a brief sunflower bloom ("la nuit étoilée — for Theo").
 * The Higgsfield media manifest, when ok, blends a generated swirling-paint
 * clip beneath the GL strokes.
 */

// Fraunces "full" variants carry the SOFT/WONK/opsz axes — the painterly
// display setting the headings are designed around (the wght-only build
// would silently ignore those font-variation-settings).
import '@fontsource-variable/fraunces/full.css'
import '@fontsource-variable/fraunces/full-italic.css'
import '@fontsource-variable/hanken-grotesk'
import '@fontsource/caveat/400.css'
import '@fontsource/caveat/600.css'
import './styles.css'

import { TextureLoader } from 'three'
import { KONAMI_EVENT } from '../../app/EasterEggs'
import { clamp, damp, lerp } from '../../utils/math'
import type { Theme, ThemeContext, ThemeFactory, ThemeId } from '../types'
import { buildVanGoghDom, type VanGoghDom } from './dom'
import { loadVanGoghPaintMedia } from './media'
import { VanGoghScene, type VanGoghState } from './scene'
import { sfxVanGoghClick, sfxVanGoghKonami, sfxVanGoghNova } from '../../utils/sound'

const UNMOUNT_MS = 380
const NAV_OFFSET = -84

/** Hover dwell before the hero name flips to katakana (ms). */
const KANA_HOVER_MS = 1200
/** Konami STARRY VORTEX duration (s) and supernova bloom duration (s). */
const VORTEX_S = 3
const NOVA_S = 2.2
/** Click window for the triple-click star egg (ms) and its hit radius (px). */
const STAR_CLICK_MS = 1900
const STAR_HIT_PX = 64
const TOAST_MS = 2800
/**
 * Underpainting prominence — the generated clip is a STRUCTURAL layer of the
 * sky (the glaze interleaves over it in-shader), not a faint garnish.
 */
const PAINT_MIX = 0.62

/**
 * The ONE damped scroll-velocity signal ("churn") that the whole painting
 * breathes with: it rates the GL clock (resting paint moves at half speed —
 * slow oil, not wind), the stroke advection, the warp drive, AND the clip's
 * playbackRate. Velocity is normalized against CHURN_VEL px/frame.
 */
const CHURN_VEL = 30         // px/frame at which velocity is "full churn"
const TIME_RATE_REST = 0.5   // GL clock rate while scroll is idle
const TIME_RATE_CHURN = 1.15 // GL clock rate at full churn
/** Clip playbackRate = REST + churn * SPAN → ≈0.55 at rest, ≈1.7 scrolling. */
const RATE_REST = 0.55
const RATE_SPAN = 1.15       // Multiplied by churn (0..1) and added to RATE_REST

/** Time frozen into the reduced-motion static frame — strokes mid-swirl. */
const STATIC_TIME = 26
/** Seconds before/after the loop boundary over which videoMix crossfades to 0. */
const LOOP_FADE_S = 0.9

interface ParallaxItem {
  el: HTMLElement
  speed: number
  center: number
  last: number
}

class VanGoghTheme implements Theme {
  readonly id: ThemeId = 'vangogh'
  readonly name = 'Van Gogh'

  private ctx!: ThemeContext
  private dom: VanGoghDom | null = null
  private scene: VanGoghScene | null = null

  private cleanups: Array<() => void> = []
  private io: IntersectionObserver | null = null
  private disposed = false

  // --- timers (every one cleared in dispose) ---------------------------------
  private unmountTimer: number | null = null
  private hoverTimer: number | null = null
  private toastTimer: number | null = null
  private starClickTimer: number | null = null

  // --- choreography state (mutated in place — no per-frame allocations) ------
  private readonly state: VanGoghState = {
    time: STATIC_TIME,
    stirX: 0,
    stirY: 0,
    stirVX: 0,
    stirVY: 0,
    stirAmt: 0,
    vortex: 0,
    chapter: 0,
    novaT: 0,
    videoMix: 0,
  }

  private glTime = STATIC_TIME
  private staticMode = false
  private staticDirty = true

  private chapterTarget = 0
  private stirAmt = 0
  private vortexLeft = 0
  private novaT = 0
  /** Damped scroll-velocity churn 0..1 — the painting's shared breath. */
  private churn = 0
  /** Damped content-calm 0 (hero) → 1 (inside the rooms). */
  private calm = 0
  /** Last playbackRate written to the clip (skip sub-perceptual writes). */
  private videoRate = 1

  private anchors: number[] = []
  private chapterKeys: Array<{ pos: number; v: number }> = []
  private parallax: ParallaxItem[] = []
  private activeNav = -1
  private scrolledHint = false

  // --- easter eggs + generated media ------------------------------------------
  private starClicks = 0
  private paintVideo: HTMLVideoElement | null = null
  private videoMixTarget = 0
  private posterUrl: string | null = null
  private posterRequested = false
  /** True once any underpainting texture (clip or poster) is bound. */
  private mediaReady = false

  async init(ctx: ThemeContext): Promise<void> {
    this.ctx = ctx
    this.staticMode = ctx.reducedMotion

    // Heavier, oil-slow scroll for the gallery walk.
    ctx.scroll.configure({ lerp: 0.09 })

    // --- DOM -------------------------------------------------------------------
    this.dom = buildVanGoghDom(ctx.content)
    ctx.root.appendChild(this.dom.wrapper)

    this.cleanups.push(ctx.cursor.bind(ctx.root))
    this.bindEvents()
    this.bindNameEgg()
    this.bindStarEgg()
    this.bindKonami()

    // --- GL ---------------------------------------------------------------------
    const mobile = ctx.viewport.isMobile
    this.scene = new VanGoghScene(ctx.renderer, {
      instances: mobile ? 640 : 1600,
      strokeSize: mobile ? 0.14 : 0.10,
    })
    this.scene.apply(this.state)
    await this.scene.compile()

    // Generated swirling-paint underlay — non-blocking, manifest-gated.
    this.loadPaintMedia()

    // Live reduced-motion switching.
    this.cleanups.push(
      ctx.viewport.onReducedMotionChange((rm) => {
        this.staticMode = rm
        this.staticDirty = true
        if (rm) {
          this.revealEverything()
          this.clearParallax()
          this.vortexLeft = 0
          this.novaT = 0
        }
        this.syncPaintVideo()
      }),
    )

    // Fraunces shifts layout once it lands — re-measure the gallery.
    void document.fonts.ready.then(() => {
      if (this.disposed) return
      this.measure()
      this.ctx.scroll.resize()
      this.staticDirty = true
    })
  }

  mount(): void {
    if (!this.dom) return
    this.dom.wrapper.classList.add('is-mounted')
    this.measure()

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
    for (const id of [
      this.unmountTimer,
      this.hoverTimer,
      this.toastTimer,
      this.starClickTimer,
    ]) {
      if (id !== null) clearTimeout(id)
    }
    this.unmountTimer = null
    this.hoverTimer = null
    this.toastTimer = null
    this.starClickTimer = null

    if (this.paintVideo) {
      this.paintVideo.pause()
      this.paintVideo.removeAttribute('src')
      this.paintVideo.load()
      this.paintVideo = null
    }
    this.io?.disconnect()
    this.io = null
    for (const cleanup of this.cleanups) cleanup()
    this.cleanups = []
    this.scene?.dispose()
    this.scene = null
    this.anchors = []
    this.chapterKeys = []
    this.parallax = []
    this.dom = null
  }

  resize(width: number, height: number, dpr: number): void {
    this.scene?.resize(width, height, dpr)
    this.measure()
    this.staticDirty = true
  }

  update(dt: number, _elapsed: number): void {
    if (!this.scene || !this.dom) return
    const { scroll, cursor, viewport } = this.ctx
    const s = this.state

    this.updateNav(scroll.scroll)
    this.updateScrollHint(scroll.scroll)

    if (this.staticMode) {
      // Reduced motion: one composed static frame — the strokes frozen
      // mid-swirl over the full night palette, the poster frame held still
      // inside the same warped sky, no stir, no crawl flicker.
      if (this.staticDirty) {
        s.time = STATIC_TIME
        s.stirX = 0
        s.stirY = 0
        s.stirVX = 0
        s.stirVY = 0
        s.stirAmt = 0
        s.vortex = 0
        s.chapter = 0
        s.novaT = 0
        s.videoMix = this.mediaReady ? PAINT_MIX : 0
        this.scene.apply(s)
        this.scene.render()
        this.staticDirty = false
      }
      return
    }

    const aspect = viewport.width / Math.max(viewport.height, 1)

    // --- cursor stirs the wet paint ---------------------------------------------
    const vel = cursor.velocity
    const speed = Math.hypot(vel.x, vel.y)
    const targetAmt = viewport.isTouch ? 0 : clamp(speed / 1800, 0, 1)
    // Fast attack, slow release — the oil keeps swirling after the brush leaves.
    this.stirAmt = damp(
      this.stirAmt,
      targetAmt,
      targetAmt > this.stirAmt ? 9 : 2.1,
      dt,
    )
    s.stirAmt = this.stirAmt
    s.stirX = cursor.ndc.x * aspect
    s.stirY = cursor.ndc.y
    s.stirVX = clamp(vel.x / viewport.width, -1.5, 1.5) * 1.2 * aspect * this.stirAmt
    s.stirVY = clamp(-vel.y / viewport.height, -1.5, 1.5) * 1.2 * this.stirAmt

    // --- Konami STARRY VORTEX envelope -------------------------------------------
    if (this.vortexLeft > 0) {
      this.vortexLeft = Math.max(this.vortexLeft - dt, 0)
      const t = 1 - this.vortexLeft / VORTEX_S
      s.vortex = Math.sin(Math.PI * Math.min(t * 1.12, 1)) ** 0.85
    } else {
      s.vortex = damp(s.vortex, 0, 4, dt)
    }

    // --- supernova → sunflower bloom -----------------------------------------------
    if (this.novaT > 0) {
      this.novaT += dt / NOVA_S
      if (this.novaT >= 1) this.novaT = 0
    }
    s.novaT = this.novaT

    // --- scroll chapters: night → wheat → café → calm night --------------------------
    this.chapterTarget = this.chapterAt(scroll.scroll)
    s.chapter = damp(s.chapter, this.chapterTarget, 2.2, dt)

    // --- generated-clip underlay — per-frame loop crossfade at 60fps ----------------
    // Reading currentTime every frame (not timeupdate) gives smooth boundary fades.
    if (this.paintVideo && this.mediaReady) {
      const v = this.paintVideo
      const dur = v.duration
      if (dur && isFinite(dur)) {
        const t = v.currentTime
        const remaining = dur - t
        if (remaining < LOOP_FADE_S) {
          this.videoMixTarget = (remaining / LOOP_FADE_S) * PAINT_MIX
        } else if (t < LOOP_FADE_S) {
          this.videoMixTarget = (t / LOOP_FADE_S) * PAINT_MIX
        } else {
          this.videoMixTarget = PAINT_MIX
        }
      }
    }
    s.videoMix = damp(s.videoMix, this.videoMixTarget, 1.6, dt)

    // --- scroll churn: one damped velocity signal drives GL rate + video rate ----------
    const rawChurn = Math.min(Math.abs(scroll.velocity) / CHURN_VEL, 1)
    this.churn = damp(this.churn, rawChurn, rawChurn > this.churn ? 6 : 2, dt)
    this.calm = damp(this.calm, s.chapter > 0 ? 1 : 0, 1.2, dt)
    const glRate = lerp(TIME_RATE_REST, TIME_RATE_CHURN, this.churn)
    const targetVideoRate = RATE_REST + this.churn * RATE_SPAN
    if (Math.abs(targetVideoRate - this.videoRate) > 0.01) {
      this.videoRate = targetVideoRate
      if (this.paintVideo?.paused === false) {
        this.paintVideo.playbackRate = clamp(this.videoRate, 0.1, 3)
      }
    }

    // --- frames drift against the wall --------------------------------------------------
    this.applyParallax(scroll.scroll)

    this.glTime += dt * glRate
    s.time = this.glTime

    this.scene.apply(s)
    this.scene.render()
  }

  // --- interaction ----------------------------------------------------------------

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
        sfxVanGoghClick()
        this.ctx.scroll.scrollTo(dest, {
          duration: 1.4,
          offset: href === '#hero' ? 0 : NAV_OFFSET,
        })
      }
    }

    root.addEventListener('click', onClick)
    this.cleanups.push(() => root.removeEventListener('click', onClick))

    // Catalogue entries (<details> on the salon plaques) reflow the gallery
    // when they fold open — re-measure anchors, chapter keys and parallax
    // rest points. `toggle` doesn't bubble; capture catches it at the root.
    const onToggle = (): void => {
      this.measure()
      this.ctx.scroll.resize()
    }
    root.addEventListener('toggle', onToggle, true)
    this.cleanups.push(() => root.removeEventListener('toggle', onToggle, true))
  }

  // --- easter eggs -------------------------------------------------------------------

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
   * Konami → STARRY VORTEX: the whole field accelerates into tight spirals,
   * stars flare, then everything settles over three seconds.
   */
  private bindKonami(): void {
    const onKonami = (): void => {
      if (this.staticMode) {
        this.announce('The night holds still. But it heard you.')
        return
      }
      this.vortexLeft = VORTEX_S
      sfxVanGoghKonami()
      this.announce('STARRY VORTEX. the whole sky tightens into spirals.')
    }
    window.addEventListener(KONAMI_EVENT, onKonami)
    this.cleanups.push(() => window.removeEventListener(KONAMI_EVENT, onKonami))
  }

  /**
   * Click the brightest star three times (within the hero sky) and it goes
   * supernova — a brief sunflower bloom of yellow petals in the field.
   */
  private bindStarEgg(): void {
    if (!this.dom) return
    const hero = this.dom.hero

    const onClick = (e: MouseEvent): void => {
      if (!this.scene) return
      // Only while the hero sky is on screen.
      if (this.ctx.scroll.scroll > this.ctx.viewport.height * 0.8) return
      const star = this.scene.brightestStarScreen(
        this.ctx.viewport.width,
        this.ctx.viewport.height,
      )
      if (Math.hypot(e.clientX - star.x, e.clientY - star.y) > STAR_HIT_PX) return

      this.starClicks += 1
      if (this.starClickTimer !== null) clearTimeout(this.starClickTimer)
      this.starClickTimer = window.setTimeout(() => {
        this.starClickTimer = null
        this.starClicks = 0
      }, STAR_CLICK_MS)

      if (this.starClicks < 3) return
      this.starClicks = 0
      if (!this.staticMode && this.novaT === 0) this.novaT = 1e-4
      sfxVanGoghNova()
      this.showToast()
      this.announce(
        'The brightest star goes supernova and blooms into a sunflower. La nuit étoilée, for Theo.',
      )
    }

    hero.addEventListener('click', onClick)
    this.cleanups.push(() => hero.removeEventListener('click', onClick))
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

  // --- generated media ------------------------------------------------------------------

  /**
   * Higgsfield swirling-paint clip: when the manifest reports ok, the clip
   * becomes the sky's UNDERPAINTING — sampled through the domain-warped fbm
   * shader so the footage churns beyond its loop. Desktop plays the video;
   * mobile and reduced motion run the poster frame through the same warp.
   * Skips silently when the manifest says ok:false or is missing — the
   * procedural glaze + strokes carry the scene alone.
   */
  private loadPaintMedia(): void {
    void loadVanGoghPaintMedia().then((media) => {
      if (!media || this.disposed || !this.scene) return
      this.posterUrl = media.poster ?? null

      if (this.ctx.viewport.isMobile || this.staticMode) {
        // Lighter path: a single still through the warp — no video decode.
        this.loadPoster()
        return
      }

      const video = document.createElement('video')
      video.muted = true
      video.loop = true
      video.playsInline = true
      video.setAttribute('playsinline', '')
      video.preload = 'auto'
      if (media.poster) video.poster = media.poster

      // The clip only counts as ready once a frame is DECODED — before that
      // the VideoTexture samples black, and blending it in would dim the sky
      // to half brightness for nothing. 'loadeddata' covers the preload
      // path, 'playing' the autoplay path, and requestVideoFrameCallback
      // (where available) the compositor's truth.
      const onFrame = (): void => {
        if (this.disposed || this.paintVideo !== video) return
        this.mediaReady = true
        this.syncPaintVideo()
      }
      video.addEventListener('loadeddata', onFrame)
      video.addEventListener('playing', onFrame)
      if ('requestVideoFrameCallback' in video) {
        video.requestVideoFrameCallback(() => onFrame())
      }

      // A dead clip (404 mp4 behind an ok manifest, decode failure) must
      // never darken the night: drop the layer and degrade to the warped
      // poster — or, with no poster, let the procedural glaze stand alone.
      video.addEventListener('error', () => {
        if (this.disposed || this.paintVideo !== video) return
        this.paintVideo = null
        if (this.scene?.rebindSkyPoster()) {
          this.videoMixTarget = PAINT_MIX
        } else {
          this.videoMixTarget = 0
          this.mediaReady = false
          this.loadPoster()
        }
        this.staticDirty = true
      })

      video.src = media.video
      this.paintVideo = video
      this.scene.setSkyVideo(video)
      this.syncPaintVideo()
    })
  }

  /** Bind the clip's poster frame as a still underpainting (owned by the scene). */
  private loadPoster(): void {
    if (!this.posterUrl || this.posterRequested) return
    this.posterRequested = true
    new TextureLoader().load(this.posterUrl, (tex) => {
      if (this.disposed || !this.scene) {
        tex.dispose()
        return
      }
      const img = tex.image as { width?: number; height?: number } | undefined
      const aspect =
        img && img.width && img.height ? img.width / img.height : 16 / 9
      this.scene.setSkyPoster(tex, aspect)
      this.mediaReady = true
      this.videoMixTarget = PAINT_MIX
      this.staticDirty = true // re-compose the static frame with the still in
    })
  }

  /**
   * Reduced motion freezes the underpainting: the clip pauses and the poster
   * still takes its place inside the same warp (loaded on demand if the
   * preference flips after init). Motion restored → the clip plays again.
   * The clip is only ever blended in once it holds a decoded frame
   * (HAVE_CURRENT_DATA) — a frameless VideoTexture samples black and would
   * silently dim the whole sky.
   */
  private syncPaintVideo(): void {
    if (this.staticMode) {
      this.paintVideo?.pause()
      this.loadPoster()
      this.staticDirty = true
      return
    }
    if (this.paintVideo) {
      const hasFrame =
        this.paintVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      if (hasFrame) {
        // Re-adopt the clip in case a poster still replaced it while frozen.
        this.scene?.setSkyVideo(this.paintVideo)
        this.videoMixTarget = PAINT_MIX
      } else {
        // No decoded frame yet — let the poster (if bound) keep carrying
        // the layer; the clip's 'loadeddata'/'playing' listeners re-sync.
        this.videoMixTarget = this.scene?.rebindSkyPoster() ? PAINT_MIX : 0
      }
      void this.paintVideo.play().catch(() => {
        /* autoplay veto: a decoded preload frame still paints; else
           the warped poster / glaze stands alone */
      })
    } else if (this.mediaReady) {
      this.videoMixTarget = PAINT_MIX
    }
  }

  // --- reveals -----------------------------------------------------------------------

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
    const targets = this.dom.wrapper.querySelectorAll('.vg-reveal')
    targets.forEach((el) => this.io?.observe(el))
  }

  private revealEverything(): void {
    this.dom?.wrapper
      .querySelectorAll('.vg-reveal')
      .forEach((el) => el.classList.add('is-in'))
  }

  // --- scroll choreography ---------------------------------------------------------------

  /** Measure section anchors, chapter keyframes and parallax rest points. */
  private measure(): void {
    if (!this.dom) return
    const sc = this.ctx.scroll.scroll

    this.anchors = this.dom.sections.map(
      (el) => el.getBoundingClientRect().top + sc,
    )

    // Chapter keyframes: hero night → wheat through about/experience →
    // café terrace at projects → calm night by contact.
    const at = (i: number): number => this.anchors[i] ?? 0
    // chapterAt() probes 0.45vh AHEAD of the scroll, so without a hold key
    // the hero would already render half-blended into the wheat palette at
    // scroll 0 — the signature Starry-Night palette would never be seen in
    // motion mode. Hold chapter 0 until Room I actually approaches
    // mid-screen (clamped so the keys stay monotonic in any layout).
    const nightHold = Math.min(this.ctx.viewport.height * 0.6, at(1))
    this.chapterKeys = [
      { pos: 0, v: 0 },
      { pos: nightHold, v: 0 }, // the hero night survives the probe offset
      { pos: at(1), v: 1 }, // about
      { pos: at(3), v: 1.6 }, // projects ramp begins from experience's end
      { pos: at(4), v: 2 }, // skills holds the café light
      { pos: at(7), v: 3 }, // contact — back to the calmest night
    ]

    this.collectParallax()
  }

  private chapterAt(scrollY: number): number {
    const keys = this.chapterKeys
    if (keys.length === 0) return 0
    const probe = scrollY + this.ctx.viewport.height * 0.45
    let prev = keys[0]
    if (!prev) return 0
    if (probe <= prev.pos) return prev.v
    for (let i = 1; i < keys.length; i++) {
      const next = keys[i]
      if (!next) break
      if (probe < next.pos) {
        const t = (probe - prev.pos) / Math.max(next.pos - prev.pos, 1)
        return lerp(prev.v, next.v, t)
      }
      prev = next
    }
    return prev.v
  }

  // --- parallax: frames drift against the gallery wall -------------------------------------

  private collectParallax(): void {
    if (!this.dom) return
    // Reset offsets before measuring so rest positions are clean. The CSS
    // `translate` property is used (not `transform`) so the parallax drift
    // composes with the rotations on frames and handwritten notes.
    for (const item of this.parallax) item.el.style.translate = ''
    const sc = this.ctx.scroll.scroll
    this.parallax = []
    const els = this.dom.wrapper.querySelectorAll<HTMLElement>('[data-speed]')
    els.forEach((el) => {
      const speed = Number(el.dataset.speed ?? '0')
      if (!Number.isFinite(speed) || speed === 0) return
      const rect = el.getBoundingClientRect()
      this.parallax.push({
        el,
        speed,
        center: rect.top + sc + rect.height / 2,
        last: 0,
      })
    })
  }

  private applyParallax(scrollY: number): void {
    const vh = this.ctx.viewport.height
    const mid = scrollY + vh / 2
    for (const item of this.parallax) {
      const rel = item.center - mid
      if (Math.abs(rel) > vh * 1.4) continue
      const y = -rel * item.speed
      if (Math.abs(y - item.last) < 0.15) continue
      item.last = y
      item.el.style.translate = `0 ${y.toFixed(2)}px`
    }
  }

  private clearParallax(): void {
    for (const item of this.parallax) {
      item.el.style.translate = ''
      item.last = 0
    }
  }

  // --- masthead state -------------------------------------------------------------------------

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

const createVanGoghTheme: ThemeFactory = () => new VanGoghTheme()

export default createVanGoghTheme
