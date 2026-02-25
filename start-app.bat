@echo off
echo ========================================
echo Shoe Factory Monitoring System
echo ========================================
echo.

echo [1/3] Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js 18+ from https://nodejs.org
    pause
    exit /b 1
)
echo Node.js: OK

echo.
echo [2/3] Starting Backend Server...
cd backend
start "Backend Server" cmd /k "node src/app.js"
timeout /t 3 /nobreak >nul

echo.
echo [3/3] Starting Frontend Dashboard...
cd ..\frontend
start "Frontend Dashboard" cmd /k "npm run dev"

echo.
echo ========================================
echo System Started Successfully!
echo ========================================
echo Backend:  http://localhost:3001
echo Frontend: http://localhost:3000
echo.
echo Press any key to open dashboard in browser...
pause >nul
start http://localhost:3000

echo.
echo To stop the servers, close the terminal windows.
echo.
pause
