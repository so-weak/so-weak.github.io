/**
 * Editorial DOM — builds the whole printed-magazine issue from SiteContent.
 * Pure construction: no listeners, no measurements (index.ts wires those).
 *
 * Layout language: masthead → cover → marquee → about spread → features →
 * project index → type specimen → laurels → forthcoming → colophon. Every
 * block leans on rules, folios and numerals — annual-report typography.
 */

import type { SiteContent } from '../../content/types'

export interface EditorialDom {
  wrapper: HTMLElement
  masthead: HTMLElement
  /** The eight sections in scroll order (hero first). */
  sections: HTMLElement[]
  /** Masthead anchor links, one per content section (about → contact). */
  navLinks: HTMLAnchorElement[]
  folioPage: HTMLElement
  folioLabel: HTMLElement
  /** Cover headline — hosts the hold-to-flip katakana easter egg. */
  coverTitle: HTMLElement
  /** Per-marquee wrappers that take the scroll-velocity kick transform. */
  marqueeKicks: HTMLElement[]
  /** Colophon-receipt modal chrome (barcode easter egg). */
  receipt: HTMLElement
  receiptCard: HTMLElement
  receiptClose: HTMLButtonElement
}

export const SECTION_IDS = [
  'hero',
  'about',
  'experience',
  'projects',
  'skills',
  'awards',
  'writing',
  'contact',
] as const

/** Print folio per section — gaps imply unprinted ad pages, like a real issue. */
export const PAGE_NO: Readonly<Record<(typeof SECTION_IDS)[number], string>> = {
  hero: '01',
  about: '02',
  experience: '03',
  projects: '05',
  skills: '07',
  awards: '08',
  writing: '09',
  contact: '10',
}

export const FOLIO_LABELS: readonly string[] = [
  'COVER',
  'THE ENGINEER',
  'FEATURES',
  'THE INDEX',
  'SPECIMEN',
  'LAURELS',
  'ESSAYS',
  'COLOPHON',
]

const ESC: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ESC[c] ?? c)

const pad = (n: number): string => String(n).padStart(2, '0')

/** Katakana reading of the name — the JLPT N4 nod on the cover. */
const KANA_FIRST = 'ソウビク'
const KANA_LAST = 'ゴーシュ'

/**
 * A headline name as two stacked per-character layers: the latin letters
 * and a katakana overlay the theme cross-flips on hold / long hover.
 * Compact markup — stray whitespace would leak into the inline flow.
 */
function kanaName(text: string, kana: string): string {
  const chars = (s: string): string =>
    [...s]
      .map(
        (ch, i) =>
          `<span class="ed-name__ch" style="--ch:${i}">${esc(ch)}</span>`,
      )
      .join('')
  return (
    `<span class="ed-name">` +
    `<span class="ed-name__latin">${chars(text)}</span>` +
    `<span class="ed-name__kana" aria-hidden="true">${chars(kana)}</span>` +
    `</span>`
  )
}

