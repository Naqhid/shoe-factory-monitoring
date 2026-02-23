# 🚀 Quick Start - HTTPS for Camera Access

## On Windows Server (One-time setup)

```bash
# Option 1: Using Command Prompt
cd h:\Florence-IOT\shoe-factory-monitoring
setup-https.bat

# Option 2: Using Git Bash (if OpenSSL error)
cd /h/Florence-IOT/shoe-factory-monitoring/frontend
npm run generate-cert
```

## Install Certificate on Mobile Devices

### Android
1. Copy `frontend/cert/cert.pem` to phone
2. Settings → Security → Install from storage
3. Select cert.pem → Name it "Factory Server"

### iOS
1. AirDrop cert.pem to iPhone
2. Settings → Profile Downloaded → Install
3. Settings → General → About → Certificate Trust Settings → Enable

## Start Server

```bash
cd frontend
npm run dev
```

Access: **https://192.168.1.11:3000** ✅

---

## Troubleshooting

**OpenSSL not found?**
→ Use Git Bash instead of Command Prompt

**Certificate warning in browser?**
→ Click "Advanced" → "Proceed" (normal for self-signed certs)

**Camera still blocked?**
→ Verify HTTPS (🔒 icon in address bar)
→ Check certificate installed on mobile device

---

For detailed instructions, see: **HTTPS_SETUP.md**
