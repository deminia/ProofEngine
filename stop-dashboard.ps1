param()

Write-Host "Stopping ProofEngine services..." -ForegroundColor Yellow

$titles = @("ProofEngine Backend", "ProofEngine Dashboard")
foreach ($t in $titles) {
    Get-Process | Where-Object { $_.MainWindowTitle -eq $t } | ForEach-Object {
        Write-Host ("  Closing {0} (PID {1})" -f $t, $_.Id) -ForegroundColor Gray
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
}

$ports = @(5175, 8081)
foreach ($port in $ports) {
    $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
        try {
            Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
            Write-Host ("  Releasing port {0} (PID {1})" -f $port, $c.OwningProcess) -ForegroundColor Gray
        } catch {}
    }
}

Write-Host ""
Write-Host "[OK] All ProofEngine services stopped." -ForegroundColor Green
