import { describe, it, expect } from 'vitest'
import { AudioMaterialPipeline } from '../pipeline'
import { scaleFromDuration } from '../defaults'
import type { AudioFeatures } from '../../audio/AudioFeaturesSource'

const coherent: AudioFeatures = { rms: 0.5, pitchHz: 220, centroidHz: 1000, harmonicity: 0.9 }
const silent: AudioFeatures = { rms: 0, pitchHz: null, centroidHz: 0, harmonicity: 0 }

describe('scaleFromDuration', () => {
  it('returns 1.0 at duration=0 (no premature growth)', () => {
    expect(scaleFromDuration(0)).toBeCloseTo(1.0, 3)
  })

  it('grows past 1.2 by 4 seconds', () => {
    expect(scaleFromDuration(4)).toBeGreaterThan(1.2)
  })

  it('plateaus near 1.3', () => {
    expect(scaleFromDuration(30)).toBeCloseTo(1.3, 1)
    expect(scaleFromDuration(30)).toBeLessThanOrEqual(1.3)
  })

  it('is monotonically increasing', () => {
    expect(scaleFromDuration(1)).toBeLessThan(scaleFromDuration(3))
    expect(scaleFromDuration(3)).toBeLessThan(scaleFromDuration(6))
  })
})

describe('AudioMaterialPipeline — scale growth (DRE-40)', () => {
  it('grows past 1.2 after 4s of coherent input (1ms ticks)', () => {
    const pipeline = new AudioMaterialPipeline()
    let result = pipeline.tick(coherent, 1)
    for (let i = 0; i < 3999; i++) result = pipeline.tick(coherent, 1)
    expect(result.scale).toBeGreaterThan(1.2)
  })

  it('scale stays at 1.0 in silence', () => {
    const pipeline = new AudioMaterialPipeline()
    for (let i = 0; i < 1000; i++) pipeline.tick(silent, 16)
    expect(pipeline.tick(silent, 16).scale).toBeCloseTo(1.0, 2)
  })

  it('after 2s silence from sustained state: crystallinity < 0.1 and scale < 1.1', () => {
    const pipeline = new AudioMaterialPipeline()

    // Build up sustained crystallinity and scale
    for (let i = 0; i < 4000; i++) pipeline.tick(coherent, 1)

    // 2s of silence
    let result = pipeline.tick(silent, 1)
    for (let i = 0; i < 1999; i++) result = pipeline.tick(silent, 1)

    expect(result.crystallinity).toBeLessThan(0.1)
    expect(result.scale).toBeLessThan(1.1)
  })

  it('resets sustainedDuration on silence (scale drops on re-entry)', () => {
    const pipeline = new AudioMaterialPipeline()
    // 4s coherent
    for (let i = 0; i < 4000; i++) pipeline.tick(coherent, 1)
    // 3s silence (enough to fully reset)
    for (let i = 0; i < 3000; i++) pipeline.tick(silent, 1)
    const afterReset = pipeline.tick(silent, 1).scale
    expect(afterReset).toBeLessThan(1.05)
  })
})
