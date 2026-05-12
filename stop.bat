@echo off
title Pharma LIMS — Stop Services
echo.
echo  =====================================================
echo   Pharma LIMS  ^|  Stop All Services
echo  =====================================================
echo.

:: Kill dotnet processes running the LIMS API on port 5000
echo Stopping backend API (dotnet on port 5000)...
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":5000 "') do (
    if not "%%p"=="" (
        taskkill /PID %%p /F >nul 2>&1
        echo   Killed PID %%p (port 5000)
    )
)

:: Kill Vite / Node processes on port 5173
echo Stopping frontend dev server (Node on port 5173)...
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":5173 "') do (
    if not "%%p"=="" (
        taskkill /PID %%p /F >nul 2>&1
        echo   Killed PID %%p (port 5173)
    )
)

echo.
echo  All Pharma LIMS services stopped.
echo.
pause
