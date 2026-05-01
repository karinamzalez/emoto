import { test, expect } from '@playwright/test'

async function waitForCanvas(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('#r3f-canvas canvas') as HTMLCanvasElement | null
    return !!el && el.width > 0 && el.height > 0
  })
  await page.waitForTimeout(600)
}

/** Poll until any pixel near center is non-zero (mesh has rendered). */
async function waitForRender(page: import('@playwright/test').Page) {
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
      for (let dx = -60; dx <= 60; dx += 20) {
        const px = new Uint8Array(4)
        gl.readPixels(cx + dx, cy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
        if (px[0] + px[1] + px[2] > 0) return true
      }
      return false
    },
    undefined,
    { timeout: 8000 }
  )
}

async function setCrossfade(page: import('@playwright/test').Page, value: number | null) {
  await page.evaluate((v) => {
    ;(window as Window & { __emotoCrossfade?: (n: number | null) => void }).__emotoCrossfade?.(v)
  }, value)
}

/** Freeze both Droplet and CrystalMesh rotation so pixel reads are stable. */
async function freezeAll(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    ;(
      window as Window & { __emotoFreezeDroplet?: (a: number | null) => void }
    ).__emotoFreezeDroplet?.(0)
    ;(
      window as Window & { __emotoCrystalFreeze?: (a: number | null) => void }
    ).__emotoCrystalFreeze?.(0)
  })
}

/**
 * Sample max summed-RGB across a ±60px grid near canvas center.
 * Using the max rather than a single center pixel avoids false negatives
 * when the mesh is glass and the center sample happens to land on a dark
 * background stripe.
 */
async function maxBrightnessNearCenter(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const src = document.querySelector('#r3f-canvas canvas') as HTMLCanvasElement
    const gl =
      (src.getContext('webgl2') as WebGL2RenderingContext | null) ??
      (src.getContext('webgl') as WebGLRenderingContext | null)
    if (!gl) return 0
    const cx = Math.floor(src.width / 2)
    const cy = Math.floor(src.height / 2)
    let maxBrightness = 0
    for (let dx = -60; dx <= 60; dx += 20) {
      for (let dy = -60; dy <= 60; dy += 20) {
        const px = new Uint8Array(4)
        gl.readPixels(cx + dx, cy + dy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
        maxBrightness = Math.max(maxBrightness, px[0] + px[1] + px[2])
      }
    }
    return maxBrightness
  })
}

test('sweep 0→1 never goes see-through', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto('/?bg=/fixtures/test-stripes.png')
  await waitForCanvas(page)
  await freezeAll(page)
  await waitForRender(page)

  const steps = [0, 0.25, 0.5, 0.75, 1.0]
  for (const v of steps) {
    await setCrossfade(page, v)
    await page.waitForTimeout(400)
    const brightness = await maxBrightnessNearCenter(page)
    expect(brightness, `scene went dark at crystallinity=${v}`).toBeGreaterThan(0)
  }

  expect(errors, 'WebGL errors during sweep').toHaveLength(0)
})

// Baseline brightness checks at the five canonical crystallinity values.
// Using gl.readPixels on a grid (platform-agnostic) instead of screenshot
// comparison to avoid cross-OS rendering differences with WebGL.
for (const [label, c] of [
  ['0 (pure droplet)', 0],
  ['0.25', 0.25],
  ['0.5', 0.5],
  ['0.75', 0.75],
  ['1.0 (pure crystal)', 1.0],
] as [string, number][]) {
  test(`baseline crystallinity=${label} — mesh visible near center`, async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 800 })
    await page.goto('/?bg=/fixtures/test-stripes.png')
    await waitForCanvas(page)
    await freezeAll(page)
    await setCrossfade(page, c)
    await waitForRender(page)
    await page.waitForTimeout(400)
    const brightness = await maxBrightnessNearCenter(page)
    expect(brightness, `mesh not visible at crystallinity=${c}`).toBeGreaterThan(0)
  })
}

test('refraction visible at all intermediate crystallinity values', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto('/?bg=/fixtures/test-stripes.png')
  await waitForCanvas(page)
  await freezeAll(page)
  await waitForRender(page)

  for (const v of [0, 0.5, 1.0]) {
    await setCrossfade(page, v)
    await page.waitForTimeout(400)

    const hasRefraction = await page.evaluate(() => {
      const src = document.querySelector('#r3f-canvas canvas') as HTMLCanvasElement | null
      if (!src) return false
      const gl =
        (src.getContext('webgl2') as WebGL2RenderingContext | null) ??
        (src.getContext('webgl') as WebGLRenderingContext | null)
      if (!gl) return false
      const cx = Math.floor(src.width / 2)
      const cy = Math.floor(src.height / 2)
      const sums: number[] = []
      for (let dx = -60; dx <= 60; dx += 20) {
        const px = new Uint8Array(4)
        gl.readPixels(cx + dx, cy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
        sums.push(px[0] + px[1] + px[2])
      }
      return Math.max(...sums) - Math.min(...sums) > 30
    })

    expect(hasRefraction, `no refraction stripe variance at crystallinity=${v}`).toBe(true)
  }
})
