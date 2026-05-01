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
      // HDR panoramas: full PMREM pipeline (they really are 360° images)
      new RGBELoader().load(url, (texture) => {
        applyPmremBackground(texture, gl, scene, (t) => { envmap = t }, cancelled)
      })
    } else {
      // Regular images: fill canvas (no cover crop — image stretches to fill at native aspect).
      // Generate PMREM separately for environment/reflections only.
      new THREE.TextureLoader().load(url, (tex) => {
        if (isCancelled) { tex.dispose(); return }

        scene.background = tex
        bgTex = tex

        // Environment map: clone → equirectangular → PMREM for reflections
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
