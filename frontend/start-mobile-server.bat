@echo off
echo Starting Frontend Server for Mobile Access...
echo.
echo Checking network configuration...
ipconfig | findstr "IPv4"
echo.
echo Starting server on all interfaces (0.0.0.0:3000)...
echo Mobile devices should access: https://192.168.1.26:3000
echo.
npm run dev
pause