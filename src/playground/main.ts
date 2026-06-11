/**
 * THE LAB — shader & rendering experiments.
 *
 * A research-index archive page with ONE shared WebGLRenderer for its whole
 * lifetime. Experiments mirror the site's theme architecture in miniature:
 * lazy-loaded, init → update per frame → dispose, swapped with full GL
 * disposal. The idle index sits over a subtle ambient shader field; opening
 * an entry takes the canvas fullscreen with an info chip overlay.
 *
 * Esc / close returns to the index; arrow keys cycle entries.
 */

import '../styles/base.css'
import './styles.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource-variable/archivo'

import { WebGLRenderer } from 'three'
import { CursorManager } from '../app/CursorManager'
import { Ticker } from '../app/Ticker'
import { Viewport } from '../app/Viewport'
import { siteContent } from '../content/data'
import { clamp, damp } from '../utils/math'
import { AmbientField } from './ambient'
import { EXPERIMENTS } from './registry'
import type { SourceFile } from './sources'
import type { CursorNdc, Experiment } from './types'

const DPR_CAP = 1.5
const STATIC_FRAME_DT = 1 / 60
const STATIC_FRAME_ELAPSED = 7

/**
 * Pointer tracking that also works on touch (CursorManager goes inert
 * there). Damped NDC, no per-frame allocations.
 */
class PointerTracker {
  readonly ndc: CursorNdc = { x: 0, y: 0 }

  private readonly target = { x: 0, y: 0 }
  private readonly viewport: Viewport
  private hasInput = false

  constructor(viewport: Viewport) {
    this.viewport = viewport
    window.addEventListener('pointermove', this.onPointer, { passive: true })
    window.addEventListener('pointerdown', this.onPointer, { passive: true })
  }

  update(dt: number): void {
    if (!this.hasInput || dt <= 0) return
    this.ndc.x = damp(this.ndc.x, this.target.x, 6, dt)
    this.ndc.y = damp(this.ndc.y, this.target.y, 6, dt)
  }

  private onPointer = (e: PointerEvent): void => {
    this.target.x = clamp((e.clientX / this.viewport.width) * 2 - 1, -1, 1)
    this.target.y = clamp(-((e.clientY / this.viewport.height) * 2 - 1), -1, 1)
    if (!this.hasInput) {
      this.hasInput = true
      this.ndc.x = this.target.x
      this.ndc.y = this.target.y
    }
  }
}

type LabState = 'index' | 'loading' | 'active'

class LabApp {
  private readonly root: HTMLElement
  private readonly ticker = new Ticker()
  private readonly viewport = new Viewport(this.ticker)
  private readonly pointer: PointerTracker
  private readonly renderer: WebGLRenderer
  private readonly ambient = new AmbientField()

  private state: LabState = 'index'
  private experiment: Experiment | null = null
  private activeIndex = 0
  private expElapsed = 0
  private genToken = 0
  private staticFrameDone = false
  private ambientStaticDone = false
  private lastFocusedRow: HTMLElement | null = null

  // Viewer chrome refs.
  private viewer!: HTMLElement
  private chipNo!: HTMLElement
  private chipTitle!: HTMLElement
  private chipDesc!: HTMLElement
  private chipControls!: HTMLElement
  private counter!: HTMLElement
  private loadingEl!: HTMLElement
  private noteEl!: HTMLElement
  private closeBtn!: HTMLButtonElement

  // SOURCE drawer — code lazy-loaded (raw file strings) on first open.
  private sourceBtn!: HTMLButtonElement
  private sourceDrawer!: HTMLElement
  private sourceName!: HTMLElement
  private sourceCount!: HTMLElement
  private sourceTabs!: HTMLElement
  private sourceFileEl!: HTMLElement
  private sourceLinesEl!: HTMLElement
  private sourceBody!: HTMLElement
  private sourceCode!: HTMLElement
  private sourceCopyBtn!: HTMLButtonElement
  private sourceCopyAllBtn!: HTMLButtonElement
  private sourceOpen = false
  private sourceTab = 0
  private sourceFiles: readonly SourceFile[] = []
  private sourcesMod: typeof import('./sources') | null = null
  private readonly copyTimers = new Map<HTMLButtonElement, number>()

