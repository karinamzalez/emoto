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
        const w = gl.domElement.clientWidth
        const h = gl.domElement.clientHeight

        // Replace the image on the TextureLoader-created texture object in-place.
        // Preserves all internal texture state (colorSpace, version tracking) that
        // Three.js uses when setting up the background planeMesh — any new texture
        // object deviates from that baseline and silently breaks crystal transmission.
        const offscreen = new OffscreenCanvas(w, h)
        const ctx = offscreen.getContext('2d', { colorSpace: 'srgb' })!
        for (let y = 0; y < h; y += ih) {
          for (let x = 0; x < w; x += iw) {
            ctx.drawImage(img as CanvasImageSource, x, y)
          }
        }
        tex.image = offscreen.transferToImageBitmap() as unknown as HTMLImageElement
        tex.needsUpdate = true

        bgTex = tex
        scene.background = tex

        // Environment map for reflections
        const envTex = tex.clone()
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
