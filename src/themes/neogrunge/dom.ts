/**
 * Neogrunge DOM — builds a single-page comic issue from SiteContent.
 *
 * Layout: masthead → splash panel → about spread → experience issues →
 * project covers → skill meters → laurels → writing mysteries → colophon.
 * Typography: Bangers display + Permanent Marker for annotations +
 * IBM Plex Mono for data.
 */

import type { SiteContent } from '../../content/types'

export interface NeogrungeDom {
  wrapper: HTMLElement
  hero: HTMLElement
  sections: HTMLElement[]
  navLinks: HTMLAnchorElement[]
  /** The hero-name element: target of the katakana easter egg. */
  nameEgg: HTMLElement
  /** Per-panel elements for scroll-reveal. */
  panels: HTMLElement[]
  /** Konami → SPLAT overlay. */
  splat: HTMLElement
  toast: HTMLElement
}

const ESC: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ESC[c] ?? c)
const pad = (n: number): string => String(n).padStart(2, '0')

const KANA_FIRST = 'ソウビク'
const KANA_LAST = 'ゴーシュ'

const SECTION_IDS = [
  'ng-hero',
  'ng-about',
  'ng-experience',
  'ng-projects',
  'ng-skills',
  'ng-awards',
  'ng-writing',
  'ng-contact',
] as const

export function buildNeogrungeDom(content: SiteContent): NeogrungeDom {
  const wrapper = document.createElement('div')
  wrapper.className = 'ng'

  wrapper.innerHTML = `
    ${masthead(content)}
    <main class="ng-main">
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
    ${splat()}
    <div class="ng-toast" role="status" aria-live="polite" aria-atomic="true"></div>
  `

  const sections = SECTION_IDS.map((id) => {
    const el = wrapper.querySelector<HTMLElement>(`#${id}`)
    if (!el) throw new Error(`[neogrunge] missing section #${id}`)
    return el
  })

  const navLinks = ['ng-about', 'ng-experience', 'ng-projects', 'ng-skills', 'ng-awards', 'ng-writing', 'ng-contact'].map((id) => {
    const el = wrapper.querySelector<HTMLAnchorElement>(`.ng-masthead__nav a[href="#${id}"]`)
    if (!el) throw new Error(`[neogrunge] missing nav link #${id}`)
    return el
  })

  const nameEgg = wrapper.querySelector<HTMLElement>('.ng-hero__name')
  const splatEl = wrapper.querySelector<HTMLElement>('.ng-splat')
  const toastEl = wrapper.querySelector<HTMLElement>('.ng-toast')
  const panels = Array.from(wrapper.querySelectorAll<HTMLElement>('.ng-panel'))

  if (!nameEgg || !splatEl || !toastEl) {
    throw new Error('[neogrunge] missing chrome elements')
  }

  return { wrapper, hero: sections[0]!, sections, navLinks, nameEgg, panels, splat: splatEl, toast: toastEl }
}

/* --- masthead ---------------------------------------------------------------- */

function masthead(content: SiteContent): string {
  const navIds = ['ng-about', 'ng-experience', 'ng-projects', 'ng-skills', 'ng-awards', 'ng-writing', 'ng-contact']
  const navLabels = ['ABOUT', 'EXP', 'WORK', 'SKILLS', 'CRED', 'ESSAYS', 'CONTACT']
  const links = navIds.map((id, i) => `<li><a href="#${id}">${navLabels[i]}</a></li>`).join('')

  return `
    <header class="ng-masthead">
      <a class="ng-masthead__title" href="#ng-hero" aria-label="${esc(content.identity.name)}">
        <span class="ng-issue-label">ISSUE #${new Date().getFullYear()}</span>
        <span class="ng-masthead__name">${esc(content.identity.name).toUpperCase()}</span>
      </a>
      <nav class="ng-masthead__nav" aria-label="Sections">
        <ul>${links}<li><a class="ng-masthead__lab" href="/playground.html">LAB ↗</a></li></ul>
      </nav>
      <a class="ng-masthead__resume" href="${esc(content.identity.resumeUrl)}" download aria-label="Download résumé">
        <span class="ng-burst ng-burst--sm" aria-hidden="true">CV!</span>
      </a>
    </header>
  `
}

/* --- hero ------------------------------------------------------------------- */

