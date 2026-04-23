import { describe, it, expect } from 'vitest'
import { AudioFeaturesSource } from './AudioFeaturesSource'

function makeAnalyser(): AnalyserNode {
  return {
    fftSize: 2048,
    frequencyBinCount: 1024,
    getByteTimeDomainData: (buf: Uint8Array) => buf.fill(128),
    getByteFrequencyData: (buf: Uint8Array) => buf.fill(0),
    getFloatTimeDomainData: (buf: Float32Array) => buf.fill(0),
  } as unknown as AnalyserNode
}

describe('AudioFeaturesSource', () => {
  it('returns all four features as a frame record', () => {
    const source = new AudioFeaturesSource(makeAnalyser(), 44100)
    const frame = source.read(16)
    expect(frame).toHaveProperty('rms')
    expect(frame).toHaveProperty('pitchHz')
    expect(frame).toHaveProperty('centroidHz')
    expect(frame).toHaveProperty('harmonicity')
  })

  it('pitchHz is null for silence', () => {
    const source = new AudioFeaturesSource(makeAnalyser(), 44100)
    const frame = source.read(100_000)
    expect(frame.pitchHz).toBeNull()
  })

  it('rms is near 0 for a silent buffer', () => {
    const source = new AudioFeaturesSource(makeAnalyser(), 44100)
    const frame = source.read(100_000)
    expect(frame.rms).toBeCloseTo(0, 2)
  })

  it('harmonicity is 0 for silence', () => {
    const source = new AudioFeaturesSource(makeAnalyser(), 44100)
    const frame = source.read(100_000)
    expect(frame.harmonicity).toBe(0)
  })

  it('centroidHz is 0 when all frequency bins are zero', () => {
    const source = new AudioFeaturesSource(makeAnalyser(), 44100)
    const frame = source.read(100_000)
    expect(frame.centroidHz).toBe(0)
  })
})
