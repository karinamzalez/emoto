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