function hero(content: SiteContent): string {
  const { identity } = content
  return `
    <section id="ng-hero" class="ng-section ng-hero-section" aria-label="Cover">
      <div class="ng-panel ng-hero__panel ng-panel--splash">
        <div class="ng-hero__bg-dots" aria-hidden="true" data-speed="0.72"></div>

        <div class="ng-hero__content">
          <p class="ng-kicker ng-panel-reveal" style="--pi:0">
            <span class="ng-kicker__tag">AI/ML ENGINEER</span>
            <span class="ng-kicker__city">BENGALURU, IND.</span>
          </p>

          <h1 class="ng-hero__name ng-panel-reveal" style="--pi:1"
              aria-label="${esc(identity.firstName)} ${esc(identity.lastName)}"
              data-first="${esc(identity.firstName.toUpperCase())}"
              data-first-kana="${esc(KANA_FIRST)}"
              data-last="${esc(identity.lastName.toUpperCase())}"
              data-last-kana="${esc(KANA_LAST)}">
            <span class="ng-hero__first">${esc(identity.firstName.toUpperCase())}</span>
            <span class="ng-hero__last">${esc(identity.lastName.toUpperCase())}</span>
          </h1>

          <div class="ng-speech ng-panel-reveal" style="--pi:2" aria-label="Tagline">
            <p class="ng-speech__text">${esc(identity.tagline)}</p>
            <span class="ng-speech__tail" aria-hidden="true"></span>
          </div>

          <div class="ng-hero__stats ng-panel-reveal" style="--pi:3" aria-hidden="true">
            ${content.stats.slice(0, 4).map((s, i) =>
              `<div class="ng-stat" style="--si:${i}">
                <span class="ng-stat__val">${esc(s.value)}</span>
                <span class="ng-stat__label">${esc(s.label)}</span>
              </div>`).join('')}
          </div>
        </div>

        <div class="ng-hero__action ng-panel-reveal" style="--pi:4">
          <a class="ng-btn ng-btn--primary" href="#ng-about">READ ON ↓</a>
          <a class="ng-btn" href="${esc(identity.resumeUrl)}" download>RÉSUMÉ ↓</a>
        </div>

        <!-- Scattered onomatopoeia — hidden on mobile via CSS -->
        <span class="ng-action ng-action--yellow" aria-hidden="true" style="--ax:6%;  --ay:15%; --ar:-14deg; --ad:700ms">BAM!</span>
        <span class="ng-action ng-action--red"    aria-hidden="true" style="--ax:80%; --ay:10%; --ar: 9deg;  --ad:950ms">ZAP!</span>
        <span class="ng-action ng-action--yellow" aria-hidden="true" style="--ax:76%; --ay:74%; --ar:-6deg;  --ad:1150ms">POW!</span>

        <div class="ng-speedlines" aria-hidden="true">
          ${Array.from({length: 16}, (_, i) => `<span style="--sl:${i}"></span>`).join('')}
        </div>
      </div>
    </section>
  `
}

/* --- about ------------------------------------------------------------------ */

function about(content: SiteContent): string {
  const { identity, about: ab } = content
  const paragraphs = ab.paragraphs.map((p, i) =>
    `<p class="ng-panel-reveal" style="--pi:${i}">${esc(p)}</p>`
  ).join('')

  const hobbies = ab.hobbies.map((h, i) => `
    <div class="ng-hobby ng-panel-reveal" style="--pi:${i}">
      <span class="ng-hobby__no" aria-hidden="true">${esc(h.numeral)}</span>
      <h3 class="ng-hobby__title">${esc(h.title).toUpperCase()}</h3>
      <p class="ng-hobby__desc">${esc(h.description)}</p>
    </div>`
  ).join('')

  return `
    <section id="ng-about" class="ng-section ng-about" aria-label="About">
      <div class="ng-panel ng-panel--wide">
        <div class="ng-panel__header">
          <span class="ng-panel__issue" aria-hidden="true">#01</span>
          <h2 class="ng-panel__title">ORIGIN STORY</h2>
          <span class="ng-panel__rule" aria-hidden="true"></span>
        </div>
        <div class="ng-about__spread">
          <div class="ng-about__body">
            <figure class="ng-figure ng-panel-reveal" style="--pi:0">
              <div class="ng-figure__frame" data-speed="1.045">
                <img src="/images/avatars/neogrunge.png" alt="Portrait of ${esc(identity.name)}" loading="lazy" width="480" height="600" />
              </div>
              <figcaption class="ng-caption">FIG.01: ${esc(identity.location).toUpperCase()}</figcaption>
            </figure>
          </div>
          <div class="ng-about__text">
            ${paragraphs}
          </div>
        </div>
        <div class="ng-hobbies">
          <h3 class="ng-hobbies__head">SIDE QUESTS</h3>
          <div class="ng-hobbies__grid">
            ${hobbies}
          </div>
        </div>
      </div>
    </section>
  `
}

/* --- experience ------------------------------------------------------------- */

