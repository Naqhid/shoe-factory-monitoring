@echo off
echo ========================================
echo   HTTPS Setup for Camera Access
echo ========================================
echo.

cd frontend

echo Step 1: Generating SSL Certificate...
echo.
npm run generate-cert

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Certificate generation failed!
    echo.
    echo Please install OpenSSL or use Git Bash:
    echo   1. Open Git Bash
    echo   2. Run: cd /h/Florence-IOT/shoe-factory-monitoring/frontend
    echo   3. Run: npm run generate-cert
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo Next Steps:
echo   1. Copy frontend\cert\cert.pem to mobile devices
echo   2. Install certificate on each device
echo   3. Run: npm run dev
echo   4. Access: https://192.168.1.11:3000
echo.
echo See HTTPS_SETUP.md for detailed instructions
echo.
pause
