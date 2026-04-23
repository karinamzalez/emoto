precision highp float;

uniform float uTime;
uniform vec2 uResolution;

varying vec2 vTexCoord;

void main() {
  vec2 uv = vTexCoord;
  // Animated RGB gradient — proves the pipeline is live
  vec3 col = 0.5 + 0.5 * cos(uTime + uv.xyx + vec3(0.0, 2.094, 4.189));
  gl_FragColor = vec4(col, 1.0);
}