export function buildEditorialDom(content: SiteContent): EditorialDom {
  const { identity } = content
  const city = identity.location.split(',')[0] ?? identity.location

  const wrapper = document.createElement('div')
  wrapper.className = 'ed'

  wrapper.innerHTML = `
    ${masthead(content, city)}
    <main class="ed-main">
      ${cover(content, city)}
      ${marquee(content, city)}
      ${about(content)}
      ${experience(content)}
      ${marquee(content, city)}
      ${projects(content)}
      ${skills(content)}
      ${awards(content)}
      ${writing(content)}
      ${marquee(content, city)}
      ${colophon(content)}
    </main>
    ${footer(content)}
    <div class="ed-folio-live" aria-hidden="true">
      <span class="ed-folio-live__page">P. 01</span>
      <span class="ed-folio-live__label">COVER</span>
    </div>
    ${receipt(content)}
    ${proof()}
  `

  const sections = SECTION_IDS.map((id) => {
    const el = wrapper.querySelector<HTMLElement>(`#${id}`)
    if (!el) throw new Error(`[editorial] missing section #${id}`)
    return el
  })

  const navLinks = SECTION_IDS.slice(1).map((id) => {
    const el = wrapper.querySelector<HTMLAnchorElement>(
      `.ed-masthead__nav a[href="#${id}"]`,
    )
    if (!el) throw new Error(`[editorial] missing nav link #${id}`)
    return el
  })

  const mastheadEl = wrapper.querySelector<HTMLElement>('.ed-masthead')
  const folioPage = wrapper.querySelector<HTMLElement>('.ed-folio-live__page')
  const folioLabel = wrapper.querySelector<HTMLElement>('.ed-folio-live__label')
  const coverTitle = wrapper.querySelector<HTMLElement>('.ed-cover__title')
  const receiptEl = wrapper.querySelector<HTMLElement>('.ed-receipt')
  const receiptCard = wrapper.querySelector<HTMLElement>('.ed-receipt__card')
  const receiptClose = wrapper.querySelector<HTMLButtonElement>('.ed-receipt__close')
  if (
    !mastheadEl ||
    !folioPage ||
    !folioLabel ||
    !coverTitle ||
    !receiptEl ||
    !receiptCard ||
    !receiptClose
  ) {
    throw new Error('[editorial] missing chrome elements')
  }

  const marqueeKicks = Array.from(
    wrapper.querySelectorAll<HTMLElement>('.ed-marquee__kick'),
  )

  return {
    wrapper,
    masthead: mastheadEl,
    sections,
    navLinks,
    folioPage,
    folioLabel,
    coverTitle,
    marqueeKicks,
    receipt: receiptEl,
    receiptCard,
    receiptClose,
  }
}

/* --- masthead ------------------------------------------------------------- */

function masthead(content: SiteContent, city: string): string {
  const links = content.sections
    .map(
      (s) =>
        `<li><a href="#${s.id}" data-nav>${esc(s.label)}</a></li>`,
    )
    .join('')

  return `
    <header class="ed-masthead">
      <a class="ed-masthead__mark" href="#hero" data-nav aria-label="${esc(content.identity.name)} — back to cover">
        ${esc(content.identity.name).toUpperCase()}<span class="ed-verm" aria-hidden="true">.</span>
      </a>
      <nav class="ed-masthead__nav" aria-label="Sections">
        <ul>
          ${links}
          <li><a class="ed-masthead__lab" href="/playground.html">Lab<span aria-hidden="true"> ↗</span></a></li>
        </ul>
      </nav>
      <div class="ed-masthead__issue">
        <span>VOL. 04 — ${esc(city).toUpperCase()}</span>
        <span>THE PRODUCTION AI ISSUE</span>
      </div>
    </header>
  `
}

/* --- cover ------------------------------------------------------------------ */

