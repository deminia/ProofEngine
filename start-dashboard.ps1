param()

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
$dashboard = Join-Path $root "dashboard"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Starting ProofEngine Dashboard & API Services..." -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Check node_modules
if (-not (Test-Path (Join-Path $dashboard "node_modules"))) {
    Write-Host "[1/3] Installing dashboard dependencies..." -ForegroundColor Yellow
    Push-Location $dashboard
    npm install
    Pop-Location
} else {
    Write-Host "[1/3] Dashboard dependencies OK" -ForegroundColor Green
}

function Start-InWindow {
    param([string]$Title, [string]$WorkDir, [string]$Cmd)
    $ps = "`$Host.UI.RawUI.WindowTitle = '$Title'; cd '$WorkDir'; $Cmd"
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", $ps
}

# 2. Start Backend API
Write-Host "[2/3] Starting ProofEngine Backend API (Port 8081)..." -ForegroundColor Cyan
Start-InWindow -Title "ProofEngine Backend" -WorkDir $root -Cmd "python server.py"
Start-Sleep -Seconds 2

# 3. Start Dashboard
Write-Host "[3/3] Starting ProofEngine Dashboard (Port 5175)..." -ForegroundColor Cyan
Start-InWindow -Title "ProofEngine Dashboard" -WorkDir $dashboard -Cmd "npm run dev"
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  ProofEngine Services Running!" -ForegroundColor Green
Write-Host "  - Dashboard:   http://localhost:5175" -ForegroundColor White
Write-Host "  - Backend API: http://localhost:8081" -ForegroundColor White
Write-Host "  - Swagger API: http://localhost:8081/docs" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Stop all services: .\stop-dashboard.ps1" -ForegroundColor Gray

Start-Process "http://localhost:5175"
