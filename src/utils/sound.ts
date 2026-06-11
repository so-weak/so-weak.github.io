/**
 * Web Audio synthesis — no assets, no deps.
 * A fresh AudioContext is created per play() call so it always starts in
 * "running" state (browsers suspend a shared context until a gesture has been
 * seen, causing single-shot clicks to be silently dropped).
 */

function play(fn: (ctx: AudioContext) => void): void {
  try {
    const ctx = new AudioContext()
    fn(ctx)
    setTimeout(() => void ctx.close(), 4000)
  } catch {}
}

function noiseBuffer(ctx: AudioContext, dur: number): AudioBuffer {
  const len = Math.ceil(ctx.sampleRate * (dur + 0.05))
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  return buf
}

function noise(
  ctx: AudioContext,
  dur: number,
  filterType: BiquadFilterType,
  freq: number,
  freqEnd: number,
  peak: number,
  attack = 0.004,
): void {
  const t = ctx.currentTime
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx, dur)
  const flt = ctx.createBiquadFilter()
  flt.type = filterType
  flt.frequency.setValueAtTime(freq, t)
  if (freqEnd !== freq) flt.frequency.exponentialRampToValueAtTime(freqEnd, t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(peak, t + attack)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  src.connect(flt).connect(g).connect(ctx.destination)
  src.start(t)
  src.stop(t + dur + 0.05)
}

function tone(
  ctx: AudioContext,
  type: OscillatorType,
  freq: number,
  freqEnd: number,
  peak: number,
  dur: number,
  attack = 0.004,
  offset = 0,
): void {
  const t = ctx.currentTime + offset
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (freqEnd !== freq) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(peak, t + attack)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  osc.connect(g).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + dur + 0.05)
}

// ── electroform ───────────────────────────────────────────────────────────────

export function sfxElectroformClick(): void {
  play(ctx => tone(ctx, 'square', 880, 320, 0.10, 0.07, 0.003))
}

export function sfxElectroformHover(): void {
  play(ctx => tone(ctx, 'sine', 4000, 4000, 0.032, 0.025, 0.003))
}

export function sfxElectroformKonami(): void {
  const notes = [523, 659, 784, 1047, 1319, 1568]
  play(ctx => notes.forEach((f, i) => tone(ctx, 'square', f, f, 0.08, 0.07, 0.004, i * 0.075)))
}

// ── terminal ──────────────────────────────────────────────────────────────────

export function sfxTerminalClick(): void {
  play(ctx => noise(ctx, 0.06, 'bandpass', 1200, 1200, 0.22, 0.003))
}

export function sfxTerminalKonami(): void {
  play(ctx => {
    noise(ctx, 0.4, 'bandpass', 80, 80, 0.30, 0.005)
    tone(ctx, 'sawtooth', 55, 220, 0.12, 0.65, 0.01)
    tone(ctx, 'sawtooth', 220, 55, 0.08, 0.45, 0.01, 0.3)
  })
}

// ── editorial ────────────────────────────────────────────────────────────────

export function sfxEditorialClick(): void {
  play(ctx => noise(ctx, 0.09, 'lowpass', 180, 180, 0.32, 0.003))
}

// ── aurora ────────────────────────────────────────────────────────────────────

export function sfxAuroraClick(): void {
  play(ctx => {
    tone(ctx, 'sine', 1047, 1047, 0.12, 1.4, 0.008)
    tone(ctx, 'sine', 1568, 1568, 0.07, 1.2, 0.008)
  })
}

export function sfxAuroraHover(): void {
  play(ctx => tone(ctx, 'sine', 2093, 2093, 0.028, 0.35, 0.005))
}

export function sfxAuroraReveal(): void {
  play(ctx => noise(ctx, 0.3, 'bandpass', 3000, 600, 0.07, 0.02))
}

export function sfxAuroraFullMoon(): void {
  const notes = [659, 784, 988]
  play(ctx => notes.forEach((f, i) => tone(ctx, 'sine', f, f, 0.10, 0.5, 0.01, i * 0.35)))
}

// ── vangogh ───────────────────────────────────────────────────────────────────

export function sfxVanGoghClick(): void {
  play(ctx => noise(ctx, 0.13, 'bandpass', 3000, 600, 0.10, 0.015))
}

export function sfxVanGoghKonami(): void {
  play(ctx => {
    tone(ctx, 'sine', 220, 880, 0.12, 1.2, 0.05)
    tone(ctx, 'sine', 330, 1320, 0.06, 1.0, 0.05, 0.1)
  })
}

export function sfxVanGoghNova(): void {
  play(ctx => {
    noise(ctx, 0.22, 'bandpass', 6000, 200, 0.18, 0.003)
    tone(ctx, 'sine', 1047, 2093, 0.10, 0.22, 0.004)
  })
}

// ── neogrunge ─────────────────────────────────────────────────────────────────

export function sfxNeogrugeClick(): void {
  play(ctx => {
    noise(ctx, 0.10, 'lowpass', 350, 350, 0.28, 0.003)
    tone(ctx, 'sine', 120, 50, 0.15, 0.10, 0.003)
  })
}

export function sfxNeogrugeKonami(): void {
  const notes = [392, 440, 494, 587, 659, 784]
  play(ctx => notes.forEach((f, i) => tone(ctx, 'square', f, f, 0.09, 0.06, 0.004, i * 0.065)))
}
