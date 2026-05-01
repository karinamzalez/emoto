import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useControls, button, monitor } from 'leva'
import * as THREE from 'three'
import reiterFrag from './reiterCA.frag?raw'

export const GRID_SIZE = 256
const STEPS_PER_SEC = 30

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const PASSTHROUGH_FRAG = /* glsl */ `
uniform sampler2D uTex;
varying vec2 vUv;
void main() { gl_FragColor = texture2D(uTex, vUv); }
`

const DISPLAY_FRAG = /* glsl */ `
uniform sampler2D uDensity;
varying vec2 vUv;
void main() {
  float d = clamp(texture2D(uDensity, vUv).r, 0.0, 1.0);
  gl_FragColor = vec4(d, d, d, 1.0);
}
`

// Mulberry32 seeded PRNG — deterministic, same seed → same sequence
function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface ReiterParams {
  alpha: number
  gamma: number
}

/**
 * Returns the 6 hex-neighbor flat indices for cell `idx` in an odd-r offset grid.
 * Row parity (row % 2) determines whether diagonal neighbors shift right (odd) or left (even).
 *
 * Neighbor order: [E, W, NE, NW, SE, SW]
 */
export function hexNeighborIndices(
  idx: number,
  gridSize: number,
): [number, number, number, number, number, number] {
  const col = idx % gridSize
  const row = Math.floor(idx / gridSize)
  const rp = row % 2
  const wrap = (c: number, r: number): number => {
    const rr = ((r % gridSize) + gridSize) % gridSize
    const cc = ((c % gridSize) + gridSize) % gridSize
    return rr * gridSize + cc
  }
  return [
    wrap(col + 1, row), // E
    wrap(col - 1, row), // W
    wrap(col + rp, row - 1), // NE
    wrap(col + rp - 1, row - 1), // NW
    wrap(col + rp, row + 1), // SE
    wrap(col + rp - 1, row + 1), // SW
  ]
}

/** Pure-TS Reiter CA step — headless port for unit tests. */
export function reiterStep(
  grid: Float32Array,
  params: ReiterParams,
  gridSize = GRID_SIZE,
): Float32Array {
  const next = new Float32Array(grid.length)
  const d = (v: number): number => (v < 1.0 ? v : 0.0)
  for (let i = 0; i < grid.length; i++) {
    const c = grid[i]
    const [i0, i1, i2, i3, i4, i5] = hexNeighborIndices(i, gridSize)
    const nE = grid[i0],
      nW = grid[i1],
      nNE = grid[i2],
      nNW = grid[i3],
      nSE = grid[i4],
      nSW = grid[i5]
    const maxN = Math.max(nE, nW, nNE, nNW, nSE, nSW)
    if (c >= 1.0 || maxN >= 1.0) {
      next[i] = c + params.gamma
    } else {
      const avgD = (d(nE) + d(nW) + d(nNE) + d(nNW) + d(nSE) + d(nSW)) / 6
      next[i] = c * (1 - params.alpha) + params.alpha * avgD
    }
  }
  return next
}

/** Creates an initial CA state: background vapor β + tiny per-seed noise, single frozen seed at center. */
export function initReiterGrid(seed: number, beta: number, gridSize = GRID_SIZE): Float32Array {
  const rand = mulberry32(seed)
  const grid = new Float32Array(gridSize * gridSize)
  for (let i = 0; i < grid.length; i++) {
    grid[i] = beta + (rand() * 0.002 - 0.001)
  }
  const cx = Math.floor(gridSize / 2)
  const cy = Math.floor(gridSize / 2)
  grid[cy * gridSize + cx] = 1.0
  return grid
}

function toRGBA(grid: Float32Array): Float32Array {
  const rgba = new Float32Array(grid.length * 4)
  for (let i = 0; i < grid.length; i++) {
    rgba[i * 4] = grid[i]
    rgba[i * 4 + 3] = 1.0
  }
  return rgba
}

