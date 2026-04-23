import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'
import { CRYSTAL_UNIFORM_NAMES } from './CrystalUniforms'

// Parse every `uniform ... <name>;` declaration from crystal.frag and its
// included GLSL files, then verify CRYSTAL_UNIFORM_NAMES covers them all.
describe('CrystalUniforms interface contract', () => {
  const shaderDir = resolve(__dirname, 'shaders')

  function readShader(name: string): string {
    return readFileSync(resolve(shaderDir, name), 'utf8')
  }

  function collectUniforms(src: string): string[] {
    // Match: uniform <type> <name> ;  (ignoring arrays/precision qualifiers)
    const re = /uniform\s+\S+\s+(\w+)\s*;/g
    const names: string[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(src)) !== null) names.push(m[1])
    return names
  }

  it('every uniform in crystal.frag is listed in CRYSTAL_UNIFORM_NAMES', () => {
    // Inline-expand the includes we care about (only crystal.frag declares
    // application-level uniforms; the GLSL helpers have none).
    const glsl = readShader('crystal.frag')
    const declared = collectUniforms(glsl)

    for (const name of declared) {
      expect(
        (CRYSTAL_UNIFORM_NAMES as readonly string[]).includes(name),
        `uniform "${name}" in crystal.frag is missing from CRYSTAL_UNIFORM_NAMES`
      ).toBe(true)
    }
  })

  it('every name in CRYSTAL_UNIFORM_NAMES appears in crystal.frag', () => {
    const glsl = readShader('crystal.frag')
    for (const name of CRYSTAL_UNIFORM_NAMES) {
      expect(glsl, `CRYSTAL_UNIFORM_NAMES entry "${name}" not found in crystal.frag`).toContain(
        name
      )
    }
  })
})
