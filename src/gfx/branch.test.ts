import { describe, it, expect } from 'vitest'
import { smin, branchField } from './branch'
import { hexSDF, hexTile } from './hexLattice'

describe('smin', () => {
  it('returns the smaller value when inputs are far apart', () => {
    expect(smin(1, 10, 0.1)).toBeCloseTo(1, 3)
    expect(smin(10, 1, 0.1)).toBeCloseTo(1, 3)
  })

  it('is commutative: smin(a, b) == smin(b, a)', () => {
    const k = 0.5
    for (const [a, b] of [
      [0.3, 0.8],
      [-0.2, 0.4],
      [1.0, 1.0],
    ]) {
      expect(smin(a, b, k)).toBeCloseTo(smin(b, a, k), 9)
    }
  })

  it('always returns ≤ min(a, b)', () => {
    const k = 0.3
    for (const [a, b] of [
      [0.5, 0.9],
      [0.1, 0.2],
      [-0.5, 0.1],
    ]) {
      expect(smin(a, b, k)).toBeLessThanOrEqual(Math.min(a, b) + 1e-9)
    }
  })

  it('converges to exact min as k → 0', () => {
    expect(smin(0.3, 0.8, 1e-6)).toBeCloseTo(0.3, 5)
  })
})

describe('branchField', () => {
  it('collapses to hexSDF when growth=0 (identity)', () => {
    const apothem = 0.1
    const samples: Array<[number, number]> = [
      [0, 0],
      [0.05, 0.02],
      [0.08, -0.04],
      [-0.03, 0.06],
      [0.0, 0.09],
    ]
    for (const [x, y] of samples) {
      const [cx, cy] = hexTile(x, y, apothem * 2)
      expect(branchField(cx, cy, apothem, 0)).toBeCloseTo(hexSDF(cx, cy, apothem), 9)
    }
  })

  it('returns a smaller (or equal) SDF value than hexSDF at growth > 0', () => {
    const apothem = 0.1
    const growth = 0.8
    // Near a vertex direction (θ ≈ 0) the branch should expand the boundary
    const [cx, cy] = hexTile(apothem * 0.9, 0, apothem * 2)
    const base = hexSDF(cx, cy, apothem)
    const branched = branchField(cx, cy, apothem, growth)
    expect(branched).toBeLessThanOrEqual(base + 1e-9)
  })

  it('at growth=1 near a vertex direction the effective boundary extends further', () => {
    // A point just outside the plain hex boundary (hexSDF > 0) at a vertex
    // direction should be pulled inside the branch field (branchField < 0).
    const apothem = 0.5
    const circumR = apothem * 1.1547
    // Slightly beyond circumradius in the x-direction (vertex direction)
    const px = circumR * 1.3
    const py = 0.0
    expect(hexSDF(px, py, apothem)).toBeGreaterThan(0) // outside plain hex
    expect(branchField(px, py, apothem, 1.0)).toBeLessThan(0) // inside branch
  })

  it('away from vertex directions growth has diminished effect', () => {
    const apothem = 0.5
    // 30° is the edge-midpoint direction — petals = cos(6*π/6)^2 = cos(π)^2 = 1?
    // Wait: at 30° = π/6, cos(6 * π/6) = cos(π) = -1, max(0, -1)^2 = 0.
    // So petals = 0 → no branch effect at the edge-midpoint direction.
    const theta = Math.PI / 6 // 30° — edge midpoint
    const r = apothem * 1.2
    const px = r * Math.cos(theta)
    const py = r * Math.sin(theta)
    const base = hexSDF(px, py, apothem)
    const branched = branchField(px, py, apothem, 1.0)
    expect(Math.abs(branched - base)).toBeLessThan(1e-6) // no effect at edge midpoints
  })
})
