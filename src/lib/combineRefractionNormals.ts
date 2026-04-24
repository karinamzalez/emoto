import * as THREE from 'three'

/**
 * Compute two-bounce refraction exit direction given:
 * - viewDir: direction from surface toward camera (world/view space)
 * - frontNormal: front-face surface normal (pointing toward camera)
 * - backNormal: back-face normal from BackSide FBO (pointing inward)
 * - ior: index of refraction (e.g. 1.33 for water)
 *
 * Mirrors the GLSL logic in Droplet's onBeforeCompile shader patch.
 */
export function combineRefractionNormals(
  viewDir: THREE.Vector3Like,
  frontNormal: THREE.Vector3Like,
  backNormal: THREE.Vector3Like,
  ior: number,
): THREE.Vector3 {
  const n1 = new THREE.Vector3(frontNormal.x, frontNormal.y, frontNormal.z).normalize()
  const n2 = new THREE.Vector3(backNormal.x, backNormal.y, backNormal.z).normalize()
  const incidentEntry = new THREE.Vector3(viewDir.x, viewDir.y, viewDir.z).negate()

  // Entry: air → glass
  const rd1 = glslRefract(incidentEntry, n1, 1.0 / ior)

  // Exit: glass → air (backNormal from BackSide rendering points inward)
  const rd2 = glslRefract(rd1, n2, ior)

  // TIR fallback: if rd2 is zero, fall back to single-bounce
  if (rd2.lengthSq() < 1e-6) return rd1.normalize()

  return rd2.normalize()
}

/** Matches GLSL built-in refract(I, N, eta). Returns zero vector on TIR. */
function glslRefract(I: THREE.Vector3, N: THREE.Vector3, eta: number): THREE.Vector3 {
  const NdotI = N.dot(I)
  const k = 1.0 - eta * eta * (1.0 - NdotI * NdotI)
  if (k < 0) return new THREE.Vector3() // total internal reflection
  return I.clone()
    .multiplyScalar(eta)
    .addScaledVector(N, -(eta * NdotI + Math.sqrt(k)))
}
