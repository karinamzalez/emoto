import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  // Omit {platform} so one committed baseline works on macOS and Linux CI.
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}',
  use: {
    baseURL: 'http://localhost:9000',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:9000',
    reuseExistingServer: !process.env['CI'],
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Enable fake mic device so getUserMedia succeeds in headless Chromium
        launchOptions: {
          args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
        },
      },
    },
  ],
})
