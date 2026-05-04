import { describe, it, expect } from 'vitest'
import { pitchToIor, centroidToThicknessDelta, PROP_EASING } from '../defaults'
import { AudioMaterialPipeline } from '../pipeline'
import type { AudioFeatures } from '../../audio/AudioFeaturesSource'

const silent: AudioFeatures = { rms: 0, pitchHz: null, centroidHz: 0, harmonicity: 0 }

// ─── DRE-37: pitchToIor ────────────────────────────────────────────────────

describe('pitchToIor', () => {
  it('returns water default (1.33) for null pitch', () => {
    expect(pitchToIor(null)).toBeCloseTo(1.33, 3)
  })

  it('maps 220 Hz to mid-range IOR', () => {
    const ior = pitchToIor(220)
    expect(ior).toBeGreaterThan(1.33)
    expect(ior).toBeLessThan(1.67) // below midpoint of [1.33, 2.00]
  })

  it('maps 660 Hz near the high end', () => {
    const ior = pitchToIor(660)
    expect(ior).toBeGreaterThan(1.85)
    expect(ior).toBeLessThanOrEqual(2.0)
  })

  it('is monotonically increasing with pitch', () => {
    expect(pitchToIor(200)).toBeLessThan(pitchToIor(400))
    expect(pitchToIor(400)).toBeLessThan(pitchToIor(600))
  })

  it('clamps at range boundaries', () => {
    expect(pitchToIor(10)).toBeCloseTo(1.33, 2)
    expect(pitchToIor(9999)).toBeCloseTo(2.0, 2)
  })
})

// ─── DRE-38: centroidToThicknessDelta ─────────────────────────────────────

describe('centroidToThicknessDelta', () => {
  it('produces negative delta at low centroid (dark vowels)', () => {
    expect(centroidToThicknessDelta(400)).toBeLessThan(0)
  })

  it('produces positive delta at high centroid (bright vowels)', () => {
    expect(centroidToThicknessDelta(4000)).toBeGreaterThan(0)
  })

  it('produces opposite-sign deltas at the range endpoints', () => {
    const low = centroidToThicknessDelta(400)
    const high = centroidToThicknessDelta(4000)
    expect(Math.sign(low)).not.toBe(Math.sign(high))
  })

  it('is monotonically increasing', () => {
    expect(centroidToThicknessDelta(500)).toBeLessThan(centroidToThicknessDelta(1000))
    expect(centroidToThicknessDelta(1000)).toBeLessThan(centroidToThicknessDelta(2000))
    expect(centroidToThicknessDelta(2000)).toBeLessThan(centroidToThicknessDelta(3000))
  })
})

// ─── DRE-36: displacement pipeline ────────────────────────────────────────

describe('displacement (DRE-36)', () => {
  it('stays at 0 when rms is below noise floor', () => {
    const pipeline = new AudioMaterialPipeline()
    const result = pipeline.tick({ rms: 0.01, pitchHz: null, centroidHz: 0, harmonicity: 0 }, 16)
    expect(result.displacement).toBe(0)
  })

  it('rises toward target with sustained rms above noise floor', () => {
    const pipeline = new AudioMaterialPipeline()
    const features: AudioFeatures = { rms: 0.5, pitchHz: null, centroidHz: 0, harmonicity: 0 }
    for (let i = 0; i < 2000; i++) pipeline.tick(features, 1)
    const result = pipeline.tick(features, 1)
    expect(result.displacement).toBeGreaterThan(0.3)
  })

  it('decays to near-zero after silence following sustained sound', () => {
    const pipeline = new AudioMaterialPipeline()
    const loud: AudioFeatures = { rms: 1, pitchHz: null, centroidHz: 0, harmonicity: 0 }
    for (let i = 0; i < 1000; i++) pipeline.tick(loud, 1)
    for (let i = 0; i < 2000; i++) pipeline.tick(silent, 1)
    expect(pipeline.tick(silent, 1).displacement).toBeLessThan(0.01)
  })
})

// ─── DRE-39: harmonicity → crystallinity ──────────────────────────────────

