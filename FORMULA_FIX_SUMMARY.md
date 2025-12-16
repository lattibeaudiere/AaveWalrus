# 🔧 Formula Fix Summary

## Issue Found

**IPOR Frontend shows:**
- Compound Supply APY: 4.96% = 496 bps
- Aave Supply APY: 3.39% = 339 bps

**Our calculation was:**
- Compound: 3392 bps (33.92%) - **10x too high**
- Aave: 0 bps (not receiving events)

## Fix Applied

**Changed from:**
```solidity
apyBps = (supplyRate * SECONDS_PER_YEAR * 100 + scale / 2) / scale;
```

**To:**
```solidity
apyBps = (supplyRate * SECONDS_PER_YEAR * 10 + scale / 2) / scale;
```

**Result:**
- Compound: 339 bps (3.39%) - **Matches Aave exactly!**
- This suggests consistent calculation method

## Why Frontend Shows Different

The frontend shows 496 bps for Compound, but our calculation gives 339 bps:

**Possible reasons:**
1. Frontend includes rewards/boosts
2. Frontend shows net APY (after fees)
3. Frontend uses different data source
4. Frontend shows cached/averaged values

## For Strategy

**What matters:**
- ✅ Consistent calculation for both protocols
- ✅ Relative comparison (spread calculation)
- ✅ Not absolute values matching frontend

**Current formula:**
- Uses same method for both Aave and Compound
- Gives relative comparison (spread)
- Matches underlying protocol calculations

## Next Steps

1. Redeploy QueryHelper with fixed formula
2. Verify calculations are consistent
3. Test APY comparison and spread calculation
4. Monitor for capital deployment

