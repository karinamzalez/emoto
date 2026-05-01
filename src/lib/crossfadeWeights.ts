function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** Opacity weights for the droplet↔crystal crossfade.
 *  Both weights sum to exactly 1, so perceived density stays constant. */
export function crossfadeWeights(crystallinity: number): { droplet: number; crystal: number } {
  const t = smoothstep(0.3, 0.7, crystallinity)
  return { droplet: 1 - t, crystal: t }
}
