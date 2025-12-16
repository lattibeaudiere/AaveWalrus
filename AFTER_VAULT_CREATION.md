# After Vault Creation - Quick Setup

## 🎉 You Just Created Your Vault!

Now let's configure it for autonomous yield optimization.

## 📋 Quick Reference

**Your Vault Address**: `___________________` (copy from UI)

**Access Manager Address**: `___________________` (find using steps below)

## 🔍 How to Get Access Manager Address

### Method 1: Via Arbiscan

1. Copy your vault address
2. Go to https://arbiscan.io
3. Paste vault address
4. Go to "Contract" tab
5. Click "Read Contract"
6. Find function: `authority()`
7. Click query
8. Copy the returned address (this is your access manager)

### Method 2: Via IPOR Interface

1. In "Your Fusion Vaults" section
2. Click on your vault
3. Look for "Access Manager" or "Settings"
4. Access Manager address should be listed
5. Copy it

## 📝 Update .env File

Once you have both addresses, update your `.env`:

```bash
# Vault Configuration
TARGET_VAULT=<paste_your_vault_address>
ACCESS_MANAGER_ADDRESS=<paste_access_manager_address>

# Keep everything else the same
ARBITRUM_PRIVATE_KEY=0x6fa42a2b9666e4b30ea146654085832b440591575780c668e0641b674abbb5e6

# Aave V3 Fuses
AAVE_SUPPLY_FUSE=0x304756cD719382281fBD640f5F7932465eD663D6
AAVE_BALANCE_FUSE=0x4CB1c4774BA1B65802c68AdéisB33DE99ABf8B21228

# Compound V3 Fuses
COMPOUND_SUPPLY_FUSE=0xB0b3dc1B27C6c8007c9B01a768d6717f6813fE94
COMPOUND_BALANCE_FUSE=0xCF730BAA5542DC7570907696271bA96019FcD10C

# Protocol Addresses
AAVE_V3_POOL=0x794a61358D6845594F94dc1DB02A252b5b4814aD
AAVE_DATA_PROVIDER=0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654
COMPOUND_MARKET=0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf
MIN_SPREAD_BPS=50
```

## 🚀 Deploy RSC (Next Step)

Once .env is updated:

```bash
# Deploy the RSC
npm run deploy:mainnet

# Grant it permission on your vault
npm run grant:role

# Check status
npm run check:status
```

## 📧 Send Me The Addresses

Once you have them, paste both addresses here and I'll update everything for you!

**Vault Address**: `0x...`
**Access Manager Address**: `0x...`

---

Almost there! 🚀

