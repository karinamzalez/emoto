import { test, expect } from '@playwright/test'

test('debug stripe pixels no pmrem', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto('/?droplet-off&bg=/fixtures/test-stripes.png&debug=1')
  await page.waitForFunction(() => {
    const el = document.querySelector('#r3f-canvas canvas') as HTMLCanvasElement | null
    return !!el && el.width > 0 && el.height > 0
  })
  await page.waitForTimeout(400)
  await page.waitForFunction(
    (n: number) => ((window as { __emotoReiterIter?: number }).__emotoReiterIter ?? 0) >= n,
    50,
    { timeout: 20000 }
  )
  await page.evaluate(() => {
    ;(window as { __emotoCrystalFreeze?: (n: number | null) => void }).__emotoCrystalFreeze?.(0)
  })
  await page.waitForTimeout(500)

  const data = await page.evaluate(() => {
    const src = document.querySelector('#r3f-canvas canvas') as HTMLCanvasElement
    const gl =
      (src.getContext('webgl2') as WebGL2RenderingContext | null) ??
      (src.getContext('webgl') as WebGLRenderingContext | null)
    if (!gl) return 'no gl'
    const cx = Math.floor(src.width / 2)
    const cy = Math.floor(src.height / 2)

    const results: Record<string, string> = {}
    for (const dx of [-200, -150, -100, -80, -60, -40, -20, 0, 20, 40, 60, 80, 100, 150, 200]) {
      const px = new Uint8Array(4)
      gl.readPixels(cx + dx, cy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
      results[`dx=${dx}`] = `${px[0]},${px[1]},${px[2]}`
    }
    const row: string[] = []
    for (let x = 0; x < src.width; x += 5) {
      const px = new Uint8Array(4)
      gl.readPixels(x, cy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
      row.push(`${px[0]}`)
    }
    results['row_rvals'] = row.join(',')
    const col: string[] = []
    for (let y = 0; y < src.height; y += 5) {
      const px = new Uint8Array(4)
      gl.readPixels(cx, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
      col.push(`${px[0]}`)
    }
    results['col_rvals'] = col.join(',')
    return results
  })

  console.log('DATA:', JSON.stringify(data))
  expect(data).toBeTruthy()
})
