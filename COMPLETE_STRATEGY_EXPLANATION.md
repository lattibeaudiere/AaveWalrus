# Complete Strategy Explanation - For Developer Review

## 🎯 What We're Trying to Accomplish

Build an **autonomous, event-driven yield optimization system** that:
1. Automatically monitors APY rates on Aave V3 and Compound V3 (both on Arbitrum)
2. Moves USDC funds between the two protocols when the APY spread is profitable
3. Executes rebalancing without any manual intervention or off-chain services
4. Operates entirely on-chain using Reactive Network + IPOR Fusion infrastructure

**Goal:** Maximize USDC yield by always being in the higher-yielding protocol, accounting for gas costs.

---

## 🔍 How We're Catching APY Balance On-Chain

### Primary Method: Aave V3 ReserveDataUpdated Event

**What Event:**
- `ReserveDataUpdated(address indexed reserve, uint256 liquidityRate, ...)`
- Emitted by Aave V3 Pool (`0x794a61358D6845594F94dc1DB02A252b5b4814aD`)
- Fires whenever any reserve's interest rate parameters change

**Why This Event:**
1. **Contains APY Directly:**
   - `liquidityRate` field = current supply APY rate (in RAY format: 1e27)
   - No need to query external contracts
   - Real-time rate exactly when it changes

2. **Frequent Updates:**
   - Observed 11-30 events per 1000 blocks
   - Fires on deposits, withdrawals, borrows, rate adjustments
   - Provides near real-time APY monitoring

3. **Proven Reliability:**
   - ✅ We've successfully subscribed and processed events
   - ✅ Event data structure is well-documented
   - ✅ Subscription matching works correctly

**How We Extract APY:**
```solidity
// Event data structure (from log.data):
// [0] = reserve address (but it's in topic1, not data)
// [1] = liquidityRate (RAY format: 1e27)
// [2] = stableBorrowRate
// [3] = variableBorrowRate  
// [4] = liquidityIndex
// [5] = variableBorrowIndex

// Decode:
(, uint256 liquidityRate, , , ,) = abi.decode(log.data, (address, uint256, uint256, uint256, uint256, uint256));

// Convert RAY to APY basis points:
uint256 SECONDS_PER_YEAR = 365 days;
uint256 RAY = 1e27;
uint256 aaveApyBps = (liquidityRate * SECONDS_PER_YEAR * 100) / RAY;
// APY% = aaveApyBps / 10000
```

**Filtering:**
- We subscribe with `REACTIVE_IGNORE` for topic1 (matches all reserves)
- In code, we check if `log.topic_1 == USDC_ADDRESS` before processing
- This allows monitoring all reserves but only acting on USDC changes

---

### Secondary Method: QueryHelper Contract for Compound APY

**What We Do:**
- Deploy a simple `QueryHelper` contract on Arbitrum
- When Aave event fires, RSC emits Callback to QueryHelper
- QueryHelper calls Compound contract: `getUtilization()` → `supplyRate(utilization)`
- QueryHelper calculates APY and emits `CompoundApyQueried` event
- RSC subscribes to this event to receive Compound APY

**Why This Pattern:**
1. **Compound Events Don't Have APY:**
   - `AccrueInterest` event only has `interestAccumulated`, `borrowIndex`, `totalBorrows`
   - These don't directly give current APY rate
   - Would need contract query anyway

2. **Event Response Pattern:**
   - Reactive Network supports event-based responses
   - QueryHelper emits event after query
   - RSC receives event with APY data
   - Clean separation of concerns

3. **Efficiency:**
   - Only query Compound when needed (when Aave rate changes)
   - Reuse Aave's frequent events as trigger
   - Minimal gas usage (~20k for event emit)

**QueryHelper Implementation:**
```solidity
function queryCompoundApy(uint256 nonce) external returns (uint256 apyBps) {
    IComet comet = IComet(COMPOUND_USDC);
    
    // Get utilization (0-1e18 scale)
    uint256 utilization = comet.getUtilization();
    
    // Get supply rate per second (1e18 scale)
    uint256 ratePerSecond = comet.supplyRate(utilization);
    
    // Convert to APY basis points
    uint256 SECONDS_PER_YEAR = 365 days;
    apyBps = (ratePerSecond * SECONDS_PER_YEAR * 100) / 1e18;
    
    // Emit for RSC to capture
    emit CompoundApyQueried(nonce, apyBps, block.timestamp);
    
    return apyBps;
}
```

