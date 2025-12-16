# Deploying the Fixed RSC Contract

## 🎯 What Was Fixed

The original contract was trying to **directly call** the Arbitrum adapter from Reactive Network, which is impossible. It's been updated to use the **Callback event pattern** as required by Reactive Network.

## 🚀 Quick Deployment

```bash
# Make sure contract is compiled
cd reactive
forge build
cd ..

# Deploy the fixed contract
node scripts/deployFixedRSC.js
```

## 📋 Manual Deployment (Alternative)

If you prefer using Foundry directly:

```bash
cd reactive

# Deploy
forge script script/DeployRSC.s.sol \
  --rpc-url $REACTIVE_RPC \
  --private-key $REACTIVE_PRIVATE_KEY \
  --broadcast
```

## ✅ Post-Deployment Setup

After deployment, you need to:

### 1. Fund the Contract

```bash
node scripts/fundContract.js
```

Or manually send REACT to the contract address.

### 2. Subscribe to Events

```bash
node scripts/subscribePostDeployment.js
```

This will subscribe to:
- Aave V3 ReserveDataUpdated events
- Compound V3 AccrueInterest events

### 3. Verify Everything Works

```bash
# Check subscriptions
node scripts/verifyNewRSCSubscriptions.js

# Monitor for events
node scripts/testSubscriptionWithEvents.js

# Check APYs
node scripts/checkAPYs.js
```

## 🔍 How to Verify It's Working

1. **Check Reactscan:**
   ```
   https://reactscan.io/address/YOUR_CONTRACT_ADDRESS
   ```
   - Should show active subscriptions
   - Should show Callback events being emitted

2. **Monitor Callback Events:**
   - When an Aave event triggers `react()`
   - A `Callback` event should be emitted
   - Reactive Network should execute it on Arbitrum

3. **Check Adapter Execution:**
   - On Arbitrum, check if `executeReaction` is being called
   - This confirms Reactive Network is executing the callbacks

## 📝 Key Differences

### Old (Broken) Implementation:
```solidity
// ❌ Direct call - doesn't work across chains
IAdapterDispatcher(adapter).executeReaction(actions);
```

### New (Fixed) Implementation:
```solidity
// ✅ Emit Callback event - Reactive Network handles it
emit Callback(ARBITRUM_CHAIN_ID, adapter, 500000, payload);
```

## 🎉 Expected Behavior

1. **Event Occurs on Arbitrum** (e.g., Aave ReserveDataUpdated)
2. **Reactive Network Detects Event**
3. **Reactive Network Calls `react()`** on your contract
4. **Contract Emits `Callback` Event**
5. **Reactive Network Executes Callback** on Arbitrum
6. **Adapter's `executeReaction()` is Called**
7. **Vault Strategy Executes** 🎯

## ⚠️ Important Notes

- The contract address will change after redeployment
- Update `.env` file with the new `RSC_ADDRESS`
- You'll need to resubscribe to events (old subscriptions are for old contract)
- Grant the new RSC address the ALPHA_ROLE on the vault if needed

## 🔗 Useful Links

- Reactscan: https://reactscan.io/
- Reactive Network Docs: See Lesson 2 on Callbacks
- Deployment Addresses: `deployment-addresses.json`

