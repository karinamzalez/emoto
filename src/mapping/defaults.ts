import type { AudioFeatures } from '../audio/AudioFeaturesSource'
import type { DropletAudioProps, Mapping } from './types'
import type { Oscillator } from '../animation/Oscillators'

// `scale` is driven by sustainedDuration in the pipeline (not via generic easing), so it is
// intentionally absent from PROP_EASING.
export const PROP_EASING: Omit<
  Record<keyof DropletAudioProps, { attackMs: number; releaseMs: number }>,
  'scale'
> = {
  ior: { attackMs: 50, releaseMs: 400 },
  iridescence: { attackMs: 80, releaseMs: 600 },
  iridescenceIOR: { attackMs: 80, releaseMs: 400 },
  iridescenceThicknessMin: { attackMs: 100, releaseMs: 500 },
  iridescenceThicknessMax: { attackMs: 100, releaseMs: 500 },
  thickness: { attackMs: 60, releaseMs: 500 },
  chromaticAberration: { attackMs: 50, releaseMs: 300 },
  // DRE-39: attack 80ms satisfies >0.8 within 200ms; release 800ms for musical linger
  crystallinity: { attackMs: 80, releaseMs: 800 },
  // DRE-36: fast attack for responsiveness, moderate release
  displacement: { attackMs: 60, releaseMs: 300 },
  // DRE-39: CA growth mirrors crystallinity timing — same 800ms release for coherent visual pairing
  caGrowthRate: { attackMs: 80, releaseMs: 800 },
  caMaxIterations: { attackMs: 100, releaseMs: 600 },
}

export const INITIAL_PROPS: DropletAudioProps = {
  ior: 1.33,
  iridescence: 0.3,
  iridescenceIOR: 1.3,
  iridescenceThicknessMin: 100,
  iridescenceThicknessMax: 400,
  thickness: 1.5,
  chromaticAberration: 0.3,
  crystallinity: 0,
  displacement: 0,
  scale: 1.0,
  caGrowthRate: 0,
  caMaxIterations: 0,
}

// DRE-40: coherence threshold and scale growth constants
export const HARMONY_THRESHOLD = 0.6
export const NOISE_FLOOR = 0.02
export const SCALE_ATTACK_MS = 200
export const SCALE_RELEASE_MS = 1500

// Exponential approach to 1.3× — grows quickly past 3s, plateaus naturally.
// scaleFromDuration(4) ≈ 1.24 (satisfies >1.2 within 4s test).
export function scaleFromDuration(durationSec: number): number {
  return 1.0 + 0.3 * (1 - Math.exp(-durationSec / 2.5))
}

const LOG_PITCH_LOW = Math.log(80)
const LOG_PITCH_HIGH = Math.log(800)

// DRE-37: log-scale pitch → IOR. null (unvoiced) returns water default.
export function pitchToIor(pitchHz: number | null): number {
  if (pitchHz === null) return 1.33
  const t = Math.min(
    1,
    Math.max(0, (Math.log(Math.max(1, pitchHz)) - LOG_PITCH_LOW) / (LOG_PITCH_HIGH - LOG_PITCH_LOW))
  )
  return 1.33 + t * 0.67
}

const LOG_CENTROID_LOW = Math.log(400)
const LOG_CENTROID_HIGH = Math.log(4000)
const CENTROID_DELTA_MAX = 150 // nm — shifts both ends of the thickness range together

// DRE-38: log-scale centroid → additive delta on iridescence thickness range.
// Bright vowels (high centroid) shift toward warmer colors; dark vowels toward cooler.
export function centroidToThicknessDelta(centroidHz: number): number {
  const t = Math.min(
    1,
    Math.max(
      0,
      (Math.log(Math.max(1, centroidHz)) - LOG_CENTROID_LOW) /
        (LOG_CENTROID_HIGH - LOG_CENTROID_LOW)
    )
  )
  return (t - 0.5) * 2 * CENTROID_DELTA_MAX
}

// DRE-36: amplitude → thickness (breathing) + chromatic aberration + displacement
const amplitudeMapping: Mapping = (f: AudioFeatures) => ({
  thickness: 0.5 + f.rms * 4.5,
  chromaticAberration: f.rms * 0.6,
  displacement: f.rms < NOISE_FLOOR ? 0 : (f.rms - NOISE_FLOOR) / (1 - NOISE_FLOOR),
})

// DRE-37: log-scale pitch → IOR (always set; null → water default so it eases back cleanly)
const pitchMapping: Mapping = (f: AudioFeatures) => ({
  ior: pitchToIor(f.pitchHz),
})

// DRE-38: log-scale spectral centroid → additive shift on iridescence thickness range
const centroidMapping: Mapping = (f: AudioFeatures) => {
  const delta = centroidToThicknessDelta(f.centroidHz)
  return {
    iridescenceThicknessMin: Math.max(0, INITIAL_PROPS.iridescenceThicknessMin + delta),
    iridescenceThicknessMax: Math.max(0, INITIAL_PROPS.iridescenceThicknessMax + delta),
  }
}

// DRE-39: harmonicity → crystallinity + CA growth (the thesis); also dims iridescence when incoherent
const harmonicityMapping: Mapping = (f: AudioFeatures) => ({
  crystallinity: f.harmonicity,
  caGrowthRate: f.harmonicity,
  iridescence: (0.1 + f.rms * 0.9) * (0.2 + f.harmonicity * 0.8),
})

export const DEFAULT_MAPPINGS: Mapping[] = [
  amplitudeMapping,
  pitchMapping,
  centroidMapping,
  harmonicityMapping,
]

// DRE-112: Default LFO config — periods are chosen to be pairwise coprime in
// the sense that no simple rational ratio repeats within a viewer's attention span.
// crystallinity and CA growth props are NOT oscillated — those are audio-owned.
export function createDefaultOscillators(): Oscillator[] {
  return [
    {
      target: 'rotation.y',
      waveform: 'sine',
      period: 22,
      amplitude: Math.PI / 6,
      phase: 0,
      enabled: true,
      seed: Math.random(),
    },
    {
      target: 'rotation.x',
      waveform: 'sine',
      period: 17,
      amplitude: (5 * Math.PI) / 180,
      phase: 0,
      enabled: true,
      seed: Math.random(),
    },
    {
      target: 'material.roughness',
      waveform: 'perlin',
      period: 8,
      amplitude: 0.05,
      phase: 0,
      enabled: true,
      seed: Math.random(),
    },
    {
      target: 'material.thickness',
      waveform: 'perlin',
      period: 12,
      amplitude: 0.1,
      phase: 0,
      enabled: true,
      seed: Math.random(),
    },
    {
      target: 'material.iridescenceIOR',
      waveform: 'sine',
      period: 9,
      amplitude: 0.02,
      phase: 0,
      enabled: true,
      seed: Math.random(),
    },
  ]
}
