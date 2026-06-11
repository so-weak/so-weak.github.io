/**
 * Generated-media manifest loader (Higgsfield pipeline) — Van Gogh.
 *
 * The media workflow writes public/media/vangogh/manifest.json. When it
 * reports ok:true with a swirling-paint clip, the clip becomes the sky's
 * UNDERPAINTING: a VideoTexture sampled through the domain-warped fbm sky
 * shader, structural to the scene (mobile and reduced motion run the poster
 * frame through the same warp instead). When it reports ok:false — or is
 * missing, unreachable, or garbled — the theme degrades to the procedural
 * glaze + stroke layers alone.
 *
 * Parsing is deliberately tolerant: the generation agent has produced a few
 * manifest shapes, so we accept `clips`/`assets`/`videos` arrays of
 * `{ id?, src|url|video|file, poster? }` as well as flat `{ video|src, poster }`.
 */

interface PaintClip {
  id?: string
  src: string
  poster?: string
}

export interface VanGoghPaintMedia {
  video: string
  poster?: string
}

const VIDEO_RE = /\.(mp4|webm|mov)(\?.*)?$/i

const asRecord = (v: unknown): Record<string, unknown> | null =>
  typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null

function clipFrom(v: unknown): PaintClip | null {
  const r = asRecord(v)
  if (!r) return null
  const src =
    typeof r.src === 'string'
      ? r.src
      : typeof r.url === 'string'
        ? r.url
        : typeof r.video === 'string'
          ? r.video
          : typeof r.file === 'string'
            ? r.file
            : null
  if (!src || !VIDEO_RE.test(src)) return null
  const clip: PaintClip = { src }
  if (typeof r.id === 'string') clip.id = r.id
  else if (typeof r.name === 'string') clip.id = r.name
  if (typeof r.poster === 'string') clip.poster = r.poster
  return clip
}

export async function loadVanGoghPaintMedia(): Promise<VanGoghPaintMedia | null> {
  try {
    const res = await fetch('/media/vangogh/manifest.json', {
      cache: 'no-cache',
    })
    if (!res.ok) return null
    const data = asRecord((await res.json()) as unknown)
    if (!data || data.ok !== true) return null

    const clips: PaintClip[] = []
    for (const key of ['clips', 'assets', 'videos'] as const) {
      const list = data[key]
      if (!Array.isArray(list)) continue
      for (const item of list) {
        const clip = clipFrom(item)
        if (clip) clips.push(clip)
      }
    }
    const flat = clipFrom(data)
    if (flat) clips.push(flat)

    const preferred =
      clips.find(
        (c) => c.id !== undefined && /swirl|paint|sky|night|starry/i.test(c.id),
      ) ?? clips[0]
    if (!preferred) return null

    const media: VanGoghPaintMedia = { video: preferred.src }
    if (preferred.poster !== undefined) media.poster = preferred.poster
    return media
  } catch {
    return null
  }
}
