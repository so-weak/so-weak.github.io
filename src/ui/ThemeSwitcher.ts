/**
 * ThemeSwitcher — fixed bottom-right dropdown.
 *
 * - Trigger button shows the active theme's swatch + name + chevron
 * - Click (or Enter/Space) opens a floating panel listing all themes
 * - Arrow keys move focus through the panel options; Enter selects
 * - Escape closes the panel; clicking outside closes it
 * - Digit keys 1–N are a global shortcut (suppressed while typing)
 * - Disables itself while a switch is in flight (sg:switching)
 */

import {
  SWITCHING_EVENT,
  THEME_EVENT,
  type ThemeManager,
} from '../app/ThemeManager'
import { THEME_META, THEME_ORDER } from '../themes/registry'
import type { ThemeId } from '../themes/types'
import './theme-switcher.css'

interface SwitchingEventDetail { switching: boolean }
interface ThemeEventDetail { id: ThemeId }

export class ThemeSwitcher {
  private readonly manager: ThemeManager
  private readonly el: HTMLElement          // wrapper nav
  private readonly trigger: HTMLButtonElement
  private readonly panel: HTMLElement
  private readonly options = new Map<ThemeId, HTMLButtonElement>()
  private isOpen = false
  private disabled = false

  constructor(container: HTMLElement, manager: ThemeManager) {
    this.manager = manager

    // ── wrapper ──────────────────────────────────────────────────────────
    this.el = document.createElement('nav')
    this.el.className = 'sg-switcher'
    this.el.setAttribute('aria-label', 'Theme')

    // ── trigger ───────────────────────────────────────────────────────────
    this.trigger = document.createElement('button')
    this.trigger.type = 'button'
    this.trigger.className = 'sg-switcher__trigger'
    this.trigger.setAttribute('aria-haspopup', 'listbox')
    this.trigger.setAttribute('aria-expanded', 'false')
    this.trigger.setAttribute('aria-label', 'Change theme')

    const triggerSwatch = document.createElement('span')
    triggerSwatch.className = 'sg-switcher__tswatch'
    triggerSwatch.setAttribute('aria-hidden', 'true')

    const triggerLabel = document.createElement('span')
    triggerLabel.className = 'sg-switcher__tlabel'

    const chevron = document.createElement('span')
    chevron.className = 'sg-switcher__chevron'
    chevron.setAttribute('aria-hidden', 'true')
    chevron.innerHTML = `<svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 5L5 1L9 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`

    this.trigger.append(triggerSwatch, triggerLabel, chevron)
    this.trigger.addEventListener('click', () => this.togglePanel())

    // ── panel ────────────────────────────────────────────────────────────
    this.panel = document.createElement('ul')
    this.panel.className = 'sg-switcher__panel'
    this.panel.setAttribute('role', 'listbox')
    this.panel.setAttribute('aria-label', 'Themes')
    this.panel.hidden = true

    for (const id of THEME_ORDER) {
      const meta = THEME_META[id]
      const index = THEME_ORDER.indexOf(id)

      const li = document.createElement('li')
      li.setAttribute('role', 'none')

      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'sg-switcher__option'
      btn.setAttribute('role', 'option')
      btn.setAttribute('aria-selected', 'false')
      btn.title = `${meta.name} — ${meta.description} (press ${index + 1})`
      btn.dataset.themeId = id

      const swatch = document.createElement('span')
      swatch.className = 'sg-switcher__swatch'
      swatch.style.setProperty('--swatch', meta.swatch)
      swatch.setAttribute('aria-hidden', 'true')

      const label = document.createElement('span')
      label.className = 'sg-switcher__label'
      label.textContent = meta.name

      const shortcut = document.createElement('kbd')
      shortcut.className = 'sg-switcher__kbd'
      shortcut.setAttribute('aria-hidden', 'true')
      shortcut.textContent = String(index + 1)

      btn.append(swatch, label, shortcut)
      btn.addEventListener('click', () => {
        void this.select(id)
        this.closePanel()
      })
      this.options.set(id, btn)
      li.appendChild(btn)
      this.panel.appendChild(li)
    }

    // ── assemble ──────────────────────────────────────────────────────────
    this.el.append(this.trigger, this.panel)
    this.el.addEventListener('keydown', this.onPanelKeydown)
    window.addEventListener('keydown', this.onGlobalKeydown)
    window.addEventListener('pointerdown', this.onOutsideClick, true)
    window.addEventListener(SWITCHING_EVENT, this.onSwitching as EventListener)
    window.addEventListener(THEME_EVENT, this.onThemeChange as EventListener)

    this.reflect(manager.activeId)
    container.appendChild(this.el)
  }

