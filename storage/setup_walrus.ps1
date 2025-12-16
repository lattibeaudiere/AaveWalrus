# PowerShell script to help set up Walrus Protocol
# Run this script after installing Walrus CLI

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Walrus Protocol Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if walrus is available
try {
    $walrusVersion = walrus --version 2>&1
    Write-Host "[OK] Walrus CLI found: $walrusVersion" -ForegroundColor Green
} catch {
    Write-Host "[INFO] Walrus CLI not found. Installing..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Installation steps:" -ForegroundColor Cyan
    Write-Host "1. Install WSL (Windows Subsystem for Linux):" -ForegroundColor White
    Write-Host "   wsl --install" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. In WSL, install Walrus:" -ForegroundColor White
    Write-Host "   curl -sSf https://docs.wal.app/setup/walrus-install.sh | sh" -ForegroundColor Gray
    Write-Host "   export PATH=`"`$HOME/.local/bin:`$PATH`"" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. Install Sui CLI:" -ForegroundColor White
    Write-Host "   suiup install sui --branch mainnet" -ForegroundColor Gray
    Write-Host ""
    Write-Host "4. Create Sui wallet:" -ForegroundColor White
    Write-Host "   sui client new-address ed25519" -ForegroundColor Gray
    Write-Host "   sui client active-address" -ForegroundColor Gray
    Write-Host ""
    Write-Host "5. Configure Walrus:" -ForegroundColor White
    Write-Host "   mkdir -p ~/.config/walrus" -ForegroundColor Gray
    Write-Host "   curl https://docs.wal.app/setup/client_config.yaml -o ~/.config/walrus/client_config.yaml" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Note: Walrus setup requires Linux/WSL. For Windows, use WSL or Docker." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "[OK] Walrus is ready!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Ensure Sui wallet is configured" -ForegroundColor White
Write-Host "2. Test Walrus:" -ForegroundColor White
Write-Host "   echo 'test' > /tmp/test.txt" -ForegroundColor Gray
Write-Host "   walrus store /tmp/test.txt --epochs 1" -ForegroundColor Gray
Write-Host ""
Write-Host "Update storage/.env with your Walrus config path." -ForegroundColor Yellow

