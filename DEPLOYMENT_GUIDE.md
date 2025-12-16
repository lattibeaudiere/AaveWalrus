# IPOR Fusion Reactive RSC - Complete Deployment Guide

This guide documents the complete process for deploying, subscribing, and funding the Fusion Reactive RSC contract on the Reactive Network. Follow these steps for easy replication.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Understanding the Workaround](#understanding-the-workaround)
3. [Step-by-Step Deployment](#step-by-step-deployment)
4. [Step-by-Step Subscription](#step-by-step-subscription)
5. [Step-by-Step Funding](#step-by-step-funding)
6. [Verification](#verification)
7. [Quick Reference Commands](#quick-reference-commands)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### 1. Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# Reactive Network Configuration
REACTIVE_RPC=https://mainnet-rpc.rnk.dev
REACTIVE_PRIVATE_KEY=0xYourPrivateKeyHere
REACTIVE_SERVICE=0x0000000000000000000000000000000000fffFfF

# Adapter Address (on Arbitrum)
ADAPTER_ADDRESS=0xYourAdapterAddressHere

# Optional: Contract address (set after deployment)
RSC_ADDRESS=0xYourDeployedContractAddress
```

### 2. Required Software

- **Foundry** (forge, cast) - For contract deployment
- **Node.js** (v18+) - For subscription scripts
- **ethers.js** (v5.7.2+) - For JavaScript interactions

### 3. Contract Addresses

**Arbitrum Addresses:**
- Aave V3 Pool: `0x794a61358D6845594F94dc1DB02A252b5b4814aD`
- Compound V3 USDC: `0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA`

**Event Signatures:**
- Aave V3 ReserveDataUpdated: `0xb2a02bf1a92354a66946e3533277a66dd13726c1695e5ac302d1c1fcb97d2200`
- Compound V3 AccrueInterest: `0x717fee053884ab1935ba6d0140f6ed225371439611d9674ff445419d6a0fa1b7`

**Reactive Network:**
- System Contract: `0x0000000000000000000000000000000000fffFfF`
- Chain ID: 1597

---

## Understanding the Workaround

### The Problem

Constructor subscriptions are **broken** on Reactive Network due to a precompile 0x64 bug. When attempting to subscribe in the constructor, the transaction reverts.

**Error Pattern:**
```
service.subscribe() in constructor
  └─ System Contract (0x0000...fffFfF)
     └─ Precompile (0x64)
        └─ fulfillBasicOrder_efficient_6GL6yc()
           └─ [Revert] Failure
```

### The Solution

**Deploy WITHOUT constructor subscriptions, then subscribe POST-DEPLOYMENT.**

- ✅ Constructor: Empty (no subscriptions)
- ✅ Post-deployment: Call `subscribeToAave()` and `subscribeToCompound()`

This approach avoids the precompile bug entirely.

---

## Step-by-Step Deployment

### Step 1: Navigate to Reactive Directory

```bash
cd reactive
```

### Step 2: Verify Environment Variables

Ensure your `.env` file has:
- `REACTIVE_RPC`
- `REACTIVE_PRIVATE_KEY`
- `ADAPTER_ADDRESS`

### Step 3: Deploy the Contract

```bash
forge script script/DeployRSC.s.sol:DeployRSC \
  --rpc-url $REACTIVE_RPC \
  --broadcast
```

**Expected Output:**
```
✅ [Success] Hash: 0x...
Contract Address: 0x...
Block: ...
```

### Step 4: Save the Contract Address

Copy the deployed contract address from the output. You'll need it for subscriptions and funding.

**Example:**
```
Contract Address: 0x5eBe4dB39B498511c871DCdF3f5D3afD707228c2
```

### Step 5: Update .env File

Add the deployed contract address to your `.env` file:

```bash
RSC_ADDRESS=0x5eBe4dB39B498511c871DCdF3f5D3afD707228c2
```

**PowerShell Command:**
```powershell
Add-Content .env "`nRSC_ADDRESS=0xYourContractAddress"
```

**Bash Command:**
```bash
echo "RSC_ADDRESS=0xYourContractAddress" >> .env
```

---

## Step-by-Step Subscription

### Option A: Using the Automated Script (Recommended)

#### Step 1: Navigate to Project Root

```bash
cd ..  # From reactive directory
```

#### Step 2: Run Subscription Script

```bash
node scripts/subscribePostDeployment.js
```

**Expected Output:**
```
✅ AAVE SUBSCRIPTION SUCCESSFUL!
✅ COMPOUND SUBSCRIPTION SUCCESSFUL!
📊 Final Status:
  Aave V3: ✅ Subscribed
  Compound V3: ✅ Subscribed
```

### Option B: Manual Subscription (Using cast)

#### Step 1: Subscribe to Aave V3

```bash
cast send $RSC_ADDRESS "subscribeToAave()" \
  --rpc-url $REACTIVE_RPC \
  --private-key $REACTIVE_PRIVATE_KEY \
  --gas-limit 1000000
```

#### Step 2: Subscribe to Compound V3

```bash
cast send $RSC_ADDRESS "subscribeToCompound()" \
  --rpc-url $REACTIVE_RPC \
  --private-key $REACTIVE_PRIVATE_KEY \
  --gas-limit 1000000
```

#### Step 3: Verify Subscriptions

```bash
# Check Aave subscription
cast call $RSC_ADDRESS "aaveSubscribed()" --rpc-url $REACTIVE_RPC

# Check Compound subscription
cast call $RSC_ADDRESS "compoundSubscribed()" --rpc-url $REACTIVE_RPC
```

Both should return `0x...01` (true).

---

## Step-by-Step Funding

### Step 1: Check Current Balance (Optional)

```bash
cast balance $RSC_ADDRESS --rpc-url $REACTIVE_RPC
```

### Step 2: Fund the Contract

```bash
cast send $RSC_ADDRESS \
  --value 1ether \
  --rpc-url $REACTIVE_RPC \
  --private-key $REACTIVE_PRIVATE_KEY
```

**Recommended Amounts:**
- Minimum: `0.1ether` (for testing)
- Recommended: `1ether` (for production)
- High usage: `5ether` (for frequent events)

### Step 3: Verify Funding

```bash
cast balance $RSC_ADDRESS --rpc-url $REACTIVE_RPC
```

Should show the amount you sent (e.g., `1000000000000000000` for 1 REACT).

---

## Verification

### Complete Status Check

Run this script to verify everything is set up correctly:

```bash
node scripts/verifyCompleteSetup.js
```

Or manually verify each component:

#### 1. Contract Deployment

```bash
cast code $RSC_ADDRESS --rpc-url $REACTIVE_RPC
```

Should return non-empty bytecode.

#### 2. Subscription Status

```bash
cast call $RSC_ADDRESS "aaveSubscribed()" --rpc-url $REACTIVE_RPC
cast call $RSC_ADDRESS "compoundSubscribed()" --rpc-url $REACTIVE_RPC
```

Both should return `0x...01` (true).

#### 3. Contract Balance

```bash
cast balance $RSC_ADDRESS --rpc-url $REACTIVE_RPC
```

Should show your funded amount.

#### 4. Owner Verification

```bash
cast call $RSC_ADDRESS "owner()" --rpc-url $REACTIVE_RPC
```

Should match your deployer address.

#### 5. Reactscan Verification

Visit: https://reactscan.io/address/$RSC_ADDRESS

Should show:
- Contract is deployed
- Subscriptions are active (may take a few minutes)

---

## Quick Reference Commands

### Complete Deployment Flow

```bash
# 1. Deploy
cd reactive
forge script script/DeployRSC.s.sol:DeployRSC \
  --rpc-url $REACTIVE_RPC \
  --broadcast

# 2. Update .env with deployed address
# Edit .env: RSC_ADDRESS=0x...

# 3. Subscribe
cd ..
node scripts/subscribePostDeployment.js

# 4. Fund
cast send $RSC_ADDRESS \
  --value 1ether \
  --rpc-url $REACTIVE_RPC \
  --private-key $REACTIVE_PRIVATE_KEY

# 5. Verify
cast call $RSC_ADDRESS "aaveSubscribed()" --rpc-url $REACTIVE_RPC
cast call $RSC_ADDRESS "compoundSubscribed()" --rpc-url $REACTIVE_RPC
cast balance $RSC_ADDRESS --rpc-url $REACTIVE_RPC
```

### PowerShell Version

```powershell
# 1. Deploy
cd reactive
forge script script/DeployRSC.s.sol:DeployRSC `
  --rpc-url $env:REACTIVE_RPC `
  --broadcast

# 2. Update .env
Add-Content ..\.env "`nRSC_ADDRESS=0xYourAddress"

# 3. Subscribe
cd ..
node scripts/subscribePostDeployment.js

# 4. Fund
cast send $env:RSC_ADDRESS `
  --value 1ether `
  --rpc-url $env:REACTIVE_RPC `
  --private-key $env:REACTIVE_PRIVATE_KEY

# 5. Verify
cast call $env:RSC_ADDRESS "aaveSubscribed()" --rpc-url $env:REACTIVE_RPC
cast call $env:RSC_ADDRESS "compoundSubscribed()" --rpc-url $env:REACTIVE_RPC
cast balance $env:RSC_ADDRESS --rpc-url $env:REACTIVE_RPC
```

---

## Troubleshooting

### Issue: Deployment Fails

**Problem:** Insufficient balance or wrong RPC URL

**Solution:**
```bash
# Check balance
cast balance $YOUR_ADDRESS --rpc-url $REACTIVE_RPC

# Verify RPC URL
curl -X POST $REACTIVE_RPC \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### Issue: Subscription Fails

**Problem:** Transaction succeeds but no subscription created

**Symptoms:**
- Status: 1 (success)
- Logs: empty `[]`
- No Subscribed event

**Solution:**
1. Verify you're calling from the owner address
2. Check contract has code: `cast code $RSC_ADDRESS --rpc-url $REACTIVE_RPC`
3. Ensure you're using post-deployment functions (not constructor)
4. Check gas limit is sufficient (use 1,000,000)

### Issue: Subscription Transaction Reverts

**Problem:** Transaction status is 0 (failed)

**Solution:**
1. Check you're the owner: `cast call $RSC_ADDRESS "owner()" --rpc-url $REACTIVE_RPC`
2. Verify contract is on Reactive Network (not ReactVM)
3. Check if already subscribed: `cast call $RSC_ADDRESS "aaveSubscribed()" --rpc-url $REACTIVE_RPC`
4. Increase gas limit

### Issue: Contract Not Receiving Events

**Problem:** Subscriptions are active but `react()` never called

**Possible Causes:**
1. Insufficient funding (contract needs REACT for execution)
2. Events not occurring on Arbitrum (check Aave/Compound activity)
3. Reactscan shows pending subscriptions (wait a few minutes)
4. Wrong event signatures (verify topic0 values)

**Solution:**
1. Check balance: `cast balance $RSC_ADDRESS --rpc-url $REACTIVE_RPC`
2. Monitor Reactscan for subscription confirmation
3. Test with manual event trigger (if available)
4. Verify event signatures match deployed contracts

### Issue: Gas Estimation Fails

**Problem:** `cast send` fails with gas estimation error

**Solution:**
```bash
# Manually set gas limit
cast send $RSC_ADDRESS "subscribeToAave()" \
  --rpc-url $REACTIVE_RPC \
  --private-key $REACTIVE_PRIVATE_KEY \
  --gas-limit 1000000
```

---

## Contract Functions Reference

### Subscription Functions

```solidity
// Subscribe to Aave V3 ReserveDataUpdated
function subscribeToAave() external rnOnly onlyOwner

// Subscribe to Compound V3 AccrueInterest
function subscribeToCompound() external rnOnly onlyOwner

// Generic subscription
function subscribeTo(uint256 chainId, address contractAddress, uint256 topic0) 
    external rnOnly onlyOwner
```

### Unsubscription Functions

```solidity
// Unsubscribe from Aave V3
function unsubscribeFromAave() external rnOnly onlyOwner

// Unsubscribe from Compound V3
function unsubscribeFromCompound() external rnOnly onlyOwner

// Generic unsubscription
function unsubscribeFrom(uint256 chainId, address contractAddress, uint256 topic0) 
    external rnOnly onlyOwner
```

### Status Functions

```solidity
// Check subscription status
function aaveSubscribed() external view returns (bool)
function compoundSubscribed() external view returns (bool)
function owner() external view returns (address)
```

---

## Deployment Checklist

Use this checklist to ensure complete deployment:

- [ ] Environment variables configured (`.env` file)
- [ ] Adapter deployed on Arbitrum and address known
- [ ] Contract deployed to Reactive Network
- [ ] Contract address saved in `.env`
- [ ] Subscribed to Aave V3 ReserveDataUpdated
- [ ] Subscribed to Compound V3 AccrueInterest
- [ ] Verified subscriptions (`aaveSubscribed()` and `compoundSubscribed()`)
- [ ] Contract funded with REACT
- [ ] Verified balance on contract
- [ ] Checked Reactscan for subscription confirmation
- [ ] Documented contract address for future reference

---

## Example Deployment Session

Here's a complete example of a successful deployment:

```bash
# 1. Deploy
$ cd reactive
$ forge script script/DeployRSC.s.sol:DeployRSC --rpc-url $REACTIVE_RPC --broadcast

✅ [Success] Hash: 0x9012eb47dc5192a15cade300f3fc4889886b7f8871e6d883f51708394fa2b598
Contract Address: 0x5eBe4dB39B498511c871DCdF3f5D3afD707228c2
Block: 2927720

# 2. Update .env
$ echo "RSC_ADDRESS=0x5eBe4dB39B498511c871DCdF3f5D3afD707228c2" >> .env

# 3. Subscribe
$ cd ..
$ node scripts/subscribePostDeployment.js

✅ AAVE SUBSCRIPTION SUCCESSFUL!
✅ COMPOUND SUBSCRIPTION SUCCESSFUL!
📊 Final Status:
  Aave V3: ✅ Subscribed
  Compound V3: ✅ Subscribed

# 4. Fund
$ cast send 0x5eBe4dB39B498511c871DCdF3f5D3afD707228c2 \
  --value 1ether \
  --rpc-url $REACTIVE_RPC \
  --private-key $REACTIVE_PRIVATE_KEY

✅ Status: 1 (success)
Block: 2927738

# 5. Verify
$ cast call 0x5eBe4dB39B498511c871DCdF3f5D3afD707228c2 "aaveSubscribed()" --rpc-url $REACTIVE_RPC
0x...01  ✅

$ cast call 0x5eBe4dB39B498511c871DCdF3f5D3afD707228c2 "compoundSubscribed()" --rpc-url $REACTIVE_RPC
0x...01  ✅

$ cast balance 0x5eBe4dB39B498511c871DCdF3f5D3afD707228c2 --rpc-url $REACTIVE_RPC
1000000000000000000  ✅ (1 REACT)
```

---

## Notes

### Why Post-Deployment Subscriptions?

The Reactive Network has a bug where constructor subscriptions fail due to a precompile 0x64 error. This was discovered through testing and confirmed by comparing working vs. failing deployments. The workaround (post-deployment subscriptions) is reliable and has been successfully tested.

### Gas Costs

Typical gas costs:
- **Deployment:** ~2,000,000 gas (~1.2 REACT at 600 gwei)
- **Subscription:** ~75,000-130,000 gas per subscription
- **Funding:** ~21,000 gas (simple transfer)

### Timing

- **Deployment:** Immediate
- **Subscriptions:** Immediate (events emitted)
- **Reactscan visibility:** 2-5 minutes (may take time to index)
- **First event reaction:** Depends on when Aave/Compound events occur on Arbitrum

---

## Support & Resources

- **Reactscan:** https://reactscan.io
- **Reactive Network RPC:** https://mainnet-rpc.rnk.dev
- **Contract Explorer:** https://reactscan.io/address/$RSC_ADDRESS
- **Reactive Network Docs:** Official documentation (referenced for implementation)

---

## Last Updated

- **Date:** 2025-01-XX
- **Contract Version:** FusionReactiveRSC v1.0
- **Network:** Reactive Network Mainnet (Chain 1597)
- **Tested Deployment:** 0x5eBe4dB39B498511c871DCdF3f5D3afD707228c2
