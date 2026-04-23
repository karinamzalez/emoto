import { test, expect } from '@playwright/test'

test('Begin button advances to listening state on mic success', async ({ page }) => {
  // Inject mocks before page load to control the audio pipeline reliably in headless Chromium
  await page.addInitScript(() => {
    const fakeStream = { getTracks: () => [] }
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: () => Promise.resolve(fakeStream) },
      configurable: true,
    })

    const fakeAnalyser = { fftSize: 0, connect: () => {} }
    const fakeSource = { connect: () => {} }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).AudioContext = class {
      sampleRate = 44100
      createAnalyser() {
        return fakeAnalyser
      }
      createMediaStreamSource() {
        return fakeSource
      }
      close() {}
    }
  })

  await page.goto('/')

  const overlay = page.locator('#mic-overlay')
  const btnBegin = page.locator('#btn-begin')

  await expect(overlay).toBeVisible()
  await expect(btnBegin).toBeVisible()

  await btnBegin.click()

  await expect(overlay).toBeHidden({ timeout: 3000 })
})

test('shows denial message when mic permission is denied', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: () => Promise.reject(new DOMException('NotAllowedError', 'NotAllowedError')),
      },
      configurable: true,
    })
  })

  await page.goto('/')

  const btnBegin = page.locator('#btn-begin')
  await btnBegin.click()

  const status = page.locator('#mic-status')
  await expect(status).toContainText('denied', { timeout: 3000 })
})
