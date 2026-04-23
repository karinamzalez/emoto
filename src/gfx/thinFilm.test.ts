import { describe, it, expect } from 'vitest'
import { thinFilm } from './thinFilm'

describe('thinFilm', () => {
  it('returns values in [0, 1] for thinFilm(1.0, t) across t in [0, 1]', () => {
    for (let i = 0; i <= 20; i++) {
      const t = i / 20
      const [r, g, b] = thinFilm(1.0, t)
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThanOrEqual(1)
      expect(g).toBeGreaterThanOrEqual(0)
      expect(g).toBeLessThanOrEqual(1)
      expect(b).toBeGreaterThanOrEqual(0)
      expect(b).toBeLessThanOrEqual(1)
    }
  })

  it('cycles with t — not monotonic across thickness sweep', () => {
    const reds = Array.from({ length: 21 }, (_, i) => thinFilm(1.0, i / 20)[0])
    const hasIncrease = reds.some((v, i) => i > 0 && v > reds[i - 1])
    const hasDecrease = reds.some((v, i) => i > 0 && v < reds[i - 1])
    expect(hasIncrease).toBe(true)
    expect(hasDecrease).toBe(true)
  })

  it('returns 1 for all channels at zero thickness (constructive, white)', () => {
    const [r, g, b] = thinFilm(1.0, 0)
    expect(r).toBeCloseTo(1, 5)
    expect(g).toBeCloseTo(1, 5)
    expect(b).toBeCloseTo(1, 5)
  })

  it('grazing angle (cosTheta=0) produces smaller OPD variation than normal', () => {
    // At cosTheta=0, cosTheta_t = sqrt(1 - 1/n^2) < 1 → slower cycling
    const normalCycles = countCycles(1.0)
    const grazingCycles = countCycles(0.0)
    expect(grazingCycles).toBeLessThan(normalCycles)
  })
})

function countCycles(cosTheta: number): number {
  const samples = Array.from({ length: 100 }, (_, i) => thinFilm(cosTheta, i / 99)[0])
  let crossings = 0
  const mid = 0.5
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i - 1] - mid) * (samples[i] - mid) < 0) crossings++
  }
  return crossings
}
