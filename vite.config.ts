import { defineConfig } from 'vite'
import glsl from 'vite-plugin-glsl'

/**
 * Vite configuration.
 *
 * - `vite-plugin-glsl` lets any module import `.glsl` / `.vert` / `.frag`
 *   files as plain strings (with `#include` chunk support).
 * - Three HTML entry points: the portfolio itself (`/`), a WebGL
 *   playground (`/playground.html`) used to prototype theme scenes
 *   in isolation, and the long-form writing page (`/article.html`).
 */
export default defineConfig({
  plugins: [glsl()],
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: new URL('./index.html', import.meta.url).pathname,
        playground: new URL('./playground.html', import.meta.url).pathname,
        article: new URL('./article.html', import.meta.url).pathname,
      },
    },
  },
})
