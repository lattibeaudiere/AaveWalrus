# APY Monitoring Strategy - Technical Deep Dive

## 🎯 Project Goal

Build an **autonomous yield optimization strategy** that automatically rebalances USDC between **Aave V3** and **Compound V3** on Arbitrum, triggered in real-time by on-chain rate changes.

**Objective:** Maximize yield by moving funds to whichever protocol offers higher APY, only when the spread exceeds a threshold (to cover gas costs).

## 🏗️ Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│ Arbitrum (Chain 42161)                                      │
│                                                             │
│  ┌─────────────┐      ┌──────────────┐                    │
│  │ Aave V3     │      │ Compound V3  │                    │
│  │ Pool        │      │ USDC Market  │                    │
│  │             │      │              │                    │
│  │ Emits:      │      │ Emits:       │                    │
│  │ ReserveData │      │ AccrueInterest│                    │
│  └──────┬──────┘      └──────┬───────┘                    │
│         │                     │                            │
│         └──────────┬──────────┘                            │
│                    │                                        │
│                    ▼ Events                                │
│                                                             │
│  ┌──────────────────────────────────────────────┐          │
│  │ ReactiveAlphaAdapter                          │          │
│  │ (Bridge between RSC and Vault)               │          │
│  └──────────────────────────────────────────────┘          │
│                    ▲                                        │
│                    │ FuseAction[]                           │
│  ┌──────────────────────────────────────────────┐          │
│  │ IPOR Fusion Plasma Vault                     │          │
│  │ (ERC-4626 Vault holding USDC)               │          │
│  └──────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ Callback Execution
                            │
┌─────────────────────────────────────────────────────────────┐
│ Reactive Network (Chain 1597)                               │
│                                                             │
│  ┌──────────────────────────────────────────┐            │
│  │ Reactive Network Sequencer                  │            │
│  │ - Monitors Arbitrum events                  │            │
│  │ - Matches subscriptions                    │            │
│  │ - Calls react() on RSC                      │            │
│  │ - Executes Callbacks on Arbitrum            │            │
│  └──────────────────────────────────────────┘            │
│                    │                                        │
│                    ▼ Event Match                           │
│                                                             │
│  ┌──────────────────────────────────────────┐            │
│  │ FusionReactiveRSC (Our Contract)         │            │
│  │                                           │            │
│  │ react(IReactive.LogRecord) {              │            │
│  │   1. Decode event data                    │            │
│  │   2. Extract/fetch APYs                    │            │
│  │   3. Calculate spread                     │            │
│  │   4. If spread > threshold:                │            │
│  │      - Construct FuseAction[]              │            │
│  │      - Emit Callback to Arbitrum           │            │
│  │ }                                         │            │
│  └──────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

### Key Technologies

- **Reactive Network (RNK):** Event monitoring and cross-chain execution layer
- **IPOR Fusion:** Modular vault infrastructure with Fuses (standardized protocol integrations)
- **ERC-4626 Plasma Vault:** Tokenized vault holding USDC funds
- **Reactive Smart Contract (RSC):** Autonomous decision-making contract

## 📊 Event Monitoring Strategy

### Current Subscriptions

#### 1. **Aave V3 ReserveDataUpdated Event**

**Contract:** `0x794a61358D6845594F94dc1DB02A252b5b4814aD` (Aave V3 Pool)  
**Chain:** Arbitrum (42161)  
**Event Signature:** `ReserveDataUpdated(address indexed reserve, uint256 liquidityRate, uint256 stableBorrowRate, uint256 variableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex)`  
**Topic0:** `0x804c9b842b2748a22bb64b345453a3de7ca54a6ca45ce00d415894979e22897a`

**Subscription Details:**
- **Topic1:** `REACTIVE_IGNORE` (wildcard - matches all reserves)
- **Topic2-3:** `REACTIVE_IGNORE`
- **Filter:** Any `ReserveDataUpdated` event from Aave Pool

**Why This Event:**
- ✅ **Contains APY directly** - `liquidityRate` field is the supply APY rate in RAY format (1e27)
- ✅ **Real-time updates** - Fires whenever any reserve's rate changes
- ✅ **No external calls needed** - APY is embedded in event data
- ✅ **Frequent events** - ~11-30 events per 1000 blocks observed