function cover(content: SiteContent, city: string): string {
  const { identity, sections, stats } = content

  const toc = sections
    .map(
      (s, i) => `
        <li style="--i:${i}">
          <a href="#${s.id}" data-nav>
            <span class="ed-toc__no">${pad(i + 1)}</span>
            <span class="ed-toc__label">${esc(s.label)}</span>
            <span class="ed-toc__leader" aria-hidden="true"></span>
            <span class="ed-toc__page">${PAGE_NO[SECTION_IDS[i + 1] ?? 'contact']}</span>
          </a>
        </li>`,
    )
    .join('')

  const statItems = stats
    .map(
      (s, i) => `
        <li class="ed-cover__stat" style="--i:${i}">
          <span class="ed-cover__statvalue">${esc(s.value)}</span>
          <span class="ed-cover__statlabel">${esc(s.label)}</span>
        </li>`,
    )
    .join('')

  return `
    <section id="hero" class="ed-cover" aria-label="Cover">
      <p class="ed-cover__kicker ed-reveal">
        <span class="ed-kickerbar" aria-hidden="true"></span>
        THE PRODUCTION AI ISSUE&ensp;·&ensp;${esc(identity.role).toUpperCase()}
      </p>

      <h1 class="ed-cover__title ed-lines" aria-label="${esc(identity.firstName)} ${esc(identity.lastName)}">
        <span class="ed-line" aria-hidden="true"><span class="ed-line__in" style="--i:0">${kanaName(identity.firstName.toUpperCase(), KANA_FIRST)}</span></span>
        <span class="ed-line ed-line--italic" aria-hidden="true"><span class="ed-line__in" style="--i:1">${kanaName(identity.lastName, KANA_LAST)}<span class="ed-verm ed-cover__star"> ✦</span></span></span>
      </h1>

      <div class="ed-cover__deckwrap ed-reveal" style="--i:2">
        <p class="ed-cover__deck">${esc(identity.tagline)}</p>
        <p class="ed-cover__byline">
          Filed from ${esc(city)} by <a href="${esc(identity.github)}" target="_blank" rel="noopener noreferrer">@${esc(identity.handle)}</a>
          &ensp;—&ensp;est. 2021, still in print.
        </p>
      </div>

      <aside class="ed-toc ed-reveal" style="--i:1" aria-label="Contents">
        <h2 class="ed-toc__head">In this issue</h2>
        <ol>${toc}</ol>
        <button class="ed-barcode" type="button" data-receipt-open aria-haspopup="dialog" aria-label="Scan the barcode — print the colophon receipt">
          <span class="ed-barcode__bars" aria-hidden="true"></span>
          <span class="ed-barcode__text" aria-hidden="true">ISSN 2199-0042 · VOL. 04 · ₹0</span>
        </button>
      </aside>

      <span class="ed-ding ed-ding--cover" data-speed="0.72" aria-hidden="true">✦</span>

      <div class="ed-cover__stats ed-reveal" style="--i:3">
        <span class="ed-cover__statshead">In numbers&thinsp;—</span>
        <ul class="ed-cover__statlist" aria-label="Key figures">
          ${statItems}
        </ul>
      </div>
    </section>
  `
}

/* --- marquee ------------------------------------------------------------------ */

function marquee(content: SiteContent, city: string): string {
  const bits = [
    content.identity.role.toUpperCase(),
    city.toUpperCase(),
    'EST. 2021',
    'VOL. 04',
    'PRODUCTION-GRADE',
    'SHIPS DAILY',
  ]
  const line = bits.map((b) => `${esc(b)}&ensp;✦&ensp;`).join('')
  const half = `<span>${line.repeat(3)}</span>`
  return `
    <div class="ed-marquee" aria-hidden="true">
      <div class="ed-marquee__kick">
        <div class="ed-marquee__track">${half}${half}</div>
      </div>
    </div>
  `
}

/* --- section heading ------------------------------------------------------------ */

function sechead(
  no: number,
  id: (typeof SECTION_IDS)[number],
  label: string,
  sub: string,
): string {
  return `
    <header class="ed-sechead ed-reveal ed-reveal--fade ed-lines">
      <span class="ed-sechead__no" data-speed="1.06">№ ${pad(no)}</span>
      <h2 class="ed-sechead__title"><span class="ed-line ed-line--clip"><span class="ed-line__in" style="--i:0">${label}<em class="ed-sechead__sub">${sub}</em></span></span></h2>
      <span class="ed-sechead__folio">P. ${PAGE_NO[id]}</span>
    </header>
  `
}

/* --- about ------------------------------------------------------------------------ */

