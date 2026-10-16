import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // Split heavy vendor libraries into their own cacheable chunks (faster first load).
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/recharts|d3-|victory-vendor/.test(id)) return 'vendor-charts'
          if (/socket\.io|engine\.io/.test(id)) return 'vendor-realtime'
          if (/react-router|@remix-run/.test(id)) return 'vendor-router'
          if (/[\\/]react-dom[\\/]|[\\/]react[\\/]|scheduler/.test(id)) return 'vendor-react'
          return undefined
        },
      },
    },
  },
})
