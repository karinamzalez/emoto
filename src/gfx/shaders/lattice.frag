precision highp float;

#include "hex_symmetry.glsl"
#include "hex_lattice.glsl"

uniform float uTime;
uniform vec2 uResolution;
uniform float u_latticeScale;
uniform float u_latticeDepth;

varying vec2 vTexCoord;

void main() {
  vec2 uv = vTexCoord * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  float dist = length(uv);

  // Fold into the hexagonal crystal silhouette (D6 symmetry from T2.1).
  vec2 wuv = toWedge(uv);

  // Hex lattice: apothem = half the scale constant so cells tile tightly.
  float apothem = u_latticeScale * 0.5;
  vec2 cell = hexTile(wuv, u_latticeScale);
  float d = hexSDF(cell, apothem);

  // Sharp edge mask — positive SDF is the boundary zone.
  float edgeWidth = apothem * 0.08;
  float edge = smoothstep(-edgeWidth, edgeWidth, d);

  // Facet shading: cosine of local cell coord gives an architectural bevel.
  float bevel = 0.5 + 0.5 * cos(length(cell) / apothem * 1.5708);

  // Slow color drift so the lattice is alive but not distracting.
  vec3 cellColor = 0.5 + 0.45 * cos(uTime * 0.4 + vec3(0.0, 2.094, 4.189) + bevel * 1.2);
  vec3 edgeColor = vec3(0.04, 0.06, 0.10);

  vec3 col = mix(cellColor, edgeColor, edge);

  // Radial fade: lattice dissolves beyond u_latticeDepth.
  float fade = smoothstep(u_latticeDepth, u_latticeDepth * 0.72, dist);
  col *= fade;

  gl_FragColor = vec4(col, 1.0);
}
