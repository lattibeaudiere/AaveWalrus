# PowerShell script to help set up Supabase cloud database

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Supabase Cloud Database Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "This script will help you configure your .env file for Supabase." -ForegroundColor Yellow
Write-Host ""

# Check if .env exists
$envPath = "storage\.env"
if (-not (Test-Path $envPath)) {
    Write-Host "[ERROR] .env file not found in storage directory" -ForegroundColor Red
    Write-Host "Run: cd storage && copy .env.example .env" -ForegroundColor Yellow
    exit 1
}

Write-Host "Step 1: Create Supabase Account" -ForegroundColor Cyan
Write-Host "  1. Go to: https://supabase.com" -ForegroundColor White
Write-Host "  2. Sign up (GitHub recommended)" -ForegroundColor White
Write-Host "  3. Create new project" -ForegroundColor White
Write-Host "  4. Wait for project to be ready (2-3 minutes)" -ForegroundColor White
Write-Host ""

Write-Host "Step 2: Get Connection Details" -ForegroundColor Cyan
Write-Host "  1. In Supabase project, go to Settings → Database" -ForegroundColor White
Write-Host "  2. Find 'Connection string' section" -ForegroundColor White
Write-Host "  3. Copy the URI connection string" -ForegroundColor White
Write-Host ""

$useConnectionString = Read-Host "Do you have the connection string? (y/n)"
if ($useConnectionString -eq 'y' -or $useConnectionString -eq 'Y') {
    Write-Host ""
    Write-Host "Paste your connection string (will be hidden):" -ForegroundColor Yellow
    $connectionString = Read-Host -AsSecureString
    $connectionStringPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($connectionString)
    )
    
    # Update .env file
    $envContent = Get-Content $envPath -Raw
    
    # Add or update DATABASE_URL
    if ($envContent -match "DATABASE_URL=") {
        $envContent = $envContent -replace "DATABASE_URL=.*", "DATABASE_URL=$connectionStringPlain"
    } else {
        $envContent += "`n# Supabase Connection String`nDATABASE_URL=$connectionStringPlain`n"
    }
    
    Set-Content -Path $envPath -Value $envContent -NoNewline
    Write-Host "[OK] Updated .env with connection string" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Enter connection details manually:" -ForegroundColor Yellow
    
    $dbHost = Read-Host "Database Host (e.g., db.xxxxx.supabase.co)"
    $dbPort = Read-Host "Port (default: 5432)" 
    if ([string]::IsNullOrWhiteSpace($dbPort)) { $dbPort = "5432" }
    $dbName = Read-Host "Database Name (default: postgres)"
    if ([string]::IsNullOrWhiteSpace($dbName)) { $dbName = "postgres" }
    $dbUser = Read-Host "Database User (default: postgres)"
    if ([string]::IsNullOrWhiteSpace($dbUser)) { $dbUser = "postgres" }
    Write-Host "Database Password (will be hidden):" -ForegroundColor Yellow
    $dbPassword = Read-Host -AsSecureString
    $dbPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword)
    )
    
    # Update .env file
    $envContent = Get-Content $envPath -Raw
    
    $envContent = $envContent -replace "DB_HOST=.*", "DB_HOST=$dbHost"
    $envContent = $envContent -replace "DB_PORT=.*", "DB_PORT=$dbPort"
    $envContent = $envContent -replace "DB_NAME=.*", "DB_NAME=$dbName"
    $envContent = $envContent -replace "DB_USER=.*", "DB_USER=$dbUser"
    $envContent = $envContent -replace "DB_PASSWORD=.*", "DB_PASSWORD=$dbPasswordPlain"
    
    Set-Content -Path $envPath -Value $envContent -NoNewline
    Write-Host "[OK] Updated .env with connection details" -ForegroundColor Green
}

Write-Host ""
Write-Host "Step 3: Apply Database Schema" -ForegroundColor Cyan
Write-Host ""
Write-Host "Option A: Using Supabase SQL Editor (Easiest)" -ForegroundColor Yellow
Write-Host "  1. In Supabase, go to SQL Editor" -ForegroundColor White
Write-Host "  2. Click 'New query'" -ForegroundColor White
Write-Host "  3. Open: database\schema.sql" -ForegroundColor White
Write-Host "  4. Copy and paste into SQL Editor" -ForegroundColor White
Write-Host "  5. Click 'Run'" -ForegroundColor White
Write-Host ""

$applySchema = Read-Host "Have you applied the schema? (y/n)"
if ($applySchema -ne 'y' -and $applySchema -ne 'Y') {
    Write-Host "[WARN] Please apply the schema before testing" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Step 4: Test Connection" -ForegroundColor Cyan
Write-Host ""
Write-Host "Run this command to test:" -ForegroundColor Yellow
Write-Host "  cd storage" -ForegroundColor White
Write-Host "  python test_database.py" -ForegroundColor White
Write-Host ""

$testNow = Read-Host "Test connection now? (y/n)"
if ($testNow -eq 'y' -or $testNow -eq 'Y') {
    Write-Host ""
    Write-Host "Testing connection..." -ForegroundColor Yellow
    cd storage
    python test_database.py
    cd ..
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your database is now configured for Supabase cloud!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Test connection: cd storage && python test_database.py" -ForegroundColor White
Write-Host "  2. Test full system: python test_dual_storage.py" -ForegroundColor White
Write-Host "  3. Start Flask API: python app.py" -ForegroundColor White
Write-Host "  4. Monitor usage in Supabase dashboard" -ForegroundColor White

