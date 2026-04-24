import { describe, it, expect } from 'vitest'
import { dropletMaterialDefaults } from './Droplet'

describe('dropletMaterialDefaults', () => {
  it('returns ior=1.33 (water refraction index)', () => {
    expect(dropletMaterialDefaults().ior).toBe(1.33)
  })

  it('returns transmission=1 (fully transparent)', () => {
    expect(dropletMaterialDefaults().transmission).toBe(1)
  })

  it('returns metalness=0 (non-metallic)', () => {
    expect(dropletMaterialDefaults().metalness).toBe(0)
  })

  it('returns clearcoat=1 (full clearcoat layer)', () => {
    expect(dropletMaterialDefaults().clearcoat).toBe(1)
  })

  it('returns roughness < 0.1 (near-smooth surface)', () => {
    expect(dropletMaterialDefaults().roughness).toBeLessThan(0.1)
  })

  it('returns thickness > 0 (for absorption/refraction volume)', () => {
    expect(dropletMaterialDefaults().thickness).toBeGreaterThan(0)
  })
})
