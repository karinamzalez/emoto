import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
import { resolveBackgroundSource } from './lib/resolveBackgroundSource'

interface Props {
  url?: string
}

function applyPmremBackground(
  texture: THREE.Texture,
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  onEnvmap: (t: THREE.Texture) => void,
  cancelled: () => boolean,
) {
  if (cancelled()) {
    texture.dispose()
    return
  }
  try {
    const pmrem = new THREE.PMREMGenerator(gl)
    pmrem.compileEquirectangularShader()
    const rt = pmrem.fromEquirectangular(texture)
    const envmap = rt.texture
    onEnvmap(envmap)
    scene.background = envmap
    scene.environment = envmap
    texture.dispose()
    pmrem.dispose()
  } catch {
    texture.dispose()
  }
}

export function SceneBackground({ url }: Props) {
  const { scene, gl } = useThree()

  useEffect(() => {
    let envmap: THREE.Texture | null = null
    let bgTex: THREE.Texture | null = null
    let isCancelled = false
    const cancelled = () => isCancelled

    if (!url) {
      scene.background = new THREE.Color(0x3a4090)
    } else if (resolveBackgroundSource(url) === 'rgbe') {
      new RGBELoader().load(url, (texture) => {
        applyPmremBackground(texture, gl, scene, (t) => { envmap = t }, cancelled)
      })
    } else {
      new THREE.TextureLoader().load(url, (tex) => {
        if (isCancelled) { tex.dispose(); return }

        const img = tex.image as HTMLImageElement | ImageBitmap
        const iw = 'naturalWidth' in img ? img.naturalWidth : img.width
        const ih = 'naturalHeight' in img ? img.naturalHeight : img.height
        const w = gl.domElement.clientWidth || gl.domElement.width
        const h = gl.domElement.clientHeight || gl.domElement.height

        // Tile at native pixel scale via UV repeat. Mutating tex.image would replace
        // the HTMLImageElement with an ImageBitmap of a different size, which conflicts
        // with Three.js's immutable texStorage2D allocation and silently breaks crystal
        // transmission. Using wrapS/wrapT + repeat keeps the original image intact.
        // colorSpace must be set explicitly — TextureLoader leaves it as NoColorSpace,
        // which makes WebGLBackground set toneMapped=true on the planeMesh and apply
        // ACESFilmic tone mapping to the background, washing out all values to ~226.
        tex.colorSpace = THREE.SRGBColorSpace
        tex.wrapS = THREE.RepeatWrapping
        tex.wrapT = THREE.RepeatWrapping
        tex.repeat.set(w / iw, h / ih)
        tex.needsUpdate = true

        bgTex = tex
        scene.background = tex

        // Environment map for reflections — new THREE.Texture so envTex has its own Source.
        // tex.clone() would share tex.source; when envTex.dispose() drops usedTimes to 0 it
        // deletes the shared GL texture, leaving tex with an empty handle on first render.
        const envTex = new THREE.Texture(img as HTMLImageElement)
        envTex.mapping = THREE.EquirectangularReflectionMapping
        envTex.needsUpdate = true
        try {
          const pmrem = new THREE.PMREMGenerator(gl)
          pmrem.compileEquirectangularShader()
          const rt = pmrem.fromEquirectangular(envTex)
          envmap = rt.texture
          scene.environment = envmap
          pmrem.dispose()
        } finally {
          envTex.dispose()
        }
      })
    }

    return () => {
      isCancelled = true
      scene.background = null
      scene.environment = null
      bgTex?.dispose()
      envmap?.dispose()
      bgTex = null
      envmap = null
    }
  }, [url, scene, gl])

  return null
}
