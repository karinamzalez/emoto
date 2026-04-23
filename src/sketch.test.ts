import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSketch } from './sketch'
import p5 from 'p5'

vi.mock('p5', () => ({ default: vi.fn() }))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MockP5 = p5 as any

type FakeInstance = {
  windowWidth: number
  windowHeight: number
  WEBGL: string
  createCanvas: ReturnType<typeof vi.fn>
  background: ReturnType<typeof vi.fn>
  resizeCanvas: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
  setup?: () => void
  draw?: () => void
  windowResized?: () => void
}

function makeInstance(): FakeInstance {
  return {
    windowWidth: 800,
    windowHeight: 600,
    WEBGL: 'webgl',
    createCanvas: vi.fn(() => ({ style: vi.fn() })),
    background: vi.fn(),
    resizeCanvas: vi.fn(),
    remove: vi.fn(),
  }
}

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
})
