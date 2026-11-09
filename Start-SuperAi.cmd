@echo off
chcp 65001 >nul
cd /d "%~dp0"
title "SuperAi & RAKKYXD"

if exist "%USERPROFILE%\.opencode-multi\node-v22\node.exe" (
    set "PATH=%USERPROFILE%\.opencode-multi\node-v22;%PATH%"
)

if exist "scripts\brand-dev-electron.mjs" node scripts\brand-dev-electron.mjs >nul 2>nul

echo Starting SuperAi ^& RAKKYXD Desktop...
call npm start
if errorlevel 1 pause