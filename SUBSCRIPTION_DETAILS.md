# Subscription Details - What We're Monitoring

This document explains exactly what events the Fusion Reactive RSC is subscribed to and why.

## 📋 Current Subscriptions

### 1. Aave V3 ReserveDataUpdated Event

**Chain:** Arbitrum (Chain ID: 42161)  
**Contract:** Aave V3 Pool (`0x794a61358D6845594F94dc1DB02A252b5b4814aD`)  
**Event Signature:** `ReserveDataUpdated`  
**Topic 0:** `0xb2a02bf1a92354a66946e3533277a66dd13726c1695e5ac302d1c1fcb97d2200`

#### What This Event Means

The `ReserveDataUpdated` event is emitted by Aave V3 whenever:
- A user deposits assets into the pool
- A user withdraws assets from the pool
- A user borrows assets
- A user repays a loan
- Interest accrues on the pool
- The liquidity rate (APY) changes

**Key Information in the Event:**
- Current liquidity rate (APY) for supplying assets
- Current borrow rate (APY) for borrowing assets
- Total liquidity in the pool
- Total borrowed amount
- Reserve configuration updates

#### Why We Monitor This

For yield optimization, we need to know when Aave V3's APY changes so we can:
- Compare it with Compound V3's APY
- Trigger a rebalance if the spread is profitable
- Move funds to the higher-yielding protocol

**Example Scenario:**
```
1. Large deposit happens on Aave V3 (e.g., $10M USDC)
2. Aave's USDC supply APY drops from 5.2% to 4.8%
3. Compound V3's USDC supply APY is still 5.0%
4. Event emitted: ReserveDataUpdated
5. Our contract's react() function is called
6. Contract compares: Compound (5.0%) > Aave (4.8%)
7. Contract triggers rebalance: Move USDC from Aave to Compound
```

---

### 2. Compound V3 AccrueInterest Event

**Chain:** Arbitrum (Chain ID: 42161)  
**Contract:** Compound V3 USDC Market (`0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA`)  
**Event Signature:** `AccrueInterest`  
**Topic 0:** `0x717fee053884ab1935ba6d0140f6ed225371439611d9674ff445419d6a0fa1b7`

#### What This Event Means

The `AccrueInterest` event is emitted by Compound V3 whenever:
- Interest accrues on borrowed assets
- The supply rate (APY) is updated
- A new interest rate calculation occurs (typically on every transaction)

**Key Information in the Event:**
- New supply rate (APY) for supplying assets
- New borrow rate (APY) for borrowing assets
- Total interest accrued
- Updated utilization rate

#### Why We Monitor This

Similar to Aave, we monitor Compound V3's APY changes to:
- Compare with Aave V3's current APY
- Identify arbitrage opportunities
- Rebalance funds when the spread is profitable

**Example Scenario:**
```
1. Large borrow happens on Compound V3
2. Utilization increases, supply APY increases
3. Compound's USDC supply APY rises from 4.8% to 5.2%
4. Aave V3's USDC supply APY is still 5.0%
5. Event emitted: AccrueInterest
6. Our contract's react() function is called
7. Contract compares: Aave (5.0%) < Compound (5.2%)
8. Contract triggers rebalance: Move USDC from Aave to Compound
```

---

## 🎯 Combined Strategy

### The Yield Spread Arbitrage Logic

Our contract monitors **both** events to execute a yield spread arbitrage strategy:

```
┌─────────────────────────────────────────────────┐
│  Aave V3 ReserveDataUpdated Event              │
│  → Emitted when APY changes                     │
│  → Triggers react() function                    │
│  → Compare Aave APY vs Compound APY            │
└─────────────────────────────────────────────────┘
                    ↓
         ┌──────────────────────┐
         │  Calculate Spread    │
         │  = |Aave - Compound| │
         └──────────────────────┘
                    ↓
         ┌──────────────────────┐
         │  Spread > Threshold?│
         │  (e.g., > 50 bps)    │
         └──────────────────────┘
                    ↓
        YES ─────────┴────────── NO
         │                      │
         │                      └→ Do Nothing
         │
         ↓
┌─────────────────────────────────────────────────┐
│  Construct FuseAction[]                        │
│  - Exit lower APY protocol                     │
│  - Enter higher APY protocol                   │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  Execute via ReactiveAlphaAdapter              │
│  → Calls IPOR Fusion Vault                     │
│  → Moves USDC between protocols                │
└─────────────────────────────────────────────────┘
```

### What Happens When Events Occur

1. **Event Occurs on Arbitrum**
   - Either Aave V3 emits `ReserveDataUpdated`
   - Or Compound V3 emits `AccrueInterest`

2. **Reactive Network Detects Event**
   - Reactive Network monitors both contract addresses
   - Matches event signature (topic0)
   - Finds our subscription

