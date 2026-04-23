export type MicState = 'idle' | 'requesting' | 'listening' | 'denied' | 'unsupported' | 'watch-only'

export interface MicReadyPayload {
  analyser: AnalyserNode
  sampleRate: number
}

type AudioReadyCallback = (payload: MicReadyPayload) => void
type StateChangeCallback = (state: MicState) => void

export class Mic {
  private context: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private stream: MediaStream | null = null
  private _state: MicState = 'idle'
  private _sampleRate = 0

  private onAudioReady: AudioReadyCallback | null = null
  private onStateChange: StateChangeCallback | null = null

  get state(): MicState {
    return this._state
  }

  get sampleRate(): number {
    return this._sampleRate
  }

  get analyserNode(): AnalyserNode | null {
    return this.analyser
  }

  onReady(cb: AudioReadyCallback): this {
    this.onAudioReady = cb
    return this
  }

  onChange(cb: StateChangeCallback): this {
    this.onStateChange = cb
    return this
  }

  private setState(next: MicState): void {
    this._state = next
    this.onStateChange?.(next)
  }

  async requestMic(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.setState('unsupported')
      return
    }

    this.setState('requesting')

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.context = new AudioContext()
      this.analyser = this.context.createAnalyser()
      this.analyser.fftSize = 2048
      this._sampleRate = this.context.sampleRate

      const source = this.context.createMediaStreamSource(this.stream)
      // MediaStreamSource → Analyser (no speakers — do NOT connect to destination)
      source.connect(this.analyser)

      this.setState('listening')
      this.onAudioReady?.({ analyser: this.analyser, sampleRate: this._sampleRate })
    } catch {
      this.setState('denied')
    }
  }

  async startWatchOnly(): Promise<void> {
    this.context = new AudioContext()
    this.analyser = this.context.createAnalyser()
    this.analyser.fftSize = 2048
    this._sampleRate = this.context.sampleRate

    // Attempt to load optional fallback audio; use silent buffer if absent
    let buffer: AudioBuffer
    try {
      const response = await fetch('/fallback.mp3')
      if (!response.ok) throw new Error('no fallback asset')
      const arrayBuffer = await response.arrayBuffer()
      buffer = await this.context.decodeAudioData(arrayBuffer)
    } catch {
      buffer = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate)
    }

    const source = this.context.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.connect(this.analyser)
    // Do NOT connect analyser to destination — watch-only means silent
    source.start()

    this.setState('watch-only')
    this.onAudioReady?.({ analyser: this.analyser, sampleRate: this._sampleRate })
  }

  destroy(): void {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.context?.close()
    this.context = null
    this.analyser = null
    this.stream = null
    this.setState('idle')
  }
}
