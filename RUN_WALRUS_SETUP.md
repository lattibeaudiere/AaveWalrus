# Run Walrus Setup - Manual Instructions

Since the automated script may be interactive or take time, here's how to run it manually:

## Quick Start

Open PowerShell and run:

```powershell
wsl -d Ubuntu
```

Then in Ubuntu:

```bash
cd /mnt/c/Users/R_Lat/Downloads/fusion\ vault
bash setup_walrus_wsl.sh
```

## What the Setup Does

The script will:
1. ✅ Check/Install Rust (~5-10 minutes)
2. ✅ Check/Install Sui CLI (~10-30 minutes)
3. ✅ Set up Sui wallet (interactive - you'll need to choose mainnet)
4. ✅ Install Walrus CLI (~2-5 minutes)
5. ✅ Create Walrus config file
6. ✅ Test the setup

**Total time: 15-45 minutes** (mostly Sui CLI compilation)

## Interactive Steps

During setup, you'll be prompted:

1. **Sui client initialization:**
   - Choose network: Select **1 (Mainnet)**
   - This will create your wallet

2. **If wallet creation is needed:**
   - You'll get a recovery phrase - **SAVE THIS SECRETLY!**
   - Write it down on paper

## Alternative: Run Step by Step

If you prefer to run manually:

```bash
# Launch Ubuntu
wsl -d Ubuntu

# Navigate to project
cd /mnt/c/Users/R_Lat/Downloads/fusion\ vault

# Step 1: Check Rust
rustc --version
# If not installed:
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Step 2: Check Sui CLI
sui --version
# If not installed:
cargo install --git https://github.com/MystenLabs/sui.git --tag mainnet-v1.17.2 --locked sui

# Step 3: Initialize Sui client
sui client
# Choose: 1 (Mainnet)

# Step 4: Install Walrus CLI
curl -sSf https://docs.wal.app/setup/walrus-install.sh | sh
export PATH="$HOME/.local/bin:$PATH"

# Step 5: Create config (the script does this automatically)
# Or follow WALRUS_SETUP_GUIDE.md for manual config
```

## After Setup

Once complete:

1. **Get Sui tokens** (for mainnet):
   - Purchase from exchange (Coinbase, Binance, etc.)
   - Send to your wallet address: `sui client active-address`

2. **Test Walrus:**
   ```bash
   walrus --version
   ```

3. **Update your .env:**
   ```bash
   # Get config path
   echo $HOME/.config/walrus/client_config.yaml
   ```

4. **Test from Python:**
   ```bash
   cd /mnt/c/Users/R_Lat/Downloads/fusion\ vault/storage
   python test_walrus.py
   ```

## Troubleshooting

### If script hangs:
- It's probably compiling Sui CLI (takes 10-30 minutes)
- Be patient, or check CPU usage

### If you get "command not found":
- Make sure you're in Ubuntu: `wsl -d Ubuntu`
- Check PATH: `echo $PATH`

### If Sui installation fails:
- Make sure Rust is installed: `rustc --version`
- Try: `source $HOME/.cargo/env`

## Need Help?

The setup script handles most things automatically. Just:
1. Run it in Ubuntu
2. Wait for prompts
3. Choose mainnet when asked
4. Save your recovery phrase if wallet is created

Good luck! 🚀

