#!/bin/bash
# Simple Sui CLI Installation Script

echo "========================================"
echo "Installing Sui CLI"
echo "========================================"
echo ""

# Step 1: Install suiup
echo "[1/3] Installing suiup..."
curl -sSfL https://raw.githubusercontent.com/MystenLabs/suiup/main/install.sh | sh
source $HOME/.cargo/env 2>/dev/null || true
echo "✓ suiup installed"
echo ""

# Step 2: Install Sui CLI for Mainnet
echo "[2/3] Installing Sui CLI (Mainnet branch)..."
echo "This may take 5-15 minutes..."
suiup install sui --branch mainnet
echo "✓ Sui CLI installed"
echo ""

# Step 3: Verify
echo "[3/3] Verifying installation..."
sui --version
echo ""
echo "========================================"
echo "Sui CLI Installation Complete!"
echo "========================================"
echo ""
echo "Next: Configure Sui client"
echo "  sui client switch --env mainnet"
echo ""

