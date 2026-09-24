@echo off
title ProofEngine Launcher
echo ============================================================
echo   Starting ProofEngine Dashboard ^& API Services...
echo ============================================================

cd /d "%~dp0"

echo [1/3] Checking dependencies...
if not exist "dashboard\node_modules\" (
    echo Installing dashboard dependencies...
    cd dashboard
    call npm install
    cd ..
)

echo [2/3] Starting ProofEngine Backend API (Port 8081)...
start "ProofEngine Backend" cmd /k "title ProofEngine Backend && python server.py"

ping 127.0.0.1 -n 3 >nul

echo [3/3] Starting ProofEngine Dashboard (Port 5175)...
start "ProofEngine Dashboard" cmd /k "title ProofEngine Dashboard && cd dashboard && npm run dev"

ping 127.0.0.1 -n 4 >nul

echo.
echo ============================================================
echo   ProofEngine Services Running!
echo   - Dashboard:   http://localhost:5175
echo   - Backend API: http://localhost:8081
echo   - Swagger API: http://localhost:8081/docs
echo ============================================================
echo.
echo Opening browser...
start http://localhost:5175

exit /b 0
