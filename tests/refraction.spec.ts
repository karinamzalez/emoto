import { test, expect } from '@playwright/test'

async function waitForCanvas(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('#r3f-canvas canvas') as HTMLCanvasElement | null
    return !!el && el.width > 0 && el.height > 0
  })
  await page.waitForTimeout(600)
}

async function readCenterPixels(
  page: import('@playwright/test').Page,
  radius = 60,
): Promise<number[][]> {
  return page.evaluate((r) => {
    const src = document.querySelector('#r3f-canvas canvas') as HTMLCanvasElement
    const gl =
      (src.getContext('webgl2') as WebGL2RenderingContext | null) ??
      (src.getContext('webgl') as WebGLRenderingContext | null)
    if (!gl) return []
    const cx = Math.floor(src.width / 2)
    const cy = Math.floor(src.height / 2)
    const results: number[][] = []
    for (let dx = -r; dx <= r; dx += 20) {
      const px = new Uint8Array(4)
      gl.readPixels(cx + dx, cy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
      results.push([px[0], px[1], px[2]])
    }
    return results
  }, radius)
}

test('stripe deformation is visible — refracted pixels vary across droplet', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto('/?bg=/fixtures/test-stripes.png')
  await waitForCanvas(page)

  // Poll until center pixel is non-zero (transmission render is ready)
  await page.waitForFunction(
    () => {
      const src = document.querySelector('#r3f-canvas canvas') as HTMLCanvasElement | null
      if (!src) return false
      const gl =
        (src.getContext('webgl2') as WebGL2RenderingContext | null) ??
        (src.getContext('webgl') as WebGLRenderingContext | null)
      if (!gl) return false
      const px = new Uint8Array(4)
      gl.readPixels(Math.floor(src.width / 2), Math.floor(src.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
      return px[0] + px[1] + px[2] > 0
    },
    undefined,
    { timeout: 8000 },
  )

  // Poll until stripe variance is visible (dispersion shader path is heavier under load)
  await page.waitForFunction(
    () => {
      const src = document.querySelector('#r3f-canvas canvas') as HTMLCanvasElement | null
      if (!src) return false
      const gl =
        (src.getContext('webgl2') as WebGL2RenderingContext | null) ??
        (src.getContext('webgl') as WebGLRenderingContext | null)
      if (!gl) return false
      const cx = Math.floor(src.width / 2)
      const cy = Math.floor(src.height / 2)
      const sums: number[] = []
      for (let dx = -80; dx <= 80; dx += 20) {
        const px = new Uint8Array(4)
        gl.readPixels(cx + dx, cy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
        sums.push(px[0] + px[1] + px[2])
      }
      const min = Math.min(...sums)
      const max = Math.max(...sums)
      return max - min > 30
    },
    undefined,
    { timeout: 10000 },
  )

  const pixels = await readCenterPixels(page, 80)

  // Refracted stripes → pixel values vary across the horizontal band
  const values = pixels.map((p) => p[0] + p[1] + p[2])
  const min = Math.min(...values)
  const max = Math.max(...values)
  expect(max - min).toBeGreaterThan(30) // visible stripe contrast
})

test('refracted pattern changes when droplet rotates', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto('/?bg=/fixtures/test-stripes.png')
  await waitForCanvas(page)

  function sampleRow(page: import('@playwright/test').Page) {
    return page.evaluate(() => {
      const src = document.querySelector('#r3f-canvas canvas') as HTMLCanvasElement
      const gl =
        (src.getContext('webgl2') as WebGL2RenderingContext | null) ??
        (src.getContext('webgl') as WebGLRenderingContext | null)
      if (!gl) return [] as number[]
      const cx = Math.floor(src.width / 2)
      const cy = Math.floor(src.height / 2)
      const result: number[] = []
      // Sample 9 pixels across a 240px horizontal band covering the droplet
      for (let dx = -120; dx <= 120; dx += 30) {
        const px = new Uint8Array(4)
        gl.readPixels(cx + dx, cy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
        result.push(px[0])
      }
      return result
    })
  }

  // Freeze at angle 0 and capture row
  await page.evaluate(() => {
    ;(window as Window & { __emotoFreezeDroplet?: (a: number | null) => void }).__emotoFreezeDroplet?.(0)
  })
  await page.waitForTimeout(400)
  const row0 = await sampleRow(page)

  // Rotate 45° and capture row
  await page.evaluate(() => {
    ;(window as Window & { __emotoFreezeDroplet?: (a: number | null) => void }).__emotoFreezeDroplet?.(Math.PI / 4)
  })
  await page.waitForTimeout(400)
  const row45 = await sampleRow(page)

  // Total absolute difference across the sampled row must be non-zero
  const totalDiff = row0.reduce((acc, v, i) => acc + Math.abs(v - (row45[i] ?? 0)), 0)
  expect(totalDiff).toBeGreaterThan(0)
})