  constructor(root: HTMLElement) {
    this.root = root
    root.classList.add('playground')
    this.buildDom()

    const canvas = document.createElement('canvas')
    canvas.className = 'lab-canvas'
    canvas.setAttribute('aria-hidden', 'true')
    root.prepend(canvas)

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setClearColor(0x0b0b0e, 1)

    this.pointer = new PointerTracker(this.viewport)

    // Custom cursor — same element/contract as the main site.
    const cursorEl = document.createElement('div')
    cursorEl.id = 'cursor'
    cursorEl.setAttribute('aria-hidden', 'true')
    document.body.appendChild(cursorEl)
    const cursor = new CursorManager(this.ticker, this.viewport, cursorEl)
    cursor.bind(root)

    this.ambient.init(this.renderer, this.viewport)
    this.applySize()

    this.viewport.on(() => this.applySize())
    this.viewport.onReducedMotionChange(() => {
      this.staticFrameDone = false
      this.ambientStaticDone = false
      this.syncReducedMotionNote()
    })

    this.bindEvents()

    this.ticker.add(this.onFrame, 0)
    this.ticker.start()
  }

  // --- DOM -----------------------------------------------------------------

  private buildDom(): void {
    const { identity } = siteContent
    const rows = EXPERIMENTS.map(
      (e, i) => `
      <li style="--i: ${i}">
        <button type="button" class="lab-row" data-index="${i}"
                aria-label="Run experiment ${e.no} — ${e.title}">
          <span class="lab-no">${e.no}</span>
          <span class="lab-name">${e.title}</span>
          <span class="lab-tags">${e.tags.join(' · ')}</span>
          <span class="lab-year">${e.year}</span>
          <span class="lab-run" aria-hidden="true">Run &#8599;</span>
        </button>
      </li>`,
    ).join('')

    this.root.innerHTML = `
      <div class="lab-shell">
        <header>
          <div class="lab-topbar">
            <span>SG &mdash; Research index</span>
            <a href="/">Return to portfolio</a>
          </div>
          <div class="lab-hero">
            <h1>The Lab</h1>
            <p class="lab-sub">
              Shader &amp; rendering experiments &mdash; <strong>by ${identity.name}</strong>.
              Six standalone studies in real-time graphics. Every entry runs on one
              shared WebGL2 renderer and is fully disposed on exit &mdash; the same
              swap architecture as the portfolio themes.
            </p>
            <p class="lab-meta">
              <span>Entries <b>06</b></span>
              <span>Renderer <b>shared &middot; WebGL2</b></span>
              <span>DPR cap <b>1.5</b></span>
              <span>Disposal <b>full, on swap</b></span>
            </p>
          </div>
        </header>
        <main>
          <ol class="lab-index" aria-label="Experiment index">${rows}</ol>
        </main>
        <footer class="lab-footer">
          <nav aria-label="Lab links">
            <a href="mailto:${identity.email}">${identity.email}</a>
            <a href="${identity.github}" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="${identity.resumeUrl}" download>Resume (PDF)</a>
            <a href="/">Return to portfolio</a>
          </nav>
          <span>&copy; 2026 ${identity.name}</span>
        </footer>
      </div>
      <div class="lab-viewer" role="dialog" aria-modal="true" aria-label="Experiment viewer" hidden>
        <p class="lab-loading" hidden>Compiling shaders</p>
        <p class="lab-note" hidden>Reduced motion &mdash; static frame</p>
        <div class="lab-chip">
          <p class="lab-chip-no"></p>
          <h2 class="lab-chip-title"></h2>
          <p class="lab-chip-desc"></p>
          <p class="lab-chip-controls"><span></span></p>
          <button class="lab-chip-source" type="button" aria-haspopup="dialog"
                  aria-controls="lab-source" aria-expanded="false">Source &lt;/&gt;</button>
        </div>
        <button class="lab-close" type="button">Esc / Close</button>
        <div class="lab-pager">
          <button class="lab-prev" type="button" aria-label="Previous experiment">&larr;</button>
          <span class="lab-counter" aria-live="polite"></span>
          <button class="lab-next" type="button" aria-label="Next experiment">&rarr;</button>
        </div>
        <aside class="lab-source" id="lab-source" role="dialog"
               aria-label="Experiment source code" tabindex="-1" hidden>
          <div class="lab-source-head">
            <p class="lab-source-title">
              <span class="lab-source-name"></span>
              <span class="lab-source-count"></span>
            </p>
            <div class="lab-source-actions">
              <button class="lab-source-copyall" type="button" aria-live="polite"
                      data-idle="Copy all as single file">Copy all as single file</button>
              <button class="lab-source-x" type="button" aria-label="Close source drawer">&times;</button>
            </div>
          </div>
          <div class="lab-source-tabs" role="tablist" aria-label="Source files"></div>
          <div class="lab-source-filebar">
            <span class="lab-source-file"></span>
            <span class="lab-source-lines"></span>
            <button class="lab-source-copy" type="button" aria-live="polite"
                    data-idle="Copy">Copy</button>
          </div>
          <div class="lab-source-body" role="tabpanel" tabindex="0" aria-label="File contents">
            <pre><code class="lab-source-code"></code></pre>
          </div>
        </aside>
      </div>
    `

    const q = <T extends HTMLElement>(sel: string): T => {
      const el = this.root.querySelector<T>(sel)
      if (!el) throw new Error(`[lab] Missing element ${sel}`)
      return el
    }
    this.viewer = q('.lab-viewer')
    this.chipNo = q('.lab-chip-no')
    this.chipTitle = q('.lab-chip-title')
    this.chipDesc = q('.lab-chip-desc')
    this.chipControls = q('.lab-chip-controls span')
    this.counter = q('.lab-counter')
    this.loadingEl = q('.lab-loading')
    this.noteEl = q('.lab-note')
    this.closeBtn = q<HTMLButtonElement>('.lab-close')
    this.sourceBtn = q<HTMLButtonElement>('.lab-chip-source')
    this.sourceDrawer = q('.lab-source')
    this.sourceName = q('.lab-source-name')
    this.sourceCount = q('.lab-source-count')
    this.sourceTabs = q('.lab-source-tabs')
    this.sourceFileEl = q('.lab-source-file')
    this.sourceLinesEl = q('.lab-source-lines')
    this.sourceBody = q('.lab-source-body')
    this.sourceCode = q('.lab-source-code')
    this.sourceCopyBtn = q<HTMLButtonElement>('.lab-source-copy')
    this.sourceCopyAllBtn = q<HTMLButtonElement>('.lab-source-copyall')
  }

