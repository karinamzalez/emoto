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
    crystallinity: { attackMs: 200, releaseMs: 800 },
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
}

// Amplitude → iridescence, thickness, chromatic aberration (droplet "breathes" with volume)
const amplitudeMapping: Mapping = (f: AudioFeatures) => ({
  iridescence: 0.1 + f.rms * 0.9,
  thickness: 0.5 + f.rms * 4.5,
  chromaticAberration: f.rms * 0.6,
})

// Pitch → refractive index (IOR); silent/unvoiced leaves ior unchanged
const pitchMapping: Mapping = (f: AudioFeatures) => {
  if (f.pitchHz === null) return {}
  const normalized = Math.min(1, Math.max(0, (f.pitchHz - 80) / 720))
  return { ior: 1.2 + normalized * 0.8 }
}

// Spectral centroid → iridescence thickness range
const centroidMapping: Mapping = (f: AudioFeatures) => {
  const normalized = Math.min(1, f.centroidHz / 8000)
  return {
    iridescenceThicknessMin: 50 + normalized * 350,
    iridescenceThicknessMax: 200 + normalized * 600,
  }
}

// Harmonicity → crystallinity (the thesis: voiced sound = crystal form)
const harmonicityMapping: Mapping = (f: AudioFeatures) => ({
  crystallinity: f.harmonicity,
})

export const DEFAULT_MAPPINGS: Mapping[] = [
  amplitudeMapping,
  pitchMapping,
  centroidMapping,
  harmonicityMapping,
]
