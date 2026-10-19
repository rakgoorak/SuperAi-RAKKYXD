@echo off
chcp 65001 >nul
title BridgeMind Studio - Desktop App
cls

echo =====================================================================
echo   🚀  BridgeMind Studio - Native Desktop AI Workspace
echo   🔑  1-Click Browser Authentication (OpenCode Engine)
echo   💻  Concurrent Terminal Sessions (PTY) & Live Webview Preview
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
if not exist "packages\studio\dist\StudioServer.js" (
    echo [*] Building studio backend...
    call npm run build
)
if not exist "packages\studio\client\dist\index.html" (
    echo [*] Building studio frontend UI...
    call npm --workspace=@bridgemind/client run build
)

echo [*] Launching BridgeMind Studio Desktop Application...
echo.

:: Launch Electron native desktop window
call npx electron packages\desktop

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] Desktop app exited.
)
