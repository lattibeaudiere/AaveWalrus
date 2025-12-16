# Walrus CLI Setup Script for Windows (WSL)
# This script helps set up Walrus CLI in WSL

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Walrus CLI Setup for Windows (WSL)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if WSL is installed
Write-Host "[1/7] Checking WSL installation..." -ForegroundColor Yellow
$wslCheck = wsl --status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] WSL is not installed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "To install WSL:" -ForegroundColor Yellow
    Write-Host "  1. Run PowerShell as Administrator" -ForegroundColor White
    Write-Host "  2. Run: wsl --install" -ForegroundColor White
    Write-Host "  3. Restart your computer" -ForegroundColor White
    Write-Host "  4. Run this script again" -ForegroundColor White
    exit 1
}
Write-Host "[OK] WSL is installed" -ForegroundColor Green
Write-Host ""

# Check if WSL distribution is available
Write-Host "[2/7] Checking WSL distribution..." -ForegroundColor Yellow
$distros = wsl --list --quiet 2>&1
if ($distros.Count -eq 0 -or ($distros -match "No distributions")) {
    Write-Host "[WARN] No WSL distribution found" -ForegroundColor Yellow
    Write-Host "Installing Ubuntu..." -ForegroundColor Yellow
    wsl --install -d Ubuntu
    Write-Host "[INFO] Please complete Ubuntu setup, then run this script again" -ForegroundColor Yellow
    exit 0
}
Write-Host "[OK] WSL distribution found" -ForegroundColor Green
Write-Host ""

# Create setup script for WSL
Write-Host "[3/7] Creating WSL setup script..." -ForegroundColor Yellow
$wslScript = @"
#!/bin/bash
set -e

echo "========================================"
echo "Walrus CLI Setup in WSL"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Check Rust
echo "[1/6] Checking Rust installation..."
if ! command -v rustc &> /dev/null; then
    echo -e "\${YELLOW}Installing Rust...\${NC}"
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source \$HOME/.cargo/env
else
    echo -e "\${GREEN}[OK] Rust is installed\${NC}"
    rustc --version
fi
echo ""

# Step 2: Check Sui CLI
echo "[2/6] Checking Sui CLI installation..."
if ! command -v sui &> /dev/null; then
    echo -e "\${YELLOW}Installing Sui CLI...\${NC}"
    echo "This may take 10-30 minutes..."
    cargo install --git https://github.com/MystenLabs/sui.git --tag mainnet-v1.17.2 --locked sui
else
    echo -e "\${GREEN}[OK] Sui CLI is installed\${NC}"
    sui --version
fi
echo ""

# Step 3: Initialize Sui Client (if needed)
echo "[3/6] Checking Sui client configuration..."
if [ ! -f "\$HOME/.sui/sui_config/client.yaml" ]; then
    echo -e "\${YELLOW}Initializing Sui client...\${NC}"
    echo "You'll need to interact with this step."
    echo "Choose mainnet (option 1) for production use"
    sui client
else
    echo -e "\${GREEN}[OK] Sui client configured\${NC}"
fi
echo ""

# Step 4: Check Walrus CLI
echo "[4/6] Checking Walrus CLI installation..."
if ! command -v walrus &> /dev/null; then
    echo -e "\${YELLOW}Installing Walrus CLI...\${NC}"
    curl -sSf https://docs.wal.app/setup/walrus-install.sh | sh
    
    # Add to PATH if not already there
    if [[ ":\$PATH:" != *":\$HOME/.local/bin:"* ]]; then
        echo 'export PATH="\$HOME/.local/bin:\$PATH"' >> \$HOME/.bashrc
        export PATH="\$HOME/.local/bin:\$PATH"
    fi
else
    echo -e "\${GREEN}[OK] Walrus CLI is installed\${NC}"
    walrus --version
fi
echo ""

# Step 5: Create Walrus config directory
echo "[5/6] Setting up Walrus config..."
mkdir -p \$HOME/.config/walrus

# Get Sui address and wallet path
SUI_ADDRESS=\$(sui client active-address 2>/dev/null || echo "")
WALLET_PATH="\$HOME/.sui/sui_config/client.yaml"
SUI_ENV=\$(sui client active-env 2>/dev/null || echo "mainnet")

if [ -z "\$SUI_ADDRESS" ]; then
    echo -e "\${RED}[ERROR] No Sui address found. Please run 'sui client' first.\${NC}"
    exit 1
fi

echo "Detected:"
echo "  Address: \$SUI_ADDRESS"
echo "  Wallet: \$WALLET_PATH"
echo "  Environment: \$SUI_ENV"
echo ""

# Create config file
CONFIG_FILE="\$HOME/.config/walrus/client_config.yaml"

# Mainnet config
if [ "\$SUI_ENV" = "mainnet" ]; then
    cat > "\$CONFIG_FILE" << EOF
contexts:
  mainnet:
    system_object: 0x2134d52768ea07e8c43570ef975eb3e4c27a39fa6396bef985b5abc58d03ddd2
    staking_object: 0x10b9d30c28448939ce6c4d6c6e0ffce4a7f8a4ada8248bdad09ef8b70e4a3904
    subsidies_object: 0xb606eb177899edc2130c93bf65985af7ec959a2755dc126c953755e59324209e
    exchange_objects: []
    wallet_config:
      path: \$WALLET_PATH
      active_env: mainnet
      active_address: \$SUI_ADDRESS
