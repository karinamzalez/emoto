import { YinDetector } from './YinDetector'

const DEFAULT_TAU_MS = 120

export class HarmonicityAnalyser {
  tau: number = DEFAULT_TAU_MS

  private analyser: AnalyserNode
  private buffer: Float32Array<ArrayBuffer>
  private yin: YinDetector
  private smoothed = 0

  constructor(analyser: AnalyserNode, sampleRate: number) {
    this.analyser = analyser
    this.buffer = new Float32Array(analyser.fftSize) as Float32Array<ArrayBuffer>
    this.yin = new YinDetector(sampleRate, analyser.fftSize)
  }

  /** Call once per frame. `dt` is elapsed time in milliseconds since last call. Returns harmonicity in 0..1. */
  read(dt: number): number {
    this.analyser.getFloatTimeDomainData(this.buffer)

    const { clarity } = this.yin.detectWithClarity(this.buffer)

    const alpha = 1 - Math.exp(-dt / this.tau)
    this.smoothed += (clarity - this.smoothed) * alpha

    return this.smoothed
  }
}
