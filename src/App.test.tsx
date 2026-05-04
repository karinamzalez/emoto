import { afterEach, describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { Scene } from './App'

// Drain React's async scheduler queue so setImmediate callbacks don't fire
// after JSDOM is torn down, which would throw "window is not defined".
afterEach(async () => {
  await new Promise<void>((resolve) => setImmediate(resolve))
})

describe('<Scene />', () => {
  it('mounts without error', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Scene backgroundUrl="" isDebug={false} showDroplet={true} />,
    )
    expect(renderer.scene).toBeDefined()
    await renderer.unmount()
  })

  it('contains a mesh (Droplet icosphere)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Scene backgroundUrl="" isDebug={false} showDroplet={true} />,
    )
    const meshes = renderer.scene.findAllByType('Mesh')
    expect(meshes.length).toBeGreaterThan(0)
    await renderer.unmount()
  })
})
