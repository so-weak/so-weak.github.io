/**
 * Aurora DOM — builds the entire layout from SiteContent.
 * Pure construction: no listeners, no measurements (the theme wires those).
 *
 * The tarot motif runs through everything: hobbies are full arcana cards,
 * section heads are dealt with ornamented dividers and roman numerals,
 * awards are "readings", and the writing queue is three face-down cards.
 */

import type { SiteContent, WritingEntry } from '../../content/types'
import {
  CARD_BACK,
  GLYPH_BRUSH,
  GLYPH_SEER,
  GLYPH_SIGIL,
  GLYPH_STRINGS,
  GLYPH_TORII,
  moonSvg,
  ORNAMENT,
} from './glyphs'

export interface AuroraDom {
  wrapper: HTMLElement
  /** The eight sections in scroll order (hero first). */
  sections: HTMLElement[]
  /** Pill-nav anchors for about → contact (no hero entry). */
  navLinks: HTMLAnchorElement[]
  /** Hero h1 — target of the katakana flip easter egg. */
  nameEgg: HTMLElement
  /** Face-down coming-soon writing cards — the tarot-draw buttons. */
  drawButtons: HTMLButtonElement[]
  /** Footer moon-phase button and the glyph row it advances. */
  moonsButton: HTMLButtonElement
  moonsRow: HTMLElement
  /** "おつかれさま" whisper toast (decorative; announced via `live`). */
  toast: HTMLElement
  /** Shared polite live region for easter-egg announcements. */
  live: HTMLElement
}

const SECTION_IDS = [
  'hero',
  'about',
  'experience',
  'projects',
  'skills',
  'awards',
  'writing',
  'contact',
] as const

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const

/** Theme furniture — arcana-style display titles per section. */
const ARCANA_TITLES: Record<string, string> = {
  about: 'The Querent',
  experience: 'The Journey',
  projects: 'The Works',
  skills: 'The Constellations',
  awards: 'The Readings',
  writing: 'Cards Yet Unturned',
}

const HOBBY_GLYPHS = [GLYPH_TORII, GLYPH_STRINGS, GLYPH_BRUSH, GLYPH_SEER]

/** Katakana faces for the hero-name flip egg: ソウビク・ゴーシュ. */
const KATA_FIRST = ['ソ', 'ウ', 'ビ', 'ク'] as const
const KATA_LAST = ['ゴ', 'ー', 'シ', 'ュ'] as const
const KATA_STAGGER_MS = 45

const MOON_PHASES = [-1, -0.66, -0.33, 0, 0.33, 0.66, 1] as const

export const MOON_COUNT = MOON_PHASES.length

/** Render the seven footer moons advanced by `offset` phase steps. */
export function renderMoonRow(offset: number): string {
  return MOON_PHASES.map((_, i) =>
    moonSvg(MOON_PHASES[(i + offset) % MOON_PHASES.length] ?? 0),
  ).join('')
}

/** True when the centre moon shows full at this offset — fires the streak. */
export function isFullMoonOffset(offset: number): boolean {
  return (3 + offset) % MOON_PHASES.length === MOON_PHASES.length - 1
}

export function buildAuroraDom(content: SiteContent): AuroraDom {
  const { identity } = content
  const wrapper = document.createElement('div')
  wrapper.className = 'au'

  wrapper.innerHTML = `
    ${nav(content)}
    <main class="au-main">
      ${hero(content)}
      ${about(content)}
      ${experience(content)}
      ${projects(content)}
      ${skills(content)}
      ${awards(content)}
      ${writing(content)}
      ${contact(content)}
    </main>
    <footer class="au-footer">
      <div class="au-footer__moons">
        <button class="au-moons" type="button" data-moons aria-label="Advance the moon phases">
          <span class="au-moons__row" data-moons-row aria-hidden="true">${renderMoonRow(0)}</span>
        </button>
      </div>
      <p class="au-footer__line">&copy; 2026 ${identity.name} · dealt as <em>Aurora Glass</em></p>
      <p class="au-footer__type au-caps">Cormorant Garamond &middot; Outfit</p>
      <span class="au-toast" data-toast aria-hidden="true" lang="ja">おつかれさま</span>
    </footer>
    <div class="sr-only" role="status" data-live></div>
  `

  const sections = SECTION_IDS.map((id) => {
    const el = wrapper.querySelector<HTMLElement>(`#${id}`)
    if (!el) throw new Error(`[aurora] missing section #${id}`)
    return el
  })

  const navLinks = SECTION_IDS.slice(1).map((id) => {
    const el = wrapper.querySelector<HTMLAnchorElement>(
      `.au-pill a[href="#${id}"]`,
    )
    if (!el) throw new Error(`[aurora] missing nav link #${id}`)
    return el
  })

  const pick = <T extends Element>(selector: string): T => {
    const el = wrapper.querySelector<T>(selector)
    if (!el) throw new Error(`[aurora] missing element ${selector}`)
    return el
  }

  return {
    wrapper,
    sections,
    navLinks,
    nameEgg: pick<HTMLElement>('[data-name-egg]'),
    drawButtons: Array.from(
      wrapper.querySelectorAll<HTMLButtonElement>('button[data-draw]'),
    ),
    moonsButton: pick<HTMLButtonElement>('button[data-moons]'),
    moonsRow: pick<HTMLElement>('[data-moons-row]'),
    toast: pick<HTMLElement>('[data-toast]'),
    live: pick<HTMLElement>('[data-live]'),
  }
}

