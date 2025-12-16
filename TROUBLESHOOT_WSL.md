# Troubleshooting: WSL Ubuntu Not Starting

## Issue: `wsl -d Ubuntu` Does Nothing

If nothing happens when you run `wsl -d Ubuntu`, try these solutions:

---

## Solution 1: Check if Ubuntu is Installed

```powershell
wsl --list --verbose
```

**What to look for:**
- Should see "Ubuntu" in the list
- If not listed, Ubuntu needs to be installed

**If Ubuntu is NOT listed:**
```powershell
# Install Ubuntu
wsl --install -d Ubuntu

# Wait for installation (may take a few minutes)
# You'll be prompted to create a username and password
```

---

## Solution 2: Try Different WSL Commands

**Option A: Just `wsl` (uses default)**
```powershell
wsl
```

**Option B: List all distributions**
```powershell
wsl --list
```

**Option C: Check WSL status**
```powershell
wsl --status
```

---

## Solution 3: Restart WSL

```powershell
# Shutdown WSL
wsl --shutdown

# Wait a few seconds, then try again
wsl -d Ubuntu
```

---

## Solution 4: Check if WSL is Enabled

**Open PowerShell as Administrator and run:**
```powershell
# Check WSL status
wsl --status

# If WSL is not installed, install it:
wsl --install
```

**Then restart your computer** and try again.

---

## Solution 5: Launch Ubuntu from Start Menu

1. **Press Windows key**
2. **Type:** "Ubuntu"
3. **Click:** Ubuntu app
4. **This should open Ubuntu terminal directly**

---

## Solution 6: Check for Errors

**Run with error output:**
```powershell
wsl -d Ubuntu 2>&1
```

**Or try:**
```powershell
wsl -d Ubuntu bash -c "echo 'Testing Ubuntu'"
```

**If you see errors, share them!**

---

## Solution 7: Reinstall Ubuntu

**If nothing works:**
```powershell
# Unregister Ubuntu
wsl --unregister Ubuntu

# Reinstall Ubuntu
wsl --install -d Ubuntu
```

---

## What Should Happen

**When `wsl -d Ubuntu` works, you should see:**
```
username@computername:~$
```

**This is the Ubuntu command prompt** - you're now in Linux!

---

## Quick Test

**Try this simple test:**
```powershell
wsl -d Ubuntu bash -c "pwd"
```

**Should output:** `/home/username` or similar

**If this works**, Ubuntu is fine, just use:
```powershell
wsl -d Ubuntu bash -c "YOUR_COMMAND_HERE"
```

---

## Alternative: Use Ubuntu App Directly

**Instead of `wsl -d Ubuntu`:**

1. **Open Start Menu**
2. **Search:** "Ubuntu"
3. **Click:** Ubuntu app
4. **Run commands directly there**

**This is often easier than using `wsl` command!**

---

## Still Not Working?

**Share the output of:**
```powershell
wsl --list --verbose
wsl --status
wsl -d Ubuntu 2>&1
```

**This will help diagnose the issue!**

