/**
 * SOURCE drawer backing data — every experiment's real files imported as
 * strings via Vite's `?raw` suffix, so the drawer always shows exactly the
 * code that is running. This module is dynamically imported on first use
 * (it inlines every file as a string) so the index bundle stays light.
 *
 * Also home to the regex token tinter — no highlighting deps, just four
 * token classes (comment / string / number / keyword) rendered as spans.
 */

import moltenTs from './experiments/molten.ts?raw'
import advectTs from './experiments/advect.ts?raw'
import phosphorTs from './experiments/phosphor.ts?raw'
import dawnTs from './experiments/dawn.ts?raw'
import signedTs from './experiments/signed.ts?raw'
import bokehTs from './experiments/bokeh.ts?raw'
import advectUpdateFrag from './shaders/advect-update.frag?raw'
import advectCompositeFrag from './shaders/advect-composite.frag?raw'
import phosphorCardFrag from './shaders/phosphor-card.frag?raw'
import phosphorCrtFrag from './shaders/phosphor-crt.frag?raw'
import dawnFrag from './shaders/dawn.frag?raw'
import signedFrag from './shaders/signed.frag?raw'
import bokehVert from './shaders/bokeh.vert?raw'
import bokehFrag from './shaders/bokeh.frag?raw'

export type SourceLang = 'ts' | 'glsl'

export interface SourceFile {
  /** Short tab label, e.g. "molten.ts". */
  name: string
  /** Repo-relative path — shown in the file header and COPY ALL separators. */
  path: string
  lang: SourceLang
  code: string
}

const file = (path: string, lang: SourceLang, code: string): SourceFile => ({
  name: path.slice(path.lastIndexOf('/') + 1),
  path,
  lang,
  code,
})

/**
 * Registry `no` → that experiment's source files, module first, shaders
 * after — the single place mapping entries to their raw sources.
 */
export const EXPERIMENT_SOURCES: Readonly<Record<string, readonly SourceFile[]>> = {
  '001': [file('src/playground/experiments/molten.ts', 'ts', moltenTs)],
  '002': [
    file('src/playground/experiments/advect.ts', 'ts', advectTs),
    file('src/playground/shaders/advect-update.frag', 'glsl', advectUpdateFrag),
    file('src/playground/shaders/advect-composite.frag', 'glsl', advectCompositeFrag),
  ],
  '003': [
    file('src/playground/experiments/phosphor.ts', 'ts', phosphorTs),
    file('src/playground/shaders/phosphor-card.frag', 'glsl', phosphorCardFrag),
    file('src/playground/shaders/phosphor-crt.frag', 'glsl', phosphorCrtFrag),
  ],
  '004': [
    file('src/playground/experiments/dawn.ts', 'ts', dawnTs),
    file('src/playground/shaders/dawn.frag', 'glsl', dawnFrag),
  ],
  '005': [
    file('src/playground/experiments/signed.ts', 'ts', signedTs),
    file('src/playground/shaders/signed.frag', 'glsl', signedFrag),
  ],
  '006': [
    file('src/playground/experiments/bokeh.ts', 'ts', bokehTs),
    file('src/playground/shaders/bokeh.vert', 'glsl', bokehVert),
    file('src/playground/shaders/bokeh.frag', 'glsl', bokehFrag),
  ],
}

/** Lines as an editor would count them (trailing newline ≠ extra line). */
export function countLines(code: string): number {
  if (code.length === 0) return 0
  return code.replace(/\n$/, '').split('\n').length
}

/**
 * Concatenate an experiment's files into one paste-ready block with `//`
 * separator comments (valid in both TS and GLSL).
 */
export function concatSources(label: string, files: readonly SourceFile[]): string {
  const rule = `// ${'='.repeat(74)}`
  const head = [
    rule,
    `// THE LAB — ${label} — combined source (${files.length} file${files.length === 1 ? '' : 's'})`,
    `// soubhikghosh — shader & rendering experiments`,
    rule,
  ].join('\n')
  const body = files
    .map((f) => `\n\n${rule}\n// FILE: ${f.path}\n${rule}\n\n${f.code.replace(/\s+$/, '')}`)
    .join('')
  return `${head}${body}\n`
}

// --- token tinting -----------------------------------------------------------

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
}

const escapeHtml = (s: string): string => s.replace(/[&<>]/g, (c) => ESCAPES[c] ?? c)

interface Tinter {
  re: RegExp
  /** CSS class suffix per capture group (1-based), aligned with `re`. */
  classes: readonly string[]
}

const join = (parts: readonly RegExp[], flags: string): RegExp =>
  new RegExp(parts.map((p) => p.source).join('|'), flags)

/** Groups: 1 comment · 2 string/template · 3 number · 4 keyword. */
const TS_TINTER: Tinter = {
  re: join(
    [
      /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)/,
      /(`(?:\\[\s\S]|[^\\`])*`|'(?:\\.|[^\\'\n])*'|"(?:\\.|[^\\"\n])*")/,
      /\b(0[xX][\dA-Fa-f_]+|\d[\d_]*(?:\.[\d_]+)?(?:[eE][+-]?\d+)?)\b/,
      /\b(abstract|as|async|await|break|case|catch|class|const|constructor|continue|debugger|default|delete|do|else|enum|export|extends|false|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|override|private|protected|public|readonly|return|satisfies|set|static|super|switch|this|throw|true|try|type|typeof|undefined|var|void|while|yield)\b/,
    ],
    'g',
  ),
  classes: ['c', 's', 'n', 'k'],
}

/** Groups: 1 comment · 2 preprocessor (string-tinted) · 3 number · 4 keyword/builtin. */
const GLSL_TINTER: Tinter = {
  re: join(
    [
      /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)/,
      /(^[ \t]*#[^\n]*)/,
      /\b(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+)\b/,
      /\b(attribute|bool|break|const|continue|discard|else|false|float|for|highp|if|in|inout|int|invariant|lowp|mat2|mat3|mat4|mediump|out|precision|return|sampler2D|samplerCube|struct|true|uniform|varying|vec2|vec3|vec4|ivec2|ivec3|ivec4|bvec2|bvec3|bvec4|void|while|gl_FragColor|gl_FragCoord|gl_PointCoord|gl_PointSize|gl_Position)\b/,
    ],
    'gm',
  ),
  classes: ['c', 's', 'n', 'k'],
}

/**
 * Escape + wrap tokens in `<span class="lab-tok-*">` — safe to assign to
 * innerHTML of the drawer's `<code>` element. Plain text between tokens is
 * escaped verbatim.
 */
export function tintSource(code: string, lang: SourceLang): string {
  const { re, classes } = lang === 'ts' ? TS_TINTER : GLSL_TINTER
  re.lastIndex = 0
  let html = ''
  let last = 0
  for (let m = re.exec(code); m !== null; m = re.exec(code)) {
    if (m[0].length === 0) {
      re.lastIndex++
      continue
    }
    html += escapeHtml(code.slice(last, m.index))
    let cls = 'k'
    for (let g = 0; g < classes.length; g++) {
      if (m[g + 1] !== undefined) {
        cls = classes[g] ?? 'k'
        break
      }
    }
    html += `<span class="lab-tok-${cls}">${escapeHtml(m[0])}</span>`
    last = m.index + m[0].length
  }
  return html + escapeHtml(code.slice(last))
}
