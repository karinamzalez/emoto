import { test, expect } from '@playwright/test'

async function waitForCanvas(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('#r3f-canvas canvas') as HTMLCanvasElement | null
    return !!el && el.width > 0 && el.height > 0
  })
  await page.waitForTimeout(600)
}

async function setCrystallinity(page: import('@playwright/test').Page, value: number | null) {
  await page.evaluate((v) => {
    ;(
      window as Window & { __emotoSetCrystallinity?: (n: number | null) => void }
    ).__emotoSetCrystallinity?.(v)
  }, value)
}

async function freezeDroplet(page: import('@playwright/test').Page, angle: number | null) {
  await page.evaluate((a) => {
    ;(
      window as Window & { __emotoFreezeDroplet?: (a: number | null) => void }
    ).__emotoFreezeDroplet?.(a)
  }, angle)
}

/** Poll until center pixel is non-zero (transmission pass rendered). */
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
        px,
      )
      return px[0] + px[1] + px[2] > 0
    },
    undefined,
    { timeout: 8000 },
  )
}

test('crystallinity visual regression at 0, 0.5, and 1.0', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto('/')
  await waitForCanvas(page)
  await freezeDroplet(page, 0)
  await waitForRender(page)

  // crystallinity = 0 (pure droplet)
  await setCrystallinity(page, 0)
  await page.waitForTimeout(400)
  await expect(page.locator('#r3f-canvas')).toHaveScreenshot('crystallinity-0.png', {
    maxDiffPixelRatio: 0.03,
  })

  // crystallinity = 0.5 (partial faceting)
  await setCrystallinity(page, 0.5)
  await page.waitForTimeout(400)
  await expect(page.locator('#r3f-canvas')).toHaveScreenshot('crystallinity-0.5.png', {
    maxDiffPixelRatio: 0.03,
  })

  // crystallinity = 1.0 (full crystal)
  await setCrystallinity(page, 1)
  await page.waitForTimeout(400)
  await expect(page.locator('#r3f-canvas')).toHaveScreenshot('crystallinity-1.png', {
    maxDiffPixelRatio: 0.03,
  })

  expect(errors).toHaveLength(0)
})

test('no WebGL errors across crystallinity sweep', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto('/')
  await waitForCanvas(page)
  await freezeDroplet(page, 0)
  await waitForRender(page)

  for (const v of [0, 0.25, 0.5, 0.75, 1]) {
    await setCrystallinity(page, v)
    await page.waitForTimeout(200)
  }

  expect(errors).toHaveLength(0)
})

test('refraction visible at crystallinity=1 — stripes bend through crystal silhouette', async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto('/?bg=/fixtures/test-stripes.png')
  await waitForCanvas(page)
  await freezeDroplet(page, 0)
  await setCrystallinity(page, 1)

  // Poll until stripe variance is visible through the crystal
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
      for (let dx = -60; dx <= 60; dx += 20) {
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

  // If we reach here the assertion inside waitForFunction already passed
  expect(true).toBe(true)
})
