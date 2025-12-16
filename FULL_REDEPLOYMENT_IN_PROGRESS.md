# Full Redeployment - In Progress

## ✅ Step 1: Adapter Deployed

**New Adapter Address:** `0x7d485F8AD54f7A3dC9f0871e61E63A97f678CCA7`

**Status:** ✅ Deployed successfully
**Transaction:** `0xe033ee3dc720366faba3c629b6b298bacc4d0a4725d17ae1202ed0b9f9597c46`

---

## 📋 Next Steps

### Step 2: Grant Alpha Role (USER ACTION REQUIRED)

**Action:** Grant Alpha role to new adapter via Vault Builder UI

**Adapter Address:** `0x7d485F8AD54f7A3dC9f0871e61E63A97f678CCA7`

**Steps:**
1. Go to Vault Builder UI
2. Navigate to Roles → Alpha
3. Add address: `0x7d485F8AD54f7A3dC9f0871e61E63A97f678CCA7`
4. Confirm grant

**After granting role, continue with Step 3.**

---

### Step 3: Deploy RSC (AUTOMATED)

Will deploy RSC pointing to new adapter.

---

### Step 4: Register RSC (AUTOMATED)

Will register new RSC in adapter using `registerCrossChainRSC`.

---

### Step 5: Subscribe and Fund (AUTOMATED)

Will subscribe to Aave and QueryHelper events and fund with REACT.

---

**Waiting for Alpha role grant before proceeding...**

