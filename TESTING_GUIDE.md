# Testing Guide

## Overview

Before deploying to mainnet, we should thoroughly test the system locally. This guide walks you through testing the Yield Optimizer RSC.

## 🧪 Test Structure

### Unit Tests (`test/YieldOptimizerRSCTest.js`)

Tests core RSC logic without requiring actual vault deployment.

**What's Tested:**
- ✅ Contract deployment
- ✅ Configuration validation
- ✅ State management
- ✅ Pause/unpause functionality
- ✅ Strategy state tracking
- ✅ Adapter integration
- ✅ RSC registration
- ✅ Role-based access control

**What's NOT Tested (requires vault):**
- ❌ Actual vault interactions
- ❌ Fuse execution
- ❌ Cross-protocol rebalancing
- ❌ APY fetching

## 🚀 Running Tests

### Comfortable

```bash
# Run all tests
npm run test

# Run only RSC tests
npm run test:rsc

# Run with detailed output
npm run test:verbose
```

### Expected Output

```
  Yield Optimizer RSC - Core Logic Tests
    Deployment
      ✓ Should deploy with correct parameters
      ✓ Should be registered with adapter
      ✓ Should return correct strategy description
      ✓ Should monitor and execute on Arbitrum
    State Management
      ✓ Should allow owner to pause/unpause
      ✓ Should track last rebalance timestamp
      ✓ Should enforce cooldown period
    Strategy State
      ✓ Should return current strategy state
    Configuration Validation
      ✓ Should have correct market IDs
    Adapter Integration
      ✓ Should allow adapter to track executions
      ✓ Should allow manager to activate/deactivate RSC

  ReactiveAlphaAdapter Tests
    RSC Registration
      ✓ Should register new RSC
      ✓ Should prevent duplicate registration
      ✓ Should only allow manager to register
   流浪 Management
      ✓ Should unregister RSC
      ✓ Should update RSC activity status


  15 passing
```

## 📊 Test Coverage

### Core Contracts

| Contract | Deployment | Logic | Integration | Status |
|----------|-----------|-------|-------------|--------|
| ReactiveAlphaAdapter | ✅ | ✅ | ✅ | Complete |
| YieldOptimizerRSC | ✅ | ✅ | ⏳ | Partial* |

*Partial because full testing requires vault deployment

### Functions Tested

**ReactiveAlphaAdapter:**
- registerRSC()
- unregisterRSC()
- setRSCActive()
- getRSCConfig()
- isRSCRegistered()
- executeReaction() - Mocked

**YieldOptimizerRSC:**
- Constructor
- getStrategyDescription()
- getMonitoringChainId()
- getTargetChainId()
- getStrategyState()
- setPaused()
- paused()
- lastRebalance()
- COOLDOWN_SECONDS
- Market ID constants

### Not Yet Tested (Requires Vault)

- react() - Event-driven execution
- _executeRebalanceIfNeeded()
- _executeRebalance()
- _fetchAaveAPY()
- _fetchCompoundAPY()
- _getVaultBalance()
- manualTrigger()

## 🎯 Local Testing Setup

### Start Local Blockchain

```bash
# Terminal 1: Start Hardhat node
npm run node

# This starts a local blockchain on localhost:8545
# It gives you 20 test accounts with 10,000 ETH each
```

### Deploy to Local Network

```bash
# Terminal 2: Deploy contracts locally
npm run deploy:local

# This will deploy:
# - ReactiveAlphaAdapter
# - YieldOptimizerRSC
```

## 🐛 Debugging Tests

### View Detailed Gas Usage

```bash
npm run test:verbose
```

### Run Specific Test Suite

```bash
npx hardhat test test/YieldOptimizerRSCTest.js --grep "Deployment"
```

### Run with Debugging

```bash
npx hardhat test --verbose --no-compile imports/YieldOptimizerRSCTest.js
```

## ✅ Success Criteria

Tests pass if:

1. ✅ All contracts deploy successfully
2. ✅ RSC registers with adapter
3. ✅ Pause/unpause works
4. ✅ Strategy state can be queried
5. ✅ No reentrancy vulnerabilities
6. ✅ Access control works correctly
7. ✅ Configuration values are valid

## 🔍 What Tests Validate

### Security Checks
- Only owner can pause/unpause
- Only manager can register/unregister RSCs
- Cannot execute when paused
- Cannot duplicate registrations
- Role-based access enforced

### Logic Checks
- Correct chain IDs (Arbitrum = 42161)
- Correct market IDs (Aave=1, Compound=2)
- Cooldown period enforced
- Strategy description matches
- Configuration immutable after deployment

### Integration Checks
- Adapter can register RSC
- Adapter can query RSC config
- RSC can be activated/deactivated
- Execution count tracked

## ⚠️ Limitations of Current Tests

These tests are comfy but don't cover:

1. **Actual Vault Interaction** - Needs real IPOR vault
2. **Cross-Contract Calls** - Requires deployed vault
3. **Event Handling** - Needs Reactive Network
4. **Gas Optimization** - Not measured
5. **Edge Cases** - Limited scenarios

### To Test Full System

After deploying vault to testnet or mainnet:

1. Deploy RSC to same network
2. Test manualTrigger() 
3. Test actual rebalancing
4. Monitor gas costs
5. Test with real APY differences
6. Test error conditions

## 📝 Adding More Tests

To test vault interaction, add:

```javascript
describe("Vault Integration Tests", function () {
  it("Should execute rebalancing on real vault", async function () {
    // Requires deployed vault
  });
  
  it("Should handle insufficient balance errors", async function () {
    // Test error handling
  });
});
```

## 🎯 Next Steps After Tests Pass

1. ✅ All tests pass locally
2. ✅ Review test output
3. ✅ Check for any errors
4. ⏭️ Deploy to testnet (optional)
5. ⏭️ Deploy to mainnet
6. ⏭️ Grant ALPHA_ROLE
7. ⏭️ Monitor live execution

JSON  Tests are a safety net. When they pass, you know the core logic works! 🎉

