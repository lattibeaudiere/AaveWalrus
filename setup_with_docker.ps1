# PowerShell script to set up dual storage system using Docker

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Dual Storage Setup with Docker" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is installed
try {
    $dockerVersion = docker --version 2>&1
    Write-Host "[OK] Docker found: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Docker not found. Please install Docker Desktop:" -ForegroundColor Red
    Write-Host "Download from: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# Check if Docker is running
try {
    docker ps 2>&1 | Out-Null
    Write-Host "[OK] Docker is running" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Docker is not running. Please start Docker Desktop" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Starting PostgreSQL container..." -ForegroundColor Yellow

# Start PostgreSQL container
docker-compose up -d postgres

Write-Host ""
Write-Host "Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Wait for PostgreSQL to be healthy
$maxAttempts = 30
$attempt = 0
$ready = $false

while ($attempt -lt $maxAttempts -and -not $ready) {
    try {
        $health = docker exec aave_dataset_db pg_isready -U aave_user -d aave_dataset 2>&1
        if ($health -match "accepting connections") {
            $ready = $true
            Write-Host "[OK] PostgreSQL is ready!" -ForegroundColor Green
        }
    } catch {
        # Container might not be ready yet
    }
    
    if (-not $ready) {
        $attempt++
        Start-Sleep -Seconds 2
        Write-Host "  Waiting... ($attempt/$maxAttempts)" -ForegroundColor Gray
    }
}

if (-not $ready) {
    Write-Host "[ERROR] PostgreSQL did not become ready in time" -ForegroundColor Red
    Write-Host "Check logs: docker logs aave_dataset_db" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Applying database schema..." -ForegroundColor Yellow

# Apply schema (should be automatic via docker-entrypoint-initdb.d)
# But let's verify
Start-Sleep -Seconds 3

# Test connection
Write-Host ""
Write-Host "Testing database connection..." -ForegroundColor Yellow

# Update .env file for Docker
if (Test-Path "storage\.env") {
    Copy-Item "storage\.env" "storage\.env.backup" -ErrorAction SilentlyContinue
}

Copy-Item "storage\.env.docker" "storage\.env" -Force
Write-Host "[OK] Updated storage/.env with Docker settings" -ForegroundColor Green

# Test Python connection
cd storage
python test_database.py

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "PostgreSQL is running in Docker container: aave_dataset_db" -ForegroundColor Green
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Yellow
Write-Host "  docker ps                          - View running containers" -ForegroundColor White
Write-Host "  docker logs aave_dataset_db        - View database logs" -ForegroundColor White
Write-Host "  docker stop aave_dataset_db         - Stop database" -ForegroundColor White
Write-Host "  docker start aave_dataset_db        - Start database" -ForegroundColor White
Write-Host "  docker-compose down                 - Stop and remove container" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Test database: python test_database.py" -ForegroundColor White
Write-Host "  2. Test full system: python test_dual_storage.py" -ForegroundColor White
Write-Host "  3. Start Flask API: python app.py" -ForegroundColor White

