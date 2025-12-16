# Redeployment Guide - After Alpha Role Grant

## ✅ Current Status

- **Alpha Role:** ✅ Granted to adapter `0xa60c91Aa6E0e203De3a6692a82eE65884B3B2D09`
- **RSC Status:** ✅ Registered and Active
- **Code Changes:** ✅ Made to both RSC and Adapter
- **Issue:** Deployed contracts likely have OLD function signature

---

## 🔄 Redeployment Required

### Why Redeploy?

1. **Code Changes Made:**
   - RSC now passes address as first parameter
   - Adapter now accepts address as first parameter

2. **Deployed Contracts:**
   - Current adapter: `0xa60c91Aa6E0e203De3a6692a82eE65884B3B2D09` (likely OLD signature)
   - Current RSC: `0xEFD20dC51F7c82B7430490Bf45767bA57F6819fc` (OLD version)

3. **Mismatch Risk:**
   - If RSC emits NEW signature but adapter has OLD → **Transaction will revert**
   - Must redeploy both to ensure compatibility

---

## 📋 Step-by-Step Redeployment

### Step 1: Redeploy Adapter (with NEW signature)

```bash
node scripts/deployAdapterStandalone.js
```

**What this does:**
- Deploys new adapter with `executeReaction(address rsc, FuseAction[] actions)`
- Updates `.env` with new adapter address
- Saves deployment info

**Note:** Write down the NEW adapter address!

---

### Step 2: Grant Alpha Role to NEW Adapter

Via Vault Builder UI:
1. Go to Vault → Roles → Alpha
2. Add address: `<NEW_ADAPTER_ADDRESS>`
3. Confirm grant

**Important:** Keep OLD adapter's role until NEW one is confirmed working.

---

### Step 3: Update Environment Variables

Update `.env`:
```bash
ADAPTER_ADDRESS=<NEW_ADAPTER_ADDRESS>
```

---

### Step 4: Redeploy RSC (pointing to NEW adapter)

```powershell
cd reactive
$env:ADAPTER_ADDRESS="<NEW_ADAPTER_ADDRESS>"
forge script script/DeployRSC.s.sol:DeployRSC --rpc-url ${REACTIVE_RPC} --broadcast --private-key ${REACTIVE_PRIVATE_KEY}
```

**What this does:**
- Deploys new RSC with NEW callback format
- Points to new adapter address
- Updates `.env` with new RSC address

---

### Step 5: Register RSC in NEW Adapter

```bash
node scripts/registerCrossChainRSC.js
```

**Make sure:**
- `.env` has `RSC_ADDRESS` = new RSC address
- `.env` has `ADAPTER_ADDRESS` = new adapter address

---

### Step 6: Subscribe and Fund NEW RSC

```bash
node scripts/fundAndCoverDebt.js
node scripts/subscribeToAave.js
node scripts/subscribeToQueryHelper.js
```

---

### Step 7: Verify System

```bash
node scripts/verifyFullSystem.js
```

**Check:**
- ✅ Alpha role on new adapter
- ✅ RSC registered in adapter
- ✅ RSC subscribed to events
- ✅ RSC funded and active

---

## ⚠️ Important Notes

### Keep Old Contracts for Safety

**Don't revoke old adapter's Alpha role yet:**
- Keep as backup until new system is confirmed working
- Can revoke later once new system is stable

### Environment Variables

**Critical variables to update:**
- `ADAPTER_ADDRESS` → New adapter address
- `RSC_ADDRESS` → New RSC address
- Keep `TARGET_VAULT`, `QUERY_HELPER_ADDRESS` the same

### Gas Costs

**Estimated costs:**
- Adapter deployment: ~0.001 ETH
- RSC deployment: ~0.01 ETH (Reactive Network)
- Subscriptions: Minimal
- Funding: 4 REACT tokens

---

## ✅ Verification Checklist

After redeployment, verify:

- [ ] New adapter deployed
- [ ] Alpha role granted to new adapter
- [ ] RSC deployed with new adapter address
- [ ] RSC registered in adapter
- [ ] RSC subscribed to Aave events
- [ ] RSC subscribed to QueryHelper events
- [ ] RSC funded and active
- [ ] Test callback execution (wait for next Aave event)

---

## 🚀 Quick Command Reference

```bash
# 1. Deploy adapter
node scripts/deployAdapterStandalone.js

# 2. Update .env ADAPTER_ADDRESS (manually)

# 3. Deploy RSC
cd reactive
$env:ADAPTER_ADDRESS="<NEW_ADAPTER>"
forge script script/DeployRSC.s.sol:DeployRSC --rpc-url ${REACTIVE_RPC} --broadcast --private-key ${REACTIVE_PRIVATE_KEY}

# 4. Update .env RSC_ADDRESS (manually)

# 5. Register RSC
node scripts/registerCrossChainRSC.js

# 6. Fund and subscribe
node scripts/fundAndCoverDebt.js
node scripts/subscribeToAave.js
node scripts/subscribeToQueryHelper.js

# 7. Verify
node scripts/verifyFullSystem.js
```

---

**Status:** Ready for redeployment after Alpha role grant confirmed.

