/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    css: true,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(process.cwd(), '../shared'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:50234',
        changeOrigin: true,
      },
    },
  },
})
