# RSC Registration in Adapter - Explained

## What Does "RSC Not Registered" Mean?

### The Issue

**Status:** ❌ RSC is **NOT** registered in the Adapter  
**Impact:** Adapter may reject callbacks from RSC

---

## Two Different Systems

### 1. Alpha Role on Vault (✅ Already Set)
- **Location:** IPOR Fusion Vault
- **Address:** `0xee29A26179fE20D5D202dAE4a279119E08edc60b`
- **Role:** ALPHA_ROLE granted to RSC address
- **Purpose:** Allows RSC to execute on the vault
- **Status:** ✅ Already granted (from Vault Builder)

### 2. RSC Registration in Adapter (❌ Not Set)
- **Location:** ReactiveAlphaAdapter contract
- **Address:** `0xdBfd1ea4387352f2b98bC2d08B4Cd4B668C0860D`
- **Purpose:** Tracks RSC and validates callbacks
- **Status:** ❌ Not registered yet

---

## Why Registration is Needed

### Adapter's `executeReaction()` Function

The adapter checks registration before executing:

```solidity
function executeReaction(FuseAction[] calldata actions) external {
    // Checks if RSC is registered
    require(isRSCRegistered[msg.sender], "RSC not registered");
    
    // Checks if RSC is active
    RSCConfig storage config = rscConfigs[msg.sender];
    require(config.isActive, "RSC not active");
    
    // Checks if vault matches
    require(config.vault == targetVault, "Vault mismatch");
    
    // Only then executes on vault
    vault.execute(actions);
}
```

**What This Means:**
- Without registration, adapter will **reject** callbacks from RSC
- RSC can emit Callback events, but adapter won't execute them
- Registration stores RSC metadata (vault address, chain ID, status)

---

## Is Registration Required?

**Short Answer:** YES, for the adapter to execute callbacks

**Why:**
1. **Security Check:** Adapter verifies RSC is legitimate
2. **Vault Matching:** Ensures RSC is calling correct vault
3. **Status Tracking:** Tracks active/inactive state
4. **Execution Count:** Monitors how many times RSC executed

**Without Registration:**
- RSC can emit Callback events ✅
- Adapter receives callbacks ✅
- **Adapter rejects execution ❌** ("RSC not registered")

---

## How to Fix

### Register RSC in Adapter

Run this script:
```bash
node scripts/registerRSC.js
```

**What It Does:**
1. Calls `adapter.registerRSC(RSC_ADDRESS, description)`
2. Adapter validates RSC (checks `getTargetVault()` function)
3. Stores RSC config in adapter state
4. Marks RSC as active

**After Registration:**
- ✅ RSC tracked in adapter
- ✅ Callbacks will be accepted
- ✅ Executions will proceed
- ✅ Status visible in adapter

---

## Registration vs Alpha Role

| Feature | Alpha Role (Vault) | RSC Registration (Adapter) |
|---------|-------------------|----------------------------|
| **Location** | IPOR Fusion Vault | ReactiveAlphaAdapter |
| **Purpose** | Permission to execute | Validation & tracking |
| **Who Grants** | Vault Owner/Guardian | Adapter Manager |
| **Status** | ✅ Already granted | ❌ Needs registration |
| **Required For** | Vault execution | Adapter execution |

**Both are needed:**
- **Alpha Role:** Allows RSC to execute on vault (already set)
- **Registration:** Allows adapter to accept RSC callbacks (needs to be done)

---

## Impact on System

### Current State (Without Registration)

**What Works:**
- ✅ RSC monitors events
- ✅ RSC processes events
- ✅ RSC emits Callback events
- ✅ Callbacks reach adapter

**What Doesn't Work:**
- ❌ Adapter rejects callbacks ("RSC not registered")
- ❌ No execution on vault
- ❌ No rebalances happen

### After Registration

**Everything Works:**
- ✅ RSC monitors events
- ✅ RSC processes events
- ✅ RSC emits Callback events
- ✅ Adapter accepts callbacks
- ✅ Adapter executes on vault
- ✅ Rebalances happen ✅

---

## Registration Process

### What Happens During Registration

1. **Validation:**
   - Adapter calls RSC's `getTargetVault()` function
   - Verifies vault address matches
   - Checks RSC is a valid contract

2. **Storage:**
   - Stores RSC address → vault mapping
   - Sets `isActive = true`
   - Records description
   - Initializes execution counters

3. **Activation:**
   - RSC becomes "registered" in adapter
   - Adapter will accept future callbacks
   - Executions can proceed

---

## Recommendation

**Register the RSC now** to enable full functionality:

```bash
node scripts/registerRSC.js
```

This is the missing piece that will allow the adapter to execute rebalances when RSC sends callbacks.

---

**Status:** Registration is required for adapter to execute callbacks  
**Action:** Run registration script to complete the setup  
**Impact:** Without it, callbacks are rejected and no rebalances occur

