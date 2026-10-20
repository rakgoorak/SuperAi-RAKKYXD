@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title SuperAi ^& RAKKYXD
where node >nul 2>nul
if errorlevel 1 (
  echo กรุณาติดตั้ง Node.js 22 ขึ้นไปก่อนเปิดโปรแกรม
  pause
  exit /b 1
)
if not exist "node_modules\electron" (
  call npm install
  if errorlevel 1 exit /b 1
)
echo กำลังเตรียม SuperAi ^& RAKKYXD...
set taskNeedsBuild=
if "%1"=="--build" set taskNeedsBuild=1
if not exist "packages\core\dist\index.js" set taskNeedsBuild=1
if not exist "packages\studio\dist\StudioServer.js" set taskNeedsBuild=1
if not exist "packages\studio\client\dist\index.html" set taskNeedsBuild=1
if defined taskNeedsBuild (
  call npm run build
  if errorlevel 1 (
    echo สร้างโปรแกรมไม่สำเร็จ กรุณาตรวจข้อความด้านบน
    pause
    exit /b 1
  )
)
call npm start
if errorlevel 1 pause
