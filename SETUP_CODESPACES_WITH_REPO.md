# Setup Codespaces with Your AaveWalrus Repo

## Your Repository

**Repo:** https://github.com/lattibeaudiere/AaveWalrus.git

**Status:** Currently empty - we'll initialize it!

---

## Step 1: Initialize Your Repo Locally

**In PowerShell (your current directory):**

```powershell
# Make sure you're in your project directory
cd "C:\Users\R_Lat\Downloads\fusion vault"

# Initialize git (if not already done)
git init

# Add remote
git remote add origin https://github.com/lattibeaudiere/AaveWalrus.git

# Create .gitignore (important - don't commit secrets!)
@"
# Environment files
.env
storage/.env
*.env

# Python
__pycache__/
*.pyc
*.pyo
*.pyd
.Python
venv/
env/

# Node
node_modules/
npm-debug.log

# Database
*.db
*.sqlite

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# Secrets
*.key
*.pem
walrus-config.yaml
sui-wallet-config.yaml
"@ | Out-File -FilePath .gitignore -Encoding UTF8

# Add files
git add .

# Commit
git commit -m "Initial commit: Aave dual storage system (PostgreSQL + Walrus)"

# Push to GitHub
git push -u origin main
```

**If you get authentication error:**
- Use GitHub CLI: `gh auth login`
- Or use Personal Access Token
- Or use SSH instead of HTTPS

---

## Step 2: Open in Codespaces

1. **Go to:** https://github.com/lattibeaudiere/AaveWalrus
2. **Click:** Green "Code" button
3. **Click:** "Codespaces" tab
4. **Click:** "Create codespace on main"

**Wait:** Codespace starts (1-2 minutes)

---

## Step 3: Codespace Opens

You'll see:
- VS Code in browser
- Your project files
- Terminal at bottom
- Full Linux environment

---

## Step 4: Install Sui & Walrus in Codespaces

**Run these commands in the Codespaces terminal:**

### COMMAND 1: Install suiup

```bash
curl -sSfL https://raw.githubusercontent.com/Mystenlabs/suiup/main/install.sh | sh
```

---

### COMMAND 2: Reload Environment

```bash
source $HOME/.cargo/env
```

---

### COMMAND 3: Install Sui CLI (10-30 minutes)

```bash
suiup install sui
```

**Wait patiently - compilation takes time!**

---

### COMMAND 4: Verify Sui

```bash
sui --version
```

---

### COMMAND 5: Install Walrus CLI

```bash
suiup install walrus
```

---

### COMMAND 6: Verify Walrus

```bash
walrus --version
```

---

### COMMAND 7: Download Walrus Config

```bash
curl --create-dirs https://docs.wal.app/setup/client_config.yaml -o ~/.config/walrus/client_config.yaml
```

---

### COMMAND 8: Initialize Sui Client

```bash
sui client
```

**Answer prompts:**
- `y` (connect to full node)
- `https://fullnode.testnet.sui.io:443`
- `testnet`
- `0` (ed25519)

---

### COMMAND 9: Get Your Address

```bash
sui client active-address
```

**Copy this address!**

---

### COMMAND 10: Get Testnet Tokens

1. Go to: https://faucet.sui.io/
2. Select: **Testnet**
3. Paste: Your address
4. Get tokens

---

### COMMAND 11: Convert to WAL

```bash
walrus get-wal --context testnet
sui client balance
```

---

### COMMAND 12: Test Walrus

```bash
echo "Hello from Codespaces!" > /tmp/test.txt
walrus store /tmp/test.txt --epochs 2 --context testnet
```

---

## Step 5: Configure Your App to Use Codespaces Walrus

### Option A: Use Codespaces as Remote Service

**In your Python code (`storage/walrus_service.py`):**

```python
import subprocess
import os

class WalrusService:
    def __init__(self):
        # Check if running in Codespaces
        self.use_codespaces = os.getenv('CODESPACE_NAME') is not None
        
        if self.use_codespaces:
            # Running in Codespaces - use local walrus
            self.config_path = os.path.expanduser('~/.config/walrus/client_config.yaml')
            self.context = 'testnet'
        else:
            # Running locally - could SSH to Codespaces or use local
            self.codespaces_url = os.getenv('CODESPACES_WALRUS_URL')
            # ... remote connection logic
    
    def store_data(self, data: bytes) -> str:
        if self.use_codespaces:
            # Direct call - we're in Codespaces
            # ... existing code
        else:
            # Call Codespaces via SSH or API
            # ... remote call
```

### Option B: Export Config and Use Locally

**Save configs from Codespaces:**

```bash
# In Codespaces terminal
cp ~/.config/walrus/client_config.yaml ./walrus-config.yaml
cp ~/.sui/sui_config/client.yaml ./sui-wallet-config.yaml

# Commit (but be careful - don't commit private keys!)
# Better: Download files manually
```

---

## Step 6: Update Your .env File

**In Codespaces, create/update `storage/.env`:**

```bash
cd storage
cat > .env << 'EOF'
# Database (your existing Supabase)
DATABASE_URL=postgresql://postgres:W/u99u#Wt+ZGFyY@db.gaeauxyyfqavpqythore.supabase.co:5432/postgres

# Walrus (Codespaces)
WALRUS_CONFIG=~/.config/walrus/client_config.yaml
WALRUS_CONTEXT=testnet
WALRUS_USE_WSL=false
EOF
```

---

## Step 7: Test Your Dual Storage System

**In Codespaces:**

```bash
cd storage
python test_walrus.py
python test_dual_storage.py
```

---

## Step 8: Save Your Work

**Commit changes:**

```bash
git add .
git commit -m "Add Walrus setup and configuration"
git push
```

---

## Keeping Codespaces Running

**Codespaces auto-stop after 30 minutes of inactivity.**

**To keep it running:**
- Codespaces will pause automatically
- Can restart anytime: https://github.com/codespaces
- Free tier: 60 hours/month

**To restart:**
1. Go to: https://github.com/codespaces
2. Find your codespace
3. Click "Start"

---

## Connecting Local to Codespaces

### Option 1: Use Codespaces as Remote Service

Keep Codespaces running and call it from your local code:

```python
# Local code calls Codespaces via SSH or API
import subprocess

def store_via_codespaces(data):
    # SSH to codespaces and run walrus command
    result = subprocess.run([
        'ssh', 'codespace-url',
        'walrus', 'store', '/tmp/data.txt', '--context', 'testnet'
    ])
    return blob_id
```

### Option 2: Use Same Wallet Locally

1. Download wallet config from Codespaces
2. Set up Sui/Walrus locally (when ready)
3. Use same wallet/config

---

## Quick Reference

**All Setup Commands:**

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
walrus get-wal --context testnet

# 4. Test
echo "test" > /tmp/test.txt
walrus store /tmp/test.txt --epochs 2 --context testnet
```

---

## Next Steps

1. ✅ Initialize repo locally
2. ✅ Push to GitHub
3. ✅ Open in Codespaces
4. ✅ Install Sui/Walrus (Commands 1-12)
5. ✅ Configure your app
6. ✅ Test dual storage system
7. ✅ Start capturing Aave events!

---

**You're all set!** 🚀

Your repo is ready, Codespaces guide is ready, and you can set up Walrus in the cloud without any local installation!

