@echo off
chcp 65001 >nul
title BridgeMind Studio - Multi-Terminal & Multi-Agent AI
cls

echo =====================================================================
echo   🚀  BridgeMind Studio - Multi-Terminal & Multi-Agent AI Cockpit
echo   🔑  1-Click Browser Authentication (OpenCode Engine)
echo   💻  Concurrent Terminal Sessions & Live Webview Preview
echo =====================================================================
echo.

:: Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found in PATH!
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

:: Ensure dist files exist, build if needed
if not exist "packages\studio\dist\index.js" (
    echo [*] First time setup: Building packages...
    call npm run build
)

echo [*] Starting BridgeMind Studio Server on port 3888...
echo [*] Web UI & Multi-Terminal WebSocket: http://localhost:3888
echo.

:: Launch browser after 2 seconds in background
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3888"

:: Start the Studio Server
node packages\studio\dist\index.js

pause
