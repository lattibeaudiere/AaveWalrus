# Setup Walrus in GitHub Codespaces

## Overview

GitHub Codespaces gives you a free cloud Linux environment (60 hours/month free). Perfect for running Sui/Walrus setup without local installation!

---

## Step 1: Create GitHub Repository

### Option A: Create New Repo

1. Go to: https://github.com/new
2. Repository name: `walrus-setup` (or any name)
3. Choose: **Public** or **Private**
4. **Don't** initialize with README (we'll add files)
5. Click: **Create repository**

### Option B: Use Existing Repo

If you already have a GitHub repo, you can use that.

---

## Step 2: Open in Codespaces

1. Go to your repository on GitHub
2. Click the green **"Code"** button
3. Click **"Codespaces"** tab
4. Click **"Create codespace on main"**

**Wait:** Codespace will start (takes 1-2 minutes)

---

## Step 3: Codespace Opens

You'll see:
- VS Code interface in browser
- Terminal at the bottom
- Full Linux environment (Ubuntu-based)

**You're now in a cloud Linux terminal!**

---

## Step 4: Run Setup Commands

**Copy-paste these commands one by one in the Codespaces terminal:**

### COMMAND 1: Install suiup

```bash
curl -sSfL https://raw.githubusercontent.com/Mystenlabs/suiup/main/install.sh | sh
```

**Wait for:** Installation to complete

---

### COMMAND 2: Reload Environment

```bash
source $HOME/.cargo/env
```

**Wait for:** Prompt to return

---

### COMMAND 3: Install Sui CLI (10-30 minutes)

```bash
suiup install sui
```

**Wait for:** Compilation to finish (10-30 minutes - be patient!)

**You'll see compilation output - this is normal!**

---

### COMMAND 4: Verify Sui

```bash
sui --version
```

**Should show:** `sui 1.x.x`

---

### COMMAND 5: Install Walrus CLI

```bash
suiup install walrus
```

**Wait for:** Installation (usually quick, ~1 minute)

---

### COMMAND 6: Verify Walrus

```bash
walrus --version
```

**Should show:** `walrus 0.x.x`

---

### COMMAND 7: Download Walrus Config

```bash
curl --create-dirs https://docs.wal.app/setup/client_config.yaml -o ~/.config/walrus/client_config.yaml
```

**Wait for:** Download to complete

---

### COMMAND 8: Initialize Sui Client (INTERACTIVE)

```bash
sui client
```

**When prompted, type:**
- `y` (then Enter)
- `https://fullnode.testnet.sui.io:443` (then Enter)
- `testnet` (then Enter)
- `0` (then Enter)

**Wait for:** Configuration to complete

---

### COMMAND 9: Get Your Address

```bash
sui client active-address
```

**Copy this address!** You'll need it for the faucet.

---

### COMMAND 10: Verify Walrus Config

```bash
walrus info
```

**Should show:** `Epoch duration: 1day` (means Testnet is working)

---

### COMMAND 11: Get Free Testnet Tokens

**NOT A COMMAND - DO IN BROWSER:**

1. Go to: https://faucet.sui.io/
2. Select: **Testnet**
3. Paste: Your address from Command 9
4. Click: Get tokens
5. Wait: A few seconds

---

### COMMAND 12: Check Balance

```bash
sui client balance
```

**Should show:** SUI tokens (like 0.49 SUI)

---

### COMMAND 13: Convert SUI to WAL

```bash
walrus get-wal --context testnet
```

**Wait for:** Conversion to complete

---

### COMMAND 14: Check Balance Again

```bash
sui client balance
```

**Should show:** Both SUI and WAL tokens

---

### COMMAND 15: Test - Store a Blob

```bash
echo "Hello Walrus from Codespaces!" > ~/test.txt
walrus store ~/test.txt --epochs 2 --context testnet
```

**Copy the Blob ID from output!**

---

### COMMAND 16: Test - Retrieve Blob

```bash
walrus read YOUR_BLOB_ID_HERE --out ~/retrieved.txt --context testnet
```

**Replace `YOUR_BLOB_ID_HERE` with actual Blob ID**

---

### COMMAND 17: Verify Retrieved File

