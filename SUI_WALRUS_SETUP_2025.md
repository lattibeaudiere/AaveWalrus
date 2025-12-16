# Setting Up Sui and Walrus CLI System (December 2025)

Based on the latest documentation, this guide covers Mainnet setup for Sui and Walrus CLI.

## Overview

Walrus is a decentralized blob storage protocol built on the Sui blockchain. Mainnet launched in March 2025. This guide focuses on **Mainnet setup** (Testnet gets wiped periodically).

## Prerequisites

- Terminal (macOS/Linux recommended; Windows use WSL)
- Rust installed: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- Git (optional but useful)

---

## Step 1: Install Sui CLI

### Install suiup (Recommended)

```bash
curl -sSfL https://raw.githubusercontent.com/MystenLabs/suiup/main/install.sh | sh
```

Follow prompts; it adds suiup to your PATH (restart terminal or `source ~/.bashrc`).

### Install Sui for Mainnet

```bash
suiup install sui --branch mainnet
```

### Verify Installation

```bash
sui --version
```

Should show the latest Mainnet version.

### Alternative (if suiup issues)

```bash
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch mainnet sui
```

---

## Step 2: Set Up Sui Wallet

### Switch to Mainnet

```bash
sui client switch --env mainnet
```

### Create New Address/Wallet

```bash
sui client new-address ed25519
```

**Important:**
- Note your new address (e.g., `0xabc...`)
- **Backup your recovery phrase securely!**

### Set as Active Address

```bash
sui client switch --address YOUR_SUI_ADDRESS
```

### Fund Your Wallet

1. **Buy SUI** on exchanges (Binance, OKX) and transfer to your address
2. **Buy WAL tokens** (required for storage payments) on Sui DEXes or exchanges
3. **Check balance:**

```bash
sui client balance
```

---

## Step 3: Install Walrus CLI

### Via suiup (Recommended)

```bash
suiup install walrus
```

### Verify

```bash
walrus --version
```

### Alternative Manual Install

If needed, download the latest binary from Walrus releases and add to PATH.

---

## Step 4: Configure Walrus for Mainnet

### Create Config Directory

```bash
mkdir -p ~/.config/walrus
```

### Create Config File

Create `~/.config/walrus/client_config.yaml`:

```yaml
contexts:
  mainnet:
    system_object: 0x2134d52768ea07e8c43570ef975eb3e4c27a39fa6396bef985b5abc58d03ddd2
    staking_object: 0x10b9d30c28448939ce6c4d6c6e0ffce4a7f8a4ada8248bdad09ef8b70e4a3904
    subsidies_object: 0xb606eb177899edc2130c93bf65985af7ec959a2755dc126c953755e59324209e
    exchange_objects: []
    wallet_config:
      path: ~/.sui/sui_config/client.yaml
      active_env: mainnet
      active_address: YOUR_SUI_ADDRESS_HERE  # Replace with your address
default_context: mainnet
```

**Replace `YOUR_SUI_ADDRESS_HERE` with your actual Sui address.**

### Optional: Set Environment Variable

```bash
export WALRUS_CONFIG=~/.config/walrus/client_config.yaml
```

---

## Step 5: Test Your Walrus Setup

### Create Test File

```bash
echo "Hello Walrus on Sui Mainnet!" > ~/test.txt
```

### Store a Blob

```bash
walrus store ~/test.txt --epochs 1 --context mainnet
```

**Output includes Blob ID** (save it!)

**Note:** Short epochs for testing; longer for production.

### Retrieve the Blob

```bash
walrus retrieve --blob-id YOUR_BLOB_ID --context mainnet > retrieved.txt
cat retrieved.txt
```

Should match original.

### List Your Blobs (if supported)

```bash
walrus blobs
```

---

## Troubleshooting

### Insufficient Funds
- Ensure SUI for gas + WAL for storage

### Config Errors
- Run with `--config PATH` flag if needed
- Verify your address in config file

### Help Commands
```bash
walrus --help
walrus store --help
walrus retrieve --help
```

### Explorer
- View blobs/transactions on [Sui Explorer](https://explorer.sui.io/)
- Walrus-specific tools if available

### Updates
```bash
suiup update
```

---

## Next Steps

- Integrate into apps via CLI, HTTP API, or Rust SDK
- For large files/AI datasets: Use longer epochs
- Explore Walrus Sites for decentralized websites

---

## Quick Reference

### Sui Commands
```bash
sui client active-address          # Show your address
sui client active-env              # Show current network
sui client balance                 # Check token balance
sui client switch --env mainnet    # Switch to mainnet
sui client new-address ed25519     # Create new address
```

### Walrus Commands
```bash
walrus store <file> --epochs <n> --context mainnet
walrus retrieve --blob-id <id> --context mainnet
walrus blobs                        # List your blobs
walrus --help                      # Get help
```

---

## For Your Application

Update `storage/.env`:

```env
WALRUS_CONFIG=/home/username/.config/walrus/client_config.yaml
WALRUS_CONTEXT=mainnet
WALRUS_USE_WSL=true  # If using WSL on Windows
```

---

You're now set up with a fully functional Sui + Walrus CLI system on Mainnet! 🚀

