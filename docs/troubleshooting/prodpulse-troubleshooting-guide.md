# PRODPULSE TROUBLESHOOTING GUIDE

## Issue: Application Not Accessible from Wi-Fi Devices After Server Restart

### Symptoms

* ProdPulse works on the server PC.
* Mobile phones cannot access http://192.168.5.47:3000.
* Wi-Fi laptops cannot access http://192.168.5.47:3000.
* Ping to 192.168.5.47 fails from other devices.
* Vite application is running normally on the server.

### Root Cause

After a Windows Update, the server automatically restarted.

During the restart, Windows changed the Ethernet network profile from:

Private → Public

When the network profile became Public, incoming connections from other devices were blocked.

### How to Verify

#### 1. Check Last Boot Time

Open Command Prompt:

```cmd
systeminfo | find "Boot Time"
```

#### 2. Check Network Profile

Open PowerShell:

```powershell
Get-NetConnectionProfile
```

If you see:

```text
NetworkCategory : Public
```

then this is likely the issue.

### Resolution

Open PowerShell as Administrator and run:

```powershell
Set-NetConnectionProfile -InterfaceIndex 7 -NetworkCategory Private
```

> **Note:** Replace `7` with the `InterfaceIndex` shown for your active Ethernet/Wi-Fi adapter in `Get-NetConnectionProfile`.

Verify:

```powershell
Get-NetConnectionProfile
```

Expected output:

```text
NetworkCategory : Private
```

### Validation Steps

From another laptop connected to Wi-Fi:

```cmd
ping 192.168.5.47
```

Expected:

```text
Reply from 192.168.5.47
```

Open browser:

```text
http://192.168.5.47:3000
```

Expected:

```text
ProdPulse Login Page Opens
```

### Additional Checks

Verify application is running:

```cmd
netstat -ano | findstr :3000
```

Expected:

```text
0.0.0.0:3000 LISTENING
```

Verify application locally:

```cmd
curl http://localhost:3000
```

### Root Cause Analysis (11-Jun-2026 Incident)

* Server automatically restarted at 9:40 AM.
* Restart initiated by Windows Update (TrustedInstaller.exe).
* Network profile changed from Private to Public.
* Wi-Fi devices lost access to the application.
* Network profile changed back to Private.
* Application access restored successfully.

### Future Action

Whenever users report that ProdPulse is accessible on the server but not from Wi-Fi devices:

1. Check if the server recently restarted.
2. Run Get-NetConnectionProfile.
3. If NetworkCategory = Public, change it to Private.
4. Verify connectivity from another device.

This should be the first troubleshooting step before investigating the application itself.
