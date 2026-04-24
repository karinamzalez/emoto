import { test, expect } from '@playwright/test'

test('canvas with webgl2 context is mounted at /', async ({ page }) => {
  await page.goto('/')

  const canvas = page.locator('#r3f-canvas')
  await expect(canvas).toBeVisible()

  const hasWebGL = await page.evaluate(() => {
    const el = document.querySelector('#r3f-canvas canvas') as HTMLCanvasElement | null
    if (!el) return false
    return el.getContext('webgl2') !== null || el.getContext('webgl') !== null
  })

  expect(hasWebGL).toBe(true)
})

test('canvas fills viewport at 1280x720', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/')

  const canvas = page.locator('#r3f-canvas')
  await expect(canvas).toBeVisible()

  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  expect(Math.abs(box!.width - 1280)).toBeLessThanOrEqual(2)
  expect(Math.abs(box!.height - 720)).toBeLessThanOrEqual(2)
})

test('sanity cube renders with non-zero pixel variance at center', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto('/')
  await page.waitForFunction(() => {
    const el = document.querySelector('#r3f-canvas canvas') as HTMLCanvasElement | null
    return !!el && el.width > 0 && el.height > 0
  })
  await page.waitForTimeout(500)

  const hasNonZeroPixels = await page.evaluate(() => {
    const src = document.querySelector('#r3f-canvas canvas') as HTMLCanvasElement
    const gl =
      (src.getContext('webgl2') as WebGL2RenderingContext | null) ??
      (src.getContext('webgl') as WebGLRenderingContext | null)
    if (!gl) return false
    const pixels = new Uint8Array(4)
    gl.readPixels(Math.floor(src.width / 2), Math.floor(src.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    return pixels[0] > 0 || pixels[1] > 0 || pixels[2] > 0
  })

  expect(hasNonZeroPixels).toBe(true)
})
