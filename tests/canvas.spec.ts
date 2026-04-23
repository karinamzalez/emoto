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

test('F key triggers fullscreen request on canvas', async ({ page }) => {
  await page.goto('/')
  await page.locator('canvas').waitFor({ state: 'visible' })

  // Dismiss mic overlay (which covers the canvas) — watch-only button is hidden by default
  // so dismiss it directly to avoid UI coupling
  await page.evaluate(() => {
    document.getElementById('mic-overlay')?.classList.add('hidden')
  })

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
