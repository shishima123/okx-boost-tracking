import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Base path: '/' khi dev/local, '/<repo>/' khi deploy GitHub Pages
  // (workflow set VITE_BASE = /${repo}/)
  base: process.env.VITE_BASE || '/',
  // 5173 (mặc định) nằm trong dải port bị Windows/WinNAT reserve -> EACCES.
  // Dùng port ngoài các dải đó.
  server: {
    port: 3000,
  },
  plugins: [
    vue(),
    vueDevTools(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'pwa-icon.svg', 'maskable-icon.svg'],
      manifest: {
        name: 'OKX Boost Tracker',
        short_name: 'Boost Tracker',
        description: 'Theo dõi OKX Boost: chu kì, phần thưởng và tài khoản',
        lang: 'vi',
        theme_color: '#e8ebf0',
        background_color: '#e8ebf0',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-icon.svg',
            sizes: '192x192 512x512 any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'maskable-icon.svg',
            sizes: '192x192 512x512 any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // SPA fallback dùng hash routing nên index.html là entry duy nhất
        navigateFallback: 'index.html',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
