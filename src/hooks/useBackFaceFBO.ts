import { useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const VERT = /* glsl */ `
varying vec3 vNormal;
void main() {
  // normalMatrix already accounts for BackSide flip
  vNormal = normalize( normalMatrix * normal );
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`

const FRAG = /* glsl */ `
varying vec3 vNormal;
void main() {
  // Pack view-space normal to [0, 1] for storage
  gl_FragColor = vec4( vNormal * 0.5 + 0.5, 1.0 );
}
`

/**
 * Renders back faces of a mesh to an off-screen FBO each frame, encoding
 * view-space normals in RGB. The FBO texture is used by the front-face
 * shader to compute two-bounce refraction.
 *
 * Returns the render target; its .texture is updated each frame.
 */
export function useBackFaceFBO(
  meshRef: React.RefObject<THREE.Mesh | null>,
): THREE.WebGLRenderTarget {
  const { gl, camera, size } = useThree()

  const fbo = useMemo(
    () =>
      new THREE.WebGLRenderTarget(size.width, size.height, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        type: THREE.HalfFloatType,
        depthBuffer: true,
      }),
    [],
  )

  // Resize FBO when canvas size changes
  useEffect(() => {
    fbo.setSize(size.width, size.height)
  }, [fbo, size.width, size.height])

  // Material that outputs view-space normals; BackSide flips them inward
  const backMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        side: THREE.BackSide,
      }),
    [],
  )

  // Proxy mesh in its own scene — shares geometry, syncs world matrix each frame
  const [backScene, backMesh] = useMemo(() => {
    const scene = new THREE.Scene()
    const mesh = new THREE.Mesh(undefined, backMat)
    mesh.matrixAutoUpdate = false
    scene.add(mesh)
    return [scene, mesh] as const
  }, [backMat])

  useEffect(() => {
    return () => {
      fbo.dispose()
      backMat.dispose()
    }
  }, [fbo, backMat])

  useFrame(() => {
    const src = meshRef.current
    if (!src?.geometry) return

    // Keep proxy in sync with the live mesh
    backMesh.geometry = src.geometry
    backMesh.matrixWorld.copy(src.matrixWorld)

    gl.setRenderTarget(fbo)
    gl.clear()
    gl.render(backScene, camera)
    gl.setRenderTarget(null)
  })

  return fbo
}