function experience(content: SiteContent): string {
  const issues = content.experience.map((e, i) => {
    const tags = e.highlights.map((h) =>
      `<li class="ng-tag">${esc(h)}</li>`
    ).join('')
    return `
      <article class="ng-issue ng-panel-reveal" style="--pi:${i}">
        <header class="ng-issue__header">
          <div class="ng-issue__badge">
            <span class="ng-issue__no">#${pad(i + 1)}</span>
          </div>
          <div>
            <p class="ng-issue__period">${esc(e.period).toUpperCase()}</p>
            <h3 class="ng-issue__company">${esc(e.company).toUpperCase()}</h3>
            <p class="ng-issue__role">${esc(e.role)}</p>
          </div>
        </header>
        <p class="ng-issue__summary">${esc(e.summary)}</p>
        <ul class="ng-issue__tags">${tags}</ul>
      </article>
    `
  }).join('')

  return `
    <section id="ng-experience" class="ng-section ng-experience" aria-label="Experience">
      <div class="ng-panel ng-panel--dark">
        <div class="ng-panel__header">
          <span class="ng-panel__issue" aria-hidden="true">#02</span>
          <h2 class="ng-panel__title">BATTLE RECORD</h2>
          <span class="ng-panel__rule" aria-hidden="true"></span>
        </div>
        <div class="ng-issues">
          ${issues}
        </div>
      </div>
    </section>
  `
}

/* --- projects --------------------------------------------------------------- */

function projects(content: SiteContent): string {
  const covers = content.projects.map((p, i) => {
    const links = (p.links ?? []).map((l) =>
      `<a class="ng-cover__link" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} ↗</a>`
    ).join('')
    return `
      <article class="ng-cover ng-panel-reveal" style="--pi:${i}" data-kind="${esc(p.kind)}">
        <div class="ng-cover__header">
          <span class="ng-cover__no">${pad(i + 1)}</span>
          <span class="ng-cover__kind">${esc(p.kind === 'open-source' ? 'OPEN SOURCE' : 'PRODUCTION').toUpperCase()}</span>
        </div>
        <h3 class="ng-cover__title">${esc(p.name).toUpperCase()}</h3>
        <p class="ng-cover__tagline">${esc(p.tagline)}</p>
        <p class="ng-cover__desc">${esc(p.description)}</p>
        <p class="ng-cover__stack">${p.stack.slice(0, 4).map(esc).join(' · ')}</p>
        ${links}
        ${p.featured ? '<span class="ng-burst ng-burst--sm ng-cover__feat" aria-hidden="true">HOT!</span>' : ''}
      </article>
    `
  }).join('')

  return `
    <section id="ng-projects" class="ng-section ng-projects" aria-label="Projects">
      <div class="ng-panel">
        <div class="ng-panel__header">
          <span class="ng-panel__issue" aria-hidden="true">#03</span>
          <h2 class="ng-panel__title">THE ARMOURY</h2>
          <span class="ng-panel__rule" aria-hidden="true"></span>
        </div>
        <div class="ng-covers">
          ${covers}
        </div>
      </div>
    </section>
  `
}

/* --- skills ----------------------------------------------------------------- */

function skills(content: SiteContent): string {
  const groups = content.skills.map((g, i) => {
    const tags = g.items.map((item) =>
      `<span class="ng-skill-tag">${esc(item)}</span>`
    ).join('')
    return `
      <div class="ng-skill-group ng-panel-reveal" style="--pi:${i}">
        <h3 class="ng-skill-group__name">${esc(g.group).toUpperCase()}</h3>
        <div class="ng-skill-group__tags">${tags}</div>
      </div>
    `
  }).join('')

  return `
    <section id="ng-skills" class="ng-section ng-skills" aria-label="Skills">
      <div class="ng-panel ng-panel--accent">
        <div class="ng-panel__header">
          <span class="ng-panel__issue" aria-hidden="true">#04</span>
          <h2 class="ng-panel__title">POWER LEVEL</h2>
          <span class="ng-panel__rule" aria-hidden="true"></span>
        </div>
        <div class="ng-skills__grid">
          ${groups}
        </div>
      </div>
    </section>
  `
}

/* --- awards ----------------------------------------------------------------- */

function awards(content: SiteContent): string {
  const laurels = content.awards.map((a, i) => `
    <li class="ng-laurel ng-panel-reveal" style="--pi:${i}">
      <span class="ng-laurel__star" aria-hidden="true">★</span>
      <p>${esc(a)}</p>
    </li>`
  ).join('')

  const certs = content.certifications.map((c) => `<li>${esc(c)}</li>`).join('')

  return `
    <section id="ng-awards" class="ng-section ng-awards" aria-label="Awards">
      <div class="ng-panel ng-panel--dark">
        <div class="ng-panel__header">
          <span class="ng-panel__issue" aria-hidden="true">#05</span>
          <h2 class="ng-panel__title">HALL OF FAME</h2>
          <span class="ng-panel__rule" aria-hidden="true"></span>
        </div>
        <div class="ng-awards__spread">
          <ol class="ng-laurels">${laurels}</ol>
          <aside class="ng-awards__certs ng-panel-reveal" style="--pi:10">
            <h3 class="ng-certs__head">CERTIFICATIONS</h3>
            <ul class="ng-certs">${certs}</ul>
          </aside>
        </div>
      </div>
    </section>
  `
}

