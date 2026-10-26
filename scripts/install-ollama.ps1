# Install Ollama via winget for local news JSON extraction (optional)
Write-Host "Installing Ollama for RawMarkets news extraction..."
winget install Ollama.Ollama --accept-package-agreements --accept-source-agreements
if ($LASTEXITCODE -ne 0) {
  Write-Host "winget install failed. Download from https://ollama.com/download"
  exit 1
}
Write-Host "Ollama installed. Start Ollama, then run: ollama pull qwen2.5:14b"