---

## 🚫 What We're NOT Using (And Why)

### Compound V3 AccrueInterest Events - REMOVED

**Why We Initially Subscribed:**
- Thought it might contain APY data
- Wanted dual triggers (Aave OR Compound events)

**Why We're Removing It:**
- ❌ Event doesn't contain APY (only interest accumulated)
- ❌ Too infrequent (0 events found in recent blocks)
- ❌ Would need query anyway (defeats purpose)
- ✅ Aave events + query pattern is cleaner

**Developer Recommendation:** Remove Compound event subscription, rely solely on Aave events as primary trigger.

---

## 🏗️ Complete Technical Flow

### Step-by-Step Execution:

```
1. USER DEPOSITS/WITHDRAWS ON AAVE
   → Aave Pool calculates new utilization
   → New liquidityRate (supply APY) computed
   → Aave emits ReserveDataUpdated event
   → Event logged on Arbitrum blockchain

2. REACTIVE NETWORK DETECTS EVENT
   → Matches our subscription (chainId=42161, address=Aave Pool, topic0=ReserveDataUpdated)
   → Calls RSC.react() on Reactive Network
   → Passes LogRecord with event data

3. RSC EXTRACTS AAVE APY
   → Decodes liquidityRate from log.data
   → Converts RAY to basis points
   → Stores in lastAaveApyBps
   → Increments queryNonce

4. RSC QUERIES COMPOUND APY
   → Emits Callback event:
     - chain_id: 42161 (Arbitrum)
     - contract: QueryHelper address
     - payload: queryCompoundApy(nonce)
   → Reactive Network executes Callback on Arbitrum

5. QUERYHELPER QUERIES COMPOUND
   → Calls Compound.getUtilization()
   → Calls Compound.supplyRate(utilization)
   → Calculates APY in basis points
   → Emits CompoundApyQueried(nonce, apyBps, timestamp)

6. REACTIVE NETWORK DETECTS QUERYHELPER EVENT
   → Matches subscription to QueryHelper
   → Calls RSC.react() again
   → Passes LogRecord with Compound APY

7. RSC COMPARES APYs
   → Extracts Compound APY from event
   → Verifies nonce matches
   → Calculates spread = |Aave APY - Compound APY|
   → Checks: spread > 30 bps AND cooldown expired

8. RSC CONSTRUCTS REBALANCE (if threshold met)
   → Determines direction (Aave→Compound or Compound→Aave)
   → Gets vault balance (via balance fuse)
   → Constructs FuseAction[]:
     - Action 1: Withdraw from lower-yielding protocol
     - Action 2: Deposit to higher-yielding protocol

9. RSC EXECUTES REBALANCE
   → Emits Callback to adapter.executeReaction(FuseAction[])
   → Reactive Network executes on Arbitrum

10. ADAPTER EXECUTES ON VAULT
    → Validates RSC is registered and active
    → Calls vault.execute(FuseAction[])
    → Vault executes through whitelisted fuses
    → Funds moved between protocols
```

---

## 📊 Event Data Structures

### Aave V3 ReserveDataUpdated

**Complete Event:**
```solidity
event ReserveDataUpdated(
    address indexed reserve,        // Topic 1 (indexed)
    uint256 liquidityRate,          // Data [0]
    uint256 stableBorrowRate,       // Data [1]
    uint256 variableBorrowRate,      // Data [2]
    uint256 liquidityIndex,          // Data [3]
    uint256 variableBorrowIndex      // Data [4]
);
```

**In LogRecord:**
- `log.topic_1` = reserve address (USDC: `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`)
- `log.data` = ABI-encoded: `(address, uint256, uint256, uint256, uint256, uint256)`
  - Note: address is included in data for decoding, but indexed fields are in topics

**APY Value:**
- `liquidityRate` = Supply APY rate per second (RAY: 1e27)
- Example: `36795798975974136664154059` (RAY) = ~3.68% APY

---

### QueryHelper CompoundApyQueried

**Complete Event:**
```solidity
event CompoundApyQueried(
    uint256 indexed nonce,    // Topic 1 (indexed)
    uint256 apyBps,           // Data [0]
    uint256 timestamp         // Data [1]
);
```

**In LogRecord:**
- `log.topic_1` = nonce (matches queryNonce)
- `log.data` = ABI-encoded: `(uint256, uint256)`
- `log.emitter` = QueryHelper contract address