function resetToGrid(
  gl: THREE.WebGLRenderer,
  fbo: THREE.WebGLRenderTarget,
  cam: THREE.OrthographicCamera,
  seed: number,
  beta: number,
): void {
  const data = toRGBA(initReiterGrid(seed, beta))
  const tex = new THREE.DataTexture(data, GRID_SIZE, GRID_SIZE, THREE.RGBAFormat, THREE.FloatType)
  tex.minFilter = THREE.NearestFilter
  tex.magFilter = THREE.NearestFilter
  tex.needsUpdate = true

  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: PASSTHROUGH_FRAG,
    uniforms: { uTex: { value: tex } },
  })
  const geo = new THREE.PlaneGeometry(2, 2)
  const scene = new THREE.Scene()
  scene.add(new THREE.Mesh(geo, mat))

  gl.setRenderTarget(fbo)
  gl.render(scene, cam)
  gl.setRenderTarget(null)

  mat.dispose()
  geo.dispose()
  tex.dispose()
}

export interface ReiterCAHandle {
  densityTexture: THREE.Texture | null
  reset(): void
}

interface ReiterCAProps {
  growthRate: number
  maxIterations: number
  seed: number
  debug?: boolean
}

export const ReiterCA = forwardRef<ReiterCAHandle, ReiterCAProps>(
  ({ growthRate, maxIterations, seed, debug = false }, ref) => {
    const { gl, scene: r3fScene, camera: r3fCamera } = useThree()

    const { alpha, beta, gamma, activeSeed } = useControls('ReiterCA', {
      alpha: { value: 0.502, min: 0.001, max: 0.999, step: 0.001, label: 'α activator' },
      beta: { value: 0.4, min: 0.0, max: 1.0, step: 0.01, label: 'β vapor density' },
      gamma: { value: 0.0001, min: 0, max: 0.005, step: 0.0001, label: 'γ addition rate' },
      activeSeed: { value: seed, min: 0, max: 99999, step: 1, label: 'RNG seed' },
    })

    const fboA = useRef<THREE.WebGLRenderTarget | null>(null)
    const fboB = useRef<THREE.WebGLRenderTarget | null>(null)
    // readIdx: which FBO holds the latest output (0=A, 1=B)
    const readIdx = useRef<0 | 1>(0)
    const stepMat = useRef<THREE.ShaderMaterial | null>(null)
    const stepScene = useRef<THREE.Scene | null>(null)
    const stepCam = useRef<THREE.OrthographicCamera | null>(null)
    const stepAccum = useRef(0)
    const iterCount = useRef(0)
    const initTexRef = useRef<THREE.DataTexture | null>(null)
    const pendingReset = useRef(false)
    const resetFn = useRef<() => void>(() => {})
    const displayMat = useRef<THREE.ShaderMaterial | null>(null)
    const displayScene = useRef<THREE.Scene | null>(null)

    useControls('ReiterCA', {
      reset: button(() => resetFn.current()),
      iterations: monitor(() => iterCount.current),
    })

    useEffect(() => {
      const opts: THREE.RenderTargetOptions = {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.FloatType,
        depthBuffer: false,
      }
      const a = new THREE.WebGLRenderTarget(GRID_SIZE, GRID_SIZE, opts)
      const b = new THREE.WebGLRenderTarget(GRID_SIZE, GRID_SIZE, opts)
      fboA.current = a
      fboB.current = b

      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: reiterFrag,
        uniforms: {
          uState: { value: null },
          uAlpha: { value: 0.502 },
          uGamma: { value: 0.0001 },
        },
      })
      stepMat.current = mat

      const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
      stepCam.current = cam

      const quadGeo = new THREE.PlaneGeometry(2, 2)
      const scene = new THREE.Scene()
      scene.add(new THREE.Mesh(quadGeo, mat))
      stepScene.current = scene

      const dMat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: DISPLAY_FRAG,
        uniforms: { uDensity: { value: null as THREE.Texture | null } },
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      })
      displayMat.current = dMat
      const dScene = new THREE.Scene()
      dScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), dMat))
      displayScene.current = dScene

      const initData = toRGBA(initReiterGrid(seed, 0.4))
      const initTex = new THREE.DataTexture(
        initData,
        GRID_SIZE,
        GRID_SIZE,
        THREE.RGBAFormat,
        THREE.FloatType,
      )
      initTex.minFilter = THREE.NearestFilter
      initTex.magFilter = THREE.NearestFilter
      initTex.needsUpdate = true
      initTexRef.current = initTex

      stepAccum.current = 0
      iterCount.current = 0

      const w = window as Window & {
        __emotoReiterIter?: number
        __emotoReiterDensityAt?: (col: number, row: number) => number
      }
      w.__emotoReiterIter = 0
      w.__emotoReiterDensityAt = (col, row) => {
        const fbo = readIdx.current === 0 ? fboA.current : fboB.current
        if (!fbo) return 0
        const buf = new Float32Array(4)
        try {
          gl.readRenderTargetPixels(fbo, col, row, 1, 1, buf)
        } catch {
          return 0
        }
        return buf[0]
      }

      return () => {
        a.dispose()
        b.dispose()
        mat.dispose()
        quadGeo.dispose()
        dMat.dispose()
        initTexRef.current?.dispose()
        initTexRef.current = null
        const ww = window as Window & {
          __emotoReiterIter?: number
          __emotoReiterDensityAt?: (col: number, row: number) => number
        }
        delete ww.__emotoReiterIter
        delete ww.__emotoReiterDensityAt
      }
    }, [])

    // Rebuild reset closure each render so it closes over latest Leva values
    resetFn.current = () => {
      pendingReset.current = true
    }

    useImperativeHandle(ref, () => ({
      get densityTexture() {
        const fbo = readIdx.current === 0 ? fboA.current : fboB.current
        return fbo?.texture ?? null
      },
      reset() {
        pendingReset.current = true
      },
    }))

    useFrame(
      (_, delta) => {
        if (!fboA.current || !fboB.current || !stepMat.current || !stepScene.current || !stepCam.current)
          return

        // First frame: upload seed state to fboA via passthrough
        if (initTexRef.current) {
          resetToGrid(gl, fboA.current, stepCam.current, seed, 0.4)
          stepMat.current.uniforms.uState.value = fboA.current.texture
          readIdx.current = 0
          initTexRef.current.dispose()
          initTexRef.current = null
        }

        // Deferred reset (queued by button or reset())
        if (pendingReset.current) {
          pendingReset.current = false
          resetToGrid(gl, fboA.current, stepCam.current, activeSeed, beta)
          stepMat.current.uniforms.uState.value = fboA.current.texture
          readIdx.current = 0
          stepAccum.current = 0
          iterCount.current = 0
        }

        // Accumulate and run CA steps
        if (iterCount.current < maxIterations) {
          stepAccum.current += growthRate * delta * STEPS_PER_SEC
          while (stepAccum.current >= 1 && iterCount.current < maxIterations) {
            stepAccum.current -= 1
            const inputFBO = readIdx.current === 0 ? fboA.current : fboB.current
            const outputFBO = readIdx.current === 0 ? fboB.current : fboA.current
            stepMat.current.uniforms.uState.value = inputFBO.texture
            stepMat.current.uniforms.uAlpha.value = alpha
            stepMat.current.uniforms.uGamma.value = gamma
            gl.setRenderTarget(outputFBO)
            gl.render(stepScene.current, stepCam.current)
            gl.setRenderTarget(null)
            readIdx.current = readIdx.current === 0 ? 1 : 0
            iterCount.current++
          }
          ;(window as Window & { __emotoReiterIter?: number }).__emotoReiterIter = iterCount.current
        }

        // When debug=true this useFrame has priority 1, so we must render the main scene
        // ourselves, then blit the CA density texture as a debug overlay.
        if (debug) {
          gl.setRenderTarget(null)
          gl.render(r3fScene, r3fCamera)

          const curFBO = readIdx.current === 0 ? fboA.current : fboB.current
          if (curFBO && displayMat.current && displayScene.current) {
            displayMat.current.uniforms.uDensity.value = curFBO.texture

            const { width, height } = gl.domElement
            const side = Math.round(Math.min(width, height) * 0.2)
            gl.resetState()
            gl.setViewport(0, height - side, side, side)
            gl.setScissor(0, height - side, side, side)
            gl.setScissorTest(true)
            gl.render(displayScene.current, stepCam.current)
            gl.setScissorTest(false)
            gl.setViewport(0, 0, width, height)
          }
        }
      },
      debug ? 1 : 0,
    )

    return null
  },
)

ReiterCA.displayName = 'ReiterCA'
