import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { Scene } from './App'

describe('<Scene />', () => {
  it('mounts without error', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Scene backgroundUrl="" isDebug={false} />,
    )
    expect(renderer.scene).toBeDefined()
    await renderer.unmount()
  })

  it('contains a mesh (Droplet icosphere)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Scene backgroundUrl="" isDebug={false} />,
    )
    const meshes = renderer.scene.findAllByType('Mesh')
    expect(meshes.length).toBeGreaterThan(0)
    await renderer.unmount()
  })
})
