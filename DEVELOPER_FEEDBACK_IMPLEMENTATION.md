# Developer Feedback Implementation Guide

## 📋 Summary of Developer Recommendations

### Decisions Made

1. **Compound APY Retrieval:** Callback query with event response pattern ✅
2. **Response Handling:** Store pending query, process on response event ✅  
3. **Compound Event Subscription:** Remove it, rely only on Aave events ✅
4. **Strategy Threshold:** 30 bps (0.3%) ✅

### Architecture Pattern

```
Aave Event Fires
  ↓
RSC react() extracts Aave APY from event
  ↓
RSC emits Callback to QueryHelper.queryCompoundApy()
  ↓
QueryHelper queries Compound contract
  ↓
QueryHelper emits CompoundApyQueried event
  ↓
RSC react() receives event with Compound APY
  ↓
RSC compares APYs, calculates spread
  ↓
If spread > 30 bps: emit Callback to execute rebalance
```

## 🔧 Implementation Components

### 1. QueryHelper Contract ✅ Created

**File:** `contracts/QueryHelper.sol`

**Functionality:**
- Queries Compound V3 `getUtilization()` and `supplyRate(utilization)`
- Calculates APY in basis points
- Emits `CompoundApyQueried(uint256 indexed nonce, uint256 apyBps, uint256 timestamp)`

**Deployment:** On Arbitrum (42161)

### 2. Updated RSC Contract (In Progress)

**File:** `reactive/contracts/FusionReactiveRSC.sol`

**Updates Needed:**
- ✅ Added `queryHelper` address
- ✅ Added strategy state variables
- ⏳ Implement Aave event handler
- ⏳ Implement QueryHelper response handler
- ⏳ Add helper functions
- ⏳ Add cooldown logic

### 3. Event Subscription

**Current:**
- ✅ Aave V3 ReserveDataUpdated (active)
- ✅ Compound V3 AccrueInterest (active, but will remove)

**To Add:**
- ⏳ QueryHelper CompoundApyQueried event

**To Remove:**
- ⏳ Compound V3 AccrueInterest (per recommendation)

## 📊 Event Data Flow

### Aave V3 ReserveDataUpdated Event

**Event Structure:**
```solidity
event ReserveDataUpdated(
    address indexed reserve,        // Topic 1
    uint256 liquidityRate,          // Data [0]
    uint256 stableBorrowRate,      // Data [1]
    uint256 variableBorrowRate,     // Data [2]
    uint256 liquidityIndex,         // Data [3]
    uint256 variableBorrowIndex     // Data [4]
)
```

**In RSC react():**
```solidity
// Extract reserve from topic1
address reserve = address(uint160(uint256(log.topic_1)));

// Extract APY from data
(, uint256 liquidityRate, , , ,) = abi.decode(log.data, (address, uint256, uint256, uint256, uint256, uint256));

// Convert to basis points
uint256 aaveApyBps = (liquidityRate * SECONDS_PER_YEAR * 100) / RAY;
```

### QueryHelper CompoundApyQueried Event

**Event Structure:**
```solidity
event CompoundApyQueried(
    uint256 indexed nonce,    // Topic 1
    uint256 apyBps,           // Data [0]
    uint256 timestamp         // Data [1]
)
```

**In RSC react():**
```solidity
// Extract nonce from topic1
uint256 nonce = log.topic_1;

// Extract APY from data
(uint256 compoundApyBps, uint256 timestamp) = abi.decode(log.data, (uint256, uint256));

// Verify nonce matches and not expired
if (nonce == queryNonce && block.timestamp <= timestamp + 60) {
    // Compare and rebalance
}
```

## 🎯 FuseAction Construction

Based on IPOR Fusion documentation and fuse interfaces:

### Aave V3 Supply Fuse

**Enter (Deposit):**
```solidity
// Data format: (address asset, uint256 amount)
bytes memory data = abi.encode(USDC_ADDRESS, amount);
FuseAction memory action = FuseAction({
    fuse: AAVE_SUPPLY_FUSE,
    data: data
});
```

**Exit (Withdraw):**
```solidity
// Data format: (address asset, uint256 amount, address to)
bytes memory data = abi.encode(USDC_ADDRESS, amount, VAULT_ADDRESS);
FuseAction memory action = FuseAction({
    fuse: AAVE_WITHDRAW_FUSE,
    data: data
});
```

### Compound V3 Supply Fuse

**Enter (Deposit):**
```solidity
// Data format: (address asset, uint256 amount)
bytes memory data = abi.encode(USDC_ADDRESS, amount);
FuseAction memory action = FuseAction({
    fuse: COMPOUND_SUPPLY_FUSE,
    data: data
});
```

**Exit (Withdraw):**
```solidity
// Data format: (address asset, uint256 amount)
bytes memory data = abi.encode(USDC_ADDRESS, amount);
FuseAction memory action = FuseAction({
    fuse: COMPOUND_WITHDRAW_FUSE,
    data: data
});
```

**Note:** Exact data format needs verification from IPOR Fusion fuse ABIs.

## 📝 Implementation Status

### Completed ✅
- [x] QueryHelper contract created
- [x] QueryHelper deployment script created
- [x] RSC constructor updated with queryHelper parameter
- [x] Strategy state variables added to RSC
- [x] Implementation plan documented

### In Progress ⏳
- [ ] Deploy QueryHelper to Arbitrum
- [ ] Update RSC react() function with full logic
- [ ] Implement helper functions
- [ ] Add cooldown/throttle logic
- [ ] Test APY extraction
- [ ] Test query flow

### Pending 📋
- [ ] Redeploy RSC with QueryHelper address
- [ ] Subscribe to QueryHelper events
- [ ] Unsubscribe from Compound events
- [ ] Test full rebalancing flow
- [ ] Deploy to production

## 🔗 Key Addresses

**Fuse Addresses (from ARBITRUM_FUSE_ADDRESSES.md):**
- Aave Supply: `0x304756cD719382281fBD640f5F7932465eD663D6`
- Aave Balance: `0x4CB1c4774BA1B65802c68Adb33DE99ABf8B21228`
- Compound Supply: `0xB0b3dc1B27C6c8007c9B01a768d6717f6813fE94`
- Compound Balance: `0xCF730BAA5542DC7570907696271bA96019FcD10C`

**Note:** Need Aave Withdraw fuse address - may be same as Supply or different fuse.

## 💡 Next Steps

1. **Deploy QueryHelper** to Arbitrum
2. **Compute event topic0** for CompoundApyQueried
3. **Update RSC contract** with full react() implementation
4. **Redeploy RSC** with QueryHelper address
5. **Subscribe to QueryHelper events**
6. **Test end-to-end flow**

---

**Status:** Implementation in progress  
**Last Updated:** Based on developer feedback

