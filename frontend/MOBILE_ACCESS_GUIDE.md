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

## Test URLs:
- HTTPS: https://192.168.1.26:3000
- HTTP: http://192.168.1.26:3000
- Local: https://localhost:3000