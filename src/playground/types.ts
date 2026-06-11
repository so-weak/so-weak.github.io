/**
 * Playground contracts — mirrors the site's theme architecture in miniature.
 *
 * One shared WebGLRenderer lives for the whole page. Experiments are swapped
 * in and out of it with full disposal, exactly like themes on the main site:
 * init → (resize) → update per frame → dispose, then the object is garbage.
 */

import type { WebGLRenderer } from 'three'
import type { Viewport } from '../app/Viewport'

/** Damped pointer position in NDC (-1..1, y up) — shader-ready. */
export interface CursorNdc {
  x: number
  y: number
}

export interface Experiment {
  /** Build scenes / render targets / materials. May compile shaders async. */
  init(renderer: WebGLRenderer, viewport: Viewport): void | Promise<void>
  /** Render one frame to screen. dt = clamped seconds, elapsed = since activation. */
  update(dt: number, elapsed: number, cursor: CursorNdc): void
  /** Viewport changed. width/height in CSS px, dpr already capped for the lab. */
  resize(width: number, height: number, dpr: number): void
  /** Release every GL resource and restore any renderer state you touched. */
  dispose(): void
}

export type ExperimentFactory = () => Experiment

export interface ExperimentEntry {
  no: string
  title: string
  year: string
  tags: string[]
  /** One-line technique description for the info chip. */
  description: string
  /** Controls hint for the info chip. */
  controls: string
  /** Lazy module loader — keeps each experiment code-split. */
  load: () => Promise<{ default: ExperimentFactory }>
}
