/**
 * Analytics module — sends events to a Supabase table (sg_events).
 * Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env to enable.
 * Silently no-ops if not configured so dev builds stay clean.
 *
 * Supabase table setup SQL:
 *
 *   CREATE TABLE sg_events (
 *     id BIGSERIAL PRIMARY KEY,
 *     event TEXT NOT NULL,
 *     path TEXT,
 *     referrer TEXT,
 *     meta JSONB DEFAULT '{}',
 *     ts TIMESTAMPTZ DEFAULT NOW()
 *   );
 *   ALTER TABLE sg_events ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "anon_insert" ON sg_events FOR INSERT TO anon WITH CHECK (true);
 *   CREATE POLICY "anon_select" ON sg_events FOR SELECT TO anon USING (true);
 */

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ''

export function trackEvent(event: string, meta?: Record<string, string>): void {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return
  const payload = JSON.stringify({
    event,
    path: location.pathname,
    referrer: document.referrer || null,
    meta: meta ?? {},
  })
  fetch(`${SUPABASE_URL}/rest/v1/sg_events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: 'return=minimal',
    },
    body: payload,
    keepalive: true,
  }).catch(() => {})
}
