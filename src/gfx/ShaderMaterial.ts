import type p5 from 'p5'

export class ShaderMaterial {
  private _shader: p5.Shader | null = null

  constructor(
    private readonly vertSrc: string,
    private readonly fragSrc: string
  ) {}

  getShader(s: p5): p5.Shader {
    if (!this._shader) {
      this._shader = s.createShader(this.vertSrc, this.fragSrc)
    }
    return this._shader
  }

  invalidate(): void {
    this._shader = null
  }

  apply(s: p5, uniforms: Record<string, number | number[]> = {}): void {
    const sh = this.getShader(s)
    s.shader(sh)
    for (const [key, value] of Object.entries(uniforms)) {
      sh.setUniform(key, value)
    }
  }
}
