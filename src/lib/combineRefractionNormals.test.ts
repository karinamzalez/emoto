import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { combineRefractionNormals } from './combineRefractionNormals'

const EPS = 1e-4

function approxEq(a: number, b: number) {
  return Math.abs(a - b) < EPS
}

describe('combineRefractionNormals', () => {
  it('perpendicular incidence through flat slab exits straight through', () => {
    // Ray hitting surface straight on: should exit in same direction
    const result = combineRefractionNormals(
      { x: 0, y: 0, z: 1 },  // viewDir toward camera (+Z)
      { x: 0, y: 0, z: 1 },  // front normal toward camera
      { x: 0, y: 0, z: 1 },  // back normal inward (BackSide = toward camera for slab)
      1.33,
    )
    // Exit direction should be (0, 0, -1) — straight through away from camera
    expect(approxEq(result.x, 0)).toBe(true)
    expect(approxEq(result.y, 0)).toBe(true)
    expect(approxEq(Math.abs(result.z), 1)).toBe(true)
  })

  it('returns a unit vector', () => {
    const result = combineRefractionNormals(
      { x: 0.3, y: 0.1, z: 1 },
      { x: -0.2, y: 0.1, z: 0.97 },
      { x: 0.1, y: -0.1, z: 0.99 },
      1.33,
    )
    expect(approxEq(result.length(), 1)).toBe(true)
  })

  it('higher IOR bends more than lower IOR on a curved surface', () => {
    // Simulate curved glass: front normal tilted left, back normal tilted right
    const viewDir = { x: 0, y: 0, z: 1 }
    const frontNormal = { x: -0.5, y: 0, z: 0.866 } // tilted 30° left
    const backNormal = { x: 0.5, y: 0, z: 0.866 }  // tilted 30° right (sphere-like)

    const lowIOR = combineRefractionNormals(viewDir, frontNormal, backNormal, 1.1)
    const highIOR = combineRefractionNormals(viewDir, frontNormal, backNormal, 2.0)

    // Both rays are deflected in the +x direction; higher IOR deflects more
    expect(highIOR.x).toBeGreaterThan(lowIOR.x)
  })

  it('symmetric normals produce symmetric exit ray for symmetric entry', () => {
    const result = combineRefractionNormals(
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: 1 },
      1.5,
    )
    // No lateral deviation for head-on ray through symmetric surface
    expect(approxEq(result.x, 0)).toBe(true)
    expect(approxEq(result.y, 0)).toBe(true)
  })

  it('TIR fallback returns single-bounce direction instead of zero', () => {
    // Extreme IOR + glancing angle to trigger TIR at exit
    const result = combineRefractionNormals(
      { x: 0.99, y: 0, z: 0.14 },
      { x: 1, y: 0, z: 0 },
      { x: -1, y: 0, z: 0 },
      2.5,
    )
    // Must not return zero vector (TIR fallback applies)
    expect(result.length()).toBeGreaterThan(0.5)
  })

  it('three.js Vector3Like inputs are accepted', () => {
    const v = new THREE.Vector3(0, 0, 1)
    const n = new THREE.Vector3(0, 0, 1)
    const result = combineRefractionNormals(v, n, n, 1.33)
    expect(result).toBeInstanceOf(THREE.Vector3)
  })
})
