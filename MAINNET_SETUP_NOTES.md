# Mainnet Setup Notes

## ✅ Configuration Updated for Mainnet

All setup scripts and configuration files have been updated to use **mainnet** by default.

## Important: Sui Tokens Required

**Mainnet requires real Sui tokens** (not test tokens). You'll need to:

1. **Purchase Sui tokens** from an exchange:
   - Coinbase
   - Binance
   - Kraken
   - Other major exchanges

2. **Send tokens to your wallet address**:
   ```bash
   # Get your address
   sui client active-address
   ```

3. **Verify balance**:
   ```bash
   sui client gas
   ```

## Setup Process

### Step 1: Run Setup Script

```powershell
.\setup_walrus_windows.ps1
```

Or in WSL:
```bash
bash setup_walrus_wsl.sh
```

### Step 2: Choose Mainnet

When prompted during `sui client` initialization:
- Choose **option 1 (Mainnet)**

### Step 3: Get Sui Tokens

Before testing Walrus, make sure you have Sui tokens:
- Purchase from exchange
- Send to your wallet address
- Verify: `sui client gas`

### Step 4: Test Setup

```bash
# Test Walrus
walrus --version

# Test store (requires Sui tokens)
echo "Test" > /tmp/test.txt
walrus --config ~/.config/walrus/client_config.yaml \
       store /tmp/test.txt \
       --epochs 1 \
       --context mainnet
```

## Environment Variables

Your `storage/.env` should have:

```env
WALRUS_CONFIG=/home/username/.config/walrus/client_config.yaml
WALRUS_CONTEXT=mainnet
WALRUS_USE_WSL=true
```

## Cost Considerations

- **Mainnet transactions cost real Sui tokens**
- Each Walrus store operation requires gas fees
- Estimate: ~0.001-0.01 SUI per transaction (varies with network)

## Switching Networks

If you need to test on testnet first:

```bash
# Switch to testnet
sui client switch --env testnet

# Get test tokens (free)
# Visit: https://docs.sui.io/build/faucet

# Switch back to mainnet
sui client switch --env mainnet
```

## Verification

After setup, verify everything:

```bash
# Check Sui network
sui client active-env
# Should show: mainnet

# Check address
sui client active-address

# Check balance
sui client gas
# Should show your Sui balance

# Check Walrus config
cat ~/.config/walrus/client_config.yaml
# Should show mainnet context
```

## Ready to Go!

Once you have Sui tokens and the setup is complete, your dual storage system (PostgreSQL + Walrus) will use mainnet for all Walrus operations.

