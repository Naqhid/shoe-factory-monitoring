@echo off
REM =============================================================================
REM Run this CMD file ON the MySQL SERVER (192.168.5.47), not on your dev laptop.
REM It calls mysql.exe on localhost and grants your app user for DESKTOP-SHANKV7.
REM Requires: backend\.env present (same folder layout: backend\scripts\ this file)
REM =============================================================================
cd /d "%~dp0.."
echo.
echo If you see "mysql.exe not found", install MySQL Server on this PC or fix PATH.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0do-grant-on-mysql-server.ps1" %*
if errorlevel 1 exit /b 1
echo.
pause
