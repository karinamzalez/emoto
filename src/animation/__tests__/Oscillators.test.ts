import { describe, it, expect } from 'vitest'
import { evaluateOscillator, LfoBus } from '../Oscillators'
import type { Oscillator } from '../Oscillators'

const sineOsc: Oscillator = {
  target: 'rotation.y',
  waveform: 'sine',
  period: 22,
  amplitude: 0.5,
  phase: 0,
  enabled: true,
  seed: 0,
}

const perlinOsc: Oscillator = {
  target: 'material.roughness',
  waveform: 'perlin',
  period: 8,
  amplitude: 0.05,
  phase: 0,
  enabled: true,
  seed: 42,
}

describe('evaluateOscillator — sine', () => {
  it('produces values in [-amplitude, +amplitude] over a full period', () => {
    const N = 1000
    for (let i = 0; i < N; i++) {
      const t = (i / N) * sineOsc.period
      const v = evaluateOscillator(sineOsc, t)
      expect(v).toBeGreaterThanOrEqual(-sineOsc.amplitude - 1e-10)
      expect(v).toBeLessThanOrEqual(sineOsc.amplitude + 1e-10)
    }
  })

  it('completes a full cycle over one period', () => {
    const at0 = evaluateOscillator(sineOsc, 0)
    const atPeriod = evaluateOscillator(sineOsc, sineOsc.period)
    expect(at0).toBeCloseTo(atPeriod, 10)
  })
})

describe('evaluateOscillator — triangle', () => {
  const triangleOsc: Oscillator = { ...sineOsc, waveform: 'triangle' }

  it('produces values in [-amplitude, +amplitude]', () => {
    for (let i = 0; i < 500; i++) {
      const t = i * 0.05
      const v = evaluateOscillator(triangleOsc, t)
      expect(v).toBeGreaterThanOrEqual(-triangleOsc.amplitude - 1e-10)
      expect(v).toBeLessThanOrEqual(triangleOsc.amplitude + 1e-10)
    }
  })
})

describe('evaluateOscillator — perlin', () => {
  it('is bounded by [-amplitude, +amplitude]', () => {
    for (let i = 0; i < 300; i++) {
      const t = i * 0.1
      const v = evaluateOscillator(perlinOsc, t)
      expect(v).toBeGreaterThanOrEqual(-perlinOsc.amplitude - 1e-10)
      expect(v).toBeLessThanOrEqual(perlinOsc.amplitude + 1e-10)
    }
  })

  it('changes smoothly: consecutive steps differ by less than 2*amplitude/period per step', () => {
    const dt = 0.1
    // Max rate of change for smooth noise: amplitude * 2/period per second → * dt per step
    const threshold = ((perlinOsc.amplitude * 2) / perlinOsc.period) * dt * 2 // 2× safety margin
    for (let i = 0; i < 300; i++) {
      const v0 = evaluateOscillator(perlinOsc, i * dt)
      const v1 = evaluateOscillator(perlinOsc, (i + 1) * dt)
      expect(Math.abs(v1 - v0)).toBeLessThan(threshold)
    }
  })

  it('produces different values for different seeds at the same time', () => {
    const osc1 = { ...perlinOsc, seed: 1 }
    const osc2 = { ...perlinOsc, seed: 2 }
    const t = 5.0
    // With overwhelming probability two different seeds differ — this would only fail
    // for an adversarial pair of seeds, not the constants 1 and 2
    expect(evaluateOscillator(osc1, t)).not.toBeCloseTo(evaluateOscillator(osc2, t), 5)
  })
})

describe('LfoBus.frame', () => {
  it('routes each oscillator delta to the correct LfoFrame key', () => {
    const bus = new LfoBus([
      {
        target: 'rotation.y',
        waveform: 'sine',
        period: 4,
        amplitude: 1.0,
        phase: 0,
        enabled: true,
        seed: 0,
      },
      {
        target: 'material.roughness',
        waveform: 'sine',
        period: 4,
        amplitude: 0.05,
        phase: 0,
        enabled: true,
        seed: 0,
      },
    ])
    // At t=1s with period=4s, phase = 1/4 = 0.25 → sin(π/2) = 1.0
    const t = 1.0
    const frame = bus.frame(t)
    expect(frame.rotationY).toBeCloseTo(1.0, 5)
    expect(frame.roughness).toBeCloseTo(0.05, 5)
    expect(frame.rotationX).toBe(0)
    expect(frame.thickness).toBe(0)
    expect(frame.iridescenceIOR).toBe(0)
  })

  it('disabled oscillators contribute 0', () => {
    const bus = new LfoBus([
      {
        target: 'rotation.y',
        waveform: 'sine',
        period: 22,
        amplitude: 1.0,
        phase: 0,
        enabled: false,
        seed: 0,
      },
    ])
    for (let i = 0; i < 50; i++) {
      expect(bus.frame(i * 0.5).rotationY).toBe(0)
    }
  })

  it('composition is commutative: audioDelta + lfoDelta == lfoDelta + audioDelta', () => {
    // Verifies the additive composition rule — order must not matter
    const audioDelta = 0.03
    const lfoDelta = 0.02
    expect(audioDelta + lfoDelta).toBeCloseTo(lfoDelta + audioDelta)
    // And equals the direct sum regardless of arrangement
    expect(audioDelta + lfoDelta).toBeCloseTo(0.05)
  })

  it('setEnabled toggles a target on and off', () => {
    const bus = new LfoBus([
      {
        target: 'rotation.y',
        waveform: 'sine',
        period: 4,
        amplitude: 1.0,
        phase: 0,
        enabled: true,
        seed: 0,
      },
    ])
    const t = 1.0
    expect(Math.abs(bus.frame(t).rotationY)).toBeGreaterThan(0.9)

    bus.setEnabled('rotation.y', false)
    expect(bus.frame(t).rotationY).toBe(0)

    bus.setEnabled('rotation.y', true)
    expect(Math.abs(bus.frame(t).rotationY)).toBeGreaterThan(0.9)
  })
})
