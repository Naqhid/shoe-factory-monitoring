// Generates PNG PWA icons from public/icon.svg using sharp.
// Run: node scripts/generate-pwa-icons.mjs
import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.resolve(__dirname, '..', 'public')
const svg = path.join(publicDir, 'icon.svg')

const targets = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
]

for (const { name, size } of targets) {
  const out = path.join(publicDir, name)
  await sharp(svg, { density: 512 })
    .resize(size, size, { fit: 'contain', background: { r: 37, g: 99, b: 235, alpha: 1 } })
    .png()
    .toFile(out)
  console.log(`generated ${name} (${size}x${size})`)
}

console.log('Done.')