// --- fragments -------------------------------------------------------------------

/**
 * Per-letter hero-name spans for the katakana flip egg. Each letter is a
 * tiny 3D flipper: latin face in flow, katakana face on the back. The kana
 * are distributed evenly across the latin letters so the flipped word keeps
 * the hero's letterspacing rhythm; letters without a kana flip to blank.
 * The first vowel run after the leading letter keeps the italic-gold accent
 * the serif lockup was designed around (S<em>ou</em>bhik).
 */
function nameLetters(
  word: string,
  kana: readonly string[],
  staggerBase: number,
): string {
  const m = /^(.)([^aeiouAEIOU]*)([aeiouAEIOU]+)(.*)$/.exec(word)
  const emStart = m ? 1 + (m[2]?.length ?? 0) : -1
  const emEnd = m ? emStart + (m[3]?.length ?? 0) : -1

  const slots: string[] = Array.from({ length: word.length }, () => '')
  for (let j = 0; j < kana.length; j++) {
    const idx =
      kana.length === 1
        ? 0
        : Math.min(
            word.length - 1,
            Math.round((j * (word.length - 1)) / (kana.length - 1)),
          )
    slots[idx] = `${slots[idx] ?? ''}${kana[j] ?? ''}`
  }

  return [...word]
    .map((ch, i) => {
      const em = i >= emStart && i < emEnd ? ' is-em' : ''
      const kanaFace = slots[i]
        ? `<span class="au-name__face au-name__face--kana">${slots[i]}</span>`
        : ''
      return `<span class="au-name__ch${em}" style="--kd:${(staggerBase + i) * KATA_STAGGER_MS}ms"><span class="au-name__face au-name__face--latin">${ch}</span>${kanaFace}</span>`
    })
    .join('')
}

function sectionHead(id: string, label: string, index: number): string {
  const title = ARCANA_TITLES[id] ?? label
  return `
    <header class="au-head au-reveal">
      <div class="au-head__ornament" aria-hidden="true">${ORNAMENT}</div>
      <p class="au-caps au-head__label">${NUMERALS[index] ?? ''} &middot; ${label}</p>
      <h2 class="au-head__title">${title}</h2>
    </header>`
}

function nav(content: SiteContent): string {
  const links = content.sections
    .map(
      (s) => `
        <li>
          <a href="#${s.id}" data-nav>
            <i class="au-pill__dot" aria-hidden="true"></i>
            <span>${s.label}</span>
          </a>
        </li>`,
    )
    .join('')
  return `
    <div class="au-top">
      <nav class="au-pill" aria-label="Sections">
        <a class="au-pill__brand" href="#hero" data-nav aria-label="Back to top">
          <span class="au-pill__moon" aria-hidden="true">${moonSvg(0.6)}</span>
          <span class="au-pill__name">${content.identity.firstName}</span>
        </a>
        <ul class="au-pill__list">
          ${links}
          <li class="au-pill__labitem">
            <a class="au-pill__lab" href="/playground.html">Lab<span aria-hidden="true"> ✦</span></a>
          </li>
        </ul>
      </nav>
    </div>`
}

