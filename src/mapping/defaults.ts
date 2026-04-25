import type { AudioFeatures } from '../audio/AudioFeaturesSource'
import type { DropletAudioProps, Mapping } from './types'

export const PROP_EASING: Record<keyof DropletAudioProps, { attackMs: number; releaseMs: number }> =
  {
    ior: { attackMs: 50, releaseMs: 400 },
    iridescence: { attackMs: 80, releaseMs: 600 },
    iridescenceIOR: { attackMs: 80, releaseMs: 400 },
    iridescenceThicknessMin: { attackMs: 100, releaseMs: 500 },
    iridescenceThicknessMax: { attackMs: 100, releaseMs: 500 },
    thickness: { attackMs: 60, releaseMs: 500 },
    chromaticAberration: { attackMs: 50, releaseMs: 300 },
    // DRE-39: attack ~80ms (satisfies >0.8 within 200ms); release ~800ms for musical linger
    crystallinity: { attackMs: 80, releaseMs: 800 },
    // DRE-36: fast attack for responsiveness, moderate release
    displacement: { attackMs: 60, releaseMs: 300 },
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

const NOISE_FLOOR = 0.02

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

// DRE-39: harmonicity → crystallinity (the thesis); also dims iridescence when incoherent
const harmonicityMapping: Mapping = (f: AudioFeatures) => ({
  crystallinity: f.harmonicity,
  iridescence: (0.1 + f.rms * 0.9) * (0.2 + f.harmonicity * 0.8),
})

export const DEFAULT_MAPPINGS: Mapping[] = [
  amplitudeMapping,
  pitchMapping,
  centroidMapping,
  harmonicityMapping,
]
