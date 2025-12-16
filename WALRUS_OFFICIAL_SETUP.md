# Walrus Official Setup Guide

Based on the [official Walrus documentation](https://docs.wal.app/docs/usage/started), here's the correct setup process.

## Quick Start

### Step 1: Install suiup

```bash
curl -sSfL https://raw.githubusercontent.com/Mystenlabs/suiup/main/install.sh | sh
source $HOME/.cargo/env
```

### Step 2: Install Sui and Walrus

```bash
suiup install sui
suiup install walrus
```

### Step 3: Configure Sui Client

```bash
sui client
```

When prompted:
- **Connect to a Sui Full Node server?** → Y
- **Full node server URL:**
  - Mainnet: `https://fullnode.mainnet.sui.io:443`
  - Testnet: `https://fullnode.testnet.sui.io:443`
- **Environment alias:** `mainnet` or `testnet`
- **Select key scheme:** `0` (for ed25519)

### Step 4: Download Walrus Config

```bash
curl --create-dirs https://docs.wal.app/setup/client_config.yaml -o ~/.config/walrus/client_config.yaml
```

### Step 5: Verify Setup

```bash
# Check Walrus connection
walrus info

# Should show "Epoch duration: 1day" for testnet
# Or "Epoch duration: 2weeks" for mainnet
```

### Step 6: Get Tokens

**For Testnet:**
1. Visit: https://faucet.sui.io/
2. Select **Testnet**
3. Enter your address: `sui client active-address`
4. Get SUI tokens

**For Mainnet:**
1. Purchase SUI from exchange (Coinbase, Binance, etc.)
2. Send to your address: `sui client active-address`

### Step 7: Convert SUI to WAL

```bash
# Convert SUI to WAL tokens (needed for storage)
walrus get-wal --context testnet  # or mainnet
```

### Step 8: Test Storage

```bash
# Create test file
echo "Hello, Walrus!" > test.txt

# Store it
walrus store test.txt --epochs 2 --context testnet

# Note the Blob ID from output
```

### Step 9: Retrieve Blob

```bash
# Retrieve using blob ID
walrus read <blob-id> --out retrieved.txt --context testnet
```

## Important Notes

### Epochs
- **Testnet:** 1 day per epoch
- **Mainnet:** 2 weeks per epoch
- You must specify `--epochs` when storing

### Tokens Needed
- **SUI tokens:** For transaction fees
- **WAL tokens:** For storage costs
- On Testnet: WAL and SUI are 1:1 exchangeable (testnet only)

### Commands

```bash
# Store a file
walrus store <file> --epochs <number> --context <testnet|mainnet>

# Read a blob
walrus read <blob-id> --out <output-file> --context <testnet|mainnet>

# Extend storage
walrus extend --blob-obj-id <sui-object-id> --epochs-extended <number> --context <testnet|mainnet>

# Delete a blob
walrus delete --blob-id <blob-id> --context <testnet|mainnet>

# Get info
walrus info

# Get WAL tokens
walrus get-wal --context <testnet|mainnet>
```

## For Your Application

Update `storage/.env`:

```env
WALRUS_CONFIG=/home/username/.config/walrus/client_config.yaml
WALRUS_CONTEXT=mainnet  # or testnet
WALRUS_USE_WSL=true
```

## References

- Official Docs: https://docs.wal.app/docs/usage/started
- Sui Faucet: https://faucet.sui.io/
- Discord: https://discord.gg/walrus