function hero(content: SiteContent): string {
  const { identity } = content
  const fan = [
    { word: 'Engineer', glyph: GLYPH_SIGIL },
    { word: 'Artist', glyph: GLYPH_BRUSH },
    { word: 'Seeker', glyph: GLYPH_SEER },
  ]
    .map(
      (c, i) => `
        <div class="au-fan__card" style="--fi:${i}">
          <span class="au-fan__glyph">${c.glyph}</span>
          <span class="au-fan__word">${c.word}</span>
        </div>`,
    )
    .join('')

  return `
    <section id="hero" class="au-hero" aria-label="Introduction">
      <p class="au-hero__kicker au-caps au-intro" style="--d:80ms">${identity.role} &middot; ${identity.location}</p>
      <h1 class="au-hero__name au-intro" style="--d:180ms" data-name-egg>
        <span class="sr-only">${identity.name}</span>
        <span class="au-name" aria-hidden="true">${nameLetters(identity.firstName, KATA_FIRST, 0)}<span class="au-name__ch au-name__sep" style="--kd:${identity.firstName.length * KATA_STAGGER_MS}ms"><span class="au-name__face au-name__face--latin">&nbsp;</span><span class="au-name__face au-name__face--kana">・</span></span><span class="au-hero__last">${nameLetters(identity.lastName, KATA_LAST, identity.firstName.length + 1)}</span></span>
      </h1>
      <p class="au-hero__tagline au-intro" style="--d:320ms">${identity.tagline}</p>
      <div class="au-fan au-intro" style="--d:440ms" aria-hidden="true">${fan}</div>
      <div class="au-hero__actions au-intro" style="--d:560ms">
        <a class="au-hero__action" href="#about" data-nav>Begin the reading</a>
        <span class="au-hero__sep" aria-hidden="true">✦</span>
        <a class="au-hero__action" href="${identity.resumeUrl}" download>R&eacute;sum&eacute; <span aria-hidden="true">↓</span></a>
      </div>
      <div class="au-hero__cue" aria-hidden="true">
        <span class="au-caps">scroll</span>
        <i></i>
      </div>
    </section>`
}

function about(content: SiteContent): string {
  const { identity, about: ab, stats } = content
  const paragraphs = ab.paragraphs.map((p) => `<p>${p}</p>`).join('')
  const chips = stats
    .slice(0, 4)
    .map(
      (s) =>
        `<li class="au-chip au-chip--gold"><strong>${s.value}</strong> ${s.label}</li>`,
    )
    .join('')
  const cards = ab.hobbies
    .map(
      (h, i) => `
        <li class="au-reveal" style="--d:${i * 110}ms">
          <article class="au-card" data-tilt>
            <div class="au-card__arch" aria-hidden="true"></div>
            <p class="au-card__numeral" aria-hidden="true">${h.numeral}</p>
            <div class="au-card__glyph" aria-hidden="true">${HOBBY_GLYPHS[i] ?? GLYPH_SEER}</div>
            <h3 class="au-card__arcana">${h.arcana}</h3>
            <p class="au-card__title au-caps">${h.title}</p>
            <p class="au-card__desc">${h.description}</p>
            <div class="au-card__foot" aria-hidden="true">✦</div>
          </article>
        </li>`,
    )
    .join('')

  return `
    <section id="about" class="au-section au-about" aria-label="About">
      ${sectionHead('about', 'About', 0)}
      <div class="au-glass au-about__panel au-reveal" style="--d:90ms">
        <figure class="au-about__portrait">
          <span class="au-arch">
            <img src="/images/avatars/aurora.png" alt="Portrait of ${identity.name}" loading="lazy" />
          </span>
          <figcaption class="au-caps">@${identity.handle} &middot; ${identity.location}</figcaption>
        </figure>
        <div class="au-about__prose">${paragraphs}</div>
      </div>
      <ul class="au-about__stats au-reveal" style="--d:160ms">${chips}</ul>
      <div class="au-hobbies">
        <p class="au-caps au-hobbies__label au-reveal">The hobbies, drawn as arcana</p>
        <ul class="au-tarot">${cards}</ul>
      </div>
    </section>`
}

