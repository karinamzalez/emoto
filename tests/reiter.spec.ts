import { test, expect } from '@playwright/test'

async function waitForCanvas(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('#r3f-canvas canvas') as HTMLCanvasElement | null
    return !!el && el.width > 0 && el.height > 0
  })
  await page.waitForTimeout(400)
}

type ReiterWindow = Window & {
  __emotoReiterIter?: number
  __emotoReiterDensityAt?: (col: number, row: number) => number
  __emotoSetCaGrowthRate?: (v: number) => void
}

// CA starts frozen (audio-driven); force growthRate=1 so tests don't need a mic.
async function startCA(page: import('@playwright/test').Page) {
  await page.evaluate(() => (window as ReiterWindow).__emotoSetCaGrowthRate?.(1))
}

test('ReiterCA runs to 100 iterations and produces a stable snowflake', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto('/?debug=1')
  await waitForCanvas(page)
  await startCA(page)

  // Wait for simulation to reach 100 iterations (growthRate=1 → ~3.3s)
  await page.waitForFunction(
    () => ((window as ReiterWindow).__emotoReiterIter ?? 0) >= 100,
    undefined,
    { timeout: 20000 }
  )

  // Verify the canvas has non-trivial content (snowflake pixels are visible)
  const hasContent = await page.evaluate(() => {
    const src = document.querySelector('#r3f-canvas canvas') as HTMLCanvasElement | null
    if (!src) return false
    const gl =
      (src.getContext('webgl2') as WebGL2RenderingContext | null) ??
      (src.getContext('webgl') as WebGLRenderingContext | null)
    if (!gl) return false
    const cx = Math.floor(src.width / 2)
    const cy = Math.floor(src.height / 2)
    // Sample a cross pattern to detect snowflake content
    const offsets = [-100, -50, 0, 50, 100]
    return offsets.some((d) => {
      const px = new Uint8Array(4)
      gl.readPixels(cx + d, cy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
      return px[0] + px[1] + px[2] > 0
    })
  })

  expect(hasContent).toBe(true)
})

test('ReiterCA density texture has hex 6-fold symmetry after 100 iterations', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto('/?debug=1')
  await waitForCanvas(page)
  await startCA(page)

  await page.waitForFunction(
    () => ((window as ReiterWindow).__emotoReiterIter ?? 0) >= 100,
    undefined,
    { timeout: 20000 }
  )

  // The 6 immediate hex neighbors of center (128,128) in an odd-r grid with even row:
  // E(129,128), W(127,128), NE(128,127), NW(127,127), SE(128,129), SW(127,129)
  const neighbors: [number, number][] = [
    [129, 128],
    [127, 128],
    [128, 127],
    [127, 127],
    [128, 129],
    [127, 129],
  ]

  const densities = await Promise.all(
    neighbors.map(([col, row]) =>
      page.evaluate(([c, r]) => (window as ReiterWindow).__emotoReiterDensityAt?.(c, r) ?? 0, [
        col,
        row,
      ] as [number, number])
    )
  )

  // All 6 neighbors received the same amount of vapor → values within 0.2% of each other
  // (seed noise ±0.001 per cell means max possible initial spread ≈ 0.002)
  const min = Math.min(...densities)
  const max = Math.max(...densities)
  expect(max - min).toBeLessThan(0.002)
})
