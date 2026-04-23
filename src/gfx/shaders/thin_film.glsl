// Simplified Belcour 2017 thin-film interference.
// cosTheta: cosine of incidence angle (1 = normal, 0 = grazing).
// thickness: normalised film depth [0, 1] → 0–700 nm range.
// Returns per-channel reflectance in [0, 1].
vec3 thinFilm(float cosTheta, float thickness) {
  const float n   = 1.5;    // IOR of film (oil/soap-film range)
  const float PI2 = 6.28318530718;

  // Refraction angle via Snell's law.
  float sinTheta2 = 1.0 - cosTheta * cosTheta;
  float cosTheta_t = sqrt(max(0.0, 1.0 - sinTheta2 / (n * n)));

  // Optical path difference in nm (thickness maps [0,1] to [0,700 nm]).
  float opd = 2.0 * n * thickness * 700.0 * cosTheta_t;

  // Primary wavelengths: R = 700 nm, G = 540 nm, B = 450 nm.
  vec3 lambda = vec3(700.0, 540.0, 450.0);

  // Cosine interference: 0.5 + 0.5*cos(2π·OPD/λ) ∈ [0, 1].
  // Shorter λ cycles faster → blue drops first → gold/violet appear naturally.
  return 0.5 + 0.5 * cos(PI2 * opd / lambda);
}
