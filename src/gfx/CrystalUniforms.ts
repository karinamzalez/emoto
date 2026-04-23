// Typed interface for every uniform declared in crystal.frag.
// Keep this in sync with the shader — CrystalUniforms.test.ts enforces it.

export interface CrystalUniforms {
  uTime: number
  uResolution: [number, number]
  // T2.2 — lattice geometry
  u_latticeScale: number
  u_latticeDepth: number
  // T2.3 — dendritic growth
  u_growth: number
  // T2.4 — Fresnel rim
  u_fresnelPower: number
  // T2.5 — thin-film iridescence
  u_irisThickness: number
  u_irisIntensity: number
  // T2.6 — chromatic dispersion
  u_dispersionStrength: number
}

// Uniform names extracted from the interface for runtime / test use.
export const CRYSTAL_UNIFORM_NAMES: ReadonlyArray<keyof CrystalUniforms> = [
  'uTime',
  'uResolution',
  'u_latticeScale',
  'u_latticeDepth',
  'u_growth',
  'u_fresnelPower',
  'u_irisThickness',
  'u_irisIntensity',
  'u_dispersionStrength',
]
