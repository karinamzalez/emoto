import type { AudioFeatures } from '../audio/AudioFeaturesSource'

export interface DropletAudioProps {
  ior: number
  iridescence: number
  iridescenceIOR: number
  iridescenceThicknessMin: number
  iridescenceThicknessMax: number
  thickness: number
  chromaticAberration: number
  crystallinity: number
}

export type Mapping = (features: AudioFeatures) => Partial<DropletAudioProps>
