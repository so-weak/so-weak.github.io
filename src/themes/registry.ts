/**
 * Theme registry — the only place that knows which themes exist.
 *
 * Each entry is a lazy dynamic import so Vite code-splits every theme
 * (JS + CSS) into its own chunk; nothing loads until a theme is activated.
 * ThemeManager caches resolved modules, so each chunk is fetched once.
 */

import type { ThemeFactory, ThemeId } from './types'

export interface ThemeModule {
  default: ThemeFactory
}

export interface ThemeMeta {
  id: ThemeId
  name: string
  /** Swatch color shown in the global ThemeSwitcher. */
  swatch: string
  /** One-liner used for tooltips. */
  description: string
}

export const THEME_ORDER: readonly ThemeId[] = [
  'electroform',
  'editorial',
  'terminal',
  'aurora',
  'vangogh',
  'neogrunge',
] as const

export const THEME_META: Readonly<Record<ThemeId, ThemeMeta>> = {
  electroform: {
    id: 'electroform',
    name: 'Electroform',
    swatch: '#5cf2c4',
    description: 'Electroplated chrome & signal green',
  },
  editorial: {
    id: 'editorial',
    name: 'Editorial',
    swatch: '#f4f1ea',
    description: 'Print-grade type on warm paper',
  },
  terminal: {
    id: 'terminal',
    name: 'Terminal',
    swatch: '#33ff66',
    description: 'Phosphor CRT command line',
  },
  aurora: {
    id: 'aurora',
    name: 'Aurora',
    swatch: '#8b5cf6',
    description: 'Slow light over a midnight sky',
  },
  vangogh: {
    id: 'vangogh',
    name: 'Van Gogh',
    // Meta shape is a single color string — the chrome-yellow #f5c842
    // accent lives in the theme's own styles, not the swatch.
    swatch: '#1a2a52',
    description: 'Impasto night in prussian blue & chrome yellow',
  },
  neogrunge: {
    id: 'neogrunge',
    name: 'Neogrunge',
    swatch: '#e63946',
    description: 'Neo grunge comic-book panels on aged newsprint',
  },
}

export const themeRegistry: Readonly<
  Record<ThemeId, () => Promise<ThemeModule>>
> = {
  electroform: () => import('./electroform/index'),
  editorial: () => import('./editorial/index'),
  terminal: () => import('./terminal/index'),
  aurora: () => import('./aurora/index'),
  vangogh: () => import('./vangogh/index'),
  neogrunge: () => import('./neogrunge/index'),
}

export function isThemeId(value: unknown): value is ThemeId {
  return (
    typeof value === 'string' && (THEME_ORDER as readonly string[]).includes(value)
  )
}

export const DEFAULT_THEME: ThemeId = 'electroform'
