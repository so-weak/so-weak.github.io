/**
 * TERMINAL NOIR — DOM builder.
 *
 * Pure (content) → HTML string. All copy comes from SiteContent; everything
 * hardcoded here is terminal chrome (prompts, file names, stamps, glyphs).
 */

import type {
  ExperienceEntry,
  Project,
  SiteContent,
} from '../../content/types'

/* ---------------------------------------------------------------- helpers */

const ESC: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
}

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c)

/** Escape, then wrap metric-looking tokens (800+, 99.2%, <100ms) in amber. */
const hl = (s: string): string =>
  esc(s).replace(
    /(?<![A-Za-z0-9])\d[\d,.]*(?:%|ms|x|\/sec)?\+?%?/g,
    (m) => `<span class="trm-m">${m}</span>`,
  )

const slug = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const pad2 = (n: number): string => String(n).padStart(2, '0')

const MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
}

/** "Nov 2024 — Present" → "2024-11". */
const ts = (period: string): string => {
  const m = period.match(/([A-Z][a-z]{2})[a-z]*\s+(\d{4})/)
  if (!m) return period
  return `${m[2] ?? ''}-${MONTHS[m[1] ?? ''] ?? '01'}`
}

const FILE_NAMES: Record<string, string> = {
  hero: '00_profile',
  about: '01_about.md',
  experience: '02_career.log',
  projects: '03_projects/',
  skills: '04_skills.tsv',
  awards: '05_awards.gpg',
  writing: '06_writing.queue',
  contact: '07_contact.sh',
}

const secHead = (idx: string, cmd: string, title: string): string => `
  <header class="trm-sec__head" data-speed="0.055">
    <p class="trm-sec__cmd" aria-hidden="true"><span class="trm-prompt">$</span> ${esc(cmd)}</p>
    <h2 class="trm-sec__title"><span class="trm-sec__idx" aria-hidden="true">${idx}/</span><span data-decode>${esc(title)}</span></h2>
  </header>`

/** Wrap reveal-animated panels in a parallax drift container. */
const drift = (html: string, speed: number): string =>
  html ? `<div class="trm-drift" data-speed="${speed}">${html}</div>` : ''

const chips = (items: string[]): string =>
  `<p class="trm-chips">${items.map((s) => `<span class="trm-chip">${esc(s)}</span>`).join('')}</p>`

/* ---------------------------------------------------------------- sidebar */

function sidebar(c: SiteContent): string {
  const { identity } = c
  const items = [
    { id: 'hero', label: 'Profile' },
    ...c.sections.map((s) => ({ id: s.id as string, label: s.label })),
  ]
  const tree = items
    .map((item, i) => {
      const branch = i === items.length - 1 ? '└──' : '├──'
      return `<li><a class="trm-nav__item" href="#${item.id}" data-nav="${item.id}" aria-label="${esc(item.label)}">
        <span class="trm-nav__tree" aria-hidden="true">${branch}</span>
        <span class="trm-nav__label">${FILE_NAMES[item.id] ?? item.id}</span>
        <span class="trm-nav__caret" aria-hidden="true">█</span>
      </a></li>`
    })
    .join('')

  return `
  <aside class="trm-side">
    <div class="trm-side__brand">
      <p class="trm-side__sys">${esc(identity.handle)}<span class="trm-dim">::sys</span></p>
      <p class="trm-side__ver trm-dim">// dossier v4.0-prod</p>
    </div>
    <nav class="trm-nav" aria-label="Sections">
      <p class="trm-nav__root trm-dim" aria-hidden="true">~/${esc(identity.firstName.toLowerCase())}</p>
      <ul>${tree}</ul>
    </nav>
    <div class="trm-side__foot">
      <a class="trm-cmdlink" href="${esc(identity.resumeUrl)}" download>scp resume.pdf ./</a>
      <a class="trm-cmdlink" href="/playground.html">./lab --run</a>
      <a class="trm-cmdlink" href="${esc(identity.github)}" target="_blank" rel="noopener noreferrer">ssh github ↗</a>
      <a class="trm-cmdlink" href="${esc(identity.linkedin)}" target="_blank" rel="noopener noreferrer">ssh linkedin ↗</a>
      <p class="trm-side__hint trm-dim" aria-hidden="true">[j/k] scroll · [1–4] theme<br>[gg] top · [G] eof</p>
    </div>
  </aside>`
}

