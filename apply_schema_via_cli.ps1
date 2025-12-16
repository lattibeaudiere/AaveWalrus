# Apply database schema using Supabase CLI or provide instructions

$projectId = "gaeauxyyfqavpqythore"
$schemaPath = Join-Path $PSScriptRoot "database\schema.sql"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Apply Database Schema" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Supabase CLI is available
try {
    $supabaseVersion = supabase --version 2>&1
    Write-Host "[OK] Supabase CLI found: $supabaseVersion" -ForegroundColor Green
    $hasCLI = $true
} catch {
    Write-Host "[INFO] Supabase CLI not available" -ForegroundColor Yellow
    $hasCLI = $false
}

if ($hasCLI) {
    Write-Host ""
    Write-Host "Option 1: Using Supabase CLI" -ForegroundColor Cyan
    Write-Host "  (Requires project to be linked)" -ForegroundColor Gray
    Write-Host ""
    
    # Check if project is linked
    $configPath = ".supabase\config.toml"
    if (Test-Path $configPath) {
        Write-Host "Project appears to be linked. Attempting to apply schema..." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Note: Supabase CLI requires migrations. For now, use SQL Editor method." -ForegroundColor Yellow
    } else {
        Write-Host "Project not linked. Use SQL Editor method instead." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Option 2: Using Supabase SQL Editor (Recommended)" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Go to: https://supabase.com/dashboard/project/$projectId/sql/new" -ForegroundColor White
Write-Host "2. Open file: $schemaPath" -ForegroundColor White
Write-Host "3. Copy ENTIRE contents of schema.sql" -ForegroundColor White
Write-Host "4. Paste into SQL Editor" -ForegroundColor White
Write-Host "5. Click 'Run' (or press Ctrl+Enter)" -ForegroundColor White
Write-Host ""

# Open schema file
if (Test-Path $schemaPath) {
    Write-Host "Opening schema file for you to copy..." -ForegroundColor Yellow
    Start-Process notepad.exe -ArgumentList $schemaPath
    Write-Host ""
    Write-Host "Schema file opened. Copy all contents and paste into Supabase SQL Editor." -ForegroundColor Green
} else {
    Write-Host "[ERROR] Schema file not found: $schemaPath" -ForegroundColor Red
}

Write-Host ""
Write-Host "After applying schema, test with:" -ForegroundColor Yellow
Write-Host "  cd storage" -ForegroundColor White
Write-Host "  python test_database.py" -ForegroundColor White
Write-Host ""

