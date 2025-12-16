# Event APY Analysis

## ✅ YES - The Event Contains APY Information!

### Event Structure

The `ReserveDataUpdated` event from Aave V3 contains:

1. **`liquidityRate`** - The **supply APY rate** (in RAY format, 1e27)
2. **`variableBorrowRate`** - The variable borrow APY rate
3. **`stableBorrowRate`** - The stable borrow APY rate (usually 0)
4. **`liquidityIndex`** - Cumulative interest index for tracking
5. **`variableBorrowIndex`** - Cumulative borrow interest index

### From the Processed Event

**Raw Values (from event data):**
- Liquidity Rate: `36795798975974136664154059` (RAY format)
- Variable Borrow Rate: `52207460514283402021591337` (RAY format)
- Stable Borrow Rate: `0`

### Key Insight

The event **directly provides the APY rate** in the `liquidityRate` field. You don't need to:
- Make external calls to fetch APY
- Query the Aave Data Provider
- Calculate from indices

**You can decode it directly from `log.data`!**

### How to Use This in Your Contract

In your `react()` function:

```solidity
function react(IReactive.LogRecord calldata log) external vmOnly {
    // Decode the ReserveDataUpdated event
    // log.topic_1 contains the reserve address (USDC)
    // log.data contains: liquidityRate, stableBorrowRate, variableBorrowRate, liquidityIndex, variableBorrowIndex
    
    // Check if this is a USDC event
    address reserve = address(uint160(uint256(log.topic_1)));
    if (reserve != USDC_ADDRESS) return;
    
    // Decode the event data
    (uint256 liquidityRate, , uint256 variableBorrowRate, , ) = 
        abi.decode(log.data, (uint256, uint256, uint256, uint256, uint256));
    
    // Convert RAY to APY (approximate)
    // APY ≈ (liquidityRate * SECONDS_PER_YEAR * 100) / 1e27
    uint256 supplyAPYBps = (liquidityRate * SECONDS_PER_YEAR * 100) / 1e27;
    
    // Now you have the Aave APY!
    // Next: Fetch Compound APY, compare, and rebalance if needed
}
```

### Benefits

✅ **No external calls needed** - APY is in the event data
✅ **Instant access** - No need to query contracts
✅ **Real-time** - Always the latest rate when event fires
✅ **Gas efficient** - Pure decoding, no contract calls

### Next Steps

1. Decode `liquidityRate` from `log.data` in your `react()` function
2. Fetch Compound V3 APY (may need contract call or different event)
3. Calculate spread = |Aave APY - Compound APY|
4. If spread > threshold, construct `FuseAction[]` and rebalance

The event gives you everything you need to make the rebalancing decision!