**Event Data Structure:**
```solidity
// When decoded from log.data:
uint256 liquidityRate;        // Supply APY rate (in RAY, 1e27)
uint256 stableBorrowRate;     // Stable borrow APY (usually 0)
uint256 variableBorrowRate;   // Variable borrow APY
uint256 liquidityIndex;       // Cumulative interest index
uint256 variableBorrowIndex;  // Cumulative borrow interest index

// log.topic_1 contains the reserve address (USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831)
```

**APY Extraction:**
```solidity
// Convert RAY to APY (basis points)
uint256 SECONDS_PER_YEAR = 365 * 24 * 3600;
uint256 RAY = 1e27;
uint256 supplyAPYBps = (liquidityRate * SECONDS_PER_YEAR * 100) / RAY;
// Supply APY = supplyAPYBps / 10000
```

**Current Status:** ✅ **WORKING** - Events are being processed successfully

---

#### 2. **Compound V3 AccrueInterest Event**

**Contract:** `0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA` (Compound V3 USDC Market)  
**Chain:** Arbitrum (42161)  
**Event Signature:** `AccrueInterest(uint256 interestAccumulated, uint256 borrowIndex, uint256 totalBorrows)`  
**Topic0:** `0x717fee053884ab1935ba6d0140f6ed225371439611d9674ff445419d6a0fa1b7`

**Subscription Details:**
- **Topic1-3:** `REACTIVE_IGNORE`
- **Filter:** Any `AccrueInterest` event from Compound USDC market

**Why This Event:**
- ⚠️ **Available event** - Compound V3 doesn't emit many alternative events
- ⚠️ **Fires on interest accrual** - Should fire periodically

**Event Data Structure:**
```solidity
// When decoded from log.data:
uint256 interestAccumulated;  // Interest accrued since last update (NOT APY)
uint256 borrowIndex;          // Cumulative borrow interest index
uint256 totalBorrows;         // Total amount borrowed
```

**Problem:** ❌ **Does NOT contain APY**
- Event only provides accumulated interest, not the current rate
- Need to calculate/utilize rate from contract state

**APY Extraction Challenge:**
```solidity
// This does NOT work - event doesn't have APY:
// ❌ uint256 supplyAPY = ??? // Not in event data!

// Must query contract instead:
// Option 1: Call supplyRatePerSecond()
// Option 2: Calculate from utilization: getSupplyRate(utilization)
// Option 3: Get baseSupplyRate() and apply utilization curve
```

**Current Status:** ⚠️ **SUBSCRIBED BUT NO EVENTS** - 0 events found in recent blocks

---

## 🔍 Current Implementation Status

### What Works

1. ✅ **Aave Events Processing**
   - Subscriptions active and matching events
   - `react()` function called when Aave events fire
   - Event data decoded successfully
   - APY extracted from `liquidityRate` field

2. ✅ **Cross-Chain Execution**
   - Callback pattern working
   - Reactive Network executing callbacks on Arbitrum
   - Adapter receiving execution requests

### What Needs Implementation

1. ⚠️ **Compound APY Fetching**
   - Current: Event doesn't provide APY
   - Needed: On-chain query to Compound contract
   - Challenge: Requires Callback to Arbitrum to query

2. ⚠️ **Strategy Logic**
   - Current: Empty `FuseAction[]` (no-op)
   - Needed: Actual rebalancing logic
   - Components:
     - Compare APYs
     - Calculate spread
     - Check threshold
     - Construct withdrawal/deposit actions

3. ⚠️ **Compound Event Monitoring**
   - Current: 0 events detected (may be wrong event or inactive market)
   - Needed: Verify correct event or alternative approach

## 🚧 Identified Bottlenecks & Challenges

### 1. **Compound APY Not in Events**

**Problem:** Compound's `AccrueInterest` event doesn't contain APY rate.

**Current Impact:**
- Can't get Compound APY directly from event
- Need additional contract call
- Adds complexity and gas cost

**Options:**

**Option A: Query Compound When Aave Events Fire** ⭐ (Recommended)
- **Approach:** When Aave `ReserveDataUpdated` fires:
  1. Extract Aave APY from event (already have it)
  2. Emit Callback to query Compound `supplyRatePerSecond()` on Arbitrum
  3. Wait for callback response with Compound APY
  4. Compare and rebalance
  