default_context: mainnet
EOF
else
    # Testnet config (using placeholder objects - update with actual testnet objects)
    cat > "\$CONFIG_FILE" << EOF
contexts:
  testnet:
    system_object: 0x0000000000000000000000000000000000000000000000000000000000000002
    staking_object: 0x0000000000000000000000000000000000000000000000000000000000000002
    subsidies_object: 0x0000000000000000000000000000000000000000000000000000000000000002
    exchange_objects: []
    wallet_config:
      path: \$WALLET_PATH
      active_env: testnet
      active_address: \$SUI_ADDRESS
default_context: testnet
EOF
fi

echo -e "\${GREEN}[OK] Walrus config created at: \$CONFIG_FILE\${NC}"
echo ""

# Step 6: Test setup
echo "[6/6] Testing setup..."
echo "Creating test file..."
echo "Hello, Walrus! Test from setup script." > /tmp/walrus_test.txt

echo "Testing Walrus store (this requires Sui tokens)..."
if walrus --config "\$CONFIG_FILE" store /tmp/walrus_test.txt --epochs 1 --context "\$SUI_ENV" 2>&1; then
    echo -e "\${GREEN}[SUCCESS] Walrus setup complete!\${NC}"
    echo ""
    echo "Your Walrus config: \$CONFIG_FILE"
    echo "To use in your app, set:"
    echo "  export WALRUS_CONFIG=\"\$CONFIG_FILE\""
    echo "  export WALRUS_CONTEXT=\"\$SUI_ENV\""
else
    echo -e "\${YELLOW}[WARN] Store test failed (you may need Sui tokens)\${NC}"
    echo -e "\${GREEN}[OK] Setup complete, but test failed\${NC}"
    echo "Get test tokens: https://docs.sui.io/build/faucet"
fi

echo ""
echo "========================================"
echo "Setup Complete!"
echo "========================================"
"@

$scriptPath = Join-Path $PSScriptRoot "setup_walrus_wsl.sh"
$wslScript | Out-File -FilePath $scriptPath -Encoding UTF8
Write-Host "[OK] Created WSL setup script: $scriptPath" -ForegroundColor Green
Write-Host ""

# Step 4: Copy script to WSL and run
Write-Host "[4/7] Copying script to WSL..." -ForegroundColor Yellow
$wslScriptPath = "/tmp/setup_walrus_wsl.sh"
wsl bash -c "cat > $wslScriptPath" < $scriptPath
Write-Host "[OK] Script copied to WSL" -ForegroundColor Green
Write-Host ""

# Step 5: Run setup in WSL
Write-Host "[5/7] Running setup in WSL..." -ForegroundColor Yellow
Write-Host "This may take 10-30 minutes (installing Rust, Sui, Walrus)..." -ForegroundColor Yellow
Write-Host ""
wsl bash $wslScriptPath
Write-Host ""

# Step 6: Get config path from WSL
Write-Host "[6/7] Getting Walrus config path..." -ForegroundColor Yellow
$wslConfigPath = wsl bash -c "echo `$HOME/.config/walrus/client_config.yaml"
$wslContext = wsl bash -c "sui client active-env 2>/dev/null || echo 'mainnet'"

Write-Host "[OK] Config path: $wslConfigPath" -ForegroundColor Green
Write-Host "[OK] Context: $wslContext" -ForegroundColor Green
Write-Host ""

# Step 7: Update .env file
Write-Host "[7/7] Updating storage/.env..." -ForegroundColor Yellow
$envPath = Join-Path $PSScriptRoot "storage\.env"
if (Test-Path $envPath) {
    # Read current .env
    $envContent = Get-Content $envPath -Raw
    
    # Update or add WALRUS_CONFIG
    if ($envContent -match "WALRUS_CONFIG=") {
        $envContent = $envContent -replace "WALRUS_CONFIG=.*", "WALRUS_CONFIG=$wslConfigPath"
    } else {
        $envContent += "`nWALRUS_CONFIG=$wslConfigPath`n"
    }
    
    # Update or add WALRUS_CONTEXT
    if ($envContent -match "WALRUS_CONTEXT=") {
        $envContent = $envContent -replace "WALRUS_CONTEXT=.*", "WALRUS_CONTEXT=$wslContext"
    } else {
        $envContent += "`nWALRUS_CONTEXT=$wslContext`n"
    }
    
    # Update or add WALRUS_USE_WSL
    if ($envContent -match "WALRUS_USE_WSL=") {
        $envContent = $envContent -replace "WALRUS_USE_WSL=.*", "WALRUS_USE_WSL=true"
    } else {
        $envContent += "`nWALRUS_USE_WSL=true`n"
    }
    
    $envContent | Out-File -FilePath $envPath -Encoding UTF8 -NoNewline
    Write-Host "[OK] Updated storage/.env" -ForegroundColor Green
} else {
    Write-Host "[WARN] storage/.env not found, creating it..." -ForegroundColor Yellow
    @"
# Walrus Configuration
WALRUS_CONFIG=$wslConfigPath
WALRUS_CONTEXT=$wslContext
WALRUS_USE_WSL=true
"@ | Out-File -FilePath $envPath -Encoding UTF8
    Write-Host "[OK] Created storage/.env" -ForegroundColor Green
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Get Sui test tokens: https://docs.sui.io/build/faucet" -ForegroundColor White
Write-Host "2. Test Walrus: wsl walrus --version" -ForegroundColor White
Write-Host "3. Test storage: python storage/test_walrus.py" -ForegroundColor White
Write-Host ""

