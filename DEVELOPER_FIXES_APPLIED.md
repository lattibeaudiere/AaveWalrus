# Developer Feedback Fixes - Applied

## ✅ Fixes Applied

### 1. QueryHelper Precision Fix ✅
**File:** `contracts/QueryHelper.sol`
- Added rounding: `(ratePerSecond * SECONDS_PER_YEAR * 100 + 1e18 / 2) / 1e18`
- Applied to both `queryCompoundApy()` and `getCompoundApy()`

### 2. Event Topic0 Computation ✅
**File:** `reactive/contracts/FusionReactiveRSC.sol`
- Computed and set: `COMPOUND_APY_QUERIED_TOPIC = 0xbc75181d726fb199839a4832ddc558e7942ef478af322c6d275d9415ebd3ff4b`

### 3. Monitoring Event Added ✅
**File:** `reactive/contracts/FusionReactiveRSC.sol`
- Added: `event StrategyUpdate(uint256 aaveApy, uint256 compoundApy, uint256 spread, bool rebalanced);`

## ⏳ Fixes To Be Applied

### 4. Aave APY Extraction Fix (CRITICAL)
**Issue:** Event has `address indexed reserve` in topic1, so `log.data` only contains 5 uint256s
**Current:** `abi.decode(log.data, (address, uint256, uint256, uint256, uint256, uint256))` ❌
**Fixed:** `abi.decode(log.data, (uint256, uint256, uint256, uint256, uint256))` ✅
**Location:** In `react()` function, when handling Aave events

### 5. QueryHelper Subscription Function
**Add:** `subscribeToQueryHelper()` function to subscribe to QueryHelper events post-deployment

### 6. Full react() Implementation
**Implement:**
- Handle Aave events: extract APY, emit query callback
- Handle QueryHelper events: extract Compound APY, compare, rebalance
- Cooldown check (modifier or inline)
- FuseAction construction (verify exact struct format from IPOR)

### 7. Cooldown Modifier
**Add:** `modifier checkCooldown()` or inline check in react()

### 8. USDC Address Constant
**Add:** `address public constant USDC_ADDRESS = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;`

### 9. Fuse Addresses Constants
**Add constants for:**
- AAVE_SUPPLY_FUSE
- COMPOUND_SUPPLY_FUSE
- AAVE_BALANCE_FUSE (for balance queries)
- COMPOUND_BALANCE_FUSE (for balance queries)

## 📋 Fuse Struct Definitions (From IPOR Fusion)

### Aave V3 Supply Fuse

**Enter:**
```solidity
struct AaveV3SupplyFuseEnterData {
    address asset;
    uint256 amount;
    uint256 userEModeCategoryId; // 0 = no eMode
}

// Function: enter(AaveV3SupplyFuseEnterData memory data_)
// Selector: bytes4(keccak256("enter((address,uint256,uint256))"))
```

**Exit:**
```solidity
struct AaveV3SupplyFuseExitData {
    address asset;
    uint256 amount;
    // Note: No 'to' field - withdraws to vault (fuse context)
}

// Function: exit(AaveV3SupplyFuseExitData calldata data_)
// Selector: bytes4(keccak256("exit((address,uint256))"))
```

### Compound V3 Supply Fuse

**Enter:**
```solidity
struct CompoundV3SupplyFuseEnterData {
    address asset;
    uint256 amount;
}

// Function: enter(CompoundV3SupplyFuseEnterData memory data_)
// Selector: bytes4(keccak256("enter((address,uint256))"))
```

**Exit:**
```solidity
struct CompoundV3SupplyFuseExitData {
    address asset;
    uint256 amount;
}

// Function: exit(CompoundV3SupplyFuseExitData calldata data_)
// Selector: bytes4(keccak256("exit((address,uint256))"))
```

## 🔧 FuseAction Encoding

**Important:** FuseActions call the fuse's `enter()` or `exit()` functions via the vault's `execute()` method.

**Encoding Example (Aave Enter):**
```solidity
bytes memory data = abi.encodeWithSelector(
    bytes4(keccak256("enter((address,uint256,uint256))")),
    AaveV3SupplyFuseEnterData(USDC_ADDRESS, amount, 0)
);
```

**Encoding Example (Compound Exit):**
```solidity
bytes memory data = abi.encodeWithSelector(
    bytes4(keccak256("exit((address,uint256))")),
    CompoundV3SupplyFuseExitData(USDC_ADDRESS, amount)
);
```

## ⚠️ Action Items

1. **Verify Fuse ABIs:** Pull exact selectors from IPOR GitHub
2. **Test on Fork:** Validate FuseAction encoding before mainnet
3. **Add Vault Address:** Need vault address for balance queries
4. **Update react():** Implement full strategy logic with fixes
5. **Add Helper Functions:** `_extractAaveApy()`, `_extractCompoundApy()`, `_calculateSpread()`, `_buildRebalanceActions()`

---

**Status:** QueryHelper fixes applied, RSC fixes in progress  
**Priority:** Aave decode fix is CRITICAL - must be fixed before deployment

