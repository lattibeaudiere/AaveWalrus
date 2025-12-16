# Walrus CLI Setup Guide

This guide will help you install and configure Walrus CLI for decentralized blob storage.

## Quick Setup (Windows with WSL)

If you're on Windows, use the automated setup script:

```powershell
.\setup_walrus_windows.ps1
```

This script will:
1. Check WSL installation
2. Install Rust, Sui CLI, and Walrus CLI in WSL
3. Configure your Sui wallet
4. Create Walrus config file
5. Update your `.env` file

## Manual Setup

For detailed step-by-step instructions, see the comprehensive guide below or follow the official documentation.

---

## Prerequisites

### Windows Users
- **WSL (Windows Subsystem for Linux)** is required
- Install WSL: Run PowerShell as Administrator → `wsl --install`
- Restart your computer after installation

### macOS/Linux Users
- Continue directly to installation steps

---

## Part 1: Install Sui CLI

Walrus Protocol runs on the Sui blockchain, so we need Sui CLI first.

### Step 1.1: Install Rust

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Follow prompts (press Enter for defaults)
# Reload shell
source $HOME/.cargo/env

# Verify
rustc --version
```

### Step 1.2: Install Sui CLI

**Option A: Pre-built Binary (Recommended)**
```bash
cargo install --git https://github.com/MystenLabs/sui.git --tag mainnet-v1.17.2 --locked sui
```

**Option B: Build from Source**
```bash
git clone https://github.com/MystenLabs/sui.git
cd sui
git checkout mainnet-v1.17.2
cargo install --path crates/sui
```

**Option C: Homebrew (macOS only)**
```bash
brew install sui
```

### Step 1.3: Verify Installation

```bash
sui --version
# Should output: sui 1.17.2
```

---

## Part 2: Set Up Sui Wallet

### Step 2.1: Initialize Sui Client

```bash
sui client

# Choose network:
# 1) Mainnet (recommended for production)
# 2) Testnet (for testing only)
# 3) Devnet
# 4) Localnet
```

### Step 2.2: Create Wallet Address

```bash
sui client new-address ed25519
```

**⚠️ IMPORTANT:** Save your recovery phrase securely!

### Step 2.3: Verify Setup

```bash
sui client active-address
sui client active-env
```

---

## Part 3: Get Sui Tokens

**For Mainnet (Production):**
- Purchase Sui tokens from an exchange (Coinbase, Binance, etc.)
- Send tokens to your wallet address
- Check balance: `sui client gas`

**For Testnet (Testing Only):**
```bash
# Switch to testnet
sui client switch --env testnet

# Get your address
MY_ADDRESS=$(sui client active-address)
echo "Your address: $MY_ADDRESS"

# Request test tokens
# Visit: https://docs.sui.io/build/faucet
# Or use API:
curl -X POST https://faucet.testnet.sui.io/gas \
  -H "Content-Type: application/json" \
  -d "{\"FixedAmountRequest\":{\"recipient\":\"$MY_ADDRESS\"}}"

# Check balance
sui client gas
```

---

## Part 4: Install Walrus CLI

```bash
# Install Walrus CLI
curl -sSf https://docs.wal.app/setup/walrus-install.sh | sh

# Add to PATH if needed
export PATH="$HOME/.local/bin:$PATH"
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Verify
walrus --version
```

---

## Part 5: Configure Walrus

### Step 5.1: Get Your Information

```bash
# Get your Sui address
SUI_ADDRESS=$(sui client active-address)

# Get wallet path
WALLET_PATH="$HOME/.sui/sui_config/client.yaml"

# Get environment
SUI_ENV=$(sui client active-env)
```

### Step 5.2: Create Config File

```bash
mkdir -p ~/.config/walrus
```

**For Mainnet:**
```bash
cat > ~/.config/walrus/client_config.yaml << EOF
contexts:
  mainnet:
    system_object: 0x2134d52768ea07e8c43570ef975eb3e4c27a39fa6396bef985b5abc58d03ddd2
    staking_object: 0x10b9d30c28448939ce6c4d6c6e0ffce4a7f8a4ada8248bdad09ef8b70e4a3904
    subsidies_object: 0xb606eb177899edc2130c93bf65985af7ec959a2755dc126c953755e59324209e
    exchange_objects: []
    wallet_config:
      path: $WALLET_PATH
      active_env: mainnet
      active_address: $SUI_ADDRESS
