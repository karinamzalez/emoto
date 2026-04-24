import * as THREE from 'three'

/**
 * Projects a normalized direction ray from the origin onto the surface of a
 * hexagonal bipyramid, returning the intersection point.
 *
 * Uses the Möller–Trumbore algorithm. The origin is always inside the convex
 * bipyramid, so exactly one face will be hit (t > 0).
 */
function rayBipyramidIntersect(
  dir: THREE.Vector3,
  faces: ReadonlyArray<readonly [THREE.Vector3, THREE.Vector3, THREE.Vector3]>,
): THREE.Vector3 {
  const e1 = new THREE.Vector3()
  const e2 = new THREE.Vector3()
  const h = new THREE.Vector3()
  const s = new THREE.Vector3()
  const q = new THREE.Vector3()

  for (const [v0, v1, v2] of faces) {
    e1.subVectors(v1, v0)
    e2.subVectors(v2, v0)
    h.crossVectors(dir, e2)
    const a = e1.dot(h)
    if (Math.abs(a) < 1e-10) continue
    const f = 1 / a
    s.copy(v0).negate() // origin = 0, so s = origin − v0 = −v0
    const u = f * s.dot(h)
    if (u < -1e-6 || u > 1 + 1e-6) continue
    q.crossVectors(s, e1)
    const v = f * dir.dot(q)
    if (v < -1e-6 || u + v > 1 + 1e-6) continue
    const t = f * e2.dot(q)
    if (t > 1e-6) return dir.clone().multiplyScalar(t)
  }

  // Fallback: return unit direction (shouldn't occur for a convex shape)
  return dir.clone()
}

/**
 * Builds a hexagonal-bipyramid BufferGeometry whose vertex count exactly
 * matches IcosahedronGeometry(1, subdivisions).
 *
 * Strategy: use an icosphere of the given detail level as the topological
 * template, then project each vertex direction radially onto the bipyramid
 * surface. This guarantees identical vertex count and winding order — both
 * required for Three.js morph targets.
 *
 * The returned geometry has computed vertex normals (flat per-face, giving the
 * faceted crystal look at crystallinity=1 while blending smoothly at 0–1).
 */
export function buildBipyramidGeometry(
  hexRadius: number,
  height: number,
  subdivisions: number,
): THREE.BufferGeometry {
  const template = new THREE.IcosahedronGeometry(1, subdivisions)
  const templatePos = template.attributes.position as THREE.BufferAttribute
  const n = templatePos.count

  // Build the 12 bipyramid faces (6 upper + 6 lower)
  const equatorial: THREE.Vector3[] = Array.from({ length: 6 }, (_, i) => {
    const angle = (i / 6) * Math.PI * 2
    return new THREE.Vector3(Math.cos(angle) * hexRadius, 0, Math.sin(angle) * hexRadius)
  })
  const apex = new THREE.Vector3(0, height, 0)
  const nadir = new THREE.Vector3(0, -height, 0)

  const faces: ReadonlyArray<readonly [THREE.Vector3, THREE.Vector3, THREE.Vector3]> = [
    ...equatorial.map((a, i) => [apex, a, equatorial[(i + 1) % 6]] as const),
    ...equatorial.map((a, i) => [nadir, a, equatorial[(i + 1) % 6]] as const),
  ]

  const positions = new Float32Array(n * 3)
  const dir = new THREE.Vector3()

  for (let i = 0; i < n; i++) {
    dir.fromBufferAttribute(templatePos, i).normalize()
    const pt = rayBipyramidIntersect(dir, faces)
    positions[i * 3] = pt.x
    positions[i * 3 + 1] = pt.y
    positions[i * 3 + 2] = pt.z
  }

  template.dispose()

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.computeVertexNormals()
  return geo
}
