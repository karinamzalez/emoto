import type { AudioFeatures } from '../audio/AudioFeaturesSource'
import type { DropletAudioProps, Mapping } from './types'
import { onePole } from './easing'
import { DEFAULT_MAPPINGS, INITIAL_PROPS, PROP_EASING } from './defaults'

export class AudioMaterialPipeline {
  private mappings: Mapping[]
  private smoothed: DropletAudioProps

  constructor(mappings: Mapping[] = DEFAULT_MAPPINGS) {
    this.mappings = mappings
    this.smoothed = { ...INITIAL_PROPS }
  }

  tick(features: AudioFeatures, dtMs: number): DropletAudioProps {
    const raw: Partial<DropletAudioProps> = {}
    for (const mapping of this.mappings) {
      Object.assign(raw, mapping(features))
    }

    const keys = Object.keys(this.smoothed) as (keyof DropletAudioProps)[]
    for (const key of keys) {
      const target = raw[key]
      if (target !== undefined) {
        const { attackMs, releaseMs } = PROP_EASING[key]
        this.smoothed[key] = onePole(this.smoothed[key], target, attackMs, releaseMs, dtMs)
      }
    }

    return { ...this.smoothed }
  }
}