default_context: mainnet
EOF
```

**For Testnet (Testing Only):**
```bash
# Switch to testnet first
sui client switch --env testnet

cat > ~/.config/walrus/client_config.yaml << EOF
contexts:
  testnet:
    system_object: 0x0000000000000000000000000000000000000000000000000000000000000002
    staking_object: 0x0000000000000000000000000000000000000000000000000000000000000002
    subsidies_object: 0x0000000000000000000000000000000000000000000000000000000000000002
    exchange_objects: []
    wallet_config:
      path: $WALLET_PATH
      active_env: testnet
      active_address: $SUI_ADDRESS
default_context: testnet
EOF
```

**⚠️ Replace placeholders:**
- `$WALLET_PATH` → Your actual wallet path
- `$SUI_ADDRESS` → Your actual Sui address

---

## Part 6: Test Your Setup

### Step 6.1: Test Store

```bash
# Create test file
echo "Hello, Walrus!" > /tmp/test.txt

# Store in Walrus (use mainnet or testnet based on your config)
walrus --config ~/.config/walrus/client_config.yaml \
       store /tmp/test.txt \
       --epochs 1 \
       --context mainnet

# Note the Blob ID from output
```

### Step 6.2: Test Retrieve

```bash
# Replace BLOB_ID with actual blob ID
walrus --config ~/.config/walrus/client_config.yaml \
       retrieve --blob-id BLOB_ID \
       --context mainnet
```

---

## Part 7: Configure Your App

Update `storage/.env`:

```env
# Walrus Configuration
WALRUS_CONFIG=/home/username/.config/walrus/client_config.yaml
WALRUS_CONTEXT=mainnet
WALRUS_USE_WSL=true  # Set to true if using WSL on Windows
```

**For Windows WSL users:**
- Use the WSL path format: `/home/username/.config/walrus/client_config.yaml`
- Set `WALRUS_USE_WSL=true`

---

## Troubleshooting

### "command not found: walrus"
```bash
# Add to PATH
export PATH="$HOME/.local/bin:$PATH"
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### "insufficient gas"
```bash
# Check balance
sui client gas

# Get test tokens: https://docs.sui.io/build/faucet
```

### "config file not found"
- Use absolute paths (not `~`)
- For WSL on Windows, use WSL paths: `/home/username/...`

### "transaction failed"
- Check Sui connection: `sui client active-env`
- Verify you have gas: `sui client gas`
- Make sure you're on the correct network: `sui client active-env`
- For testing, you can try testnet: `sui client switch --env testnet`

---

## Quick Reference

```bash
# Sui Commands
sui client active-address          # Get address
sui client active-env              # Check network
sui client gas                     # Check balance
sui client switch --env mainnet    # Switch to mainnet
sui client switch --env testnet    # Switch to testnet

# Walrus Commands
walrus --version                   # Check version
walrus --config ~/.config/walrus/client_config.yaml store FILE --epochs 1 --context mainnet
walrus --config ~/.config/walrus/client_config.yaml retrieve --blob-id BLOB_ID --context mainnet
```

---

## Verification Checklist

- [ ] Sui CLI installed: `sui --version`
- [ ] Sui wallet created: `sui client active-address`
- [ ] Sui balance > 0: `sui client gas` (mainnet requires purchased tokens)
- [ ] Walrus CLI installed: `walrus --version`
- [ ] Walrus config created: `ls ~/.config/walrus/client_config.yaml`
- [ ] Test store works: Can store a test file
- [ ] Test retrieve works: Can retrieve using blob ID
- [ ] `.env` file configured with correct paths

---

## Next Steps

Once setup is complete:

1. ✅ Test from your app: `python storage/test_walrus.py`
2. ✅ Test dual storage: `python storage/test_dual_storage.py`
3. ✅ Start capturing Aave events with Walrus backup

Your dual storage system (PostgreSQL + Walrus) is now ready! 🎉

