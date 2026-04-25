import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Leva, useControls } from 'leva'
import { SceneBackground } from './SceneBackground'
import { Droplet } from './Droplet'

function getQueryParam(key: string): string {
  return new URLSearchParams(globalThis.location?.search ?? '').get(key) ?? ''
}

function isDebugMode(): boolean {
  return (
    import.meta.env.DEV ||
    new URLSearchParams(globalThis.location?.search ?? '').has('debug')
  )
}

export function Scene({ backgroundUrl, isDebug }: { backgroundUrl: string; isDebug: boolean }) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 5]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <Droplet isDebug={isDebug} />
      <SceneBackground url={backgroundUrl || undefined} />
      {isDebug && <OrbitControls />}
    </>
  )
}

export function App() {
  const debug = isDebugMode()
  const { backgroundUrl } = useControls('Background', {
    backgroundUrl: { value: getQueryParam('bg'), label: 'URL' },
  })

  return (
    <>
      <Leva />
      <Canvas
        id="r3f-canvas"
        gl={{ preserveDrawingBuffer: true }}
        style={{ position: 'fixed', inset: 0 }}
      >
        <Scene backgroundUrl={backgroundUrl} isDebug={debug} />
      </Canvas>
    </>
  )
}
