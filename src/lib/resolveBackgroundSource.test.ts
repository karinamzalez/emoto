import { describe, it, expect } from 'vitest'
import { resolveBackgroundSource } from './resolveBackgroundSource'

describe('resolveBackgroundSource', () => {
  it('returns rgbe for .hdr files', () => {
    expect(resolveBackgroundSource('env.hdr')).toBe('rgbe')
    expect(resolveBackgroundSource('/fixtures/env.HDR')).toBe('rgbe')
  })

  it('returns rgbe for .exr files', () => {
    expect(resolveBackgroundSource('scene.exr')).toBe('rgbe')
  })

  it('returns texture for .jpg files', () => {
    expect(resolveBackgroundSource('bg.jpg')).toBe('texture')
    expect(resolveBackgroundSource('/fixtures/test-bg.jpg')).toBe('texture')
  })

  it('returns texture for .png files', () => {
    expect(resolveBackgroundSource('/fixtures/test-bg.png')).toBe('texture')
  })

  it('returns texture for other extensions', () => {
    expect(resolveBackgroundSource('bg.webp')).toBe('texture')
    expect(resolveBackgroundSource('bg.jpeg')).toBe('texture')
  })

  it('ignores query strings when detecting extension', () => {
    expect(resolveBackgroundSource('env.hdr?v=1')).toBe('rgbe')
    expect(resolveBackgroundSource('bg.png?v=2')).toBe('texture')
  })
})