- **Pros:**
  - Use Aave events as primary trigger (they provide APY)
  - Only need one additional call for Compound
  - Most efficient approach
  
- **Cons:**
  - Requires two-step Callback pattern
  - More complex logic flow
  
- **Implementation Complexity:** Medium

**Option B: Dual-Event Monitoring with Separate Queries**
- **Approach:** 
  - When Aave event fires → query Compound APY → compare
  - When Compound event fires → query Aave APY → compare
  
- **Pros:**
  - Responds to changes in either protocol
  
- **Cons:**
  - Requires querying the other protocol each time
  - More gas usage
  
- **Implementation Complexity:** Medium-High

**Option C: Subscribe to Compound Supply/Withdraw Events**
- **Approach:** Use different Compound events that fire more frequently
  
- **Pros:**
  - More frequent triggers
  
- **Cons:**
  - Still need to query for APY
  - Events may not indicate rate changes
  
- **Implementation Complexity:** Medium

**Option D: Periodic Polling Instead of Events**
- **Approach:** Don't rely on events, periodically check APYs
  
- **Pros:**
  - Always have both APYs
  
- **Cons:**
  - Defeats purpose of event-driven system
  - Requires timer/cron mechanism
  - Not real-time
  
- **Implementation Complexity:** High (requires new architecture)

---

### 2. **No Compound Events Detected**

**Problem:** We've subscribed to Compound `AccrueInterest` but found 0 events in recent blocks.

**Possible Reasons:**
1. **Inactive Market** - Compound V3 USDC market may have low/no activity
2. **Wrong Event Signature** - May need different event
3. **Event Frequency** - `AccrueInterest` may fire very infrequently
4. **Market Not Active** - Market may be paused or have no supply/borrow activity

**Verification Needed:**
- Check Compound V3 contract directly for events
- Verify market is active
- Check if alternative events exist (Supply, Withdraw, etc.)

