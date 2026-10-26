# Stop processes listening on port 3000 (stale RawMarkets / Vite) so a fresh npm run dev can bind.
$port = 3000
$conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if (-not $conns) { exit 0 }
$pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($procId in $pids) {
  try {
    $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if ($proc) {
      Write-Host "[RawMarkets] Stopping PID $procId ($($proc.ProcessName)) on port $port"
      Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
  } catch {}
}
Start-Sleep -Seconds 1
