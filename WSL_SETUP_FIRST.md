# WSL Setup Required

## Issue

Your WSL currently only has Docker Desktop distributions, which don't include a full Linux environment needed for Walrus CLI setup.

## Solution: Install Ubuntu (or another Linux distribution)

### Step 1: Install Ubuntu in WSL

Open PowerShell as Administrator and run:

```powershell
wsl --install -d Ubuntu
```

Or install from Microsoft Store:
1. Open Microsoft Store
2. Search for "Ubuntu"
3. Click "Install"

### Step 2: Set Up Ubuntu

After installation:
1. Launch Ubuntu from Start Menu
2. Create a username and password when prompted
3. Wait for initial setup to complete

### Step 3: Verify WSL

```powershell
wsl --list --verbose
```

You should see Ubuntu listed.

### Step 4: Run Walrus Setup

Once Ubuntu is installed, run:

```powershell
# Navigate to your project in WSL
wsl
cd /mnt/c/Users/R_Lat/Downloads/fusion\ vault

# Run the setup script
bash setup_walrus_wsl.sh
```

## Alternative: Manual Setup in WSL

If you prefer to set up manually:

1. Open WSL (Ubuntu)
2. Navigate to your project:
   ```bash
   cd /mnt/c/Users/R_Lat/Downloads/fusion\ vault
   ```
3. Follow the steps in `WALRUS_SETUP_GUIDE.md` manually

## Quick Check

After installing Ubuntu, verify it works:

```powershell
wsl -d Ubuntu -- bash -c "echo 'WSL is working!'"
```

If this works, you're ready to proceed with Walrus setup!

