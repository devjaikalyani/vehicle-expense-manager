@echo off
title Vehicle Expense Manager
echo =============================================
echo  Vehicle Expense Manager
echo =============================================
echo.

if not exist "server\.env" (
  copy "server\.env.example" "server\.env" > nul
  echo [SETUP] Created server\.env - please edit it with your DB credentials before continuing.
  echo.
  pause
)

echo Starting backend server...
start "VEM Backend" cmd /k "cd /d "%~dp0server" && npm install && npm run dev"

timeout /t 4 /nobreak > nul

echo Starting frontend...
start "VEM Frontend" cmd /k "cd /d "%~dp0client" && npm install && npm run dev"

echo.
echo Both servers starting in new windows.
echo   Backend : http://localhost:3001
echo   Frontend: http://localhost:5173
echo.
pause
