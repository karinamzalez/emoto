import { hexSDF } from './hexLattice'

// Smooth minimum (polynomial) — TS mirror of smin in branch.glsl.
export function smin(a: number, b: number, k: number): number {
  const h = Math.min(Math.max(0.5 + 0.5 * ((b - a) / k), 0), 1)
  return h * a + (1 - h) * b - k * h * (1 - h)
}

// Dendritic branch field — TS mirror of branchField in branch.glsl.
// At growth=0 returns hexSDF(px, py, apothem) (identity).
export function branchField(px: number, py: number, apothem: number, growth: number): number {
  const r = Math.hypot(px, py)
  const theta = Math.atan2(py, px)
  const cosT = Math.cos(6 * theta)
  const petals = Math.max(0, cosT) ** 2
  const rw = smoothstep(0, apothem * 0.5, r)
  const effectiveR = apothem * (1 + growth * 0.75 * petals * rw)
  return hexSDF(px, py, effectiveR)
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1)
  return t * t * (3 - 2 * t)
}
