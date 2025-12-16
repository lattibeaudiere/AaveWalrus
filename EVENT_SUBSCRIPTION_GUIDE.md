# Event Subscription Guide for Yield Optimization Strategy

## 🎯 **WHY WE NEED TO SUBSCRIBE TO EVENTS**

The yield optimization strategy needs to detect **when APY changes occur** on Aave V3 and Compound V3 to trigger autonomous rebalancing.

### The Problem
- APYs on lending protocols change frequently due to:
  - Large deposits/withdrawals
  - Borrow rate adjustments
  - Utilization ratio changes
  - Governance updates
- **We need to know INSTANTLY when rates change** to capture arbitrage opportunities

### The Solution
- Subscribe to protocol events that indicate **rate changes**
- When an event fires, the Reactive Network calls our `react()` function
- Our RSC compares the new rates and executes a rebalance if the spread exceeds threshold

---

## 📋 **EVENTS TO SUBSCRIBE TO**

### 1. **Aave V3: ReserveDataUpdated Event**

**Why This Event:**
- Emitted whenever reserve parameters change, including:
  - Liquidity rate (supply APY)
  - Borrow rates (stable/variable)
  - Liquidity index
  - Last update timestamp
- This is the **primary indicator** that APY has changed

**Event Signature:**
```solidity
ReserveDataUpdated(
    address indexed reserve,
    uint256 liquidityRate,
    uint256 stableBorrowRate,
    uint256 variableBorrowRate,
    uint256 liquidityIndex,
    uint256 variableBorrowIndex
)
```

**Event Topic (topic0):**
```solidity
keccak256("ReserveDataUpdated(address,uint256,uint256,uint256,uint256,uint256)")
// = 0xb2a02bf1a92354a66946e3533277a66dd13726c1695e5ac302d1c1fcb97d2200
```

**Contract Address (Arbitrum):**
- **Pool:** `0x794a61358D6845594F94dc1DB02A252b5b4814aD`
- **Pool Data Provider:** `0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654`

**When It Fires:**
- When liquidity rate changes (supply APY update)
- When borrow rates change
- When utilization ratio crosses thresholds
- Every block after rate update (if cumulative index changed)

---

### 2. **Compound V3: SupplyRateUpdated or UtilizationUpdate Event**

**Why This Event:**
- Compound V3 emits events when market utilization changes
- Utilization directly affects supply APY
- We need to detect when supply rates change

**Event Signature (Compound V3):**
```solidity
// Option 1: SupplyRateUpdated (if available)
SupplyRateUpdated(
    uint256 oldRate,
    uint256 newRate
)

// Option 2: UtilizationUpdate (more common)
UtilizationUpdate(
    uint256 oldUtilization,
    uint256 newUtilization
)

// Option 3: MarketUpdate (general market changes)
MarketUpdate(
    uint256 totalSupply,
    uint256 totalBorrow,
    uint256 utilization,
    uint256 supplyRate,
    uint256 borrowRate
)
```

**Event Topic (topic0):**
- **MarketUpdate:** `keccak256("MarketUpdate(uint256,uint256,uint256,uint256,uint256)")`
- Exact topic depends on Compound V3 contract version

**Contract Address (Arbitrum):**
- **USDC Market:** `0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA`

**When It Fires:**
- When supply/demand changes
- When utilization crosses thresholds (80%, 90%, etc.)
- When governance updates rates

---

## 🔍 **HOW TO FIND THE EXACT EVENT TOPIC**

### Method 1: Using Etherscan/Arbiscan
1. Go to the contract on Arbiscan
2. Click "Events" tab
3. Find the relevant event
4. Click on an event log
5. Copy the "Topic 0" (first topic) - this is the event signature hash

### Method 2: Using Cast (Foundry)
```bash
# Get the event signature hash
cast sig-event "ReserveDataUpdated(address,uint256,uint256,uint256,uint256,uint256)"

# For Aave V3 Pool on Arbitrum
cast sig-event "ReserveDataUpdated(address,uint256,uint256,uint256,uint256,uint256)"
# Output: 0xb2a02bf1a92354a66946e3533277a66dd13726c1695e5ac302d1c1fcb97d2200
```

