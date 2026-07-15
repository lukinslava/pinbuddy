/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Build stamp so a running client can show which deploy it is (helps confirm
// the iOS PWA actually picked up the latest version).
const BUILD_STAMP = new Date().toISOString().slice(0, 16).replace('T', ' ')

// https://vite.dev/config/
export default defineConfig({
  define: {
    __BUILD_STAMP__: JSON.stringify(BUILD_STAMP),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // manifest.webmanifest is a static file in public/ (linked from index.html),
      // so we don't ask the plugin to generate/inject its own.
      manifest: false,
      workbox: {
        // Minimal app-shell precache only — no offline-first data caching.
        globPatterns: ['index.html', 'manifest.webmanifest', 'assets/*.{js,css}', 'icons/*.png', 'favicon.svg'],
      },
    }),
  ],
  test: { environment: 'jsdom', globals: true, setupFiles: './src/test-setup.ts' },
})
