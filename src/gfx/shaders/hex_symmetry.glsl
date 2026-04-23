#ifndef HEX_SYMMETRY_INCLUDED
#define HEX_SYMMETRY_INCLUDED

#ifndef HEX_PI
#define HEX_PI 3.141592653589793
#endif

const float HEX_WEDGE = HEX_PI / 3.0;
const float HEX_HALF_WEDGE = HEX_PI / 6.0;

// Fold a 2D point (centered at origin) into the canonical 30° wedge.
// Produces dihedral D6 symmetry — six 60° rotational copies with
// reflective mirroring between adjacent wedges — so any pattern
// sampled at the folded coordinate tiles seamlessly as a hexagonal
// kaleidoscope.
vec2 toWedge(vec2 uv) {
  float r = length(uv);
  if (r < 1e-6) return vec2(0.0);
  float a = atan(uv.y, uv.x);
  float af = mod(a, HEX_WEDGE);
  if (af > HEX_HALF_WEDGE) af = HEX_WEDGE - af;
  return vec2(r * cos(af), r * sin(af));
}

// Returns ~1.0 near wedge boundaries (angle ≈ k * PI/3), 0.0 elsewhere.
// Drives the u_showWedgeEdges debug overlay.
float wedgeEdge(vec2 uv, float thickness) {
  float a = atan(uv.y, uv.x);
  float d = abs(mod(a + HEX_HALF_WEDGE, HEX_WEDGE) - HEX_HALF_WEDGE);
  return 1.0 - smoothstep(thickness, thickness * 2.0, d);
}

#endif