/* --- writing ---------------------------------------------------------------- */

function writing(content: SiteContent): string {
  const teasers = content.writing.map((w, i) => {
    const published = w.status === 'published' && Boolean(w.url)
    return `
      <article class="ng-mystery ng-panel-reveal${published ? ' ng-mystery--pub' : ''}" style="--pi:${i}">
        <div class="ng-mystery__cover">
          ${published
            ? `<a href="${esc(w.url ?? '')}" class="ng-mystery__link">
                <h3 class="ng-mystery__title">${esc(w.title).toUpperCase()}</h3>
                <p class="ng-mystery__blurb">${esc(w.blurb)}</p>
                <span class="ng-mystery__cta">READ ↗</span>
               </a>`
            : `<h3 class="ng-mystery__title ng-mystery__title--hidden">???</h3>
               <p class="ng-mystery__blurb ng-mystery__blurb--hidden">COMING SOON</p>`
          }
        </div>
        <div class="ng-mystery__label">
          <span class="ng-mystery__no">${pad(i + 1)}</span>
          ${published ? `<span class="ng-burst ng-burst--xs" aria-hidden="true">IN PRINT</span>` : ''}
        </div>
      </article>
    `
  }).join('')

  return `
    <section id="ng-writing" class="ng-section ng-writing" aria-label="Writing">
      <div class="ng-panel">
        <div class="ng-panel__header">
          <span class="ng-panel__issue" aria-hidden="true">#06</span>
          <h2 class="ng-panel__title">THE PRESS</h2>
          <span class="ng-panel__rule" aria-hidden="true"></span>
        </div>
        <div class="ng-mysteries">
          ${teasers}
        </div>
      </div>
    </section>
  `
}

/* --- contact ---------------------------------------------------------------- */

function contact(content: SiteContent): string {
  const { identity, contact: ct } = content
  return `
    <section id="ng-contact" class="ng-section ng-contact" aria-label="Contact">
      <div class="ng-panel ng-panel--splash ng-panel--contact">
        <div class="ng-burst ng-burst--lg" aria-hidden="true">LET'S TALK!</div>
        <h2 class="ng-contact__heading ng-panel-reveal" style="--pi:0">${esc(ct.heading).toUpperCase()}</h2>
        <a class="ng-contact__email ng-panel-reveal" style="--pi:1" href="mailto:${esc(identity.email)}">${esc(identity.email)}</a>
        <p class="ng-contact__blurb ng-panel-reveal" style="--pi:2">${esc(ct.blurb)}</p>
        <div class="ng-contact__links ng-panel-reveal" style="--pi:3">
          <a class="ng-btn ng-btn--primary" href="${esc(identity.resumeUrl)}" download>GET RÉSUMÉ ↓</a>
          <a class="ng-btn" href="${esc(identity.github)}" target="_blank" rel="noopener noreferrer">GITHUB ↗</a>
          <a class="ng-btn" href="${esc(identity.linkedin)}" target="_blank" rel="noopener noreferrer">LINKEDIN ↗</a>
          <a class="ng-btn" href="${esc(identity.instagram)}" target="_blank" rel="noopener noreferrer">INSTAGRAM ↗</a>
        </div>
        <div class="ng-speedlines" aria-hidden="true">
          ${Array.from({length: 12}, (_, i) => `<span style="--sl:${i}"></span>`).join('')}
        </div>
      </div>
    </section>
  `
}

/* --- konami splat overlay -------------------------------------------------- */

function splat(): string {
  return `
    <div class="ng-splat" aria-hidden="true" hidden>
      <svg class="ng-splat__svg" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
        <defs>
          <filter id="ng-splat-blur">
            <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" result="noise"/>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="60" xChannelSelector="R" yChannelSelector="G"/>
          </filter>
        </defs>
        <circle class="ng-splat__blob" cx="400" cy="300" r="220" filter="url(#ng-splat-blur)"/>
        <text class="ng-splat__text" x="400" y="316" text-anchor="middle">BLAMMO!</text>
      </svg>
    </div>
  `
}

/* --- footer ---------------------------------------------------------------- */

function footer(content: SiteContent): string {
  return `
    <footer class="ng-footer">
      <p>${esc(content.identity.name).toUpperCase()} / AI/ML ENGINEER · BENGALURU, INDIA</p>
      <p>SET IN BANGERS + PERMANENT MARKER · POWERED BY THREE.JS, VITE, TYPESCRIPT</p>
      <p>© ${new Date().getFullYear()} / ALL RIGHTS RESERVED, ALL BUGS PRODUCTION-TESTED</p>
    </footer>
  `
}
