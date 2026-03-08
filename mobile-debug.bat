@echo off
echo ========================================
echo MOBILE ACCESS TROUBLESHOOTING
echo ========================================
echo.

echo 1. CHECKING NETWORK CONFIGURATION...
echo Current IP addresses:
ipconfig | findstr "IPv4"
echo.

echo 2. CHECKING IF FRONTEND SERVER IS RUNNING...
netstat -an | findstr :3000
if %errorlevel% equ 0 (
    echo ✓ Frontend server is running on port 3000
) else (
    echo ✗ Frontend server is NOT running on port 3000
    echo Please start with: npm run dev
    pause
    exit
)
echo.

echo 3. CHECKING WINDOWS FIREWALL...
netsh advfirewall firewall show rule name="Node.js Port 3000" >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Firewall rule exists for port 3000
) else (
    echo Creating firewall rule for port 3000...
    netsh advfirewall firewall add rule name="Node.js Port 3000" dir=in action=allow protocol=TCP localport=3000
    echo ✓ Firewall rule created
)
echo.

echo 4. TESTING LOCAL ACCESS...
curl -s -o nul -w "%%{http_code}" http://localhost:3000 > temp_status.txt
set /p status=<temp_status.txt
del temp_status.txt
if "%status%"=="200" (
    echo ✓ Local access works (HTTP 200)
) else (
    echo ✗ Local access failed (HTTP %status%)
)
echo.

echo 5. TESTING NETWORK ACCESS...
curl -s -o nul -w "%%{http_code}" http://192.168.1.26:3000 > temp_status.txt
set /p status=<temp_status.txt
del temp_status.txt
if "%status%"=="200" (
    echo ✓ Network access works (HTTP 200)
) else (
    echo ✗ Network access failed (HTTP %status%)
)
echo.

echo 6. MOBILE SETUP CHECKLIST:
echo ========================================
echo Mobile Device Setup:
echo 1. Connect to SAME WiFi network
echo 2. Open Chrome browser
echo 3. Go to: chrome://flags/
echo 4. Search: unsafely-treat-insecure-origin-as-secure
echo 5. Enable it
echo 6. Add: http://192.168.1.26:3000
echo 7. Click "Relaunch" button
echo 8. Go to: http://192.168.1.26:3000
echo.

echo Alternative URLs to try:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do echo http://%%b:3000
)
echo.

echo 7. QUICK FIXES:
echo ========================================
echo If still not working:
echo.
echo Option A - Restart Services:
echo   1. Stop frontend (Ctrl+C)
echo   2. Run: npm run dev
echo   3. Try mobile again
echo.
echo Option B - Check Mobile WiFi:
echo   1. Disconnect/reconnect WiFi
echo   2. Ensure same network as laptop
echo   3. Try again
echo.
echo Option C - Use Mobile Hotspot:
echo   1. Enable mobile hotspot
echo   2. Connect laptop to mobile hotspot
echo   3. Check laptop IP: ipconfig
echo   4. Use new IP on mobile
echo.

pause