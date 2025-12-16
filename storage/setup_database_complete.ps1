# Complete database setup script
# This script will guide you through PostgreSQL setup

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PostgreSQL Database Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if PostgreSQL is installed
$psqlPath = where.exe psql 2>&1
if ($LASTEXITCODE -eq 0 -and $psqlPath -notmatch "not found") {
    Write-Host "[OK] PostgreSQL found at: $psqlPath" -ForegroundColor Green
    $psqlVersion = psql --version 2>&1
    Write-Host "[OK] Version: $psqlVersion" -ForegroundColor Green
} else {
    Write-Host "[ERROR] PostgreSQL not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install PostgreSQL first:" -ForegroundColor Yellow
    Write-Host "1. Download from: https://www.postgresql.org/download/windows/" -ForegroundColor White
    Write-Host "2. Or use Chocolatey: choco install postgresql" -ForegroundColor White
    Write-Host "3. Or use WSL: wsl --install, then apt-get install postgresql" -ForegroundColor White
    Write-Host ""
    Write-Host "After installation, run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "This script will:" -ForegroundColor Cyan
Write-Host "1. Create database 'aave_dataset'" -ForegroundColor White
Write-Host "2. Create user 'aave_user'" -ForegroundColor White
Write-Host "3. Apply schema from database/schema.sql" -ForegroundColor White
Write-Host ""

$confirm = Read-Host "Continue? (Y/N)"
if ($confirm -ne "Y" -and $confirm -ne "y") {
    Write-Host "Setup cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Step 1: Creating database and user..." -ForegroundColor Yellow

# Check if database already exists
$dbExists = psql -U postgres -lqt 2>&1 | Select-String -Pattern "aave_dataset"
if ($dbExists) {
    Write-Host "[INFO] Database 'aave_dataset' already exists" -ForegroundColor Yellow
    $recreate = Read-Host "Recreate database? This will DELETE all data! (Y/N)"
    if ($recreate -eq "Y" -or $recreate -eq "y") {
        Write-Host "Dropping existing database..." -ForegroundColor Yellow
        psql -U postgres -c "DROP DATABASE IF EXISTS aave_dataset;" 2>&1 | Out-Null
    } else {
        Write-Host "[INFO] Using existing database" -ForegroundColor Yellow
    }
}

# Run create_database.sql
Write-Host "Creating database and user..." -ForegroundColor Cyan
$createResult = psql -U postgres -f create_database.sql 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Database and user created successfully!" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Failed to create database" -ForegroundColor Red
    Write-Host $createResult -ForegroundColor Red
    Write-Host ""
    Write-Host "You may need to enter the postgres password manually." -ForegroundColor Yellow
    Write-Host "Try running manually:" -ForegroundColor Yellow
    Write-Host "  psql -U postgres -f create_database.sql" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "Step 2: Applying schema..." -ForegroundColor Yellow

# Get the schema file path
$schemaPath = Join-Path (Split-Path -Parent $PSScriptRoot) "database\schema.sql"
if (-not (Test-Path $schemaPath)) {
    Write-Host "[ERROR] Schema file not found: $schemaPath" -ForegroundColor Red
    exit 1
}

Write-Host "Applying schema from: $schemaPath" -ForegroundColor Cyan
$schemaResult = psql -U aave_user -d aave_dataset -f $schemaPath 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Schema applied successfully!" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Failed to apply schema" -ForegroundColor Red
    Write-Host $schemaResult -ForegroundColor Red
    Write-Host ""
    Write-Host "Try running manually:" -ForegroundColor Yellow
    Write-Host "  psql -U aave_user -d aave_dataset -f `"$schemaPath`"" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "Step 3: Verifying setup..." -ForegroundColor Yellow

# Test connection
$testResult = psql -U aave_user -d aave_dataset -c "SELECT COUNT(*) FROM aave_events;" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Database connection verified!" -ForegroundColor Green
    Write-Host "[OK] Schema tables exist!" -ForegroundColor Green
} else {
    Write-Host "[WARN] Could not verify setup automatically" -ForegroundColor Yellow
    Write-Host "Run manually: python test_database.py" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Update storage/.env with password: aave_dataset_password_2024" -ForegroundColor White
Write-Host "2. Test connection: python test_database.py" -ForegroundColor White
Write-Host "3. Test full system: python test_dual_storage.py" -ForegroundColor White
Write-Host ""

