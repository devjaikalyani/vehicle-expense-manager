@echo off
title Vehicle Expense Manager
echo =============================================
echo  Vehicle Expense Manager — Dev Mode
echo =============================================
echo.

if not exist "server\.env" (
  copy "server\.env.example" "server\.env" > nul
  echo [SETUP] Created server\.env — edit it with your credentials before continuing.
  echo.
  pause
)

echo [1/3] Starting backend server...
start "VEM Backend" cmd /k "cd /d "%~dp0server" && npm install && npm run dev"

timeout /t 4 /nobreak > nul

echo [2/3] Starting admin frontend...
start "VEM Admin" cmd /k "cd /d "%~dp0client-admin" && npm install && npm run dev"

timeout /t 2 /nobreak > nul

echo [3/3] Starting mobile PWA...
start "VEM Mobile" cmd /k "cd /d "%~dp0client-mobile" && npm install && npm run dev"

echo.
echo All servers starting in new windows.
echo   Backend : http://localhost:3001
echo   Admin   : http://localhost:5174
echo   Mobile  : http://localhost:5174  (uses /m/ base path via proxy)
echo.
echo For production, build first:
echo   npm run build --prefix client-admin
echo   npm run build --prefix client-mobile
echo   (mobile build outputs to server/mobile-dist automatically)
echo.
pause
