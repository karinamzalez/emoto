function glslMod(x: number, y: number): number {
  return x - y * Math.floor(x / y)
}

// Returns local UV offset from the nearest hex cell center (TS mirror of hexTile in GLSL).
export function hexTile(px: number, py: number, scale: number): [number, number] {
  const rx = 1.0,
    ry = 1.7320508 // (1, sqrt(3))
  const hx = rx * 0.5,
    hy = ry * 0.5
  const sx = px / scale,
    sy = py / scale
  const ax = glslMod(sx, rx) - hx
  const ay = glslMod(sy, ry) - hy
  const bx = glslMod(sx - hx, rx) - hx
  const by = glslMod(sy - hy, ry) - hy
  const useA = ax * ax + ay * ay < bx * bx + by * by
  return [(useA ? ax : bx) * scale, (useA ? ay : by) * scale]
}

// Signed distance to a regular hexagon centred at origin with apothem r.
// Returns < 0 inside, > 0 outside (TS mirror of hexSDF in GLSL).
export function hexSDF(px: number, py: number, r: number): number {
  const kx = -0.8660254,
    ky = 0.5,
    kz = 0.5773503
  let x = Math.abs(px),
    y = Math.abs(py)
  const d = Math.min(kx * x + ky * y, 0)
  x -= 2 * d * kx
  y -= 2 * d * ky
  x -= Math.min(Math.max(x, -kz * r), kz * r)
  y -= r
  return Math.sqrt(x * x + y * y) * Math.sign(y)
}
