# 🔧 QueryHelper Fix - Compound V3 Function

## Problem
QueryHelper was calling `supplyRatePerSecond()` which doesn't exist on Compound V3 Comet contracts.

## Solution
Updated QueryHelper to use the correct Compound V3 functions:
1. `getUtilization()` - Get current utilization
2. `getSupplyRate(utilization)` - Get supply rate based on utilization
3. `baseScale()` - Get the scale factor for rate calculations

## Changes Made

### Interface Update
```solidity
interface IComet {
    function getUtilization() external view returns (uint256);
    function getSupplyRate(uint256 utilization) external view returns (uint64);
    function baseScale() external view returns (uint256);
}
```

### Function Update
```solidity
function queryCompoundApy(uint256 nonce) external returns (uint256 apyBps) {
    IComet comet = IComet(COMPOUND_USDC);
    
    // Get utilization
    uint256 utilization = comet.getUtilization();
    
    // Get supply rate (scaled by baseScale)
    uint64 supplyRateRaw = comet.getSupplyRate(utilization);
    
    // Get baseScale for conversion
    uint256 baseScale = comet.baseScale();
    
    // Convert to APY in basis points
    uint256 SECONDS_PER_YEAR = 365 days;
    uint256 supplyRateScaled = uint256(supplyRateRaw) * 1e18;
    apyBps = (supplyRateScaled * SECONDS_PER_YEAR * 100 + baseScale / 2) / baseScale;
    
    emit CompoundApyQueried(nonce, apyBps, block.timestamp);
    return apyBps;
}
```

## Next Steps
1. Redeploy QueryHelper with fix
2. Test QueryHelper.queryCompoundApy() directly
3. Verify Reactive Network callbacks succeed
4. Confirm events are emitted and received by RSC

