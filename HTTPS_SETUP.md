# 🔐 HTTPS Setup Guide for Camera Access

## Quick Setup (5 minutes)

### Step 1: Generate SSL Certificate (On Windows Server)

```bash
cd frontend
npm run generate-cert
```

This creates `cert/cert.pem` and `cert/key.pem` files.

### Step 2: Start HTTPS Server

```bash
npm run dev
```

Server will run on: **https://192.168.1.11:3000**

### Step 3: Install Certificate on Mobile Devices

#### For Android:
1. Copy `frontend/cert/cert.pem` to mobile device (via USB, email, or network share)
2. Open **Settings** → **Security** → **Encryption & credentials**
3. Tap **Install a certificate** → **CA certificate**
4. Select the `cert.pem` file
5. Name it "Factory Server" and tap OK

#### For iOS:
1. AirDrop or email `cert.pem` to iPhone/iPad
2. Tap the file to install profile
3. Go to **Settings** → **General** → **VPN & Device Management**
4. Tap the profile and install it
5. Go to **Settings** → **General** → **About** → **Certificate Trust Settings**
6. Enable trust for the certificate

### Step 4: Access App

Open Chrome/Safari on mobile: **https://192.168.1.11:3000**

Camera will now work! 📸

---

## Troubleshooting

### "OpenSSL not found" error
- **Option 1**: Use Git Bash (includes OpenSSL)
  ```bash
  # Open Git Bash and run:
  cd /h/Florence-IOT/shoe-factory-monitoring/frontend
  npm run generate-cert
  ```

- **Option 2**: Install OpenSSL for Windows
  - Download: https://slproweb.com/products/Win32OpenSSL.html
  - Install "Win64 OpenSSL v3.x.x Light"
  - Add to PATH: `C:\Program Files\OpenSSL-Win64\bin`

### "Certificate not trusted" warning in browser
- Click "Advanced" → "Proceed to 192.168.1.11 (unsafe)"
- This is normal for self-signed certificates
- Or install certificate on device (see Step 3)

### Camera still not working
1. Verify HTTPS is active (check for 🔒 in address bar)
2. Check certificate is installed on mobile device
3. Clear browser cache and reload
4. Try in incognito/private mode

---

## Alternative: HTTP with Chrome Flag (Not Recommended)

If HTTPS setup fails, configure each mobile device:

1. Open Chrome: `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
2. Add: `http://192.168.1.11:3000`
3. Enable and restart Chrome

---

## Production Deployment

For permanent deployment, keep certificates in `frontend/cert/` folder:
- `cert/key.pem` (private key)
- `cert/cert.pem` (certificate)

Valid for 365 days. Regenerate annually with `npm run generate-cert`.

---

## Security Notes

- Self-signed certificates are safe for internal networks
- Certificate is valid for 192.168.1.11, localhost, and 127.0.0.1
- Private key stays on server, only share cert.pem with devices
- Certificates expire after 1 year
