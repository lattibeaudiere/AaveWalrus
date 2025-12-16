# Function Selector 0xeb45e4d1 Analysis

## Function Information

**Selector**: `0xeb45e4d1`  
**Contract**: `0xDA82A901B87E0Ec6a2D931d45F723b0aEB722e04` (Arbitrum)  
**Status**: Real contract with code (3,521 bytes)

## Decoded Parameters

Based on the payload analysis, this function takes 4 parameters:

### Function Signature (Inferred)
```
function(uint256 nonce, address asset, uint256 value, uint256 timestamp)
```

### Parameter Breakdown

1. **Parameter 1 (uint256)**: `0`
   - **Purpose**: Nonce (query identifier)
   - **Value**: Always 0 in observed calls
   - **Meaning**: Query identifier to match request with response

2. **Parameter 2 (address)**: Asset address
   - **USDC**: `0xaf88d065e77c8cc2239327c5edb3a432268e5831`
   - **WETH**: `0x82af49447d8a07e3bd95bd0d56f35241523fbab1`
   - **WBTC**: `0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f`
   - **Purpose**: Asset to query APY for
   - **Meaning**: The token/reserve address to get APY data for

3. **Parameter 3 (uint256)**: Value
   - **Observed Values**: 343, 1, 193
   - **343 bps** = 3.43% (matches Aave USDC APY)
   - **Purpose**: Likely current APY in basis points
   - **Meaning**: The APY value to query or verify

4. **Parameter 4 (uint256)**: Timestamp
   - **Format**: Unix timestamp (seconds since epoch)
   - **Example**: `1762990496` = `2025-11-12T23:34:56.000Z`
   - **Purpose**: Block timestamp when query was made
   - **Meaning**: Time tracking for the query

## What This Function Does

Based on the parameter pattern, this function appears to:

1. **Query APY for a specific asset** (USDC, WETH, WBTC)
2. **Store or verify APY value** (in basis points)
3. **Track timestamp** of when the query was made
4. **Use nonce** for request/response matching

## Possible Function Names

Given the pattern, this could be:

- `queryAssetApy(uint256 nonce, address asset, uint256 apyBps, uint256 timestamp)`
- `queryReserveApy(uint256 nonce, address reserve, uint256 apyBps, uint256 timestamp)`
- `storeApyData(uint256 nonce, address asset, uint256 apyBps, uint256 timestamp)`
- `verifyAssetApy(uint256 nonce, address asset, uint256 apyBps, uint256 timestamp)`

## Contract Analysis

### Contract Address
- **Address**: `0xDA82A901B87E0Ec6a2D931d45F723b0aEB722e04`
- **Network**: Arbitrum One (Chain ID: 42161)
- **Code Size**: 3,521 bytes
- **Status**: ✅ Real contract (exists on-chain)

### Comparison with Expected QueryHelper
- **Expected QueryHelper**: `0x55f03641265a793112bd1D9480C4Ea4f143E06af`
- **Actual Contract**: `0xDA82A901B87E0Ec6a2D931d45F723b0aEB722e04`
- **Difference**: Different address, possibly updated deployment

## Observed Patterns

### Asset Queries
- **USDC**: Most common (stablecoin, primary asset)
- **WETH**: Native token queries
- **WBTC**: Bitcoin token queries

### APY Values
- **343 bps** (3.43%) - Matches Aave USDC supply APY
- **1 bps** (0.01%) - Low APY value
- **193 bps** (1.93%) - Medium APY value

### Timestamps
- All timestamps are recent (within current block time)
- Timestamps match when the callback was executed
- Used for tracking when APY data was queried

## Function Purpose

This function appears to be part of a **multi-asset APY query system** that:

1. Queries APY for different assets (USDC, WETH, WBTC)
2. Tracks APY values with timestamps
3. Uses nonces for request/response correlation
4. Provides APY data for the RSC to make rebalancing decisions

## Next Steps

1. ✅ Parameters decoded and displayed in frontend
2. ⏳ Verify actual function name by checking contract on Arbiscan
3. ⏳ Confirm if this is an updated QueryHelper contract
4. ⏳ Check if contract emits events for these queries
5. ⏳ Verify if RSC subscribes to events from this contract

## Frontend Display

The frontend now shows:
- ✅ All 4 parameters decoded
- ✅ Asset names identified (USDC, WETH, WBTC)
- ✅ APY values interpreted (bps to percentage)
- ✅ Timestamps converted to readable format
- ✅ Function signature inference
- ✅ Links to Arbiscan for asset addresses

## Summary

**Function Selector**: `0xeb45e4d1`  
**Purpose**: Query APY for specific assets with timestamp tracking  
**Parameters**: (nonce, asset, apyValue, timestamp)  
**Status**: Real function on real contract  
**Assets**: USDC, WETH, WBTC  
**APY Values**: 343 bps (3.43%), 1 bps (0.01%), 193 bps (1.93%)

This is a **real function** being called on a **real contract** on Arbitrum. The RSC is actively querying APY data for multiple assets, which is part of the rebalancing strategy system.

