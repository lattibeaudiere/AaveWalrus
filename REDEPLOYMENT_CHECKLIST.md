# Redeployment Checklist - After Alpha Role Grant

## ✅ Alpha Role Status

**Alpha role granted to adapter:**
- Address: `0xa60c91Aa6E0e203De3a6692a82eE65884B3B2D09`
- Status: ✅ **GRANTED** (confirmed by user)

---

## ⚠️ Code Changes Made

### 1. RSC Contract (`FusionReactiveRSC.sol`)
**Change:** Now passes RSC address as first parameter
```solidity
// Before:
"executeReaction((address,bytes)[])"

// After:
"executeReaction(address,(address,bytes)[])"
// Passes: address(this) as first param
```

### 2. Adapter Contract (`ReactiveAlphaAdapter.sol`)
**Change:** Now accepts RSC address as first parameter
```solidity
// Before:
function executeReaction(FuseAction[] calldata actions)

// After:
function executeReaction(address rsc, FuseAction[] calldata actions)
```

**Status:** ✅ Both contracts compiled successfully

---

## 🔄 Redeployment Required?

### Current Adapter Address
`0xa60c91Aa6E0e203De3a6692a82eE65884B3B2D09`

**Question:** Does this adapter have the OLD or NEW function signature?

### Check Needed

If the deployed adapter has the OLD signature (`executeReaction(FuseAction[])`):
- ❌ **Redeployment REQUIRED**
- New RSC will emit callbacks with NEW signature
- Old adapter won't accept them → **Transaction will revert**

If the deployed adapter already has the NEW signature:
- ✅ **No redeployment needed**
- Just need to re-register RSC

---

## 📋 Action Plan

### Option 1: Verify Current Adapter Signature

```bash
# Check if adapter has old or new signature
node scripts/checkAdapterSignature.js
```

**If OLD signature found:**
→ **MUST REDEPLOY** adapter

**If NEW signature found:**
→ No redeployment needed

### Option 2: Redeploy Anyway (Safest)

Since we made changes, safest to redeploy:

1. **Redeploy Adapter:**
   ```bash
   node scripts/deployAdapterStandalone.js
   ```
   - Updates `.env` with new address
   - Grants Alpha role to NEW adapter address

2. **Redeploy RSC:**
   ```bash
   cd reactive
   $env:ADAPTER_ADDRESS="<NEW_ADAPTER_ADDRESS>"
   forge script script/DeployRSC.s.sol:DeployRSC --rpc-url ${REACTIVE_RPC} --broadcast --private-key ${REACTIVE_PRIVATE_KEY}
   ```
   - Updates `.env` with new RSC address

3. **Re-register RSC:**
   ```bash
   node scripts/registerCrossChainRSC.js
   ```

4. **Re-subscribe and Fund:**
   ```bash
   node scripts/fundAndCoverDebt.js
   node scripts/subscribeToAave.js
   node scripts/subscribeToQueryHelper.js
   ```

5. **Grant Alpha Role to NEW Adapter:**
   - Via Vault Builder UI
   - Address: `<NEW_ADAPTER_ADDRESS>`

---

## ⚡ Quick Path (If Current Adapter is Old)

1. ✅ Alpha role granted to OLD adapter
2. 🔄 Redeploy NEW adapter with fix
3. 🔄 Grant Alpha role to NEW adapter
4. 🔄 Redeploy RSC pointing to NEW adapter
5. 🔄 Re-register RSC
6. 🔄 Re-subscribe and fund
7. ✅ System ready

---

## 🎯 Recommended Next Step

**Check adapter signature first:**
```bash
node scripts/checkAdapterSignature.js
```

Then:
- If OLD → Redeploy both
- If NEW → Just re-register RSC

