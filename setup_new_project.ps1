# Setup script for new Supabase project: gaeauxyyfqavpqythore

param(
    [Parameter(Mandatory=$true)]
    [string]$Password
)

$projectId = "gaeauxyyfqavpqythore"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setting Up New Supabase Project" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Project ID: $projectId" -ForegroundColor Green
Write-Host ""

# Navigate to storage directory
$storagePath = Join-Path $PSScriptRoot "storage"
if (-not (Test-Path $storagePath)) {
    Write-Host "[ERROR] storage directory not found" -ForegroundColor Red
    exit 1
}

Set-Location $storagePath

# URL encode password
$pythonScript = @"
import urllib.parse
password = '$Password'
encoded = urllib.parse.quote(password, safe='')
print(encoded)
"@

$encodedPassword = python -c $pythonScript

# Construct connection string
$connectionString = "postgresql://postgres:$encodedPassword@db.$projectId.supabase.co:5432/postgres"

# Backup existing .env
if (Test-Path .env) {
    $backupName = ".env.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item .env $backupName -Force
    Write-Host "[OK] Backed up existing .env to $backupName" -ForegroundColor Green
}

# Create .env file
$envContent = @"
# Supabase Cloud Database Configuration
# Project: $projectId
DATABASE_URL=$connectionString

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
Write-Host "   Go to: https://supabase.com/dashboard/project/$projectId/sql/new" -ForegroundColor White
Write-Host "   - Open file: database\schema.sql" -ForegroundColor White
Write-Host "   - Copy contents and paste into SQL Editor" -ForegroundColor White
Write-Host "   - Click 'Run'" -ForegroundColor White
Write-Host ""
Write-Host "2. Test connection:" -ForegroundColor Cyan
Write-Host "   python test_database.py" -ForegroundColor White
Write-Host ""
Write-Host "3. Test full system:" -ForegroundColor Cyan
Write-Host "   python test_dual_storage.py" -ForegroundColor White
Write-Host ""

