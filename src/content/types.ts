/**
 * Content model — every theme renders the same SiteContent, differently.
 * Keep this layer pure data: no DOM, no theme assumptions.
 */

export interface Identity {
  name: string
  firstName: string
  lastName: string
  handle: string
  role: string
  tagline: string
  location: string
  email: string
  github: string
  linkedin: string
  instagram: string
  resumeUrl: string
  photoUrl: string
}

export interface Stat {
  label: string
  value: string
}

export type SectionId =
  | 'about'
  | 'experience'
  | 'projects'
  | 'skills'
  | 'awards'
  | 'writing'
  | 'contact'

export interface Section {
  id: SectionId
  label: string
}

/** Hobbies rendered as tarot-style cards. */
export interface HobbyCard {
  title: string
  arcana: string
  numeral: string
  description: string
}

export interface About {
  paragraphs: string[]
  hobbies: HobbyCard[]
}

export interface ExperienceProject {
  name: string
  tag: string
  stack: string[]
  points: string[]
  /**
   * Technical detail withheld. When true, `stack` and `points` are redacted at
   * the data layer (left empty here so the specifics never reach page source)
   * and each theme renders its own in-place redaction treatment over the slot.
   * The project `name` and `tag` are deliberately kept — titles, not internals.
   */
  redacted?: boolean
}

export interface ExperienceEntry {
  company: string
  role: string
  period: string
  location: string
  summary: string
  highlights: string[]
  projects?: ExperienceProject[]
  /**
   * Present when this entry's embedded deployment details are withheld. Themes
   * surface it as a short note/stamp beside the redacted deployments.
   */
  redactionNote?: string
}

export type ProjectKind = 'open-source' | 'platform'

export interface ProjectLink {
  label: string
  url: string
}

export interface ProjectMetric {
  label: string
  value: string
}

export interface Project {
  name: string
  kind: ProjectKind
  featured: boolean
  tagline: string
  description: string
  stack: string[]
  points: string[]
  links?: ProjectLink[]
  metrics?: ProjectMetric[]
}

export interface SkillGroup {
  group: string
  items: string[]
}

export interface EducationEntry {
  school: string
  degree: string
  detail: string
  period: string
}

export type WritingStatus = 'published' | 'coming-soon'

export interface WritingEntry {
  title: string
  blurb: string
  status: WritingStatus
  /** Absolute path to the article page. Present when status is 'published'. */
  url?: string
  /** Estimated reading time in minutes. Present when status is 'published'. */
  minutes?: number
}

export interface Contact {
  heading: string
  blurb: string
}

export interface SiteContent {
  identity: Identity
  stats: Stat[]
  sections: Section[]
  about: About
  experience: ExperienceEntry[]
  projects: Project[]
  skills: SkillGroup[]
  awards: string[]
  certifications: string[]
  education: EducationEntry[]
  writing: WritingEntry[]
  contact: Contact
}
