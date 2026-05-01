import { useEffect } from 'react'
import { useControls } from 'leva'
import { lfoBus } from './lfoBus'
import type { Waveform, OscillatorTarget } from './Oscillators'

const WAVEFORMS = { sine: 'sine', triangle: 'triangle', perlin: 'perlin' }

function useLfoOscillatorControls(label: string, defaults: { period: number; amplitude: number; waveform: Waveform; ampMax: number }) {
  return useControls(`LFO / ${label}`, {
    enabled: { value: true },
    waveform: { value: defaults.waveform, options: WAVEFORMS },
    period: { value: defaults.period, min: 1, max: 60, step: 0.5, label: 'period (s)' },
    amplitude: { value: defaults.amplitude, min: 0, max: defaults.ampMax, step: defaults.amplitude * 0.1 },
    phase: { value: 0, min: 0, max: 1, step: 0.01 },
  })
}

export function LfoPanel() {
  const rotY = useLfoOscillatorControls('rotation.y', { period: 22, amplitude: Math.PI / 6, waveform: 'sine', ampMax: Math.PI })
  const rotX = useLfoOscillatorControls('rotation.x', { period: 17, amplitude: 5 * Math.PI / 180, waveform: 'sine', ampMax: Math.PI / 4 })
  const rough = useLfoOscillatorControls('roughness', { period: 8, amplitude: 0.05, waveform: 'perlin', ampMax: 0.5 })
  const thick = useLfoOscillatorControls('thickness', { period: 12, amplitude: 0.10, waveform: 'perlin', ampMax: 2 })
  const iridIOR = useLfoOscillatorControls('iridescenceIOR', { period: 9, amplitude: 0.02, waveform: 'sine', ampMax: 0.2 })

  useEffect(() => {
    // Preserve per-target seeds so Perlin drift stays consistent across Leva edits
    const seedByTarget = new Map(lfoBus.oscillators.map(o => [o.target, o.seed]))
    const seed = (t: OscillatorTarget) => seedByTarget.get(t) ?? Math.random()

    lfoBus.update([
      { target: 'rotation.y',            waveform: rotY.waveform as Waveform,   period: rotY.period,    amplitude: rotY.amplitude,    phase: rotY.phase,    enabled: rotY.enabled,    seed: seed('rotation.y') },
      { target: 'rotation.x',            waveform: rotX.waveform as Waveform,   period: rotX.period,    amplitude: rotX.amplitude,    phase: rotX.phase,    enabled: rotX.enabled,    seed: seed('rotation.x') },
      { target: 'material.roughness',    waveform: rough.waveform as Waveform,  period: rough.period,   amplitude: rough.amplitude,   phase: rough.phase,   enabled: rough.enabled,   seed: seed('material.roughness') },
      { target: 'material.thickness',    waveform: thick.waveform as Waveform,  period: thick.period,   amplitude: thick.amplitude,   phase: thick.phase,   enabled: thick.enabled,   seed: seed('material.thickness') },
      { target: 'material.iridescenceIOR', waveform: iridIOR.waveform as Waveform, period: iridIOR.period, amplitude: iridIOR.amplitude, phase: iridIOR.phase, enabled: iridIOR.enabled, seed: seed('material.iridescenceIOR') },
    ])
  }, [
    rotY.enabled, rotY.waveform, rotY.period, rotY.amplitude, rotY.phase,
    rotX.enabled, rotX.waveform, rotX.period, rotX.amplitude, rotX.phase,
    rough.enabled, rough.waveform, rough.period, rough.amplitude, rough.phase,
    thick.enabled, thick.waveform, thick.period, thick.amplitude, thick.phase,
    iridIOR.enabled, iridIOR.waveform, iridIOR.period, iridIOR.amplitude, iridIOR.phase,
  ])

  return null
}
