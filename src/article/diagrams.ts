/**
 * Hand-authored, animated SVG diagrams for the article page.
 *
 * Four diagrams (pipeline / sequence / refusal / eval) are defined as data —
 * nodes, orthogonal edges, particle spines — and rendered to inline SVG with
 * a clean engineering-drawing language: rounded rects and capsules, 1.5px
 * strokes on the article palette vars, JetBrains Mono labels, a dotted grid.
 *
 * Behaviour wired by `mountDiagrams`:
 *   - draw-on-scroll: an IntersectionObserver adds `.is-drawn`; edges draw
 *     via stroke-dashoffset (pathLength="1"), nodes fade/scale with stagger
 *     (pure CSS transitions, see styles.css);
 *   - flowing particles: <animateMotion> circles ride invisible spine paths,
 *     begun with beginElementAt() on reveal so staggers need no timers;
 *   - hover/focus: any node highlights itself + connected edges
 *     (data-conn) and writes a 1-line explanation into the figure's
 *     aria-live caption slot (each node is focusable, aria-describedby it);
 *   - reduced motion: svg[data-static] — everything fully drawn, particles
 *     hidden, captions still work.
 */

/* ---------------------------------------------------------------- types */

type Tone = 'default' | 'defense' | 'refuse' | 'accent'
type Anchor = 'start' | 'middle' | 'end'
type Pt = readonly [number, number]

interface DiagramNode {
  id: string
  x: number
  y: number
  w: number
  h: number
  shape?: 'rect' | 'capsule' | 'diamond'
  tone?: Tone
  /** First line renders at full size; subsequent lines smaller + muted. */
  lines: readonly string[]
  /** 1-line explanation shown in the caption slot on hover/focus. */
  info: string
}

interface DiagramEdge {
  /** Node ids this edge connects (for hover highlighting). */
  conn?: readonly string[]
  /** Orthogonal polyline; arrowhead lands on the final point. */
  pts: readonly Pt[]
  dashed?: boolean
  arrow?: boolean
  tone?: 'default' | 'refuse'
  /** Extra class, e.g. 'dg-lifeline' / 'dg-frame-line'. */
  cls?: string
  label?: string
  labelAt?: Pt
  labelAnchor?: Anchor
}

interface DiagramBox {
  x: number
  y: number
  w: number
  h: number
  label: string
}

interface DiagramText {
  x: number
  y: number
  text: string
  anchor?: Anchor
}

interface DiagramParticle {
  /** Index into `spines`. */
  spine: number
  dur: number
  /** Negative offset (s) staggers particles along the loop. */
  offset?: number
  /** Fade in/out at the loop seam instead of teleporting. */
  fade?: boolean
  /** The "rejected" particle: takes a refusal branch and dies visibly. */
  refuse?: boolean
  r?: number
}

interface DiagramDef {
  name: string
  /** aria-label for the <svg role="img">. */
  label: string
  width: number
  height: number
  nodes: readonly DiagramNode[]
  edges: readonly DiagramEdge[]
  boxes?: readonly DiagramBox[]
  texts?: readonly DiagramText[]
  /** Invisible paths the particles travel. */
  spines: readonly (readonly Pt[])[]
  particles: readonly DiagramParticle[]
}

