@echo off
setlocal
cd /d "%~dp0frontend"

echo ==========================================
echo   SoilSense Admin Web - Production Check
echo ==========================================
echo.

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
    echo npm install failed.
    pause
    exit /b 1
  )
)

call npm run build
if errorlevel 1 (
  echo Build failed. Review the error above.
  pause
  exit /b 1
)

start "" "http://localhost:4173/"
call npm run preview
