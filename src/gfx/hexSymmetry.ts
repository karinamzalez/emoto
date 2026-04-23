export const HEX_WEDGE = Math.PI / 3
export const HEX_HALF_WEDGE = Math.PI / 6

function glslMod(x: number, y: number): number {
  return x - y * Math.floor(x / y)
}

export function toWedge(uv: readonly [number, number]): [number, number] {
  const [x, y] = uv
  const r = Math.hypot(x, y)
  if (r < 1e-6) return [0, 0]
  const a = Math.atan2(y, x)
  let af = glslMod(a, HEX_WEDGE)
  if (af > HEX_HALF_WEDGE) af = HEX_WEDGE - af
  return [r * Math.cos(af), r * Math.sin(af)]
}

export function fromPolar(r: number, theta: number): [number, number] {
  return [r * Math.cos(theta), r * Math.sin(theta)]
}
