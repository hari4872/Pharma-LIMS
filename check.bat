@echo off
title Pharma LIMS — System Check
echo.
echo  =====================================================
echo   Pharma LIMS  ^|  Pre-flight System Check
echo  =====================================================
echo.

set PASS=0
set FAIL=0

:: ── .NET SDK ──────────────────────────────────────────────────────────────────
where dotnet >nul 2>&1
if errorlevel 1 (
    echo [FAIL] .NET SDK         : NOT FOUND
    echo        Install from https://dotnet.microsoft.com/download ^(8.0 or later^)
    set /a FAIL+=1
) else (
    for /f "tokens=*" %%v in ('dotnet --version 2^>nul') do set DV=%%v
    echo [OK]   .NET SDK         : !DV!
    set /a PASS+=1
)

:: ── Node.js ───────────────────────────────────────────────────────────────────
where node >nul 2>&1
if errorlevel 1 (
    echo [FAIL] Node.js          : NOT FOUND
    echo        Install from https://nodejs.org/ ^(v18 or later^)
    set /a FAIL+=1
) else (
    for /f "tokens=*" %%v in ('node --version 2^>nul') do set NV=%%v
    echo [OK]   Node.js          : !NV!
    set /a PASS+=1
)

:: ── npm ───────────────────────────────────────────────────────────────────────
where npm >nul 2>&1
if errorlevel 1 (
    echo [FAIL] npm              : NOT FOUND
    set /a FAIL+=1
) else (
    for /f "tokens=*" %%v in ('npm --version 2^>nul') do set NPMV=%%v
    echo [OK]   npm              : !NPMV!
    set /a PASS+=1
)

:: ── Backend project ───────────────────────────────────────────────────────────
if exist "%~dp0backend\src\LIMS.API\LIMS.API.csproj" (
    echo [OK]   Backend project  : Found
    set /a PASS+=1
) else (
    echo [FAIL] Backend project  : D:\Pharma-LIMS\backend\src\LIMS.API\LIMS.API.csproj NOT FOUND
    set /a FAIL+=1
)

:: ── Frontend project ──────────────────────────────────────────────────────────
if exist "%~dp0frontend\package.json" (
    echo [OK]   Frontend project : Found
    set /a PASS+=1
) else (
    echo [FAIL] Frontend project : D:\Pharma-LIMS\frontend\package.json NOT FOUND
    set /a FAIL+=1
)

:: ── node_modules ──────────────────────────────────────────────────────────────
if exist "%~dp0frontend\node_modules\" (
    echo [OK]   node_modules     : Present
    set /a PASS+=1
) else (
    echo [WARN] node_modules     : Missing — start.bat will run npm install automatically
)

:: ── appsettings (DB connection string) ───────────────────────────────────────
if exist "%~dp0backend\src\LIMS.API\appsettings.json" (
    echo [OK]   appsettings.json : Found
    set /a PASS+=1
) else (
    echo [FAIL] appsettings.json : NOT FOUND — database connection string missing
    set /a FAIL+=1
)

:: ── Port availability ─────────────────────────────────────────────────────────
netstat -aon | findstr ":5000 " >nul 2>&1
if not errorlevel 1 (
    echo [WARN] Port 5000        : ALREADY IN USE — backend may fail to start
    echo        Run stop.bat first or kill the process using port 5000
) else (
    echo [OK]   Port 5000        : Available  ^(backend API^)
    set /a PASS+=1
)

netstat -aon | findstr ":5173 " >nul 2>&1
if not errorlevel 1 (
    echo [WARN] Port 5173        : ALREADY IN USE — frontend may fail to start
    echo        Run stop.bat first or kill the process using port 5173
) else (
    echo [OK]   Port 5173        : Available  ^(frontend dev server^)
    set /a PASS+=1
)

:: ── Summary ───────────────────────────────────────────────────────────────────
echo.
echo  ─────────────────────────────────────────────────────
echo   Result: !PASS! checks passed, !FAIL! checks failed
if !FAIL! gtr 0 (
    echo   [!] Fix the FAIL items above before running start.bat
) else (
    echo   [✓] System ready — run start.bat to launch Pharma LIMS
)
echo  ─────────────────────────────────────────────────────
echo.
pause