function experience(content: SiteContent): string {
  const entries = content.experience
    .map((e, i) => {
      const highlights = e.highlights.map((h) => `<li>${h}</li>`).join('')
      const chips = e.projects
        ? `<ul class="au-chips" aria-label="Selected projects at ${e.company}">
            ${e.projects
              .map(
                (p) =>
                  `<li class="au-chip au-chip--gold" title="${p.tag}">${p.name}</li>`,
              )
              .join('')}
          </ul>`
        : ''
      return `
        <li class="au-exp__item au-reveal" style="--d:${i * 90}ms">
          <i class="au-exp__node" aria-hidden="true"></i>
          <article class="au-glass au-exp__card">
            <p class="au-caps au-exp__meta">${e.period} &middot; ${e.location}</p>
            <h3 class="au-exp__company">${e.company}</h3>
            <p class="au-exp__role">${e.role}</p>
            <p class="au-exp__summary">${e.summary}</p>
            <ul class="au-exp__highlights">${highlights}</ul>
            ${chips}
          </article>
        </li>`
    })
    .join('')

  const education = content.education
    .map(
      (ed, i) => `
        <li class="au-exp__item au-exp__item--edu au-reveal" style="--d:${i * 90}ms">
          <i class="au-exp__node au-exp__node--small" aria-hidden="true"></i>
          <article class="au-glass au-exp__card au-exp__card--edu">
            <p class="au-caps au-exp__meta">${ed.period}</p>
            <h4 class="au-exp__school">${ed.school}</h4>
            <p class="au-exp__degree">${ed.degree} &middot; ${ed.detail}</p>
          </article>
        </li>`,
    )
    .join('')

  return `
    <section id="experience" class="au-section au-exp" aria-label="Experience">
      ${sectionHead('experience', 'Experience', 1)}
      <ol class="au-exp__line">
        ${entries}
        <li class="au-exp__epoch au-reveal"><span class="au-caps">where it began</span></li>
        ${education}
      </ol>
    </section>`
}

function projects(content: SiteContent): string {
  const featured = content.projects.filter((p) => p.featured)
  const cards = featured
    .map((p, i) => {
      const metrics = p.metrics
        ? p.metrics
            .map(
              (m) =>
                `<li class="au-chip au-chip--gold"><strong>${m.value}</strong> ${m.label}</li>`,
            )
            .join('')
        : ''
      const stack = p.stack
        .map((s) => `<li class="au-chip">${s}</li>`)
        .join('')
      const links = p.links
        ? `<p class="au-project__links">
            ${p.links
              .map(
                (l) =>
                  `<a href="${l.url}" target="_blank" rel="noopener noreferrer">${l.label} <span aria-hidden="true">↗</span></a>`,
              )
              .join('')}
          </p>`
        : ''
      return `
        <li class="au-reveal" style="--d:${(i % 3) * 110}ms">
          <article class="au-glass au-project" data-excite>
            <p class="au-caps au-project__kind">${p.kind === 'open-source' ? 'Open source' : 'Platform'}</p>
            <h3 class="au-project__name">${p.name}</h3>
            <p class="au-project__tagline">${p.tagline}</p>
            <p class="au-project__desc">${p.description}</p>
            ${metrics ? `<ul class="au-chips au-project__metrics">${metrics}</ul>` : ''}
            <ul class="au-chips au-project__stack">${stack}</ul>
            ${links}
          </article>
        </li>`
    })
    .join('')

  return `
    <section id="projects" class="au-section au-projects" aria-label="Projects">
      ${sectionHead('projects', 'Projects', 2)}
      <ul class="au-projects__grid">${cards}</ul>
    </section>`
}

function skills(content: SiteContent): string {
  const clusters = content.skills
    .map((g, i) => {
      // First-magnitude stars: the leading slice of each cluster (data.ts
      // orders groups headline-first) reads brighter — gold-rimmed, ink text,
      // a touch larger — so the constellation has hierarchy, not a tag cloud.
      const featured = g.items.length >= 12 ? 3 : 2
      const stars = g.items
        .map((item, j) =>
          j < featured
            ? `<li class="au-star" data-major>${item}</li>`
            : `<li class="au-star">${item}</li>`,
        )
        .join('')
      return `
        <li class="au-cluster au-reveal" style="--d:${(i % 3) * 100}ms">
          <h3 class="au-caps au-cluster__name"><span aria-hidden="true">✦</span> ${g.group}</h3>
          <ul class="au-cluster__stars">${stars}</ul>
        </li>`
    })
    .join('')

  return `
    <section id="skills" class="au-section au-skills" aria-label="Skills">
      ${sectionHead('skills', 'Skills', 3)}
      <ul class="au-sky">${clusters}</ul>
    </section>`
}

