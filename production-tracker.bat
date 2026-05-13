@echo off

:: Node/NPM paths
SET NPM="C:\Program Files\nodejs\npm.cmd"

:: Start Frontend
cd /d "D:\Software Projects\shoe-factory-monitoring\frontend"
start "Frontend" %NPM% run dev

:: Start Backend
cd /d "D:\Software Projects\shoe-factory-monitoring\backend"
start "Backend" %NPM% start