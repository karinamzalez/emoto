import { describe, it, expect } from 'vitest'
import { onePole } from '../easing'

describe('onePole', () => {
  it('reaches 63.2% of target in one attack time constant', () => {
    const attackMs = 100
    const releaseMs = 400
    // After dt = attackMs, a rising signal should reach 1 - exp(-1) ≈ 0.632
    const result = onePole(0, 1, attackMs, releaseMs, attackMs)
    expect(result).toBeCloseTo(1 - Math.exp(-1), 2)
  })

  it('decays to 36.8% of start in one release time constant', () => {
    const attackMs = 100
    const releaseMs = 400
    // After dt = releaseMs, a falling signal should reach exp(-1) ≈ 0.368
    const result = onePole(1, 0, attackMs, releaseMs, releaseMs)
    expect(result).toBeCloseTo(Math.exp(-1), 2)
  })

  it('uses attack tau when rising', () => {
    const fast = onePole(0, 1, 50, 400, 50)
    const slow = onePole(0, 1, 200, 400, 50)
    expect(fast).toBeGreaterThan(slow)
  })

  it('uses release tau when falling', () => {
    const fast = onePole(1, 0, 100, 50, 50)
    const slow = onePole(1, 0, 100, 400, 50)
    expect(fast).toBeLessThan(slow)
  })

  it('attack time constant matches within 10%', () => {
    const attackMs = 100
    // Simulate many small steps summing to attackMs, measuring when value crosses 63.2%
    let value = 0
    let elapsed = 0
    const dt = 1
    const TARGET = 1 - Math.exp(-1) // 63.2%
    while (value < TARGET && elapsed < attackMs * 3) {
      value = onePole(value, 1, attackMs, 400, dt)
      elapsed += dt
    }
    expect(elapsed).toBeGreaterThan(attackMs * 0.9)
    expect(elapsed).toBeLessThan(attackMs * 1.1)
  })

  it('release time constant matches within 10%', () => {
    const releaseMs = 400
    // Simulate many small steps summing to releaseMs, measuring when value crosses 36.8%
    let value = 1
    let elapsed = 0
    const dt = 1
    const TARGET = Math.exp(-1) // 36.8%
    while (value > TARGET && elapsed < releaseMs * 3) {
      value = onePole(value, 0, 100, releaseMs, dt)
      elapsed += dt
    }
    expect(elapsed).toBeGreaterThan(releaseMs * 0.9)
    expect(elapsed).toBeLessThan(releaseMs * 1.1)
  })
})
