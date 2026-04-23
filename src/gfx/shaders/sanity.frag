precision highp float;

#include "hex_symmetry.glsl"

uniform float uTime;
uniform vec2 uResolution;
uniform bool u_showWedgeEdges;

varying vec2 vTexCoord;

void main() {
  vec2 uv = vTexCoord * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  vec2 folded = toWedge(uv);

  // Ramp sampled at the folded coordinate — switching the source
  // pattern (ramp ↔ noise ↔ etc.) produces clean 6-fold tiling
  // with no seams at wedge boundaries.
  vec3 col = 0.5 + 0.5 * cos(uTime + folded.xyx * 3.0 + vec3(0.0, 2.094, 4.189));

  if (u_showWedgeEdges) {
    float edge = wedgeEdge(uv, 0.015);
    col = mix(col, vec3(1.0), edge);
  }

  gl_FragColor = vec4(col, 1.0);
}
