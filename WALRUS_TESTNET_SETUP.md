# Walrus Testnet Setup (Official Steps)

## Quick Summary

This guide follows the official Walrus documentation exactly. We're using **Testnet** (free tokens, good for testing).

---

## Step 1: Install Tooling

**Open Ubuntu terminal first:**
```powershell
wsl -d Ubuntu
```

**Then run these commands in Ubuntu:**

```bash
# Install suiup (the installer tool)
curl -sSfL https://raw.githubusercontent.com/Mystenlabs/suiup/main/install.sh | sh

# Reload environment
source $HOME/.cargo/env

# Install Sui CLI
suiup install sui

# Install Walrus CLI
suiup install walrus

# Verify installations
sui --version
walrus --version
```

---

## Step 2: Configure for Testnet

```bash
# Download Walrus config file
curl --create-dirs https://docs.wal.app/setup/client_config.yaml -o ~/.config/walrus/client_config.yaml

# Initialize Sui client (INTERACTIVE)
sui client
```

**When prompted, enter:**
- Connect to a Sui Full Node server? → **Y**
- Full node server URL → **https://fullnode.testnet.sui.io:443**
- Environment alias → **testnet**
- Select key scheme → **0** (for ed25519)

```bash
# Verify Walrus config
walrus info
# Should show: Epoch duration: 1day (indicates Testnet)
```

---

## Step 3: Get Your Address

```bash
# View your address
sui client active-address

# Copy this address - you'll need it for the faucet!
```

---

## Step 4: Get Free Testnet Tokens

1. **Go to:** https://faucet.sui.io/
2. **Select:** Testnet
3. **Paste:** Your address from Step 3
4. **Click:** Get tokens

```bash
# Check your balance
sui client balance

# Convert SUI to WAL tokens
walrus get-wal --context testnet

# Check balance again
sui client balance
# Should show both SUI and WAL tokens
```

---

## Step 5: Test - Store a Blob

```bash
# Create a test file
echo "Hello Walrus Testnet!" > ~/test_walrus.txt

# Store it on Walrus
walrus store ~/test_walrus.txt --epochs 2 --context testnet

# Save the Blob ID from the output!
# Example: Blob ID: oehkoh0352bRGNPjuwcy0nye3OLKT649K62imdNAlXg
```

---

## Step 6: Test - Retrieve a Blob

```bash
# Replace YOUR_BLOB_ID with the actual Blob ID from Step 5
walrus read YOUR_BLOB_ID --out ~/retrieved.txt --context testnet

# Verify the content
cat ~/retrieved.txt
# Should show: Hello Walrus Testnet!
```

---

## All Commands in One Block

Copy-paste friendly version:

```bash
# === STEP 1: Install tooling ===
curl -sSfL https://raw.githubusercontent.com/Mystenlabs/suiup/main/install.sh | sh
source $HOME/.cargo/env
suiup install sui
suiup install walrus
sui --version
walrus --version

# === STEP 2: Configure for Testnet ===
curl --create-dirs https://docs.wal.app/setup/client_config.yaml -o ~/.config/walrus/client_config.yaml
sui client
# Answer prompts: Y, https://fullnode.testnet.sui.io:443, testnet, 0

# === STEP 3: Get address ===
sui client active-address

# === STEP 4: Get tokens ===
# Visit https://faucet.sui.io/ and paste your address
sui client balance
walrus get-wal --context testnet
sui client balance

# === STEP 5: Store a blob ===
echo "Hello Walrus!" > ~/test.txt
walrus store ~/test.txt --epochs 2 --context testnet

# === STEP 6: Retrieve a blob ===
# walrus read YOUR_BLOB_ID --out ~/retrieved.txt --context testnet
```

---

## Expected Output

After completing all steps, you should see:

```
# sui --version
sui 1.x.x

# walrus --version
walrus 0.x.x

# sui client balance
╭─────────────────────────────────────────╮
│ Balance of coins owned by this address  │
├─────────────────────────────────────────┤
│ ╭─────────────────────────────────────╮ │
│ │ coin  balance (raw)     balance     │ │
│ ├─────────────────────────────────────┤ │
│ │ Sui        497664604      0.49 SUI  │ │
│ │ WAL Token  500000000      0.50 WAL  │ │
│ ╰─────────────────────────────────────╯ │
╰─────────────────────────────────────────╯
```

---

## Troubleshooting

### "Command not found"
```bash
source $HOME/.cargo/env
export PATH="$HOME/.local/bin:$PATH"
```

### "No tokens"
- Make sure you used the faucet: https://faucet.sui.io/
- Wait a few seconds after requesting tokens
- Check balance: `sui client balance`

### "Epoch duration" not showing 1day
- Wrong network - reconfigure with:
```bash
sui client switch --env testnet
```

---

## Done!

Once you complete these steps, Walrus is set up and working on Testnet.

**Next:** Integrate with your dual storage system (PostgreSQL + Walrus).

