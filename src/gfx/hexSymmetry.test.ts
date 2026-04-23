import { describe, it, expect } from 'vitest'
import { HEX_WEDGE, toWedge, fromPolar } from './hexSymmetry'

const EPS = 1e-9

function approxEqual(a: [number, number], b: [number, number], tol = 1e-9): boolean {
  return Math.abs(a[0] - b[0]) < tol && Math.abs(a[1] - b[1]) < tol
}

describe('toWedge', () => {
  it('maps origin to origin', () => {
    expect(toWedge([0, 0])).toEqual([0, 0])
  })

  it('preserves points already inside the canonical wedge [0, PI/6]', () => {
    for (const theta of [0, Math.PI / 12, Math.PI / 8, Math.PI / 6 - EPS]) {
      const p = fromPolar(1, theta)
      const w = toWedge(p)
      expect(approxEqual(w, p, 1e-9)).toBe(true)
    }
  })

  it('has 6-fold rotational symmetry: toWedge(θ) == toWedge(θ + PI/3)', () => {
    const angles = [0.1, 0.5, 1.0, 1.7, 2.5, -0.4, -1.8, 3.0]
    for (const theta of angles) {
      for (const r of [0.2, 0.7, 1.3]) {
        const a = toWedge(fromPolar(r, theta))
        const b = toWedge(fromPolar(r, theta + HEX_WEDGE))
        expect(approxEqual(a, b, 1e-9)).toBe(true)
      }
    }
  })

  it('has reflective symmetry across the x-axis: toWedge(θ) == toWedge(-θ)', () => {
    const angles = [0.1, 0.5, 1.0, 2.3, 2.9]
    for (const theta of angles) {
      for (const r of [0.3, 1.0]) {
        const a = toWedge(fromPolar(r, theta))
        const b = toWedge(fromPolar(r, -theta))
        expect(approxEqual(a, b, 1e-9)).toBe(true)
      }
    }
  })

  it('folds all 12 symmetry-equivalent points to a single wedge point', () => {
    const r = 0.5
    const theta = Math.PI / 11
    const reference = toWedge(fromPolar(r, theta))
    for (let k = 0; k < 6; k++) {
      const rotated = toWedge(fromPolar(r, theta + k * HEX_WEDGE))
      const reflected = toWedge(fromPolar(r, -theta + k * HEX_WEDGE))
      expect(approxEqual(rotated, reference, 1e-9)).toBe(true)
      expect(approxEqual(reflected, reference, 1e-9)).toBe(true)
    }
  })

  it('preserves radius (fold is an isometry on the unit circle)', () => {
    for (const theta of [0.3, 1.2, 2.0, 3.0, -0.7]) {
      for (const r of [0.1, 0.5, 1.0, 2.7]) {
        const [x, y] = toWedge(fromPolar(r, theta))
        expect(Math.hypot(x, y)).toBeCloseTo(r, 9)
      }
    }
  })

  it('always outputs a point inside the canonical wedge [0, PI/6]', () => {
    for (let i = 0; i < 50; i++) {
      const theta = (i / 50) * Math.PI * 2 - Math.PI
      const [x, y] = toWedge(fromPolar(1, theta))
      const outAngle = Math.atan2(y, x)
      expect(outAngle).toBeGreaterThanOrEqual(-EPS)
      expect(outAngle).toBeLessThanOrEqual(Math.PI / 6 + EPS)
    }
  })
})
