# Grant Alpha Role to Adapter - Instructions

## ⚠️ CRITICAL: Grant to ADAPTER, Not RSC!

**Adapter Address (needs Alpha role):**
```
0xa60c91Aa6E0e203De3a6692a82eE65884B3B2D09
```

**RSC Address (already has role, but not needed):**
```
0xEFD20dC51F7c82B7430490Bf45767bA57F6819fc
```

---

## Why Adapter Needs Alpha Role

**Execution Flow:**
1. RSC processes event → Emits Callback
2. Reactive Network executes Callback on Arbitrum
3. **Adapter receives callback** → Calls `vault.execute()`
4. Vault executes FuseActions → Funds deployed

**The adapter is what actually calls `vault.execute()`, so it needs Alpha role!**

---

## Steps in Vault Builder

1. Go to your vault: https://app.ipor.io/fusion/vaults
2. Navigate to "Reactive Yield Optimizer" vault
3. Find **"Roles"** or **"Permissions"** section
4. Grant **ALPHA_ROLE** to: `0xa60c91Aa6E0e203De3a6692a82eE65884B3B2D09`
5. Confirm the transaction

---

## After Granting

Once you've granted the Alpha role, we need to check why callbacks aren't executing:

1. **QueryHelper callbacks** - Should execute when RSC emits callback
2. **Adapter callbacks** - Should execute when RSC decides to rebalance
3. **Execution verification** - Check if adapter can now call vault

---

## Verification

After granting, run:
```bash
node scripts/checkVaultState.js
node scripts/verifyFullSystem.js
```

This will confirm:
- ✅ Adapter has Alpha role
- ✅ Callbacks are executing
- ✅ Funds are being deployed

---

**Status**: Waiting for you to grant Alpha role to adapter address in Vault Builder.

