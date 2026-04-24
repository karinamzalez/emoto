import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { buildBipyramidGeometry } from './buildBipyramidGeometry'
import { morphWeightFromCrystallinity } from './morphWeightFromCrystallinity'

describe('buildBipyramidGeometry', () => {
  it('vertex count matches droplet icosphere (subdivisions=4)', () => {
    const ico = new THREE.IcosahedronGeometry(1, 4)
    const bipyramid = buildBipyramidGeometry(0.7, 1.1, 4)
    expect(bipyramid.attributes.position.count).toBe(ico.attributes.position.count)
    ico.dispose()
    bipyramid.dispose()
  })

  it('vertex count matches for subdivisions=1', () => {
    const ico = new THREE.IcosahedronGeometry(1, 1)
    const bipyramid = buildBipyramidGeometry(0.7, 1.1, 1)
    expect(bipyramid.attributes.position.count).toBe(ico.attributes.position.count)
    ico.dispose()
    bipyramid.dispose()
  })

  it('has computed vertex normals', () => {
    const bipyramid = buildBipyramidGeometry(0.7, 1.1, 1)
    expect(bipyramid.attributes.normal).toBeDefined()
    expect(bipyramid.attributes.normal.count).toBe(bipyramid.attributes.position.count)
    bipyramid.dispose()
  })

  it('all vertices lie on the bipyramid surface (no zero-length positions)', () => {
    const bipyramid = buildBipyramidGeometry(0.7, 1.1, 1)
    const pos = bipyramid.attributes.position as THREE.BufferAttribute
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      expect(v.length()).toBeGreaterThan(0.01)
    }
    bipyramid.dispose()
  })

  it('apex and nadir y-coordinates are bounded by height', () => {
    const height = 1.1
    const bipyramid = buildBipyramidGeometry(0.7, height, 1)
    const pos = bipyramid.attributes.position as THREE.BufferAttribute
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      expect(Math.abs(v.y)).toBeLessThanOrEqual(height + 1e-6)
    }
    bipyramid.dispose()
  })
})

describe('morphWeightFromCrystallinity', () => {
  it('returns 0.5 for input 0.5', () => {
    expect(morphWeightFromCrystallinity(0.5)).toBe(0.5)
  })

  it('returns 0 for crystallinity=0', () => {
    expect(morphWeightFromCrystallinity(0)).toBe(0)
  })

  it('returns 1 for crystallinity=1', () => {
    expect(morphWeightFromCrystallinity(1)).toBe(1)
  })

  it('is monotonically non-decreasing', () => {
    const vals = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]
    for (let i = 1; i < vals.length; i++) {
      expect(morphWeightFromCrystallinity(vals[i])).toBeGreaterThanOrEqual(
        morphWeightFromCrystallinity(vals[i - 1]),
      )
    }
  })
})