**APY Value:**
- `apyBps` = Compound APY in basis points (1 bps = 0.01%)
- Example: `300` bps = 3.00% APY

---

## ⚙️ Strategy Decision Logic

### When to Rebalance

**Conditions (ALL must be true):**
1. ✅ `spread > THRESHOLD_BPS` (30 bps = 0.3%)
2. ✅ `block.timestamp >= lastRebalanceTime + MIN_REBALANCE_COOLDOWN` (1 hour)
3. ✅ `nonce matches` (for QueryHelper responses)
4. ✅ `timestamp not expired` (within 60 seconds of query)

### Rebalance Direction

**If Aave APY > Compound APY:**
- Move funds FROM Compound TO Aave
- Actions: Compound exit → Aave enter

**If Compound APY > Aave APY:**
- Move funds FROM Aave TO Compound  
- Actions: Aave exit → Compound enter

### Position Size

**Current Implementation:**
- Rebalance full position (100% of vault's USDC)
- Could be optimized to partial rebalancing
- Balance retrieved via balance fuse queries

---

## 🔧 Bottlenecks Identified & Solutions

### Bottleneck 1: Compound APY Not in Events
**Status:** ✅ SOLVED
- **Solution:** QueryHelper contract with event response pattern
- **Implementation:** Deploy QueryHelper, subscribe to its events

### Bottleneck 2: Callback Response Handling
**Status:** ✅ SOLVED  
- **Solution:** Event emission pattern (QueryHelper emits event, RSC subscribes)
- **Implementation:** Standard Reactive Network pattern

### Bottleneck 3: Compound Events Too Sparse
**Status:** ✅ SOLVED
- **Solution:** Don't rely on Compound events, use Aave as primary trigger
- **Implementation:** Remove Compound subscription (per recommendation)

### Bottleneck 4: Gas Costs
**Status:** ✅ ADDRESSED
- **Solution:** 30 bps threshold ensures profitability
- **Monitoring:** Track gas usage and adjust threshold if needed

---

## 💡 Why This Architecture?

### Reactive Network (RNK)
- **Event Monitoring:** Automatically detects and forwards matching events
- **Cross-Chain Execution:** Enables RSC on RNK to control Arbitrum vault
- **No Polling:** Event-driven = instant response to rate changes
- **Autonomous:** Fully on-chain, no external services needed

### IPOR Fusion
- **Modular Fuses:** Standardized interfaces for protocol interactions
- **Security:** Whitelisted fuses prevent unauthorized actions
- **Composability:** Easy to add/remove protocols
- **Proven:** Production-tested infrastructure

### Event-Driven Pattern
- **Efficiency:** Only act when rates actually change
- **Real-Time:** Instant response to on-chain events
- **Cost-Effective:** No constant polling or queries

---

## 📋 Fuse Addresses (Arbitrum Mainnet)

From `ARBITRUM_FUSE_ADDRESSES.md`:

**Aave V3:**
- Supply Fuse: `0x304756cD719382281fBD640f5F7932465eD663D6`
- Balance Fuse: `0x4CB1c4774BA1B65802c68Adb33DE99ABf8B21228`

**Compound V3:**
- Supply Fuse: `0xB0b3dc1B27C6c8007c9B01a768d6717f6813fE94`
- Balance Fuse: `0xCF730BAA5542DC7570907696271bA96019FcD10C`

**Note:** Need to verify if Supply fuse handles both enter/exit or if separate withdraw fuse exists.

---

## 🎯 Success Metrics

### Current Status:
- ✅ Events being detected and processed
- ✅ Aave APY extracted successfully from events
- ✅ Cross-chain execution working (Callbacks executing)
- ⏳ Compound APY query flow (QueryHelper ready to deploy)
- ⏳ Rebalancing logic (implementation in progress)

### Target Metrics:
- **Response Time:** < 5 blocks from event to execution
- **Gas Efficiency:** < 300k gas per full cycle
- **Profitability:** Rebalance when spread > 30 bps on $10k+ positions
- **Uptime:** 99%+ autonomous operation

---

## 🚀 Next Steps

1. **Deploy QueryHelper** to Arbitrum
2. **Update RSC** with full strategy implementation
3. **Redeploy RSC** with QueryHelper address
4. **Subscribe** to QueryHelper events
5. **Test** end-to-end flow
6. **Monitor** and optimize

---

**Document Purpose:** Comprehensive explanation for developer review  
**Status:** Implementation-ready based on developer feedback  
**Last Updated:** 2025-01-01

