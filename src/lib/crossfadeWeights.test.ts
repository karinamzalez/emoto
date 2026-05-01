import { describe, it, expect } from 'vitest'
import { crossfadeWeights } from './crossfadeWeights'

describe('crossfadeWeights', () => {
  it('returns sum ≥ 0.95 across the full 0..1 range (no transparent gap mid-transition)', () => {
    for (let i = 0; i <= 100; i++) {
      const { droplet, crystal } = crossfadeWeights(i / 100)
      expect(droplet + crystal).toBeGreaterThanOrEqual(0.95)
    }
  })

  it('at crystallinity=0: droplet=1, crystal=0', () => {
    const { droplet, crystal } = crossfadeWeights(0)
    expect(droplet).toBe(1)
    expect(crystal).toBe(0)
  })

  it('at crystallinity=1: droplet=0, crystal=1', () => {
    const { droplet, crystal } = crossfadeWeights(1)
    expect(droplet).toBe(0)
    expect(crystal).toBe(1)
  })

  it('weights are monotone (droplet decreasing, crystal increasing)', () => {
    let prevDroplet = 1
    let prevCrystal = 0
    for (let i = 1; i <= 100; i++) {
      const { droplet, crystal } = crossfadeWeights(i / 100)
      expect(droplet).toBeLessThanOrEqual(prevDroplet)
      expect(crystal).toBeGreaterThanOrEqual(prevCrystal)
      prevDroplet = droplet
      prevCrystal = crystal
    }
  })
})