function about(content: SiteContent): string {
  const { identity } = content
  const paragraphs = content.about.paragraphs
    .map((p, i) => {
      if (i === 0 && p.length > 0) {
        // Real element instead of ::first-letter — the drop cap settles in
        // with a tiny rotation, which pseudo-elements cannot animate.
        return `<p class="ed-dropcap" style="--i:0"><span class="ed-dropcap__cap">${esc(p.charAt(0))}</span>${esc(p.slice(1))}</p>`
      }
      return `<p style="--i:${i}">${esc(p)}</p>`
    })
    .join('')

  const ads = content.about.hobbies
    .map(
      (h, i) => `
        <article class="ed-ad" style="--i:${i}">
          <header class="ed-ad__head">
            <span class="ed-ad__no">${esc(h.numeral)}</span>
            <h4 class="ed-ad__arcana">${esc(h.arcana).toUpperCase()}</h4>
          </header>
          <p class="ed-ad__title">${esc(h.title)}</p>
          <p class="ed-ad__desc">${esc(h.description)}</p>
        </article>`,
    )
    .join('')

  // Hidden classified — redacted bars lift on hover/focus (easter egg).
  const hiddenAd = `
    <article class="ed-ad ed-ad--hidden" style="--i:${content.about.hobbies.length}" tabindex="0">
      <header class="ed-ad__head">
        <span class="ed-ad__no">V</span>
        <h4 class="ed-ad__arcana">CLASSIFIED — REDACTED</h4>
      </header>
      <p class="ed-ad__title"><span class="ed-redact">Seeking —</span></p>
      <p class="ed-ad__desc"><span class="ed-redact">fellow polyglots, string-benders &amp; seers.</span> <span class="ed-redact">Apply within: <a href="mailto:${esc(identity.email)}">${esc(identity.email)}</a></span></p>
    </article>`

  return `
    <section id="about" class="ed-section ed-about" aria-label="About">
      ${sechead(1, 'about', 'About', 'profile of a practitioner')}
      <span class="ed-floatrule ed-floatrule--a" data-speed="0.78" aria-hidden="true"></span>
      <span class="ed-floatrule ed-floatrule--b ed-floatrule--ink" data-speed="1.22" aria-hidden="true"></span>
      <div class="ed-about__spread">
        <div class="ed-about__body ed-reveal" data-cursor="read">
          ${paragraphs}
        </div>
        <div class="ed-about__rail">
          <!-- Parallax (data-speed) lives on plain wrappers: the per-frame
               transform must not share an element with the transitioned
               .ed-reveal transform, or both choreographies break. -->
          <div data-speed="0.86">
            <figure class="ed-figure ed-reveal">
              <div class="ed-figure__frame">
                <img src="/images/avatars/editorial.png" alt="Portrait of ${esc(identity.name)}" loading="lazy" width="640" height="800" />
              </div>
              <figcaption>FIG. 01 — The engineer, ${esc(identity.location)}.</figcaption>
            </figure>
          </div>
          <div data-speed="1.07">
            <aside class="ed-classifieds ed-reveal" aria-label="Classified advertisements — pursuits">
              <h3 class="ed-classifieds__head">Classifieds — pursuits &amp; practices</h3>
              ${ads}
              ${hiddenAd}
            </aside>
          </div>
        </div>
      </div>
    </section>
  `
}

/* --- experience -------------------------------------------------------------------- */

