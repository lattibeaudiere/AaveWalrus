# Developer Review Request - APY Monitoring Strategy

## Quick Summary for Developer

We're building an **autonomous yield optimizer** that automatically moves USDC between Aave V3 and Compound V3 on Arbitrum based on real-time APY changes.

**Key Question:** How should we efficiently get APY from both protocols to compare and rebalance?

---

## What's Working ✅

1. **Aave Events:** Subscribed to `ReserveDataUpdated`, events are firing and being processed
2. **APY in Aave Events:** `liquidityRate` field contains supply APY (we can extract it)
3. **Cross-Chain Execution:** Callback pattern works, Reactive Network executes on Arbitrum

## What's Blocking ⚠️

1. **Compound APY:** `AccrueInterest` event doesn't contain APY - only has `interestAccumulated`, `borrowIndex`, `totalBorrows`
2. **Compound Events:** Subscribed but 0 events detected (may be inactive market or wrong event)
3. **Response Handling:** If we query Compound via Callback, how do we get the response back?

---

## Architecture Context

```
Reactive Network (Chain 1597)
  ↓ Monitors Arbitrum events
  ↓ Calls react() on our RSC
Our RSC
  ↓ Decodes event data
  ↓ Needs both APYs
  ↓ Emits Callback to Arbitrum
Arbitrum (Chain 42161)
  ↓ Executes callback
  ↓ Calls adapter.executeReaction()
  ↓ Vault executes FuseAction[]
```

**Constraints:**
- RSC runs on Reactive Network (can't directly call Arbitrum contracts)
- Must use Callback pattern for cross-chain execution
- Callbacks are one-way: RSC → Arbitrum

---

## Core Question

**When Aave event fires and provides APY:**
- ✅ We have Aave APY (from event)
- ❌ We need Compound APY (not in event)

**How to get Compound APY?**

**Option 1:** Emit Callback to query Compound contract  
**Challenge:** How do we get the query result back to RSC to compare?

**Option 2:** Always query both protocols (even if only one event fires)  
**Challenge:** Less efficient, more gas

**Option 3:** Different Compound event that contains APY  
**Challenge:** Need to verify such event exists

---

## Current Event Data

### Aave V3 ReserveDataUpdated (✅ Has APY)
```solidity
event ReserveDataUpdated(
    address indexed reserve,      // USDC address
    uint256 liquidityRate,        // ✅ Supply APY (in RAY, 1e27)
    uint256 stableBorrowRate,
    uint256 variableBorrowRate,   // Borrow APY
    uint256 liquidityIndex,
    uint256 variableBorrowIndex
)
```

### Compound V3 AccrueInterest (❌ No APY)
```solidity
event AccrueInterest(
    uint256 interestAccumulated,  // ❌ Not APY
    uint256 borrowIndex,           // ❌ Cumulative index
    uint256 totalBorrows           // ❌ Borrow amount
)
```

**To get Compound APY, need to call:**
- `supplyRatePerSecond()` - Returns current supply rate
- Or calculate from: `getSupplyRate(utilization)`

---

## Specific Questions

1. **Callback Response Pattern:** 
   - Can Reactive Network support getting return values from Callback executions?
   - Or do we need a two-step process (query, then separate rebalance)?

2. **Compound Event Choice:**
   - Is `AccrueInterest` the right event?
   - Should we use `Supply` or `Withdraw` events instead?
   - Why are we seeing 0 events (inactive market or wrong signature)?

3. **Architecture Optimization:**
   - Should we use Aave events as sole trigger and always query Compound?
   - Or maintain dual subscriptions and query the other protocol each time?

4. **Implementation Path:**
   - What's the recommended pattern for querying on-chain data from Reactive Network?
   - Are there examples of query-response patterns in Reactive Network?

---

## Test Data Available

**Recent Aave Event Processed:**
- TX: `0xbec332aeea7b64143cbfe99e9af0ce5c1df32e5adb73ed22b50e0297777f2be6`
- `liquidityRate`: `36795798975974136664154059` (RAY format)
- Successfully decoded and extracted

**Contract Addresses:**
- RSC: `0xdC2eAcb778951d9dFB0050a0E3335C7Ab3E4CabE`
- Adapter: `0xdBfd1ea4387352f2b98bC2d08B4Cd4B668C0860D`
- Aave Pool: `0x794a61358D6845594F94dc1DB02A252b5b4814aD`
- Compound: `0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA`

---

**Please review and provide feedback on:**
1. Best approach for getting Compound APY
2. Callback response handling pattern
3. Any architecture improvements
4. Potential bottlenecks we should be aware of

