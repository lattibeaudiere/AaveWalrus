# Simple CLI setup - just needs database password
# Usage: .\setup_cli_simple.ps1 -Password 'your_password'

param(
    [Parameter(Mandatory=$true)]
    [string]$Password
)

$projectId = "djxssxhnmucmvfugvyta"

Write-Host "Setting up Supabase connection..." -ForegroundColor Cyan

# Construct connection string
$connectionString = "postgresql://postgres:$Password@db.$projectId.supabase.co:5432/postgres"

# Configure .env
$storagePath = Join-Path $PSScriptRoot "storage"
Set-Location $storagePath

# Backup
if (Test-Path .env) {
    Copy-Item .env ".env.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')" -Force
}

# Create .env
$envContent = @"
DATABASE_URL=$connectionString
WALRUS_CONFIG=~/.config/walrus/client_config.yaml
WALRUS_CONTEXT=mainnet
FLASK_PORT=5000
ARBITRUM_RPC=https://arb1.arbitrum.io/rpc
REACTIVE_NETWORK_RPC=https://mainnet-rpc.rnk.dev
"@

Set-Content -Path .env -Value $envContent -Encoding utf8

Write-Host "[OK] .env configured!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Apply schema in Supabase SQL Editor" -ForegroundColor White
Write-Host "2. Test: python test_database.py" -ForegroundColor White
Write-Host ""

