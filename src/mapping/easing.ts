/**
 * Asymmetric one-pole smoother.
 * Uses attackMs time constant when moving toward a higher value,
 * releaseMs when falling — fast attack, slow release for musical settling.
 */
export function onePole(
  current: number,
  target: number,
  attackMs: number,
  releaseMs: number,
  dtMs: number
): number {
  const tau = target > current ? attackMs : releaseMs
  const alpha = 1 - Math.exp(-dtMs / tau)
  return current + alpha * (target - current)
}
