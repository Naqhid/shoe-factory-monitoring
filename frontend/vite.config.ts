import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const certPath = path.resolve(__dirname, 'cert')
const keyFile = path.join(certPath, 'key.pem')
const certFile = path.join(certPath, 'cert.pem')

// Check if certificates exist
const useHttps = fs.existsSync(keyFile) && fs.existsSync(certFile)

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    port: 3000,
    host: '0.0.0.0',
    https: useHttps ? {
      key: fs.readFileSync(keyFile),
      cert: fs.readFileSync(certFile),
    } : undefined,
  },
})