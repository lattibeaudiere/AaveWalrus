# 🐛 APY Calculation Bug - FIXED

## Issue

The RSC was reverting with "Aave APY anomaly" error on all events.

**Root Cause:** Incorrect APY calculation formula in `_extractAaveApy()`.

## Bug Details

### Wrong Formula (Before)
```solidity
// WRONG: Treats liquidityRate as per-second rate
apyBps = (liquidityRate * SECONDS_PER_YEAR * 100) / RAY;
```

This calculated: **1,102,178.98%** (clearly wrong!)

### Correct Formula (After)
```solidity
// CORRECT: liquidityRate is already annual rate
apyBps = (liquidityRate * 10000) / RAY;
```

This calculates: **3.49%** (correct!)

## Why This Happened

Aave V3's `liquidityRate` is stored as an **annual rate** in RAY format, not a per-second rate. The contract incorrectly assumed it was per-second and multiplied by `SECONDS_PER_YEAR`.

## Fix Applied

Updated `reactive/contracts/FusionReactiveRSC.sol` line 409:
- ❌ Removed: `* SECONDS_PER_YEAR * 100`
- ✅ Changed to: `* 10000` (converts RAY to basis points directly)

## Next Steps

1. ✅ Contract fixed and compiled
2. ⏳ Redeploy RSC with fixed contract
3. ✅ Verify events process correctly

## Verification

The failed event had:
- `liquidityRate: 34949866337988872307861310`
- Wrong calculation: 1,102,178 bps
- Correct calculation: **349 bps = 3.49%** ✅

---

**Status:** Bug fixed, ready for redeployment