```bash
cat ~/retrieved.txt
```

**Should show:** "Hello Walrus from Codespaces!"

---

## Step 5: Save Your Configuration

### Save Sui Wallet

```bash
# Your wallet config is at:
echo $HOME/.sui/sui_config/client.yaml

# Your Walrus config is at:
echo $HOME/.config/walrus/client_config.yaml
```

**Important:** Codespaces are temporary! Save these files:

### Option A: Download Files

1. In Codespaces, right-click the files
2. Click "Download"
3. Save to your computer

### Option B: Copy to Your Repo

```bash
# Copy configs to repo
cp ~/.sui/sui_config/client.yaml ./sui-wallet-config.yaml
cp ~/.config/walrus/client_config.yaml ./walrus-config.yaml

# Commit to repo
git add sui-wallet-config.yaml walrus-config.yaml
git commit -m "Save Sui and Walrus configs"
git push
```

**⚠️ SECURITY WARNING:** Don't commit wallet configs with private keys to public repos!

---

## Step 6: Connect to Your Local System

### Option A: Use Codespaces as Remote Service

Keep Codespaces running and use it as a remote Walrus service:

```python
# In your local Python code
import subprocess

def store_to_walrus_via_codespaces(data):
    # SSH or API call to Codespaces
    # Store blob
    # Return blob_id
    pass
```

### Option B: Export Configs and Use Locally

1. Download configs from Codespaces
2. Set up locally (when ready)
3. Use same wallet/config

---

## Step 7: Keep Codespace Running

**Important:** Codespaces stop after inactivity.

**To keep it running:**
- Codespaces auto-stop after 30 minutes of inactivity
- Free tier: 60 hours/month
- Can restart anytime

**To restart:**
1. Go to: https://github.com/codespaces
2. Click your codespace
3. Click "Start"

---

## Troubleshooting

### Codespace Won't Start

- Check: GitHub account has Codespaces enabled
- Try: Different browser
- Check: GitHub status page

### Commands Timeout

- Codespaces have more resources than local
- Should be faster than local compilation
- If timeout: Restart codespace

### Can't Access Files

- Files are in Codespaces cloud storage
- Download via VS Code interface
- Or commit to GitHub repo

### Wallet Not Persisting

- Codespaces are ephemeral
- **Save your recovery phrase!**
- Download wallet config files
- Or commit to private repo (careful with keys!)

---

## Cost

**Free Tier:**
- 60 hours/month free
- 2-core machine
- 4GB RAM
- 32GB storage

**Paid:**
- $0.18/hour after free tier
- More powerful machines available

**For this setup:** Free tier is plenty!

---

## Advantages of Codespaces

✅ **No local installation** - everything in cloud
✅ **Free tier** - 60 hours/month
✅ **Browser-based** - access from anywhere
✅ **Pre-configured** - Linux environment ready
✅ **More powerful** - faster than local compilation
✅ **Easy to restart** - can pause/resume anytime

---

## Next Steps

1. ✅ Set up Codespaces (Steps 1-3)
2. ✅ Install Sui/Walrus (Commands 1-17)
3. ✅ Test storage/retrieval
4. ✅ Save your configs
5. ✅ Connect to your local system (or use Codespaces as remote service)

---

## Quick Reference

**All Commands in Order:**

```bash
# 1. Install tools
curl -sSfL https://raw.githubusercontent.com/Mystenlabs/suiup/main/install.sh | sh
source $HOME/.cargo/env
suiup install sui
suiup install walrus

# 2. Configure
curl --create-dirs https://docs.wal.app/setup/client_config.yaml -o ~/.config/walrus/client_config.yaml
sui client
# Answer: y, https://fullnode.testnet.sui.io:443, testnet, 0

# 3. Get tokens
sui client active-address
# Use faucet: https://faucet.sui.io/
sui client balance
walrus get-wal --context testnet

# 4. Test
echo "test" > ~/test.txt
walrus store ~/test.txt --epochs 2 --context testnet
walrus read BLOB_ID --out ~/retrieved.txt --context testnet
```

---

**You're all set!** 🚀

Run these in Codespaces and you'll have Walrus working in the cloud, no local installation needed!

