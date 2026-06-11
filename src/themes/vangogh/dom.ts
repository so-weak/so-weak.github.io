/**
 * Van Gogh DOM — the museum the painter never got, built from SiteContent.
 * Pure construction: no listeners, no measurements (the theme wires those).
 *
 * The conceit runs through everything: sections are gallery ROOMS reached
 * from a fixed masthead, work hangs in gilt frames with brass plaques,
 * skills are paint daubs on a wooden palette, awards live in a medals
 * cabinet, and handwritten "letters to Theo" annotate the walls in Caveat.
 */

import type { Project, SiteContent, WritingEntry } from '../../content/types'

export interface VanGoghDom {
  wrapper: HTMLElement
  /** The eight sections in scroll order (hero first). */
  sections: HTMLElement[]
  /** Masthead room links for about → contact (no hero entry). */
  navLinks: HTMLAnchorElement[]
  /** Hero h1 — target of the katakana flip easter egg. */
  nameEgg: HTMLElement
  /** Hero section — hit-test surface for the brightest-star egg. */
  hero: HTMLElement
  /** "la nuit étoilée" toast (decorative; announced via `live`). */
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

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const

/** Gallery-room display titles per section. */
const ROOM_TITLES: Record<string, string> = {
  about: 'The Painter',
  experience: 'The Working Years',
  projects: 'The Salon',
  skills: 'The Palette',
  awards: 'The Medals Cabinet',
  writing: 'Unfinished Studies',
  contact: 'The Guestbook',
}

/** Handwritten margin notes — one per employer, in scroll order. */
const ROOM_NOTES = [
  'Theo — they hung this work before the Board itself. The Silver Star sits on the mantel.',
  'zero defects through every storm, brother. not one canvas came back.',
  'the year I first learned to see — faces, documents, light.',
] as const

/** Katakana faces for the hero-name flip egg: ソウビク・ゴーシュ. */
const KATA_FIRST = ['ソ', 'ウ', 'ビ', 'ク', '・'] as const
const KATA_LAST = ['ゴ', 'ー', 'シ', 'ュ'] as const
const KATA_STAGGER_MS = 45

/** Salon-hang spans on the 6-column grid: [cols, rows, aspect]. */
const SALON_SPANS: readonly [number, number, string][] = [
  [4, 2, '16/10'], // soweak — the centerpiece
  [2, 2, '3/4'], // aakaar — tall companion piece
  [2, 1, '4/3'],
  [2, 1, '4/3'],
  [2, 1, '4/3'],
  [3, 1, '16/9'],
  [3, 1, '16/9'],
  [2, 1, '4/3'],
  [2, 1, '4/3'],
  [2, 1, '4/3'],
] as const

/**
 * Art-directed canvas per known work — indices into the composed
 * `.vg-frame__art--N` studies in styles.css (a shield for soweak, a DAG of
 * daubs for aakaar, a scanned portrait for Pay-by-Face…). Keyed on the
 * lowercased project name so the motif follows the work, not its slot;
 * unknown works fall back to the generic daub recipe below.
 */
const ART_BY_NAME: Readonly<Record<string, number>> = {
  soweak: 0,
  aakaar: 1,
  'ai fabric: tradeops': 2,
  'pay-by-face & look': 3,
  'rag-as-a-service': 4,
  verifyx: 5,
  'cheque document ai': 6,
  'narad ai & vera': 7,
  'vaani & pay-by-voice': 8,
  ankan: 9,
}

/** Fallback gradient-daub palettes for works without an art-directed study. */
const DAUB_SETS: readonly [string, string, string, number][] = [
  ['#16264e', '#4f7bd9', '#f5c842', 24],
  ['#1d1610', '#d9a441', '#4f7bd9', 132],
  ['#16213f', '#e3a93c', '#f5c842', 78],
  ['#0e1a3a', '#4f7bd9', '#d4502e', 203],
  ['#23355f', '#f5c842', '#d9a441', 311],
  ['#1a2a52', '#d4502e', '#f5c842', 167],
] as const

/** Pigment dots cycling through the palette for skill chips. */
const PIGMENTS = ['#f5c842', '#4f7bd9', '#d9a441', '#d4502e', '#8fb0e8'] as const

/** Daub colors per skill group (bg / ink pairs are handled in CSS). */
const DAUB_GROUP_COUNT = 5

export function buildVanGoghDom(content: SiteContent): VanGoghDom {
  const wrapper = document.createElement('div')
  wrapper.className = 'vg'

  wrapper.innerHTML = `
    <div class="vg-weave" aria-hidden="true"></div>
    ${masthead(content)}
    <main class="vg-main">
      ${hero(content)}
      ${about(content)}
      ${experience(content)}
      ${projects(content)}
      ${skills(content)}
      ${awards(content)}
      ${writing(content)}
      ${contact(content)}
    </main>
    ${footer(content)}
    <span class="vg-toast" data-toast aria-hidden="true" lang="fr">la nuit étoilée — for Theo</span>
    <div class="sr-only" role="status" data-live></div>
  `

  const sections = SECTION_IDS.map((id) => {
    const el = wrapper.querySelector<HTMLElement>(`#${id}`)
    if (!el) throw new Error(`[vangogh] missing section #${id}`)
    return el
  })

  const navLinks = SECTION_IDS.slice(1).map((id) => {
    const el = wrapper.querySelector<HTMLAnchorElement>(
      `.vg-mast__nav a[href="#${id}"]`,
    )
    if (!el) throw new Error(`[vangogh] missing nav link #${id}`)
    return el
  })

  const pick = <T extends Element>(selector: string): T => {
    const el = wrapper.querySelector<T>(selector)
    if (!el) throw new Error(`[vangogh] missing element ${selector}`)
    return el
  }

  const heroEl = sections[0]
  if (!heroEl) throw new Error('[vangogh] missing hero section')

  return {
    wrapper,
    sections,
    navLinks,
    nameEgg: pick<HTMLElement>('[data-name-egg]'),
    hero: heroEl,
    toast: pick<HTMLElement>('[data-toast]'),
    live: pick<HTMLElement>('[data-live]'),
  }
}

// --- fragments ---------------------------------------------------------------

/**
 * Per-letter hero-name spans for the katakana flip egg. Each letter is a
 * tiny 3D flipper: latin face in flow, katakana on the back, kana spread
 * evenly so the flipped word keeps the display rhythm. The first vowel run
 * after the leading letter takes the chrome-yellow italic accent
 * (S<em>ou</em>bhik) the lockup is designed around.
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
    .map((chr, i) => {
      const em = i >= emStart && i < emEnd ? ' is-em' : ''
      const kanaFace = slots[i]
        ? `<span class="vg-name__face vg-name__face--kana">${slots[i]}</span>`
        : ''
      return `<span class="vg-name__ch${em}" style="--kd:${(staggerBase + i) * KATA_STAGGER_MS}ms"><span class="vg-name__face vg-name__face--latin">${chr}</span>${kanaFace}</span>`
    })
    .join('')
}

function roomHead(id: string, label: string, index: number): string {
  const title = ROOM_TITLES[id] ?? label
  return `
    <header class="vg-head vg-reveal">
      <p class="vg-eyebrow">Room ${ROMAN[index] ?? ''} · ${label}</p>
      <h2 class="vg-head__title">${title}</h2>
      <span class="vg-head__rule" aria-hidden="true"></span>
    </header>`
}

function masthead(content: SiteContent): string {
  const links = content.sections
    .map(
      (s, i) => `
        <li>
          <a href="#${s.id}" data-nav>
            <span class="vg-mast__room" aria-hidden="true">Room ${ROMAN[i] ?? ''}</span>
            <span class="vg-mast__label">${s.label}</span>
          </a>
        </li>`,
    )
    .join('')
  return `
    <header class="vg-mast">
      <a class="vg-mast__brand" href="#hero" data-nav aria-label="S.G. Retrospective — back to the entrance">
        <span class="vg-mast__sg" aria-hidden="true">S.G.</span>
        <span class="vg-mast__word" aria-hidden="true">— Retrospective</span>
      </a>
      <nav class="vg-mast__nav" aria-label="Gallery rooms">
        <ul>${links}</ul>
      </nav>
      <a class="vg-seal" href="${content.identity.resumeUrl}" download aria-label="Download résumé (PDF)">
        <span class="vg-seal__wax" aria-hidden="true">SG</span>
        <span class="vg-seal__word" aria-hidden="true">Résumé</span>
      </a>
    </header>`
}

function hero(content: SiteContent): string {
  const { identity } = content
  return `
    <section id="hero" class="vg-hero" aria-label="Introduction">
      <p class="vg-eyebrow vg-hero__kicker vg-intro" style="--d:80ms">A living retrospective · ${identity.location}</p>
      <h1 class="vg-hero__name vg-intro" style="--d:180ms" data-name-egg>
        <span class="sr-only">${identity.name}</span>
        <span class="vg-name" aria-hidden="true" data-speed="0.04">
          <span class="vg-name__word">${nameLetters(identity.firstName, KATA_FIRST, 0)}</span>
          <span class="vg-name__word vg-name__word--last">${nameLetters(identity.lastName, KATA_LAST, identity.firstName.length + 1)}</span>
        </span>
      </h1>
      <div class="vg-plaque vg-hero__plaque vg-intro" style="--d:340ms">
        <p class="vg-plaque__title">${identity.role}</p>
        <p class="vg-plaque__medium">Oil on production systems · 2021 — present · ${identity.location}</p>
        <p class="vg-plaque__line">${identity.tagline}</p>
      </div>
      <p class="vg-hand vg-write vg-hero__letter vg-intro" style="--d:560ms" data-speed="0.07">dear Theo — I have begun teaching the machines to see.</p>
      <div class="vg-hero__actions vg-intro" style="--d:680ms">
        <a class="vg-btn" href="${identity.resumeUrl}" download>Take the catalogue — r&eacute;sum&eacute; <span aria-hidden="true">↓</span></a>
        <a class="vg-hero__enter" href="#about" data-nav>Enter Room I <span aria-hidden="true">→</span></a>
      </div>
      <div class="vg-hero__cue" aria-hidden="true">
        <span class="vg-eyebrow">descend</span>
        <i></i>
      </div>
    </section>`
}

function about(content: SiteContent): string {
  const { identity, about: ab, stats } = content
  const paragraphs = ab.paragraphs.map((p) => `<p>${p}</p>`).join('')
  const vitrine = stats
    .map(
      (s) => `
        <li class="vg-plaque vg-plaque--stat">
          <strong>${s.value}</strong>
          <span>${s.label}</span>
        </li>`,
    )
    .join('')
  const hobbies = ab.hobbies
    .map(
      (h, i) => `
        <li class="vg-reveal" style="--d:${i * 110}ms; --rot:${i % 2 === 0 ? -1.3 : 1.2}deg">
          <article class="vg-minicanvas">
            <div class="vg-minicanvas__art vg-minicanvas__art--${i}" aria-hidden="true"></div>
            <div class="vg-plaque vg-plaque--small">
              <p class="vg-plaque__title">${h.title} <span class="vg-plaque__numeral" aria-hidden="true">· ${h.numeral}</span></p>
              <p class="vg-plaque__medium">${h.arcana}</p>
              <p class="vg-plaque__line">${h.description}</p>
            </div>
          </article>
        </li>`,
    )
    .join('')

  return `
    <section id="about" class="vg-section vg-about" aria-label="About">
      ${roomHead('about', 'About', 0)}
      <div class="vg-about__row">
        <figure class="vg-portrait vg-reveal" data-speed="0.05">
          <span class="vg-portrait__frame">
            <img src="/images/avatars/vangogh.png" alt="Stylized self-portrait of ${identity.name}" loading="lazy" />
          </span>
          <figcaption class="vg-plaque vg-plaque--small">
            <p class="vg-plaque__title">Self-portrait as an engineer</p>
            <p class="vg-plaque__medium">@${identity.handle} · pixels on canvas · ${identity.location}</p>
          </figcaption>
        </figure>
        <div class="vg-wall vg-about__prose vg-reveal" style="--d:120ms">${paragraphs}</div>
      </div>
      <ul class="vg-vitrine vg-reveal" style="--d:200ms" aria-label="The career in numbers">${vitrine}</ul>
      <div class="vg-hobbywall">
        <p class="vg-eyebrow vg-reveal">Private studies — the hobby wall</p>
        <ul class="vg-hobbies">${hobbies}</ul>
      </div>
    </section>`
}

function experience(content: SiteContent): string {
  const rooms = content.experience
    .map((e, i) => {
      const highlights = e.highlights
        .map(
          (h, j) => `
            <li><span class="vg-cat__no" aria-hidden="true">cat. ${i + 1}.${j + 1}</span>${h}</li>`,
        )
        .join('')
      // Each work keeps its substance: the lead checklist point and the
      // pigments (stack) ride the chip — several of these works hang in no
      // other room of the museum.
      const works = e.projects
        ? `<ul class="vg-works" aria-label="Works shown in this room">
            ${e.projects
              .map(
                (p) => `
                  <li class="vg-plaque vg-plaque--chip">
                    <strong>${p.name}</strong>
                    <span>${p.tag}</span>
                    ${p.points[0] ? `<em class="vg-plaque__chipnote">${p.points[0]}</em>` : ''}
                    ${p.stack.length > 0 ? `<span class="vg-plaque__chipstack">${p.stack.join(' · ')}</span>` : ''}
                  </li>`,
              )
              .join('')}
          </ul>`
        : ''
      const note = ROOM_NOTES[i]
        ? `<p class="vg-hand vg-write vg-room__note vg-reveal" style="--d:220ms" data-speed="0.05">${ROOM_NOTES[i]}</p>`
        : ''
      return `
        <li class="vg-reveal" style="--d:${i * 90}ms">
          <article class="vg-wall vg-room">
            <header class="vg-room__label">
              <p class="vg-eyebrow">Exhibit II·${i + 1}</p>
              <h3 class="vg-room__company">${e.company}</h3>
              <p class="vg-room__medium">${e.role} — ${e.period} · ${e.location}</p>
              <p class="vg-room__summary">${e.summary}</p>
            </header>
            <ul class="vg-cat">${highlights}</ul>
            ${works}
          </article>
          ${note}
        </li>`
    })
    .join('')

  const studies = content.education
    .map(
      (ed, i) => `
        <li class="vg-reveal" style="--d:${i * 90}ms">
          <article class="vg-plaque vg-plaque--study">
            <p class="vg-plaque__title">${ed.school}</p>
            <p class="vg-plaque__medium">${ed.degree} · ${ed.detail}</p>
            <p class="vg-plaque__line">${ed.period}</p>
          </article>
        </li>`,
    )
    .join('')

  return `
    <section id="experience" class="vg-section vg-exp" aria-label="Experience">
      ${roomHead('experience', 'Experience', 1)}
      <ol class="vg-rooms">${rooms}</ol>
      <p class="vg-eyebrow vg-reveal">Early studies</p>
      <ul class="vg-studies">${studies}</ul>
    </section>`
}

function salonFrame(p: Project, i: number): string {
  const span = SALON_SPANS[i % SALON_SPANS.length] ?? [2, 1, '4/3']
  const daub = DAUB_SETS[i % DAUB_SETS.length] ?? DAUB_SETS[0]
  const [d1, d2, d3, ang] = daub ?? ['#16264e', '#4f7bd9', '#f5c842', 24]
  const art = ART_BY_NAME[p.name.toLowerCase()]
  const artClass = art === undefined ? '' : ` vg-frame__art--${art}`
  const kind = p.kind === 'open-source' ? 'Open source' : 'Platform'
  const metricsLine = p.metrics
    ? ` · ${p.metrics
        .slice(0, 3)
        .map((mt) => `${mt.value} ${mt.label}`)
        .join(' · ')}`
    : ''
  // Pigment chips — the stack pressed into the brass under the tagline.
  const stack =
    p.stack.length > 0
      ? `<ul class="vg-plaque__stack" aria-label="Painted with — the stack">
          ${p.stack.map((s) => `<li>${s}</li>`).join('')}
        </ul>`
      : ''
  // The full catalogue entry (description + checklist) folds out of the
  // plaque — a native <details>, so it needs no wiring and stays keyboard-
  // and reduced-motion-friendly.
  const points = p.points.map((pt) => `<li>${pt}</li>`).join('')
  const catalogue = `
    <details class="vg-plaque__cat">
      <summary>Catalogue entry <span class="vg-plaque__catmark" aria-hidden="true">+</span></summary>
      <p class="vg-plaque__desc">${p.description}</p>
      ${points ? `<ul class="vg-plaque__points">${points}</ul>` : ''}
    </details>`
  const links = p.links
    ? p.links
        .map(
          (l) => `
            <a class="vg-frame__link" href="${l.url}" target="_blank" rel="noopener noreferrer">${l.label} <span aria-hidden="true">↗</span></a>`,
        )
        .join('')
    : ''
  const rot = i % 2 === 0 ? -1.6 : 1.4
  const speed = (i % 3) * 0.025

  return `
    <li class="vg-salon__item vg-reveal" style="--cs:${span[0]}; --rs:${span[1]}; --d:${(i % 3) * 110}ms; --rot:${rot}deg" data-speed="${speed}">
      <article class="vg-frame">
        <div class="vg-frame__mat">
          <div class="vg-frame__art${artClass}" aria-hidden="true" style="--d1:${d1}; --d2:${d2}; --d3:${d3}; --ang:${ang}deg; --ar:${span[2]}"></div>
        </div>
        <div class="vg-plaque vg-frame__plaque">
          <p class="vg-plaque__title">${p.name}</p>
          <p class="vg-plaque__medium">${kind} · cat. no. ${i + 1}${metricsLine}</p>
          <p class="vg-plaque__line">${p.tagline}</p>
          ${stack}
          ${catalogue}
          ${links}
        </div>
      </article>
    </li>`
}

function projects(content: SiteContent): string {
  const frames = content.projects.map((p, i) => salonFrame(p, i)).join('')
  return `
    <section id="projects" class="vg-section vg-projects" aria-label="Projects">
      ${roomHead('projects', 'Projects', 2)}
      <p class="vg-hand vg-write vg-salon__aside vg-reveal" data-speed="0.04">hang them close, frame to frame — a salon, the way paintings argue best.</p>
      <ul class="vg-salon">${frames}</ul>
    </section>`
}

function skills(content: SiteContent): string {
  const daubs = content.skills
    .map((g, i) => {
      const chips = g.items
        .map(
          (item, j) => `
            <li class="vg-pigment"><i aria-hidden="true" style="--pc:${PIGMENTS[(i + j) % PIGMENTS.length] ?? '#f5c842'}"></i>${item}</li>`,
        )
        .join('')
      return `
        <li class="vg-daubgroup vg-reveal" style="--d:${(i % 3) * 100}ms">
          <h3 class="vg-daub vg-daub--${i % DAUB_GROUP_COUNT}">${g.group}</h3>
          <ul class="vg-pigments">${chips}</ul>
        </li>`
    })
    .join('')

  return `
    <section id="skills" class="vg-section vg-skills" aria-label="Skills">
      ${roomHead('skills', 'Skills', 3)}
      <div class="vg-palette vg-reveal">
        <div class="vg-palette__board">
          <span class="vg-palette__hole" aria-hidden="true"></span>
          <ul class="vg-daubs">${daubs}</ul>
        </div>
      </div>
    </section>`
}

function awards(content: SiteContent): string {
  const medals = content.awards
    .map((a, i) => {
      const [title, ...rest] = a.split(' — ')
      const detail = rest.join(' — ')
      return `
        <li class="vg-reveal" style="--d:${i * 90}ms">
          <article class="vg-medal">
            <span class="vg-medal__ribbon" aria-hidden="true"></span>
            <span class="vg-medal__disc" aria-hidden="true">${ROMAN[i] ?? '·'}</span>
            <div class="vg-medal__text">
              <h3 class="vg-medal__title">${title ?? a}</h3>
              ${detail ? `<p class="vg-medal__detail">${detail}</p>` : ''}
            </div>
          </article>
        </li>`
    })
    .join('')

  const certs = content.certifications.map((c) => `<li>${c}</li>`).join('')

  return `
    <section id="awards" class="vg-section vg-awards" aria-label="Awards">
      ${roomHead('awards', 'Awards', 4)}
      <ul class="vg-medals vg-wall">${medals}</ul>
      <p class="vg-eyebrow vg-reveal">Lesser honours · certifications</p>
      <ul class="vg-certs vg-reveal">${certs}</ul>
    </section>`
}

/** Published study — framed, lit, and linked. */
function litStudy(w: WritingEntry): string {
  const url = w.url ?? '#'
  return `
    <article class="vg-study vg-study--lit">
      <a class="vg-study__frame" href="${url}" aria-label="Read: ${w.title}">
        <span class="vg-study__light" aria-hidden="true"></span>
        <span class="vg-study__art" aria-hidden="true"></span>
      </a>
      <div class="vg-plaque vg-study__plaque">
        <p class="vg-plaque__title"><a class="vg-study__titlelink" href="${url}">${w.title}</a></p>
        <p class="vg-plaque__medium">finished study${w.minutes ? ` · ${w.minutes} min read` : ''}</p>
        <p class="vg-plaque__line">${w.blurb}</p>
        <a class="vg-study__read" href="${url}">Step closer — read it <span aria-hidden="true">→</span></a>
      </div>
    </article>`
}

/** Coming-soon study — a canvas turned to face the wall, stamped UNFINISHED. */
function turnedStudy(w: WritingEntry): string {
  return `
    <article class="vg-study vg-study--turned">
      <div class="vg-study__back" aria-hidden="true">
        <span class="vg-study__bar vg-study__bar--h"></span>
        <span class="vg-study__bar vg-study__bar--v"></span>
        <span class="vg-study__stamp">UNFINISHED</span>
      </div>
      <div class="vg-plaque vg-study__plaque">
        <p class="vg-plaque__title">${w.title}</p>
        <p class="vg-plaque__medium">study in progress — turned to the wall</p>
        <p class="vg-plaque__line">${w.blurb}</p>
      </div>
    </article>`
}

function writing(content: SiteContent): string {
  const studies = content.writing
    .map((w, i) => {
      const card = w.status === 'published' && w.url ? litStudy(w) : turnedStudy(w)
      return `<li class="vg-reveal" style="--d:${i * 120}ms; --rot:${i === 0 ? 0 : i % 2 === 0 ? 1.4 : -1.4}deg">${card}</li>`
    })
    .join('')

  return `
    <section id="writing" class="vg-section vg-writing" aria-label="Writing">
      ${roomHead('writing', 'Writing', 5)}
      <ul class="vg-studyrow">${studies}</ul>
    </section>`
}

function contact(content: SiteContent): string {
  const { identity, contact: c } = content
  return `
    <section id="contact" class="vg-section vg-contact" aria-label="Contact">
      ${roomHead('contact', 'Contact', 6)}
      <p class="vg-contact__inv vg-reveal" style="--d:80ms">${c.heading}</p>
      <p class="vg-contact__blurb vg-reveal" style="--d:160ms">${c.blurb}</p>
      <p class="vg-reveal" style="--d:240ms">
        <a class="vg-hand vg-contact__email" href="mailto:${identity.email}">${identity.email}</a>
      </p>
      <ul class="vg-contact__plaques vg-reveal" style="--d:320ms">
        <li><a class="vg-plaque vg-plaque--link" href="${identity.github}" target="_blank" rel="noopener noreferrer">GitHub <span aria-hidden="true">↗</span></a></li>
        <li><a class="vg-plaque vg-plaque--link" href="${identity.linkedin}" target="_blank" rel="noopener noreferrer">LinkedIn <span aria-hidden="true">↗</span></a></li>
        <li><a class="vg-plaque vg-plaque--link" href="${identity.instagram}" target="_blank" rel="noopener noreferrer">Instagram <span aria-hidden="true">↗</span></a></li>
        <li><a class="vg-plaque vg-plaque--link" href="/playground.html">Conservation Lab <span aria-hidden="true">✦</span></a></li>
        <li><a class="vg-plaque vg-plaque--link" href="${identity.resumeUrl}" download>R&eacute;sum&eacute; <span aria-hidden="true">↓</span></a></li>
      </ul>
    </section>`
}

function footer(content: SiteContent): string {
  const { identity } = content
  return `
    <footer class="vg-foot">
      <p class="vg-foot__line">MUS&Eacute;E S.G. — hung as <em>Van Gogh</em>, fifth rotation of five.</p>
      <p class="vg-foot__line">&copy; 2026 ${identity.name} · Fraunces · Hanken Grotesk · Caveat — the paint is mixed in WebGL.</p>
      <p class="vg-hand vg-foot__hand">— for Theo, who always believed.</p>
    </footer>`
}