  private bindEvents(): void {
    const index = this.root.querySelector<HTMLElement>('.lab-index')
    if (index) {
      index.addEventListener('click', (e) => {
        const row = (e.target as Element).closest<HTMLElement>('.lab-row')
        if (!row) return
        this.lastFocusedRow = row
        void this.open(Number(row.dataset.index ?? 0))
      })
      // Hovering / focusing a row drifts the ambient field's tint.
      const mood = (e: Event): void => {
        const row = (e.target as Element).closest<HTMLElement>('.lab-row')
        if (!row) return
        const i = Number(row.dataset.index ?? 0)
        this.ambient.setMood(EXPERIMENTS.length > 1 ? i / (EXPERIMENTS.length - 1) : 0)
        this.ambientStaticDone = false
      }
      index.addEventListener('pointerover', mood, { passive: true })
      index.addEventListener('focusin', mood)
    }

    this.closeBtn.addEventListener('click', () => this.close())
    this.root.querySelector('.lab-prev')?.addEventListener('click', () => this.step(-1))
    this.root.querySelector('.lab-next')?.addEventListener('click', () => this.step(1))

    window.addEventListener('keydown', (e) => {
      if (this.state === 'index') return
      if (e.key === 'Escape') {
        e.preventDefault()
        // Esc peels UI back one layer: drawer first, then the viewer.
        if (this.sourceOpen) this.closeSource()
        else this.close()
        return
      }
      // While the drawer is open the keyboard belongs to it (tab roving,
      // code scrolling) — don't hijack arrows to step experiments.
      if (this.sourceOpen) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        this.step(1)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        this.step(-1)
      }
    })

