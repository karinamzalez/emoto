// DRE-112: LFO bus — auto-oscillating parameter module.
// Composition rule: finalValue = baseDefault + audioDelta + lfoDelta
// Audio remains the protagonist; LFOs add ambient breathing.

export type Waveform = 'sine' | 'triangle' | 'perlin'

export type OscillatorTarget =
  | 'rotation.y'
  | 'rotation.x'
  | 'material.roughness'
  | 'material.thickness'
  | 'material.iridescenceIOR'

export interface Oscillator {
  target: OscillatorTarget
  waveform: Waveform
  period: number // seconds — coprime across oscillators to prevent visible looping
  amplitude: number
  phase: number // [0, 1] fraction of period — initial phase offset
  enabled: boolean
  seed: number // random per oscillator; drives Perlin variation between reloads
}

export interface LfoFrame {
  rotationX: number
  rotationY: number
  roughness: number
  thickness: number
  iridescenceIOR: number
}

// 1D smooth value noise in [-1, 1]. Smoothstep interpolation between hashed lattice values.
// Uses sin-based hash so no lookup table is needed; seed offsets each oscillator's noise field.
function hashLattice(n: number, seed: number): number {
  const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453
  return (s - Math.floor(s)) * 2 - 1 // [-1, 1)
}

function perlin1d(x: number, seed: number): number {
  const xi = Math.floor(x)
  const xf = x - xi
  const u = xf * xf * (3 - 2 * xf) // smoothstep
  return hashLattice(xi, seed) + u * (hashLattice(xi + 1, seed) - hashLattice(xi, seed))
}

export function evaluateOscillator(osc: Oscillator, t: number): number {
  const phase = (t / osc.period + osc.phase) % 1 // [0, 1)

  let normalizedValue: number
  switch (osc.waveform) {
    case 'sine':
      normalizedValue = Math.sin(phase * 2 * Math.PI)
      break
    case 'triangle':
      normalizedValue = 1 - 4 * Math.abs(phase - 0.5)
      break
    case 'perlin':
      // x = t/period so characteristic correlation length ≈ one period
      normalizedValue = perlin1d(t / osc.period, osc.seed)
      break
  }

  return normalizedValue * osc.amplitude
}

export class LfoBus {
  private _oscillators: Oscillator[]

  constructor(oscillators: Oscillator[]) {
    this._oscillators = oscillators
  }

  get oscillators(): ReadonlyArray<Oscillator> {
    return this._oscillators
  }

  update(oscillators: Oscillator[]): void {
    this._oscillators = oscillators
  }

  setEnabled(target: OscillatorTarget, enabled: boolean): void {
    const osc = this._oscillators.find((o) => o.target === target)
    if (osc) osc.enabled = enabled
  }

  frame(t: number): LfoFrame {
    const out: LfoFrame = {
      rotationX: 0,
      rotationY: 0,
      roughness: 0,
      thickness: 0,
      iridescenceIOR: 0,
    }
    for (const osc of this._oscillators) {
      if (!osc.enabled) continue
      const delta = evaluateOscillator(osc, t)
      switch (osc.target) {
        case 'rotation.x':
          out.rotationX += delta
          break
        case 'rotation.y':
          out.rotationY += delta
          break
        case 'material.roughness':
          out.roughness += delta
          break
        case 'material.thickness':
          out.thickness += delta
          break
        case 'material.iridescenceIOR':
          out.iridescenceIOR += delta
          break
      }
    }
    return out
  }
}
