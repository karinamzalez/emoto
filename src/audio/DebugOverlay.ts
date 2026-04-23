import type { AudioFeatures } from './AudioFeaturesSource'

const HISTORY_LEN = 300 // ~5 seconds at 60fps
const SPARK_W = 80
const SPARK_H = 20

const METRIC_KEYS = ['rms', 'pitchHz', 'centroidHz', 'harmonicity'] as const
type MetricKey = (typeof METRIC_KEYS)[number]

const MAX_VALUES: Record<MetricKey, number> = {
  rms: 1,
  pitchHz: 800,
  centroidHz: 8000,
  harmonicity: 1,
}

export class DebugOverlay {
  private el: HTMLDivElement
  private valueEls: Partial<Record<MetricKey, HTMLSpanElement>> = {}
  private canvases: Partial<Record<MetricKey, HTMLCanvasElement>> = {}
  private histories: Record<MetricKey, number[]> = {
    rms: [],
    pitchHz: [],
    centroidHz: [],
    harmonicity: [],
  }
  private visible = false

  constructor() {
    this.el = this.buildEl()
    document.body.appendChild(this.el)
    window.addEventListener('keydown', this.onKey)
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'd' || e.key === 'D') this.toggle()
  }

  private toggle() {
    this.visible = !this.visible
    this.el.style.display = this.visible ? 'block' : 'none'
  }

  update(features: AudioFeatures) {
    const numericValues: Record<MetricKey, number> = {
      rms: features.rms,
      pitchHz: features.pitchHz ?? 0,
      centroidHz: features.centroidHz,
      harmonicity: features.harmonicity,
    }

    for (const key of METRIC_KEYS) {
      const v = numericValues[key]

      const valEl = this.valueEls[key]
      if (valEl) {
        if (key === 'pitchHz') {
          valEl.textContent = features.pitchHz === null ? '—' : `${features.pitchHz.toFixed(0)} Hz`
        } else if (key === 'centroidHz') {
          valEl.textContent = `${v.toFixed(0)} Hz`
        } else {
          valEl.textContent = v.toFixed(3)
        }
      }

      const hist = this.histories[key]
      hist.push(v)
      if (hist.length > HISTORY_LEN) hist.shift()

      const canvas = this.canvases[key]
      if (canvas) this.drawSparkline(canvas, hist, MAX_VALUES[key])
    }
  }

  destroy() {
    window.removeEventListener('keydown', this.onKey)
    this.el.remove()
  }

  private drawSparkline(canvas: HTMLCanvasElement, data: number[], max: number) {
    const ctx = canvas.getContext('2d')
    if (!ctx || data.length < 2) return
    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)
    ctx.strokeStyle = '#0f0'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i = 0; i < data.length; i++) {
      const x = (i / (HISTORY_LEN - 1)) * width
      const y = height - Math.min(data[i] / max, 1) * height
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  private buildEl(): HTMLDivElement {
    const el = document.createElement('div')
    el.id = 'debug-overlay'
    Object.assign(el.style, {
      display: 'none',
      position: 'fixed',
      top: '12px',
      right: '12px',
      background: 'rgba(0,0,0,0.75)',
      color: '#0f0',
      font: '11px/1.5 monospace',
      padding: '8px 10px',
      borderRadius: '4px',
      zIndex: '1000',
      pointerEvents: 'none',
    })

    for (const key of METRIC_KEYS) {
      const row = document.createElement('div')
      row.setAttribute('data-metric', key)

      const label = document.createElement('span')
      label.textContent = `${key}: `

      const val = document.createElement('span')
      val.textContent = '—'
      this.valueEls[key] = val

      const canvas = document.createElement('canvas')
      canvas.width = SPARK_W
      canvas.height = SPARK_H
      canvas.style.display = 'block'
      canvas.style.marginTop = '2px'
      this.canvases[key] = canvas

      row.append(label, val, canvas)
      el.appendChild(row)
    }

    return el
  }
}
