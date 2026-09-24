@echo off
title ProofEngine Stopper
echo ============================================================
echo   Stopping ProofEngine Services...
echo ============================================================

echo Closing application windows...
taskkill /fi "WINDOWTITLE eq ProofEngine Backend*" /f /t >nul 2>&1
taskkill /fi "WINDOWTITLE eq ProofEngine Dashboard*" /f /t >nul 2>&1

echo Releasing ports 5175 and 8081...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5175 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8081 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo.
echo ============================================================
echo   [OK] All ProofEngine services stopped successfully.
echo ============================================================
ping 127.0.0.1 -n 2 >nul
exit /b 0