/* ------------------------------------------------------------- status bar */

function statusBar(c: SiteContent): string {
  const uptime = c.stats.find((s) => s.label.includes('years'))?.value ?? '4+'
  return `
  <footer class="trm-status" aria-label="Session status">
    <span class="trm-status__cell">MODE:<b data-status-mode>NORMAL</b></span>
    <span class="trm-status__cell trm-status__cell--wide">SEC:<b data-status-sec>HERO</b></span>
    <span class="trm-status__cell trm-status__cell--wide">LOC:<b title="${esc(c.identity.location)}">BLR</b></span>
    <span class="trm-status__cell">UPTIME:<b>${esc(uptime)}y</b></span>
    <span class="trm-status__spring" aria-hidden="true"></span>
    <span class="trm-status__cell" aria-hidden="true">ACT:<span class="trm-led" data-status-led></span></span>
    <span class="trm-status__cell">SCROLL:<b data-status-scroll>000%</b></span>
    <span class="trm-status__cell">CLK:<b data-status-clock>--:--:--</b></span>
  </footer>`
}

/* ------------------------------------------------------------------- hero */

function hero(c: SiteContent): string {
  const { identity, stats } = c
  const statCells = stats
    .map(
      (s, i) => `<div class="trm-stat" style="--i:${i + 5}">
        <b class="trm-stat__v">${esc(s.value)}</b>
        <span class="trm-stat__l trm-dim">${esc(s.label)}</span>
      </div>`,
    )
    .join('')

  return `
  <section id="hero" class="trm-hero" aria-label="Profile">
    <div class="trm-session" data-session>
      <p class="trm-line">
        <span class="trm-prompt">${esc(identity.firstName.toLowerCase())}@hdfc</span><span class="trm-dim">:~$</span>
        <span class="trm-typed" data-typed></span><span class="trm-caret" aria-hidden="true"></span>
      </p>
      <div class="trm-id" role="group" aria-label="Identity record" data-speed="-0.035">
        <p class="trm-id__kicker" style="--i:0">// identity record // verified · ${esc(ts('Nov 2024'))} clearance review passed</p>
        <h1 class="trm-id__name" style="--i:1" data-text="${esc(identity.name.toUpperCase())}">${esc(identity.name.toUpperCase())}</h1>
        <p class="trm-id__role" style="--i:2">${esc(identity.role.toUpperCase())} <span class="trm-dim">·</span> handle: <span class="trm-m">${esc(identity.handle)}</span> <span class="trm-dim">·</span> ${esc(identity.location)}</p>
        <p class="trm-id__badges" style="--i:3">
          <span class="trm-badge trm-badge--amber">CLEARANCE: PRODUCTION</span>
          <span class="trm-badge">STATUS: SHIPPING</span>
        </p>
        <p class="trm-id__tagline trm-dim" style="--i:4"># ${esc(identity.tagline)}</p>
        <div class="trm-id__stats">${statCells}</div>
        <p class="trm-id__hint trm-dim" style="--i:11" aria-hidden="true">▼ scroll, or press <kbd>j</kbd> :: the dossier continues below</p>
      </div>
    </div>
  </section>`
}

/* ------------------------------------------------------------------ about */

function about(c: SiteContent): string {
  const title = c.sections.find((s) => s.id === 'about')?.label ?? 'About'
  const paragraphs = c.about.paragraphs
    .map((p, i) => `<p class="trm-reveal" style="--i:${i}">${hl(p)}</p>`)
    .join('')

  const manRows = c.about.hobbies
    .map((h, i) => {
      const name = h.arcana.replace(/^the\s+/i, '').toUpperCase()
      return `<div class="trm-man__row trm-row trm-reveal" style="--i:${i}">
        <span class="trm-man__name" data-decode>${esc(name)}(${i + 1})</span>
        <span class="trm-man__title">${esc(h.title)}</span>
        <p class="trm-man__desc trm-dim">${esc(h.description)}</p>
      </div>`
    })
    .join('')

  return `
  <section id="about" class="trm-sec">
    ${secHead('01', 'cat about.md', title)}
    <div class="trm-about">
      <div class="trm-about__text">${paragraphs}</div>
      <figure class="trm-portrait trm-reveal" style="--i:1">
        <img src="/images/avatars/terminal.png" alt="Dithered portrait of ${esc(c.identity.name)}" loading="lazy" width="280" height="280">
        <figcaption class="trm-dim">subject.raw / 1bit dither</figcaption>
      </figure>
    </div>
    <div class="trm-man trm-panel" data-speed="-0.03">
      <header class="trm-man__head" aria-hidden="true">
        <span>HOBBIES(7)</span><span>Off-Duty Manual</span><span>HOBBIES(7)</span>
      </header>
      <h3 class="sr-only">Hobbies</h3>
      ${manRows}
    </div>
  </section>`
}

