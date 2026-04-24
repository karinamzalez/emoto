import { createRoot } from 'react-dom/client'
import { App } from './App'
import { Mic } from './audio/Mic'
import { AudioFeaturesSource } from './audio/AudioFeaturesSource'
import { DebugOverlay } from './audio/DebugOverlay'

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
  let lastT = performance.now()
  function tick() {
    const now = performance.now()
    const features = source.read(now - lastT)
    lastT = now
    debugOverlay?.update(features)
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