function experience(content: SiteContent): string {
  const features = content.experience
    .map((e, i) => {
      const pulls = e.highlights
        .map(
          // Alternating drift rates on plain wrappers — the quotes breathe
          // against each other as the reader scrolls.
          (h, j) => `
            <div class="ed-pullwrap" data-speed="${j % 2 === 0 ? '0.95' : '1.06'}">
              <blockquote class="ed-pull ed-reveal" style="--i:${j}">
                <span class="ed-pull__mark" aria-hidden="true">✦</span>
                <p>${esc(h)}</p>
              </blockquote>
            </div>`,
        )
        .join('')

      const filed = e.projects?.length
        ? `
          <div class="ed-filedwrap ed-reveal">
            <h4 class="ed-filed__head">
              Filed under № ${pad(i + 1)} — ${e.projects.length} dossiers
              ${e.redactionNote ? `<span class="ed-filed__embargo" aria-hidden="true">Withheld — under embargo</span>` : ''}
            </h4>
            <ol class="ed-filed">
              ${e.projects
                .map(
                  (p, j) =>
                    p.redacted
                      ? `
                    <li style="--i:${j}">
                      <span class="ed-filed__no">${pad(j + 1)}</span>
                      <div role="group" aria-label="${esc(p.name)} — technical details withheld under banking confidentiality">
                        <span class="ed-filed__name">${esc(p.name)}</span>
                        <span class="ed-filed__tag">${esc(p.tag).toUpperCase()}</span>
                        <p class="ed-filed__note ed-filed__note--redacted">
                          <span class="ed-redact ed-redact--sealed" aria-hidden="true">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
                        </p>
                        <p class="ed-filed__stack ed-filed__stack--redacted">
                          <span class="ed-redact ed-redact--sealed" aria-hidden="true">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
                          <span class="ed-sronly">Technical details withheld under banking confidentiality.</span>
                        </p>
                      </div>
                    </li>`
                      : `
                    <li style="--i:${j}">
                      <span class="ed-filed__no">${pad(j + 1)}</span>
                      <div>
                        <span class="ed-filed__name">${esc(p.name)}</span>
                        <span class="ed-filed__tag">${esc(p.tag).toUpperCase()}</span>
                        <p class="ed-filed__note">${esc(p.points[0] ?? '')}</p>
                        <p class="ed-filed__stack">${p.stack.map(esc).join(' · ')}</p>
                      </div>
                    </li>`,
                )
                .join('')}
            </ol>
            ${e.redactionNote ? `<p class="ed-filed__footnote">† ${esc(e.redactionNote)} The titles run; the particulars are spiked.</p>` : ''}
          </div>`
        : ''

      return `
        <article class="ed-feature" data-cursor="read">
          <span class="ed-feature__ghost" data-speed="0.78" aria-hidden="true">${pad(i + 1)}</span>
          <header class="ed-feature__head ed-reveal ed-reveal--fade ed-lines">
            <p class="ed-feature__kicker">FEATURE № ${pad(i + 1)}&ensp;·&ensp;${esc(e.period).toUpperCase()}</p>
            <h3 class="ed-feature__title"><span class="ed-line ed-line--clip"><span class="ed-line__in" style="--i:1">${esc(e.company)}</span></span></h3>
          </header>
          <aside class="ed-feature__meta ed-reveal">
            <dl>
              <div><dt>Role</dt><dd>${esc(e.role)}</dd></div>
              <div><dt>Period</dt><dd>${esc(e.period)}</dd></div>
              <div><dt>Location</dt><dd>${esc(e.location)}</dd></div>
            </dl>
            <p class="ed-feature__summary">${esc(e.summary)}</p>
          </aside>
          <div class="ed-feature__body">
            ${pulls}
            ${filed}
          </div>
        </article>
      `
    })
    .join('')

  return `
    <section id="experience" class="ed-section ed-experience" aria-label="Experience">
      ${sechead(2, 'experience', 'Experience', 'three features, five years')}
      <span class="ed-floatrule ed-floatrule--c" data-speed="1.24" aria-hidden="true"></span>
      ${features}
    </section>
  `
}

/* --- projects ------------------------------------------------------------------------- */

