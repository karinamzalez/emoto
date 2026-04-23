const DEFAULT_TAU_MS = 40

export class SpectralCentroidAnalyser {
  tau: number = DEFAULT_TAU_MS

  private analyser: AnalyserNode
  private buffer: Uint8Array<ArrayBuffer>
  private sampleRate: number
  private smoothed = 0

  constructor(analyser: AnalyserNode, sampleRate: number) {
    this.analyser = analyser
    this.sampleRate = sampleRate
    this.buffer = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>
  }

  /** Call once per frame. `dt` is elapsed time in milliseconds since last call. Returns centroid in Hz. */
  read(dt: number): number {
    this.analyser.getByteFrequencyData(this.buffer)

    const binCount = this.buffer.length
    const hzPerBin = this.sampleRate / (binCount * 2)

    let weightedSum = 0
    let magSum = 0
    for (let i = 0; i < binCount; i++) {
      const mag = this.buffer[i]
      weightedSum += i * hzPerBin * mag
      magSum += mag
    }

    const raw = magSum === 0 ? 0 : weightedSum / magSum

    const alpha = 1 - Math.exp(-dt / this.tau)
    this.smoothed += (raw - this.smoothed) * alpha

    return this.smoothed
  }
}
