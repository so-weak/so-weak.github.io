/**
 * Aurora — mystic-minimal SVG line art.
 * Every glyph strokes with `currentColor` so CSS owns the gold foil.
 * All output is decorative: aria-hidden, non-focusable.
 */

const svg = (inner: string, viewBox = '0 0 64 64'): string =>
  `<svg viewBox="${viewBox}" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`

const STROKE =
  'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'

/** The Polyglot — torii gate. */
export const GLYPH_TORII = svg(
  `<g ${STROKE}>
    <path d="M7 19 Q32 11 57 19"/>
    <path d="M12 28 H52"/>
    <path d="M17 21 V53"/>
    <path d="M47 21 V53"/>
    <path d="M32 19.5 V28"/>
  </g>`,
)

/** The Strings — soundhole and strings. */
export const GLYPH_STRINGS = svg(
  `<g ${STROKE}>
    <path d="M26 8 V24 M30 8 V24 M34 8 V24 M38 8 V24"/>
    <circle cx="32" cy="37" r="12"/>
    <circle cx="32" cy="37" r="6.5" opacity=".55"/>
    <path d="M26 50 V57 M30 50 V57 M34 50 V57 M38 50 V57"/>
    <path d="M22 57 H42"/>
  </g>`,
)

/** The Brush — handle and a single confident stroke. */
export const GLYPH_BRUSH = svg(
  `<g ${STROKE}>
    <path d="M46 7 L34 27"/>
    <path d="M33.2 28.4 q -7 2.6 -9 11 q 9 -1.6 12.1 -9.2"/>
    <path d="M11 53 C 22 50 36 47 53 33" stroke-width="3.4" opacity=".8"/>
  </g>`,
)

/** The Seer — crescent above an open eye. */
export const GLYPH_SEER = svg(
  `<g ${STROKE}>
    <path d="M39 5 a 10 10 0 1 0 8.5 15.5 a 8 8 0 1 1 -8.5 -15.5"/>
    <path d="M14 43 Q32 29 50 43 Q32 57 14 43 Z"/>
    <circle cx="32" cy="43" r="4.6"/>
    <circle cx="32" cy="43" r="1.4" fill="currentColor" stroke="none"/>
  </g>`,
)

/** The Engineer — diamond sigil with a circuit heart. */
export const GLYPH_SIGIL = svg(
  `<g ${STROKE}>
    <path d="M32 9 L54 32 L32 55 L10 32 Z"/>
    <path d="M32 21 V43 M21 32 H43"/>
    <circle cx="32" cy="32" r="2.4" fill="currentColor" stroke="none"/>
  </g>`,
)

/** Section divider — hairlines meeting a diamond and two stars. */
export const ORNAMENT = svg(
  `<g fill="none" stroke="currentColor" stroke-width="1">
    <path d="M4 12 H94"/>
    <path d="M146 12 H236"/>
    <path d="M120 4.5 L127.5 12 L120 19.5 L112.5 12 Z"/>
    <circle cx="120" cy="12" r="1.6" fill="currentColor" stroke="none"/>
    <circle cx="103" cy="12" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="137" cy="12" r="1.5" fill="currentColor" stroke="none"/>
  </g>`,
  '0 0 240 24',
)

/** Face-down card back — double border, crescent, scattered stars. */
export const CARD_BACK = svg(
  `<g fill="none" stroke="currentColor" stroke-width="1.2">
    <rect x="5" y="5" width="110" height="190" rx="11"/>
    <rect x="11.5" y="11.5" width="97" height="177" rx="7.5" opacity=".5"/>
    <path d="M66 58 a 20 20 0 1 0 13 33.5 a 16 16 0 1 1 -13 -33.5"/>
    <path d="M26 152 Q60 136 94 152" opacity=".6"/>
    <path d="M26 161 Q60 145 94 161" opacity=".35"/>
  </g>
  <g fill="currentColor" stroke="none">
    <path d="M32 36 l1.8 4 4 1.8 -4 1.8 -1.8 4 -1.8 -4 -4 -1.8 4 -1.8 Z" opacity=".75"/>
    <path d="M90 48 l1.5 3.4 3.4 1.5 -3.4 1.5 -1.5 3.4 -1.5 -3.4 -3.4 -1.5 3.4 -1.5 Z" opacity=".55"/>
    <path d="M84 118 l1.5 3.4 3.4 1.5 -3.4 1.5 -1.5 3.4 -1.5 -3.4 -3.4 -1.5 3.4 -1.5 Z" opacity=".6"/>
    <path d="M34 104 l1.2 2.8 2.8 1.2 -2.8 1.2 -1.2 2.8 -1.2 -2.8 -2.8 -1.2 2.8 -1.2 Z" opacity=".45"/>
  </g>`,
  '0 0 120 200',
)

/**
 * Moon phase, k in [-1, 1]: -1 new, 0 first quarter, 1 full.
 * Right half of the disc plus an inner elliptical arc whose radius/sweep
 * carve the phase.
 */
export const moonSvg = (k: number): string => {
  const rx = Math.max(Math.abs(k) * 8, 0.01).toFixed(2)
  const sweep = k >= 0 ? 1 : 0
  return svg(
    `<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1" opacity=".5"/>
     <path d="M12 4 A8 8 0 0 1 12 20 A${rx} 8 0 0 ${sweep} 12 4 Z" fill="currentColor" stroke="none" opacity=".62"/>`,
    '0 0 24 24',
  )
}
