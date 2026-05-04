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
  displacement: number
  scale: number
  caGrowthRate: number // 0..1 — drives Reiter CA step size (DRE-109)
  caMaxIterations: number // integer cap — max CA steps per frame (DRE-109)
}

export type Mapping = (features: AudioFeatures) => Partial<DropletAudioProps>
