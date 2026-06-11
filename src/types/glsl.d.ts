/**
 * Shader file modules — handled by `vite-plugin-glsl`, which inlines the
 * file contents (after resolving `#include` chunks) as a string export.
 */

declare module '*.glsl' {
  const source: string
  export default source
}

declare module '*.vert' {
  const source: string
  export default source
}

declare module '*.frag' {
  const source: string
  export default source
}
