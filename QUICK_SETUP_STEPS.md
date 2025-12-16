# Quick Setup: Sui CLI + Walrus CLI

## Copy-Paste Commands (Run in Ubuntu Terminal)

### Step 1: Open Ubuntu Terminal
```bash
# Open Ubuntu directly
wsl -d Ubuntu
```

### Step 2: Install Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
rustc --version
```

### Step 3: Install Sui CLI (10-30 minutes - BE PATIENT!)
```bash
curl -sSfL https://raw.githubusercontent.com/Mystenlabs/suiup/main/install.sh | sh
source $HOME/.cargo/env
suiup install sui --branch mainnet
```

### Step 4: Verify Sui & Add to PATH
```bash
export PATH="$HOME/.cargo/bin:$PATH"
sui --version
```

### Step 5: Initialize Sui Client (Interactive)
```bash
sui client
# Answer prompts:
# y (connect to full node)
# 1 (for mainnet)
```

### Step 6: Create Wallet (Interactive)
```bash
sui client new-address ed25519
# SAVE THE RECOVERY PHRASE!
```

### Step 7: Get Your Address
```bash
sui client active-address
# Copy this address for later
```

### Step 8: Install Walrus CLI
```bash
curl -sSf https://docs.wal.app/setup/walrus-install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
walrus --version
```

### Step 9: Create Walrus Config
```bash
# Get your username and address
USERNAME=$(whoami)
ADDRESS=$(sui client active-address)
CONFIG_PATH="$HOME/.sui/sui_config/client.yaml"

# Create config directory and file
mkdir -p ~/.config/walrus
cat > ~/.config/walrus/client_config.yaml << EOF
contexts:
  mainnet:
    system_object: 0x2134d52768ea07e8c43570ef975eb3e4c27a39fa6396bef985b5abc58d03ddd2
    staking_object: 0x10b9d30c28448939ce6c4d6c6e0ffce4a7f8a4ada8248bdad09ef8b70e4a3904
    subsidies_object: 0xb606eb177899edc2130c93bf65985af7ec959a2755dc126c953755e59324209e
    exchange_objects: []
    wallet_config:
      path: $CONFIG_PATH
      active_env: mainnet
      active_address: $ADDRESS
default_context: mainnet
EOF

echo "Config created at: ~/.config/walrus/client_config.yaml"
```

### Step 10: Test Walrus
```bash
# Create test file
echo "Hello Walrus!" > /tmp/test.txt

# Store (requires SUI tokens - you may need to get them first)
walrus store /tmp/test.txt --epochs 1 --context mainnet

# Note the Blob ID from output, then retrieve:
# walrus retrieve --blob-id YOUR_BLOB_ID --context mainnet
```

---

## Quick Reference

**If you need Sui tokens for mainnet:**
1. Buy SUI on exchange (Coinbase, Binance, etc.)
2. Send to your address: `sui client active-address`
3. Check balance: `sui client gas`

**For testing (testnet):**
```bash
sui client switch --env testnet
# Get tokens from: https://docs.sui.io/build/faucet
```

---

## That's It!

**Total time: 15-35 minutes**
**Most time is Sui compilation (10-30 min) - be patient!**

Run these commands one by one in Ubuntu terminal. If anything fails, let me know the exact error message.
