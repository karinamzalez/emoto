import { createRoot } from 'react-dom/client'
import { App } from './App'
import { Mic } from './audio/Mic'
import { AudioFeaturesSource } from './audio/AudioFeaturesSource'
import { DebugOverlay } from './audio/DebugOverlay'
import { AudioMaterialPipeline } from './mapping/pipeline'
import { lfoBus } from './animation/lfoBus'
import type { OscillatorTarget } from './animation/Oscillators'

createRoot(document.getElementById('root')!).render(<App />)

const overlay = document.getElementById('mic-overlay') as HTMLDivElement
const btnBegin = document.getElementById('btn-begin') as HTMLButtonElement
const btnWatch = document.getElementById('btn-watch') as HTMLButtonElement
const statusEl = document.getElementById('mic-status') as HTMLParagraphElement

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
if (!prefersReduced) {
  btnWatch.style.display = 'none'
}

const isDebugMode = import.meta.env.DEV || new URLSearchParams(location.search).has('debug')
const debugOverlay = isDebugMode ? new DebugOverlay() : null

const mic = new Mic()

// LFO ticker runs independently of audio — rotation drift works even without mic access.
// finalValue = baseDefault + audioDelta + lfoDelta (composition rule from DRE-112)
const BASE_ROUGHNESS = 0.05

const w = window as Window & {
  __emotoSetMaterial?: (props: object) => void
  __emotoSetCrystallinity?: (value: number | null) => void
  __emotoSetDisplacement?: (value: number) => void
  __emotoSetScale?: (value: number) => void
  __emotoSetCaGrowthRate?: (value: number) => void
  __emotoSetRotationOffset?: (x: number, y: number) => void
  __emotoSetLfoTime?: (t: number | null) => void
  __emotoSetLfoEnabled?: (target: string, enabled: boolean) => void
}

let lfoT = 0
let lfoLastT = performance.now()
let lfoTimeOverride: number | null = null
// Cached each lfoTick so audio tick reads without a second frame() call
let cachedLfoFrame = lfoBus.frame(0)

w.__emotoSetLfoTime = (t) => { lfoTimeOverride = t }
w.__emotoSetLfoEnabled = (target, enabled) => {
  lfoBus.setEnabled(target as OscillatorTarget, enabled)
}

function lfoTick() {
  const now = performance.now()
  if (lfoTimeOverride !== null) {
    lfoT = lfoTimeOverride
  } else {
    lfoT += (now - lfoLastT) / 1000
  }
  lfoLastT = now

  cachedLfoFrame = lfoBus.frame(lfoT)
  w.__emotoSetRotationOffset?.(cachedLfoFrame.rotationX, cachedLfoFrame.rotationY)

  requestAnimationFrame(lfoTick)
}
requestAnimationFrame(lfoTick)

mic.onChange((state) => {
  if (state === 'requesting') {
    statusEl.textContent = 'Waiting for microphone permission…'
    btnBegin.disabled = true
  } else if (state === 'denied') {
    statusEl.textContent = 'Microphone access denied. Please allow mic access and refresh.'
    btnBegin.disabled = false
  } else if (state === 'unsupported') {
    statusEl.textContent = 'Your browser does not support microphone access.'
    btnBegin.disabled = true
  } else if (state === 'listening' || state === 'watch-only') {
    overlay.classList.add('hidden')
  }
})

mic.onReady(({ analyser, sampleRate }) => {
  const source = new AudioFeaturesSource(analyser, sampleRate)
  const pipeline = new AudioMaterialPipeline()
  let lastT = performance.now()

  function tick() {
    const now = performance.now()
    const dtMs = now - lastT
    lastT = now

    const features = source.read(dtMs)
    debugOverlay?.update(features)

    if (!isDebugMode) {
      const lfo = cachedLfoFrame
      const props = pipeline.tick(features, dtMs, {
        thickness: lfo.thickness,
        iridescenceIOR: lfo.iridescenceIOR,
      })

      w.__emotoSetMaterial?.({
        ior: props.ior,
        iridescence: props.iridescence,
        iridescenceIOR: props.iridescenceIOR,
        iridescenceThicknessRange: [props.iridescenceThicknessMin, props.iridescenceThicknessMax] as [number, number],
        thickness: props.thickness,
        dispersion: props.chromaticAberration * 10,
        roughness: BASE_ROUGHNESS + lfo.roughness,
      })
      w.__emotoSetCrystallinity?.(props.crystallinity)
      w.__emotoSetCaGrowthRate?.(props.caGrowthRate)
      w.__emotoSetDisplacement?.(props.displacement)
      w.__emotoSetScale?.(props.scale)
    }

    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
})

btnBegin.addEventListener('click', () => {
  mic.requestMic()
})

btnWatch.addEventListener('click', () => {
  mic.startWatchOnly()
})
