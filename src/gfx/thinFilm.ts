// TS mirror of thin_film.glsl — used for unit testing only.

export function thinFilm(cosTheta: number, thickness: number): [number, number, number] {
  const n = 1.5
  const PI2 = 2 * Math.PI

  const sinTheta2 = 1 - cosTheta * cosTheta
  const cosTheta_t = Math.sqrt(Math.max(0, 1 - sinTheta2 / (n * n)))

  const opd = 2 * n * thickness * 700 * cosTheta_t

  const lambda = [700, 540, 450]
  const [r, g, b] = lambda.map((l) => 0.5 + 0.5 * Math.cos((PI2 * opd) / l))
  return [r, g, b]
}
