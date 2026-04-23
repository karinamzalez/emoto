import p5 from 'p5'
import { ShaderMaterial } from './gfx/ShaderMaterial'
import sanityVert from './gfx/shaders/sanity.vert'
import latticeFrag from './gfx/shaders/lattice.frag'

// Module-level refs so HMR handlers can swap shader sources without re-mounting
let _vert = sanityVert
let _frag = latticeFrag
let _material: ShaderMaterial | null = null
let _latticeScale = 0.15
const _latticeDepth = 0.8

export const stageSize = { w: 0, h: 0 }

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
  import.meta.hot.accept('./gfx/shaders/lattice.frag', (mod: any) => {
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
      _material.apply(s, {
        uTime: s.millis() / 1000,
        uResolution: [s.width, s.height],
        u_latticeScale: _latticeScale,
        u_latticeDepth: _latticeDepth,
      })
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
    }
  }, container)
}
