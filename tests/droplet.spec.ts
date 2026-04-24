import { test, expect } from '@playwright/test'

async function waitForCanvas(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('#r3f-canvas canvas') as HTMLCanvasElement | null
    return !!el && el.width > 0 && el.height > 0
  })
  await page.waitForTimeout(400)
}

test('droplet renders with non-zero pixels at center', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto('/')
  await waitForCanvas(page)

  // Poll until center pixel is non-zero — transmission rendering takes extra passes
  await page.waitForFunction(
    () => {
      const src = document.querySelector('#r3f-canvas canvas') as HTMLCanvasElement | null
      if (!src) return false
      const gl =
        (src.getContext('webgl2') as WebGL2RenderingContext | null) ??
        (src.getContext('webgl') as WebGLRenderingContext | null)
      if (!gl) return false
      const pixels = new Uint8Array(4)
      gl.readPixels(Math.floor(src.width / 2), Math.floor(src.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
      return pixels[0] > 0 || pixels[1] > 0 || pixels[2] > 0
    },
    undefined,
    { timeout: 8000 },
  )
})

test('Leva panel is visible with Droplet controls in debug mode', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/?debug=1')
  await waitForCanvas(page)

  // Leva renders control labels in the DOM; check for a unique label we defined
  await expect(page.locator('body')).toContainText('rotation speed')
  await expect(page.locator('body')).toContainText('ior')
  await expect(page.locator('body')).toContainText('clearcoat')
})

test('droplet baseline screenshot matches committed reference', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto('/')
  await waitForCanvas(page)

  // Freeze rotation at Y=0 for a deterministic snapshot
  await page.evaluate(() => {
    ;(
      window as Window & { __emotoFreezeDroplet?: (angle: number | null) => void }
    ).__emotoFreezeDroplet?.(0)
  })
  await page.waitForTimeout(200)

  await expect(page.locator('#r3f-canvas')).toHaveScreenshot('droplet-baseline.png', {
    maxDiffPixelRatio: 0.03,
  })

  // Unfreeze
  await page.evaluate(() => {
    ;(
      window as Window & { __emotoFreezeDroplet?: (angle: number | null) => void }
    ).__emotoFreezeDroplet?.(null)
  })
})