function projects(content: SiteContent): string {
  const open = content.projects.filter((p) => p.kind === 'open-source')
  const platform = content.projects.filter((p) => p.kind !== 'open-source')

  const feats = open
    .map((p, i) => {
      const links = (p.links ?? [])
        .map(
          (l) =>
            `<a class="ed-link-verm" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)}<span aria-hidden="true"> ↗</span></a>`,
        )
        .join('')
      const metrics = (p.metrics ?? [])
        .map(
          (m) =>
            `<span class="ed-metric"><b>${esc(m.value)}</b> ${esc(m.label)}</span>`,
        )
        .join('')
      return `
        <article class="ed-projfeat ed-reveal ed-lines" data-cursor="read" style="--i:${i}">
          <p class="ed-projfeat__kicker">OPEN SOURCE — DISPATCH № ${pad(i + 1)}</p>
          <h3 class="ed-projfeat__name"><span class="ed-line ed-line--clip"><span class="ed-line__in"><em>${esc(p.name)}</em></span></span></h3>
          <p class="ed-projfeat__tagline">${esc(p.tagline)}</p>
          <p class="ed-projfeat__desc">${esc(p.description)}</p>
          <ul class="ed-projfeat__points">
            ${p.points.map((pt) => `<li>${esc(pt)}</li>`).join('')}
          </ul>
          <p class="ed-projfeat__stack">${p.stack.map(esc).join(' · ')}</p>
          <div class="ed-projfeat__foot">${links}${metrics}</div>
        </article>
      `
    })
    .join('')

  const rows = platform
    .map((p, i) => {
      const metrics = (p.metrics ?? [])
        .map(
          (m) =>
            `<span class="ed-metric"><b>${esc(m.value)}</b> ${esc(m.label)}</span>`,
        )
        .join('')
      return `
        <li class="ed-row ed-reveal" style="--i:${i}">
          <button class="ed-row__head" data-expand aria-expanded="false" aria-controls="ed-proj-${i}">
            <span class="ed-row__no">${pad(i + open.length + 1)}</span>
            <span class="ed-row__name">${esc(p.name)}</span>
            <span class="ed-row__tagline">${esc(p.tagline)}</span>
            <span class="ed-row__stack">${p.stack.slice(0, 3).map(esc).join(' · ')}</span>
            <span class="ed-row__kind">${p.featured ? 'FEATURE' : 'BRIEF'}</span>
            <span class="ed-row__plus" aria-hidden="true">+</span>
          </button>
          <div class="ed-row__panel" id="ed-proj-${i}">
            <div class="ed-row__panelin">
              <p class="ed-row__desc">${esc(p.description)}</p>
              <ul class="ed-row__points">
                ${p.points.map((pt) => `<li>${esc(pt)}</li>`).join('')}
              </ul>
              <p class="ed-row__fullstack">${p.stack.map(esc).join(' · ')}</p>
              ${metrics ? `<div class="ed-row__metrics">${metrics}</div>` : ''}
            </div>
          </div>
        </li>
      `
    })
    .join('')

  return `
    <section id="projects" class="ed-section ed-projects" aria-label="Projects">
      ${sechead(3, 'projects', 'Projects', 'an index of shipped things')}
      <span class="ed-floatrule ed-floatrule--d" data-speed="0.8" aria-hidden="true"></span>
      <div class="ed-projfeats">${feats}</div>
      <div class="ed-index ed-reveal">
        <div class="ed-index__head" aria-hidden="true">
          <span>NO.</span><span>PROJECT</span><span>TAGLINE</span><span>STACK</span><span>KIND</span><span></span>
        </div>
        <ol class="ed-index__list">${rows}</ol>
      </div>
    </section>
  `
}

/* --- skills ---------------------------------------------------------------------------- */

const SPECIMEN_CAPTIONS = [
  'FRAUNCES — BLACK ROMAN, OPSZ 144',
  'FRAUNCES — LIGHT ITALIC, SOFT 100',
  'HANKEN GROTESK — BOLD CAPS',
  'FRAUNCES — SEMIBOLD, WONK 1',
  'HANKEN GROTESK — REGULAR, TRACKED',
] as const

function skills(content: SiteContent): string {
  const lines = content.skills
    .map((g, i) => {
      const style = i % SPECIMEN_CAPTIONS.length
      const text = g.items
        .map(esc)
        .join('<span class="ed-specimen__sep" aria-hidden="true"> · </span>')
      return `
        <div class="ed-specimen ed-reveal" data-style="${style}" style="--i:${i}">
          <div class="ed-specimen__label">
            <h3>${esc(g.group)}</h3>
            <span>${g.items.length} ENTRIES — ${SPECIMEN_CAPTIONS[style] ?? ''}</span>
          </div>
          <p class="ed-specimen__line">${text}</p>
        </div>`
    })
    .join('')

  return `
    <section id="skills" class="ed-section ed-skills" aria-label="Skills">
      ${sechead(4, 'skills', 'Skills', 'a working type specimen')}
      ${lines}
    </section>
  `
}

/* --- awards ------------------------------------------------------------------------------ */