**Recommendation:**
- Verify Compound V3 market activity on Arbitrum
- Consider using Aave events as primary trigger (they're working)
- Query Compound APY on-demand when needed

---

### 3. **Callback Response Pattern**

**Problem:** If we query Compound APY via Callback, we need to handle the response.

**Current Limitation:**
- Callbacks are one-way: RSC → Arbitrum
- Can't directly get return values back to RSC
- Need to implement response handling

**Solutions:**

**Solution 1: Store Query Request, Process on Response**
- RSC stores that it's waiting for Compound APY
- When Callback response arrives (via new event), process comparison
- More complex state management

**Solution 2: Two-Step Callback Chain**
- First Callback: Query Compound APY
- Second Callback (from query response): Compare and execute rebalance
- Requires callback-to-callback pattern

**Solution 3: Always Query Both (Simple but Less Efficient)**
- When either event fires, query both protocols
- Compare and rebalance
- Simpler but uses more gas

---

## 💡 Recommended Approach

### Strategy: Aave-Driven with On-Demand Compound Query

**Primary Trigger:** Aave V3 `ReserveDataUpdated` events

**Flow:**
```
1. Aave ReserveDataUpdated fires (contains Aave APY)
   ↓
2. react() receives event with Aave APY in log.data
   ↓
3. Extract Aave APY from liquidityRate
   ↓
4. Emit Callback to query Compound supplyRatePerSecond()
   ↓
5. (Challenge: Get Compound APY response)
   ↓
6. Calculate spread = |Aave APY - Compound APY|
   ↓
7. If spread > threshold:
   - Construct FuseAction[] for rebalance
   - Emit Callback to execute on Arbitrum
```

### Implementation Details Needed

**1. Aave APY Extraction (Easy - Already Have It)**
```solidity
// In react() function:
(address reserve, uint256 liquidityRate, , uint256 variableBorrowRate, , ) = 
    abi.decode(log.data, (address, uint256, uint256, uint256, uint256, uint256));

uint256 SECONDS_PER_YEAR = 365 * 24 * 3600;
uint256 supplyAPYBps = (liquidityRate * SECONDS_PER_YEAR * 100) / 1e27;
```

**2. Compound APY Query (Needs Callback)**
```solidity
// Emit Callback to query Compound
bytes memory payload = abi.encodeWithSignature(
    "supplyRatePerSecond()"
);

emit Callback(
    ARBITRUM_CHAIN_ID,
    COMPOUND_USDC,
    500000,
    payload
);
```

**3. Handling Compound Response (Challenge)**
- Option A: Compound query triggers separate react() call (if we subscribe to query response)
- Option B: Always query both when event fires, store Aave APY in state
- Option C: Use compound query result in same transaction (if Reactive Network supports)

---

## 🔧 Technical Decisions Needed from Developer

### Decision 1: Compound APY Retrieval Method

**Question:** How should we get Compound APY when Aave event fires?

- [ ] Option A: Callback query (with response handling)
- [ ] Option B: Always query both protocols on any event
- [ ] Option C: Use Compound events differently
- [ ] Option D: Different architecture entirely

### Decision 2: Response Handling Pattern

**Question:** How do we handle Compound APY query response?

- [ ] Option A: Store pending query, process on response event
- [ ] Option B: Two-step callback chain
- [ ] Option C: Query synchronously (if Reactive Network supports)
- [ ] Option D: Always query both, compare immediately

### Decision 3: Compound Event Subscription

**Question:** Should we keep Compound event subscription?

- [ ] Option A: Keep it, use for dual-trigger approach
- [ ] Option B: Remove it, rely only on Aave events
- [ ] Option C: Switch to different Compound event

### Decision 4: Strategy Threshold

**Question:** What spread threshold should trigger rebalancing?

- [ ] Conservative: 50-100 bps (0.5-1%)
- [ ] Moderate: 20-50 bps (0.2-0.5%)
- [ ] Aggressive: 10-20 bps (0.1-0.2%)

**Considerations:**
- Gas costs on Arbitrum
- Minimum profitable spread
- Frequency of rebalancing

---

## 📋 Implementation Checklist

- [x] Deploy Reactive Smart Contract to Reactive Network
- [x] Subscribe to Aave V3 ReserveDataUpdated events
- [x] Subscribe to Compound V3 AccrueInterest events
- [x] Implement Callback pattern for cross-chain execution
- [x] Verify events are being processed
- [ ] **Implement Aave APY extraction from event data**
- [ ] **Implement Compound APY query mechanism**
- [ ] **Implement response handling for Compound query**
- [ ] **Implement spread calculation logic**
- [ ] **Implement FuseAction[] construction for rebalancing**
- [ ] **Test rebalancing execution**
- [ ] **Implement cooldown/throttling mechanism**
- [ ] **Add error handling and fallbacks**

---

## 🔗 Key Contracts & Addresses

- **RSC Contract:** `0xdC2eAcb778951d9dFB0050a0E3335C7Ab3E4CabE` (Reactive Network)
- **Adapter:** `0xdBfd1ea4387352f2b98bC2d08B4Cd4B668C0860D` (Arbitrum)
- **Aave V3 Pool:** `0x794a61358D6845594F94dc1DB02A252b5b4814aD` (Arbitrum)
- **Compound V3 USDC:** `0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA` (Arbitrum)
- **USDC:** `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` (Arbitrum)

---

## 📚 Documentation References

- Reactive Network Lesson 2: Events and Callbacks
- IPOR Fusion Documentation: https://docs.ipor.io/ipor-fusion/
- Aave V3 Documentation: https://docs.aave.com/
- Compound V3 Documentation: https://docs.compound.finance/

---

## 🎯 Success Criteria

1. ✅ Events are being detected and processed
2. ⏳ APY can be extracted from both protocols
3. ⏳ Spread calculation works correctly
4. ⏳ Rebalancing executes when spread exceeds threshold
5. ⏳ System operates autonomously without manual intervention

---

## 🤔 Questions for Developer Review

1. **Is the Callback response pattern viable?** Can we get Compound APY query results back to the RSC?

2. **Should we use Compound events at all?** Or rely solely on Aave events and always query Compound?

3. **Is there a better Compound event?** Should we subscribe to Supply/Withdraw events instead?

4. **Gas optimization:** What's the most efficient way to get both APYs?

5. **Architecture feedback:** Are we using Reactive Network and IPOR Fusion correctly?

6. **Edge cases:** How should we handle market pauses, low liquidity, or rate anomalies?

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-01  
**Status:** Ready for Developer Review

