import p5 from 'p5'
import { ShaderMaterial } from './gfx/ShaderMaterial'
import { type CrystalUniforms } from './gfx/CrystalUniforms'
import sanityVert from './gfx/shaders/sanity.vert'
import crystalFrag from './gfx/shaders/crystal.frag'

// Module-level refs so HMR handlers can swap shader sources without re-mounting
let _vert = sanityVert
let _frag = crystalFrag
let _material: ShaderMaterial | null = null
let _latticeScale = 0.15
const _latticeDepth = 0.8
let _growth = 0.5
const _fresnelPower = 3.0
let _irisThickness = 0.3
const _irisIntensity = 0.6
let _dispersionStrength = 0.5

export const stageSize = { w: 0, h: 0 }

// Test hook: allows Playwright to set growth without full app reload.
;(window as Window & { __emotoSetGrowth?: (v: number) => void }).__emotoSetGrowth = (v: number) => {
  _growth = Math.min(Math.max(v, 0), 1)
  _material = null
}

// Test hook: allows Playwright to set iris thickness without full app reload.
;(window as Window & { __emotoSetIrisThickness?: (v: number) => void }).__emotoSetIrisThickness = (
  v: number
) => {
  _irisThickness = Math.min(Math.max(v, 0), 1)
}

// Test hook: allows Playwright to set dispersion strength without full app reload.
;(window as Window & { __emotoSetDispersion?: (v: number) => void }).__emotoSetDispersion = (
  v: number
) => {
  _dispersionStrength = Math.min(Math.max(v, 0), 1)
}

// Test hook: freeze uTime at a fixed value so snapshot comparisons are animation-stable.
let _frozenTime: number | null = null
;(window as Window & { __emotoFreezeTime?: (t: number | null) => void }).__emotoFreezeTime = (
  t: number | null
) => {
  _frozenTime = t
}

export function clampPixelDensity(ratio: number): number {
  return Math.min(ratio, 2)
}

function debounce(fn: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setTimeout>
  return () => {
    clearTimeout(timer)
    timer = setTimeout(fn, ms)
  }
}

function requestFullscreen(el: HTMLElement): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = el as any
  ;(e.requestFullscreen ?? e.webkitRequestFullscreen ?? e.mozRequestFullScreen)?.call(e)
}

function exitFullscreen(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = document as any
  ;(d.exitFullscreen ?? d.webkitExitFullscreen ?? d.mozCancelFullScreen)?.call(d)
}

function toggleFullscreen(el: HTMLElement): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = document as any
  const isFullscreen = !!(document.fullscreenElement ?? d.webkitFullscreenElement)
  if (isFullscreen) {
    exitFullscreen()
  } else {
    requestFullscreen(el)
  }
}

if (import.meta.hot) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  import.meta.hot.accept('./gfx/shaders/sanity.vert', (mod: any) => {
    _vert = mod?.default as string
    _material = null
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  import.meta.hot.accept('./gfx/shaders/crystal.frag', (mod: any) => {
    _frag = mod?.default as string
    _material = null
  })
}

export function createSketch(container?: HTMLElement): p5 {
  return new p5((s: p5) => {
    let canvasEl: HTMLElement | null = null

    s.setup = () => {
      // Enable preserveDrawingBuffer so the canvas is readable via
      // drawImage / toDataURL — needed for Playwright pixel symmetry
      // verification. Negligible perf cost for a single full-screen canvas.
      s.setAttributes('preserveDrawingBuffer', true)
      s.setAttributes('alpha', true)
      const canvas = s.createCanvas(s.windowWidth, s.windowHeight, s.WEBGL)
      canvas.style('display', 'block')
      canvasEl = canvas.elt as HTMLElement
      s.pixelDensity(clampPixelDensity(window.devicePixelRatio ?? 1))
      stageSize.w = s.windowWidth
      stageSize.h = s.windowHeight
      s.noStroke()
    }

    s.draw = () => {
      if (!_material) {
        _material = new ShaderMaterial(_vert, _frag)
      }
      // Disable blending so gl_FragColor.a is written directly to the framebuffer.
      // The canvas element composites with the page background using those alpha
      // values, producing the glass-clear center; readPixels also sees the real alpha.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gl = (s as any)._renderer.GL as WebGLRenderingContext
      gl.disable(gl.BLEND)
      const uniforms: CrystalUniforms = {
        uTime: _frozenTime !== null ? _frozenTime : s.millis() / 1000,
        uResolution: [s.width, s.height],
        u_latticeScale: _latticeScale,
        u_latticeDepth: _latticeDepth,
        u_growth: _growth,
        u_fresnelPower: _fresnelPower,
        u_irisThickness: _irisThickness,
        u_irisIntensity: _irisIntensity,
        u_dispersionStrength: _dispersionStrength,
      }
      _material.apply(s, uniforms as unknown as Record<string, number | number[] | boolean>)
      s.plane(s.width, s.height)
    }

    const handleResize = debounce(() => {
      s.resizeCanvas(s.windowWidth, s.windowHeight)
      stageSize.w = s.windowWidth
      stageSize.h = s.windowHeight
    }, 100)

    s.windowResized = handleResize

    s.keyPressed = () => {
      if ((s.key === 'f' || s.key === 'F') && canvasEl) {
        toggleFullscreen(canvasEl)
      }
      // Adjust lattice scale for live QA
      if (s.key === ']') _latticeScale = Math.min(_latticeScale * 1.25, 1.0)
      if (s.key === '[') _latticeScale = Math.max(_latticeScale * 0.8, 0.02)
      // Adjust iris thickness: i/o keys sweep through thin-film spectrum
      if (s.key === 'o') _irisThickness = Math.min(_irisThickness + 0.05, 1.0)
      if (s.key === 'i') _irisThickness = Math.max(_irisThickness - 0.05, 0.0)
      // Adjust chromatic dispersion strength: < / > keys
      if (s.key === '.') _dispersionStrength = Math.min(_dispersionStrength + 0.05, 1.0)
      if (s.key === ',') _dispersionStrength = Math.max(_dispersionStrength - 0.05, 0.0)
    }
  }, container)
}
