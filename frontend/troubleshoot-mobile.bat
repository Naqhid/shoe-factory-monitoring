@echo off
echo Frontend Server Troubleshooting...
echo.

echo 1. Checking if port 3000 is in use...
netstat -an | findstr :3000
echo.

echo 2. Checking Windows Firewall rules for port 3000...
netsh advfirewall firewall show rule name="Node.js Server Port 3000" >nul 2>&1
if %errorlevel% equ 0 (
    echo Firewall rule exists for port 3000
) else (
    echo Creating firewall rule for port 3000...
    netsh advfirewall firewall add rule name="Node.js Server Port 3000" dir=in action=allow protocol=TCP localport=3000
    echo Firewall rule created
)
echo.

echo 3. Your network IP addresses:
ipconfig | findstr "IPv4"
echo.

echo 4. Testing local server access...
curl -k https://localhost:3000 >nul 2>&1
if %errorlevel% equ 0 (
    echo Local HTTPS access: OK
) else (
    echo Local HTTPS access: FAILED
)

curl -k https://192.168.1.26:3000 >nul 2>&1
if %errorlevel% equ 0 (
    echo Network HTTPS access: OK
) else (
    echo Network HTTPS access: FAILED
)
echo.

echo 5. Mobile access URL: https://192.168.1.26:3000
echo.
pause