### Method 3: Query Recent Events
```bash
# Get recent ReserveDataUpdated events from Aave Pool
cast logs \
  --rpc-url https://arb1.arbitrum.io/rpc \
  --address 0x794a61358D6845594F94dc1DB02A252b5b4814aD \
  --topic0 0xb2a02bf1a92354a66946e3533277a66dd13726c1695e5ac302d1c1fcb97d2200 \
  --from-block latest \
  --to-block latest
```

---

## ✅ **SUBSCRIPTION SETUP**

### Step 1: Subscribe to Aave V3 ReserveDataUpdated

```powershell
# Set environment variables
$env:REACTIVE_RPC = "https://mainnet-rpc.rnk.dev"
$env:REACTIVE_PRIVATE_KEY = "0x6fa42a2b9666e4b30ea146654085832b440591575780c668e0641b674abbb5e6"
$env:RSC_ADDRESS = "0x510682F3bd0F8ACB51C40CDE60132c52420Efc3F"

# Subscribe to Aave V3 ReserveDataUpdated event
cast send $env:RSC_ADDRESS `
  "subscribeTo(uint256,address,uint256)" `
  42161 `
  0x794a61358D6845594F94dc1DB02A252b5b4814aD `
  0xb2a02bf1a92354a66946e3533277a66dd13726c1695e5ac302d1c1fcb97d2200 `
  --rpc-url $env:REACTIVE_RPC `
  --private-key $env:REACTIVE_PRIVATE_KEY
```

**Parameters:**
- `42161`: Arbitrum chain ID
- `0x794a...`: Aave V3 Pool address
- `0xb2a0...`: ReserveDataUpdated event topic

### Step 2: Subscribe to Compound V3 MarketUpdate

```powershell
# First, find the exact event topic for Compound V3
# Check Compound V3 documentation or query events

# Subscribe to Compound V3 MarketUpdate event (once topic is confirmed)
cast send $env:RSC_ADDRESS `
  "subscribeTo(uint256,address,uint256)" `
  42161 `
  0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA `
  <COMPOUND_EVENT_TOPIC> `
  --rpc-url $env:REACTIVE_RPC `
  --private-key $env:REACTIVE_PRIVATE_KEY
```

---

## 🧠 **HOW IT WORKS**

