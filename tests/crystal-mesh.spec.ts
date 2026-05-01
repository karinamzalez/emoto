import { test, expect } from '@playwright/test'

type CrystalWindow = Window & {
  __emotoCrystalFreeze?: (angle: number | null) => void
  __emotoReiterIter?: number
}

async function waitForCanvas(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('#r3f-canvas canvas') as HTMLCanvasElement | null
    return !!el && el.width > 0 && el.height > 0
  })
  await page.waitForTimeout(400)
}

async function waitForCA(page: import('@playwright/test').Page, minIter = 50) {
  await page.waitForFunction(
    (n: number) => ((window as CrystalWindow).__emotoReiterIter ?? 0) >= n,
    minIter,
    { timeout: 20000 }
  )
}

/** gl.readPixels at (cx+dx, cy) for a horizontal strip. Returns [R,G,B] per sample. */
function sampleHorizontalStrip(page: import('@playwright/test').Page, dx: number[]) {
  return page.evaluate((offsets: number[]) => {
    const src = document.querySelector('#r3f-canvas canvas') as HTMLCanvasElement
    const gl =
      (src.getContext('webgl2') as WebGL2RenderingContext | null) ??
      (src.getContext('webgl') as WebGLRenderingContext | null)
    if (!gl) return [] as number[][]
    const cx = Math.floor(src.width / 2)
    const cy = Math.floor(src.height / 2)
    return offsets.map((dx) => {
      const px = new Uint8Array(4)
      gl.readPixels(cx + dx, cy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
      return [px[0], px[1], px[2]]
    })
  }, dx)
}

/** Sample a vertical strip through center, return per-pixel luminance. */
function sampleVerticalStrip(page: import('@playwright/test').Page, dy: number[]) {
  return page.evaluate((offsets: number[]) => {
    const src = document.querySelector('#r3f-canvas canvas') as HTMLCanvasElement
    const gl =
      (src.getContext('webgl2') as WebGL2RenderingContext | null) ??
      (src.getContext('webgl') as WebGLRenderingContext | null)
    if (!gl) return [] as number[]
    const cx = Math.floor(src.width / 2)
    const cy = Math.floor(src.height / 2)
    return offsets.map((dy) => {
      const px = new Uint8Array(4)
      gl.readPixels(cx, cy + dy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
      return px[0] + px[1] + px[2]
    })
  }, dy)
}

test('crystal mesh is present: center pixels are non-zero', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto('/?droplet-off&debug=1')
  await waitForCanvas(page)

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
    { timeout: 10000 }
  )

  const center = await sampleHorizontalStrip(page, [0])
  const [r, g, b] = center[0]
  expect(r + g + b).toBeGreaterThan(0)
})

test('stripe deformation is visible through crystal — refraction works', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto('/?droplet-off&bg=/fixtures/test-stripes.png&debug=1')
  await waitForCanvas(page)
  await waitForCA(page, 50)

  // Freeze rotation so the crystal faces the camera
  await page.evaluate(() => {
    ;(window as CrystalWindow).__emotoCrystalFreeze?.(0)
  })
  await page.waitForTimeout(400)

  // Wait until horizontal stripe variance exceeds threshold (refraction bends stripes)
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
      for (let dx = -100; dx <= 100; dx += 20) {
        const px = new Uint8Array(4)
        gl.readPixels(cx + dx, cy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
        sums.push(px[0] + px[1] + px[2])
      }
      return Math.max(...sums) - Math.min(...sums) > 30
    },
    undefined,
    { timeout: 15000 }
  )

  const pixels = await sampleHorizontalStrip(page, [-80, -60, -40, -20, 0, 20, 40, 60, 80])
  const lums = pixels.map(([r, g, b]) => r + g + b)
  expect(Math.max(...lums) - Math.min(...lums)).toBeGreaterThan(30)
})

test('side profile shows clear thickness — silhouette area ≥ 15% of front view', async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto('/?droplet-off&debug=1')
  await waitForCanvas(page)
  await waitForCA(page, 80)

  // Freeze face-on and sample a vertical strip to count "lit" pixels
  await page.evaluate(() => {
    ;(window as CrystalWindow).__emotoCrystalFreeze?.(0)
  })
  await page.waitForTimeout(500)

  const yOffsets = Array.from({ length: 41 }, (_, i) => -200 + i * 10)
  const frontLums = await sampleVerticalStrip(page, yOffsets)
  const frontLit = frontLums.filter((v) => v > 30).length

  // Rotate 90° (edge-on) and sample same strip
  await page.evaluate(() => {
    ;(window as CrystalWindow).__emotoCrystalFreeze?.(Math.PI / 2)
  })
  await page.waitForTimeout(500)

  const sideLums = await sampleVerticalStrip(page, yOffsets)
  const sideLit = sideLums.filter((v) => v > 30).length

  // Side profile must be at least 15% of face-on extent
  expect(sideLit).toBeGreaterThan(0)
  expect(sideLit / frontLit).toBeGreaterThanOrEqual(0.15)
})

test('crystal mesh has distinct content after 100 CA iterations', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto('/?droplet-off&debug=1')
  await waitForCanvas(page)
  await waitForCA(page, 100)

  await page.evaluate(() => {
    ;(window as CrystalWindow).__emotoCrystalFreeze?.(0)
  })
  await page.waitForTimeout(600)

  // Verify the crystal still has visible content after 100 CA iterations
  const lums = await sampleHorizontalStrip(page, [-150, -100, -50, 0, 50, 100, 150])
  const values = lums.map(([r, g, b]) => r + g + b)
  const max = Math.max(...values)
  expect(max).toBeGreaterThan(0)
})