3. **Our Contract's `react()` Function is Called**
   - Called by Reactive Network sequencer
   - Receives LogRecord with event data
   - Processes the event

4. **Strategy Logic Executes** (Currently minimal - needs implementation)
   - Fetch current APY from both protocols
   - Calculate spread
   - If spread > threshold, construct FuseAction[]
   - Call adapter to execute rebalance

---

## 📊 Event Details

### Aave V3 ReserveDataUpdated

**Full Event Signature:**
```solidity
event ReserveDataUpdated(
    address indexed reserve,
    uint256 liquidityRate,
    uint256 stableBorrowRate,
    uint256 variableBorrowRate,
    uint256 liquidityIndex,
    uint256 variableBorrowIndex
)
```

**What We Get:**
- `reserve`: The asset address (e.g., USDC)
- `liquidityRate`: Current supply APY (in ray, 1e27)
- `stableBorrowRate`: Stable borrow APY
- `variableBorrowRate`: Variable borrow APY
- `liquidityIndex`: Cumulative interest index
- `variableBorrowIndex`: Cumulative borrow interest index

**Key Field for Us:** `liquidityRate` - This is the APY we care about

### Compound V3 AccrueInterest

**Full Event Signature:**
```solidity
event AccrueInterest(
    uint256 interestAccumulated,
    uint256 borrowIndex,
    uint256 totalBorrows
)
```

**What We Get:**
- `interestAccumulated`: Interest accrued since last update
- `borrowIndex`: Cumulative borrow interest index
- `totalBorrows`: Total amount borrowed

**To Get APY:** We need to calculate from the rate model or call the contract directly

---

## 🔍 How to Verify Subscriptions

### Check Current Subscriptions

```bash
# Check if subscribed to Aave
cast call $RSC_ADDRESS "aaveSubscribed()" --rpc-url $REACTIVE_RPC

# Check if subscribed to Compound
cast call $RSC_ADDRESS "compoundSubscribed()" --rpc-url $REACTIVE_RPC

# View on Reactscan
# https://reactscan.io/address/$RSC_ADDRESS
```

### Monitor Events on Arbitrum

You can watch for these events on Arbitrum to see when they occur:

**Aave V3:**
```bash
# Watch for ReserveDataUpdated events
cast logs \
  --from-block latest \
  --address 0x794a61358D6845594F94dc1DB02A252b5b4814aD \
  --rpc-url https://arb1.arbitrum.io/rpc \
  "ReserveDataUpdated(address,uint256,uint256,uint256,uint256,uint256)"
```

**Compound V3:**
```bash
# Watch for AccrueInterest events
cast logs \
  --from-block latest \
  --address 0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA \
  --rpc-url https://arb1.arbitrum.io/rpc \
  "AccrueInterest(uint256,uint256,uint256)"
```

---

## 📈 Expected Event Frequency

### Aave V3 ReserveDataUpdated
- **Frequency:** Every time someone interacts with Aave V3
- **Typical Rate:** 10-100+ times per hour (depending on activity)
- **Triggers:** Deposits, withdrawals, borrows, repays

### Compound V3 AccrueInterest
- **Frequency:** Every time someone interacts with Compound V3
- **Typical Rate:** 5-50+ times per hour (depending on activity)
- **Triggers:** Deposits, withdrawals, borrows, repays

**Note:** Both events fire frequently, so your `react()` function will be called often. Make sure your strategy logic is efficient!

---

## 🎯 Current Implementation Status

### What's Working ✅
- ✅ Subscriptions active and verified
- ✅ Events will trigger `react()` function
- ✅ Contract funded and ready

### What Needs Implementation ⚠️
- ⚠️ Actual APY fetching logic in `react()`
- ⚠️ Spread calculation
- ⚠️ Threshold comparison
- ⚠️ FuseAction[] construction based on spread
- ⚠️ Integration with actual yield optimization strategy

### Current `react()` Function

Currently, the `react()` function is a minimal implementation that:
1. Receives the event log
2. Validates it's from Arbitrum
3. Calls adapter with empty actions (no-op)

**Next Steps:** Implement the full yield optimization logic.

---

## 📚 Additional Resources

- **Aave V3 Documentation:** https://docs.aave.com/developers/v/3.0/
- **Compound V3 Documentation:** https://docs.compound.finance/
- **Reactive Network Docs:** Official Reactive Network documentation
- **Reactscan Explorer:** https://reactscan.io

---

## Summary

**We are subscribed to:**
1. **Aave V3 ReserveDataUpdated** - Emitted when USDC pool APY changes on Aave
2. **Compound V3 AccrueInterest** - Emitted when USDC market APY changes on Compound

**Why:**
- To monitor APY changes in real-time
- To identify arbitrage opportunities
- To automatically rebalance funds to the higher-yielding protocol

**What happens:**
- When either event occurs on Arbitrum
- Reactive Network calls our `react()` function
- Function processes the event and can trigger rebalancing

