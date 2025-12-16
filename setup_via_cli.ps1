# CLI-based Supabase setup using Supabase CLI
# This will automate the setup process

param(
    [Parameter(Mandatory=$false)]
    [string]$DatabasePassword = ""
)

$projectId = "djxssxhnmucmvfugvyta"
$projectUrl = "https://djxssxhnmucmvfugvyta.supabase.co"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Supabase CLI Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Project: $projectId" -ForegroundColor Green
Write-Host ""

# Check if Supabase CLI is installed
Write-Host "Checking for Supabase CLI..." -ForegroundColor Yellow
try {
    $supabaseVersion = supabase --version 2>&1
    Write-Host "[OK] Supabase CLI found: $supabaseVersion" -ForegroundColor Green
    $hasSupabaseCLI = $true
} catch {
    Write-Host "[INFO] Supabase CLI not installed" -ForegroundColor Yellow
    $hasSupabaseCLI = $false
}

# If no CLI, try to construct connection string
if (-not $hasSupabaseCLI) {
    Write-Host ""
    Write-Host "Option 1: Install Supabase CLI (Recommended)" -ForegroundColor Cyan
    Write-Host "  npm install -g supabase" -ForegroundColor White
    Write-Host "  Then run: supabase login" -ForegroundColor White
    Write-Host "  Then run: supabase link --project-ref $projectId" -ForegroundColor White
    Write-Host ""
    Write-Host "Option 2: Use Connection String Directly" -ForegroundColor Cyan
    Write-Host ""
    
    if ([string]::IsNullOrWhiteSpace($DatabasePassword)) {
        Write-Host "We need your database password to construct the connection string." -ForegroundColor Yellow
        Write-Host "This is the password you set when creating the Supabase project." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "If you forgot it, you can reset it at:" -ForegroundColor White
        Write-Host "  https://supabase.com/dashboard/project/$projectId/settings/database" -ForegroundColor Cyan
        Write-Host ""
        
        $DatabasePassword = Read-Host "Enter your database password (will be hidden)" -AsSecureString
        $DatabasePasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($DatabasePassword)
        )
    }
    
    # Construct connection string
    $connectionString = "postgresql://postgres:$DatabasePasswordPlain@db.$projectId.supabase.co:5432/postgres"
    Write-Host ""
    Write-Host "[OK] Connection string constructed" -ForegroundColor Green
    
} else {
    Write-Host ""
    Write-Host "Using Supabase CLI to get connection details..." -ForegroundColor Yellow
    
    # Try to link project
    Write-Host "Linking to project..." -ForegroundColor Cyan
    try {
        supabase link --project-ref $projectId 2>&1 | Out-Null
        Write-Host "[OK] Project linked" -ForegroundColor Green
    } catch {
        Write-Host "[INFO] Project may already be linked or needs login" -ForegroundColor Yellow
        Write-Host "Run: supabase login" -ForegroundColor White
    }
    
    # Get connection string from Supabase CLI
    # Note: Supabase CLI stores connection in .supabase/config.toml
    $configPath = ".supabase\config.toml"
    if (Test-Path $configPath) {
        $config = Get-Content $configPath -Raw
        if ($config -match "db_url\s*=\s*[\"']([^\"']+)[\"']") {
            $connectionString = $matches[1]
            Write-Host "[OK] Found connection string in config" -ForegroundColor Green
        }
    }
    
    # If not found, construct it
    if ([string]::IsNullOrWhiteSpace($connectionString)) {
        if ([string]::IsNullOrWhiteSpace($DatabasePassword)) {
            Write-Host "Need database password to construct connection string..." -ForegroundColor Yellow
            $DatabasePassword = Read-Host "Enter database password (will be hidden)" -AsSecureString
            $DatabasePasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
                [Runtime.InteropServices.Marshal]::SecureStringToBSTR($DatabasePassword)
            )
        } else {
            $DatabasePasswordPlain = $DatabasePassword
        }
        
        $connectionString = "postgresql://postgres:$DatabasePasswordPlain@db.$projectId.supabase.co:5432/postgres"
    }
}

# Configure .env file
Write-Host ""
Write-Host "Configuring .env file..." -ForegroundColor Yellow

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
    Write-Host "[OK] Backed up existing .env" -ForegroundColor Green
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
Write-Host "[OK] Created storage/.env" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Configuration Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next: Apply database schema" -ForegroundColor Yellow
Write-Host ""
Write-Host "Option A: Using Supabase CLI (if installed)" -ForegroundColor Cyan
Write-Host "  supabase db push" -ForegroundColor White
Write-Host ""
Write-Host "Option B: Using SQL Editor" -ForegroundColor Cyan
Write-Host "  1. Go to: https://supabase.com/dashboard/project/$projectId/sql/new" -ForegroundColor White
Write-Host "  2. Open: database\schema.sql" -ForegroundColor White
Write-Host "  3. Copy and paste into SQL Editor" -ForegroundColor White
Write-Host "  4. Click 'Run'" -ForegroundColor White
Write-Host ""
Write-Host "Then test:" -ForegroundColor Yellow
Write-Host "  python test_database.py" -ForegroundColor White
Write-Host ""

