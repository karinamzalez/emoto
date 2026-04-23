import { describe, expect, it } from 'vitest'
import { fresnel } from './fresnel'

describe('fresnel', () => {
  it('is monotonically decreasing in edgeDist', () => {
    const power = 2.0
    for (let i = 0; i < 9; i++) {
      const e0 = i * 0.1
      const e1 = (i + 1) * 0.1
      expect(fresnel(e0, power)).toBeGreaterThan(fresnel(e1, power))
    }
  })

  it('returns 1 at silhouette edge (edgeDist = 0)', () => {
    expect(fresnel(0, 2.0)).toBeCloseTo(1.0)
  })

  it('returns 0 at center (edgeDist = 1)', () => {
    expect(fresnel(1, 2.0)).toBeCloseTo(0.0)
  })

  it('clamps gracefully for edgeDist > 1', () => {
    expect(fresnel(1.5, 2.0)).toBe(0)
  })
})
