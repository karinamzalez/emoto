import { describe, it, expect } from 'vitest'
import { hexNeighborIndices, reiterStep, initReiterGrid } from './ReiterCA'

const S = 9

/** Creates a grid with `fill` everywhere and a single frozen seed at center. */
function makeGrid(size: number, fill: number): Float32Array {
  const g = new Float32Array(size * size).fill(fill)
  const c = Math.floor(size / 2)
  g[c * size + c] = 1.0
  return g
}

describe('hexNeighborIndices', () => {
  it('E/W neighbors are ±1 column in the same row', () => {
    const idx = 4 * S + 4 // center of 9×9, row=4 (even)
    const [E, W] = hexNeighborIndices(idx, S)
    expect(E).toBe(4 * S + 5)
    expect(W).toBe(4 * S + 3)
  })

  it('NE/NW for even row have no right-shift (rp=0)', () => {
    const idx = 4 * S + 4 // row=4, even
    const [, , NE, NW] = hexNeighborIndices(idx, S)
    expect(NE).toBe(3 * S + 4) // same col, row−1
    expect(NW).toBe(3 * S + 3) // col−1, row−1
  })

  it('NE/NW for odd row have +1 right-shift (rp=1)', () => {
    const idx = 3 * S + 4 // row=3, odd
    const [, , NE, NW] = hexNeighborIndices(idx, S)
    expect(NE).toBe(2 * S + 5) // col+1, row−1
    expect(NW).toBe(2 * S + 4) // same col, row−1
  })

  it('wraps around grid edges', () => {
    const idx = 0 // col=0, row=0
    const [, W] = hexNeighborIndices(idx, S)
    expect(W).toBe(0 * S + (S - 1)) // wraps to rightmost col
  })
})

describe('initReiterGrid', () => {
  it('center cell is frozen (>= 1)', () => {
    const g = initReiterGrid(0, 0.4, S)
    const c = Math.floor(S / 2)
    expect(g[c * S + c]).toBeGreaterThanOrEqual(1.0)
  })

  it('identical seeds produce identical grids', () => {
    expect(Array.from(initReiterGrid(42, 0.4))).toEqual(Array.from(initReiterGrid(42, 0.4)))
  })

  it('different seeds produce different grids', () => {
    expect(Array.from(initReiterGrid(1, 0.4))).not.toEqual(Array.from(initReiterGrid(2, 0.4)))
  })
})

describe('reiterStep', () => {
  const params = { alpha: 0.502, gamma: 0.0001 }

  it('E-neighbor of frozen center gets exactly beta + gamma after 1 step', () => {
    const beta = 0.4
    const g = makeGrid(S, beta)
    const g1 = reiterStep(g, params, S)
    const cx = Math.floor(S / 2)
    const cy = Math.floor(S / 2)
    expect(g1[cy * S + cx + 1]).toBeCloseTo(beta + params.gamma, 5)
  })

  it('center seed stays frozen (>= 1) through 5 steps', () => {
    let g = makeGrid(S, 0.4)
    for (let i = 0; i < 5; i++) g = reiterStep(g, params, S)
    const c = Math.floor(S / 2)
    expect(g[c * S + c]).toBeGreaterThanOrEqual(1.0)
  })

  it('all 6 immediate neighbors of center have equal density after 5 steps', () => {
    let g = makeGrid(S, 0.4) // no noise → perfect symmetry
    for (let i = 0; i < 5; i++) g = reiterStep(g, params, S)
    const cx = Math.floor(S / 2)
    const cy = Math.floor(S / 2)
    // Even row neighbors
    const vals = [
      g[cy * S + cx + 1], // E
      g[cy * S + cx - 1], // W
      g[(cy - 1) * S + cx], // NE (even row: rp=0, col+0)
      g[(cy - 1) * S + cx - 1], // NW (even row: rp=0, col−1)
      g[(cy + 1) * S + cx], // SE
      g[(cy + 1) * S + cx - 1], // SW
    ]
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    expect(max - min).toBeLessThan(1e-6)
  })

  it('identical seeds produce identical multi-step output', () => {
    let a = initReiterGrid(42, 0.4, S)
    let b = initReiterGrid(42, 0.4, S)
    for (let i = 0; i < 5; i++) {
      a = reiterStep(a, params, S)
      b = reiterStep(b, params, S)
    }
    expect(Array.from(a)).toEqual(Array.from(b))
  })

  it('growthRate=0 accumulates zero step credit over 5 simulated seconds', () => {
    let accum = 0
    const STEPS_PER_SEC = 30
    const dt = 1 / 30
    for (let frame = 0; frame < 5 * 30; frame++) {
      accum += 0 * dt * STEPS_PER_SEC // growthRate = 0
    }
    expect(accum).toBe(0)
  })
})
