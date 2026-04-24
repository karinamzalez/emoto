import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'

export function Scene() {
  const isDebug =
    import.meta.env.DEV || new URLSearchParams(globalThis.location?.search ?? '').has('debug')
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 5]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <mesh>
        <boxGeometry />
        <meshStandardMaterial color="royalblue" />
      </mesh>
      {isDebug && <OrbitControls />}
    </>
  )
}

export function App() {
  return (
    <Canvas id="r3f-canvas" gl={{ preserveDrawingBuffer: true }} style={{ position: 'fixed', inset: 0 }}>
      <Scene />
    </Canvas>
  )
}