describe('crystallinity (DRE-39)', () => {
  it('reaches > 0.8 within 200ms of harmonicity=0.9 input (1ms ticks)', () => {
    const pipeline = new AudioMaterialPipeline()
    const features: AudioFeatures = { rms: 0.5, pitchHz: null, centroidHz: 0, harmonicity: 0.9 }
    let result = pipeline.tick(features, 1)
    for (let i = 0; i < 199; i++) result = pipeline.tick(features, 1)
    expect(result.crystallinity).toBeGreaterThan(0.8)
  })

  it('decays below 0.1 within 3 release time constants after harmonicity drops to 0', () => {
    const pipeline = new AudioMaterialPipeline()
    const voiced: AudioFeatures = { rms: 0.5, pitchHz: null, centroidHz: 0, harmonicity: 1 }
    // Converge crystallinity to near 1
    for (let i = 0; i < 5000; i++) pipeline.tick(voiced, 1)
    // Drop to silence and run for 3× release (3 × 800ms = 2400ms)
    for (let i = 0; i < 2400; i++) pipeline.tick(silent, 1)
    expect(pipeline.tick(silent, 1).crystallinity).toBeLessThan(0.1)
  })

  it('dims iridescence when harmonicity is low', () => {
    const pipeline = new AudioMaterialPipeline()
    const voiced: AudioFeatures = { rms: 0.5, pitchHz: null, centroidHz: 0, harmonicity: 1 }
    const noisy: AudioFeatures = { rms: 0.5, pitchHz: null, centroidHz: 0, harmonicity: 0 }
    for (let i = 0; i < 5000; i++) pipeline.tick(voiced, 1)
    const voicedIridescence = pipeline.tick(voiced, 1).iridescence
    // Reset pipeline and converge on noisy
    const pipeline2 = new AudioMaterialPipeline()
    for (let i = 0; i < 5000; i++) pipeline2.tick(noisy, 1)
    const noisyIridescence = pipeline2.tick(noisy, 1).iridescence
    expect(voicedIridescence).toBeGreaterThan(noisyIridescence)
  })
})

// ─── DRE-39: harmonicity → caGrowthRate ───────────────────────────────────

describe('caGrowthRate (DRE-39)', () => {
  it('reaches > 0.8 within 200ms of harmonicity=0.9 input (1ms ticks)', () => {
    const pipeline = new AudioMaterialPipeline()
    const features: AudioFeatures = { rms: 0.5, pitchHz: null, centroidHz: 0, harmonicity: 0.9 }
    let result = pipeline.tick(features, 1)
    for (let i = 0; i < 199; i++) result = pipeline.tick(features, 1)
    expect(result.caGrowthRate).toBeGreaterThan(0.8)
  })

  it('decays below 0.1 within 3 release time constants after harmonicity drops to 0', () => {
    const pipeline = new AudioMaterialPipeline()
    const voiced: AudioFeatures = { rms: 0.5, pitchHz: null, centroidHz: 0, harmonicity: 1 }
    for (let i = 0; i < 5000; i++) pipeline.tick(voiced, 1)
    // 3 × 800ms release = 2400ms
    for (let i = 0; i < 2400; i++) pipeline.tick(silent, 1)
    expect(pipeline.tick(silent, 1).caGrowthRate).toBeLessThan(0.1)
  })

  it('respects independently tunable release: slower release decays more slowly', () => {
    const originalAttack = PROP_EASING.caGrowthRate.attackMs
    const originalRelease = PROP_EASING.caGrowthRate.releaseMs
    const voiced: AudioFeatures = { rms: 0.5, pitchHz: null, centroidHz: 0, harmonicity: 1 }

    // Fast release pipeline
    PROP_EASING.caGrowthRate.releaseMs = 100
    const fastPipeline = new AudioMaterialPipeline()
    for (let i = 0; i < 5000; i++) fastPipeline.tick(voiced, 1)
    for (let i = 0; i < 500; i++) fastPipeline.tick(silent, 1)
    const fastVal = fastPipeline.tick(silent, 1).caGrowthRate

    // Slow release pipeline
    PROP_EASING.caGrowthRate.releaseMs = 2000
    const slowPipeline = new AudioMaterialPipeline()
    for (let i = 0; i < 5000; i++) slowPipeline.tick(voiced, 1)
    for (let i = 0; i < 500; i++) slowPipeline.tick(silent, 1)
    const slowVal = slowPipeline.tick(silent, 1).caGrowthRate

    // Restore
    PROP_EASING.caGrowthRate.attackMs = originalAttack
    PROP_EASING.caGrowthRate.releaseMs = originalRelease

    expect(slowVal).toBeGreaterThan(fastVal)
  })
})