/* -------------------------------------------------------------- helpers */

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function polyline(pts: readonly Pt[]): string {
  return pts
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`)
    .join(' ')
}

const LINE_H = 14
const ARROW_LEN = 7

function renderNode(node: DiagramNode, index: number, infoId: string): string {
  const { x, y, w, h } = node
  const shape = node.shape ?? 'rect'
  const tone = node.tone ?? 'default'

  let body: string
  if (shape === 'diamond') {
    const points = `${x},${y - h / 2} ${x + w / 2},${y} ${x},${y + h / 2} ${x - w / 2},${y}`
    body = `<polygon class="dg-shape" points="${points}"/>`
  } else {
    const rx = shape === 'capsule' ? h / 2 : 8
    body = `<rect class="dg-shape" x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="${rx}"/>`
  }

  const n = node.lines.length
  const firstY = y - ((n - 1) * LINE_H) / 2 + 3.8
  const text = node.lines
    .map((line, i) => {
      const cls = i === 0 ? 'dg-label' : 'dg-sub'
      return `<text class="${cls}" x="${x}" y="${firstY + i * LINE_H}" text-anchor="middle">${esc(line)}</text>`
    })
    .join('')

  return `<g class="dg-node dg-tone-${tone}" data-node="${esc(node.id)}" data-info="${esc(node.info)}" tabindex="0" aria-label="${esc(node.lines.join(' '))}" aria-describedby="${infoId}" style="--i:${index}">${body}${text}</g>`
}

function renderEdge(edge: DiagramEdge, index: number): string {
  const pts = edge.pts
  const last = pts[pts.length - 1]
  const prev = pts[pts.length - 2]
  if (!last || !prev) return ''

  const tone = edge.tone ?? 'default'
  const wantsArrow = edge.arrow !== false
  const dashed = edge.dashed === true

  // Pull the line back so the arrowhead tip sits exactly on the endpoint.
  const dx = last[0] - prev[0]
  const dy = last[1] - prev[1]
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const linePts: Pt[] = wantsArrow
    ? [...pts.slice(0, -1), [last[0] - ux * ARROW_LEN, last[1] - uy * ARROW_LEN] as Pt]
    : [...pts]

  const lineCls = dashed ? 'dg-line--dashed' : 'dg-line'
  const lineAttrs = dashed
    ? 'stroke-dasharray="5 4"'
    : 'pathLength="1"'
  const line = `<path class="${lineCls}" d="${polyline(linePts)}" ${lineAttrs}/>`

  let head = ''
  if (wantsArrow) {
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI
    head = `<path class="dg-head" d="M0 -3.6 L${ARROW_LEN + 1} 0 L0 3.6 Z" transform="translate(${last[0] - ux * ARROW_LEN} ${last[1] - uy * ARROW_LEN}) rotate(${angle.toFixed(2)})"/>`
  }

  let label = ''
  if (edge.label && edge.labelAt) {
    const [lx, ly] = edge.labelAt
    label = `<text class="dg-elabel" x="${lx}" y="${ly}" text-anchor="${edge.labelAnchor ?? 'middle'}">${esc(edge.label)}</text>`
  }

  const conn = edge.conn?.length ? ` data-conn="${esc(edge.conn.join(' '))}"` : ''
  const extra = edge.cls ? ` ${edge.cls}` : ''
  return `<g class="dg-edge dg-tone-${tone}${extra}"${conn} style="--i:${index}">${line}${head}${label}</g>`
}

function renderParticle(p: DiagramParticle, prefix: string): string {
  const dur = `${p.dur}s`
  const offset = p.offset ?? 0
  const cls = p.refuse ? 'dg-particle dg-particle--refuse' : 'dg-particle'
  const motion = `<animateMotion dur="${dur}" repeatCount="indefinite" begin="indefinite" data-offset="${offset}" rotate="0"><mpath href="#${prefix}-spine-${p.spine}"/></animateMotion>`
  let fade = ''
  if (p.refuse) {
    // The rejected particle: visible down the branch, dies before the loop seam.
    fade = `<animate attributeName="opacity" values="0;0.95;0.95;0;0" keyTimes="0;0.1;0.62;0.85;1" dur="${dur}" repeatCount="indefinite" begin="indefinite" data-offset="${offset}"/>`
  } else if (p.fade) {
    fade = `<animate attributeName="opacity" values="0;0.95;0.95;0" keyTimes="0;0.06;0.86;1" dur="${dur}" repeatCount="indefinite" begin="indefinite" data-offset="${offset}"/>`
  }
  const baseOpacity = p.fade || p.refuse ? '0' : '0.95'
  return `<circle class="${cls}" r="${p.r ?? 3}" opacity="${baseOpacity}">${motion}${fade}</circle>`
}

function renderDiagram(def: DiagramDef, infoId: string): string {
  const p = `dg-${def.name}`
  const grid = `
    <defs>
      <pattern id="${p}-grid" width="22" height="22" patternUnits="userSpaceOnUse">
        <circle class="dg-grid-dot" cx="1.2" cy="1.2" r="1.1"/>
      </pattern>
    </defs>
    <rect fill="url(#${p}-grid)" x="0" y="0" width="${def.width}" height="${def.height}"/>`

  const boxes = (def.boxes ?? [])
    .map(
      (b) => `<g class="dg-frame-group"><rect class="dg-frame" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="6"/><text class="dg-frame-label" x="${b.x + 10}" y="${b.y + 14}" text-anchor="start">${esc(b.label)}</text></g>`,
    )
    .join('')

  const texts = (def.texts ?? [])
    .map(
      (t) => `<text class="dg-elabel" x="${t.x}" y="${t.y}" text-anchor="${t.anchor ?? 'start'}">${esc(t.text)}</text>`,
    )
    .join('')

  const spines = def.spines
    .map((pts, i) => `<path id="${p}-spine-${i}" class="dg-spine" d="${polyline(pts)}"/>`)
    .join('')

  const edges = def.edges.map((e, i) => renderEdge(e, def.nodes.length + i)).join('')
  const nodes = def.nodes.map((n, i) => renderNode(n, i, infoId)).join('')
  const particles = def.particles.map((pt) => renderParticle(pt, p)).join('')

  return `<svg class="dg" viewBox="0 0 ${def.width} ${def.height}" role="img" aria-label="${esc(def.label)}" data-diagram-svg="${esc(def.name)}">${grid}${boxes}${spines}${edges}${nodes}${texts}${particles}</svg>`
}

/* ====================================================================== */
/* Diagram 1 — the full pipeline, defenses marked                          */
/* ====================================================================== */

const PIPELINE: DiagramDef = {
  name: 'pipeline',
  label:
    'Flowchart of the full RAG pipeline. Documents pass through structure-aware chunking into FAISS and BM25 indexes. A query hits both, results merge through reciprocal-rank fusion, a cross-encoder reranks them, a relevance gate either refuses or builds context, the LLM generates under a grounding contract, and a citation verifier checks the draft before a grounded answer ships.',
  width: 720,
  height: 800,
  nodes: [
    { id: 'doc', x: 265, y: 38, w: 170, h: 40, shape: 'capsule', lines: ['Documents'], info: 'The source corpus — 27,000+ banking documents: circulars, manuals, annexes.' },
    { id: 'query', x: 565, y: 38, w: 150, h: 40, shape: 'capsule', lines: ['User query'], info: 'A natural-language question from one of the five consuming systems.' },
    { id: 'chunk', x: 265, y: 112, w: 250, h: 52, tone: 'defense', lines: ['Structure-aware chunking', 'breadcrumbs + effective dates'], info: 'Defense 1 — split on structure, never through tables; prepend title and section breadcrumbs to every chunk.' },
    { id: 'faiss', x: 110, y: 200, w: 130, h: 52, lines: ['FAISS', 'dense vectors'], info: 'Semantic nearest-neighbour search — catches paraphrase, smears identifiers.' },
    { id: 'bm25', x: 420, y: 200, w: 130, h: 52, lines: ['BM25', 'sparse index'], info: 'Lexical match — exact clause numbers, product codes, circular ids.' },
    { id: 'rrf', x: 265, y: 286, w: 210, h: 40, lines: ['Reciprocal-rank fusion'], info: 'Merges dense and sparse lists by rank, not raw score. One constant; hard to break.' },
    { id: 'rerank', x: 265, y: 362, w: 230, h: 52, tone: 'defense', lines: ['Cross-encoder reranker', 'Cohere / BGE'], info: 'Defense 2 — reads query and candidate together; ~60 fused candidates cut to 6–8.' },
    { id: 'gate', x: 265, y: 448, w: 230, h: 72, shape: 'diamond', tone: 'defense', lines: ['Best score above', 'the floor?'], info: 'Defense 3 — the pre-generation gate: reranker confidence vs a per-tenant floor.' },
    { id: 'refuse', x: 575, y: 448, w: 180, h: 52, tone: 'refuse', lines: ['Refuse, with reasons'], info: 'Structured refusal — names the corpus searched and lists the closest near-misses.' },
    { id: 'ctx', x: 265, y: 532, w: 230, h: 52, lines: ['Context builder', '6–8 chunks, ids attached'], info: 'Numbered chunks carrying document ids, pages and effective dates for citation.' },
    { id: 'llm', x: 265, y: 612, w: 220, h: 52, tone: 'defense', lines: ['LLM under the', 'grounding contract'], info: 'Defense 4 — every claim must cite a chunk; refusing is spelled out as a correct answer.' },
    { id: 'verify', x: 265, y: 688, w: 200, h: 44, tone: 'defense', lines: ['Citation verifier'], info: 'Defense 5 — string discipline: citations must resolve, quoted numbers must be verbatim.' },
    { id: 'answer', x: 265, y: 760, w: 240, h: 48, tone: 'accent', lines: ['Grounded, cited answer'], info: 'Ships only after both gates pass — every claim links back to its source.' },
  ],
  edges: [
    { conn: ['doc', 'chunk'], pts: [[265, 58], [265, 86]] },
    { conn: ['chunk', 'faiss'], pts: [[200, 138], [200, 148], [110, 148], [110, 174]] },
    { conn: ['chunk', 'bm25'], pts: [[330, 138], [330, 148], [420, 148], [420, 174]] },
    { conn: ['query', 'bm25'], pts: [[540, 58], [540, 152], [452, 152], [452, 174]] },
    { conn: ['query', 'faiss'], pts: [[590, 58], [590, 160], [142, 160], [142, 174]] },
    { conn: ['faiss', 'rrf'], pts: [[110, 226], [110, 246], [220, 246], [220, 266]] },
    { conn: ['bm25', 'rrf'], pts: [[420, 226], [420, 246], [310, 246], [310, 266]] },
    { conn: ['rrf', 'rerank'], pts: [[265, 306], [265, 336]] },
    { conn: ['rerank', 'gate'], pts: [[265, 388], [265, 412]] },
    { conn: ['gate', 'refuse'], pts: [[380, 448], [485, 448]], tone: 'refuse', dashed: true, label: 'no', labelAt: [432, 440] },
    { conn: ['gate', 'ctx'], pts: [[265, 484], [265, 506]], label: 'yes', labelAt: [277, 499], labelAnchor: 'start' },
    { conn: ['ctx', 'llm'], pts: [[265, 558], [265, 586]] },
    { conn: ['llm', 'verify'], pts: [[265, 638], [265, 666]] },
    { conn: ['verify', 'refuse'], pts: [[365, 688], [575, 688], [575, 474]], tone: 'refuse', dashed: true, label: 'claims fail the check', labelAt: [470, 680] },
    { conn: ['verify', 'answer'], pts: [[265, 710], [265, 736]], label: 'claims hold', labelAt: [277, 727], labelAnchor: 'start' },
  ],
  spines: [
    [[265, 38], [265, 148], [110, 148], [110, 246], [265, 246], [265, 760]],
    [[565, 38], [565, 152], [452, 152], [452, 246], [310, 246], [310, 286]],
  ],
  particles: [
    { spine: 0, dur: 8, fade: true },
    { spine: 0, dur: 8, offset: -4, fade: true },
    { spine: 1, dur: 5, offset: -1.5, fade: true, r: 2.5 },
  ],
}

/* ====================================================================== */
/* Diagram 2 — one query, end to end (sequence)                            */
/* ====================================================================== */

const SEQUENCE: DiagramDef = {
  name: 'sequence',
  label:
    'Sequence diagram of one query. The RAG service fans out to BM25 and FAISS in parallel, fuses ranks, and sends candidates to the reranker. If the best score is below the floor it refuses with near-misses; otherwise it prompts the LLM with the contract and numbered chunks, verifies citations in the draft, and returns the grounded answer.',
  width: 760,
  height: 600,
  nodes: [
    { id: 'client', x: 70, y: 34, w: 96, h: 34, shape: 'capsule', lines: ['Client'], info: 'One of the five consuming applications calling RAG-as-a-Service.' },
    { id: 'svc', x: 215, y: 34, w: 120, h: 34, shape: 'capsule', tone: 'defense', lines: ['RAG service'], info: 'The platform orchestrator — fan-out, fusion, gating, verification.' },
    { id: 'bm25', x: 360, y: 34, w: 90, h: 34, shape: 'capsule', lines: ['BM25'], info: 'Sparse lexical index — returns the top-50 keyword candidates.' },
    { id: 'faiss', x: 470, y: 34, w: 90, h: 34, shape: 'capsule', lines: ['FAISS'], info: 'Dense vector index — returns the top-50 semantic candidates.' },
    { id: 'rerank', x: 580, y: 34, w: 104, h: 34, shape: 'capsule', tone: 'defense', lines: ['Reranker'], info: 'Cross-encoder scoring — its scores are what the refusal gate runs on.' },
    { id: 'llm', x: 690, y: 34, w: 90, h: 34, shape: 'capsule', lines: ['LLM'], info: 'Called only after the gate passes — it never sees a bare query.' },
  ],
  edges: [
    // lifelines
    { conn: ['client'], pts: [[70, 51], [70, 576]], dashed: true, arrow: false, cls: 'dg-lifeline' },
    { conn: ['svc'], pts: [[215, 51], [215, 576]], dashed: true, arrow: false, cls: 'dg-lifeline' },
    { conn: ['bm25'], pts: [[360, 51], [360, 576]], dashed: true, arrow: false, cls: 'dg-lifeline' },
    { conn: ['faiss'], pts: [[470, 51], [470, 576]], dashed: true, arrow: false, cls: 'dg-lifeline' },
    { conn: ['rerank'], pts: [[580, 51], [580, 576]], dashed: true, arrow: false, cls: 'dg-lifeline' },
    { conn: ['llm'], pts: [[690, 51], [690, 576]], dashed: true, arrow: false, cls: 'dg-lifeline' },
    // messages
    { conn: ['client', 'svc'], pts: [[70, 96], [215, 96]], label: 'question', labelAt: [142, 89] },
    { conn: ['svc', 'bm25'], pts: [[215, 140], [360, 140]], label: 'lexical top-50', labelAt: [287, 133] },
    { conn: ['svc', 'faiss'], pts: [[215, 162], [470, 162]], label: 'semantic top-50', labelAt: [342, 155] },
    { conn: ['bm25', 'svc'], pts: [[360, 190], [215, 190]], dashed: true, label: 'candidates', labelAt: [287, 183] },
    { conn: ['faiss', 'svc'], pts: [[470, 212], [215, 212]], dashed: true, label: 'candidates', labelAt: [342, 205] },
    // self: fuse
    { conn: ['svc'], pts: [[215, 246], [266, 246], [266, 266], [219, 266]], label: 'reciprocal-rank fusion', labelAt: [276, 260], labelAnchor: 'start' },
    { conn: ['svc', 'rerank'], pts: [[215, 294], [580, 294]], label: 'fused candidates', labelAt: [397, 287] },
    { conn: ['rerank', 'svc'], pts: [[580, 320], [215, 320]], dashed: true, label: 'scores · keep top 6–8', labelAt: [397, 313] },
    // alt branch 1: refusal
    { conn: ['svc', 'client'], pts: [[215, 392], [70, 392]], dashed: true, tone: 'refuse', label: 'refusal + near-misses', labelAt: [142, 385] },
    // divider
    { pts: [[40, 416], [730, 416]], dashed: true, arrow: false, cls: 'dg-frame-line' },
    // alt branch 2: grounded path
    { conn: ['svc', 'llm'], pts: [[215, 458], [690, 458]], label: 'contract + numbered chunks', labelAt: [452, 451] },
    { conn: ['llm', 'svc'], pts: [[690, 486], [215, 486]], dashed: true, label: 'draft answer + citations', labelAt: [452, 479] },
    { conn: ['svc'], pts: [[215, 508], [266, 508], [266, 528], [219, 528]], label: 'verify citations · quoted values', labelAt: [276, 522], labelAnchor: 'start' },
    { conn: ['svc', 'client'], pts: [[215, 552], [70, 552]], dashed: true, label: 'grounded answer · or refusal', labelAt: [142, 545] },
  ],
  boxes: [
    { x: 150, y: 118, w: 370, h: 108, label: 'par — fan-out' },
    { x: 40, y: 348, w: 690, h: 218, label: 'alt — refusal gate' },
  ],
  texts: [
    { x: 60, y: 376, text: '[ below the floor ]' },
    { x: 60, y: 436, text: '[ passes the gate ]' },
  ],
  spines: [
    [
      [70, 96], [215, 96], [215, 140], [360, 140], [360, 190], [215, 190],
      [215, 294], [580, 294], [580, 320], [215, 320],
      [215, 458], [690, 458], [690, 486], [215, 486], [215, 552], [70, 552],
    ],
  ],
  particles: [
    { spine: 0, dur: 12, fade: true },
    { spine: 0, dur: 12, offset: -6, fade: true },
  ],
}

/* ====================================================================== */
/* Diagram 3 — the refusal gates (rejected path visibly diverts)           */
/* ====================================================================== */

const REFUSAL: DiagramDef = {
  name: 'refusal',
  label:
    'Decision flowchart for refusal. Below the reranker floor the system refuses before generation and names the corpus with near-misses. After generation, claims without citations are stripped; if nothing substantive remains, or citations do not resolve, or quoted values are not verbatim, the system refuses. Otherwise the answer ships with clickable citations.',
  width: 760,
  height: 640,
  nodes: [
    { id: 'cand', x: 380, y: 36, w: 220, h: 40, shape: 'capsule', lines: ['Reranked candidates'], info: 'Six to eight chunks with cross-encoder scores — the evidence the gates judge.' },
    { id: 'g1', x: 380, y: 122, w: 250, h: 72, shape: 'diamond', tone: 'defense', lines: ['Best score above', 'the refusal floor?'], info: 'Gate one, before generation. The floor is a per-tenant product decision, in writing.' },
    { id: 'refb', x: 120, y: 122, w: 200, h: 64, tone: 'refuse', lines: ['Refuse before generation', 'name corpus · near-misses'], info: 'The cheapest, most trustworthy refusal — the LLM is never called.' },
    { id: 'gen', x: 380, y: 218, w: 240, h: 44, lines: ['Generate under the contract'], info: 'Numbered chunks plus the grounding contract; refusing stays a legal move.' },
    { id: 'g2', x: 380, y: 312, w: 260, h: 72, shape: 'diamond', tone: 'defense', lines: ['Every claim cites', 'a chunk?'], info: 'Draft parsing — each factual sentence must carry a [chunk:id] source.' },
    { id: 'strip', x: 630, y: 312, w: 200, h: 48, lines: ['Strip ungrounded claims'], info: 'Uncited sentences are removed rather than trusted.' },
    { id: 'g3', x: 630, y: 432, w: 210, h: 68, shape: 'diamond', lines: ['Anything substantive', 'left?'], info: 'If stripping gutted the answer, shipping the husk would mislead.' },
    { id: 'g4', x: 380, y: 432, w: 250, h: 76, shape: 'diamond', tone: 'defense', lines: ['Citations resolve?', 'Values verbatim?'], info: 'String checks — cited ids must exist in the context, numbers must match exactly.' },
    { id: 'refa', x: 120, y: 552, w: 200, h: 56, tone: 'refuse', lines: ['Refuse after generation'], info: 'The post-generation gate — better no answer than an unverifiable one.' },
    { id: 'ship', x: 380, y: 560, w: 240, h: 56, tone: 'accent', lines: ['Ship the answer', 'with clickable citations'], info: 'Every claim links to document and page — grounding a reviewer can audit.' },
  ],
  edges: [
    { conn: ['cand', 'g1'], pts: [[380, 56], [380, 86]] },
    { conn: ['g1', 'refb'], pts: [[255, 122], [220, 122]], tone: 'refuse', dashed: true, label: 'no', labelAt: [238, 114] },
    { conn: ['g1', 'gen'], pts: [[380, 158], [380, 196]], label: 'yes', labelAt: [392, 181], labelAnchor: 'start' },
    { conn: ['gen', 'g2'], pts: [[380, 240], [380, 276]] },
    { conn: ['g2', 'strip'], pts: [[510, 312], [530, 312]], label: 'no', labelAt: [519, 304] },
    { conn: ['g2', 'g4'], pts: [[380, 348], [380, 394]], label: 'yes', labelAt: [392, 374], labelAnchor: 'start' },
    { conn: ['strip', 'g3'], pts: [[630, 336], [630, 398]] },
    { conn: ['g3', 'g4'], pts: [[525, 432], [505, 432]], label: 'yes', labelAt: [515, 424] },
    { conn: ['g3', 'refa'], pts: [[630, 466], [630, 610], [120, 610], [120, 580]], tone: 'refuse', dashed: true, label: 'no', labelAt: [642, 488], labelAnchor: 'start' },
    { conn: ['g4', 'refa'], pts: [[255, 432], [120, 432], [120, 524]], tone: 'refuse', dashed: true, label: 'no', labelAt: [180, 424] },
    { conn: ['g4', 'ship'], pts: [[380, 470], [380, 532]], label: 'yes', labelAt: [392, 498], labelAnchor: 'start' },
  ],
  spines: [
    // happy path: straight down the spine, through every gate, into "ship"
    [[380, 30], [380, 578]],
    // rejected path: reaches gate one, visibly diverts left, dies in the refusal
    [[380, 30], [380, 122], [126, 122]],
  ],
  particles: [
    { spine: 0, dur: 6, fade: true },
    { spine: 0, dur: 6, offset: -3, fade: true },
    { spine: 1, dur: 5, offset: -1.2, refuse: true, r: 2.5 },
  ],
}

/* ====================================================================== */
/* Diagram 4 — the evaluation feedback loop                                */
/* ====================================================================== */

const EVAL: DiagramDef = {
  name: 'eval',
  label:
    'Flowchart of the evaluation loop. Golden sets and the refusal set feed a nightly eval run scoring recall at k, faithfulness, and refusal correctness. Regressions block the change and bisect back into the golden sets. Shipped changes serve production traffic, whose feedback APIs feed triage, which grows the golden sets.',
  width: 800,
  height: 330,
  nodes: [
    { id: 'gs', x: 105, y: 70, w: 160, h: 56, tone: 'defense', lines: ['Golden sets', '+ refusal set'], info: 'Per-corpus Q&A pairs with answering chunk ids — plus questions the corpus cannot answer.' },
    { id: 'ev', x: 285, y: 70, w: 150, h: 44, lines: ['Nightly eval run'], info: 'Every chunker, prompt, embedding or model change runs the full suite.' },
    { id: 'me', x: 480, y: 70, w: 190, h: 56, lines: ['recall@k · faithfulness', 'refusal correctness'], info: 'Three numbers — did retrieval surface it, is every claim entailed, does it refuse correctly both ways.' },
    { id: 'rg', x: 700, y: 70, w: 150, h: 64, shape: 'diamond', lines: ['Regression?'], info: 'Any faithfulness regression blocks the ship. No exceptions.' },
    { id: 'bl', x: 480, y: 178, w: 200, h: 44, tone: 'refuse', lines: ['Block the change · bisect'], info: 'The offending change is bisected; the failing case joins the golden set.' },
    { id: 'sh', x: 700, y: 178, w: 110, h: 40, tone: 'accent', lines: ['Ship'], info: 'Only changes that hold the line on all three metrics go out.' },
    { id: 'pr', x: 700, y: 268, w: 160, h: 44, lines: ['Production traffic'], info: 'Real questions from five systems — the eval set’s blind spots surface here.' },
    { id: 'fb', x: 470, y: 268, w: 210, h: 52, tone: 'defense', lines: ['Feedback APIs', 'answer / source / missing doc'], info: 'One-tap flags wired into every consuming UI.' },
    { id: 'tr', x: 250, y: 268, w: 130, h: 44, lines: ['Triage'], info: 'Flagged cases become eval cases — the loop’s only entry point.' },
  ],
  edges: [
    { conn: ['gs', 'ev'], pts: [[185, 70], [210, 70]] },
    { conn: ['ev', 'me'], pts: [[360, 70], [385, 70]] },
    { conn: ['me', 'rg'], pts: [[575, 70], [623, 70]] },
    { conn: ['rg', 'sh'], pts: [[700, 102], [700, 158]], label: 'no', labelAt: [712, 130], labelAnchor: 'start' },
    { conn: ['rg', 'bl'], pts: [[662, 86], [662, 178], [582, 178]], tone: 'refuse', dashed: true, label: 'yes', labelAt: [652, 130], labelAnchor: 'end' },
    { conn: ['bl', 'gs'], pts: [[380, 178], [70, 178], [70, 100]] },
    { conn: ['sh', 'pr'], pts: [[700, 198], [700, 246]] },
    { conn: ['pr', 'fb'], pts: [[620, 268], [577, 268]] },
    { conn: ['fb', 'tr'], pts: [[365, 268], [317, 268]] },
    { conn: ['tr', 'gs'], pts: [[185, 268], [140, 268], [140, 100]] },
  ],
  spines: [
    // a closed clockwise loop: sets → eval → metrics → gate → ship → prod → feedback → triage → sets
    [[105, 70], [700, 70], [700, 268], [140, 268], [140, 70], [105, 70]],
  ],
  particles: [
    { spine: 0, dur: 10 },
    { spine: 0, dur: 10, offset: -5 },
  ],
}

const DIAGRAMS: readonly DiagramDef[] = [PIPELINE, SEQUENCE, REFUSAL, EVAL]

/* ---------------------------------------------------------------- mount */

function beginParticles(svg: SVGSVGElement): void {
  const anims = svg.querySelectorAll<SVGAnimationElement>('animateMotion, animate')
  for (const anim of anims) {
    const offset = Number(anim.getAttribute('data-offset') ?? '0')
    try {
      anim.beginElementAt(offset)
    } catch {
      /* SMIL unavailable — particles simply stay hidden. */
    }
  }
}

function wireNodeInteractions(svg: SVGSVGElement, info: HTMLElement): void {
  const defaultInfo = info.textContent ?? ''

  for (const node of svg.querySelectorAll<SVGGElement>('.dg-node')) {
    const id = node.dataset.node
    if (!id) continue
    const related = svg.querySelectorAll<SVGGElement>(
      `.dg-edge[data-conn~="${CSS.escape(id)}"]`,
    )

    const hot = (): void => {
      node.classList.add('is-hot')
      for (const edge of related) edge.classList.add('is-hot')
      info.textContent = node.dataset.info ?? defaultInfo
      info.classList.add('is-active')
    }
    const cool = (): void => {
      node.classList.remove('is-hot')
      for (const edge of related) edge.classList.remove('is-hot')
      info.textContent = defaultInfo
      info.classList.remove('is-active')
    }

    node.addEventListener('mouseenter', hot)
    node.addEventListener('mouseleave', cool)
    node.addEventListener('focus', hot)
    node.addEventListener('blur', cool)
  }
}

function observeReveal(svg: SVGSVGElement): void {
  if (!('IntersectionObserver' in window)) {
    svg.classList.add('is-drawn')
    beginParticles(svg)
    return
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        io.disconnect()
        svg.classList.add('is-drawn')
        beginParticles(svg)
      }
    },
    { threshold: 0.15, rootMargin: '0px 0px -5% 0px' },
  )
  io.observe(svg)
}

/**
 * Render every `.art-diagram[data-diagram]` mount point under `root` and
 * wire reveal + particle + caption behaviour.
 */
export function mountDiagrams(root: HTMLElement): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  for (const host of root.querySelectorAll<HTMLElement>('.art-diagram[data-diagram]')) {
    const def = DIAGRAMS.find((d) => d.name === host.dataset.diagram)
    if (!def) {
      console.error(`[article] Unknown diagram "${host.dataset.diagram ?? ''}".`)
      continue
    }

    const infoId = `dg-info-${def.name}`
    host.innerHTML = renderDiagram(def, infoId)
    const svg = host.querySelector('svg')
    const info = document.getElementById(infoId)
    if (!svg || !info) continue

    wireNodeInteractions(svg, info)

    if (reduced) {
      // Fully drawn, static; particles hidden via [data-static] CSS.
      svg.setAttribute('data-static', '')
      svg.classList.add('is-drawn')
    } else {
      observeReveal(svg)
    }
  }
}
