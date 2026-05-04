import { useRef, useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Leva, useControls } from 'leva'
import { SceneBackground } from './SceneBackground'
import { Crystal } from './Crystal'
import { ReiterCA, type ReiterCAHandle } from './gfx/sim/ReiterCA'
import { LfoPanel } from './animation/LfoPanel'
import { PROP_EASING } from './mapping/defaults'

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
  const [caGrowthRate, setCaGrowthRate] = useState(0)

  useEffect(() => {
    const w = window as Window & { __emotoSetCaGrowthRate?: (v: number) => void }
    w.__emotoSetCaGrowthRate = setCaGrowthRate
    return () => { delete w.__emotoSetCaGrowthRate }
  }, [])

  // DRE-39: Leva controls for live tuning of harmonicity easing — mutates PROP_EASING directly
  const { crystAttackMs, crystReleaseMs, caAttackMs, caReleaseMs } = useControls('Harmonicity', {
    crystAttackMs: { value: 80, min: 10, max: 500, step: 1, label: 'Crystallinity attack ms' },
    crystReleaseMs: { value: 800, min: 100, max: 3000, step: 10, label: 'Crystallinity release ms' },
    caAttackMs: { value: 80, min: 10, max: 500, step: 1, label: 'CA growth attack ms' },
    caReleaseMs: { value: 800, min: 100, max: 3000, step: 10, label: 'CA growth release ms' },
  })

  useEffect(() => {
    PROP_EASING.crystallinity.attackMs = crystAttackMs
    PROP_EASING.crystallinity.releaseMs = crystReleaseMs
    PROP_EASING.caGrowthRate.attackMs = caAttackMs
    PROP_EASING.caGrowthRate.releaseMs = caReleaseMs
  }, [crystAttackMs, crystReleaseMs, caAttackMs, caReleaseMs])

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 5]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <ReiterCA ref={caRef} growthRate={caGrowthRate} maxIterations={200} seed={42} debug={isDebug} />
      <Crystal
        crystallinity={showDroplet ? undefined : 1}
        getDensityTexture={() => caRef.current?.densityTexture ?? null}
        isDebug={isDebug}
      />
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
      <LfoPanel />
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
