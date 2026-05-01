import { useRef, useEffect, useState } from 'react'
import { useControls } from 'leva'
import * as THREE from 'three'
import { Droplet } from './Droplet'
import { CrystalMesh } from './gfx/CrystalMesh'
import { crossfadeWeights } from './lib/crossfadeWeights'

interface CrystalProps {
  /** Crystallinity driven by audio mapping (DRE-39). Absent → Leva panel controls it. */
  crystallinity?: number
  getDensityTexture: () => THREE.Texture | null
  isDebug: boolean
}

export function Crystal({ crystallinity, getDensityTexture, isDebug }: CrystalProps) {
  const overrideRef = useRef<number | null>(null)
  const [, tick] = useState(0)

  const { crystallinity: levaVal } = useControls('Crystal', {
    crystallinity: { value: 0, min: 0, max: 1, step: 0.01 },
  })

  useEffect(() => {
    const w = window as Window & { __emotoCrossfade?: (v: number | null) => void }
    w.__emotoCrossfade = (v) => {
      overrideRef.current = v
      tick((n) => n + 1)
    }
    return () => {
      delete w.__emotoCrossfade
    }
  }, [])

  // Priority: Playwright override > prop from audio mapping > Leva panel
  const c = overrideRef.current ?? crystallinity ?? levaVal
  const { droplet, crystal } = crossfadeWeights(c)
  // Slight vertical compression sells the "droplet flattening into a plate" transition
  const scaleY = 1 - 0.15 * c

  return (
    <group scale={[1, scaleY, 1]}>
      <Droplet isDebug={isDebug} opacityOverride={droplet} crystallinityProp={c} />
      <CrystalMesh getDensityTexture={getDensityTexture} opacityOverride={crystal} />
    </group>
  )
}
