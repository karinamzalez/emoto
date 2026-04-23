import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Mic, type MicState } from './Mic'

// ---------------------------------------------------------------------------
// Minimal AudioContext / AnalyserNode / AudioNode fakes
// ---------------------------------------------------------------------------

function makeAnalyserFake(): AnalyserNode {
  return {
    fftSize: 0,
    connect: vi.fn(),
  } as unknown as AnalyserNode
}

function makeContextFake(analyser: AnalyserNode) {
  return {
    sampleRate: 44100,
    createAnalyser: vi.fn(() => analyser),
    createMediaStreamSource: vi.fn(() => ({ connect: vi.fn() })),
    createBuffer: vi.fn(
      (_ch: number, length: number, sr: number) =>
        ({ length, sampleRate: sr }) as unknown as AudioBuffer
    ),
    createBufferSource: vi.fn(() => ({
      buffer: null as AudioBuffer | null,
      loop: false,
      connect: vi.fn(),
      start: vi.fn(),
    })),
    close: vi.fn(),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Mic', () => {
  let analyserFake: AnalyserNode
  let contextFake: ReturnType<typeof makeContextFake>

  beforeEach(() => {
    analyserFake = makeAnalyserFake()
    contextFake = makeContextFake(analyserFake)

    // Patch global AudioContext
    vi.stubGlobal(
      'AudioContext',
      vi.fn(() => contextFake)
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('requestMic', () => {
    it('sets state to denied when getUserMedia rejects', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: vi.fn().mockRejectedValue(new Error('NotAllowedError')) },
        configurable: true,
      })

      const mic = new Mic()
      const states: MicState[] = []
      mic.onChange((s) => states.push(s))

      await mic.requestMic()

      expect(states).toEqual(['requesting', 'denied'])
      expect(mic.state).toBe('denied')
    })

    it('sets state to unsupported when mediaDevices is absent', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: undefined,
        configurable: true,
      })

      const mic = new Mic()
      await mic.requestMic()

      expect(mic.state).toBe('unsupported')
    })

    it('sets state to listening and fires audioReady on success', async () => {
      const fakeStream = { getTracks: vi.fn(() => []) } as unknown as MediaStream
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: vi.fn().mockResolvedValue(fakeStream) },
        configurable: true,
      })

      const mic = new Mic()
      const readyPayloads: Array<{ sampleRate: number }> = []
      mic.onReady((p) => readyPayloads.push(p))

      await mic.requestMic()

      expect(mic.state).toBe('listening')
      expect(readyPayloads).toHaveLength(1)
      expect(readyPayloads[0].sampleRate).toBe(44100)
    })

    it('creates AnalyserNode with fftSize 2048', async () => {
      const fakeStream = { getTracks: vi.fn(() => []) } as unknown as MediaStream
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: vi.fn().mockResolvedValue(fakeStream) },
        configurable: true,
      })

      const mic = new Mic()
      await mic.requestMic()

      expect(analyserFake.fftSize).toBe(2048)
    })

    it('does NOT connect analyser to destination', async () => {
      const fakeStream = { getTracks: vi.fn(() => []) } as unknown as MediaStream
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: vi.fn().mockResolvedValue(fakeStream) },
        configurable: true,
      })

      const mic = new Mic()
      await mic.requestMic()

      // contextFake has no destination — if code tried to connect it would throw
      // We verify that createMediaStreamSource's output connects only to the analyser
      const sourceFake = contextFake.createMediaStreamSource.mock.results[0].value as {
        connect: ReturnType<typeof vi.fn>
      }
      expect(sourceFake.connect).toHaveBeenCalledWith(analyserFake)
      expect(sourceFake.connect).toHaveBeenCalledTimes(1)
    })

    it('stores sample rate from AudioContext', async () => {
      const fakeStream = { getTracks: vi.fn(() => []) } as unknown as MediaStream
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: vi.fn().mockResolvedValue(fakeStream) },
        configurable: true,
      })

      const mic = new Mic()
      await mic.requestMic()

      expect(mic.sampleRate).toBe(44100)
    })
  })

  describe('startWatchOnly', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false } as unknown as Response))
    })

    it('sets state to watch-only', async () => {
      const mic = new Mic()
      await mic.startWatchOnly()
      expect(mic.state).toBe('watch-only')
    })

    it('fires audioReady with sampleRate', async () => {
      const mic = new Mic()
      const payloads: Array<{ sampleRate: number }> = []
      mic.onReady((p) => payloads.push(p))
      await mic.startWatchOnly()
      expect(payloads[0].sampleRate).toBe(44100)
    })
  })

  describe('destroy', () => {
    it('calls close on AudioContext and stop on tracks', async () => {
      const stopFn = vi.fn()
      const fakeStream = {
        getTracks: vi.fn(() => [{ stop: stopFn }]),
      } as unknown as MediaStream
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: vi.fn().mockResolvedValue(fakeStream) },
        configurable: true,
      })

      const mic = new Mic()
      await mic.requestMic()
      mic.destroy()

      expect(stopFn).toHaveBeenCalled()
      expect(contextFake.close).toHaveBeenCalled()
    })
  })
})
