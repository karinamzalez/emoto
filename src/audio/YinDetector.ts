const DEFAULT_THRESHOLD = 0.1

export class YinDetector {
  private readonly sampleRate: number
  private readonly frameSize: number
  private readonly threshold: number
  private readonly tauMin: number
  private readonly tauMax: number

  constructor(sampleRate: number, frameSize = 2048, threshold = DEFAULT_THRESHOLD) {
    this.sampleRate = sampleRate
    this.frameSize = frameSize
    this.threshold = threshold
    this.tauMin = Math.ceil(sampleRate / 800)
    this.tauMax = Math.min(Math.floor(sampleRate / 80), Math.floor(frameSize / 2))
  }

  /**
   * Run YIN on a Float32Array of samples in [-1, 1].
   * Returns pitchHz in 80–800 Hz, or null when unvoiced/noisy.
   */
  detect(samples: Float32Array): number | null {
    return this.detectWithClarity(samples).pitchHz
  }

  /**
   * Run YIN and also return clarity (1 - CMNDF minimum), a 0..1 voicing confidence.
   * clarity = 0 when unvoiced/noisy; clarity ≈ 1 for a pure periodic tone.
   */
  detectWithClarity(samples: Float32Array): { pitchHz: number | null; clarity: number } {
    const { frameSize, tauMin, tauMax, threshold, sampleRate } = this

    // CMNDF stored in-place: d[0]=1, d[tau] = tau*raw[tau] / runningSum
    const d = new Float32Array(tauMax + 1)
    d[0] = 1

    let runningSum = 0
    for (let tau = 1; tau <= tauMax; tau++) {
      let sum = 0
      const limit = frameSize - tau
      for (let j = 0; j < limit; j++) {
        const diff = samples[j] - samples[j + tau]
        sum += diff * diff
      }
      runningSum += sum
      d[tau] = runningSum > 0 ? (tau * sum) / runningSum : 1
    }

    // Find first tau in [tauMin, tauMax] below threshold, then slide to local min
    let tau = tauMin
    while (tau <= tauMax) {
      if (d[tau] < threshold) {
        while (tau + 1 <= tauMax && d[tau + 1] < d[tau]) tau++
        break
      }
      tau++
    }

    if (tau > tauMax) return { pitchHz: null, clarity: 0 }

    const refined = this.parabolicInterp(d, tau)
    const pitch = sampleRate / refined
    const clarity = Math.max(0, 1 - d[tau])
    const pitchHz = pitch >= 80 && pitch <= 800 ? pitch : null
    return { pitchHz, clarity: pitchHz !== null ? clarity : 0 }
  }

  private parabolicInterp(d: Float32Array, tau: number): number {
    if (tau <= 0 || tau >= d.length - 1) return tau
    const prev = d[tau - 1]
    const curr = d[tau]
    const next = d[tau + 1]
    const denom = 2 * (2 * curr - prev - next)
    if (Math.abs(denom) < 1e-10) return tau
    return tau + (next - prev) / denom
  }
}
