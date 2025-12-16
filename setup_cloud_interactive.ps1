# Interactive Cloud Database Setup Script
# This will guide you through setting up Supabase cloud database

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Cloud Database Setup (Supabase)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check if Supabase account exists
Write-Host "Step 1: Supabase Account Setup" -ForegroundColor Yellow
Write-Host ""
Write-Host "If you don't have a Supabase account:" -ForegroundColor White
Write-Host "  1. Open: https://supabase.com" -ForegroundColor Cyan
Write-Host "  2. Click 'Start your project'" -ForegroundColor Cyan
Write-Host "  3. Sign up with GitHub (recommended) or email" -ForegroundColor Cyan
Write-Host "  4. Verify your email if needed" -ForegroundColor Cyan
Write-Host ""

$hasAccount = Read-Host "Do you have a Supabase account? (y/n)"
if ($hasAccount -ne 'y' -and $hasAccount -ne 'Y') {
    Write-Host ""
    Write-Host "Please create an account first, then run this script again." -ForegroundColor Yellow
    Write-Host "Opening Supabase in your browser..." -ForegroundColor Cyan
    Start-Process "https://supabase.com"
    exit 0
}

Write-Host ""
Write-Host "Step 2: Create Supabase Project" -ForegroundColor Yellow
Write-Host ""
Write-Host "In Supabase dashboard:" -ForegroundColor White
Write-Host "  1. Click 'New Project'" -ForegroundColor Cyan
Write-Host "  2. Fill in:" -ForegroundColor Cyan
Write-Host "     - Name: aave-dataset (or any name)" -ForegroundColor Gray
Write-Host "     - Database Password: Create a strong password (SAVE IT!)" -ForegroundColor Gray
Write-Host "     - Region: Choose closest to you" -ForegroundColor Gray
Write-Host "     - Pricing Plan: Free" -ForegroundColor Gray
Write-Host "  3. Click 'Create new project'" -ForegroundColor Cyan
Write-Host "  4. Wait 2-3 minutes for setup" -ForegroundColor Cyan
Write-Host ""

$hasProject = Read-Host "Have you created a project? (y/n)"
if ($hasProject -ne 'y' -and $hasProject -ne 'Y') {
    Write-Host ""
    Write-Host "Please create a project first, then continue." -ForegroundColor Yellow
    Write-Host "Opening Supabase dashboard..." -ForegroundColor Cyan
    Start-Process "https://app.supabase.com"
    exit 0
}

Write-Host ""
Write-Host "Step 3: Get Connection Details" -ForegroundColor Yellow
Write-Host ""
Write-Host "In your Supabase project:" -ForegroundColor White
Write-Host "  1. Go to Settings (gear icon) → Database" -ForegroundColor Cyan
Write-Host "  2. Scroll to 'Connection string' section" -ForegroundColor Cyan
Write-Host "  3. Find 'URI' connection string" -ForegroundColor Cyan
Write-Host "  4. Copy the entire connection string" -ForegroundColor Cyan
Write-Host ""
Write-Host "It looks like:" -ForegroundColor Gray
Write-Host "  postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres" -ForegroundColor DarkGray
Write-Host ""

$connectionMethod = Read-Host "Do you have the connection string? (y/n)"
if ($connectionMethod -eq 'y' -or $connectionMethod -eq 'Y') {
    Write-Host ""
    Write-Host "Paste your connection string (password will be hidden):" -ForegroundColor Yellow
    $connectionString = Read-Host
    
    if ([string]::IsNullOrWhiteSpace($connectionString)) {
        Write-Host "[ERROR] Connection string cannot be empty" -ForegroundColor Red
        exit 1
    }
    
    # Update .env file
    $envPath = "storage\.env"
    if (-not (Test-Path $envPath)) {
        Write-Host "[ERROR] .env file not found. Creating from example..." -ForegroundColor Yellow
        if (Test-Path "storage\.env.example") {
            Copy-Item "storage\.env.example" $envPath
        } else {
            Write-Host "[ERROR] .env.example not found" -ForegroundColor Red
            exit 1
        }
    }
    
    $envContent = Get-Content $envPath -Raw
    
    # Add or update DATABASE_URL
    if ($envContent -match "DATABASE_URL=") {
        $envContent = $envContent -replace "DATABASE_URL=.*", "DATABASE_URL=$connectionString"
    } else {
        # Add at the beginning
        $envContent = "DATABASE_URL=$connectionString`n" + $envContent
    }
    
    # Comment out local DB settings
    $envContent = $envContent -replace "^DB_HOST=", "# DB_HOST="
    $envContent = $envContent -replace "^DB_PORT=", "# DB_PORT="
    $envContent = $envContent -replace "^DB_NAME=", "# DB_NAME="
    $envContent = $envContent -replace "^DB_USER=", "# DB_USER="
    $envContent = $envContent -replace "^DB_PASSWORD=", "# DB_PASSWORD="
    
    Set-Content -Path $envPath -Value $envContent -NoNewline
    Write-Host "[OK] Updated storage/.env with connection string" -ForegroundColor Green
    
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
    $envPath = "storage\.env"
    if (-not (Test-Path $envPath)) {
        if (Test-Path "storage\.env.example") {
            Copy-Item "storage\.env.example" $envPath
        }
    }
    
    $envContent = Get-Content $envPath -Raw
    
    $envContent = $envContent -replace "DB_HOST=.*", "DB_HOST=$dbHost"
    $envContent = $envContent -replace "DB_PORT=.*", "DB_PORT=$dbPort"
    $envContent = $envContent -replace "DB_NAME=.*", "DB_NAME=$dbName"
    $envContent = $envContent -replace "DB_USER=.*", "DB_USER=$dbUser"
    $envContent = $envContent -replace "DB_PASSWORD=.*", "DB_PASSWORD=$dbPasswordPlain"
    
    Set-Content -Path $envPath -Value $envContent -NoNewline
    Write-Host "[OK] Updated storage/.env with connection details" -ForegroundColor Green
}