function awards(content: SiteContent): string {
  const readings = content.awards
    .map((a, i) => {
      const [title, ...rest] = a.split(' — ')
      const detail = rest.join(' — ')
      return `
        <li class="au-reveal" style="--d:${i * 90}ms">
          <article class="au-glass au-reading">
            <p class="au-reading__numeral" aria-hidden="true">${NUMERALS[i] ?? '✦'}</p>
            <h3 class="au-reading__title">${title}</h3>
            ${detail ? `<p class="au-reading__detail">${detail}</p>` : ''}
          </article>
        </li>`
    })
    .join('')

  const certs = content.certifications
    .map((c) => `<li>${c}</li>`)
    .join('<li class="au-certs__sep" aria-hidden="true">✦</li>')

  return `
    <section id="awards" class="au-section au-awards" aria-label="Awards">
      ${sectionHead('awards', 'Awards', 4)}
      <ul class="au-readings">${readings}</ul>
      <p class="au-caps au-awards__minor au-reveal">Minor arcana &middot; certifications</p>
      <ul class="au-certs au-reveal">${certs}</ul>
    </section>`
}

/** Published entry — a face-up card holding title + minutes, linked below. */
function faceupCard(w: WritingEntry): string {
  return `
    <article class="au-faceup">
      <a class="au-faceup__card" href="${w.url}">
        <span class="au-faceup__numeral" aria-hidden="true">✶</span>
        <h3 class="au-faceup__title">${w.title}</h3>
        <span class="au-caps au-faceup__minutes">${w.minutes ? `${w.minutes} min read` : 'Published'}</span>
      </a>
      <p class="au-writing__blurb">${w.blurb}</p>
      <a class="au-faceup__read" href="${w.url}">Read the article <span aria-hidden="true">→</span></a>
    </article>`
}

/** Coming-soon entry — face-down, and a tarot-draw easter-egg target. */
function facedownCard(w: WritingEntry, i: number): string {
  return `
    <article class="au-facedown" style="--wi:${i}">
      <button class="au-facedown__btn" type="button" data-draw
        aria-label="${w.title} — coming soon. Draw a tarot card while you wait">
        <span class="au-facedown__flip">
          <span class="au-facedown__face au-facedown__face--back" aria-hidden="true">${CARD_BACK}</span>
          <span class="au-facedown__face au-facedown__face--front" aria-hidden="true">
            <span class="au-draw__numeral"></span>
            <strong class="au-draw__name"></strong>
            <span class="au-draw__reading"></span>
          </span>
        </span>
      </button>
      <p class="au-caps au-facedown__soon">Coming soon</p>
      <h3 class="au-writing__title">${w.title}</h3>
      <p class="au-writing__blurb">${w.blurb}</p>
    </article>`
}

function writing(content: SiteContent): string {
  const cards = content.writing
    .map((w, i) => {
      const card =
        w.status === 'published' && w.url ? faceupCard(w) : facedownCard(w, i)
      return `<li class="au-reveal" style="--d:${i * 120}ms">${card}</li>`
    })
    .join('')

  return `
    <section id="writing" class="au-section au-writing" aria-label="Writing">
      ${sectionHead('writing', 'Writing', 5)}
      <ul class="au-writing__row">${cards}</ul>
    </section>`
}

function contact(content: SiteContent): string {
  const { identity, contact: c } = content
  return `
    <section id="contact" class="au-section au-contact" aria-label="Contact">
      <header class="au-head au-reveal">
        <div class="au-head__ornament" aria-hidden="true">${ORNAMENT}</div>
        <p class="au-caps au-head__label">${NUMERALS[6]} &middot; Contact</p>
        <h2 class="au-head__title">${c.heading}</h2>
      </header>
      <p class="au-contact__blurb au-reveal" style="--d:100ms">${c.blurb}</p>
      <a class="au-contact__email au-reveal" style="--d:200ms" href="mailto:${identity.email}">${identity.email}</a>
      <div class="au-contact__row au-reveal" style="--d:300ms">
        <a class="au-btn" href="${identity.resumeUrl}" download>Draw my r&eacute;sum&eacute; <span aria-hidden="true">↓</span></a>
        <a class="au-contact__link" href="${identity.github}" target="_blank" rel="noopener noreferrer">GitHub <span aria-hidden="true">↗</span></a>
        <a class="au-contact__link" href="${identity.linkedin}" target="_blank" rel="noopener noreferrer">LinkedIn <span aria-hidden="true">↗</span></a>
        <a class="au-contact__link" href="${identity.instagram}" target="_blank" rel="noopener noreferrer">Instagram <span aria-hidden="true">↗</span></a>
        <a class="au-contact__link" href="/playground.html">The Observatory <span aria-hidden="true">✦</span></a>
      </div>
    </section>`
}
