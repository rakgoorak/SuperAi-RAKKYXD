@echo off
chcp 65001 >nul
title RakkyXD Studio - Desktop App
cls

echo =====================================================================
echo   🚀  RakkyXD Studio - Native Desktop AI Workspace
echo   🎙️  Voice-Controlled Cockpit (Thai / English)
echo   🔑  1-Click Browser Authentication (OpenCode Engine)
echo   💻  6x Concurrent Agent Cockpit (PTY) & Live Webview Preview
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

:: Check if user requested a rebuild
if "%1"=="--build" (
    echo [*] Rebuilding studio server and client...
    call npm --workspace=@bridgemind/studio run build
    call npm --workspace=@bridgemind/client run build
) else (
    :: Ensure dist files exist, build if needed
    if not exist "packages\studio\dist\StudioServer.js" (
        echo [*] Building studio backend...
        call npm --workspace=@bridgemind/studio run build
    )
    if not exist "packages\studio\client\dist\index.html" (
        echo [*] Building studio frontend UI...
        call npm --workspace=@bridgemind/client run build
    )
)

echo [*] Launching RakkyXD Studio Desktop Application...
echo.

:: Launch Electron native desktop window
call npx electron packages\desktop

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] Desktop app exited with code %ERRORLEVEL%.
    pause
)
