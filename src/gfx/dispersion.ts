// TS mirror of dispersion.glsl — used for unit testing only.

export function dispersedOffset(channel: number, strength: number): number {
  if (channel === 0) return strength // R: least bent
  if (channel === 1) return 0 // G: mid
  return -strength // B: most bent
}