function awards(content: SiteContent): string {
  const laurels = content.awards
    .map(
      (a, i) => `
        <li class="ed-laurel" style="--i:${i}">
          <span class="ed-laurel__mark" aria-hidden="true">✦</span>
          <p>${esc(a)}</p>
        </li>`,
    )
    .join('')

  const certs = content.certifications
    .map((c) => `<li>${esc(c)}</li>`)
    .join('')

  const edu = content.education
    .map(
      (e) => `
        <li>
          <b>${esc(e.school)}</b>
          <span>${esc(e.degree)} — ${esc(e.detail)}</span>
          <span class="ed-eduperiod">${esc(e.period)}</span>
        </li>`,
    )
    .join('')

  return `
    <section id="awards" class="ed-section ed-awards" aria-label="Awards">
      ${sechead(5, 'awards', 'Awards', 'laurels, duly footnoted')}
      <div class="ed-awards__spread">
        <ol class="ed-laurels ed-reveal" data-cursor="read">${laurels}</ol>
        <aside class="ed-awards__rail ed-reveal">
          <h3>Further distinctions</h3>
          <ul class="ed-certs">${certs}</ul>
          <h3>Schooling</h3>
          <ul class="ed-edu">${edu}</ul>
        </aside>
      </div>
      <span class="ed-ding ed-ding--awards" data-speed="1.18" aria-hidden="true">✦</span>
    </section>
  `
}

/* --- writing ------------------------------------------------------------------------------- */

function writing(content: SiteContent): string {
  const teasers = content.writing
    .map((w, i) => {
      const published = w.status === 'published' && Boolean(w.url)
      const stamp = published
        ? '<span class="ed-teaser__stamp ed-teaser__stamp--pub" aria-hidden="true">IN PRINT</span>'
        : '<span class="ed-teaser__stamp" aria-hidden="true">COMING SOON</span>'
      const read = published
        ? `<a class="ed-teaser__read" href="${esc(w.url ?? '')}">Read the essay<span aria-hidden="true"> →</span></a>`
        : ''
      const folio = published
        ? `P. ${PAGE_NO.writing}${w.minutes ? ` — ${w.minutes} MIN READ` : ''}`
        : 'DRAFT — UNPAGINATED'
      return `
        <article class="ed-teaser ed-reveal${published ? ' ed-teaser--pub' : ''}" data-cursor="read" style="--i:${i}">
          <span class="ed-teaser__no">${pad(i + 1)}</span>
          <h3 class="ed-teaser__title">${esc(w.title)}</h3>
          <p class="ed-teaser__blurb">${esc(w.blurb)}</p>
          ${read}
          ${stamp}
          <span class="ed-teaser__folio">${folio}</span>
        </article>`
    })
    .join('')

  return `
    <section id="writing" class="ed-section ed-writing" aria-label="Writing">
      ${sechead(6, 'writing', 'Writing', 'in print & forthcoming')}
      <span class="ed-floatrule ed-floatrule--e" data-speed="1.18" aria-hidden="true"></span>
      <div class="ed-teasers">${teasers}</div>
    </section>
  `
}

/* --- colophon -------------------------------------------------------------------------------- */

function colophon(content: SiteContent): string {
  const { identity, contact } = content
  return `
    <section id="contact" class="ed-section ed-colophon" aria-label="Contact">
      ${sechead(7, 'contact', 'Contact', 'colophon & correspondence')}
      <p class="ed-colophon__heading ed-reveal">${esc(contact.heading)}</p>
      <a class="ed-colophon__email ed-lines" href="mailto:${esc(identity.email)}">
        <span class="ed-line"><span class="ed-line__in">${esc(identity.email)}</span></span>
      </a>
      <p class="ed-colophon__blurb ed-reveal">${esc(contact.blurb)}</p>
      <div class="ed-colophon__actions ed-reveal">
        <a class="ed-link-verm" href="${esc(identity.github)}" target="_blank" rel="noopener noreferrer">GitHub<span aria-hidden="true"> ↗</span></a>
        <a class="ed-link-verm" href="${esc(identity.linkedin)}" target="_blank" rel="noopener noreferrer">LinkedIn<span aria-hidden="true"> ↗</span></a>
        <a class="ed-link-verm" href="${esc(identity.instagram)}" target="_blank" rel="noopener noreferrer">Instagram<span aria-hidden="true"> ↗</span></a>
        <a class="ed-colophon__lab" href="/playground.html">Appendix: The Lab<span aria-hidden="true"> →</span></a>
      </div>
    </section>
  `
}

