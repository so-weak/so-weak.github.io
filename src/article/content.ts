/**
 * Article: "Designing RAG that refuses to hallucinate".
 *
 * Pure content module — exports metadata and a render function that returns
 * the full inner HTML of the page (header, article, next-up teasers,
 * footer). No DOM access here; `main.ts` injects the markup and wires
 * diagrams, theming, and reveal behaviour.
 *
 * Diagrams are custom animated SVGs (see `diagrams.ts`). Each figure emits a
 * `.art-diagram[data-diagram]` mount point plus a fixed, aria-live caption
 * slot that hover/focus on diagram nodes writes into, and a figcaption for
 * sighted readers.
 */

import type { SiteContent } from '../content/types'

export const ARTICLE_META = {
  title: 'Designing RAG that refuses to hallucinate',
  publishedISO: '2026-06-11',
  publishedLabel: 'June 11, 2026',
  minutes: 8,
  author: 'Soubhik Ghosh',
} as const

/* ---------------------------------------------------------------- diagrams */

/**
 * Emits a mount point that `diagrams.ts` fills with a hand-authored animated
 * SVG. The `.art-diagram-info` slot is the fixed, aria-live caption that
 * hover/focus on diagram nodes writes into; it ships with a usage hint.
 */
function diagram(name: string, caption: string): string {
  return `
<figure class="art-figure">
  <div class="art-diagram-scroll">
    <div class="art-diagram" data-diagram="${name}"></div>
  </div>
  <p class="art-diagram-info" id="dg-info-${name}" aria-live="polite">Hover or focus a node to see its role.</p>
  <figcaption>${caption}</figcaption>
</figure>`
}

/* ------------------------------------------------------------------- body */