  dispose(): void {
    this.el.removeEventListener('keydown', this.onPanelKeydown)
    window.removeEventListener('keydown', this.onGlobalKeydown)
    window.removeEventListener('pointerdown', this.onOutsideClick, true)
    window.removeEventListener(SWITCHING_EVENT, this.onSwitching as EventListener)
    window.removeEventListener(THEME_EVENT, this.onThemeChange as EventListener)
    this.el.remove()
    this.options.clear()
  }

  // --- panel open/close -------------------------------------------------------

  private togglePanel(): void {
    if (this.disabled) return
    this.isOpen ? this.closePanel() : this.openPanel()
  }

  private openPanel(): void {
    if (this.isOpen || this.disabled) return
    this.isOpen = true
    this.panel.hidden = false
    this.trigger.setAttribute('aria-expanded', 'true')
    this.el.classList.add('is-open')
    // Focus the active option.
    const activeId = this.manager.activeId ?? THEME_ORDER[0]
    this.options.get(activeId as ThemeId)?.focus()
  }

  private closePanel(): void {
    if (!this.isOpen) return
    this.isOpen = false
    this.panel.hidden = true
    this.trigger.setAttribute('aria-expanded', 'false')
    this.el.classList.remove('is-open')
  }

  // --- selection + reflection --------------------------------------------------

  private async select(id: ThemeId): Promise<void> {
    if (this.disabled) return
    await this.manager.switch(id).catch((error: unknown) => {
      console.error(`[ThemeSwitcher] Switch to "${id}" failed:`, error)
    })
  }

  private reflect(activeId: ThemeId | null): void {
    const meta = activeId ? THEME_META[activeId] : null

    // Update trigger face.
    const tswatch = this.trigger.querySelector<HTMLElement>('.sg-switcher__tswatch')
    const tlabel = this.trigger.querySelector<HTMLElement>('.sg-switcher__tlabel')
    if (tswatch && meta) tswatch.style.setProperty('--swatch', meta.swatch)
    if (tlabel) tlabel.textContent = meta?.name ?? '—'

    // Update option aria-selected states.
    for (const [id, btn] of this.options) {
      btn.setAttribute('aria-selected', String(id === activeId))
      btn.classList.toggle('is-active', id === activeId)
    }
  }

  private setDisabled(disabled: boolean): void {
    this.disabled = disabled
    this.el.classList.toggle('is-disabled', disabled)
    this.trigger.disabled = disabled
    for (const btn of this.options.values()) btn.disabled = disabled
    if (disabled) this.closePanel()
  }

  // --- keyboard ---------------------------------------------------------------

  private onPanelKeydown = (e: KeyboardEvent): void => {
    if (!this.isOpen) return

    const ids = [...THEME_ORDER] as ThemeId[]
    const focused = document.activeElement
    const currentIdx = ids.findIndex(
      (id) => this.options.get(id) === focused,
    )

    if (e.key === 'Escape') {
      e.preventDefault()
      this.closePanel()
      this.trigger.focus()
      return
    }

    let nextIdx = currentIdx
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      nextIdx = (currentIdx + 1) % ids.length
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      nextIdx = (currentIdx - 1 + ids.length) % ids.length
    } else if (e.key === 'Home') {
      nextIdx = 0
    } else if (e.key === 'End') {
      nextIdx = ids.length - 1
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (currentIdx >= 0) {
        e.preventDefault()
        const id = ids[currentIdx]
        if (id) void this.select(id)
        this.closePanel()
      }
      return
    } else {
      return
    }

    e.preventDefault()
    const nextId = ids[nextIdx]
    if (nextId) this.options.get(nextId)?.focus()
  }

  private onGlobalKeydown = (e: KeyboardEvent): void => {
    if (this.disabled || e.metaKey || e.ctrlKey || e.altKey) return
    if (isTypingTarget(e.target)) return
    if (e.key === 'Escape' && this.isOpen) {
      this.closePanel()
      this.trigger.focus()
      return
    }
    if (!/^[1-9]$/.test(e.key)) return
    const id = THEME_ORDER[Number(e.key) - 1]
    if (id) void this.select(id)
  }

  private onOutsideClick = (e: PointerEvent): void => {
    if (this.isOpen && !this.el.contains(e.target as Node)) {
      this.closePanel()
    }
  }

  private onSwitching = (e: CustomEvent<SwitchingEventDetail>): void => {
    this.setDisabled(e.detail.switching)
  }

  private onThemeChange = (e: CustomEvent<ThemeEventDetail>): void => {
    this.reflect(e.detail.id)
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}
