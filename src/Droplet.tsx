import { useRef, forwardRef, useImperativeHandle, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useControls } from 'leva'
import * as THREE from 'three'
import { useBackFaceFBO } from './hooks/useBackFaceFBO'
import { buildBipyramidGeometry } from './lib/buildBipyramidGeometry'
import { morphWeightFromCrystallinity } from './lib/morphWeightFromCrystallinity'

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
// Called once per channel when USE_DISPERSION is active (different IOR each time).
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

// Window hook types used by Playwright tests
type SetMaterialFn = (props: Partial<THREE.MeshPhysicalMaterial>) => void
type SetCrystallinityFn = (value: number | null) => void

interface DropletProps {
  isDebug: boolean
}

export const Droplet = forwardRef<DropletHandle, DropletProps>(({ isDebug }, ref) => {
  const meshRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshPhysicalMaterial>(null)
  const frozenY = useRef<number | null>(null)
  const shaderRef = useRef<THREE.WebGLProgramParametersWithUniforms | null>(null)
  // Persists across R3F reconciliation — applied each frame in useFrame
  const frameOverrideRef = useRef<Partial<THREE.MeshPhysicalMaterial> | null>(null)
  const crystallinityOverrideRef = useRef<number | null>(null)
  const bipyramidGeoRef = useRef<THREE.BufferGeometry | null>(null)
  const defaults = dropletMaterialDefaults()

  const backFaceFBO = useBackFaceFBO(meshRef)

  const {
    ior,
    roughness,
    thickness,
    reflectivity,
    clearcoat,
    clearcoatRoughness,
    rotationSpeed,
    iridescence,
    iridescenceIOR,
    iridescenceThicknessMin,
    iridescenceThicknessMax,
    chromaticAberration,
    crystallinity,
  } = useControls('Droplet', {
    ior: { value: defaults.ior, min: 1, max: 2.5, step: 0.01 },
    roughness: { value: defaults.roughness, min: 0, max: 1, step: 0.01 },
    thickness: { value: defaults.thickness, min: 0, max: 10, step: 0.1 },
    reflectivity: { value: defaults.reflectivity, min: 0, max: 1, step: 0.01 },
    clearcoat: { value: defaults.clearcoat, min: 0, max: 1, step: 0.01 },
    clearcoatRoughness: { value: defaults.clearcoatRoughness, min: 0, max: 1, step: 0.01 },
    rotationSpeed: { value: 0.1, min: 0, max: 2, step: 0.01, label: 'rotation speed' },
    iridescence: { value: 0.3, min: 0, max: 1, step: 0.01 },
    iridescenceIOR: { value: 1.3, min: 1, max: 2.5, step: 0.01, label: 'iridescence IOR' },
    iridescenceThicknessMin: { value: 100, min: 0, max: 1000, step: 10, label: 'thickness min (nm)' },
    iridescenceThicknessMax: { value: 400, min: 0, max: 1000, step: 10, label: 'thickness max (nm)' },
    chromaticAberration: { value: 0.3, min: 0, max: 1, step: 0.01, label: 'chromatic aberration' },
    crystallinity: { value: 0, min: 0, max: 1, step: 0.01 },
  })

  useImperativeHandle(ref, () => ({
    setMaterial(partial) {
      if (!matRef.current) return
      Object.assign(matRef.current, partial)
      matRef.current.needsUpdate = true
    },
  }))

  // Add bipyramid morph positions as custom vertex attributes on the icosphere.
  // We use regular attributes (not morphAttributes) to avoid Three.js's morph target
  // machinery, which requires morphTargetInfluences to be pre-initialized.
  // The vertex shader (patched in onBeforeCompile) lerps between position/aMorphPos
  // and normal/aMorphNormal based on the u_crystallinity uniform.
  useEffect(() => {
    const geo = meshRef.current?.geometry
    if (!geo) return

    const bipyramid = buildBipyramidGeometry(0.7, 1.1, 4)
    bipyramidGeoRef.current = bipyramid

    geo.setAttribute('aMorphPos', bipyramid.attributes.position as THREE.BufferAttribute)
    geo.setAttribute('aMorphNormal', bipyramid.attributes.normal as THREE.BufferAttribute)

    // Add u_crystallinity uniform to the already-compiled shader (first compile uses 0)
    if (shaderRef.current && !shaderRef.current.uniforms.u_crystallinity) {
      shaderRef.current.uniforms.u_crystallinity = { value: 0 }
    }

    return () => {
      bipyramidGeoRef.current?.dispose()
      bipyramidGeoRef.current = null
    }
  }, [])

  useEffect(() => {
    const w = window as Window & {
      __emotoFreezeDroplet?: (angle: number | null) => void
      __emotoSetMaterial?: SetMaterialFn
      __emotoSetCrystallinity?: SetCrystallinityFn
    }
    w.__emotoFreezeDroplet = (angle) => {
      frozenY.current = angle
    }
    // Sets a per-frame override that survives R3F reconciliation
    w.__emotoSetMaterial = (props) => {
      frameOverrideRef.current = props ? { ...frameOverrideRef.current, ...props } : null
    }
    w.__emotoSetCrystallinity = (value) => {
      crystallinityOverrideRef.current = value
    }
    return () => {
      delete w.__emotoFreezeDroplet
      delete w.__emotoSetMaterial
      delete w.__emotoSetCrystallinity
    }
  }, [])

  useFrame(({ size }, delta) => {
    // Apply frame-level overrides AFTER R3F reconciles JSX props
    if (frameOverrideRef.current && matRef.current) {
      Object.assign(matRef.current, frameOverrideRef.current)
      matRef.current.needsUpdate = true
    }

    if (meshRef.current) {
      if (frozenY.current !== null) {
        meshRef.current.rotation.y = frozenY.current
      } else {
        meshRef.current.rotation.y += (isDebug ? rotationSpeed : 0.1) * delta
      }
    }

    if (shaderRef.current) {
      shaderRef.current.uniforms.tBackfaceNormals.value = backFaceFBO.texture
      shaderRef.current.uniforms.uResolution.value.set(size.width, size.height)
      if (shaderRef.current.uniforms.u_crystallinity) {
        shaderRef.current.uniforms.u_crystallinity.value = morphWeightFromCrystallinity(
          crystallinityOverrideRef.current ?? crystallinity,
        )
      }
    }
  })

  // Three.js's USE_DISPERSION shader path calls getVolumeTransmissionRay once per
  // channel with a slightly shifted IOR — our patched version handles this naturally.
  // Scale chromaticAberration (0–1) to Three.js dispersion (Abbe-number-like, ~0–10).
  const dispersion = chromaticAberration * 10

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
        iridescence={iridescence}
        iridescenceIOR={iridescenceIOR}
        iridescenceThicknessRange={[iridescenceThicknessMin, iridescenceThicknessMax]}
        dispersion={dispersion}
        onBeforeCompile={(shader) => {
          shaderRef.current = shader

          shader.uniforms.tBackfaceNormals = { value: null }
          shader.uniforms.uResolution = { value: new THREE.Vector2(800, 800) }
          shader.uniforms.u_crystallinity = { value: 0 }

          // Patch vertex shader: lerp position and normal toward bipyramid shape
          shader.vertexShader =
            `attribute vec3 aMorphPos;\n` +
            `attribute vec3 aMorphNormal;\n` +
            `uniform float u_crystallinity;\n` +
            shader.vertexShader
              .replace(
                '#include <beginnormal_vertex>',
                `vec3 objectNormal = normalize(mix(normal, aMorphNormal, u_crystallinity));
#ifdef USE_TANGENT
  vec3 objectTangent = vec3(tangent.xyz);
#endif`,
              )
              .replace(
                '#include <begin_vertex>',
                `vec3 transformed = mix(position, aMorphPos, u_crystallinity);`,
              )

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
