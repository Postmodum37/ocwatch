/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { API_BASE_URL } from '../shared/constants'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    css: true,
    exclude: ['**/node_modules/**', '**/e2e/**', '**/dist/**'],
  },
  resolve: {
    alias: {
      '@shared': path.resolve(process.cwd(), '../shared'),
    },
  },
  server: {
    open: true,
    proxy: {
      '/api': {
        target: API_BASE_URL,
        changeOrigin: true,
      },
    },
  },
})
