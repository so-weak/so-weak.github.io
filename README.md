# Soubhik Ghosh — Portfolio

A multi-theme WebGL portfolio. Four completely different experiences — different layouts **and** different GL scenes — over one content model, switchable at runtime behind a shader transition.

**Stack:** Vite 6 · TypeScript (strict) · Three.js · Lenis · pmndrs/postprocessing · vite-plugin-glsl

## Scripts

```bash
npm run dev        # vite dev server (/, /playground.html)
npm run build      # tsc --noEmit && vite build
npm run typecheck  # tsc --noEmit
npm run preview    # serve the production build
```

Requires Node 22 (`nvm use 22`).

## Architecture

```
index.html             mount points ONLY — all DOM is built at runtime
└─ src/main.ts         boot: managers → global UI → ticker → initial theme

src/app/               the engine (theme-agnostic, singletons)
├─ Ticker.ts           THE only rAF loop; priority-ordered; dt clamped 50ms;
│                      pauses on hidden tab, resumes without a dt spike
├─ ScrollManager.ts    Lenis (autoRaf:false) driven by Ticker @ -10
├─ CursorManager.ts    raw/lerped/velocity/ndc pointer state @ -5; #cursor el
├─ Viewport.ts         size/dpr/isMobile/isTouch + prefers-reduced-motion
├─ ThemeManager.ts     owns the shared WebGLRenderer + theme lifecycle @ 0
└─ TransitionOverlay.ts fbm-noise dissolve wipe on its own GL context (z 150)

src/themes/            one folder per theme + the contract
├─ types.ts            THE THEME CONTRACT — read this first
├─ registry.ts         ThemeId → lazy import() (code-split per theme)
├─ stub.ts             shared phase-1 stub implementation (delete in phase 2)
└─ electroform/ editorial/ terminal/ aurora/
   ├─ index.ts         default-exports a ThemeFactory: () => Theme
   └─ styles.css       scoped to [data-theme='<id>'] — never leaks

src/content/           typed SiteContent (types.ts) + the data (data.ts)
src/ui/                global chrome: ThemeSwitcher (z 100), Preloader (z 300)
src/utils/math.ts      lerp / damp / clamp / mapRange / easings
src/styles/base.css    reset, tokens (z-layers, easings, type scale), a11y
src/playground/        second entry for prototyping scenes in isolation
```

### Layering

| z-index | element             | owner             |
| ------- | ------------------- | ----------------- |
| 0       | `#gl-canvas`        | ThemeManager (shared renderer) |
| 1       | `#theme-root`       | active theme DOM  |
| 100     | `#ui-global`        | ThemeSwitcher     |
| 150     | `#transition-canvas`| TransitionOverlay |
| 200     | `#cursor`           | CursorManager     |
| 300     | `#preloader`        | Preloader (boot only) |

### Frame order (Ticker priorities)

`-10` Lenis raf → `-5` cursor smoothing → `0` active theme `update()` → `100` transition overlay render.

## The theme contract

Defined verbatim in [`src/themes/types.ts`](src/themes/types.ts). The short version:

```ts
export interface Theme {
  readonly id: ThemeId
  readonly name: string
  init(ctx: ThemeContext): Promise<void> // build DOM + GL; resolve when paintable
  mount(): void                          // reveal: start intro animations
  unmount(): Promise<void>               // animate out fast (<= 500ms)
  dispose(): void                        // synchronously release EVERYTHING
  resize(width: number, height: number, dpr: number): void
  update(dt: number, elapsed: number): void // render your composer here
}
// each theme module default-exports: () => Theme
```

Rules that keep four themes from stepping on each other:

- **DOM** goes inside `ctx.root` and nowhere else. ThemeManager empties it after `dispose()`.
- **GL**: the renderer is shared. You own your `Scene`/`Camera`/`EffectComposer` and render in `update()`. **Never** call `renderer.setSize`/`setPixelRatio` — ThemeManager owns sizing (DPR capped 2 desktop / 1.5 mobile).
- **CSS** is scoped to `[data-theme='<id>']` (ThemeManager sets the attribute on `<html>` before `init()`).
- **Cleanup is non-negotiable**: every `ticker.add()`, `viewport.on()`, `scroll.on()` and `cursor.bind()` returns an unsubscribe — call them all in `dispose()`, then dispose geometries, materials, textures, render targets and composers.
- **Scroll feel** may be tuned via `scroll.configure()` in `init()`; defaults are restored on every switch.
- **Reduced motion**: `ctx.reducedMotion` is a snapshot; subscribe via `ctx.viewport.onReducedMotionChange()` for live changes. Honor it.

### Switch sequence (ThemeManager)

```
guard (switching || same id)
→ window 'sg:switching' {switching:true}            (switcher disables)
→ overlay.show()  ∥  active.unmount()               (in parallel)
→ active.dispose() → root emptied
→ scroll reset to defaults + scrollTo(0, immediate)
→ html[data-theme] + localStorage 'sg-theme' + ?theme= replaceState
→ lazy-load module (cached) → factory() → theme.init(ctx)
   └─ on error: log + fall back to a fresh instance of the previous theme
→ theme.resize(w, h, dpr) → theme.mount() → scroll.resize()
→ overlay.hide()
→ 'sg:switching' {switching:false} → focus #theme-root
```

## Adding a theme

1. Add the id to `ThemeId` in `src/themes/types.ts`.
2. Create `src/themes/<id>/index.ts` (default-export a `ThemeFactory`) and `styles.css` scoped to `[data-theme='<id>']`.
3. Register it in `src/themes/registry.ts`: `THEME_ORDER`, `THEME_META` (name, swatch, description) and `themeRegistry` (lazy import).
4. That's it — the switcher, keyboard shortcuts, persistence, and transition pick it up automatically.

## Content

All copy lives in `src/content/data.ts`, typed by `src/content/types.ts`. Themes render the same `SiteContent` — identity, stats, about (+ tarot-style hobby cards), experience, projects, skills, awards, certifications, education, writing stubs, contact. Edit the data once; all four themes update.

## Phase 2 (next)

- Replace each theme stub with its full experience (layout + GL scene + postprocessing).
- Build out `src/playground/` into a scene-prototyping harness.
- Delete `src/themes/stub.ts` once the last stub is gone.
