import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'
import path from 'path'

const certPath = path.resolve(__dirname, 'cert')
const keyFile = path.join(certPath, 'key.pem')
const certFile = path.join(certPath, 'cert.pem')

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  /** Factory LAN without internet: set VITE_DISABLE_PWA=true so Chrome is not blocked by a service worker. */
  const disablePwa = env.VITE_DISABLE_PWA === 'true'
  /** Split-dev proxy — set VITE_DEV_API_PROXY in frontend/.env.local (develop: 3001, feature: 3101). */
  const devApiProxyTarget = env.VITE_DEV_API_PROXY?.trim()
  const devApiProxy = devApiProxyTarget
    ? {
        '/api': { target: devApiProxyTarget, changeOrigin: true },
        '/health': { target: devApiProxyTarget, changeOrigin: true },
      }
    : undefined

  return {
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon.svg'],
      manifest: {
        name: 'ProdPulse - Smart Production Tracking System',
        short_name: 'ProdPulse',
        description: 'Smart production tracking system for real-time manufacturing monitoring',
        start_url: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        scope: '/',
        categories: ['productivity', 'business'],
        icons: [
          {
            src: '/favicon.ico',
            sizes: '64x64 32x32 24x24 16x16',
            type: 'image/x-icon',
          },
          {
            src: '/icon.svg',
            type: 'image/svg+xml',
            sizes: 'any',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/health/],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/.*/i,
            handler: 'NetworkOnly',
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
    ...(devApiProxy ? { proxy: devApiProxy } : {}),
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'react-query'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,ts,tsx}'],
  },
  }
})
