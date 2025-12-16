# Setup using Supabase CLI (after CLI is installed and logged in)
# This assumes you've run: supabase login

$projectId = "djxssxhnmucmvfugvyta"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Supabase CLI Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Supabase CLI is available
try {
    $version = supabase --version 2>&1
    Write-Host "[OK] Supabase CLI found: $version" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Supabase CLI not found" -ForegroundColor Red
    Write-Host "Install it with: scoop install supabase" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Step 1: Login to Supabase" -ForegroundColor Yellow
Write-Host ""

# Check if already logged in
try {
    $loginCheck = supabase projects list 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Already logged in to Supabase" -ForegroundColor Green
    } else {
        Write-Host "[INFO] Need to login" -ForegroundColor Yellow
        Write-Host "Running: supabase login" -ForegroundColor Cyan
        Write-Host "This will open a browser for authentication..." -ForegroundColor White
        supabase login
    }
} catch {
    Write-Host "[INFO] Need to login" -ForegroundColor Yellow
    Write-Host "Running: supabase login" -ForegroundColor Cyan
    supabase login
}

Write-Host ""
Write-Host "Step 2: Link Project" -ForegroundColor Yellow
Write-Host ""

# Link to project
Write-Host "Linking to project: $projectId" -ForegroundColor Cyan
try {
    supabase link --project-ref $projectId 2>&1 | Out-Null
    Write-Host "[OK] Project linked successfully" -ForegroundColor Green
} catch {
    Write-Host "[WARN] Link may have failed or already linked" -ForegroundColor Yellow
    Write-Host "Continuing..." -ForegroundColor Gray
}

Write-Host ""
Write-Host "Step 3: Get Connection String" -ForegroundColor Yellow
Write-Host ""

# Try to get connection string from Supabase CLI config
$configPath = ".supabase\config.toml"
$connectionString = ""

if (Test-Path $configPath) {
    $config = Get-Content $configPath -Raw
    if ($config -match "db_url\s*=\s*[\"']([^\"']+)[\"']") {
        $connectionString = $matches[1]
        Write-Host "[OK] Found connection string in config" -ForegroundColor Green
    }
}

# If not found, we need the password
if ([string]::IsNullOrWhiteSpace($connectionString)) {
    Write-Host "[INFO] Connection string not in config" -ForegroundColor Yellow
    Write-Host "We need your database password to construct it." -ForegroundColor White
    Write-Host ""
    
    $password = Read-Host "Enter your database password (will be hidden)" -AsSecureString
    $passwordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
    )
    
    $connectionString = "postgresql://postgres:$passwordPlain@db.$projectId.supabase.co:5432/postgres"
    Write-Host "[OK] Connection string constructed" -ForegroundColor Green
}

Write-Host ""
Write-Host "Step 4: Configure .env" -ForegroundColor Yellow
Write-Host ""

# Configure .env file
$storagePath = Join-Path $PSScriptRoot "storage"
if (-not (Test-Path $storagePath)) {
    Write-Host "[ERROR] storage directory not found" -ForegroundColor Red
    exit 1
}

Set-Location $storagePath

# Backup
if (Test-Path .env) {
    $backupName = ".env.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item .env $backupName -Force
    Write-Host "[OK] Backed up existing .env" -ForegroundColor Green
}

# Create .env
$envContent = @"
# Supabase Cloud Database Configuration
# Project: $projectId
# Configured via Supabase CLI
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
Write-Host "Step 5: Apply Schema" -ForegroundColor Yellow
Write-Host ""

Write-Host "Option A: Using Supabase CLI (Recommended)" -ForegroundColor Cyan
Write-Host "  supabase db push" -ForegroundColor White
Write-Host ""
Write-Host "Option B: Using SQL Editor" -ForegroundColor Cyan
Write-Host "  Go to: https://supabase.com/dashboard/project/$projectId/sql/new" -ForegroundColor White
Write-Host "  Paste contents of database\schema.sql" -ForegroundColor White
Write-Host ""

$useCLI = Read-Host "Apply schema using CLI? (y/n)"
if ($useCLI -eq 'y' -or $useCLI -eq 'Y') {
    Write-Host ""
    Write-Host "Pushing schema to database..." -ForegroundColor Cyan
    try {
        # We need to create a migration file first
        $schemaPath = Join-Path $PSScriptRoot "database\schema.sql"
        if (Test-Path $schemaPath) {
            Write-Host "[INFO] For CLI, you'll need to create a migration" -ForegroundColor Yellow
            Write-Host "Or use SQL Editor method instead" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "[WARN] CLI push failed. Use SQL Editor method." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next: Test connection" -ForegroundColor Yellow
Write-Host "  python test_database.py" -ForegroundColor White
Write-Host ""