### Flow Diagram:
```
┌─────────────────────────────────────────────────────────┐
│ Arbitrum (Chain 42161)                                   │
│                                                          │
│  1. Aave V3 Pool emits ReserveDataUpdated event        │
│     - USDC reserve parameters changed                    │
│     - New liquidity rate (APY) calculated                │
│     - Event logged to Arbitrum blockchain               │
│                                                          │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ Event Log
                     ▼
┌─────────────────────────────────────────────────────────┐
│ Reactive Network (Chain 1597)                            │
│                                                          │
│  2. Reactive Sequencer detects event                    │
│     - Matches subscription (chainId=42161,              │
│       address=Aave Pool, topic0=ReserveDataUpdated)      │
│     - Calls react() on FusionReactiveRSC                 │
│                                                          │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ Cross-chain call
                     ▼
┌─────────────────────────────────────────────────────────┐
│ FusionReactiveRSC (0x5106...Efc3F)                      │
│                                                          │
│  3. react() function executes:                         │
│     a. Identifies eventSource = Aave Pool               │
│     b. Fetches current Aave APY                         │
│     c. Fetches current Compound APY                     │
│     d. Calculates spread                                │
│     e. If spread > threshold:                            │
│        - Construct FuseAction[]                          │
│        - Call adapter.executeReaction()                  │
│                                                          │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ Cross-chain call
                     ▼
┌─────────────────────────────────────────────────────────┐
│ ReactiveAlphaAdapter (Arbitrum)                           │
│                                                          │
│  4. executeReaction() receives FuseAction[]            │
│     - Validates RSC is registered                        │
│     - Calls vault.execute() with actions                │
│                                                          │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ IPOR Fusion Plasma Vault                                │
│                                                          │
│  5. Vault executes FuseActions:                        │
│     - Withdraw USDC from lower-yielding protocol        │
│     - Deposit USDC to higher-yielding protocol          │
│     - Rebalance complete!                               │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 **EVENT DATA PARSING**

### In `react()` Function:

```solidity
function react(IReactive.LogRecord calldata log) external {
    // log.chain_id = 42161 (Arbitrum)
    // log.emitter = 0x794a... (Aave Pool address)
    // log.topic_0 = 0xb2a0... (ReserveDataUpdated signature)
    // log.topic_1 = USDC address (indexed reserve parameter)
    // log.data = ABI-encoded event data (rates, indices, etc.)
    
    if (log.emitter == AAVE_POOL) {
        // Parse event data
        (, uint256 liquidityRate, , , , ) = abi.decode(
            log.data,
            (uint256, uint256, uint256, uint256, uint256, uint256)
        );
        
        // Convert liquidity rate to APY
        aaveCurrentAPY = liquidityRateToBasisPoints(liquidityRate);
    }
}
```

---

## ⚠️ **IMPORTANT CONSIDERATIONS**

### 1. **Event Frequency**
- Aave V3 emits ReserveDataUpdated **very frequently** (sometimes every block)
- Not every emission means a significant APY change
- Your `react()` function should:
  - Check if the actual rate changed significantly
  - Implement cooldown periods
  - Filter noise from actual opportunities

### 2. **Gas Costs**
- Each subscription costs REACT tokens
- Multiple subscriptions multiply costs
- Monitor your RSC balance and fund it regularly

### 3. **Event Filtering**
Currently, we subscribe to **ALL** ReserveDataUpdated events:
```solidity
subscribeTo(42161, AAVE_POOL, RESERVE_DATA_UPDATED_TOPIC);
```

**Better approach (if supported):**
- Filter by reserve address (topic1 = USDC address)
- Only subscribe to USDC-specific events
- Reduces unnecessary triggers

### 4. **Compound V3 Events**
- Compound V3 event structure may differ from Aave
- Verify the exact event signature before subscribing
- May need to subscribe to multiple events

---

## 🔧 **ALTERNATIVE APPROACHES**

### Option 1: Polling Instead of Events
- Don't subscribe to events
- Use `manualTrigger()` function periodically
- Pros: Lower gas costs, more control
- Cons: Not instant, may miss opportunities

### Option 2: Multiple Event Subscriptions
- Subscribe to deposit/withdrawal events
- These indicate potential rate changes
- Pros: More granular control
- Cons: Higher complexity, more subscriptions

### Option 3: Time-Based Triggers
- Subscribe to block timestamp events
- Trigger rebalance checks periodically
- Pros: Predictable execution
- Cons: Not event-driven, may check unnecessarily

---

## 📝 **SUMMARY**

**Events to Subscribe:**
1. ✅ **Aave V3 ReserveDataUpdated** (confirmed)
   - Contract: `0x794a61358D6845594F94dc1DB02A252b5b4814aD`
   - Topic: `0xb2a02bf1a92354a66946e3533277a66dd13726c1695e5ac302d1c1fcb97d2200`
   
2. ⚠️ **Compound V3 MarketUpdate** (needs verification)
   - Contract: `0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA`
   - Topic: (to be determined)

**Why:**
- Detect APY changes instantly
- Trigger autonomous rebalancing
- Capture arbitrage opportunities
- Maximize yield optimization

**Next Steps:**
1. Subscribe to Aave V3 ReserveDataUpdated (confirmed event)
2. Verify Compound V3 event signature
3. Subscribe to Compound V3 events
4. Implement proper event parsing in `react()`
5. Test with real events

