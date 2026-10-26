$ErrorActionPreference = "Stop"

Set-Location -Path (Join-Path $PSScriptRoot "..")

Write-Host "[RawMarkets] Stopping packaged app and unlocking release folder..."
node scripts/unlock-release-for-pack.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[RawMarkets] Building Windows portable + installer..."
npm run package:win
if ($LASTEXITCODE -ne 0) {
  throw "package:win failed with exit code $LASTEXITCODE"
}

$releaseDir = Join-Path (Get-Location) "release"
$portable = Get-ChildItem -Path $releaseDir -Filter "*Portable*.exe" -File -ErrorAction SilentlyContinue | Select-Object -First 1
$installer = Get-ChildItem -Path $releaseDir -Filter "*Installer*.exe" -File -ErrorAction SilentlyContinue | Select-Object -First 1

if ($portable) {
  Write-Host "[RawMarkets] Portable EXE: $($portable.FullName)"
  $rootPortable = Join-Path (Get-Location) "RawMarkets-Portable.exe"
  Copy-Item -Path $portable.FullName -Destination $rootPortable -Force
  Write-Host "[RawMarkets] Copied portable launcher: $rootPortable"
} else {
  Write-Warning "Portable EXE not found in $releaseDir"
}

if ($installer) {
  Write-Host "[RawMarkets] Installer EXE: $($installer.FullName)"
} else {
  Write-Warning "Installer EXE not found in $releaseDir (expected *Installer*.exe)"
}

$unpacked = Join-Path $releaseDir "win-unpacked"
if (Test-Path $unpacked) {
  Write-Host "[RawMarkets] Unpacked app (win-unpacked): $unpacked"
} else {
  Write-Warning "release/win-unpacked not found — run npm run package:win or npm run build:all"
}

Write-Host "[RawMarkets] Unsigned binaries can trigger SmartScreen warnings."
Write-Host "[RawMarkets] Scraping features still require: npm run scrape:install"
