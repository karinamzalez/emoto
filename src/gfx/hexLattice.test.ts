import { describe, it, expect } from 'vitest'
import { hexSDF, hexTile } from './hexLattice'

describe('hexSDF', () => {
  it('returns negative at the origin (inside)', () => {
    expect(hexSDF(0, 0, 1)).toBeLessThan(0)
  })

  it('returns approximately -r at the center (distance to nearest edge)', () => {
    expect(hexSDF(0, 0, 1)).toBeCloseTo(-1, 5)
    expect(hexSDF(0, 0, 0.5)).toBeCloseTo(-0.5, 5)
  })

  it('returns 0 at the top apothem point (on the edge)', () => {
    expect(hexSDF(0, 1, 1)).toBeCloseTo(0, 5)
  })

  it('returns positive outside the hexagon', () => {
    expect(hexSDF(0, 2, 1)).toBeGreaterThan(0)
    expect(hexSDF(2, 0, 1)).toBeGreaterThan(0)
    expect(hexSDF(1.5, 1.5, 1)).toBeGreaterThan(0)
  })

  it('matches a reference value at the circumradius vertex', () => {
    // Circumradius = r / cos(30°) = r * 2/sqrt(3) ≈ r * 1.1547
    // At the vertex the SDF is 0 (on the boundary).
    const r = 1
    const circumR = r / 0.8660254
    expect(hexSDF(circumR, 0, r)).toBeCloseTo(0, 4)
  })

  it('has mirror symmetry: hexSDF(p) == hexSDF(-p)', () => {
    for (const [x, y] of [
      [0.3, 0.5],
      [-0.1, 0.8],
      [1.2, -0.4],
    ]) {
      expect(hexSDF(x, y, 1)).toBeCloseTo(hexSDF(-x, -y, 1), 9)
    }
  })

  it('has 60° rotational symmetry', () => {
    const r = 1
    const p = [0.4, 0.2]
    const ref = hexSDF(p[0], p[1], r)
    for (let k = 1; k < 6; k++) {
      const a = (k * Math.PI) / 3
      const rx = p[0] * Math.cos(a) - p[1] * Math.sin(a)
      const ry = p[0] * Math.sin(a) + p[1] * Math.cos(a)
      expect(hexSDF(rx, ry, r)).toBeCloseTo(ref, 5)
    }
  })
})

describe('hexTile', () => {
  it('maps origin to origin', () => {
    const [x, y] = hexTile(0, 0, 1)
    expect(x).toBeCloseTo(0, 9)
    expect(y).toBeCloseTo(0, 9)
  })

  it('is periodic: hexTile(p) == hexTile(p + latticeVector)', () => {
    const scale = 0.2
    const [lx, ly] = hexTile(0.15, 0.08, scale)
    // Shift by one full lattice period in x (scale * 1.0)
    const [lx2, ly2] = hexTile(0.15 + scale, 0.08, scale)
    expect(lx).toBeCloseTo(lx2, 6)
    expect(ly).toBeCloseTo(ly2, 6)
  })

  it('composing hexSDF(hexTile(p)) < 0 for interior sample', () => {
    // Any point should land inside its own cell (SDF < 0)
    for (const [x, y] of [
      [0.0, 0.0],
      [0.05, 0.03],
      [0.3, 0.2],
      [-0.15, 0.1],
    ]) {
      const scale = 0.2
      const [cx, cy] = hexTile(x, y, scale)
      const sdf = hexSDF(cx, cy, scale * 0.5)
      expect(sdf).toBeLessThan(0)
    }
  })
})
