# PowerShell script to help set up PostgreSQL database
# Run this script after installing PostgreSQL

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PostgreSQL Database Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if psql is available
try {
    $psqlVersion = psql --version 2>&1
    Write-Host "[OK] PostgreSQL found: $psqlVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] PostgreSQL not found. Please install PostgreSQL first." -ForegroundColor Red
    Write-Host ""
    Write-Host "Installation options:" -ForegroundColor Yellow
    Write-Host "1. Download from: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    Write-Host "2. Or use Chocolatey: choco install postgresql" -ForegroundColor Yellow
    Write-Host "3. Or use WSL: wsl --install, then apt-get install postgresql" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Please run these SQL commands manually:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Connect to PostgreSQL:" -ForegroundColor Cyan
Write-Host "   psql -U postgres" -ForegroundColor White
Write-Host ""
Write-Host "2. Create database and user:" -ForegroundColor Cyan
Write-Host "   CREATE DATABASE aave_dataset;" -ForegroundColor White
Write-Host "   CREATE USER aave_user WITH PASSWORD 'your_secure_password';" -ForegroundColor White
Write-Host "   GRANT ALL PRIVILEGES ON DATABASE aave_dataset TO aave_user;" -ForegroundColor White
Write-Host "   \q" -ForegroundColor White
Write-Host ""
Write-Host "3. Apply schema:" -ForegroundColor Cyan
Write-Host "   psql -U aave_user -d aave_dataset -f database/schema.sql" -ForegroundColor White
Write-Host ""
Write-Host "After setup, update storage/.env with your database credentials." -ForegroundColor Yellow

