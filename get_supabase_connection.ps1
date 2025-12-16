# Script to help get Supabase connection string

$projectId = "djxssxhnmucmvfugvyta"
$dashboardUrl = "https://supabase.com/dashboard/project/$projectId/settings/database"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Supabase Connection Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your Supabase Project: $projectId" -ForegroundColor Green
Write-Host ""
Write-Host "Step 1: Get Connection String" -ForegroundColor Yellow
Write-Host ""
Write-Host "Opening Supabase dashboard..." -ForegroundColor Cyan
Start-Process $dashboardUrl

Write-Host ""
Write-Host "In the Supabase dashboard:" -ForegroundColor White
Write-Host "  1. Scroll to 'Connection string' section" -ForegroundColor Gray
Write-Host "  2. Find 'URI' connection string" -ForegroundColor Gray
Write-Host "  3. Copy the entire string" -ForegroundColor Gray
Write-Host ""
Write-Host "It should look like:" -ForegroundColor Gray
Write-Host "  postgresql://postgres:[PASSWORD]@db.$projectId.supabase.co:5432/postgres" -ForegroundColor DarkGray
Write-Host ""

$connectionString = Read-Host "Paste your connection string here"

if ([string]::IsNullOrWhiteSpace($connectionString)) {
    Write-Host "[ERROR] Connection string is required" -ForegroundColor Red
    exit 1
}

# Validate connection string format
if ($connectionString -notmatch "postgresql://") {
    Write-Host "[WARN] Connection string doesn't look right. Should start with 'postgresql://'" -ForegroundColor Yellow
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne 'y' -and $continue -ne 'Y') {
        exit 0
    }
}

Write-Host ""
Write-Host "Step 2: Configure .env file" -ForegroundColor Yellow

# Navigate to storage directory
$storagePath = Join-Path $PSScriptRoot "storage"
if (-not (Test-Path $storagePath)) {
    Write-Host "[ERROR] storage directory not found" -ForegroundColor Red
    exit 1
}

Set-Location $storagePath

# Backup existing .env
if (Test-Path .env) {
    $backupName = ".env.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item .env $backupName -Force
    Write-Host "[OK] Backed up existing .env to $backupName" -ForegroundColor Green
}

# Create new .env file
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
Write-Host "[OK] Created storage/.env with your connection string" -ForegroundColor Green

Write-Host ""
Write-Host "Step 3: Apply Database Schema" -ForegroundColor Yellow
Write-Host ""
Write-Host "You need to apply the database schema. Choose method:" -ForegroundColor White
Write-Host ""
Write-Host "Option A: Supabase SQL Editor (Easiest)" -ForegroundColor Cyan
Write-Host "  1. Go to: https://supabase.com/dashboard/project/$projectId/sql/new" -ForegroundColor White
Write-Host "  2. Open file: database\schema.sql" -ForegroundColor White
Write-Host "  3. Copy entire contents and paste into SQL Editor" -ForegroundColor White
Write-Host "  4. Click 'Run' (or press Ctrl+Enter)" -ForegroundColor White
Write-Host ""

$schemaPath = Join-Path $PSScriptRoot "database\schema.sql"
if (Test-Path $schemaPath) {
    Write-Host "Opening schema file..." -ForegroundColor Cyan
    Start-Process notepad.exe -ArgumentList $schemaPath
    Write-Host ""
    Write-Host "Schema file opened. Copy the contents and paste into Supabase SQL Editor." -ForegroundColor Yellow
} else {
    Write-Host "[WARN] Schema file not found at: $schemaPath" -ForegroundColor Yellow
}

Write-Host ""
$schemaApplied = Read-Host "Have you applied the schema in Supabase SQL Editor? (y/n)"

if ($schemaApplied -ne 'y' -and $schemaApplied -ne 'Y') {
    Write-Host ""
    Write-Host "[WARN] Schema must be applied before testing!" -ForegroundColor Yellow
    Write-Host "Opening Supabase SQL Editor..." -ForegroundColor Cyan
    Start-Process "https://supabase.com/dashboard/project/$projectId/sql/new"
    Write-Host ""
    Write-Host "After applying schema, run:" -ForegroundColor Yellow
    Write-Host "  cd storage" -ForegroundColor White
    Write-Host "  python test_database.py" -ForegroundColor White
    exit 0
}

Write-Host ""
Write-Host "Step 4: Test Connection" -ForegroundColor Yellow
Write-Host ""

Write-Host "Testing database connection..." -ForegroundColor Cyan
try {
    $testOutput = python test_database.py 2>&1 | Out-String
    Write-Host $testOutput
    
    if ($testOutput -match "\[OK\] Database connected") {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "Setup Complete!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "[SUCCESS] Your Supabase database is configured and working!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "  1. Test full system: python test_dual_storage.py" -ForegroundColor White
        Write-Host "  2. Start Flask API: python app.py" -ForegroundColor White
        Write-Host "  3. Integrate with server.js" -ForegroundColor White
        Write-Host "  4. Monitor in Supabase dashboard" -ForegroundColor White
    } else {
        Write-Host ""
        Write-Host "[WARN] Connection test had issues. Check output above." -ForegroundColor Yellow
    }
} catch {
    Write-Host "[ERROR] Failed to test: $_" -ForegroundColor Red
    Write-Host "Make sure Python dependencies are installed: pip install -r requirements.txt" -ForegroundColor Yellow
}

