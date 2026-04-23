precision highp float;

#include "hex_symmetry.glsl"
#include "hex_lattice.glsl"
#include "branch.glsl"
#include "thin_film.glsl"
#include "dispersion.glsl"

uniform float uTime;
uniform vec2 uResolution;
uniform float u_latticeScale;
uniform float u_latticeDepth;
uniform float u_growth;
uniform float u_fresnelPower;
uniform float u_irisThickness;
uniform float u_irisIntensity;
uniform float u_dispersionStrength;

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

  // Fresnel rim computed early so dispersion can be modulated by it.
  float edgeDist = clamp(1.0 - dist / u_latticeDepth, 0.0, 1.0);
  float fresnelRim = pow(clamp(1.0 - edgeDist, 0.0, 1.0), u_fresnelPower);

  // Slow color drift so the lattice is alive but not distracting.
  vec3 cellColor = 0.5 + 0.45 * cos(uTime * 0.4 + vec3(0.0, 2.094, 4.189) + bevel * 1.2);

  // Thin-film iridescence: angle-dependent hue shift across each facet.
  vec3 iris = thinFilm(rimDist, u_irisThickness);
  cellColor = mix(cellColor, iris, u_irisIntensity);

  // Chromatic dispersion: sample procedural color at per-channel UV offsets
  // along the cell edge normal, blended in at cell boundaries.
  vec2 dispDir = length(cell) > 0.001 ? normalize(cell) : vec2(0.0, 1.0);
  float dispScale = u_dispersionStrength * apothem * 0.5;

  vec2 uvR = toWedge(wuv + dispDir * dispersedOffset(0, dispScale));
  vec2 uvB = toWedge(wuv + dispDir * dispersedOffset(2, dispScale));

  vec2 cR = hexTile(uvR, u_latticeScale);
  vec2 cB = hexTile(uvB, u_latticeScale);

  float bR = 0.5 + 0.5 * cos(length(cR) / apothem * 1.5708);
  float bB = 0.5 + 0.5 * cos(length(cB) / apothem * 1.5708);

  vec3 dispersed = vec3(
    0.5 + 0.45 * cos(uTime * 0.4 + bR * 1.2),
    cellColor.g,
    0.5 + 0.45 * cos(uTime * 0.4 + 4.189 + bB * 1.2)
  );

  // Blend dispersion where rimDist is low (cell edges) — strongest at boundaries.
  // Fresnel rim further boosts the effect at the outer crystal silhouette.
  float dispBlend = clamp((1.0 - rimDist) * (1.0 + fresnelRim) * u_dispersionStrength, 0.0, 1.0);
  cellColor = mix(cellColor, dispersed, dispBlend);

  vec3 edgeColor = vec3(0.04, 0.06, 0.10);

  vec3 col = mix(cellColor, edgeColor, edge);

  // Radial fade: lattice dissolves beyond u_latticeDepth.
  float fade = smoothstep(u_latticeDepth, u_latticeDepth * 0.72, dist);
  col *= fade;

  // Center stays ~90% transparent (0.1 base alpha); rim reaches full opacity.
  float alpha = mix(0.1, 1.0, fresnelRim) * fade;

  gl_FragColor = vec4(col, alpha);
}
