import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'
import path from 'path'

const certPath = path.resolve(__dirname, 'cert')
const keyFile = path.join(certPath, 'key.pem')
const certFile = path.join(certPath, 'cert.pem')

const useHttps = fs.existsSync(keyFile) && fs.existsSync(certFile)

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'ProdPulse - Smart Production Tracking System',
        short_name: 'ProdPulse',
        description: 'Smart production tracking system for real-time manufacturing monitoring',
        start_url: '/',
        display: 'fullscreen',
        orientation: 'portrait',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        icons: [
          {
            src: '/favicon.ico',
            sizes: '64x64 32x32 24x24 16x16',
            type: 'image/x-icon',
          },
          {
            src: '/icon-192.png',
            type: 'image/png',
            sizes: '192x192',
          },
          {
            src: '/icon-512.png',
            type: 'image/png',
            sizes: '512x512',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
              networkTimeoutSeconds: 10,
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  base: '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'query-vendor': ['react-query', 'axios'],
          'ui-vendor': ['lucide-react', 'react-hot-toast'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    https: false,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'react-query'],
  },
})
