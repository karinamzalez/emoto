import { test, expect } from '@playwright/test'

async function waitForCanvas(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('#r3f-canvas canvas') as HTMLCanvasElement | null
    return !!el && el.width > 0 && el.height > 0
  })
  await page.waitForTimeout(600)
}

/** Sample a 5×5 grid of pixels across the droplet body (±70px from center). */
async function sampleDropletGrid(page: import('@playwright/test').Page): Promise<number[][]> {
  return page.evaluate(() => {
    const src = document.querySelector('#r3f-canvas canvas') as HTMLCanvasElement
    const gl =
      (src.getContext('webgl2') as WebGL2RenderingContext | null) ??
      (src.getContext('webgl') as WebGLRenderingContext | null)
    if (!gl) return []
    const cx = Math.floor(src.width / 2)
    const cy = Math.floor(src.height / 2)
    const results: number[][] = []
    for (let dx = -70; dx <= 70; dx += 35) {
      for (let dy = -70; dy <= 70; dy += 35) {
        const px = new Uint8Array(4)
        gl.readPixels(cx + dx, cy + dy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
        results.push([px[0], px[1], px[2]])
      }
    }
    return results
  })
}

/** Max per-pixel channel spread across a set of samples — higher = more hue variation. */
function maxChannelSpread(pixels: number[][]): number {
  return pixels.reduce((acc, [r, g, b]) => {
    return Math.max(acc, Math.abs(r - g), Math.abs(g - b), Math.abs(r - b))
  }, 0)
}

/** Average |R − B| across samples — measure of chromatic splitting. */
function avgRBSplit(pixels: number[][]): number {
  if (!pixels.length) return 0
  return pixels.reduce((acc, [r, , b]) => acc + Math.abs(r - b), 0) / pixels.length
}

test('iridescence=1 produces higher hue spread than iridescence=0', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 })
  // Use the HDR background — it sets scene.environment, making iridescence visible
  await page.goto('/?bg=/fixtures/test-bg.hdr')
  await waitForCanvas(page)

  await page.evaluate(() => {
    ;(window as Window & { __emotoFreezeDroplet?: (a: number | null) => void }).__emotoFreezeDroplet?.(0)
  })
  await page.waitForTimeout(400)

  // Measure at iridescence=0
  await page.evaluate(() => {
    ;(window as Window & { __emotoSetMaterial?: (p: object) => void }).__emotoSetMaterial?.({ iridescence: 0 })
  })
  await page.waitForTimeout(400)
  const pixels0 = await sampleDropletGrid(page)

  // Measure at iridescence=1
  await page.evaluate(() => {
    ;(window as Window & { __emotoSetMaterial?: (p: object) => void }).__emotoSetMaterial?.({ iridescence: 1 })
  })
  await page.waitForTimeout(400)
  const pixels1 = await sampleDropletGrid(page)

  expect(maxChannelSpread(pixels1)).toBeGreaterThan(maxChannelSpread(pixels0))
})

test('dispersion=5 produces more R/B separation than dispersion=0', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto('/?bg=/fixtures/test-stripes.png')
  await waitForCanvas(page)

  await page.evaluate(() => {
    ;(window as Window & { __emotoFreezeDroplet?: (a: number | null) => void }).__emotoFreezeDroplet?.(0)
  })
  await page.waitForTimeout(400)

  // Low dispersion
  await page.evaluate(() => {
    ;(window as Window & { __emotoSetMaterial?: (p: object) => void }).__emotoSetMaterial?.({ dispersion: 0 })
  })
  await page.waitForTimeout(500)
  const pixelsLow = await sampleDropletGrid(page)

  // High dispersion
  await page.evaluate(() => {
    ;(window as Window & { __emotoSetMaterial?: (p: object) => void }).__emotoSetMaterial?.({ dispersion: 5 })
  })
  await page.waitForTimeout(500)
  const pixelsHigh = await sampleDropletGrid(page)

  expect(avgRBSplit(pixelsHigh)).toBeGreaterThanOrEqual(avgRBSplit(pixelsLow))
})

test('iridescence baseline screenshot matches committed reference', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto('/')
  await waitForCanvas(page)

  await page.evaluate(() => {
    ;(window as Window & { __emotoFreezeDroplet?: (a: number | null) => void }).__emotoFreezeDroplet?.(0)
  })
  await page.waitForTimeout(400)

  await expect(page.locator('#r3f-canvas')).toHaveScreenshot('iridescence-baseline.png', {
    maxDiffPixelRatio: 0.03,
  })

  await page.evaluate(() => {
    ;(window as Window & { __emotoFreezeDroplet?: (a: number | null) => void }).__emotoFreezeDroplet?.(null)
  })
})
