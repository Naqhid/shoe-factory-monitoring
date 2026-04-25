// vite.config.ts
import { defineConfig } from "file:///C:/Software/shoe-factory-monitoring/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Software/shoe-factory-monitoring/frontend/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///C:/Software/shoe-factory-monitoring/frontend/node_modules/vite-plugin-pwa/dist/index.js";
import fs from "fs";
import path from "path";
var __vite_injected_original_dirname = "C:\\Software\\shoe-factory-monitoring\\frontend";
var certPath = path.resolve(__vite_injected_original_dirname, "cert");
var keyFile = path.join(certPath, "key.pem");
var certFile = path.join(certPath, "cert.pem");
var useHttps = fs.existsSync(keyFile) && fs.existsSync(certFile);
var vite_config_default = defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "icon.svg"],
      manifest: {
        name: "ProdPulse - Smart Production Tracking System",
        short_name: "ProdPulse",
        description: "Smart production tracking system for real-time manufacturing monitoring",
        start_url: "/",
        display: "standalone",
        orientation: "any",
        theme_color: "#2563eb",
        background_color: "#ffffff",
        scope: "/",
        categories: ["productivity", "business"],
        icons: [
          {
            src: "/favicon.ico",
            sizes: "64x64 32x32 24x24 16x16",
            type: "image/x-icon"
          },
          {
            src: "/icon.svg",
            type: "image/svg+xml",
            sizes: "any",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
              networkTimeoutSeconds: 10
            }
          }
        ]
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  base: "/",
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "query-vendor": ["react-query", "axios"],
          "ui-vendor": ["lucide-react", "react-hot-toast"]
        }
      }
    },
    chunkSizeWarningLimit: 1e3,
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  server: {
    port: 3e3,
    host: "0.0.0.0",
    https: false
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom", "react-query"]
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxTb2Z0d2FyZVxcXFxzaG9lLWZhY3RvcnktbW9uaXRvcmluZ1xcXFxmcm9udGVuZFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcU29mdHdhcmVcXFxcc2hvZS1mYWN0b3J5LW1vbml0b3JpbmdcXFxcZnJvbnRlbmRcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1NvZnR3YXJlL3Nob2UtZmFjdG9yeS1tb25pdG9yaW5nL2Zyb250ZW5kL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xyXG5pbXBvcnQgeyBWaXRlUFdBIH0gZnJvbSAndml0ZS1wbHVnaW4tcHdhJ1xyXG5pbXBvcnQgZnMgZnJvbSAnZnMnXHJcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnXHJcblxyXG5jb25zdCBjZXJ0UGF0aCA9IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdjZXJ0JylcclxuY29uc3Qga2V5RmlsZSA9IHBhdGguam9pbihjZXJ0UGF0aCwgJ2tleS5wZW0nKVxyXG5jb25zdCBjZXJ0RmlsZSA9IHBhdGguam9pbihjZXJ0UGF0aCwgJ2NlcnQucGVtJylcclxuXHJcbmNvbnN0IHVzZUh0dHBzID0gZnMuZXhpc3RzU3luYyhrZXlGaWxlKSAmJiBmcy5leGlzdHNTeW5jKGNlcnRGaWxlKVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBwbHVnaW5zOiBbXHJcbiAgICByZWFjdCgpLFxyXG4gICAgVml0ZVBXQSh7XHJcbiAgICAgIHJlZ2lzdGVyVHlwZTogJ2F1dG9VcGRhdGUnLFxyXG4gICAgICBpbmNsdWRlQXNzZXRzOiBbJ2Zhdmljb24uaWNvJywgJ2ljb24uc3ZnJ10sXHJcbiAgICAgIG1hbmlmZXN0OiB7XHJcbiAgICAgICAgbmFtZTogJ1Byb2RQdWxzZSAtIFNtYXJ0IFByb2R1Y3Rpb24gVHJhY2tpbmcgU3lzdGVtJyxcclxuICAgICAgICBzaG9ydF9uYW1lOiAnUHJvZFB1bHNlJyxcclxuICAgICAgICBkZXNjcmlwdGlvbjogJ1NtYXJ0IHByb2R1Y3Rpb24gdHJhY2tpbmcgc3lzdGVtIGZvciByZWFsLXRpbWUgbWFudWZhY3R1cmluZyBtb25pdG9yaW5nJyxcclxuICAgICAgICBzdGFydF91cmw6ICcvJyxcclxuICAgICAgICBkaXNwbGF5OiAnc3RhbmRhbG9uZScsXHJcbiAgICAgICAgb3JpZW50YXRpb246ICdhbnknLFxyXG4gICAgICAgIHRoZW1lX2NvbG9yOiAnIzI1NjNlYicsXHJcbiAgICAgICAgYmFja2dyb3VuZF9jb2xvcjogJyNmZmZmZmYnLFxyXG4gICAgICAgIHNjb3BlOiAnLycsXHJcbiAgICAgICAgY2F0ZWdvcmllczogWydwcm9kdWN0aXZpdHknLCAnYnVzaW5lc3MnXSxcclxuICAgICAgICBpY29uczogW1xyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICBzcmM6ICcvZmF2aWNvbi5pY28nLFxyXG4gICAgICAgICAgICBzaXplczogJzY0eDY0IDMyeDMyIDI0eDI0IDE2eDE2JyxcclxuICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3gtaWNvbicsXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICBzcmM6ICcvaWNvbi5zdmcnLFxyXG4gICAgICAgICAgICB0eXBlOiAnaW1hZ2Uvc3ZnK3htbCcsXHJcbiAgICAgICAgICAgIHNpemVzOiAnYW55JyxcclxuICAgICAgICAgICAgcHVycG9zZTogJ2FueSBtYXNrYWJsZScsXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIF0sXHJcbiAgICAgIH0sXHJcbiAgICAgIHdvcmtib3g6IHtcclxuICAgICAgICBnbG9iUGF0dGVybnM6IFsnKiovKi57anMsY3NzLGh0bWwsaWNvLHBuZyxzdmcsd29mZjJ9J10sXHJcbiAgICAgICAgcnVudGltZUNhY2hpbmc6IFtcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgdXJsUGF0dGVybjogL15odHRwcz86XFwvXFwvLipcXC9hcGlcXC8uKi9pLFxyXG4gICAgICAgICAgICBoYW5kbGVyOiAnTmV0d29ya0ZpcnN0JyxcclxuICAgICAgICAgICAgb3B0aW9uczoge1xyXG4gICAgICAgICAgICAgIGNhY2hlTmFtZTogJ2FwaS1jYWNoZScsXHJcbiAgICAgICAgICAgICAgZXhwaXJhdGlvbjogeyBtYXhFbnRyaWVzOiA1MCwgbWF4QWdlU2Vjb25kczogMzAwIH0sXHJcbiAgICAgICAgICAgICAgbmV0d29ya1RpbWVvdXRTZWNvbmRzOiAxMCxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgXSxcclxuICAgICAgfSxcclxuICAgICAgZGV2T3B0aW9uczoge1xyXG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXHJcbiAgICAgIH0sXHJcbiAgICB9KSxcclxuICBdLFxyXG4gIGJhc2U6ICcvJyxcclxuICBidWlsZDoge1xyXG4gICAgcm9sbHVwT3B0aW9uczoge1xyXG4gICAgICBvdXRwdXQ6IHtcclxuICAgICAgICBtYW51YWxDaHVua3M6IHtcclxuICAgICAgICAgICdyZWFjdC12ZW5kb3InOiBbJ3JlYWN0JywgJ3JlYWN0LWRvbScsICdyZWFjdC1yb3V0ZXItZG9tJ10sXHJcbiAgICAgICAgICAncXVlcnktdmVuZG9yJzogWydyZWFjdC1xdWVyeScsICdheGlvcyddLFxyXG4gICAgICAgICAgJ3VpLXZlbmRvcic6IFsnbHVjaWRlLXJlYWN0JywgJ3JlYWN0LWhvdC10b2FzdCddLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiAxMDAwLFxyXG4gICAgbWluaWZ5OiAndGVyc2VyJyxcclxuICAgIHRlcnNlck9wdGlvbnM6IHtcclxuICAgICAgY29tcHJlc3M6IHtcclxuICAgICAgICBkcm9wX2NvbnNvbGU6IHRydWUsXHJcbiAgICAgICAgZHJvcF9kZWJ1Z2dlcjogdHJ1ZSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfSxcclxuICBzZXJ2ZXI6IHtcclxuICAgIHBvcnQ6IDMwMDAsXHJcbiAgICBob3N0OiAnMC4wLjAuMCcsXHJcbiAgICBodHRwczogZmFsc2UsXHJcbiAgfSxcclxuICBvcHRpbWl6ZURlcHM6IHtcclxuICAgIGluY2x1ZGU6IFsncmVhY3QnLCAncmVhY3QtZG9tJywgJ3JlYWN0LXJvdXRlci1kb20nLCAncmVhY3QtcXVlcnknXSxcclxuICB9LFxyXG59KVxyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQThULFNBQVMsb0JBQW9CO0FBQzNWLE9BQU8sV0FBVztBQUNsQixTQUFTLGVBQWU7QUFDeEIsT0FBTyxRQUFRO0FBQ2YsT0FBTyxVQUFVO0FBSmpCLElBQU0sbUNBQW1DO0FBTXpDLElBQU0sV0FBVyxLQUFLLFFBQVEsa0NBQVcsTUFBTTtBQUMvQyxJQUFNLFVBQVUsS0FBSyxLQUFLLFVBQVUsU0FBUztBQUM3QyxJQUFNLFdBQVcsS0FBSyxLQUFLLFVBQVUsVUFBVTtBQUUvQyxJQUFNLFdBQVcsR0FBRyxXQUFXLE9BQU8sS0FBSyxHQUFHLFdBQVcsUUFBUTtBQUVqRSxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsSUFDTixRQUFRO0FBQUEsTUFDTixjQUFjO0FBQUEsTUFDZCxlQUFlLENBQUMsZUFBZSxVQUFVO0FBQUEsTUFDekMsVUFBVTtBQUFBLFFBQ1IsTUFBTTtBQUFBLFFBQ04sWUFBWTtBQUFBLFFBQ1osYUFBYTtBQUFBLFFBQ2IsV0FBVztBQUFBLFFBQ1gsU0FBUztBQUFBLFFBQ1QsYUFBYTtBQUFBLFFBQ2IsYUFBYTtBQUFBLFFBQ2Isa0JBQWtCO0FBQUEsUUFDbEIsT0FBTztBQUFBLFFBQ1AsWUFBWSxDQUFDLGdCQUFnQixVQUFVO0FBQUEsUUFDdkMsT0FBTztBQUFBLFVBQ0w7QUFBQSxZQUNFLEtBQUs7QUFBQSxZQUNMLE9BQU87QUFBQSxZQUNQLE1BQU07QUFBQSxVQUNSO0FBQUEsVUFDQTtBQUFBLFlBQ0UsS0FBSztBQUFBLFlBQ0wsTUFBTTtBQUFBLFlBQ04sT0FBTztBQUFBLFlBQ1AsU0FBUztBQUFBLFVBQ1g7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLE1BQ0EsU0FBUztBQUFBLFFBQ1AsY0FBYyxDQUFDLHNDQUFzQztBQUFBLFFBQ3JELGdCQUFnQjtBQUFBLFVBQ2Q7QUFBQSxZQUNFLFlBQVk7QUFBQSxZQUNaLFNBQVM7QUFBQSxZQUNULFNBQVM7QUFBQSxjQUNQLFdBQVc7QUFBQSxjQUNYLFlBQVksRUFBRSxZQUFZLElBQUksZUFBZSxJQUFJO0FBQUEsY0FDakQsdUJBQXVCO0FBQUEsWUFDekI7QUFBQSxVQUNGO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxNQUNBLFlBQVk7QUFBQSxRQUNWLFNBQVM7QUFBQSxNQUNYO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDSDtBQUFBLEVBQ0EsTUFBTTtBQUFBLEVBQ04sT0FBTztBQUFBLElBQ0wsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBLFFBQ04sY0FBYztBQUFBLFVBQ1osZ0JBQWdCLENBQUMsU0FBUyxhQUFhLGtCQUFrQjtBQUFBLFVBQ3pELGdCQUFnQixDQUFDLGVBQWUsT0FBTztBQUFBLFVBQ3ZDLGFBQWEsQ0FBQyxnQkFBZ0IsaUJBQWlCO0FBQUEsUUFDakQ7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLElBQ0EsdUJBQXVCO0FBQUEsSUFDdkIsUUFBUTtBQUFBLElBQ1IsZUFBZTtBQUFBLE1BQ2IsVUFBVTtBQUFBLFFBQ1IsY0FBYztBQUFBLFFBQ2QsZUFBZTtBQUFBLE1BQ2pCO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxFQUNUO0FBQUEsRUFDQSxjQUFjO0FBQUEsSUFDWixTQUFTLENBQUMsU0FBUyxhQUFhLG9CQUFvQixhQUFhO0FBQUEsRUFDbkU7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
