#!/bin/bash
# Walrus CLI Setup Script for WSL
# This script automates the installation of Rust, Sui CLI, and Walrus CLI

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "========================================"
echo "Walrus CLI Setup in WSL"
echo "========================================"
echo ""

# Step 1: Check Rust
echo -e "${BLUE}[1/6] Checking Rust installation...${NC}"
if ! command -v rustc &> /dev/null; then
    echo -e "${YELLOW}Installing Rust...${NC}"
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
    echo -e "${GREEN}[OK] Rust installed${NC}"
else
    echo -e "${GREEN}[OK] Rust is installed${NC}"
    rustc --version
fi
echo ""

# Step 2: Check suiup (Walrus/Sui installer)
echo -e "${BLUE}[2/7] Checking suiup installation...${NC}"
if ! command -v suiup &> /dev/null; then
    echo -e "${YELLOW}Installing suiup...${NC}"
    curl -sSfL https://raw.githubusercontent.com/Mystenlabs/suiup/main/install.sh | sh
    source $HOME/.cargo/env 2>/dev/null || true
    echo -e "${GREEN}[OK] suiup installed${NC}"
else
    echo -e "${GREEN}[OK] suiup is installed${NC}"
    suiup --version 2>/dev/null || echo "suiup found"
fi
echo ""

# Step 3: Check Sui CLI
echo -e "${BLUE}[3/7] Checking Sui CLI installation...${NC}"
if ! command -v sui &> /dev/null; then
    echo -e "${YELLOW}Installing Sui CLI via suiup (Mainnet branch)...${NC}"
    echo "This may take 5-15 minutes..."
    suiup install sui --branch mainnet
    echo -e "${GREEN}[OK] Sui CLI installed${NC}"
else
    echo -e "${GREEN}[OK] Sui CLI is installed${NC}"
    sui --version
    echo -e "${YELLOW}Note: Ensure you have Mainnet version. If not, run: suiup install sui --branch mainnet${NC}"
fi
echo ""

# Step 4: Check Walrus CLI
echo -e "${BLUE}[4/7] Checking Walrus CLI installation...${NC}"
if ! command -v walrus &> /dev/null; then
    echo -e "${YELLOW}Installing Walrus CLI via suiup...${NC}"
    suiup install walrus
    echo -e "${GREEN}[OK] Walrus CLI installed${NC}"
    walrus --version
else
    echo -e "${GREEN}[OK] Walrus CLI is installed${NC}"
    walrus --version
fi
echo ""

# Step 5: Initialize Sui Client (if needed)
echo -e "${BLUE}[5/7] Checking Sui client configuration...${NC}"
if [ ! -f "$HOME/.sui/sui_config/client.yaml" ]; then
    echo -e "${YELLOW}Initializing Sui client...${NC}"
    echo "You'll need to interact with this step."
    echo ""
    echo "For MAINNET (recommended):"
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
    echo -e "${GREEN}[OK] Sui client configured${NC}"
    echo "Active address: $(sui client active-address 2>/dev/null || echo 'Not set')"
    echo "Active env: $(sui client active-env 2>/dev/null || echo 'Not set')"
fi
echo ""

# Step 6: Create Walrus config directory
echo -e "${BLUE}[6/7] Setting up Walrus config for Mainnet...${NC}"
mkdir -p $HOME/.config/walrus

# Get Sui environment and address
SUI_ENV=$(sui client active-env 2>/dev/null || echo "mainnet")
SUI_ADDRESS=$(sui client active-address 2>/dev/null || echo "")

# Ensure we're on mainnet
if [ "$SUI_ENV" != "mainnet" ]; then
    echo -e "${YELLOW}Switching to Mainnet...${NC}"
    sui client switch --env mainnet 2>/dev/null || echo "Please switch to mainnet manually: sui client switch --env mainnet"
    SUI_ENV="mainnet"
    SUI_ADDRESS=$(sui client active-address 2>/dev/null || echo "")
