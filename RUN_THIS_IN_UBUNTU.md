# Run These Commands in Ubuntu Terminal

## ⚠️ IMPORTANT: Run These Manually

**Open Ubuntu terminal directly:**
```powershell
wsl -d Ubuntu
```

**Then copy-paste these commands one by one:**

---

## Step 1: Install Rust (if needed)

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
rustc --version
```

**Time: ~2 minutes**

---

## Step 2: Install Sui CLI (LONG - 10-30 minutes!)

```bash
# Install suiup
curl -sSfL https://raw.githubusercontent.com/MystenLabs/suiup/main/install.sh | sh
source $HOME/.cargo/env

# Install Sui CLI - THIS TAKES 10-30 MINUTES!
# Don't close terminal, don't interrupt!
suiup install sui --branch mainnet
```

**Time: 10-30 minutes - BE PATIENT!**
**You'll see compilation output - this is normal!**

---

## Step 3: Verify Sui

```bash
export PATH="$HOME/.cargo/bin:$PATH"
sui --version
```

**Should show: sui 1.17.2 or similar**

---

## Step 4: Initialize Sui Client

```bash
sui client
```

**Answer prompts:**
- `y` (connect to full node)
- `1` (for mainnet)

---

## Step 5: Create Wallet

```bash
sui client new-address ed25519
```

**⚠️ SAVE THE 24-WORD RECOVERY PHRASE!**

---

## Step 6: Get Your Address

```bash
sui client active-address
```

**Copy this address - you'll need it!**

---

## Step 7: Install Walrus CLI

```bash
curl -sSf https://docs.wal.app/setup/walrus-install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
walrus --version
```

**Time: ~1 minute**

---

## Step 8: Create Walrus Config

```bash
# Get your address
ADDRESS=$(sui client active-address)
CONFIG_PATH="$HOME/.sui/sui_config/client.yaml"

# Create config
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

echo "Config created!"
```

---

## Step 9: Test (Optional - requires SUI tokens)

```bash
echo "Hello Walrus!" > /tmp/test.txt
walrus store /tmp/test.txt --epochs 1 --context mainnet
```

**Note:** This requires SUI tokens. If you don't have them yet, skip this step.

---

## That's It!

**Total time: 15-35 minutes**
**Most time is Step 2 (Sui compilation) - be patient!**

---

## If You Get Errors

**"Command not found":**
```bash
# Add to PATH
export PATH="$HOME/.cargo/bin:$PATH"
export PATH="$HOME/.local/bin:$PATH"
```

**"Insufficient gas":**
- You need SUI tokens
- Buy from exchange or use testnet

**Compilation taking too long:**
- This is normal! 10-30 minutes is expected
- Don't interrupt it

---

## Next Steps After Setup

Once everything is installed:
1. Get SUI tokens (buy from exchange)
2. Test Walrus storage
3. Integrate with your dual storage system

**You're all set!** 🚀

