#ifndef BRANCH_INCLUDED
#define BRANCH_INCLUDED

// Smooth minimum (polynomial, k controls blend radius).
// Returns a value ≤ min(a, b) with a smooth transition of width k.
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// Dendritic branch field: modulates the hex apothem angularly to
// produce 6 narrow arms growing from cell vertices toward outer rings.
// At growth=0 returns hexSDF(cell, apothem) unchanged (identity).
float branchField(vec2 cell, float apothem, float growth) {
  float r = length(cell);
  float theta = atan(cell.y, cell.x);
  // Narrow 6-fold petals peaked at hex vertex directions (0°, 60°, …).
  // pow(..., 2) sharpens the lobes into finger-like tips.
  float cosT = cos(6.0 * theta);
  float petals = pow(max(0.0, cosT), 2.0);
  // Radial envelope: branches build up from center, peak near circumradius.
  float rw = smoothstep(0.0, apothem * 0.5, r);
  // Enlarge the effective apothem at vertex directions — the boundary
  // is pushed outward there, forming the dendritic arm silhouette.
  float effectiveR = apothem * (1.0 + growth * 0.75 * petals * rw);
  return hexSDF(cell, effectiveR);
}

#endif
