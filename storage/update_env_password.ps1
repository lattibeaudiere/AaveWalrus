# Script to update .env with database password

$envFile = Join-Path $PSScriptRoot ".env"
$password = "aave_dataset_password_2024"

if (-not (Test-Path $envFile)) {
    Write-Host "[ERROR] .env file not found at: $envFile" -ForegroundColor Red
    exit 1
}

Write-Host "Updating .env file with database password..." -ForegroundColor Cyan

# Read current content
$content = Get-Content $envFile -Raw

# Replace password
$content = $content -replace "DB_PASSWORD=.*", "DB_PASSWORD=$password"

# Write back
Set-Content -Path $envFile -Value $content -NoNewline

Write-Host "[OK] .env file updated with password: $password" -ForegroundColor Green
Write-Host ""
Write-Host "You can now test the connection:" -ForegroundColor Yellow
Write-Host "  python test_database.py" -ForegroundColor White

