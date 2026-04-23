import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSketch, clampPixelDensity } from './sketch'
import p5 from 'p5'

vi.mock('p5', () => ({ default: vi.fn() }))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MockP5 = p5 as any

type FakeInstance = {
  windowWidth: number
  windowHeight: number
  WEBGL: string
  key: string
  canvas: unknown
  createCanvas: ReturnType<typeof vi.fn>
  noStroke: ReturnType<typeof vi.fn>
  resizeCanvas: ReturnType<typeof vi.fn>
  pixelDensity: ReturnType<typeof vi.fn>
  setAttributes: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
  millis: ReturnType<typeof vi.fn>
  setup?: () => void
  draw?: () => void
  windowResized?: () => void
  keyPressed?: () => void
}

function makeInstance(): FakeInstance {
  return {
    windowWidth: 800,
    windowHeight: 600,
    WEBGL: 'webgl',
    key: '',
    canvas: { requestFullscreen: vi.fn() },
    createCanvas: vi.fn(() => ({ style: vi.fn() })),
    noStroke: vi.fn(),
    resizeCanvas: vi.fn(),
    pixelDensity: vi.fn(),
    setAttributes: vi.fn(),
    remove: vi.fn(),
    millis: vi.fn(() => 0),
  }
}

describe('clampPixelDensity', () => {
  it('returns ratio unchanged when below cap', () => {
    expect(clampPixelDensity(1)).toBe(1)
    expect(clampPixelDensity(1.5)).toBe(1.5)
  })

  it('clamps to 2 when ratio exceeds cap', () => {
    expect(clampPixelDensity(2)).toBe(2)
    expect(clampPixelDensity(3)).toBe(2)
    expect(clampPixelDensity(4)).toBe(2)
  })
})

describe('createSketch', () => {
  let instance: FakeInstance

  beforeEach(() => {
    instance = makeInstance()
    MockP5.mockImplementation((sketchFn: (s: FakeInstance) => void) => {
      sketchFn(instance)
      return instance
    })
  })

  it('returns a p5 instance', () => {
    const result = createSketch()
    expect(result).toBe(instance)
  })

  it('creates canvas in WEBGL mode on setup', () => {
    createSketch()
    instance.setup!()
    expect(instance.createCanvas).toHaveBeenCalledWith(800, 600, 'webgl')
  })

  it('sets pixel density clamped to 2 on setup', () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true })
    createSketch()
    instance.setup!()
    expect(instance.pixelDensity).toHaveBeenCalledWith(2)
  })

  it('calls resizeCanvas on windowResized', () => {
    vi.useFakeTimers()
    createSketch()
    instance.windowResized!()
    vi.runAllTimers()
    expect(instance.resizeCanvas).toHaveBeenCalledWith(800, 600)
    vi.useRealTimers()
  })
})
