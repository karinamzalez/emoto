import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
import { resolveBackgroundSource } from './lib/resolveBackgroundSource'

function buildDefaultTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 512, 256)
    grad.addColorStop(0, '#3a4090')
    grad.addColorStop(0.5, '#2a5080')
    grad.addColorStop(1, '#1a3870')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 512, 256)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.mapping = THREE.EquirectangularReflectionMapping
  return tex
}

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
      // For the default gradient, set scene.background directly without PMREM
      // (equirectangular textures can be used as background without prefiltering)
      const tex = buildDefaultTexture()
      scene.background = tex
      envmap = tex
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
