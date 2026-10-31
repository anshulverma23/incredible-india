import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Paths that must never be crawled (private / account / payment areas).
const ROBOTS_DISALLOW = [
  '/admin',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password/',
  '/verify-email/',
  '/dashboard',
  '/profile',
  '/wishlist',
  '/notifications',
  '/bookings',
  '/checkout',
  '/payment-success',
]

// SEO build step: fills the site URL into index.html (og:image, JSON-LD) and writes robots.txt.
// Set VITE_SITE_URL (e.g. https://www.example.com) in the hosting dashboard for production builds.
function seoPlugin(siteUrl) {
  return {
    name: 'seo-html-and-robots',
    transformIndexHtml: (html) => html.split('__SITE_URL__').join(siteUrl),
    generateBundle() {
      const lines = ['User-agent: *', 'Allow: /', ...ROBOTS_DISALLOW.map((p) => `Disallow: ${p}`)]
      if (siteUrl) lines.push('', `Sitemap: ${siteUrl}/sitemap.xml`)
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `${lines.join('\n')}\n` })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const siteUrl = (env.VITE_SITE_URL || '').replace(/\/+$/, '')

  return {
    plugins: [react(), tailwindcss(), seoPlugin(siteUrl)],
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
  }
})
