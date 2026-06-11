/**
 * SoundEngine — pure Web Audio API synthesis, zero audio files.
 * AudioContext is created lazily on the first user gesture; subsequent calls
 * resume it automatically if the browser has suspended it.
 */

let _ac: AudioContext | null = null

function ac(): AudioContext {
  if (!_ac) _ac = new AudioContext()
  if (_ac.state === 'suspended') void _ac.resume()
  return _ac
}

function noiseBuffer(ctx: AudioContext, dur: number): AudioBuffer {
  const len = Math.ceil(ctx.sampleRate * (dur + 0.05))
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  return buf
}

function noiseShot(
  dur: number,
  filterType: BiquadFilterType,
  freq: number,
  freqEnd: number,
  peak: number,
  attack = 0.004,
): void {
  try {
    const c = ac()
    const t = c.currentTime
    const src = c.createBufferSource()
    src.buffer = noiseBuffer(c, dur)
    const flt = c.createBiquadFilter()
    flt.type = filterType
    flt.frequency.setValueAtTime(freq, t)
    if (freqEnd !== freq) flt.frequency.exponentialRampToValueAtTime(freqEnd, t + dur)
    const g = c.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(peak, t + attack)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    src.connect(flt).connect(g).connect(c.destination)
    src.start(t)
    src.stop(t + dur + 0.05)
  } catch { /* AudioContext unavailable in this environment */ }
}

function toneShot(
  type: OscillatorType,
  freq: number,
  freqEnd: number,
  peak: number,
  dur: number,
  attack = 0.004,
  offset = 0,
): void {
  try {
    const c = ac()
    const t = c.currentTime + offset
    const osc = c.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (freqEnd !== freq) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + dur)
    const g = c.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(peak, t + attack)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    osc.connect(g).connect(c.destination)
    osc.start(t)
    osc.stop(t + dur + 0.05)
  } catch { /* AudioContext unavailable in this environment */ }
}

// ─── Electroform ──────────────────────────────────────────────────────────────

/** Sharp digital blip — square wave pitch-dropped in 70ms. */
export function sfxElectroformClick(): void {
  toneShot('square', 880, 320, 0.10, 0.07, 0.003)
}

/** Sub-tick for hover on interactive elements. */
export function sfxElectroformHover(): void {
  toneShot('sine', 4000, 4000, 0.032, 0.025, 0.003)
}

/** Six-note ascending synth arpeggio for the Konami spectacle. */
export function sfxElectroformKonami(): void {
  const notes = [523, 659, 784, 1047, 1319, 1568]
  notes.forEach((f, i) => toneShot('square', f, f, 0.08, 0.07, 0.004, i * 0.075))
}

// ─── Terminal ─────────────────────────────────────────────────────────────────

/** Mechanical key clack — bandpass-filtered noise burst. */
export function sfxTerminalClick(): void {
  noiseShot(0.06, 'bandpass', 1200, 1200, 0.22, 0.003)
}

/** CRT degauss hum for the Konami ACCESS GRANTED spectacle. */
export function sfxTerminalKonami(): void {
  noiseShot(0.4, 'bandpass', 80, 80, 0.30, 0.005)
  toneShot('sawtooth', 55, 220, 0.12, 0.65, 0.01)
  toneShot('sawtooth', 220, 55, 0.08, 0.45, 0.01, 0.3)
}

// ─── Editorial ────────────────────────────────────────────────────────────────

/** Low stamp thud — heavily lowpass-filtered noise. */
export function sfxEditorialClick(): void {
  noiseShot(0.09, 'lowpass', 180, 180, 0.32, 0.003)
}

/** Soft paper rustle for hover interactions. */
export function sfxEditorialHover(): void {
  noiseShot(0.2, 'bandpass', 4000, 2000, 0.04, 0.015)
}

// ─── Aurora ───────────────────────────────────────────────────────────────────

/** Crystal chime — C6 + G6 sine pair with long decay. */
export function sfxAuroraClick(): void {
  toneShot('sine', 1047, 1047, 0.12, 1.4, 0.008)
  toneShot('sine', 1568, 1568, 0.07, 1.2, 0.008)
}

/** Sub-whisper bell for card hover. */
export function sfxAuroraHover(): void {
  toneShot('sine', 2093, 2093, 0.028, 0.35, 0.005)
}

/** Ethereal whoosh for tarot card draw / panel reveal. */
export function sfxAuroraReveal(): void {
  noiseShot(0.3, 'bandpass', 3000, 600, 0.07, 0.02)
}

/** Three ascending celestial tones for the full-moon Easter egg. */
export function sfxAuroraFullMoon(): void {
  const notes = [659, 784, 988]
  notes.forEach((f, i) => toneShot('sine', f, f, 0.10, 0.5, 0.01, i * 0.35))
}

// ─── Van Gogh ─────────────────────────────────────────────────────────────────

/** Brush swish — bandpass noise sweeping 3kHz → 600Hz. */
export function sfxVanGoghClick(): void {
  noiseShot(0.13, 'bandpass', 3000, 600, 0.10, 0.015)
}

/** Deep vortex wind-up for the Konami Starry Vortex. */
export function sfxVanGoghKonami(): void {
  toneShot('sine', 220, 880, 0.12, 1.2, 0.05)
  toneShot('sine', 330, 1320, 0.06, 1.0, 0.05, 0.1)
}

/** Starburst pop for the triple-click supernova egg. */
export function sfxVanGoghNova(): void {
  noiseShot(0.22, 'bandpass', 6000, 200, 0.18, 0.003)
  toneShot('sine', 1047, 2093, 0.10, 0.22, 0.004)
}

// ─── Neogrunge ────────────────────────────────────────────────────────────────

/** Comic punch — low boom + impact noise. */
export function sfxNeogrugeClick(): void {
  noiseShot(0.10, 'lowpass', 350, 350, 0.28, 0.003)
  toneShot('sine', 120, 50, 0.15, 0.10, 0.003)
}

/** 8-bit ascending power-up jingle for the Konami BLAMMO. */
export function sfxNeogrugeKonami(): void {
  const notes = [392, 440, 494, 587, 659, 784]
  notes.forEach((f, i) => toneShot('square', f, f, 0.09, 0.06, 0.004, i * 0.065))
}
