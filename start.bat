@echo off
setlocal EnableDelayedExpansion
title Pharma LIMS — Launcher

set ROOT=%~dp0
set BACKEND=%ROOT%backend\src\LIMS.API
set FRONTEND=%ROOT%frontend
set SSH_HOST=root@52.230.33.120
set TUNNEL_PORT=5433

echo.
echo  =====================================================
echo   Pharma LIMS  ^|  Local Development Launcher
echo  =====================================================
echo.

:: ── 0. SSH Tunnel to Production DB ───────────────────────────────────────────

echo [0/5] Opening SSH tunnel to production DB (localhost:%TUNNEL_PORT% -^> server:5432)...
echo       Server : %SSH_HOST%
echo       Password when prompted: limslite
echo.
start "Pharma LIMS — SSH Tunnel (KEEP OPEN)" cmd /k "title SSH Tunnel - KEEP THIS OPEN && ssh -L %TUNNEL_PORT%:localhost:5432 %SSH_HOST%"

echo       Waiting 8 seconds for SSH tunnel to connect...
timeout /t 8 /nobreak >nul
echo       SSH tunnel should be active. If prompted for password in the other window, enter it now.
echo       Press any key here AFTER entering the SSH password and seeing the server prompt...
pause >nul
echo.

:: ── 1. Pre-flight checks ─────────────────────────────────────────────────────

echo [1/5] Checking prerequisites...

where dotnet >nul 2>&1
if errorlevel 1 (
    echo [ERROR] .NET SDK not found. Install from https://dotnet.microsoft.com/download
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('dotnet --version 2^>nul') do set DOTNET_VER=%%v
echo       .NET SDK : %DOTNET_VER%

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org/
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('node --version 2^>nul') do set NODE_VER=%%v
echo       Node.js  : %NODE_VER%

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm not found. Reinstall Node.js from https://nodejs.org/
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('npm --version 2^>nul') do set NPM_VER=%%v
echo       npm      : %NPM_VER%

echo.

:: ── 2. Restore + pre-build backend ───────────────────────────────────────────

echo [2/5] Restoring and building backend...
cd /d "%ROOT%backend"
dotnet restore --nologo -v quiet
if errorlevel 1 (
    echo [ERROR] dotnet restore failed. Check your internet connection.
    pause & exit /b 1
)
dotnet build src\LIMS.API\LIMS.API.csproj -c Debug --no-restore --nologo -v quiet
if errorlevel 1 (
    echo [ERROR] Build failed. Check the errors above.
    pause & exit /b 1
)
echo       Backend build OK.
echo.

:: ── 3. Install frontend npm packages if node_modules is missing ───────────────

echo [3/5] Checking frontend dependencies...
if not exist "%FRONTEND%\node_modules\" (
    echo       node_modules not found — running npm install...
    cd /d "%FRONTEND%"
    npm install --silent
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause & exit /b 1
    )
    echo       npm install complete.
) else (
    echo       node_modules present — skipping install.
)
echo.

:: ── 4. Start backend in a new window ─────────────────────────────────────────

echo [4/5] Starting backend API  (http://localhost:5204)...
echo       DB via SSH tunnel on localhost:%TUNNEL_PORT%
echo.

start "Pharma LIMS — Backend API" cmd /k "title Pharma LIMS - Backend API && cd /d "%BACKEND%" && echo Starting .NET API on http://localhost:5204... && dotnet run --no-build --no-restore --urls http://localhost:5204"

timeout /t 5 /nobreak >nul

:: ── 5. Start frontend in a new window ────────────────────────────────────────

echo [5/5] Starting frontend dev server  (http://localhost:5173)...
echo.

start "Pharma LIMS — Frontend" cmd /k "title Pharma LIMS - Frontend && cd /d "%FRONTEND%" && echo Starting Vite dev server on http://localhost:5173... && npm run dev"

timeout /t 6 /nobreak >nul

:: ── Open browser ─────────────────────────────────────────────────────────────

echo.
echo  =====================================================
echo   All services started.
echo.
echo   Frontend  :  http://localhost:5173
echo   Backend   :  http://localhost:5204
echo   Swagger   :  http://localhost:5204/swagger
echo.
echo   Database  :  Production DB via SSH tunnel :%TUNNEL_PORT%
echo   Login     :  admin / Admin@123
echo.
echo   IMPORTANT: Keep the SSH Tunnel window open!
echo  =====================================================
echo.

start "" "http://localhost:5173"

echo  Press any key to close this launcher window.
echo  (Backend, Frontend and SSH Tunnel windows will keep running.)
echo.
pause >nul
endlocal
