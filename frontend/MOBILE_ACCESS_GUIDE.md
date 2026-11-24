# Mobile HTTPS Access Guide

## Quick Fix Steps:

### 1. Generate Better Certificate:
```bash
cd frontend/cert
generate-mobile-cert.bat
```

### 2. Start Server:
```bash
cd frontend
npm run dev
```

### 3. Mobile Browser Setup:

#### Android Chrome:
1. Go to `https://192.168.1.26:3000`
2. You'll see "Your connection is not private"
3. Click **"Advanced"**
4. Click **"Proceed to 192.168.1.26 (unsafe)"**
5. Site loads, camera works!

#### iPhone Safari:
1. Go to `https://192.168.1.26:3000`
2. You'll see "This Connection Is Not Private"
3. Click **"Show Details"**
4. Click **"visit this website"**
5. Click **"Visit Website"** again
6. Site loads, camera works!

#### Alternative - Install Certificate:
1. Download cert.pem to phone
2. Android: Settings > Security > Install from storage
3. iOS: Settings > General > About > Certificate Trust Settings

## If Still Not Working:

### Try HTTP with Manual Entry:
1. Rename cert files: `cert.pem` → `cert.pem.disabled`
2. Server will run on HTTP
3. Use manual input instead of QR scanner
4. Go to `http://192.168.1.26:3000`

### Network Issues:
- Check Windows Firewall (port 3000)
- Ensure both devices on same WiFi
- Try laptop IP: `ipconfig` to confirm 192.168.1.26

## Wi‑Fi without internet — Chrome says "No internet connection"

The app does **not** need the public internet on factory LAN. That message is almost always **the phone cannot reach your PC** (or Chrome blocked the page), not ProdPulse requiring Google.

### 1. Same network (most common)

- Phone and PC must be on the **same** Wi‑Fi (same SSID).
- "Wi‑Fi with internet" and "Wi‑Fi without internet" are often **different networks** — `192.168.5.47` only exists on the factory LAN.
- On the phone, when Android shows **"Connected, no internet"**, tap it and choose **stay connected / use this network** (do not disconnect).

### 2. Windows Firewall (very common on "no internet" Wi‑Fi)

Windows may mark a network as **Public** and block inbound connections to port 3002/3101.

1. Settings → Network → your factory Wi‑Fi → **Private network**
2. Windows Defender Firewall → **Allow an app** → allow Node.js, or add inbound rules for **TCP 3002** and your **backend port** (e.g. 3101)

### 3. Prefer one server (backend serves the build)

`vite preview` only serves the UI. For phones, run the **backend** with a built frontend (API + UI on one port):

```bash
cd frontend
npm run build:lan
cd ../backend
# set PORT=3101 for feature branch, then start backend
```

Open `http://<PC-IP>:3101/` (not only 3002). Firewall: allow the **backend** port.

### 4. Disable PWA / clear old service worker

Service workers can confuse Chrome when the OS reports "offline".

```bash
cd frontend
npm run build:lan
```

On the phone: Chrome → site settings for `192.168.x.x` → **Clear data** / **Unregister service worker**, then open a **new tab** with:

`http://192.168.5.47:3002/` (include `http://`, not `https://`)

### 5. Phone settings

- Turn off **"Switch to mobile data"** / smart network switch while testing.
- Private DNS: **Automatic** (not strict-only hostnames).
- Do not use a VPN during LAN tests.

### Quick test

On the no-internet Wi‑Fi, if this fails, the problem is LAN/firewall, not the app build:

`http://192.168.5.47:3002/` (or your backend port)

## Test URLs:
- HTTPS: https://192.168.1.26:3000
- HTTP: http://192.168.1.26:3000
- Local: https://localhost:3000