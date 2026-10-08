@echo off
setlocal
cd /d "%~dp0frontend"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js and try again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing frontend packages for first use...
  call npm install
  if errorlevel 1 (
    echo npm install failed. Check your internet connection and Node.js installation.
    pause
    exit /b 1
  )
)

call npm run dev