/* --- colophon receipt (barcode easter egg) ------------------------------------------------------ */

function receipt(content: SiteContent): string {
  const printed = new Date()
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase()
  const row = (a: string, b: string): string =>
    `<p class="ed-receipt__row"><span>${a}</span><span class="ed-receipt__dots" aria-hidden="true"></span><span>${b}</span></p>`

  return `
    <div class="ed-receipt" role="dialog" aria-modal="true" aria-labelledby="ed-receipt-title" hidden>
      <div class="ed-receipt__backdrop" data-receipt-close></div>
      <div class="ed-receipt__card" data-lenis-prevent>
        <p class="ed-receipt__shop">${esc(content.identity.name).toUpperCase()} — VOL. 04</p>
        <h2 class="ed-receipt__title" id="ed-receipt-title">COLOPHON RECEIPT</h2>
        <div class="ed-receipt__rule" aria-hidden="true"></div>
        ${row('VITE', 'BUNDLER')}
        ${row('THREE.JS', 'WEBGL')}
        ${row('LENIS', 'SMOOTH SCROLL')}
        ${row('GLSL', 'PAPER &amp; INK')}
        ${row('TYPESCRIPT', 'STRICT MODE')}
        <div class="ed-receipt__rule" aria-hidden="true"></div>
        ${row('INK', 'VERMILION #E0451F')}
        ${row('STOCK', 'PAPER #F4F1EC')}
        ${row('PRINTED', printed)}
        <div class="ed-receipt__rule" aria-hidden="true"></div>
        ${row('TOTAL', '₹0.00')}
        <p class="ed-receipt__thanks">THANK YOU FOR READING</p>
        <span class="ed-receipt__bars" aria-hidden="true"></span>
        <button class="ed-receipt__close" type="button" data-receipt-close>Close — tear here</button>
      </div>
    </div>
  `
}

/* --- proof mode overlay (Konami easter egg) ------------------------------------------------------ */

function proof(): string {
  const bars = ['#1c1a18', '#e0451f', '#0085ad', '#c6007e', '#e3b505', '#f4f1ec']
    .map((c) => `<i style="--c:${c}"></i>`)
    .join('')
  return `
    <div class="ed-proof" aria-hidden="true">
      <span class="ed-proof__reg ed-proof__reg--tl"></span>
      <span class="ed-proof__reg ed-proof__reg--tr"></span>
      <span class="ed-proof__reg ed-proof__reg--bl"></span>
      <span class="ed-proof__reg ed-proof__reg--br"></span>
      <span class="ed-proof__crop ed-proof__crop--tl"></span>
      <span class="ed-proof__crop ed-proof__crop--tr"></span>
      <span class="ed-proof__crop ed-proof__crop--bl"></span>
      <span class="ed-proof__crop ed-proof__crop--br"></span>
      <span class="ed-proof__note">PROOF — NOT FOR SALE · REGISTRATION CHECK · VOL. 04</span>
      <div class="ed-proof__bars">${bars}</div>
      <span class="ed-proof__stamp">Misprint</span>
    </div>
  `
}

/* --- footer ------------------------------------------------------------------------------------ */

function footer(content: SiteContent): string {
  const name = esc(content.identity.name).toUpperCase()
  return `
    <footer class="ed-footer">
      <p>${name} — VOL. 04 · © 2026, ALL FACTS PRODUCTION-TESTED</p>
      <p>SET IN FRAUNCES &amp; HANKEN GROTESK · LAID OUT IN THREE.JS, TYPESCRIPT &amp; LENIS</p>
      <p>PRINTED ON WEBGL PAPER, ${esc(content.identity.location).toUpperCase()}</p>
    </footer>
  `
}
