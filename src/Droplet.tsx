import { useRef, forwardRef, useImperativeHandle, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useControls } from 'leva'
import * as THREE from 'three'
import { useBackFaceFBO } from './hooks/useBackFaceFBO'

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

// GLSL replacement for getVolumeTransmissionRay — adds two-bounce refraction
// via the back-face normal FBO so thickness-aware offsets use both surfaces.
const PATCHED_TRANSMISSION_RAY = /* glsl */ `
vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
  // Entry refraction: air → glass (single bounce from front-face normal)
  vec3 rd1 = refract( -v, normalize( n ), 1.0 / ior );

  // Read back-face view-space normal from FBO at screen UV
  vec2 screenUV = gl_FragCoord.xy / uResolution;
  vec3 backNormal = texture2D( tBackfaceNormals, screenUV ).rgb * 2.0 - 1.0;

  // Exit refraction: glass → air (back-face normal from BackSide is inward)
  vec3 rd2 = refract( rd1, backNormal, ior );

  // Fall back to single-bounce on TIR or before FBO is populated
  vec3 refractionVector = ( length( rd2 ) > 0.001 ) ? rd2 : rd1;

  vec3 modelScale;
  extractModelScale( modelMatrix, modelScale );
  return normalize( refractionVector ) * thickness * length( modelScale );
}
`

interface DropletProps {
  isDebug: boolean
}

export const Droplet = forwardRef<DropletHandle, DropletProps>(({ isDebug }, ref) => {
  const meshRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshPhysicalMaterial>(null)
  const frozenY = useRef<number | null>(null)
  // Holds the compiled shader uniforms so we can update them each frame
  const shaderRef = useRef<THREE.WebGLProgramParametersWithUniforms | null>(null)
  const defaults = dropletMaterialDefaults()

  const backFaceFBO = useBackFaceFBO(meshRef)

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

  useFrame(({ size }, delta) => {
    // Rotation
    if (meshRef.current) {
      if (frozenY.current !== null) {
        meshRef.current.rotation.y = frozenY.current
      } else {
        meshRef.current.rotation.y += (isDebug ? rotationSpeed : 0.1) * delta
      }
    }

    // Feed current FBO texture + resolution into the patched shader uniforms
    if (shaderRef.current) {
      shaderRef.current.uniforms.tBackfaceNormals.value = backFaceFBO.texture
      shaderRef.current.uniforms.uResolution.value.set(size.width, size.height)
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
        onBeforeCompile={(shader) => {
          shaderRef.current = shader

          // Declare custom uniforms
          shader.uniforms.tBackfaceNormals = { value: null }
          shader.uniforms.uResolution = { value: new THREE.Vector2(800, 800) }

          // Prepend uniform declarations and replace getVolumeTransmissionRay
          shader.fragmentShader =
            `uniform sampler2D tBackfaceNormals;\n` +
            `uniform vec2 uResolution;\n` +
            shader.fragmentShader.replace(
              /vec3 getVolumeTransmissionRay\b[^{]*\{[\s\S]*?\n\t\}/,
              PATCHED_TRANSMISSION_RAY,
            )
        }}
      />
    </mesh>
  )
})

Droplet.displayName = 'Droplet'
