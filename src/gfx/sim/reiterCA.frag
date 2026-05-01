precision highp float;

uniform sampler2D uState;
uniform float uAlpha;
uniform float uGamma;

varying vec2 vUv;

const float N = 256.0;

void main() {
  float t = 1.0 / N;

  // odd-r offset hex grid: row parity shifts the diagonal neighbor columns
  // Even row (rp=0): NE/SE at same col; NW/SW at col-1
  // Odd  row (rp=1): NE/SE at col+1; NW/SW at same col
  float rp = mod(floor(vUv.y * N), 2.0);

  float c   = texture2D(uState, vUv).r;
  float nE  = texture2D(uState, vUv + vec2( t,              0.0)).r;
  float nW  = texture2D(uState, vUv + vec2(-t,              0.0)).r;
  float nNE = texture2D(uState, vUv + vec2( rp * t,        -t  )).r;
  float nNW = texture2D(uState, vUv + vec2((rp - 1.0) * t, -t  )).r;
  float nSE = texture2D(uState, vUv + vec2( rp * t,         t  )).r;
  float nSW = texture2D(uState, vUv + vec2((rp - 1.0) * t,  t  )).r;

  // Receptive: this cell or any neighbor is frozen (>= 1)
  float maxN      = max(nE, max(nW, max(nNE, max(nNW, max(nSE, nSW)))));
  float receptive = step(1.0, max(c, maxN));

  // Diffusible amount from each neighbor (frozen cells contribute 0)
  float dE  = nE  * (1.0 - step(1.0, nE));
  float dW  = nW  * (1.0 - step(1.0, nW));
  float dNE = nNE * (1.0 - step(1.0, nNE));
  float dNW = nNW * (1.0 - step(1.0, nNW));
  float dSE = nSE * (1.0 - step(1.0, nSE));
  float dSW = nSW * (1.0 - step(1.0, nSW));

  float avgD = (dE + dW + dNE + dNW + dSE + dSW) / 6.0;

  float newC = mix(
    c * (1.0 - uAlpha) + uAlpha * avgD, // non-receptive: diffuse
    c + uGamma,                          // receptive: accrete vapor
    receptive
  );

  gl_FragColor = vec4(newC, 0.0, 0.0, 1.0);
}