Write-Host ""
Write-Host "Step 4: Apply Database Schema" -ForegroundColor Yellow
Write-Host ""
Write-Host "You need to apply the database schema. Choose method:" -ForegroundColor White
Write-Host ""
Write-Host "Option A: Supabase SQL Editor (Easiest - Recommended)" -ForegroundColor Cyan
Write-Host "  1. In Supabase, go to SQL Editor (left sidebar)" -ForegroundColor White
Write-Host "  2. Click 'New query'" -ForegroundColor White
Write-Host "  3. Open file: database\schema.sql" -ForegroundColor White
Write-Host "  4. Copy entire contents and paste into SQL Editor" -ForegroundColor White
Write-Host "  5. Click 'Run' (or press Ctrl+Enter)" -ForegroundColor White
Write-Host "  6. Verify success message" -ForegroundColor White
Write-Host ""
Write-Host "Option B: Command Line (if you have psql installed)" -ForegroundColor Cyan
Write-Host "  psql `"$connectionString`" -f database\schema.sql" -ForegroundColor Gray
Write-Host ""

$schemaApplied = Read-Host "Have you applied the schema? (y/n)"
if ($schemaApplied -ne 'y' -and $schemaApplied -ne 'Y') {
    Write-Host ""
    Write-Host "[WARN] Schema must be applied before testing!" -ForegroundColor Yellow
    Write-Host "Opening schema file location..." -ForegroundColor Cyan
    
    $schemaPath = "database\schema.sql"
    if (Test-Path $schemaPath) {
        Write-Host "Schema file: $((Get-Item $schemaPath).FullName)" -ForegroundColor White
        # Try to open in default editor
        Start-Process notepad.exe -ArgumentList $schemaPath
    }
    
    Write-Host ""
    Write-Host "After applying schema, run this script again or test manually:" -ForegroundColor Yellow
    Write-Host "  cd storage" -ForegroundColor White
    Write-Host "  python test_database.py" -ForegroundColor White
    exit 0
}

Write-Host ""
Write-Host "Step 5: Test Connection" -ForegroundColor Yellow
Write-Host ""

# Test the connection
Write-Host "Testing database connection..." -ForegroundColor Cyan
cd storage

try {
    $testOutput = python test_database.py 2>&1
    Write-Host $testOutput
    
    if ($testOutput -match "\[OK\] Database connected") {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "Setup Complete!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "[SUCCESS] Your cloud database is configured and working!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "  1. Test full system: python test_dual_storage.py" -ForegroundColor White
        Write-Host "  2. Start Flask API: python app.py" -ForegroundColor White
        Write-Host "  3. Integrate with server.js (see integrate_with_server.js)" -ForegroundColor White
        Write-Host "  4. Monitor usage in Supabase dashboard" -ForegroundColor White
    } else {
        Write-Host ""
        Write-Host "[WARN] Connection test had issues. Check the output above." -ForegroundColor Yellow
        Write-Host "Common issues:" -ForegroundColor Yellow
        Write-Host "  - Schema not applied (run SQL in Supabase SQL Editor)" -ForegroundColor White
        Write-Host "  - Wrong connection string (check in Supabase Settings → Database)" -ForegroundColor White
        Write-Host "  - Firewall blocking connection" -ForegroundColor White
    }
} catch {
    Write-Host "[ERROR] Failed to test connection: $_" -ForegroundColor Red
    Write-Host "Make sure Python dependencies are installed: pip install -r requirements.txt" -ForegroundColor Yellow
}

cd ..

