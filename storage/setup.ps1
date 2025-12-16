# Complete setup script for dual storage system

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Dual Storage System Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check Python
Write-Host "Step 1: Checking Python..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "[OK] Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Python not found. Please install Python 3.8+" -ForegroundColor Red
    exit 1
}

# Step 2: Install Python dependencies
Write-Host ""
Write-Host "Step 2: Installing Python dependencies..." -ForegroundColor Yellow
try {
    pip install -q -r requirements.txt
    Write-Host "[OK] Dependencies installed" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to install dependencies" -ForegroundColor Red
    Write-Host "Run manually: pip install -r requirements.txt" -ForegroundColor Yellow
}

# Step 3: Create .env file
Write-Host ""
Write-Host "Step 3: Setting up environment file..." -ForegroundColor Yellow
if (Test-Path .env) {
    Write-Host "[INFO] .env file already exists" -ForegroundColor Yellow
} else {
    if (Test-Path .env.example) {
        Copy-Item .env.example .env
        Write-Host "[OK] Created .env from .env.example" -ForegroundColor Green
        Write-Host "[INFO] Please edit .env with your database credentials" -ForegroundColor Yellow
    } else {
        Write-Host "[ERROR] .env.example not found" -ForegroundColor Red
    }
}

# Step 4: Check PostgreSQL
Write-Host ""
Write-Host "Step 4: Checking PostgreSQL..." -ForegroundColor Yellow
try {
    $psqlVersion = psql --version 2>&1
    Write-Host "[OK] PostgreSQL found: $psqlVersion" -ForegroundColor Green
    Write-Host "[INFO] Run setup_database.ps1 to set up database" -ForegroundColor Yellow
} catch {
    Write-Host "[WARN] PostgreSQL not found" -ForegroundColor Yellow
    Write-Host "[INFO] Install PostgreSQL and run setup_database.ps1" -ForegroundColor Yellow
}

# Step 5: Check Walrus
Write-Host ""
Write-Host "Step 5: Checking Walrus..." -ForegroundColor Yellow
try {
    $walrusVersion = walrus --version 2>&1
    Write-Host "[OK] Walrus CLI found: $walrusVersion" -ForegroundColor Green
} catch {
    Write-Host "[WARN] Walrus CLI not found (optional)" -ForegroundColor Yellow
    Write-Host "[INFO] Run setup_walrus.ps1 for Walrus setup" -ForegroundColor Yellow
}

# Step 6: Run integration tests
Write-Host ""
Write-Host "Step 6: Running integration tests..." -ForegroundColor Yellow
python test_integration.py

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Edit storage/.env with your database credentials" -ForegroundColor White
Write-Host "2. Set up PostgreSQL database (run setup_database.ps1)" -ForegroundColor White
Write-Host "3. (Optional) Set up Walrus (run setup_walrus.ps1)" -ForegroundColor White
Write-Host "4. Test database: python test_database.py" -ForegroundColor White
Write-Host "5. Test Walrus: python test_walrus.py" -ForegroundColor White
Write-Host "6. Test full system: python test_dual_storage.py" -ForegroundColor White

