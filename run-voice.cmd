@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title SuperAi Voice ^& RAKKYXD
if not exist "node_modules\electron" (
  call npm install
  if errorlevel 1 exit /b 1
)
call npm run voice
if errorlevel 1 pause
