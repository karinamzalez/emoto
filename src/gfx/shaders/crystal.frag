// crystal.frag — canonical single-pass crystal material (T2.7)
// Composes: T2.2 hex lattice · T2.3 branches · T2.4 Fresnel · T2.5 iridescence · T2.6 dispersion

precision highp float;

#include "hex_symmetry.glsl"   // T2.1 — D6 wedge folding
#include "hex_lattice.glsl"    // T2.2 — hex SDF + tiling
#include "branch.glsl"         // T2.3 — Reiter-style dendritic field
#include "thin_film.glsl"      // T2.5 — Belcour thin-film iridescence
#include "dispersion.glsl"     // T2.6 — per-channel chromatic offset

// ── Uniforms ──────────────────────────────────────────────────────────────────

uniform float uTime;
uniform vec2  uResolution;

// T2.2 — lattice geometry
uniform float u_latticeScale;
uniform float u_latticeDepth;

// T2.3 — dendritic growth
uniform float u_growth;

// T2.4 — Fresnel rim
uniform float u_fresnelPower;

// T2.5 — thin-film iridescence
uniform float u_irisThickness;
uniform float u_irisIntensity;

// T2.6 — chromatic dispersion
uniform float u_dispersionStrength;

// ── Interpolants ──────────────────────────────────────────────────────────────

varying vec2 vTexCoord;

// ── Main ──────────────────────────────────────────────────────────────────────

void main() {
  // Screen UV in aspect-corrected NDC [-ar, ar] × [-1, 1].
  vec2 uv = vTexCoord * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;
  float dist = length(uv);

  // ── T2.1 · Symmetry ────────────────────────────────────────────────────────
  // Fold any screen UV into the canonical 30° wedge; all downstream
  // sampling inherits the 6-fold D6 symmetry for free.
  vec2 wuv = toWedge(uv);

  // ── T2.2 · Hex lattice ─────────────────────────────────────────────────────
  float apothem  = u_latticeScale * 0.5;
  vec2  cell     = hexTile(wuv, u_latticeScale);
  float d_lattice = hexSDF(cell, apothem);

  // ── T2.3 · Dendritic branches ──────────────────────────────────────────────
  // Soft-min composes branches into the lattice walls without hard seams.
  float d_branch = branchField(cell, apothem, u_growth);
  float d        = smin(d_lattice, d_branch, apothem * 0.12);

  // Edge mask: positive SDF → boundary zone.
  float edgeWidth = apothem * 0.08;
  float edge      = smoothstep(-edgeWidth, edgeWidth, d);

  // Facet bevel: cosine ramp from cell centre (1) to edge (0).
  float bevel   = 0.5 + 0.5 * cos(length(cell) / apothem * 1.5708);
  // Rim-distance: 1 at cell centre, 0 at edge (cosTheta proxy for T2.4/5).
  float rimDist = clamp(-d_lattice / apothem, 0.0, 1.0);

  // ── T2.4 · Fresnel rim ─────────────────────────────────────────────────────
  // Silhouette Fresnel: peaks at the outer edge of the crystal,
  // falls to ~0 toward center — drives alpha and dispersion boost.
  float edgeDist   = clamp(1.0 - dist / u_latticeDepth, 0.0, 1.0);
  float fresnelRim = pow(clamp(1.0 - edgeDist, 0.0, 1.0), u_fresnelPower);

  // ── Base colour ────────────────────────────────────────────────────────────
  // Slow cosine drift keeps the crystal alive; bevel adds facet structure.
  vec3 cellColor = 0.5 + 0.45 * cos(uTime * 0.4 + vec3(0.0, 2.094, 4.189) + bevel * 1.2);

  // ── T2.5 · Thin-film iridescence ───────────────────────────────────────────
  // rimDist proxies the view angle: facet centres appear head-on (cosTheta≈1),
  // edges appear grazing (cosTheta≈0).  Sweeping u_irisThickness cycles
  // hues through the natural blue → violet → gold thin-film sequence.
  vec3 iris = thinFilm(rimDist, u_irisThickness);
  cellColor  = mix(cellColor, iris, u_irisIntensity);

  // ── T2.6 · Chromatic dispersion ────────────────────────────────────────────
  // Sample the procedural field at per-channel UV offsets along the
  // cell-edge normal; blend the split colours in where rimDist is low
  // (near edges) and further boost at the outer Fresnel rim.
  vec2  dispDir   = length(cell) > 0.001 ? normalize(cell) : vec2(0.0, 1.0);
  float dispScale = u_dispersionStrength * apothem * 0.5;

  vec2 uvR = toWedge(wuv + dispDir * dispersedOffset(0, dispScale));
  vec2 uvB = toWedge(wuv + dispDir * dispersedOffset(2, dispScale));
  vec2 cR  = hexTile(uvR, u_latticeScale);
  vec2 cB  = hexTile(uvB, u_latticeScale);

  float bR = 0.5 + 0.5 * cos(length(cR) / apothem * 1.5708);
  float bB = 0.5 + 0.5 * cos(length(cB) / apothem * 1.5708);

  vec3 dispersed = vec3(
    0.5 + 0.45 * cos(uTime * 0.4 +          bR * 1.2),
    cellColor.g,
    0.5 + 0.45 * cos(uTime * 0.4 + 4.189 + bB * 1.2)
  );

  float dispBlend = clamp((1.0 - rimDist) * (1.0 + fresnelRim) * u_dispersionStrength, 0.0, 1.0);
  cellColor = mix(cellColor, dispersed, dispBlend);

  // ── Composite ──────────────────────────────────────────────────────────────
  vec3 edgeColor = vec3(0.04, 0.06, 0.10);
  vec3 col       = mix(cellColor, edgeColor, edge);

  // Radial fade: crystal dissolves beyond u_latticeDepth.
  float fade = smoothstep(u_latticeDepth, u_latticeDepth * 0.72, dist);
  col *= fade;

  // Alpha: glass-clear center (≈10% opaque), bright Fresnel rim (100%).
  float alpha = mix(0.1, 1.0, fresnelRim) * fade;

  gl_FragColor = vec4(col, alpha);
}
