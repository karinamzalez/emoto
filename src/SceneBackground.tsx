import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
import { resolveBackgroundSource } from './lib/resolveBackgroundSource'

interface Props {
  url?: string
}

export function SceneBackground({ url }: Props) {
  const { scene, gl } = useThree()

  useEffect(() => {
    let envmap: THREE.Texture | null = null
    let cancelled = false

    function applyTexture(texture: THREE.Texture) {
      if (cancelled) {
        texture.dispose()
        return
      }
      try {
        const pmrem = new THREE.PMREMGenerator(gl)
        pmrem.compileEquirectangularShader()
        const rt = pmrem.fromEquirectangular(texture)
        envmap = rt.texture
        scene.background = envmap
        scene.environment = envmap
        texture.dispose()
        pmrem.dispose()
      } catch {
        texture.dispose()
      }
    }

    if (!url) {
      scene.background = new THREE.Color(0x3a4090)
    } else if (resolveBackgroundSource(url) === 'rgbe') {
      new RGBELoader().load(url, applyTexture)
    } else {
      new THREE.TextureLoader().load(url, (tex) => {
        tex.mapping = THREE.EquirectangularReflectionMapping
        applyTexture(tex)
      })
    }

    return () => {
      cancelled = true
      if (envmap) {
        envmap.dispose()
        envmap = null
      }
      scene.background = null
      scene.environment = null
    }
  }, [url, scene, gl])

  return null
}
