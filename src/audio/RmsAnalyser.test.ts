import { describe, it, expect } from 'vitest'
import { RmsAnalyser } from './RmsAnalyser'

const FFT_SIZE = 2048

/** Build a fake AnalyserNode that returns the given Uint8Array on getByteTimeDomainData */
function makeAnalyser(data: Uint8Array): AnalyserNode {
  return {
    fftSize: FFT_SIZE,
    getByteTimeDomainData: (buf: Uint8Array) => buf.set(data),
  } as unknown as AnalyserNode
}

/** Fill a Uint8Array with one full cycle of a sine wave at the given amplitude (0..1) */
function sineBuffer(amplitude: number, size = FFT_SIZE): Uint8Array {
  const buf = new Uint8Array(size)
  for (let i = 0; i < size; i++) {
    // sin ranges -1..1; scale by amplitude, convert to 0-255 around center 128
    buf[i] = Math.round(128 + amplitude * 128 * Math.sin((2 * Math.PI * i) / size))
  }
  return buf
}

/** Fill a Uint8Array with a constant signed value mapped to Uint8 */
function constantBuffer(value: number, size = FFT_SIZE): Uint8Array {
  const buf = new Uint8Array(size)
  buf.fill(Math.round(128 + value * 128))
  return buf
}

describe('RmsAnalyser', () => {
  it('reports RMS of a full-scale sine wave within 5% of √2/2', () => {
    const analyser = makeAnalyser(sineBuffer(1.0))
    const rms = new RmsAnalyser(analyser)
    // Large dt → alpha ≈ 1 so smoothed ≈ raw in one call
    const result = rms.read(10_000)
    const expected = Math.SQRT2 / 2 // ≈ 0.7071
    expect(result).toBeCloseTo(expected, 1) // within ~5%
  })

  it('reports RMS of a half-amplitude sine wave within 5% of expected', () => {
    const analyser = makeAnalyser(sineBuffer(0.5))
    const rms = new RmsAnalyser(analyser)
    const result = rms.read(10_000)
    const expected = 0.5 * (Math.SQRT2 / 2) // ≈ 0.3536
    expect(Math.abs(result - expected) / expected).toBeLessThan(0.05)
  })

  it('reports near-zero RMS for a silent (center) buffer', () => {
    const buf = new Uint8Array(FFT_SIZE).fill(128)
    const analyser = makeAnalyser(buf)
    const rms = new RmsAnalyser(analyser)
    const result = rms.read(10_000)
    expect(result).toBeCloseTo(0, 3)
  })

  describe('smoothing (one-pole lowpass)', () => {
    it('reaches ~63% of a step in one tau', () => {
      // Step from 0 to 1: use a constant buffer with value 1.0 (full scale DC)
      // Raw RMS of constant 1.0 signal = 1.0
      const analyser = makeAnalyser(constantBuffer(1.0))
      const rms = new RmsAnalyser(analyser)
      rms.tau = 80 // ms

      // After exactly one tau, one-pole filter should be at (1 - e^-1) ≈ 0.6321
      const result = rms.read(80)
      const expected = 1 - Math.exp(-1) // ≈ 0.6321
      expect(Math.abs(result - expected)).toBeLessThan(0.01)
    })

    it('tau is configurable', () => {
      const analyser = makeAnalyser(constantBuffer(1.0))
      const rms = new RmsAnalyser(analyser)
      rms.tau = 160

      // After 80ms (half tau), should be ~1 - e^(-0.5) ≈ 0.3935
      const result = rms.read(80)
      const expected = 1 - Math.exp(-0.5)
      expect(Math.abs(result - expected)).toBeLessThan(0.01)
    })

    it('accumulates smoothing across multiple reads', () => {
      const analyser = makeAnalyser(constantBuffer(1.0))
      const rms = new RmsAnalyser(analyser)
      rms.tau = 80

      // Two reads of 80ms each → should be closer to 1 than after one read
      const first = rms.read(80)
      const second = rms.read(80)
      expect(second).toBeGreaterThan(first)
    })
  })
})
