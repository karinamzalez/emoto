precision highp float;

#include "hex_symmetry.glsl"
#include "hex_lattice.glsl"
#include "branch.glsl"
#include "thin_film.glsl"

uniform float uTime;
uniform vec2 uResolution;
uniform float u_latticeScale;
uniform float u_latticeDepth;
uniform float u_growth;
uniform float u_fresnelPower;
uniform float u_irisThickness;
uniform float u_irisIntensity;

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

  // Base lattice SDF and dendritic branch field composed via smooth-min
  // so branch arms blend into the lattice walls rather than cutting.
  float d_lattice = hexSDF(cell, apothem);
  float d_branch = branchField(cell, apothem, u_growth);
  float d = smin(d_lattice, d_branch, apothem * 0.12);

  // Sharp edge mask — positive SDF is the boundary zone.
  float edgeWidth = apothem * 0.08;
  float edge = smoothstep(-edgeWidth, edgeWidth, d);

  // Facet shading: cosine of local cell coord gives an architectural bevel.
  float bevel = 0.5 + 0.5 * cos(length(cell) / apothem * 1.5708);

  // Rim-distance proxy for T2.4: 1 at cell centre, 0 at edge.
  float rimDist = clamp(-d_lattice / apothem, 0.0, 1.0);

  // Slow color drift so the lattice is alive but not distracting.
  vec3 cellColor = 0.5 + 0.45 * cos(uTime * 0.4 + vec3(0.0, 2.094, 4.189) + bevel * 1.2);

  // Thin-film iridescence: angle-dependent hue shift across each facet.
  vec3 iris = thinFilm(rimDist, u_irisThickness);
  cellColor = mix(cellColor, iris, u_irisIntensity);

  vec3 edgeColor = vec3(0.04, 0.06, 0.10);

  vec3 col = mix(cellColor, edgeColor, edge);

  // Radial fade: lattice dissolves beyond u_latticeDepth.
  float fade = smoothstep(u_latticeDepth, u_latticeDepth * 0.72, dist);
  col *= fade;

  // Fresnel rim: edgeDist is 0 at silhouette boundary, 1 at center.
  // pow(1 - edgeDist, u_fresnelPower) peaks at the rim and falls off inward.
  float edgeDist = clamp(1.0 - dist / u_latticeDepth, 0.0, 1.0);
  float fresnelRim = pow(clamp(1.0 - edgeDist, 0.0, 1.0), u_fresnelPower);
  // Center stays ~90% transparent (0.1 base alpha); rim reaches full opacity.
  float alpha = mix(0.1, 1.0, fresnelRim) * fade;

  gl_FragColor = vec4(col, alpha);
}
