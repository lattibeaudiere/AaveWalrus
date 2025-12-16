#!/bin/bash
# Sui CLI Setup Script
# Sets up Sui CLI first for better control over Walrus

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "========================================"
echo "Sui CLI Setup"
echo "========================================"
echo ""

# Step 1: Check Rust
echo -e "${BLUE}[1/4] Checking Rust installation...${NC}"
if ! command -v rustc &> /dev/null; then
    echo -e "${YELLOW}Installing Rust...${NC}"
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
    echo -e "${GREEN}[OK] Rust installed${NC}"
    rustc --version
else
    echo -e "${GREEN}[OK] Rust is installed${NC}"
    rustc --version
fi
echo ""

# Step 2: Install suiup
echo -e "${BLUE}[2/4] Installing suiup (Sui/Walrus installer)...${NC}"
if ! command -v suiup &> /dev/null; then
    echo -e "${YELLOW}Installing suiup...${NC}"
    curl -sSfL https://raw.githubusercontent.com/Mystenlabs/suiup/main/install.sh | sh
    source $HOME/.cargo/env 2>/dev/null || true
    echo -e "${GREEN}[OK] suiup installed${NC}"
else
    echo -e "${GREEN}[OK] suiup is already installed${NC}"
    suiup --version 2>/dev/null || echo "suiup found"
fi
echo ""

# Step 3: Install Sui CLI for Mainnet
echo -e "${BLUE}[3/4] Installing Sui CLI for Mainnet...${NC}"
if ! command -v sui &> /dev/null; then
    echo -e "${YELLOW}Installing Sui CLI via suiup (Mainnet branch)...${NC}"
    echo "This may take 5-15 minutes..."
    suiup install sui --branch mainnet
    echo -e "${GREEN}[OK] Sui CLI installed${NC}"
else
    echo -e "${GREEN}[OK] Sui CLI is already installed${NC}"
    echo "Current version:"
    sui --version
    echo ""
    echo -e "${YELLOW}Note: If you need Mainnet version, run: suiup install sui --branch mainnet${NC}"
fi

# Verify installation
if command -v sui &> /dev/null; then
    echo ""
    echo -e "${GREEN}Sui CLI version:${NC}"
    sui --version
else
    echo -e "${RED}[ERROR] Sui CLI installation failed${NC}"
    exit 1
fi
echo ""

# Step 4: Initialize Sui Client
echo -e "${BLUE}[4/4] Setting up Sui client...${NC}"
if [ ! -f "$HOME/.sui/sui_config/client.yaml" ]; then
    echo -e "${YELLOW}Initializing Sui client (interactive)...${NC}"
    echo ""
    echo "You'll be prompted to configure Sui client."
    echo ""
    echo "For MAINNET (production - recommended):"
    echo "  Or simply run: sui client switch --env mainnet"
    echo ""
    echo "If running 'sui client' interactively:"
    echo "  Connect to a Sui Full Node server? → Y"
    echo "  Full node server URL → https://fullnode.mainnet.sui.io:443"
    echo "  Environment alias → mainnet"
    echo "  Select key scheme → 0 (for ed25519)"
    echo ""
    echo "Press Enter to continue..."
    read
    sui client
else
    echo -e "${GREEN}[OK] Sui client already configured${NC}"
fi
echo ""

# Display current status
echo "========================================"
echo "Sui CLI Setup Complete!"
echo "========================================"
echo ""

if command -v sui &> /dev/null; then
    echo -e "${GREEN}Current Status:${NC}"
    echo ""
    
    # Show active address
    SUI_ADDRESS=$(sui client active-address 2>/dev/null || echo "Not set")
    echo "  Active Address: $SUI_ADDRESS"
    
    # Show active environment
    SUI_ENV=$(sui client active-env 2>/dev/null || echo "Not set")
    echo "  Active Environment: $SUI_ENV"
    
    # Show balance if available
    echo ""
    echo -e "${BLUE}Checking balance...${NC}"
    sui client balance 2>/dev/null || echo "  (No balance or not connected)"
    
    echo ""
    echo "========================================"
    echo "Useful Commands:"
    echo "========================================"
    echo ""
    echo "  sui client active-address    # Show your address"
    echo "  sui client active-env        # Show current network"
    echo "  sui client balance           # Check token balance"
    echo "  sui client gas              # Check gas balance"
    echo "  sui client switch --env mainnet  # Switch to mainnet"
    echo "  sui client switch --env testnet  # Switch to testnet"
    echo "  sui client new-address ed25519   # Create new address"
    echo ""
    
    if [ "$SUI_ENV" = "mainnet" ]; then
        echo -e "${YELLOW}Next Steps for Mainnet:${NC}"
        echo "  1. Purchase SUI tokens from exchange"
        echo "  2. Send to your address: $SUI_ADDRESS"
        echo "  3. Verify: sui client balance"
        echo "  4. Then proceed with Walrus setup"
    else
        echo -e "${YELLOW}Next Steps for Testnet:${NC}"
        echo "  1. Get test tokens: https://faucet.sui.io/"
        echo "  2. Enter your address: $SUI_ADDRESS"
        echo "  3. Verify: sui client balance"
        echo "  4. Then proceed with Walrus setup"
    fi
    echo ""
else
    echo -e "${RED}[ERROR] Sui CLI is not available${NC}"
    exit 1
fi

