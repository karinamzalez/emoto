#ifndef HEX_LATTICE_INCLUDED
#define HEX_LATTICE_INCLUDED

// Returns local UV offset from the nearest hex cell center.
// Cells have period (scale, scale*sqrt(3)) in the two grid axes.
// The returned offset lies within [-scale/2, scale/2] in each axis.
vec2 hexTile(vec2 p, float scale) {
  vec2 r = vec2(1.0, 1.7320508); // (1, sqrt(3))
  vec2 h = r * 0.5;
  p /= scale;
  vec2 a = mod(p, r) - h;
  vec2 b = mod(p - h, r) - h;
  return (dot(a, a) < dot(b, b) ? a : b) * scale;
}

// Signed distance to a regular hexagon centred at origin with apothem r
// (apothem = perpendicular distance from center to an edge).
// Returns < 0 inside the hexagon, > 0 outside.
float hexSDF(vec2 p, float r) {
  const vec3 k = vec3(-0.8660254, 0.5, 0.5773503); // (-√3/2, 1/2, 1/√3)
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

#endif
