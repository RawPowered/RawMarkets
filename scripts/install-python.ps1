# Install Python 3.12 via winget for RawMarkets portfolio research
Write-Host "Installing Python 3.12 for RawMarkets research engine..."
winget install Python.Python.3.12 --accept-package-agreements --accept-source-agreements
if ($LASTEXITCODE -ne 0) {
  Write-Host "winget install failed. Download from https://www.python.org/downloads/"
  exit 1
}
Write-Host "Python installed. Re-run Launch RawMarkets.bat to set up the research venv."
