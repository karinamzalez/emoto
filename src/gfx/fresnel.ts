// edgeDist: normalized distance from silhouette (0 = at edge, 1 = at center)
export function fresnel(edgeDist: number, power: number): number {
  return Math.pow(Math.max(0, 1.0 - edgeDist), power)
}