const BODY = `
<p class="art-lede">
  At HDFC Bank I built RAG-as-a-Service — one retrieval platform behind five
  production systems, including VerifyX, an audit assistant that answers
  questions over 27,000+ documents. Hallucinations fell 40–60% across every
  consumer of the platform. Not because we found a model that never lies,
  but because we stopped designing as if one existed.
</p>

<section aria-labelledby="h-why">
  <h2 id="h-why">Why RAG hallucinates</h2>
  <p>
    Retrieval-augmented generation was sold as the cure for hallucination:
    wire the model to your documents and it will stop inventing things. Then
    you ship the naive version — embed the corpus, take the top-k nearest
    chunks, paste them into a prompt — and watch it answer a question from a
    circular that was superseded eight months ago, fluently, with complete
    confidence.
  </p>
  <p>
    After five projects' worth of postmortems, nearly every hallucination we
    logged traced back to one of three causes.
  </p>
  <p>
    <strong>Retrieval misses.</strong> Dense embeddings are lossy summaries
    of meaning, and they are weakest exactly where banking documents live:
    clause numbers, product codes, regulatory identifiers, two circular
    references that differ by one token. To an embedding model those are
    near-identical; to an auditor the difference is the entire answer. And
    when retrieval misses, the pipeline does not stop — the model answers
    anyway, from its training priors, in the same confident register it uses
    when the context is good. The user cannot tell the difference. That
    asymmetry is the core problem.
  </p>
  <p>
    <strong>Context stuffing.</strong> The reflex fix is to retrieve more:
    raise top-k until the answer is probably in there somewhere. Now the
    model holds twenty chunks, fifteen irrelevant, the right one buried
    mid-context where attention is weakest. So it does what generative
    models do — it synthesizes across everything it was given. Fragments of
    an outdated policy and the current one merge into an answer that exists
    in no document at all. More context is not more grounding; past a point
    it is an invitation to blend.
  </p>
  <p>
    <strong>Ungrounded synthesis.</strong> "Answer using the context below"
    is a suggestion, not a contract. Nothing obliges each claim to come from
    a chunk, nothing permits the model to refuse, and nothing checks the
    draft afterwards. A model trained to be helpful will bridge the gap
    between your documents and the question with whatever it has.
  </p>
  <blockquote class="art-pull">
    <p>
      Retrieval failure is invisible at generation time. Design every layer
      as if the retriever just missed — because some fraction of the time,
      it did.
    </p>
  </blockquote>
</section>

<section aria-labelledby="h-arch">
  <h2 id="h-arch">The architecture that fights back</h2>
  <p>
    RAG-as-a-Service exists so that five teams did not each rediscover these
    failure modes on their own corpora. The pipeline reads as a sequence of
    defenses, each one assuming the previous layer occasionally failed.
  </p>
  ${diagram('pipeline', 'The pipeline. Accent-stroked nodes are the defense layers: chunking discipline, reranking, the relevance gate, the grounding contract, and citation verification.')}
  <h3>Hybrid retrieval</h3>
  <p>
    Every query runs through FAISS and BM25 in parallel. Dense retrieval
    handles paraphrase — "can I close this from overseas" matching a section
    that never uses the word overseas. Sparse retrieval catches exactly what
    dense smears: identifiers, codes, names. The two result lists merge with
    reciprocal-rank fusion, which works on ranks rather than scores — the
    raw scores of an ANN index and a lexical engine are not comparable, and
    every normalization scheme we tried was fragile. RRF has a single
    constant and is hard to break. On a platform consumed by teams who will
    never tune it, boring robustness is a feature.
  </p>
  <h3>Reranking is the quality gate</h3>
  <p>
    Bi-encoders compress query and document into vectors separately, so
    first-stage retrieval is coarse by construction. Stage two is a
    cross-encoder — Cohere's reranker where we could use it, a self-hosted
    BGE reranker for corpora that cannot leave the bank's infrastructure —
    reading query and candidate together and cutting roughly sixty fused
    candidates down to the six or eight that survive scrutiny. The reranker
    earns its latency twice over: it sharpens precision, and its scores are
    the signal the refusal path runs on. Retrieval scores tell you what is
    closest. The reranker tells you whether closest is any good.
  </p>
  ${diagram('sequence', 'One query, end to end. The refusal branch exits before the LLM is ever called.')}
  <h3>Chunking discipline</h3>
  <p>
    An unreasonable share of what got reported to us as "model problems"
    were chunking problems. The rules that ended up mattering: split on
    document structure and never through a table; keep chunk bodies around
    300 tokens; prepend every chunk's breadcrumb — document title, then
    section heading — into its text, because a paragraph that says "the
    limit is ₹50,000" is uninterpretable without knowing which product and
    which revision it belongs to; and carry document ids, page numbers, and
    effective dates as metadata for filtering and citation. It is boring
    work. It moved our metrics more than any model swap did.
  </p>
  <h3>The grounding contract</h3>
  <p>
    The prompt is written as a contract, not a vibe. An excerpt of the real
    shape:
  </p>
  <pre class="art-code"><code>GROUNDING CONTRACT (system prompt, excerpt)

1. Answer ONLY from the numbered context chunks below.
2. End every factual claim with its source: [chunk:id].
3. Quote amounts, dates, and clause numbers verbatim.
   Never paraphrase a number.
4. If the chunks do not contain the answer, reply exactly:
   "I could not find this in the indexed documents."
   Then list the closest sections you did find.
   Refusing is a correct answer. An unsourced guess is a defect.</code></pre>
  <p>
    The line that matters most is the last one. Instruction-tuned models are
    biased hard toward being helpful; unless the exit ramp is spelled out —
    and demonstrated in few-shot examples — the model treats an empty
    context as an invitation to improvise.
  </p>
  <h3>Refusal paths and citation verification</h3>
  <p>
    Refusal happens at two gates. Before generation: if the reranker's best
    score sits under the floor, the LLM is never called. The service returns
    a structured refusal with the closest near-misses, so the user can
    rephrase — or learn that the document genuinely is not indexed:
  </p>
  <pre class="art-code"><code>{
  "answer": null,
  "refusal": {
    "reason": "low_retrieval_confidence",
    "best_rerank_score": 0.21,
    "floor": 0.35,
    "near_misses": [
      { "doc": "ECCS-Operations-Manual-v4", "section": "7.2 Exception queues" },
      { "doc": "VKYC-Master-Circular-2025", "section": "Annex C" }
    ]
  }
}</code></pre>
  <p>
    The cheapest and most trustworthy refusal is the one issued before
    generation. After generation, the draft is parsed: claims without
    citations, citations to chunks that were never in the context, and
    "verbatim" numbers that do not actually appear in the cited chunk get
    the claim stripped or the answer rejected outright. Citation
    verification is mostly string discipline, not machine learning — which
    is exactly why it works every time.
  </p>
  ${diagram('refusal', 'The refusal path. Two gates: one before the model speaks, one after.')}
</section>

<section aria-labelledby="h-eval">
  <h2 id="h-eval">The evaluation loop</h2>
  <p>
    A claim like "40–60% fewer hallucinations" is meaningless without saying
    how it was measured. Each consuming project maintains a per-corpus
    golden set: questions, expected answers, and — most importantly — the
    ids of the chunks that contain each answer. Alongside it sits a refusal
    set: questions that look answerable but are not covered by the corpus.
    A system that never refuses scores perfectly until you test for that.
  </p>
  <p>
    Three numbers run nightly. <strong>Retrieval recall@k</strong> — did an
    answering chunk surface at all — because it cleanly separates retrieval
    failures from generation failures, and the two need different fixes.
    <strong>Faithfulness</strong> — claim level, every sentence of the
    answer must be entailed by its cited chunks — scored by an LLM judge
    whose verdicts get human-audited on a sample, because an unaudited judge
    drifts. <strong>Refusal correctness</strong> in both directions, since
    refusing answerable questions is also a bug; over-refusal kills adoption
    quietly while everyone congratulates themselves on safety.
  </p>
  <p>
    The serving layer closes the loop with feedback APIs — flag a wrong
    answer, a wrong source, a missing document — and flagged cases get
    triaged into the golden sets. No chunker change, embedding upgrade,
    prompt edit, or model swap ships past a faithfulness regression. The
    40–60% figure is the cumulative output of that loop across five
    projects, not the contribution of any single component. Hybrid retrieval
    and the contract were the big steps; the loop is what kept them from
    quietly regressing.
  </p>
  ${diagram('eval', 'The loop that produced the 40–60% number — and keeps it from decaying.')}
</section>

<section aria-labelledby="h-lessons">
  <h2 id="h-lessons">What banking taught me</h2>
  <p>
    <strong>Refusals built trust faster than answers.</strong> VerifyX was
    demoed live to the CEO and the Board. The moment that landed was not a
    correct answer — it was the system declining a question and naming the
    document set it did not have.
  </p>
  <blockquote class="art-pull">
    <p>
      Auditors did not start trusting the system because it was smart. They
      trusted it because it knew where its own knowledge ended.
    </p>
  </blockquote>
  <p>
    <strong>Thresholds are product decisions, not hyperparameters.</strong>
    The refusal floor encodes a risk posture. Audit teams tolerate refusals
    and not errors; an internal helpdesk wants the opposite trade. Same
    platform, per-tenant floors, owned by the consuming team — in writing.
  </p>
  <p>
    <strong>Stale truth is still a hallucination.</strong> An answer that
    was correct under last year's circular is operationally a fabrication
    today. Effective-date metadata and recency filters are grounding too;
    freshness belongs inside the contract, not in a backlog ticket.
  </p>
  <p>
    <strong>A citation you cannot click is not a citation.</strong> Every
    answer links to its document and page. If a reviewer cannot get from a
    claim to the exact paragraph in one step, the grounding does not count.
    During audit weeks, people click.
  </p>
  <p>
    <strong>Keep the model replaceable.</strong> The pipeline has outlived
    several model swaps without anything downstream changing, because none
    of the trust lives in the model. The LLM is the least controllable
    component in the stack — treat it as a brilliant, unreliable
    collaborator and build the controls around it.
  </p>
  <p>
    That is the whole philosophy. You do not get RAG to stop hallucinating
    by finding a model that never lies. You get there by building a system
    where lying is hard, getting caught is automatic, and "I don't know" is
    always an acceptable answer.
  </p>
</section>
`

