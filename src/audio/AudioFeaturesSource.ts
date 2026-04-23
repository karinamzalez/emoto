import { RmsAnalyser } from './RmsAnalyser'
import { YinDetector } from './YinDetector'
import { SpectralCentroidAnalyser } from './SpectralCentroidAnalyser'
import { HarmonicityAnalyser } from './HarmonicityAnalyser'

export interface AudioFeatures {
  rms: number
  pitchHz: number | null
  centroidHz: number
  harmonicity: number
}

export class AudioFeaturesSource {
  private analyserNode: AnalyserNode
  private rmsAnalyser: RmsAnalyser
  private yin: YinDetector
  private centroidAnalyser: SpectralCentroidAnalyser
  private harmonicityAnalyser: HarmonicityAnalyser
  private floatBuf: Float32Array<ArrayBuffer>

  constructor(analyser: AnalyserNode, sampleRate: number) {
    this.analyserNode = analyser
    this.rmsAnalyser = new RmsAnalyser(analyser)
    this.yin = new YinDetector(sampleRate, analyser.fftSize)
    this.centroidAnalyser = new SpectralCentroidAnalyser(analyser, sampleRate)
    this.harmonicityAnalyser = new HarmonicityAnalyser(analyser, sampleRate)
    this.floatBuf = new Float32Array(analyser.fftSize) as Float32Array<ArrayBuffer>
  }

  read(dt: number): AudioFeatures {
    const rms = this.rmsAnalyser.read(dt)
    const centroidHz = this.centroidAnalyser.read(dt)
    const harmonicity = this.harmonicityAnalyser.read(dt)

    this.analyserNode.getFloatTimeDomainData(this.floatBuf)
    const pitchHz = this.yin.detect(this.floatBuf)

    return { rms, pitchHz, centroidHz, harmonicity }
  }
}
