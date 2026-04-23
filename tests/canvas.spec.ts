import { test, expect } from '@playwright/test'

test('canvas with webgl context is mounted at /', async ({ page }) => {
  await page.goto('/')

  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible()

  const hasWebGL = await page.evaluate(() => {
    const el = document.querySelector('canvas')
    if (!el) return false
    return el.getContext('webgl') !== null || el.getContext('webgl2') !== null
  })

  expect(hasWebGL).toBe(true)
})

test('canvas fills viewport at 1280x720', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/')

  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible()

  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  expect(Math.abs(box!.width - 1280)).toBeLessThanOrEqual(1)
  expect(Math.abs(box!.height - 720)).toBeLessThanOrEqual(1)
})

test('canvas fills viewport at 1920x1080', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible()

  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  expect(Math.abs(box!.width - 1920)).toBeLessThanOrEqual(1)
  expect(Math.abs(box!.height - 1080)).toBeLessThanOrEqual(1)
})

test('sanity wedge exhibits 6-fold rotational symmetry', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto('/')
  await page.locator('canvas').waitFor({ state: 'visible' })

  // Let p5 run a few draw frames so the framebuffer is populated.
  await page.waitForFunction(() => {
    const c = document.querySelector('canvas') as HTMLCanvasElement | null
    return !!c && c.width > 0 && c.height > 0
  })
  await page.waitForTimeout(250)

  const deltas = await page.evaluate(() => {
    const src = document.querySelector('canvas') as HTMLCanvasElement
    const tmp = document.createElement('canvas')
    tmp.width = src.width
    tmp.height = src.height
    const ctx = tmp.getContext('2d')!
    ctx.drawImage(src, 0, 0)

    const cx = Math.floor(src.width / 2)
    const cy = Math.floor(src.height / 2)
    const r = Math.floor(Math.min(src.width, src.height) * 0.18)

    // Average a 5x5 box to absorb subpixel rounding from the rotation
    // sampling — the GLSL fold is exact, but fcos(θ) and fcos(θ+π/3)
    // land on different subpixels.
    function avg(px: number, py: number): [number, number, number] {
      const d = ctx.getImageData(px - 2, py - 2, 5, 5).data
      let R = 0,
        G = 0,
        B = 0
      const n = 25
      for (let i = 0; i < n; i++) {
        R += d[i * 4]
        G += d[i * 4 + 1]
        B += d[i * 4 + 2]
      }
      return [R / n, G / n, B / n]
    }

    const results: number[] = []
    for (let i = 0; i < 24; i++) {
      const theta = (i / 24) * Math.PI * 2
      const x0 = Math.round(cx + r * Math.cos(theta))
      const y0 = Math.round(cy - r * Math.sin(theta))
      const x1 = Math.round(cx + r * Math.cos(theta + Math.PI / 3))
      const y1 = Math.round(cy - r * Math.sin(theta + Math.PI / 3))

      const a = avg(x0, y0)
      const b = avg(x1, y1)
      const d = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])
      results.push(d)
    }
    return results
  })

  // Each pair (θ, θ + 60°) should agree within a small tolerance.
  // Tolerance (~5% of max sum-of-RGB range 765) absorbs pixel
  // quantization when sampling along a ring — the GLSL fold itself
  // is exact. A random pattern would average ≥120 per pair.
  const maxDelta = Math.max(...deltas)
  expect(maxDelta).toBeLessThan(60)
  const avg = deltas.reduce((acc, v) => acc + v, 0) / deltas.length
  expect(avg).toBeLessThan(35)
  expect(avg).toBeGreaterThan(0) // guards against blank readback
})

test('hex lattice renders with non-trivial pixel variance at default scale', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto('/')
  await page.locator('canvas').waitFor({ state: 'visible' })
  await page.waitForTimeout(300)

  const stats = await page.evaluate(() => {
    const src = document.querySelector('canvas') as HTMLCanvasElement
    const tmp = document.createElement('canvas')
    tmp.width = src.width
    tmp.height = src.height
    const ctx = tmp.getContext('2d')!
    ctx.drawImage(src, 0, 0)

    const data = ctx.getImageData(0, 0, tmp.width, tmp.height).data
    const vals: number[] = []
    // Sample luminance every 8 pixels (R channel only for speed)
    for (let i = 0; i < data.length; i += 32) {
      vals.push(data[i])
    }
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length
    const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length
    return { mean, variance }
  })

  // Lattice produces distinct cell interiors and dark edges — variance
  // should be well above a solid or near-uniform fill.
  expect(stats.mean).toBeGreaterThan(5) // not blank / all-black
  expect(stats.variance).toBeGreaterThan(200) // not solid color
})

test('F key triggers fullscreen request on canvas', async ({ page }) => {
  await page.goto('/')
  await page.locator('canvas').waitFor({ state: 'visible' })

  // Intercept requestFullscreen before the key fires — headless Chromium
  // blocks the actual fullscreen API, so we verify the call was attempted.
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    if (canvas) {
      ;(window as unknown as Record<string, unknown>)['__fullscreenRequested'] = false
      canvas.requestFullscreen = async () => {
        ;(window as unknown as Record<string, unknown>)['__fullscreenRequested'] = true
      }
    }
  })

  await page.locator('canvas').click()
  await page.keyboard.press('f')

  const requested = await page.evaluate(
    () => (window as unknown as Record<string, unknown>)['__fullscreenRequested']
  )
  expect(requested).toBe(true)
})
