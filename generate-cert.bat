@echo off
cd frontend\cert
openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -days 3650 -subj "/CN=192.168.1.25"
echo Certificate generated successfully!
pause