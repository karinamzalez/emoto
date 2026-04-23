import { describe, it, expect } from 'vitest'
import { SpectralCentroidAnalyser } from './SpectralCentroidAnalyser'

const FFT_SIZE = 2048
const BIN_COUNT = FFT_SIZE / 2 // 1024
const SAMPLE_RATE = 44100
const HZ_PER_BIN = SAMPLE_RATE / FFT_SIZE // ~21.53 Hz

/** Build a fake AnalyserNode that returns the given Uint8Array on getByteFrequencyData */
function makeAnalyser(data: Uint8Array): AnalyserNode {
  return {
    frequencyBinCount: BIN_COUNT,
    getByteFrequencyData: (buf: Uint8Array) => buf.set(data),
  } as unknown as AnalyserNode
}

/** Build a frequency buffer with energy only at a single bin */
function impulseBinBuffer(bin: number, magnitude = 200): Uint8Array {
  const buf = new Uint8Array(BIN_COUNT).fill(0)
  buf[bin] = magnitude
  return buf
}

describe('SpectralCentroidAnalyser', () => {
  it('reports centroid at the exact bin frequency for a single-bin impulse', () => {
    const targetBin = 100
    const expectedHz = targetBin * HZ_PER_BIN
    const analyser = makeAnalyser(impulseBinBuffer(targetBin))
    const sca = new SpectralCentroidAnalyser(analyser, SAMPLE_RATE)
    // Large dt → alpha ≈ 1 so smoothed ≈ raw in one call
    const result = sca.read(100_000)
    expect(Math.abs(result - expectedHz) / expectedHz).toBeLessThan(0.05)
  })

  it('reports centroid midway between two equal-magnitude bins', () => {
    const binA = 50
    const binB = 150
    const expectedHz = ((binA + binB) / 2) * HZ_PER_BIN
    const buf = new Uint8Array(BIN_COUNT).fill(0)
    buf[binA] = 128
    buf[binB] = 128
    const analyser = makeAnalyser(buf)
    const sca = new SpectralCentroidAnalyser(analyser, SAMPLE_RATE)
    const result = sca.read(100_000)
    expect(Math.abs(result - expectedHz) / expectedHz).toBeLessThan(0.05)
  })

  it('returns 0 for a silent (all-zero) buffer', () => {
    const analyser = makeAnalyser(new Uint8Array(BIN_COUNT).fill(0))
    const sca = new SpectralCentroidAnalyser(analyser, SAMPLE_RATE)
    expect(sca.read(100_000)).toBe(0)
  })

  it('weighted toward dominant bin when two bins have different magnitudes', () => {
    const lowBin = 50
    const highBin = 500
    const buf = new Uint8Array(BIN_COUNT).fill(0)
    buf[lowBin] = 200 // dominant
    buf[highBin] = 50
    const analyser = makeAnalyser(buf)
    const sca = new SpectralCentroidAnalyser(analyser, SAMPLE_RATE)
    const result = sca.read(100_000)
    const lowHz = lowBin * HZ_PER_BIN
    const highHz = highBin * HZ_PER_BIN
    // centroid should be between the two bins, biased toward lowBin
    expect(result).toBeGreaterThan(lowHz)
    expect(result).toBeLessThan(highHz)
    expect(result).toBeLessThan((lowHz + highHz) / 2)
  })

  describe('smoothing (one-pole lowpass)', () => {
    it('reaches ~63% of a step in one tau', () => {
      const targetBin = 200
      const analyser = makeAnalyser(impulseBinBuffer(targetBin))
      const sca = new SpectralCentroidAnalyser(analyser, SAMPLE_RATE)
      sca.tau = 40

      const raw = targetBin * HZ_PER_BIN
      const result = sca.read(40)
      const expected = raw * (1 - Math.exp(-1))
      expect(Math.abs(result - expected) / expected).toBeLessThan(0.01)
    })

    it('accumulates smoothing across multiple reads', () => {
      const analyser = makeAnalyser(impulseBinBuffer(200))
      const sca = new SpectralCentroidAnalyser(analyser, SAMPLE_RATE)
      sca.tau = 40
      const first = sca.read(40)
      const second = sca.read(40)
      expect(second).toBeGreaterThan(first)
    })
  })
})
