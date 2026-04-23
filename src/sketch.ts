import p5 from 'p5'
import { ShaderMaterial } from './gfx/ShaderMaterial'
import sanityVert from './gfx/shaders/sanity.vert'
import sanityFrag from './gfx/shaders/sanity.frag'

// Module-level refs so HMR handlers can swap shader sources without re-mounting
let _vert = sanityVert
let _frag = sanityFrag
let _material: ShaderMaterial | null = null

if (import.meta.hot) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  import.meta.hot.accept('./gfx/shaders/sanity.vert', (mod: any) => {
    _vert = mod?.default as string
    _material = null
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  import.meta.hot.accept('./gfx/shaders/sanity.frag', (mod: any) => {
    _frag = mod?.default as string
    _material = null
  })
}

export function createSketch(container?: HTMLElement): p5 {
  return new p5((s: p5) => {
    s.setup = () => {
      const canvas = s.createCanvas(s.windowWidth, s.windowHeight, s.WEBGL)
      canvas.style('display', 'block')
      s.noStroke()
    }

    s.draw = () => {
      if (!_material) {
        _material = new ShaderMaterial(_vert, _frag)
      }
      _material.apply(s, {
        uTime: s.millis() / 1000,
        uResolution: [s.width, s.height],
      })
      s.plane(s.width, s.height)
    }

    s.windowResized = () => {
      s.resizeCanvas(s.windowWidth, s.windowHeight)
    }
  }, container)
}
