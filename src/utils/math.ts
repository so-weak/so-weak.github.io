/**
 * Math + easing helpers shared by managers, themes and shaders' CPU side.
 * All easings take a normalized t in [0, 1] and return a normalized value.
 */

/** Linear interpolation between `a` and `b` by factor `t`. */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/**
 * Framerate-independent exponential smoothing (Freya Holmér's `damp`).
 * Use instead of `lerp(a, b, 0.1)` inside ticker callbacks — identical feel
 * at 30, 60 or 144 fps. `lambda` ≈ responsiveness (higher = snappier).
 */
export const damp = (a: number, b: number, lambda: number, dt: number): number =>
  lerp(a, b, 1 - Math.exp(-lambda * dt))

/** Clamp `v` into [min, max]. */
export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v))

/** Map `v` from [inMin, inMax] to [outMin, outMax], optionally clamped. */
export const mapRange = (
  v: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
  clampOutput = false,
): number => {
  const t = (v - inMin) / (inMax - inMin)
  const out = outMin + (outMax - outMin) * t
  return clampOutput
    ? clamp(out, Math.min(outMin, outMax), Math.max(outMin, outMax))
    : out
}

/** Decelerating exponential — sharp start, long elegant tail. */
export const easeOutExpo = (t: number): number =>
  t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)

/** Symmetric cubic — the workhorse for UI transitions. */
export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

/** Overshooting ease — playful settle past the target then back. */
export const easeOutBack = (t: number): number => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}
