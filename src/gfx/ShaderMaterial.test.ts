import { describe, it, expect, vi } from 'vitest'
import { ShaderMaterial } from './ShaderMaterial'
import type p5 from 'p5'

function makeMockP5() {
  const mockShader = { setUniform: vi.fn() }
  return {
    s: {
      createShader: vi.fn().mockReturnValue(mockShader),
      shader: vi.fn(),
    } as unknown as p5,
    mockShader,
  }
}

describe('ShaderMaterial', () => {
  it('calls p5.createShader with provided vert and frag sources', () => {
    const { s } = makeMockP5()
    const mat = new ShaderMaterial('vert-src', 'frag-src')
    mat.getShader(s)
    expect(s.createShader).toHaveBeenCalledWith('vert-src', 'frag-src')
  })

  it('reuses the compiled shader on subsequent calls', () => {
    const { s } = makeMockP5()
    const mat = new ShaderMaterial('vert', 'frag')
    const s1 = mat.getShader(s)
    const s2 = mat.getShader(s)
    expect(s.createShader).toHaveBeenCalledTimes(1)
    expect(s1).toBe(s2)
  })

  it('re-creates shader after invalidate()', () => {
    const { s } = makeMockP5()
    const mat = new ShaderMaterial('vert', 'frag')
    mat.getShader(s)
    mat.invalidate()
    mat.getShader(s)
    expect(s.createShader).toHaveBeenCalledTimes(2)
  })

  it('applies shader and sets uniforms', () => {
    const { s, mockShader } = makeMockP5()
    const mat = new ShaderMaterial('vert', 'frag')
    mat.apply(s, { uTime: 1.5, uResolution: [800, 600] })
    expect(s.shader).toHaveBeenCalled()
    expect(mockShader.setUniform).toHaveBeenCalledWith('uTime', 1.5)
    expect(mockShader.setUniform).toHaveBeenCalledWith('uResolution', [800, 600])
  })
})
