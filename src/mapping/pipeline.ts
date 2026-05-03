import type { AudioFeatures } from '../audio/AudioFeaturesSource'
import type { DropletAudioProps, Mapping } from './types'
import { onePole } from './easing'
import {
  DEFAULT_MAPPINGS,
  HARMONY_THRESHOLD,
  INITIAL_PROPS,
  NOISE_FLOOR,
  PROP_EASING,
  SCALE_ATTACK_MS,
  SCALE_RELEASE_MS,
  scaleFromDuration,
} from './defaults'

export class AudioMaterialPipeline {
  private mappings: Mapping[]
  private smoothed: DropletAudioProps
  private sustainedDuration: number = 0 // seconds of coherent voiced input

  constructor(mappings: Mapping[] = DEFAULT_MAPPINGS) {
    this.mappings = mappings
    this.smoothed = { ...INITIAL_PROPS }
  }

  tick(
    features: AudioFeatures,
    dtMs: number,
    lfoDeltas?: Partial<DropletAudioProps>
  ): DropletAudioProps {
    // Merge all mappings into a single raw target frame
    const raw: Partial<DropletAudioProps> = {}
    for (const mapping of this.mappings) {
      Object.assign(raw, mapping(features))
    }

    // Sum LFO deltas before easing: finalValue = baseDefault + audioDelta + lfoDelta
    if (lfoDeltas) {
      for (const k of Object.keys(lfoDeltas) as (keyof DropletAudioProps)[]) {
        const delta = lfoDeltas[k]
        if (delta === undefined) continue
        raw[k] = (raw[k] ?? INITIAL_PROPS[k]) + delta
      }
    }

    // Apply per-prop asymmetric easing for all props in PROP_EASING
    const keys = Object.keys(PROP_EASING) as (keyof typeof PROP_EASING)[]
    for (const key of keys) {
      const target = raw[key]
      if (target !== undefined) {
        const { attackMs, releaseMs } = PROP_EASING[key]
        this.smoothed[key] = onePole(this.smoothed[key], target, attackMs, releaseMs, dtMs)
      }
    }

    // DRE-40: scale growth — bespoke, driven by sustained coherent input duration
    const coherent = features.harmonicity > HARMONY_THRESHOLD && features.rms > NOISE_FLOOR
    if (coherent) {
      this.sustainedDuration += dtMs / 1000
    } else {
      this.sustainedDuration = 0
    }
    const targetScale = coherent ? scaleFromDuration(this.sustainedDuration) : 1.0
    this.smoothed.scale = onePole(
      this.smoothed.scale,
      targetScale,
      SCALE_ATTACK_MS,
      SCALE_RELEASE_MS,
      dtMs
    )

    return { ...this.smoothed }
  }
}