/* ------------------------------------------------------------------ render */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Full inner HTML for #article-root. */
export function renderArticlePage(content: SiteContent): string {
  const teasers = content.writing
    .filter((entry) => entry.status === 'coming-soon')
    .map(
      (entry) => `
      <li class="art-next-card">
        <p class="art-next-status">Coming soon</p>
        <p class="art-next-title">${escapeHtml(entry.title)}</p>
        <p class="art-next-blurb">${escapeHtml(entry.blurb)}</p>
      </li>`,
    )
    .join('')

  return `
<header class="art-top">
  <nav aria-label="Article navigation">
    <a class="art-back" href="/"><span aria-hidden="true">&larr;</span> Back to portfolio</a>
  </nav>
  <p class="art-site">${escapeHtml(content.identity.name)} — Writing</p>
</header>

<main id="article-main" tabindex="-1">
  <article class="art-article">
    <header class="art-head">
      <p class="art-kicker">Field notes · Production AI</p>
      <h1>${escapeHtml(ARTICLE_META.title)}</h1>
      <p class="art-meta">
        <span>${escapeHtml(ARTICLE_META.author)}</span>
        <span aria-hidden="true">·</span>
        <time datetime="${ARTICLE_META.publishedISO}">${ARTICLE_META.publishedLabel}</time>
        <span aria-hidden="true">·</span>
        <span>${ARTICLE_META.minutes} min read</span>
      </p>
    </header>
    <div class="art-prose">${BODY}</div>
  </article>

  <aside class="art-next" aria-label="More writing">
    <h2>Next from this desk</h2>
    <ul class="art-next-list">${teasers}</ul>
  </aside>
</main>

<footer class="art-foot">
  <p>
    <a href="/">${escapeHtml(content.identity.name)}</a> · AI/ML engineer,
    ${escapeHtml(content.identity.location)} ·
    <a href="mailto:${escapeHtml(content.identity.email)}">${escapeHtml(content.identity.email)}</a>
  </p>
</footer>
`
}
