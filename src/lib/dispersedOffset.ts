/**
 * Returns the IOR delta for a given colour channel under chromatic dispersion.
 *
 * Mirrors the per-channel IOR spread used in Three.js's USE_DISPERSION path
 * (transmission_pars_fragment) so unit tests can verify the ordering without
 * touching the GPU.
 *
 * channel: 0 = red (refracts least), 1 = green (neutral), 2 = blue (refracts most)
 * strength: 0–1 user-facing chromaticAberration value
 */
export function dispersedOffset(channel: 0 | 1 | 2, strength: number): number {
  const SPREAD = 0.04 // max IOR delta at full strength (matches shader scaling)
  return (channel - 1) * strength * SPREAD || 0 // || 0 coerces -0 → +0
}