/* ------------------------------------------------------------- experience */

function logEntry(e: ExperienceEntry, idx: number): string {
  const token = (e.company.split(/[\s(]/)[0] ?? e.company).toUpperCase()
  const stamp = ts(e.period)

  const highlights = e.highlights
    .map(
      (h, i) => `<p class="trm-log__line trm-row trm-reveal" style="--i:${i}">
        <span class="trm-log__ts" aria-hidden="true">[${stamp}]</span>
        <span class="trm-log__tok">${esc(token)}</span>
        <span class="trm-dim" aria-hidden="true">::</span>
        <span class="trm-log__msg">${hl(h)}</span>
      </p>`,
    )
    .join('')

  const projects = (e.projects ?? [])
    .map(
      (p, i) => `
      <details class="trm-log__proj"${i === 0 ? ' open' : ''}>
        <summary class="trm-row">
          <span class="trm-log__idx" aria-hidden="true">PRJ-${pad2(i + 1)}</span>
          <span class="trm-log__name">${esc(p.name)}</span>
          <span class="trm-log__tag">[${esc(p.tag)}]</span>
          <span class="trm-log__toggle" aria-hidden="true"></span>
        </summary>
        <div class="trm-log__body">
          <ul>${p.points.map((pt) => `<li>${hl(pt)}</li>`).join('')}</ul>
          ${chips(p.stack)}
        </div>
      </details>`,
    )
    .join('')

  return `
  <article class="trm-panel trm-log trm-reveal" style="--i:${idx}">
    <header class="trm-panel__head">
      <h3 class="trm-log__company"><span data-decode>${esc(e.company)}</span> <span class="trm-dim">/</span> <span class="trm-log__role">${esc(e.role)}</span></h3>
      <p class="trm-log__meta trm-dim">${esc(e.period)} · ${esc(e.location)}</p>
    </header>
    <p class="trm-log__summary">${hl(e.summary)}</p>
    ${highlights}
    ${projects ? `<div class="trm-log__projects"><p class="trm-dim trm-log__projhead" aria-hidden="true">└─ deployments (${e.projects?.length ?? 0})</p>${projects}</div>` : ''}
  </article>`
}

function experience(c: SiteContent): string {
  const title =
    c.sections.find((s) => s.id === 'experience')?.label ?? 'Experience'
  return `
  <section id="experience" class="trm-sec">
    ${secHead('02', 'tail -f /var/log/career.log', title)}
    ${drift(c.experience.map(logEntry).join(''), 0.035)}
  </section>`
}

/* --------------------------------------------------------------- projects */

function lsRow(p: Project, i: number): string {
  const perm = p.kind === 'open-source' ? '-rwxr-xr-x' : 'drwx------'
  return `<li class="trm-ls__row trm-row trm-reveal" style="--i:${i + 1}">
    <span class="trm-ls__perm" aria-hidden="true">${perm}</span>
    <span class="trm-ls__own trm-dim" aria-hidden="true">soweak prod</span>
    <span class="trm-ls__kind">${esc(p.kind)}</span>
    <a class="trm-ls__name" href="#proj-${slug(p.name)}" data-decode>${esc(p.name)}${p.kind === 'platform' ? '/' : ''}</a>
    <span class="trm-ls__tag trm-dim">${esc(p.tagline)}</span>
  </li>`
}

const AUDIT_LABELS = ['THREAT MODEL', 'MITIGATIONS', 'RED TEAM'] as const

function auditPanel(p: Project | undefined): string {
  if (!p) return ''
  const rows = p.points
    .map(
      (pt, i) => `<div class="trm-audit__row trm-reveal" style="--i:${i + 2}">
        <span class="trm-audit__key">${AUDIT_LABELS[i] ?? `FINDING-${pad2(i + 1)}`}</span>
        <p>${hl(pt)}</p>
      </div>`,
    )
    .join('')
  const metrics = (p.metrics ?? [])
    .map((m) => `<span class="trm-kv"><b>${esc(m.value)}</b> ${esc(m.label)}</span>`)
    .join('')
  const links = (p.links ?? [])
    .map(
      (l) => `<a class="trm-cmdlink" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">git clone ${esc(l.label.toLowerCase())}/${esc(p.name)} ↗</a>`,
    )
    .join('')

  return `
  <article id="proj-${slug(p.name)}" class="trm-panel trm-audit trm-reveal">
    <header class="trm-panel__head trm-panel__head--amber">
      <h3>SECURITY AUDIT <span class="trm-dim">//</span> ${esc(p.name)}</h3>
      <span class="trm-badge trm-badge--amber">${esc(p.metrics?.find((m) => m.label === 'alignment')?.value ?? 'OWASP-ALIGNED')}</span>
    </header>
    <p class="trm-audit__subject"><span class="trm-audit__key">SUBJECT</span> ${esc(p.tagline)}</p>
    <p class="trm-audit__overview trm-dim">${hl(p.description)}</p>
    ${rows}
    ${chips(p.stack)}
    <footer class="trm-audit__foot">${metrics}${links}</footer>
  </article>`
}

const DAG_ART = `        nl request
            │
       ┌────▼────┐
       │ PLANNER │ llm → typed plan
       └────┬────┘
            │ DAG · registry-bound
   ┌────────┼────────┐
   ▼        ▼        ▼
[task_01][task_02][task_03]
   │        │        │
   └────────┼────────┘
            ▼
      ┌───────────┐  vault ▸ creds
      │  RUNTIME  │  audit ▸ per-task
      └─────┬─────┘
            │ ws://
            ▼
   remote agents · cross-os`

function dagPanel(p: Project | undefined): string {
  if (!p) return ''
  const links = (p.links ?? [])
    .map(
      (l) => `<a class="trm-cmdlink" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">git clone ${esc(l.label.toLowerCase())}/${esc(p.name)} ↗</a>`,
    )
    .join('')
  return `
  <article id="proj-${slug(p.name)}" class="trm-panel trm-dag trm-reveal">
    <header class="trm-panel__head">
      <h3>${esc(p.name)} <span class="trm-dim">: ${esc(p.tagline)}</span></h3>
      <span class="trm-badge">PIPELINE: TYPED-DAG</span>
    </header>
    <div class="trm-dag__grid">
      <pre class="trm-dag__art" aria-hidden="true">${DAG_ART}</pre>
      <div class="trm-dag__text">
        <p>${hl(p.description)}</p>
        <ul>${p.points.map((pt) => `<li>${hl(pt)}</li>`).join('')}</ul>
        ${chips(p.stack)}
        ${links}
      </div>
    </div>
  </article>`
}

function recordPanel(p: Project, i: number): string {
  const metrics = (p.metrics ?? [])
    .map((m) => `<span class="trm-kv"><b>${esc(m.value)}</b> ${esc(m.label)}</span>`)
    .join('')
  return `
  <article id="proj-${slug(p.name)}" class="trm-panel trm-rec trm-reveal" style="--i:${i}">
    <header class="trm-panel__head">
      <h3><span class="trm-rec__idx" aria-hidden="true">REC-${pad2(i + 1)}</span> ${esc(p.name)}</h3>
      <p class="trm-dim">${esc(p.tagline)}</p>
    </header>
    <p>${hl(p.description)}</p>
    ${metrics ? `<div class="trm-rec__metrics">${metrics}</div>` : ''}
    ${chips(p.stack)}
  </article>`
}

function archiveRow(p: Project, i: number): string {
  return `<li class="trm-arc__row trm-row trm-reveal" style="--i:${i}" id="proj-${slug(p.name)}">
    <span class="trm-arc__idx" aria-hidden="true">ARC-${pad2(i + 1)}</span>
    <span class="trm-arc__name">${esc(p.name)}</span>
    <span class="trm-arc__desc trm-dim">${hl(p.tagline)} ${esc(p.stack.slice(0, 3).join(' · '))}</span>
  </li>`
}

function projects(c: SiteContent): string {
  const title = c.sections.find((s) => s.id === 'projects')?.label ?? 'Projects'
  const open = c.projects.filter((p) => p.kind === 'open-source')
  const audit = open[0]
  const dag = open[1]
  const featured = c.projects.filter(
    (p) => p.featured && p !== audit && p !== dag,
  )
  const archive = c.projects.filter(
    (p) => !p.featured && p !== audit && p !== dag,
  )

  return `
  <section id="projects" class="trm-sec">
    ${secHead('03', 'ls -la ~/projects', title)}
    <ul class="trm-ls trm-panel" aria-label="Project listing" data-speed="0.04">
      <li class="trm-ls__total trm-dim trm-reveal" style="--i:0" aria-hidden="true">total ${c.projects.length}</li>
      ${c.projects.map(lsRow).join('')}
    </ul>
    ${drift(auditPanel(audit), -0.03)}
    ${drift(dagPanel(dag), 0.045)}
    <div class="trm-recs" data-speed="-0.025">${featured.map(recordPanel).join('')}</div>
    ${archive.length ? `<ul class="trm-arc" aria-label="Archived records" data-speed="0.04">${archive.map(archiveRow).join('')}</ul>` : ''}
  </section>`
}

/* ----------------------------------------------------------------- skills */

function skills(c: SiteContent): string {
  const title = c.sections.find((s) => s.id === 'skills')?.label ?? 'Skills'
  const max = Math.max(...c.skills.map((g) => g.items.length))
  const rows = c.skills
    .map((g, i) => {
      const filled = Math.max(1, Math.round((g.items.length / max) * 10))
      const bar = '█'.repeat(filled) + '░'.repeat(10 - filled)
      return `<div class="trm-skill trm-reveal" style="--i:${i}">
        <div class="trm-skill__head">
          <h3 class="trm-skill__group" data-decode>${esc(g.group)}</h3>
          <span class="trm-skill__bar" aria-hidden="true">${bar}</span>
          <span class="trm-skill__n trm-dim">n=${g.items.length}</span>
        </div>
        ${chips(g.items)}
      </div>`
    })
    .join('')

  return `
  <section id="skills" class="trm-sec">
    ${secHead('04', 'column -t /proc/skills', title)}
    <div class="trm-panel trm-skills" data-speed="0.035">${rows}</div>
  </section>`
}

/* ----------------------------------------------------------------- awards */

function awards(c: SiteContent): string {
  const title = c.sections.find((s) => s.id === 'awards')?.label ?? 'Awards'
  const rows = c.awards
    .map(
      (a, i) => `<li class="trm-award trm-reveal" style="--i:${i}" tabindex="0">
        <span class="trm-award__stamp" aria-hidden="true">[CLASSIFIED]</span>
        <span class="trm-award__hint trm-dim" aria-hidden="true">hover to declassify</span>
        <span class="trm-award__text">${hl(a)}</span>
      </li>`,
    )
    .join('')

  const certs = c.certifications
    .map((cert) => `<li>${esc(cert)}</li>`)
    .join('')
  const edu = c.education
    .map(
      (e) => `<li class="trm-edu trm-row">
        <span class="trm-edu__period trm-dim">${esc(e.period)}</span>
        <span class="trm-edu__school" data-decode>${esc(e.school)}</span>
        <span class="trm-edu__degree trm-dim">${esc(e.degree)} / <span class="trm-m">${esc(e.detail)}</span></span>
      </li>`,
    )
    .join('')

  return `
  <section id="awards" class="trm-sec">
    ${secHead('05', 'gpg --decrypt commendations.gpg', title)}
    <ul class="trm-awards" data-speed="-0.03">${rows}</ul>
    <div class="trm-records" data-speed="0.03">
      <div class="trm-panel trm-records__col">
        <header class="trm-panel__head"><h3>TRAINING RECORDS</h3></header>
        <ul class="trm-certs">${certs}</ul>
      </div>
      <div class="trm-panel trm-records__col">
        <header class="trm-panel__head"><h3>ACADEMIC RECORD</h3></header>
        <ul>${edu}</ul>
      </div>
    </div>
  </section>`
}

/* ---------------------------------------------------------------- writing */

function writing(c: SiteContent): string {
  const title = c.sections.find((s) => s.id === 'writing')?.label ?? 'Writing'
  const queued = c.writing.filter((w) => w.status === 'coming-soon').length
  const shipped = c.writing.length - queued

  const jobs = c.writing
    .map((w, i) => {
      const published = w.status === 'published' && w.url
      const badge = published
        ? `<a class="trm-badge trm-job__read" href="${esc(w.url ?? '')}" aria-label="Read: ${esc(w.title)}${w.minutes ? ` (${w.minutes} minute read)` : ''}">READ${w.minutes ? ` · ${w.minutes} MIN` : ''} →</a>`
        : `<span class="trm-badge trm-badge--pending"><span class="trm-blink" aria-hidden="true">●</span> PENDING</span>`
      return `<li class="trm-job trm-row trm-reveal${published ? ' trm-job--done' : ''}" style="--i:${i}">
        <span class="trm-job__id" aria-hidden="true">JOB-${pad2(i + 1)}${published ? ' ✓' : ''}</span>
        <div class="trm-job__body">
          <h3><span data-decode>${esc(w.title)}</span></h3>
          <p class="trm-dim">${hl(w.blurb)}</p>
        </div>
        ${badge}
      </li>`
    })
    .join('')

  return `
  <section id="writing" class="trm-sec">
    ${secHead('06', 'atq --list', title)}
    <p class="trm-dim trm-queue-note" aria-hidden="true"># ${shipped} dispatched · ${queued} queued // more imminent</p>
    <ul class="trm-jobs" data-speed="0.04">${jobs}</ul>
  </section>`
}

/* ---------------------------------------------------------------- contact */

function contact(c: SiteContent): string {
  const title = c.sections.find((s) => s.id === 'contact')?.label ?? 'Contact'
  const { identity } = c
  const linkedHandle = identity.linkedin.split('/').filter(Boolean).pop() ?? identity.handle
  const ghHandle = identity.github.split('/').filter(Boolean).pop() ?? identity.handle

  const cmds = [
    { cmd: `open mailto:${identity.email}`, href: `mailto:${identity.email}`, note: 'send transmission', ext: false, dl: false },
    { cmd: `ssh github.com/${ghHandle}`, href: identity.github, note: 'inspect source', ext: true, dl: false },
    { cmd: `ssh linkedin.com/in/${linkedHandle}`, href: identity.linkedin, note: 'establish uplink', ext: true, dl: false },
    { cmd: `open instagram.com/_so_weak_`, href: identity.instagram, note: 'visual feed', ext: true, dl: false },
    { cmd: 'scp resume.pdf ./', href: identity.resumeUrl, note: 'download résumé', ext: false, dl: true },
    { cmd: './lab --run', href: '/playground.html', note: 'enter the playground', ext: false, dl: false },
  ]
    .map(
      (x, i) => `<a class="trm-cmd trm-row trm-reveal" style="--i:${i + 1}" href="${esc(x.href)}"${x.ext ? ' target="_blank" rel="noopener noreferrer"' : ''}${x.dl ? ' download' : ''}>
        <span class="trm-cmd__p" aria-hidden="true">$</span>
        <span class="trm-cmd__c">${esc(x.cmd)}</span>
        <span class="trm-cmd__note trm-dim" aria-hidden="true"># ${esc(x.note)}</span>
      </a>`,
    )
    .join('')

  return `
  <section id="contact" class="trm-sec trm-contact">
    ${secHead('07', './contact.sh --interactive', title)}
    <h3 class="trm-contact__heading" data-decode>${esc(c.contact.heading)}</h3>
    <p class="trm-contact__blurb trm-dim"># ${esc(c.contact.blurb)}</p>
    <div class="trm-panel trm-contact__block" data-speed="-0.03">
      ${cmds}
      <p class="trm-line trm-contact__cursorline" aria-hidden="true">
        <span class="trm-prompt">${esc(identity.firstName.toLowerCase())}@anywhere</span><span class="trm-dim">:~$</span>
        <span class="trm-caret"></span>
      </p>
    </div>
  </section>`
}

/* ------------------------------------------------------------------ shell */

export function renderShell(c: SiteContent): string {
  return `
  ${sidebar(c)}
  <main class="trm-main" id="trm-main">
    ${hero(c)}
    ${about(c)}
    ${experience(c)}
    ${projects(c)}
    ${skills(c)}
    ${awards(c)}
    ${writing(c)}
    ${contact(c)}
    <footer class="trm-eof">
      <p class="trm-eof__mark" aria-hidden="true">^D</p>
      <p class="trm-dim">EOF · session preserved · © ${esc(c.identity.name)} · ${esc(c.identity.location)}</p>
    </footer>
  </main>
  ${statusBar(c)}`
}
