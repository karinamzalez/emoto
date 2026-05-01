import { test, expect } from '@playwright/test'

async function waitForCanvas(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('#r3f-canvas canvas') as HTMLCanvasElement | null
    return !!el && el.width > 0 && el.height > 0
  })
  await page.waitForTimeout(500)
}

async function waitForFrame(page: import('@playwright/test').Page) {
  await page.waitForTimeout(150)
}

type Rotation = { x: number; y: number }
type LfoWindow = Window & {
  __emotoGetRotation?: () => Rotation
  __emotoSetLfoTime?: (t: number | null) => void
  __emotoSetLfoEnabled?: (target: string, enabled: boolean) => void
  __emotoFreezeDroplet?: (angle: number | null) => void
}

async function getRotation(page: import('@playwright/test').Page): Promise<Rotation> {
  return page.evaluate(() => {
    const fn = (window as LfoWindow).__emotoGetRotation
    return fn ? fn() : { x: 0, y: 0 }
  })
}

test('rotation.y drifts by ~π/6 when LFO time advances by quarter period', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto('/')
  await waitForCanvas(page)

  // Pin LFO to t=0 — rotation.y LFO offset = sin(0) * π/6 = 0
  await page.evaluate(() => {
    ;(window as LfoWindow).__emotoSetLfoTime?.(0)
  })
  await waitForFrame(page)

  const rot0 = await getRotation(page)

  // Advance to quarter period of rotation.y (22s / 4 = 5.5s) — sin(π/2) = 1 → full amplitude
  await page.evaluate(() => {
    ;(window as LfoWindow).__emotoSetLfoTime?.(5.5)
  })
  await waitForFrame(page)

  const rot1 = await getRotation(page)

  // LFO contributes π/6 ≈ 0.524 rad; spin adds a small amount over 150ms (≈0.015 rad).
  // Total expected delta >> π/6 * 0.5 = 0.262 rad minimum.
  const delta = rot1.y - rot0.y
  expect(delta).toBeGreaterThan((Math.PI / 6) * 0.5)
})

test('rotation.y stays steady when its LFO is disabled', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto('/')
  await waitForCanvas(page)

  // Freeze spin so only LFO contributes to rotation
  await page.evaluate(() => {
    ;(window as LfoWindow).__emotoFreezeDroplet?.(0)
  })
  await page.evaluate(() => {
    ;(window as LfoWindow).__emotoSetLfoTime?.(0)
  })
  await page.evaluate(() => {
    ;(window as LfoWindow).__emotoSetLfoEnabled?.('rotation.y', false)
  })
  await waitForFrame(page)

  const rot0 = await getRotation(page)

  // Advance to quarter period — with LFO disabled, rotation should not change
  await page.evaluate(() => {
    ;(window as LfoWindow).__emotoSetLfoTime?.(5.5)
  })
  await waitForFrame(page)

  const rot1 = await getRotation(page)

  // Spin is frozen at 0; LFO is disabled → rotation.y should not drift
  expect(Math.abs(rot1.y - rot0.y)).toBeLessThan(0.01)
})

test('Leva panel shows LFO controls', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/?debug=1')
  await waitForCanvas(page)

  // LFO panels register under 'LFO / ...' — check for 'LFO' folder name and control labels
  await expect(page.locator('body')).toContainText('LFO')
  await expect(page.locator('body')).toContainText('period (s)')
  await expect(page.locator('body')).toContainText('amplitude')
})
