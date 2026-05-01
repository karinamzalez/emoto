import { describe, it, expect } from 'vitest'
import { thicknessProfile, detectSubHexTips } from './CrystalMesh'

describe('thicknessProfile', () => {
  it('peaks at center (0.5, 0.5) with value 1.0', () => {
    expect(thicknessProfile(0.5, 0.5, 0.4)).toBeCloseTo(1.0, 5)
  })

  it('falls off radially: center > mid-edge > corner', () => {
    const center = thicknessProfile(0.5, 0.5, 0.4)
    const midEdge = thicknessProfile(0.5, 0.0, 0.4)
    const corner = thicknessProfile(0.0, 0.0, 0.4)
    expect(center).toBeGreaterThan(midEdge)
    expect(midEdge).toBeGreaterThan(corner)
  })

  it('matches reference value at mid-edge for sigma=0.4', () => {
    // du=0, dv=0.5 → exp(-0.25 / (2 * 0.16)) = exp(-0.78125)
    const expected = Math.exp(-0.25 / (2 * 0.4 * 0.4))
    expect(thicknessProfile(0.5, 0.0, 0.4)).toBeCloseTo(expected, 5)
  })

  it('is symmetric around center in both axes', () => {
    expect(thicknessProfile(0.3, 0.5, 0.4)).toBeCloseTo(thicknessProfile(0.7, 0.5, 0.4), 5)
    expect(thicknessProfile(0.5, 0.2, 0.4)).toBeCloseTo(thicknessProfile(0.5, 0.8, 0.4), 5)
  })

  it('is rotationally symmetric: equal radius → equal value', () => {
    // (0.5+r, 0.5) and (0.5, 0.5+r) share the same radius
    const r = 0.3
    expect(thicknessProfile(0.5 + r, 0.5, 0.4)).toBeCloseTo(thicknessProfile(0.5, 0.5 + r, 0.4), 5)
  })

  it('smaller sigma produces sharper falloff', () => {
    const atEdge_wide = thicknessProfile(0.5, 0.0, 0.8)
    const atEdge_sharp = thicknessProfile(0.5, 0.0, 0.2)
    expect(atEdge_wide).toBeGreaterThan(atEdge_sharp)
  })
})

describe('detectSubHexTips', () => {
  it('finds isolated local maxima above threshold', () => {
    const W = 10,
      H = 10
    const density = new Float32Array(W * H).fill(0.5)
    density[5 * W + 5] = 0.95
    density[2 * W + 3] = 0.9

    const tips = detectSubHexTips(density, W, H)
    expect(tips).toHaveLength(2)
    expect(tips).toContainEqual({ col: 5, row: 5 })
    expect(tips).toContainEqual({ col: 3, row: 2 })
  })

  it('ignores cells below threshold', () => {
    const W = 8,
      H = 8
    const density = new Float32Array(W * H).fill(0.8)
    const tips = detectSubHexTips(density, W, H)
    expect(tips).toHaveLength(0)
  })

  it('ignores non-local-maxima (cell has neighbor with equal-or-higher density)', () => {
    const W = 8,
      H = 8
    const density = new Float32Array(W * H).fill(0.5)
    // Two vertically adjacent high-density cells; (row=4,col=4) has neighbor (row=3,col=4)=0.97
    density[4 * W + 4] = 0.95
    density[3 * W + 4] = 0.97 // higher → (4,4) is NOT a local max

    const tips = detectSubHexTips(density, W, H)
    expect(tips).not.toContainEqual({ col: 4, row: 4 })
    expect(tips).toContainEqual({ col: 4, row: 3 })
  })

  it('excludes 1-cell border from candidates', () => {
    const W = 8,
      H = 8
    const density = new Float32Array(W * H).fill(0.5)
    density[0 * W + 0] = 0.99 // top-left border
    density[0 * W + 4] = 0.99 // top-edge border
    density[4 * W + 0] = 0.99 // left-edge border

    const tips = detectSubHexTips(density, W, H)
    expect(tips).toHaveLength(0)
  })

  it('custom threshold is respected', () => {
    const W = 8,
      H = 8
    const density = new Float32Array(W * H).fill(0.5)
    density[4 * W + 4] = 0.75 // above 0.7 but below default 0.85

    const withDefault = detectSubHexTips(density, W, H, 0.85)
    const withLower = detectSubHexTips(density, W, H, 0.7)
    expect(withDefault).toHaveLength(0)
    expect(withLower).toContainEqual({ col: 4, row: 4 })
  })
})
