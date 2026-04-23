import { createSketch } from './sketch'
import { Mic } from './audio/Mic'

const overlay = document.getElementById('mic-overlay') as HTMLDivElement
const btnBegin = document.getElementById('btn-begin') as HTMLButtonElement
const btnWatch = document.getElementById('btn-watch') as HTMLButtonElement
const statusEl = document.getElementById('mic-status') as HTMLParagraphElement

// Hide Watch-only option when user prefers reduced motion is NOT set
// (show it as an explicit accessibility escape hatch when it IS set)
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
if (!prefersReduced) {
  btnWatch.style.display = 'none'
}

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

btnBegin.addEventListener('click', () => {
  mic.requestMic()
})

btnWatch.addEventListener('click', () => {
  mic.startWatchOnly()
})

createSketch(document.body)
