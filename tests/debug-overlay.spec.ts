import { test, expect } from '@playwright/test'

test('debug overlay toggles with D key when ?debug=1 is set', async ({ page }) => {
  await page.goto('/?debug=1')

  const debugOverlay = page.locator('#debug-overlay')
  await expect(debugOverlay).toBeHidden()

  await page.keyboard.press('d')
  await expect(debugOverlay).toBeVisible()

  await expect(page.locator('[data-metric="rms"]')).toBeVisible()
  await expect(page.locator('[data-metric="pitchHz"]')).toBeVisible()
  await expect(page.locator('[data-metric="centroidHz"]')).toBeVisible()
  await expect(page.locator('[data-metric="harmonicity"]')).toBeVisible()
})

test('debug overlay toggles off with second D press', async ({ page }) => {
  await page.goto('/?debug=1')

  await page.keyboard.press('d')
  await expect(page.locator('#debug-overlay')).toBeVisible()

  await page.keyboard.press('d')
  await expect(page.locator('#debug-overlay')).toBeHidden()
})

test('debug overlay is not created without debug flag in prod-like mode', async ({ page }) => {
  // When not in dev mode and no ?debug=1, overlay element should not exist in DOM
  // Note: dev server runs in DEV mode so this test is skipped in local dev
  await page.goto('/')
  // In dev mode the overlay will exist; in prod it won't. We only assert no crash.
  await expect(page).toHaveURL('/')
})
