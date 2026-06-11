/**
 * Electroform DOM — builds the entire chapter layout from SiteContent.
 * Pure construction: no listeners, no measurements (the theme wires those).
 */

import type { SiteContent } from '../../content/types'

export interface ElectroformDom {
  wrapper: HTMLElement
  /** The eight chapter sections, in scroll order (hero first). */
  sections: HTMLElement[]
  /** Dot-nav anchors, same order as `sections`. */
  navLinks: HTMLAnchorElement[]
  /** Mono toast for easter-egg feedback (role=status). */
  toast: HTMLElement
  /** Hero <h1> — hold/hover target for the katakana flip egg. */
  heroName: HTMLElement
  /** Per-line letter spans of the hero name (first name, then last name). */
  heroLetterLines: HTMLSpanElement[][]
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

export function buildElectroformDom(content: SiteContent): ElectroformDom {
  const { identity } = content
  const wrapper = document.createElement('div')
  wrapper.className = 'ef'

  wrapper.innerHTML = `
    <header class="ef-top">
      <a class="ef-top__mark" href="#hero" data-nav data-flash>
        <span class="ef-top__sigil" aria-hidden="true">SG</span>
        <span class="ef-top__word">ELECTROFORM</span>
      </a>
      <div class="ef-top__meta">
        <span class="ef-top__loc">${identity.location.toUpperCase()} — 12.97°N / 77.59°E</span>
        <span class="ef-top__avail"><i aria-hidden="true"></i>OPEN TO BUILD</span>
        <a class="ef-top__cv" href="${identity.resumeUrl}" download data-flash>CV ↓</a>
      </div>
    </header>

    <nav class="ef-nav" aria-label="Sections">
      <ul class="ef-nav__list">
        ${navItems()}
        <li class="ef-nav__labitem">
          <a class="ef-nav__lab" href="/playground.html" data-flash>LAB ↗</a>
        </li>
      </ul>
    </nav>

    <main class="ef-main">
      ${hero(content)}
      ${about(content)}
      ${experience(content)}
      ${projects(content)}
      ${skills(content)}
      ${awards(content)}
      ${writing(content)}
      ${contactSection(content)}
    </main>

    <footer class="ef-footer">
      <p>© 2026 ${identity.name.toUpperCase()}</p>
      <p>ELECTROFORM 01 — THREE.JS / VITE / LENIS</p>
      <p>SET IN UNBOUNDED · ARCHIVO · IBM PLEX MONO</p>
    </footer>

    <div class="ef-toast" role="status"></div>
  `

  const sections = SECTION_IDS.map((id) => {
    const el = wrapper.querySelector<HTMLElement>(`#${id}`)
    if (!el) throw new Error(`[electroform] missing section #${id}`)
    return el
  })

  const navLinks = SECTION_IDS.map((id) => {
    const el = wrapper.querySelector<HTMLAnchorElement>(
      `.ef-nav a[href="#${id}"]`,
    )
    if (!el) throw new Error(`[electroform] missing nav link #${id}`)
    return el
  })

  const toast = wrapper.querySelector<HTMLElement>('.ef-toast')
  if (!toast) throw new Error('[electroform] missing toast')

  const heroName = wrapper.querySelector<HTMLElement>('.ef-hero__name')
  if (!heroName) throw new Error('[electroform] missing hero name')

  const heroLetterLines = Array.from(
    heroName.querySelectorAll<HTMLElement>('.ef-hero__line'),
  ).map((line) =>
    Array.from(line.querySelectorAll<HTMLSpanElement>('.ef-hero__ltr')),
  )

  return { wrapper, sections, navLinks, toast, heroName, heroLetterLines }
}

// --- fragments -------------------------------------------------------------------

const NAV_LABELS: Record<(typeof SECTION_IDS)[number], string> = {
  hero: 'Intro',
  about: 'About',
  experience: 'Experience',
  projects: 'Projects',
  skills: 'Skills',
  awards: 'Awards',
  writing: 'Writing',
  contact: 'Contact',
}

function navItems(): string {
  return SECTION_IDS.map(
    (id, i) => `
      <li>
        <a href="#${id}" data-nav data-flash>
          <span class="ef-nav__label">${String(i).padStart(2, '0')} ${NAV_LABELS[id].toUpperCase()}</span>
          <i class="ef-nav__dot" aria-hidden="true"></i>
        </a>
      </li>`,
  ).join('')
}

/** Split a word into letter spans — the katakana flip egg swaps these. */
function letterSpans(word: string): string {
  return word
    .split('')
    .map((ch) => `<span class="ef-hero__ltr">${ch}</span>`)
    .join('')
}

function hero(content: SiteContent): string {
  const { identity, stats } = content
  const heroStats = stats.slice(0, 3)
  return `
    <section id="hero" class="ef-hero" aria-label="Introduction">
      <p class="ef-hero__index ef-intro" style="--i:0">000 / PORTFOLIO — ${identity.handle.toUpperCase()}</p>
      <h1 class="ef-hero__name" aria-label="${identity.name}">
        <span class="ef-hero__line ef-hero__line--solid ef-intro" style="--i:1" data-speed="0.94" aria-hidden="true">${letterSpans(identity.firstName.toUpperCase())}</span>
        <span class="ef-hero__line ef-hero__line--ghost ef-intro" style="--i:2" data-speed="1.07" aria-hidden="true">${letterSpans(identity.lastName.toUpperCase())}</span>
      </h1>
      <div class="ef-hero__sub ef-intro" style="--i:3">
        <p class="ef-hero__role">${identity.role.toUpperCase()} — ${identity.location.toUpperCase()}</p>
        <p class="ef-hero__tagline">${identity.tagline}</p>
      </div>
      <ul class="ef-hero__stats ef-intro" style="--i:4" aria-label="Key numbers">
        ${heroStats
          .map(
            (s) => `
          <li><strong>${s.value}</strong><span>${s.label}</span></li>`,
          )
          .join('')}
      </ul>
      <p class="ef-hero__scroll ef-intro" style="--i:5" aria-hidden="true">
        SCROLL<span class="ef-hero__scrollline"></span>
      </p>
    </section>`
}

function sectionHead(idx: string, title: string, headingId: string): string {
  return `
    <header class="ef-section__head ef-reveal">
      <span class="ef-section__idx" aria-hidden="true">${idx}</span>
      <h2 class="ef-section__title" id="${headingId}">${title}</h2>
      <span class="ef-section__rule" aria-hidden="true"></span>
    </header>`
}

function about(content: SiteContent): string {
  const { identity, about, stats } = content
  return `
    <section id="about" class="ef-section ef-about" aria-labelledby="ef-h-about">
      ${sectionHead('01', 'ABOUT', 'ef-h-about')}
      <div class="ef-about__grid">
        <figure class="ef-glass ef-about__portrait ef-reveal" data-speed="1.045">
          <img src="/images/avatars/electroform.png" alt="Portrait of ${identity.name}" loading="lazy" width="480" height="600" />
          <figcaption>FIG.01 — OPERATOR / ${identity.handle.toUpperCase()}</figcaption>
        </figure>
        <div class="ef-about__text">
          ${about.paragraphs
            .map(
              (p, i) => `
            <div class="ef-glass ef-about__para ef-reveal" style="--i:${i}"><p>${p}</p></div>`,
            )
            .join('')}
          <ul class="ef-about__stats ef-reveal" style="--i:3" aria-label="Numbers that hold up">
            ${stats
              .slice(3)
              .map(
                (s) => `
              <li><strong>${s.value}</strong><span>${s.label}</span></li>`,
              )
              .join('')}
          </ul>
        </div>
      </div>
      <h3 class="ef-about__hobbytitle ef-reveal">OFF-DUTY ARCANA</h3>
      <ul class="ef-about__hobbies">
        ${about.hobbies
          .map(
            (h, i) => `
          <li class="ef-glass ef-hobby ef-reveal" style="--i:${i}">
            <span class="ef-hobby__numeral" aria-hidden="true">${h.numeral}</span>
            <span class="ef-hobby__arcana">${h.arcana.toUpperCase()}</span>
            <h4 class="ef-hobby__title">${h.title}</h4>
            <p class="ef-hobby__desc">${h.description}</p>
          </li>`,
          )
          .join('')}
      </ul>
    </section>`
}

function experience(content: SiteContent): string {
  return `
    <section id="experience" class="ef-section ef-exp" aria-labelledby="ef-h-exp">
      ${sectionHead('02', 'EXPERIENCE', 'ef-h-exp')}
      <ol class="ef-exp__list">
        ${content.experience
          .map(
            (e, i) => `
          <li class="ef-exp__entry ef-reveal">
            <div class="ef-exp__rail" aria-hidden="true"><i></i></div>
            <header class="ef-exp__head">
              <h3 class="ef-exp__company">${e.company.toUpperCase()}</h3>
              <p class="ef-exp__meta">${e.role.toUpperCase()} · ${e.period.toUpperCase()} · ${e.location.toUpperCase()}</p>
            </header>
            <p class="ef-exp__summary">${e.summary}</p>
            <ul class="ef-exp__highlights">
              ${e.highlights.map((h) => `<li>${h}</li>`).join('')}
            </ul>
            ${e.projects ? expProjects(e.projects, i) : ''}
          </li>`,
          )
          .join('')}
      </ol>
    </section>`
}

function expProjects(
  projects: NonNullable<SiteContent['experience'][number]['projects']>,
  entryIdx: number,
): string {
  return `
    <ul class="ef-exp__projects">
      ${projects
        .map((p, i) => {
          const bodyId = `ef-xp-${entryIdx}-${i}`
          return `
        <li class="ef-xprow">
          <button type="button" class="ef-xprow__btn" data-expand data-flash aria-expanded="false" aria-controls="${bodyId}">
            <span class="ef-xprow__idx" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
            <span class="ef-xprow__name">${p.name}</span>
            <span class="ef-xprow__tag">${p.tag.toUpperCase()}</span>
            <span class="ef-xprow__plus" aria-hidden="true">+</span>
          </button>
          <div class="ef-expand" id="${bodyId}">
            <div class="ef-expand__inner">
              <ul class="ef-points">${p.points.map((pt) => `<li>${pt}</li>`).join('')}</ul>
              <ul class="ef-chips" aria-label="Stack">${p.stack.map((s) => `<li>${s}</li>`).join('')}</ul>
            </div>
          </div>
        </li>`
        })
        .join('')}
    </ul>`
}

function projects(content: SiteContent): string {
  return `
    <section id="projects" class="ef-section ef-proj" aria-labelledby="ef-h-proj">
      ${sectionHead('03', 'PROJECTS', 'ef-h-proj')}
      <ol class="ef-proj__list">
        ${content.projects
          .map((p, i) => {
            const bodyId = `ef-proj-${i}`
            // Flagship OSS rows ship pre-expanded: their GitHub links and
            // metrics are the portfolio's signature content, so they must
            // read on a plain scroll-through (and the open/closed contrast
            // ranks them above the collapsed rest).
            const open = p.kind === 'open-source' && p.featured
            const badge =
              p.kind === 'open-source'
                ? '<em class="ef-badge">OSS</em>'
                : p.featured
                  ? '<em class="ef-badge ef-badge--dim">BANK</em>'
                  : ''
            return `
          <li class="ef-projrow ef-reveal${p.featured ? ' is-featured' : ''}${open ? ' is-open' : ''}">
            <button type="button" class="ef-projrow__btn" data-expand data-flash aria-expanded="${open}" aria-controls="${bodyId}">
              <span class="ef-projrow__idx" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
              <span class="ef-projrow__name">${p.name}${badge}</span>
              <span class="ef-projrow__tagline">${p.tagline}</span>
              <span class="ef-projrow__plus" aria-hidden="true">+</span>
            </button>
            <div class="ef-expand" id="${bodyId}">
              <div class="ef-expand__inner">
                <p class="ef-projrow__desc">${p.description}</p>
                <ul class="ef-points">${p.points.map((pt) => `<li>${pt}</li>`).join('')}</ul>
                ${
                  p.metrics
                    ? `<ul class="ef-metrics" aria-label="Metrics">${p.metrics
                        .map(
                          (m) =>
                            `<li><strong>${m.value}</strong><span>${m.label}</span></li>`,
                        )
                        .join('')}</ul>`
                    : ''
                }
                <ul class="ef-chips" aria-label="Stack">${p.stack.map((s) => `<li>${s}</li>`).join('')}</ul>
                ${
                  p.links
                    ? `<p class="ef-projrow__links">${p.links
                        .map(
                          (l) =>
                            `<a href="${l.url}" target="_blank" rel="noopener noreferrer" data-flash>${l.label.toUpperCase()} ↗</a>`,
                        )
                        .join('')}</p>`
                    : ''
                }
              </div>
            </div>
          </li>`
          })
          .join('')}
      </ol>
    </section>`
}

function skills(content: SiteContent): string {
  return `
    <section id="skills" class="ef-section ef-skills" aria-labelledby="ef-h-skills">
      ${sectionHead('04', 'SKILLS', 'ef-h-skills')}
      <div class="ef-skills__strips">
        ${content.skills
          .map((g, i) => {
            const items = g.items
              .map((it) => `<li>${it}</li><li class="ef-marquee__sep" aria-hidden="true">◆</li>`)
              .join('')
            const dur = Math.min(64, Math.max(20, g.items.join('').length * 0.55))
            return `
          <div class="ef-marquee${i % 2 === 1 ? ' ef-marquee--rev' : ''} ef-reveal" style="--i:${i}">
            <span class="ef-marquee__label">${g.group.toUpperCase()}</span>
            <div class="ef-marquee__clip">
              <div class="ef-marquee__track" style="--dur:${dur.toFixed(1)}s">
                <ul class="ef-marquee__inner">${items}</ul>
                <ul class="ef-marquee__inner" aria-hidden="true">${items}</ul>
              </div>
            </div>
          </div>`
          })
          .join('')}
      </div>
    </section>`
}

function awards(content: SiteContent): string {
  return `
    <section id="awards" class="ef-section ef-awards" aria-labelledby="ef-h-awards">
      ${sectionHead('05', 'RECOGNITION', 'ef-h-awards')}
      <ul class="ef-awards__list">
        ${content.awards
          .map(
            (a, i) => `
          <li class="ef-reveal" style="--i:${i}"><i aria-hidden="true">▸</i>${a}</li>`,
          )
          .join('')}
      </ul>
      <div class="ef-awards__cols">
        <div class="ef-reveal" style="--i:1">
          <h3>CERTIFICATIONS</h3>
          <ul>${content.certifications.map((c) => `<li>${c}</li>`).join('')}</ul>
        </div>
        <div class="ef-reveal" style="--i:2">
          <h3>EDUCATION</h3>
          <ul>
            ${content.education
              .map(
                (e) => `
              <li><strong>${e.school}</strong> — ${e.degree}, ${e.detail} <span>${e.period}</span></li>`,
              )
              .join('')}
          </ul>
        </div>
      </div>
    </section>`
}

function writing(content: SiteContent): string {
  return `
    <section id="writing" class="ef-section ef-writing" aria-labelledby="ef-h-writing">
      ${sectionHead('06', 'WRITING', 'ef-h-writing')}
      <ul class="ef-writing__grid" data-speed="1.02">
        ${content.writing
          .map((w, i) => {
            // Published pieces are real link cards; the rest stay drafts.
            if (w.status === 'published' && w.url) {
              const mins = w.minutes ? ` — ${w.minutes} MIN` : ''
              return `
          <li class="ef-draft ef-pub ef-reveal" style="--i:${i}">
            <a class="ef-pub__link" href="${w.url}" data-flash>
              <span class="ef-draft__stamp" aria-hidden="true">PUBLISHED</span>
              <h3>${w.title}</h3>
              <p>${w.blurb}</p>
              <span class="ef-draft__status">READ${mins} ↗</span>
            </a>
          </li>`
            }
            return `
          <li class="ef-draft ef-reveal" style="--i:${i}">
            <span class="ef-draft__stamp" aria-hidden="true">DRAFT</span>
            <h3>${w.title}</h3>
            <p>${w.blurb}</p>
            <span class="ef-draft__status">STATUS: COMING SOON</span>
          </li>`
          })
          .join('')}
      </ul>
    </section>`
}

function contactSection(content: SiteContent): string {
  const { identity, contact } = content
  return `
    <section id="contact" class="ef-section ef-contact" aria-labelledby="ef-h-contact">
      ${sectionHead('07', 'CONTACT', 'ef-h-contact')}
      <p class="ef-contact__heading ef-reveal">${contact.heading}</p>
      <p class="ef-contact__blurb ef-reveal" style="--i:1">${contact.blurb}</p>
      <a class="ef-contact__email ef-reveal" style="--i:2" href="mailto:${identity.email}" data-flash data-speed="0.97">${identity.email.replace('@', '@<wbr>')}</a>
      <div class="ef-contact__actions ef-reveal" style="--i:3">
        <a class="ef-btn ef-btn--lime" href="${identity.resumeUrl}" download data-flash>DOWNLOAD RÉSUMÉ</a>
        <a class="ef-btn" href="${identity.github}" target="_blank" rel="noopener noreferrer" data-flash>GITHUB ↗</a>
        <a class="ef-btn" href="${identity.linkedin}" target="_blank" rel="noopener noreferrer" data-flash>LINKEDIN ↗</a>
        <a class="ef-btn" href="${identity.instagram}" target="_blank" rel="noopener noreferrer" data-flash>INSTAGRAM ↗</a>
        <a class="ef-btn" href="/playground.html" data-flash>PLAYGROUND ↗</a>
      </div>
    </section>`
}
