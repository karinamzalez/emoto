import p5 from 'p5'

export function createSketch(container?: HTMLElement): p5 {
  return new p5((s: p5) => {
    s.setup = () => {
      const canvas = s.createCanvas(s.windowWidth, s.windowHeight, s.WEBGL)
      canvas.style('display', 'block')
      s.background(10, 10, 20)
    }

    s.draw = () => {
      s.background(10, 10, 20)
    }

    s.windowResized = () => {
      s.resizeCanvas(s.windowWidth, s.windowHeight)
    }
  }, container)
}
