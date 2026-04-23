import { describe, it, expect } from 'vitest'
import { YinDetector } from './YinDetector'

const SAMPLE_RATE = 44100
const FRAME_SIZE = 2048

function sineBuffer(freqHz: number, sampleRate = SAMPLE_RATE, size = FRAME_SIZE): Float32Array {
  const buf = new Float32Array(size)
  for (let i = 0; i < size; i++) {
    buf[i] = Math.sin((2 * Math.PI * freqHz * i) / sampleRate)
  }
  return buf
}

function whiteNoiseBuffer(size = FRAME_SIZE): Float32Array {
  const buf = new Float32Array(size)
  // Deterministic pseudo-noise using a simple LCG so tests are repeatable
  let seed = 0x12345678
  for (let i = 0; i < size; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    buf[i] = (seed / 0x80000000 - 1) * 0.9
  }
  return buf
}

describe('YinDetector', () => {
  const yin = new YinDetector(SAMPLE_RATE, FRAME_SIZE)

  it('detects 220 Hz within ±2%', () => {
    const pitch = yin.detect(sineBuffer(220))
    expect(pitch).not.toBeNull()
    expect(Math.abs(pitch! - 220) / 220).toBeLessThan(0.02)
  })

  it('detects 440 Hz within ±2%', () => {
    const pitch = yin.detect(sineBuffer(440))
    expect(pitch).not.toBeNull()
    expect(Math.abs(pitch! - 440) / 440).toBeLessThan(0.02)
  })

  it('detects 660 Hz within ±2%', () => {
    const pitch = yin.detect(sineBuffer(660))
    expect(pitch).not.toBeNull()
    expect(Math.abs(pitch! - 660) / 660).toBeLessThan(0.02)
  })

  it('returns null for white noise', () => {
    const pitch = yin.detect(whiteNoiseBuffer())
    expect(pitch).toBeNull()
  })

  it('returns null for silence', () => {
    const pitch = yin.detect(new Float32Array(FRAME_SIZE))
    expect(pitch).toBeNull()
  })

  it('returns null for out-of-range frequency (below 80 Hz)', () => {
    // 50 Hz is below the voice range floor
    const pitch = yin.detect(sineBuffer(50))
    expect(pitch).toBeNull()
  })
})
