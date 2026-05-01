import { useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Leva, useControls } from 'leva'
import { SceneBackground } from './SceneBackground'
import { Droplet } from './Droplet'
import { ReiterCA, type ReiterCAHandle } from './gfx/sim/ReiterCA'
import { CrystalMesh } from './gfx/CrystalMesh'

function getQueryParam(key: string): string {
  return new URLSearchParams(globalThis.location?.search ?? '').get(key) ?? ''
}

function isDebugMode(): boolean {
  return (
    import.meta.env.DEV ||
    new URLSearchParams(globalThis.location?.search ?? '').has('debug')
  )
}

export function Scene({
  backgroundUrl,
  isDebug,
  showDroplet,
}: {
  backgroundUrl: string
  isDebug: boolean
  showDroplet: boolean
}) {
  const caRef = useRef<ReiterCAHandle>(null)

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 5]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      {showDroplet && <Droplet isDebug={isDebug} />}
      <ReiterCA
        ref={caRef}
        growthRate={1}
        maxIterations={200}
        seed={42}
        debug={isDebug}
      />
      <CrystalMesh getDensityTexture={() => caRef.current?.densityTexture ?? null} />
      <SceneBackground url={backgroundUrl || undefined} />
      <OrbitControls />
    </>
  )
}

export function App() {
  const debug = isDebugMode()
  const dropletOn = !new URLSearchParams(globalThis.location?.search ?? '').has('droplet-off')
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
        <Scene backgroundUrl={backgroundUrl} isDebug={debug} showDroplet={dropletOn} />
      </Canvas>
    </>
  )
}
