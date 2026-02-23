# Camera Scanner Setup Guide for HTTP Access

## Problem
Camera access requires HTTPS, but the app runs on HTTP (`http://192.168.1.11:3000`) in local network.

## Solution for Production Deployment

### Method 1: Chrome Flag Configuration (EASIEST)

Configure Chrome on all mobile devices to trust your server:

1. **On each mobile device**, open Chrome browser
2. Navigate to: `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
3. In the text field, add: `http://192.168.1.11:3000`
4. Set dropdown to **"Enabled"**
5. Click **"Relaunch"** button at bottom
6. Camera will now work on `http://192.168.1.11:3000`

**Note**: Replace `192.168.1.11` with your actual server IP if different.

---

### Method 2: Self-Signed HTTPS (RECOMMENDED)

Enable HTTPS with self-signed certificate for better security:

#### Step 1: Install mkcert (One-time setup on Windows Server)

```bash
# Download mkcert for Windows
# Visit: https://github.com/FiloSottile/mkcert/releases
# Download: mkcert-v1.4.4-windows-amd64.exe
# Rename to: mkcert.exe

# Install local CA
mkcert -install

# Generate certificate for your server IP
mkcert 192.168.1.11 localhost 127.0.0.1
```

This creates:
- `192.168.1.11+2.pem` (certificate)
- `192.168.1.11+2-key.pem` (private key)

#### Step 2: Update Vite Config

Move certificate files to `frontend/` folder, then update `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    port: 3000,
    host: '0.0.0.0',
    https: {
      key: fs.readFileSync('./192.168.1.11+2-key.pem'),
      cert: fs.readFileSync('./192.168.1.11+2.pem'),
    },
  },
})
```

#### Step 3: Install Root CA on Mobile Devices

1. Copy `rootCA.pem` from `C:\Users\[YourUser]\AppData\Local\mkcert\` to mobile devices
2. On Android: Settings → Security → Install from storage → Select rootCA.pem
3. On iOS: AirDrop file → Install Profile → Settings → General → About → Certificate Trust Settings

#### Step 4: Access via HTTPS

Access app at: `https://192.168.1.11:3000`

---

## Quick Comparison

| Method | Setup Time | Security | Maintenance |
|--------|------------|----------|-------------|
| Chrome Flag | 2 min/device | Low | None |
| Self-Signed HTTPS | 30 min once | Medium | None |

## Recommendation

- **For quick testing**: Use Chrome Flag method
- **For production**: Use Self-Signed HTTPS method

Both methods work reliably in local network environments.
