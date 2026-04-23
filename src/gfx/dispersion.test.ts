import { describe, it, expect } from 'vitest'
import { dispersedOffset } from './dispersion'

describe('dispersedOffset', () => {
  it('returns distinct offsets for each channel at non-zero strength', () => {
    const r = dispersedOffset(0, 0.5)
    const g = dispersedOffset(1, 0.5)
    const b = dispersedOffset(2, 0.5)
    expect(r).not.toBe(g)
    expect(g).not.toBe(b)
    expect(r).not.toBe(b)
  })

  it('green channel always returns 0 regardless of strength', () => {
    expect(dispersedOffset(1, 0)).toBe(0)
    expect(dispersedOffset(1, 0.5)).toBe(0)
    expect(dispersedOffset(1, 1)).toBe(0)
  })

  it('R and B are symmetric opposites', () => {
    const strengths = [0.1, 0.5, 1.0]
    for (const s of strengths) {
      expect(dispersedOffset(0, s)).toBeCloseTo(-dispersedOffset(2, s), 10)
    }
  })

  it('offsets scale linearly with strength', () => {
    expect(dispersedOffset(0, 0.5)).toBeCloseTo(dispersedOffset(0, 1.0) * 0.5, 10)
    expect(dispersedOffset(2, 0.5)).toBeCloseTo(dispersedOffset(2, 1.0) * 0.5, 10)
  })

  it('returns zero for all channels when strength is 0', () => {
    expect(dispersedOffset(0, 0)).toBeCloseTo(0, 10)
    expect(dispersedOffset(1, 0)).toBeCloseTo(0, 10)
    expect(dispersedOffset(2, 0)).toBeCloseTo(0, 10)
  })
})
