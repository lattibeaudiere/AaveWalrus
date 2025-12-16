# Correct Walrus Setup Guide

## The Real Situation

### What You Need:

1. **WSL installed** ✅ (You have this)
2. **Ubuntu (or another full Linux distro) in WSL**
   - Check if you have it: `wsl --list --verbose`
   - If not, install it: `wsl --install -d Ubuntu`
   - **Docker Desktop does NOT prevent this**

### Important Facts:

- ✅ **WSL supports multiple distributions** - You can have Docker Desktop AND Ubuntu
- ✅ **Docker Desktop's WSL distro is separate** - It doesn't interfere with Ubuntu
- ✅ **They coexist peacefully** - No conflicts
- ✅ **Docker Desktop doesn't block Ubuntu installation**

---

## Step 1: Check Your Current Setup

```powershell
# List all WSL distributions
wsl --list --verbose
```

**Expected output:**
```
  NAME                   STATE           VERSION
* docker-desktop         Running         2
  docker-desktop-data    Running         2
  Ubuntu-22.04          Stopped         2    # ← If you see this, you're good!
```

---

## Step 2: Choose Your Path

### Path A: Ubuntu Already Installed ✅

If you see Ubuntu in the list:

```powershell
# Launch Ubuntu
wsl -d Ubuntu

# Navigate to your project
cd /mnt/c/Users/R_Lat/Downloads/fusion\ vault

# Run Walrus setup
bash setup_walrus_wsl.sh
```

### Path B: Need to Install Ubuntu

If Ubuntu is NOT in the list:

```powershell
# Install Ubuntu (works even with Docker Desktop)
wsl --install -d Ubuntu

# Wait for installation (takes a few minutes)
# When prompted, create a username and password

# Then launch Ubuntu
wsl -d Ubuntu

# Navigate to your project
cd /mnt/c/Users/R_Lat/Downloads/fusion\ vault

# Run Walrus setup
bash setup_walrus_wsl.sh
```

---

## Step 3: Run Walrus Setup

Once you're in Ubuntu:

```bash
# Make sure you're in the project directory
cd /mnt/c/Users/R_Lat/Downloads/fusion\ vault

# Run the setup script
bash setup_walrus_wsl.sh
```

The script will:
1. Install Rust (if needed)
2. Install Sui CLI
3. Set up Sui wallet
4. Install Walrus CLI
5. Configure Walrus

---

## Common Questions

### Q: Does Docker Desktop prevent Ubuntu installation?

**A: No!** Docker Desktop and Ubuntu can coexist in WSL. They're separate distributions.

### Q: Will Docker Desktop break if I install Ubuntu?

**A: No!** They work independently. Docker Desktop uses its own WSL distribution.

### Q: Can I have multiple WSL distributions?

**A: Yes!** WSL supports multiple distributions simultaneously:
- docker-desktop (for Docker)
- docker-desktop-data (for Docker)
- Ubuntu (for your use)
- Any other Linux distro you install

### Q: How do I switch between distributions?

**A:**
```powershell
# Use specific distribution
wsl -d Ubuntu
wsl -d docker-desktop

# Or set default
wsl --set-default Ubuntu
```

---

## Troubleshooting

### Issue: "Ubuntu not found after installation"

**Solution:**
```powershell
# Check if it's installed but not showing
wsl --list --all

# Launch it directly
wsl -d Ubuntu
```

### Issue: "Permission denied" in WSL

**Solution:**
```bash
# Make script executable
chmod +x setup_walrus_wsl.sh

# Run it
bash setup_walrus_wsl.sh
```

### Issue: "WSL command not found"

**Solution:**
- Make sure WSL is installed: `wsl --status`
- If not installed: `wsl --install`

---

## Summary

1. **Check what you have:** `wsl --list --verbose`
2. **If Ubuntu exists:** `wsl -d Ubuntu` → Run setup
3. **If Ubuntu doesn't exist:** `wsl --install -d Ubuntu` → Then run setup
4. **Docker Desktop is irrelevant** - It doesn't interfere

**The solution is simple: Check, install if needed, use!**

