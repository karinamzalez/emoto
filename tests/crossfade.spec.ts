import { test, expect } from '@playwright/test'

async function waitForCanvas(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('#r3f-canvas canvas') as HTMLCanvasElement | null
    return !!el && el.width > 0 && el.height > 0
  })
  await page.waitForTimeout(600)
}

/** Poll until the center pixel is non-zero (mesh has rendered). */
async function waitForRender(page: import('@playwright/test').Page) {
  await page.waitForFunction(
    () => {
      const src = document.querySelector('#r3f-canvas canvas') as HTMLCanvasElement | null
      if (!src) return false
      const gl =
        (src.getContext('webgl2') as WebGL2RenderingContext | null) ??
        (src.getContext('webgl') as WebGLRenderingContext | null)
      if (!gl) return false
      const px = new Uint8Array(4)
      gl.readPixels(
        Math.floor(src.width / 2),
        Math.floor(src.height / 2),
        1,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        px
      )
      return px[0] + px[1] + px[2] > 0
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

/** Read the summed RGB at the canvas center via gl.readPixels (gamma-correct). */
async function centerBrightness(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const src = document.querySelector('#r3f-canvas canvas') as HTMLCanvasElement
    const gl =
      (src.getContext('webgl2') as WebGL2RenderingContext | null) ??
      (src.getContext('webgl') as WebGLRenderingContext | null)
    if (!gl) return 0
    const px = new Uint8Array(4)
    gl.readPixels(
      Math.floor(src.width / 2),
      Math.floor(src.height / 2),
      1,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      px
    )
    return px[0] + px[1] + px[2]
  })
}

test('sweep 0→1 never goes see-through at center', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto('/?bg=/fixtures/test-stripes.png')
  await waitForCanvas(page)
  await waitForRender(page)

  const steps = [0, 0.25, 0.5, 0.75, 1.0]
  for (const v of steps) {
    await setCrossfade(page, v)
    await page.waitForTimeout(300)
    const brightness = await centerBrightness(page)
    // Mesh (droplet or crystal) should always be visible at center
    expect(brightness, `scene went dark at crystallinity=${v}`).toBeGreaterThan(0)
  }

  expect(errors, 'WebGL errors during sweep').toHaveLength(0)
})

test('visual regression: crystallinity=0 (pure droplet)', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto('/')
  await waitForCanvas(page)
  await setCrossfade(page, 0)
  await waitForRender(page)
  await page.waitForTimeout(500)
  await expect(page).toHaveScreenshot('crossfade-0.png', { maxDiffPixelRatio: 0.03 })
})

test('visual regression: crystallinity=0.25', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto('/')
  await waitForCanvas(page)
  await setCrossfade(page, 0.25)
  await waitForRender(page)
  await page.waitForTimeout(500)
  await expect(page).toHaveScreenshot('crossfade-0.25.png', { maxDiffPixelRatio: 0.03 })
})

test('visual regression: crystallinity=0.5', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto('/')
  await waitForCanvas(page)
  await setCrossfade(page, 0.5)
  await waitForRender(page)
  await page.waitForTimeout(500)
  await expect(page).toHaveScreenshot('crossfade-0.5.png', { maxDiffPixelRatio: 0.03 })
})

test('visual regression: crystallinity=0.75', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto('/')
  await waitForCanvas(page)
  await setCrossfade(page, 0.75)
  await waitForRender(page)
  await page.waitForTimeout(500)
  await expect(page).toHaveScreenshot('crossfade-0.75.png', { maxDiffPixelRatio: 0.03 })
})

test('visual regression: crystallinity=1.0 (pure crystal)', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto('/')
  await waitForCanvas(page)
  await setCrossfade(page, 1.0)
  await waitForRender(page)
  await page.waitForTimeout(500)
  await expect(page).toHaveScreenshot('crossfade-1.0.png', { maxDiffPixelRatio: 0.03 })
})

test('refraction visible at all intermediate crystallinity values', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto('/?bg=/fixtures/test-stripes.png')
  await waitForCanvas(page)
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
