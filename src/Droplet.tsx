import { useRef, forwardRef, useImperativeHandle, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useControls } from 'leva'
import * as THREE from 'three'

export interface DropletMaterialDefaults {
  transmission: number
  ior: number
  roughness: number
  thickness: number
  metalness: number
  clearcoat: number
  clearcoatRoughness: number
  reflectivity: number
}

export interface DropletHandle {
  setMaterial: (partial: Partial<DropletMaterialDefaults>) => void
}

export function dropletMaterialDefaults(): DropletMaterialDefaults {
  return {
    transmission: 1,
    ior: 1.33,
    roughness: 0.05,
    thickness: 1.5,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    reflectivity: 0.5,
  }
}

interface DropletProps {
  isDebug: boolean
}

export const Droplet = forwardRef<DropletHandle, DropletProps>(({ isDebug }, ref) => {
  const meshRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshPhysicalMaterial>(null)
  const frozenY = useRef<number | null>(null)
  const defaults = dropletMaterialDefaults()

  const { ior, roughness, thickness, reflectivity, clearcoat, clearcoatRoughness, rotationSpeed } =
    useControls('Droplet', {
      ior: { value: defaults.ior, min: 1, max: 2.5, step: 0.01 },
      roughness: { value: defaults.roughness, min: 0, max: 1, step: 0.01 },
      thickness: { value: defaults.thickness, min: 0, max: 10, step: 0.1 },
      reflectivity: { value: defaults.reflectivity, min: 0, max: 1, step: 0.01 },
      clearcoat: { value: defaults.clearcoat, min: 0, max: 1, step: 0.01 },
      clearcoatRoughness: { value: defaults.clearcoatRoughness, min: 0, max: 1, step: 0.01 },
      rotationSpeed: { value: 0.1, min: 0, max: 2, step: 0.01, label: 'rotation speed' },
    })

  useImperativeHandle(ref, () => ({
    setMaterial(partial) {
      if (!matRef.current) return
      Object.assign(matRef.current, partial)
      matRef.current.needsUpdate = true
    },
  }))

  useEffect(() => {
    const w = window as Window & { __emotoFreezeDroplet?: (angle: number | null) => void }
    w.__emotoFreezeDroplet = (angle) => {
      frozenY.current = angle
    }
    return () => {
      delete w.__emotoFreezeDroplet
    }
  }, [])

  useFrame((_, delta) => {
    if (!meshRef.current) return
    if (frozenY.current !== null) {
      meshRef.current.rotation.y = frozenY.current
    } else {
      meshRef.current.rotation.y += (isDebug ? rotationSpeed : 0.1) * delta
    }
  })

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1, 4]} />
      <meshPhysicalMaterial
        ref={matRef}
        transmission={defaults.transmission}
        ior={ior}
        roughness={roughness}
        thickness={thickness}
        metalness={defaults.metalness}
        clearcoat={clearcoat}
        clearcoatRoughness={clearcoatRoughness}
        reflectivity={reflectivity}
      />
    </mesh>
  )
})

Droplet.displayName = 'Droplet'
