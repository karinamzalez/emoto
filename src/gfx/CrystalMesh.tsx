import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useControls } from 'leva'
import * as THREE from 'three'
import { useBackFaceFBO } from '../hooks/useBackFaceFBO'

// Plate base half-thickness in world units (0.15 → total 0.3, 15% of plate diameter 2)
const BASE_HALF = 0.15

// --- Pure functions exported for unit tests ---

/** Center-peaked gaussian profile: 1.0 at (0.5, 0.5), falls off radially. */
export function thicknessProfile(u: number, v: number, sigma: number): number {
  const du = u - 0.5
  const dv = v - 0.5
  return Math.exp(-(du * du + dv * dv) / (2 * sigma * sigma))
}

/**
 * Finds local density maxima above `threshold` in a flat density image.
 * Uses 4-connected neighborhood; skips 1-cell border.
 */
export function detectSubHexTips(
  density: Float32Array,
  width: number,
  height: number,
  threshold = 0.85,
): Array<{ col: number; row: number }> {
  const tips: Array<{ col: number; row: number }> = []
  for (let row = 1; row < height - 1; row++) {
    for (let col = 1; col < width - 1; col++) {
      const v = density[row * width + col]
      if (v < threshold) continue
      const isMax =
        v >= density[row * width + col + 1] &&
        v >= density[row * width + col - 1] &&
        v >= density[(row + 1) * width + col] &&
        v >= density[(row - 1) * width + col]
      if (isMax) tips.push({ col, row })
    }
  }
  return tips
}

// --- Geometry builder ---

/**
 * Hex-plate geometry: a BoxGeometry in the XY plane (thin in Z).
 * Front/back faces (normals ±Z) are N×N subdivided for smooth vertex displacement.
 * Side faces have minimal segments and receive no displacement.
 */
function buildCrystalPlateGeometry(N: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(2, 2, BASE_HALF * 2, N, N, 2)
}

// Two-bounce refraction via back-face FBO — same patch as DRE-58 Droplet.
const PATCHED_TRANSMISSION_RAY = /* glsl */ `
vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
  vec3 rd1 = refract( -v, normalize( n ), 1.0 / ior );

  vec2 screenUV = gl_FragCoord.xy / uResolution;
  vec3 backNormal = texture2D( tBackfaceNormals, screenUV ).rgb * 2.0 - 1.0;

  vec3 rd2 = refract( rd1, backNormal, ior );

  vec3 refractionVector = ( length( rd2 ) > 0.001 ) ? rd2 : rd1;

  vec3 modelScale;
  extractModelScale( modelMatrix, modelScale );
  return normalize( refractionVector ) * thickness * length( modelScale );
}
`

// --- Component ---

interface CrystalMeshProps {
  /** Called each frame to retrieve the latest ping-pong FBO output texture. */
  getDensityTexture: () => THREE.Texture | null
}

