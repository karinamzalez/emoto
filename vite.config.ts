/// <reference types="vitest" />
import { defineConfig } from 'vite'
import glsl from 'vite-plugin-glsl'

export default defineConfig({
  plugins: [glsl()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
