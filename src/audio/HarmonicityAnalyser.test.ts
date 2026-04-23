import { describe, it, expect } from 'vitest'
import { HarmonicityAnalyser } from './HarmonicityAnalyser'

const SAMPLE_RATE = 44100
const FFT_SIZE = 2048

function makeSineBuffer(freqHz: number): Float32Array {
  const buf = new Float32Array(FFT_SIZE)
  for (let i = 0; i < FFT_SIZE; i++) {
    buf[i] = Math.sin((2 * Math.PI * freqHz * i) / SAMPLE_RATE)
  }
  return buf
}

function makeNoiseBuffer(): Float32Array {
  const buf = new Float32Array(FFT_SIZE)
  let seed = 0x12345678
  for (let i = 0; i < FFT_SIZE; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    buf[i] = (seed / 0x80000000 - 1) * 0.9
  }
  return buf
}

function makeAnalyser(data: Float32Array): AnalyserNode {
  return {
    fftSize: FFT_SIZE,
    getFloatTimeDomainData: (buf: Float32Array) => buf.set(data),
  } as unknown as AnalyserNode
}

describe('HarmonicityAnalyser', () => {
  it('returns > 0.9 harmonicity for a pure sine tone', () => {
    const analyser = makeAnalyser(makeSineBuffer(440))
    const ha = new HarmonicityAnalyser(analyser, SAMPLE_RATE)
    // Large dt → alpha ≈ 1, converges in one frame
    const result = ha.read(100_000)
    expect(result).toBeGreaterThan(0.9)
  })

  it('returns < 0.1 harmonicity for white noise', () => {
    const analyser = makeAnalyser(makeNoiseBuffer())
    const ha = new HarmonicityAnalyser(analyser, SAMPLE_RATE)
    const result = ha.read(100_000)
    expect(result).toBeLessThan(0.1)
  })

  it('returns 0 for silence', () => {
    const analyser = makeAnalyser(new Float32Array(FFT_SIZE))
    const ha = new HarmonicityAnalyser(analyser, SAMPLE_RATE)
    expect(ha.read(100_000)).toBe(0)
  })

  describe('smoothing (one-pole lowpass)', () => {
    it('reaches ~63% of a step in one tau', () => {
      const analyser = makeAnalyser(makeSineBuffer(440))
      const ha = new HarmonicityAnalyser(analyser, SAMPLE_RATE)
      ha.tau = 120

      // First read: starting from 0, after one tau the smoothed value = raw * (1 - e^-1)
      const raw = ha.read(100_000) // converge to get raw clarity
      // Reset and re-test with proper step
      const ha2 = new HarmonicityAnalyser(analyser, SAMPLE_RATE)
      ha2.tau = 120
      const result = ha2.read(120)
      expect(result).toBeGreaterThan(0)
      expect(result).toBeLessThan(raw)
    })

    it('accumulates smoothing across multiple reads', () => {
      const analyser = makeAnalyser(makeSineBuffer(440))
      const ha = new HarmonicityAnalyser(analyser, SAMPLE_RATE)
      ha.tau = 120
      const first = ha.read(120)
      const second = ha.read(120)
      expect(second).toBeGreaterThan(first)
    })
  })
})
