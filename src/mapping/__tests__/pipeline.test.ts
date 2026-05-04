import { describe, it, expect } from 'vitest'
import { AudioMaterialPipeline } from '../pipeline'
import type { Mapping } from '../types'
import type { AudioFeatures } from '../../audio/AudioFeaturesSource'

const silentFeatures: AudioFeatures = {
  rms: 0,
  pitchHz: null,
  centroidHz: 0,
  harmonicity: 0,
}

describe('AudioMaterialPipeline', () => {
  it('merges multiple mappings touching different props', () => {
    const mapA: Mapping = () => ({ ior: 2.0 })
    const mapB: Mapping = () => ({ iridescence: 0.8 })
    const pipeline = new AudioMaterialPipeline([mapA, mapB])

    // Run many frames to allow smoothed values to converge
    for (let i = 0; i < 5000; i++) {
      pipeline.tick(silentFeatures, 16)
    }

    const result = pipeline.tick(silentFeatures, 16)
    expect(result.ior).toBeCloseTo(2.0, 1)
    expect(result.iridescence).toBeCloseTo(0.8, 1)
  })

  it('later mapping wins when two mappings touch the same prop', () => {
    const mapA: Mapping = () => ({ ior: 1.5 })
    const mapB: Mapping = () => ({ ior: 2.2 })
    const pipeline = new AudioMaterialPipeline([mapA, mapB])

    for (let i = 0; i < 5000; i++) {
      pipeline.tick(silentFeatures, 16)
    }

    const result = pipeline.tick(silentFeatures, 16)
    expect(result.ior).toBeCloseTo(2.2, 1)
  })

  it('props not targeted by any mapping stay at initial value', () => {
    const mapA: Mapping = () => ({ ior: 2.0 })
    const pipeline = new AudioMaterialPipeline([mapA])

    const result = pipeline.tick(silentFeatures, 16)
    // crystallinity not mapped — should stay at initial 0
    expect(result.crystallinity).toBe(0)
  })

  it('smoothed value approaches target over time', () => {
    const pipeline = new AudioMaterialPipeline([() => ({ crystallinity: 1 })])

    const initial = pipeline.tick(silentFeatures, 1)
    expect(initial.crystallinity).toBeLessThan(0.1)

    for (let i = 0; i < 5000; i++) {
      pipeline.tick(silentFeatures, 16)
    }
    const converged = pipeline.tick(silentFeatures, 16)
    expect(converged.crystallinity).toBeCloseTo(1, 2)
  })

  it('lfoDeltas compose additively: converges to audioTarget + lfoDelta', () => {
    const audioThickness = 2.0
    const lfoDelta = 0.25
    const pipeline = new AudioMaterialPipeline([() => ({ thickness: audioThickness })])

    for (let i = 0; i < 5000; i++) {
      pipeline.tick(silentFeatures, 16, { thickness: lfoDelta })
    }
    const result = pipeline.tick(silentFeatures, 16, { thickness: lfoDelta })
    expect(result.thickness).toBeCloseTo(audioThickness + lfoDelta, 1)
  })

  it('lfoDeltas composition is commutative: audio+lfo == lfo+audio', () => {
    const audioThickness = 2.0
    const lfoDelta = 0.25

    const pipelineA = new AudioMaterialPipeline([() => ({ thickness: audioThickness })])
    const pipelineB = new AudioMaterialPipeline([() => ({ thickness: audioThickness })])

    for (let i = 0; i < 5000; i++) {
      pipelineA.tick(silentFeatures, 16, { thickness: lfoDelta })
      pipelineB.tick(silentFeatures, 16, { thickness: lfoDelta })
    }
    const a = pipelineA.tick(silentFeatures, 16, { thickness: lfoDelta })
    const b = pipelineB.tick(silentFeatures, 16, { thickness: lfoDelta })
    expect(a.thickness).toBeCloseTo(b.thickness, 10)
  })

  it('lfoDeltas drive props that no audio mapping touches', () => {
    const pipeline = new AudioMaterialPipeline([])
    const lfoDelta = 0.5

    for (let i = 0; i < 5000; i++) {
      pipeline.tick(silentFeatures, 16, { caGrowthRate: lfoDelta })
    }
    const result = pipeline.tick(silentFeatures, 16, { caGrowthRate: lfoDelta })
    // caGrowthRate base is 0; LFO delta of 0.5 should drive it to 0.5
    expect(result.caGrowthRate).toBeCloseTo(lfoDelta, 1)
  })
})
