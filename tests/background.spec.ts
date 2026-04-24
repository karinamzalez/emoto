import { test, expect } from '@playwright/test'

async function waitForCanvas(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('#r3f-canvas canvas') as HTMLCanvasElement | null
    return !!el && el.width > 0 && el.height > 0
  })
  await page.waitForTimeout(400)
}

async function readCornerPixel(page: import('@playwright/test').Page): Promise<[number, number, number]> {
  return page.evaluate(() => {
    const src = document.querySelector('#r3f-canvas canvas') as HTMLCanvasElement
    const gl =
      (src.getContext('webgl2') as WebGL2RenderingContext | null) ??
      (src.getContext('webgl') as WebGLRenderingContext | null)
    if (!gl) return [0, 0, 0] as [number, number, number]
    const pixels = new Uint8Array(4)
    // Bottom-left corner in WebGL coords shows top-right of the skybox background
    gl.readPixels(8, 8, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    return [pixels[0], pixels[1], pixels[2]] as [number, number, number]
  })
}

test('default background renders non-black somewhere in scene', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto('/')
  await waitForCanvas(page)

  const hasNonBlack = await page.evaluate(() => {
    const src = document.querySelector('#r3f-canvas canvas') as HTMLCanvasElement | null
    if (!src) return false
    const gl =
      (src.getContext('webgl2') as WebGL2RenderingContext | null) ??
      (src.getContext('webgl') as WebGLRenderingContext | null)
    if (!gl) return false
    const pixels = new Uint8Array(4)
    const samples: [number, number][] = [
      [8, 8], [400, 8], [792, 8],
      [8, 400], [400, 400], [792, 400],
      [8, 792], [400, 792], [792, 792],
    ]
    for (const [x, y] of samples) {
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
      if (pixels[0] + pixels[1] + pixels[2] > 0) return true
    }
    return false
  })
  expect(hasNonBlack).toBe(true)
})

test('?bg= custom background differs from default', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 })

  await page.goto('/')
  await waitForCanvas(page)
  const defaultPixel = await readCornerPixel(page)

  await page.goto('/?bg=/fixtures/test-bg.png')
  await waitForCanvas(page)

  // Poll until the corner pixel is stable and non-zero (texture load + PMREM can be slow)
  await page.waitForFunction(
    () => {
      const src = document.querySelector('#r3f-canvas canvas') as HTMLCanvasElement | null
      if (!src) return false
      const gl =
        (src.getContext('webgl2') as WebGL2RenderingContext | null) ??
        (src.getContext('webgl') as WebGLRenderingContext | null)
      if (!gl) return false
      const px = new Uint8Array(4)
      gl.readPixels(8, 8, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
      return px[0] + px[1] + px[2] > 0
    },
    undefined,
    { timeout: 8000 },
  )

  const customPixel = await readCornerPixel(page)

  const diff =
    Math.abs(defaultPixel[0] - customPixel[0]) +
    Math.abs(defaultPixel[1] - customPixel[1]) +
    Math.abs(defaultPixel[2] - customPixel[2])
  expect(diff).toBeGreaterThan(0)
})

test('HDR background loads without console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto('/?bg=/fixtures/test-bg.hdr')
  await waitForCanvas(page)

  expect(errors).toHaveLength(0)
})
