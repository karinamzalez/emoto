import { createRoot } from 'react-dom/client'
import { App } from './App'
import { Mic } from './audio/Mic'
import { AudioFeaturesSource } from './audio/AudioFeaturesSource'
import { DebugOverlay } from './audio/DebugOverlay'
import { AudioMaterialPipeline } from './mapping/pipeline'

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

  const w = window as Window & {
    __emotoSetMaterial?: (props: object) => void
    __emotoSetCrystallinity?: (value: number | null) => void
    __emotoSetDisplacement?: (value: number) => void
  }

  function tick() {
    const now = performance.now()
    const dtMs = now - lastT
    lastT = now

    const features = source.read(dtMs)
    debugOverlay?.update(features)

    if (!isDebugMode) {
      const props = pipeline.tick(features, dtMs)
      w.__emotoSetMaterial?.({
        ior: props.ior,
        iridescence: props.iridescence,
        iridescenceIOR: props.iridescenceIOR,
        iridescenceThicknessRange: [props.iridescenceThicknessMin, props.iridescenceThicknessMax] as [number, number],
        thickness: props.thickness,
        dispersion: props.chromaticAberration * 10,
      })
      w.__emotoSetCrystallinity?.(props.crystallinity)
      w.__emotoSetDisplacement?.(props.displacement)
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