    // --- SOURCE drawer ------------------------------------------------------
    this.sourceBtn.addEventListener('click', () => void this.toggleSource())
    this.root
      .querySelector('.lab-source-x')
      ?.addEventListener('click', () => this.closeSource())

    this.sourceTabs.addEventListener('click', (e) => {
      const tab = (e.target as Element).closest<HTMLElement>('[data-tab]')
      if (tab) this.selectSourceTab(Number(tab.dataset.tab ?? 0))
    })
    // Roving tabindex on the file tabs (ARIA tabs pattern).
    this.sourceTabs.addEventListener('keydown', (e) => {
      const n = this.sourceFiles.length
      if (n === 0) return
      let next = -1
      if (e.key === 'ArrowRight') next = (this.sourceTab + 1) % n
      else if (e.key === 'ArrowLeft') next = (this.sourceTab - 1 + n) % n
      else if (e.key === 'Home') next = 0
      else if (e.key === 'End') next = n - 1
      if (next < 0) return
      e.preventDefault()
      this.selectSourceTab(next)
      this.sourceTabs.querySelector<HTMLElement>(`[data-tab='${next}']`)?.focus()
    })

    this.sourceCopyBtn.addEventListener('click', () => {
      const file = this.sourceFiles[this.sourceTab]
      if (file) this.copyText(file.code, this.sourceCopyBtn)
    })
    this.sourceCopyAllBtn.addEventListener('click', () => {
      const entry = EXPERIMENTS[this.activeIndex]
      const mod = this.sourcesMod
      if (!entry || !mod || this.sourceFiles.length === 0) return
      this.copyText(
        mod.concatSources(`${entry.no} ${entry.title}`, this.sourceFiles),
        this.sourceCopyAllBtn,
      )
    })
  }

  // --- experiment lifecycle ---------------------------------------------------

  private async open(index: number): Promise<void> {
    const entry = EXPERIMENTS[index]
    if (!entry) return
    const token = ++this.genToken

    // One renderer, one experiment: the old one dies before the new one boots.
    this.experiment?.dispose()
    this.experiment = null
    this.activeIndex = index
    this.setState('loading')
    this.populateChip(index)
    // Keep an open drawer in step with the entry being viewed.
    if (this.sourceOpen && this.sourcesMod) this.renderSource()

    try {
      const mod = await entry.load()
      if (token !== this.genToken) return
      const exp = mod.default()
      await exp.init(this.renderer, this.viewport)
      if (token !== this.genToken) {
        exp.dispose()
        return
      }
      exp.resize(this.viewport.width, this.viewport.height, this.dprCapped)
      this.experiment = exp
      this.expElapsed = 0
      this.staticFrameDone = false
      this.setState('active')
      if (!this.sourceOpen) this.closeBtn.focus({ preventScroll: true })
    } catch (error) {
      console.error(`[lab] Experiment ${entry.no} failed to boot:`, error)
      this.close()
    }
  }

  private close(): void {
    this.genToken++
    this.closeSource(false) // viewer is going away — focus lands on the row
    this.experiment?.dispose()
    this.experiment = null
    this.renderer.setClearColor(0x0b0b0e, 1)
    this.renderer.autoClear = true
    this.ambientStaticDone = false
    this.setState('index')
    this.lastFocusedRow?.focus({ preventScroll: true })
  }

  private step(delta: number): void {
    const n = EXPERIMENTS.length
    const next = (this.activeIndex + delta + n) % n
    const row = this.root.querySelector<HTMLElement>(`.lab-row[data-index='${next}']`)
    if (row) this.lastFocusedRow = row
    void this.open(next)
  }

  private setState(state: LabState): void {
    this.state = state
    const viewing = state !== 'index'
    this.root.classList.toggle('is-viewing', viewing)
    this.viewer.hidden = !viewing
    this.loadingEl.hidden = state !== 'loading'
    document.documentElement.style.overflow = viewing ? 'hidden' : ''
    // Kill pull-to-refresh / viewport rubber-banding while an experiment owns
    // the touch surface (ADVECT draws with a finger; BOKEH tracks it).
    document.documentElement.style.overscrollBehavior = viewing ? 'none' : ''
    this.syncReducedMotionNote()
  }

  private populateChip(index: number): void {
    const entry = EXPERIMENTS[index]
    if (!entry) return
    this.chipNo.textContent = `Entry ${entry.no} · ${entry.year}`
    this.chipTitle.textContent = entry.title
    this.chipDesc.textContent = entry.description
    this.chipControls.textContent = entry.controls
    this.counter.textContent = `${entry.no} / ${String(EXPERIMENTS.length).padStart(3, '0')}`
  }

  private syncReducedMotionNote(): void {
    this.noteEl.hidden = !(this.viewport.reducedMotion && this.state === 'active')
  }

  // --- SOURCE drawer --------------------------------------------------------

  private async toggleSource(): Promise<void> {
    if (this.sourceOpen) {
      this.closeSource()
      return
    }
    if (!this.sourcesMod) {
      this.sourceBtn.setAttribute('aria-busy', 'true')
      try {
        this.sourcesMod = await import('./sources')
      } catch (error) {
        console.error('[lab] Source module failed to load:', error)
        return
      } finally {
        this.sourceBtn.removeAttribute('aria-busy')
      }
      if (this.state === 'index') return // viewer closed while loading
    }
    this.renderSource()
    if (this.sourceFiles.length === 0) return
    this.sourceOpen = true
    this.sourceDrawer.hidden = false
    this.sourceBtn.setAttribute('aria-expanded', 'true')
    // Focus moves into the drawer — onto the active file tab.
    const tab = this.sourceTabs.querySelector<HTMLElement>('[aria-selected="true"]')
    ;(tab ?? this.sourceDrawer).focus({ preventScroll: true })
  }

  private closeSource(restoreFocus = true): void {
    if (!this.sourceOpen) return
    this.sourceOpen = false
    this.sourceDrawer.hidden = true
    this.sourceBtn.setAttribute('aria-expanded', 'false')
    this.clearCopyFeedback()
    if (restoreFocus) this.sourceBtn.focus({ preventScroll: true })
  }

  /** (Re)build the drawer for the active entry. Requires sourcesMod. */
  private renderSource(): void {
    const entry = EXPERIMENTS[this.activeIndex]
    const mod = this.sourcesMod
    if (!entry || !mod) return
    const files = mod.EXPERIMENT_SOURCES[entry.no] ?? []
    if (files.length === 0) {
      console.warn(`[lab] No sources mapped for entry ${entry.no}`)
    }
    this.sourceFiles = files
    this.clearCopyFeedback()
    this.sourceName.textContent = `Source — ${entry.title}`
    this.sourceCount.textContent = `${files.length} file${files.length === 1 ? '' : 's'}`
    this.sourceTabs.innerHTML = files
      .map(
        (f, i) => `
        <button type="button" role="tab" id="lab-source-tab-${i}" data-tab="${i}"
                aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${f.name}</button>`,
      )
      .join('')
    this.selectSourceTab(0)
  }

  private selectSourceTab(index: number): void {
    const file = this.sourceFiles[index]
    const mod = this.sourcesMod
    if (!file || !mod) return
    this.sourceTab = index
    this.sourceTabs.querySelectorAll<HTMLButtonElement>('[role="tab"]').forEach((tab, i) => {
      const selected = i === index
      tab.setAttribute('aria-selected', String(selected))
      tab.tabIndex = selected ? 0 : -1
      tab.classList.toggle('is-active', selected)
    })
    this.sourceFileEl.textContent = file.path
    this.sourceLinesEl.textContent = `${mod.countLines(file.code)} lines`
    this.sourceCode.innerHTML = mod.tintSource(file.code, file.lang)
    this.sourceBody.setAttribute('aria-labelledby', `lab-source-tab-${index}`)
    this.sourceBody.scrollTop = 0
    this.sourceBody.scrollLeft = 0
    this.resetCopyButton(this.sourceCopyBtn)
  }

  /** Clipboard write with execCommand fallback + transient "Copied ✓" state. */
  private copyText(text: string, btn: HTMLButtonElement): void {
    const done = (ok: boolean): void => {
      btn.textContent = ok ? 'Copied ✓' : 'Copy failed'
      btn.classList.toggle('is-copied', ok)
      const existing = this.copyTimers.get(btn)
      if (existing !== undefined) window.clearTimeout(existing)
      const t = window.setTimeout(() => {
        this.copyTimers.delete(btn)
        btn.textContent = btn.dataset.idle ?? 'Copy'
        btn.classList.remove('is-copied')
      }, 1800)
      this.copyTimers.set(btn, t)
    }
    const fallback = (): boolean => {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      let ok = false
      try {
        ok = document.execCommand('copy')
      } catch {
        ok = false
      }
      ta.remove()
      return ok
    }
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(
        () => done(true),
        () => done(fallback()),
      )
    } else {
      done(fallback())
    }
  }

  private resetCopyButton(btn: HTMLButtonElement): void {
    const t = this.copyTimers.get(btn)
    if (t !== undefined) {
      window.clearTimeout(t)
      this.copyTimers.delete(btn)
    }
    btn.textContent = btn.dataset.idle ?? 'Copy'
    btn.classList.remove('is-copied')
  }

  private clearCopyFeedback(): void {
    this.resetCopyButton(this.sourceCopyBtn)
    this.resetCopyButton(this.sourceCopyAllBtn)
  }

  // --- frame + sizing -----------------------------------------------------------

  private get dprCapped(): number {
    return Math.min(this.viewport.dpr, DPR_CAP)
  }

  private applySize(): void {
    const { width, height } = this.viewport
    const dpr = this.dprCapped
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(width, height, false)
    this.ambient.resize(width, height, dpr)
    this.experiment?.resize(width, height, dpr)
    // Re-render static frames at the new size.
    this.staticFrameDone = false
    this.ambientStaticDone = false
  }

  private onFrame = (dt: number, elapsed: number): void => {
    this.pointer.update(dt)
    const reduced = this.viewport.reducedMotion

    if (this.state === 'active' && this.experiment) {
      if (reduced) {
        if (!this.staticFrameDone) {
          this.experiment.update(STATIC_FRAME_DT, STATIC_FRAME_ELAPSED, this.pointer.ndc)
          this.staticFrameDone = true
        }
        return
      }
      this.expElapsed += dt
      this.experiment.update(dt, this.expElapsed, this.pointer.ndc)
      return
    }

    // Index + loading states share the ambient field.
    if (reduced) {
      if (!this.ambientStaticDone) {
        this.ambient.update(STATIC_FRAME_DT, STATIC_FRAME_ELAPSED, this.pointer.ndc)
        this.ambientStaticDone = true
      }
      return
    }
    this.ambient.update(dt, elapsed, this.pointer.ndc)
  }
}

const root = document.querySelector<HTMLElement>('#playground-root')
if (!root) {
  throw new Error('[playground] Mount point "#playground-root" is missing.')
}
new LabApp(root)
