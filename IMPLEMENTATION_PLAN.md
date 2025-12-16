# Implementation Plan - Developer Feedback Integration

## 📋 Developer Feedback Summary

The developer provided excellent recommendations that solve all blocking issues. This document outlines the implementation plan based on their feedback.

## ✅ Key Recommendations Accepted

### 1. **Compound APY Retrieval Method**
- **Selected:** Option A - Callback query with event response
- **Rationale:** Efficient, uses Aave events as trigger, handles response via event subscription

### 2. **Response Handling Pattern**
- **Selected:** Option A - Store pending query, process on response event
- **Implementation:** Use `queryNonce` + `timestamp` for matching requests/responses

### 3. **Compound Event Subscription**
- **Selected:** Option B - Remove it, rely only on Aave events
- **Rationale:** Compound events too sparse, Aave fires more frequently and provides APY

### 4. **Strategy Threshold**
- **Selected:** Moderate - 20-50 bps (0.2-0.5%)
- **Current Setting:** 30 bps (0.3%) as a balanced middle ground

## 🏗️ Components to Implement

### 1. QueryHelper Contract (✅ Created)

**Location:** `contracts/QueryHelper.sol`

**Functions:**
- `queryCompoundApy(uint256 nonce)` - Called via Callback, emits event
- `getCompoundApy()` - View function for testing

**Deployment:** On Arbitrum (chain 42161)

### 2. Updated RSC Contract

**Changes Needed:**

1. **Add QueryHelper Address**
   - Constructor parameter
   - State variable

2. **Add Strategy State Variables**
   - `lastAaveApyBps` - Store Aave APY for comparison
   - `queryNonce` - Match queries with responses
   - `lastRebalanceTime` - Throttle rebalancing

3. **Update react() Function**
   - Handle Aave events: Extract APY, emit query Callback
   - Handle QueryHelper events: Compare APYs, rebalance if threshold met

4. **Add Helper Functions**
   - `_extractAaveApy()` - Decode liquidityRate to APY bps
   - `_buildRebalanceActions()` - Construct FuseAction[] for rebalance
   - `_abs()` - Absolute difference for spread calculation

5. **Add Subscription Function**
   - `subscribeToQueryHelper()` - Subscribe to CompoundApyQueried events

### 3. Deployment Scripts

**New Scripts Needed:**
1. `scripts/deployQueryHelper.js` - Deploy QueryHelper to Arbitrum
2. `scripts/subscribeToQueryHelper.js` - Subscribe RSC to QueryHelper events
3. `scripts/updateRSCWithQueryHelper.js` - Redeploy RSC with QueryHelper address

## 📝 Implementation Checklist

### Phase 1: QueryHelper Deployment
- [ ] Deploy QueryHelper to Arbitrum
- [ ] Verify deployment and test queryCompoundApy()
- [ ] Compute CompoundApyQueried event topic0
- [ ] Update .env with QUERY_HELPER_ADDRESS

### Phase 2: RSC Updates
- [ ] Update RSC constructor to accept queryHelper address
- [ ] Add strategy state variables
- [ ] Implement Aave event handler (extract APY, emit query)
- [ ] Implement QueryHelper response handler (compare, rebalance)
- [ ] Add helper functions for APY extraction and action building
- [ ] Add cooldown/throttle logic
- [ ] Add error handling

### Phase 3: Subscriptions
- [ ] Subscribe RSC to Aave events (already done ✅)
- [ ] Subscribe RSC to QueryHelper CompoundApyQueried events
- [ ] Unsubscribe from Compound AccrueInterest (per recommendation)

### Phase 4: Testing
- [ ] Test Aave event processing
- [ ] Test Compound APY query flow
- [ ] Test spread calculation
- [ ] Test rebalancing execution
- [ ] Test cooldown mechanism
- [ ] Test edge cases (low liquidity, rate anomalies)

### Phase 5: Monitoring
- [ ] Set up event monitoring
- [ ] Monitor gas usage
- [ ] Track rebalancing frequency
- [ ] Validate profitability

## 🔧 Technical Details

### Event Topic Calculation

**CompoundApyQueried Event:**
```solidity
event CompoundApyQueried(uint256 indexed nonce, uint256 apyBps, uint256 timestamp);
```

**Topic0:** `keccak256("CompoundApyQueried(uint256,uint256,uint256)")`

**Calculation:**
```javascript
const { ethers } = require('ethers');
const topic0 = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes("CompoundApyQueried(uint256,uint256,uint256)")
);
console.log("Topic0:", topic0);
```

### Fuse Addresses

From `ARBITRUM_FUSE_ADDRESSES.md`:
- **Aave Supply Fuse:** `0x304756cD719382281fBD640f5F7932465eD663D6`
- **Aave Balance Fuse:** `0x4CB1c4774BA1B65802c68Adb33DE99ABf8B21228`
- **Compound Supply Fuse:** `0xB0b3dc1B27C6c8007c9B01a768d6717f6813fE94`
- **Compound Balance Fuse:** `0xCF730BAA5542DC7570907696271bA96019FcD10C`

### Rebalancing Actions

**Aave to Compound:**
1. Withdraw from Aave (AAVE_WITHDRAW_FUSE)
2. Supply to Compound (COMPOUND_SUPPLY_FUSE)

**Compound to Aave:**
1. Withdraw from Compound (COMPOUND_WITHDRAW_FUSE)
2. Supply to Aave (AAVE_SUPPLY_FUSE)

**Note:** Need to check IPOR Fusion documentation for exact FuseAction data encoding format.

## 🎯 Success Criteria

1. ✅ Aave events trigger Compound APY queries
2. ✅ QueryHelper emits CompoundApyQueried events
3. ✅ RSC receives and processes QueryHelper events
4. ✅ APYs are compared correctly
5. ✅ Rebalancing executes when spread > threshold
6. ✅ Cooldown prevents spam rebalancing
7. ✅ System operates autonomously

## 📚 Next Steps

1. **Immediate:** Deploy QueryHelper contract to Arbitrum
2. **Next:** Update RSC contract with new logic
3. **Then:** Redeploy RSC with QueryHelper address
4. **Finally:** Subscribe to QueryHelper events and test

---

**Status:** Ready for implementation  
**Last Updated:** Based on developer feedback

