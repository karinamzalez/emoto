const DEFAULT_TAU_MS = 80

export class RmsAnalyser {
  tau: number = DEFAULT_TAU_MS

  private analyser: AnalyserNode
  private buffer: Uint8Array<ArrayBuffer>
  private smoothed = 0

  constructor(analyser: AnalyserNode) {
    this.analyser = analyser
    this.buffer = new Uint8Array(analyser.fftSize) as Uint8Array<ArrayBuffer>
  }

  /** Call once per frame. `dt` is elapsed time in milliseconds since last call. */
  read(dt: number): number {
    this.analyser.getByteTimeDomainData(this.buffer)

    // Convert Uint8 (0–255, center 128) to signed float (-1..1) and compute RMS
    let sumSq = 0
    for (let i = 0; i < this.buffer.length; i++) {
      const s = (this.buffer[i] - 128) / 128
      sumSq += s * s
    }
    const raw = Math.sqrt(sumSq / this.buffer.length)

    // One-pole lowpass: smoothed += (raw - smoothed) * (1 - exp(-dt / tau))
    const alpha = 1 - Math.exp(-dt / this.tau)
    this.smoothed += (raw - this.smoothed) * alpha

    return this.smoothed
  }
}
