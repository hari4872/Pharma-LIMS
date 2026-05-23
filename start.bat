@echo off
setlocal EnableDelayedExpansion
title Pharma LIMS — Launcher

echo.
echo  =====================================================
echo   Pharma LIMS  ^|  Local Development Launcher
echo  =====================================================
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

:: ── 2. Restore backend NuGet packages if needed ──────────────────────────────

echo [2/5] Restoring backend packages...
cd /d "%~dp0backend"
dotnet restore --nologo -v quiet
if errorlevel 1 (
    echo [ERROR] dotnet restore failed. Check your internet connection.
    pause & exit /b 1
)
echo       Backend packages OK.
echo.

:: ── 3. Install frontend npm packages if node_modules is missing ───────────────

echo [3/5] Checking frontend dependencies...
cd /d "%~dp0frontend"
if not exist "node_modules\" (
    echo       node_modules not found — running npm install...
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
echo       Swagger UI will be at: http://localhost:5204/swagger
echo.

start "Pharma LIMS — Backend API" cmd /k ^
  "title Pharma LIMS — Backend API && ^
   cd /d "%~dp0backend\src\LIMS.API" && ^
   echo Starting .NET API on http://localhost:5204 ... && ^
   echo (EF migrations are applied automatically on startup) && ^
   echo. && ^
   dotnet run --no-restore --urls http://localhost:5204"

:: Give the backend a few seconds to start before launching frontend
timeout /t 4 /nobreak >nul

:: ── 5. Start frontend in a new window ────────────────────────────────────────

echo [5/5] Starting frontend dev server  (http://localhost:5173)...
echo.

start "Pharma LIMS — Frontend" cmd /k ^
  "title Pharma LIMS — Frontend && ^
   cd /d "%~dp0frontend" && ^
   echo Starting Vite dev server on http://localhost:5173 ... && ^
   echo (API calls proxied to http://localhost:5204) && ^
   echo. && ^
   npm run dev"

:: Give Vite a moment to spin up
timeout /t 5 /nobreak >nul

:: ── Open browser ─────────────────────────────────────────────────────────────

echo.
echo  =====================================================
echo   Both services started in separate windows.
echo.
echo   Frontend  :  http://localhost:5173
echo   Backend   :  http://localhost:5204
echo   Swagger   :  http://localhost:5204/swagger
echo   SignalR   :  ws://localhost:5204/hubs/lims
echo.
echo   Database  :  Neon PostgreSQL 16 (cloud)
echo   First run :  Visit http://localhost:5173/setup
echo                to create the Tenant Admin account.
echo  =====================================================
echo.

start "" "http://localhost:5173"

echo  Press any key to close this launcher window.
echo  (The backend and frontend windows will keep running.)
echo.
pause >nul
endlocal