fi

echo "Sui environment: $SUI_ENV"
if [ -n "$SUI_ADDRESS" ]; then
    echo "Sui address: $SUI_ADDRESS"
else
    echo -e "${YELLOW}[WARN] No Sui address found. Create one with: sui client new-address ed25519${NC}"
fi
echo ""

# Create Mainnet config file
CONFIG_FILE="$HOME/.config/walrus/client_config.yaml"

echo -e "${YELLOW}Creating Walrus Mainnet config...${NC}"
cat > "$CONFIG_FILE" << EOF
contexts:
  mainnet:
    system_object: 0x2134d52768ea07e8c43570ef975eb3e4c27a39fa6396bef985b5abc58d03ddd2
    staking_object: 0x10b9d30c28448939ce6c4d6c6e0ffce4a7f8a4ada8248bdad09ef8b70e4a3904
    subsidies_object: 0xb606eb177899edc2130c93bf65985af7ec959a2755dc126c953755e59324209e
    exchange_objects: []
    wallet_config:
      path: ~/.sui/sui_config/client.yaml
      active_env: mainnet
      active_address: ${SUI_ADDRESS:-YOUR_SUI_ADDRESS_HERE}
default_context: mainnet
EOF

if [ -z "$SUI_ADDRESS" ]; then
    echo -e "${YELLOW}[WARN] Config created but address is missing.${NC}"
    echo "Edit $CONFIG_FILE and replace YOUR_SUI_ADDRESS_HERE with your address"
    echo "Get your address: sui client active-address"
else
    echo -e "${GREEN}[OK] Walrus Mainnet config created${NC}"
fi
echo "Config file: $CONFIG_FILE"
echo ""

# Step 7: Verify setup
echo -e "${BLUE}[7/7] Verifying setup...${NC}"

# Check Walrus info
echo "Checking Walrus connection..."
if walrus info 2>/dev/null | grep -q "Epoch duration"; then
    echo -e "${GREEN}[OK] Walrus is connected${NC}"
    walrus info
else
    echo -e "${YELLOW}[WARN] Could not verify Walrus connection${NC}"
    echo "Run 'walrus info' manually to check"
fi
echo ""

# Check Sui address
SUI_ADDRESS=$(sui client active-address 2>/dev/null || echo "")
if [ -n "$SUI_ADDRESS" ]; then
    echo -e "${GREEN}[OK] Sui address: $SUI_ADDRESS${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Get SUI and WAL tokens (Mainnet):"
    echo "   - Purchase SUI from exchange (Binance, OKX, etc.)"
    echo "   - Send SUI to: $SUI_ADDRESS"
    echo "   - Purchase WAL tokens on Sui DEXes or exchanges"
    echo "   - Check balance: sui client balance"
    echo ""
    echo "2. Test storing a file:"
    echo "   echo 'Hello Walrus on Sui Mainnet!' > test.txt"
    echo "   walrus store test.txt --epochs 1 --context mainnet"
    echo ""
    echo "3. Retrieve a blob:"
    echo "   walrus retrieve --blob-id YOUR_BLOB_ID --context mainnet > retrieved.txt"
    echo ""
    echo "Your Walrus config: $CONFIG_FILE"
    echo "To use in your app, set:"
    echo "  export WALRUS_CONFIG=\"$CONFIG_FILE\""
    echo "  export WALRUS_CONTEXT=\"$SUI_ENV\""
else
    echo -e "${YELLOW}[WARN] No Sui address found. Make sure you completed 'sui client' setup.${NC}"
fi

echo ""
echo "========================================"
echo "Setup Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Get Sui tokens:"
echo "   - Mainnet: Purchase from exchange (Coinbase, Binance, etc.)"
echo "   - Testnet: https://docs.sui.io/build/faucet"
echo "2. Test Walrus: walrus --version"
echo "3. Test storage: python storage/test_walrus.py"
echo ""

