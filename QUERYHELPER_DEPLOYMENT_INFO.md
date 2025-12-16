# QueryHelper Deployment Information

## ✅ Yes, QueryHelper is a Smart Contract

**Contract Type:** Solidity Smart Contract  
**Network:** Arbitrum One (Chain ID: 42161)  
**Deployment Address:** `0x7D0B3A06aE0ceaf35B658579A1F5730D3539f914`

## 📋 Contract Details

### Location in Codebase
- **Source:** `contracts/QueryHelper.sol`
- **Deployment Script:** `scripts/deployQueryHelper.js`

### Purpose
QueryHelper is a helper contract that:
1. Queries Compound V3 for current APY data
2. Calculates APY in basis points
3. Emits `CompoundApyQueried` events that the RSC subscribes to

### Why It Exists
- Compound V3 events don't include APY directly
- Requires on-chain queries to Compound's `getUtilization()` and `supplyRate()`
- Needs to be on Arbitrum (same chain as Compound)
- Emits structured events for RSC consumption

## 🔗 Deployment Information

**Transaction Hash:** `0x4242c2a42adbe0feea59710f5ce3f0f8f2efc6e469d2de8f6b2a6115d9218f2e`  
**Block Number:** 396090836  
**Deployer:** `0x3737a882E03b7ABABaa7cCCC2d2982c2E071F963`  
**Deployment Date:** November 2, 2025

## 📊 Contract Functions

### Public Functions

**1. `queryCompoundApy(uint256 nonce)`**
- Called by Reactive Network via Callback
- Queries Compound V3 for current APY
- Emits `CompoundApyQueried` event
- Returns APY in basis points

**2. `getCompoundApy()`**
- View function for testing
- Returns APY without emitting event

### Events Emitted

**`CompoundApyQueried(uint256 indexed nonce, uint256 apyBps, uint256 timestamp)`**
- Topic0: `0xbc75181d726fb199839a4832ddc558e7942ef478af322c6d275d9415ebd3ff4b`
- Used by RSC for subscription

## 🔄 How It Works

```
RSC (Reactive Network)
    ↓ Emits Callback
Reactive Network Sequencer
    ↓ Executes on Arbitrum
QueryHelper.queryCompoundApy(nonce)
    ↓ Queries Compound
Compound V3 (getUtilization + supplyRate)
    ↓ Calculates APY
QueryHelper emits CompoundApyQueried(nonce, apy, timestamp)
    ↓ Event forwarded to Reactive Network
RSC receives event in react()
    ↓ Extracts Compound APY
Strategy decision (compare with Aave APY)
```

## 🌐 View on Block Explorer

**Arbiscan:** https://arbiscan.io/address/0x7D0B3A06aE0ceaf35B658579A1F5730D3539f914

## 🔐 Contract Constants

- **COMPOUND_USDC:** `0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA` (Compound V3 USDC Market on Arbitrum)

## 📝 Notes

- Contract is stateless (no storage variables)
- Uses view functions from Compound interface
- Emits events for cross-chain event subscription pattern
- Deployed on Arbitrum to interact with Compound V3 on same chain

---

**Status:** ✅ Deployed and Operational  
**Purpose:** Enables RSC to query Compound APY on-demand  
**Integration:** Fully integrated with FusionReactiveRSC

