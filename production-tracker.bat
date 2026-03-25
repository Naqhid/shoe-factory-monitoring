@echo off
:: Use full paths to avoid "command not found" in background
SET NODE="C:\Program Files\nodejs\node.exe"
SET NPM="C:\Program Files\nodejs\npm.cmd"

:: Start Frontend
cd /d "C:\Software\shoe-factory-monitoring\frontend"
start "" %NPM% run dev

:: Start Backend
cd /d "C:\Software\shoe-factory-monitoring\backend"
start "" %NPM% start
