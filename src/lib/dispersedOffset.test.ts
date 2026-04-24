import { describe, it, expect } from 'vitest'
import { dispersedOffset } from './dispersedOffset'

describe('dispersedOffset', () => {
  it('red channel is negative, green is zero, blue is positive at strength=1', () => {
    expect(dispersedOffset(0, 1)).toBeLessThan(0)
    expect(dispersedOffset(1, 1)).toBe(0)
    expect(dispersedOffset(2, 1)).toBeGreaterThan(0)
  })

  it('values are strictly ordered: red < green < blue', () => {
    const r = dispersedOffset(0, 0.5)
    const g = dispersedOffset(1, 0.5)
    const b = dispersedOffset(2, 0.5)
    expect(r).toBeLessThan(g)
    expect(g).toBeLessThan(b)
  })

  it('all channels return 0 when strength is 0', () => {
    expect(dispersedOffset(0, 0)).toBe(0)
    expect(dispersedOffset(1, 0)).toBe(0)
    expect(dispersedOffset(2, 0)).toBe(0)
  })

  it('red and blue offsets are symmetric around zero', () => {
    const r = dispersedOffset(0, 0.7)
    const b = dispersedOffset(2, 0.7)
    expect(r + b).toBeCloseTo(0, 10)
  })

  it('magnitude is monotonic in strength for non-neutral channels', () => {
    expect(Math.abs(dispersedOffset(0, 0.2))).toBeLessThan(Math.abs(dispersedOffset(0, 0.8)))
    expect(Math.abs(dispersedOffset(2, 0.2))).toBeLessThan(Math.abs(dispersedOffset(2, 0.8)))
  })

  it('distinct values per channel for any positive strength', () => {
    const vals = [dispersedOffset(0, 0.3), dispersedOffset(1, 0.3), dispersedOffset(2, 0.3)]
    const unique = new Set(vals)
    expect(unique.size).toBe(3)
  })
})
