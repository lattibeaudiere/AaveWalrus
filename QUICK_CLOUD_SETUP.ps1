# Quick Cloud Database Setup Script
# Run this after you have your Supabase connection string

param(
    [Parameter(Mandatory=$false)]
    [string]$ConnectionString = ""
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Quick Cloud Database Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ([string]::IsNullOrWhiteSpace($ConnectionString)) {
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  .\QUICK_CLOUD_SETUP.ps1 -ConnectionString 'postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres'" -ForegroundColor White
    Write-Host ""
    Write-Host "Or run without parameters to enter interactively:" -ForegroundColor Yellow
    Write-Host "  .\QUICK_CLOUD_SETUP.ps1" -ForegroundColor White
    Write-Host ""
    
    Write-Host "To get your connection string:" -ForegroundColor Cyan
    Write-Host "  1. Go to Supabase → Settings → Database" -ForegroundColor White
    Write-Host "  2. Copy the URI connection string" -ForegroundColor White
    Write-Host ""
    
    $ConnectionString = Read-Host "Paste your Supabase connection string"
}

if ([string]::IsNullOrWhiteSpace($ConnectionString)) {
    Write-Host "[ERROR] Connection string is required" -ForegroundColor Red
    exit 1
}

# Navigate to storage directory
$storagePath = Join-Path $PSScriptRoot "storage"
if (-not (Test-Path $storagePath)) {
    Write-Host "[ERROR] storage directory not found" -ForegroundColor Red
    exit 1
}

Set-Location $storagePath

# Backup existing .env
if (Test-Path .env) {
    Copy-Item .env .env.backup -Force
    Write-Host "[OK] Backed up existing .env to .env.backup" -ForegroundColor Green
}

# Create new .env file
$envContent = @"
# Supabase Cloud Database Configuration
DATABASE_URL=$ConnectionString

# Walrus Configuration (optional)
WALRUS_CONFIG=~/.config/walrus/client_config.yaml
WALRUS_CONTEXT=mainnet

# Flask Configuration
FLASK_PORT=5000

# Aave Integration
ARBITRUM_RPC=https://arb1.arbitrum.io/rpc
REACTIVE_NETWORK_RPC=https://mainnet-rpc.rnk.dev
"@

Set-Content -Path .env -Value $envContent -Encoding utf8
Write-Host "[OK] Created storage/.env with connection string" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Configuration Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Apply database schema:" -ForegroundColor Cyan
Write-Host "   - Go to Supabase → SQL Editor → New query" -ForegroundColor White
Write-Host "   - Open: database\schema.sql" -ForegroundColor White
Write-Host "   - Copy contents and paste into SQL Editor" -ForegroundColor White
Write-Host "   - Click 'Run'" -ForegroundColor White
Write-Host ""
Write-Host "2. Test connection:" -ForegroundColor Cyan
Write-Host "   python test_database.py" -ForegroundColor White
Write-Host ""
Write-Host "3. Test full system:" -ForegroundColor Cyan
Write-Host "   python test_dual_storage.py" -ForegroundColor White
Write-Host ""
Write-Host "4. Start Flask API:" -ForegroundColor Cyan
Write-Host "   python app.py" -ForegroundColor White
Write-Host ""

