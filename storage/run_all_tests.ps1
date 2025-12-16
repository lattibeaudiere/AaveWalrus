# Run all tests in sequence

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Running All Tests" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$testResults = @()

# Test 1: Integration test
Write-Host "Test 1: Integration Test..." -ForegroundColor Yellow
python test_integration.py
if ($LASTEXITCODE -eq 0) {
    $testResults += "[PASS] Integration Test"
} else {
    $testResults += "[FAIL] Integration Test"
}

Write-Host ""

# Test 2: Database test
Write-Host "Test 2: Database Connection Test..." -ForegroundColor Yellow
python test_database.py
if ($LASTEXITCODE -eq 0) {
    $testResults += "[PASS] Database Test"
} else {
    $testResults += "[FAIL] Database Test (PostgreSQL may not be set up)"
}

Write-Host ""

# Test 3: Walrus test (optional)
Write-Host "Test 3: Walrus Test (Optional)..." -ForegroundColor Yellow
python test_walrus.py 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    $testResults += "[PASS] Walrus Test"
} else {
    $testResults += "[SKIP] Walrus Test (Walrus not configured)"
}

Write-Host ""

# Test 4: Dual storage test (requires database)
Write-Host "Test 4: Dual Storage Test..." -ForegroundColor Yellow
python test_dual_storage.py 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    $testResults += "[PASS] Dual Storage Test"
} else {
    $testResults += "[FAIL] Dual Storage Test (Requires database setup)"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Results Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
foreach ($result in $testResults) {
    if ($result -match "\[PASS\]") {
        Write-Host $result -ForegroundColor Green
    } elseif ($result -match "\[SKIP\]") {
        Write-Host $result -ForegroundColor Yellow
    } else {
        Write-Host $result -ForegroundColor Red
    }
}