export function CrystalMesh({ getDensityTexture }: CrystalMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshPhysicalMaterial>(null)
  const shaderRef = useRef<THREE.WebGLProgramParametersWithUniforms | null>(null)
  const frozenRotationY = useRef<number | null>(null)

  const backFaceFBO = useBackFaceFBO(meshRef)

  const {
    thicknessMult,
    sigma,
    tipBoost,
    meshResolution,
    rotationSpeed,
    ior,
    roughness,
    iridescence,
    iridescenceIOR,
    iridescenceThicknessMin,
    iridescenceThicknessMax,
    chromaticAberration,
  } = useControls('CrystalMesh', {
    thicknessMult: { value: 0.3, min: 0, max: 2, step: 0.01, label: 'thickness mult' },
    sigma: { value: 0.4, min: 0.05, max: 1.0, step: 0.01, label: 'gaussian σ' },
    tipBoost: { value: 0.08, min: 0, max: 0.5, step: 0.01, label: 'tip extrusion' },
    meshResolution: { value: 64, min: 16, max: 128, step: 16, label: 'mesh resolution' },
    rotationSpeed: { value: 0.1, min: 0, max: 2, step: 0.01 },
    ior: { value: 1.5, min: 1, max: 2.5, step: 0.01 },
    roughness: { value: 0.05, min: 0, max: 1, step: 0.01 },
    iridescence: { value: 0.5, min: 0, max: 1, step: 0.01 },
    iridescenceIOR: { value: 1.5, min: 1, max: 2.5, step: 0.01, label: 'iridescence IOR' },
    iridescenceThicknessMin: { value: 100, min: 0, max: 1000, step: 10, label: 'thickness min (nm)' },
    iridescenceThicknessMax: { value: 400, min: 0, max: 1000, step: 10, label: 'thickness max (nm)' },
    chromaticAberration: { value: 0.3, min: 0, max: 1, step: 0.01, label: 'chromatic aberration' },
  })

  const geo = useMemo(() => buildCrystalPlateGeometry(meshResolution), [meshResolution])
  useEffect(() => () => geo.dispose(), [geo])

  useEffect(() => {
    const w = window as Window & { __emotoCrystalFreeze?: (angle: number | null) => void }
    w.__emotoCrystalFreeze = (angle) => {
      frozenRotationY.current = angle
    }
    return () => {
      delete w.__emotoCrystalFreeze
    }
  }, [])

  useFrame(({ size }, delta) => {
    if (meshRef.current) {
      if (frozenRotationY.current !== null) {
        meshRef.current.rotation.y = frozenRotationY.current
      } else {
        meshRef.current.rotation.y += rotationSpeed * delta
      }
    }
    if (shaderRef.current) {
      const tex = getDensityTexture()
      shaderRef.current.uniforms.uDensity.value = tex
      shaderRef.current.uniforms.uThickness.value = thicknessMult
      shaderRef.current.uniforms.uSigma.value = sigma
      shaderRef.current.uniforms.uTipBoost.value = tipBoost
      shaderRef.current.uniforms.tBackfaceNormals.value = backFaceFBO.texture
      shaderRef.current.uniforms.uResolution.value.set(size.width, size.height)
    }
  })

  return (
    <mesh ref={meshRef} geometry={geo}>
      <meshPhysicalMaterial
        ref={matRef}
        transmission={1}
        ior={ior}
        roughness={roughness}
        thickness={1.5}
        metalness={0}
        clearcoat={1}
        clearcoatRoughness={0.1}
        reflectivity={0.5}
        iridescence={iridescence}
        iridescenceIOR={iridescenceIOR}
        iridescenceThicknessRange={[iridescenceThicknessMin, iridescenceThicknessMax]}
        dispersion={chromaticAberration * 10}
        customProgramCacheKey={() => 'CrystalMesh'}
        onBeforeCompile={(shader) => {
          shaderRef.current = shader

          shader.uniforms.uDensity = { value: getDensityTexture() }
          shader.uniforms.uThickness = { value: thicknessMult }
          shader.uniforms.uSigma = { value: sigma }
          shader.uniforms.uTipBoost = { value: tipBoost }
          shader.uniforms.tBackfaceNormals = { value: null }
          shader.uniforms.uResolution = { value: new THREE.Vector2(800, 800) }

          // Inject density-displacement into vertex shader.
          // objectNormal.z = +1 for front face, -1 for back face, 0 for sides.
          // Sampling the CA texture at uv gives the density at this XY position.
          shader.vertexShader =
            `uniform sampler2D uDensity;\n` +
            `uniform float uThickness;\n` +
            `uniform float uSigma;\n` +
            `uniform float uTipBoost;\n` +
            shader.vertexShader.replace(
              '#include <begin_vertex>',
              `vec3 transformed = vec3(position);
float _density = texture2D(uDensity, uv).r;
float _du = uv.x - 0.5;
float _dv = uv.y - 0.5;
float _profile = exp(-(_du*_du + _dv*_dv) / (2.0 * uSigma * uSigma));
float _tipFactor = clamp((_density - 0.85) / 0.15, 0.0, 1.0);
float _aSide = sign(objectNormal.z);
transformed.z += _aSide * (_density * _profile * uThickness + _tipFactor * uTipBoost);`,
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
}
