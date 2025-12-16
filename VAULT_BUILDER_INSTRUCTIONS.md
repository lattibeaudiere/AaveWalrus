# Step-by-Step: Create Fusion Vault via Builder UI

## Current Setup

I can see your builder UI is ready. Here's what to fill in:

## 🔧 Configuration Values

### Change Chain (IMPORTANT!)
- **Current**: Ethereum
- **Change to**: Arbitrum ⚠️ (we need Arbitrum for this rental!)

### Vault Configuration

**Vault Name:**
```
USDC Yield Optimizer
```

**Vault Share Ticker:**
```
USDC-YO
```

**Underlying Token Address:**
```
0xaf88d065e77c8cC2239327C5EDb3A432268e5831
```
(This is USDC on Arbitrum)

**Owner:**
```
0xdF243d9ffeBd2CF5C1A18053978Bf72C2a0e522c
```
✅ Already filled correctly!

**Redemption Delay in Seconds:**
```
86400
```
(24 hours - standard for testing)

## 📋 Step-by-Step Instructions

### Step 1: Switch Chain to Arbitrum

**VERY IMPORTANT**: You must change the chain!

1. Click "Select chain: Ethereum"
2. Choose "Arbitrum" from the dropdown
3. Confirm your wallet switches to Arbitrum network

### Step 2: Fill in Vault Details

Copy and paste these values:

**Vault Name:**
```
USDC Yield Optimizer
```

**Vault Share Ticker:**
```
USDC-YO
```

**Underlying Token Address:**
```
0xaf88d065e77c8cC2239327C5EDb3A432268e5831
```

**Owner:**
(Already set to: `0xdF243d9ffeBd2CF5C1A18053978Bf72C2a0e522c`)

**Redemption Delay in Seconds:**
```
86400
```

### Step 3: Create Vault

Click the **"Create Fusion Vault"** button

⏳ Wait for transaction to confirm on Arbitrum

### Step 4: Get Vault Address

After creation, you'll see:
- ✅ Your Fusion Vaults section
- Vault address will be displayed
- Copy this address!

### Step 5: Get Access Manager Address

FFFF assist need to get the access manager address from the vault. You can:

Option A: Check the vault contract
- Open vault on Arbiscan
- Look for `authority()` function
- Returns access manager address

Option B: Use IPOR interface
- Go to vault settings
- Check "Access Manager" or similar
- Copy the address

## 📝 After Creation

You'll get two addresses:

1. **Vault Address** (starts with 0x...)
2. **Access Manager Address** (starts with 0x...)

Save both to your `.env` file:
```bash
TARGET_VAULT=<your_vault_address_here>
ACCESS_MANAGER_ADDRESS=<your_access_manager_address_here>
```

## 🚨 Critical Reminders

1. **Must use Arbitrum chain** - not Ethereum!
2. **USDC address** is `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`
3. **Save both addresses** after creation
4. **Wallet must have ETH** on Arbitrum for gas

## 🎯 Next Steps After Vault Creation

Once you have the two addresses:

1. Update `.env` file with addresses
2. Run: `npm run deploy:mainnet` 
3. Run: `npm run grant:role`
4. Done! 🎉

## ⚠️ Transaction Costs

Expect to pay:
- Vault creation: ~0.01-0.05 ETH
- RSC deployment: ~0.02 ETH  
- Total: ~0.03-0.07 ETH in gas fees

Make sure you have enough ETH on Arbitrum in your wallet:
`0xdF243d9ffeBd2CF5C1A18053978Bf72C2a0e522c`

---

**Action Required**: 
1. Change chain to Arbitrum
2. Fill in the form above
3. Create vault
4. Share the vault address and access manager address

Then we can deploy the RSC! 🚀

