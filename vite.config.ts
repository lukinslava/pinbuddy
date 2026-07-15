/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
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
