# Reactive Network Subscription Workaround

## 🐛 The Bug

Constructor subscriptions on Reactive Network are **broken** due to a precompile 0x64 bug. When attempting to subscribe in the constructor, the system contract calls `fulfillBasicOrder_efficient_6GL6yc()` which fails, causing the deployment to revert.

**Trace:**
```
service.subscribe() in constructor
  └─ System Contract (0x0000...fffFfF)
     └─ Precompile (0x64)
        └─ fulfillBasicOrder_efficient_6GL6yc()
           └─ [Revert] Failure
```

## ✅ The Solution

**Deploy WITHOUT constructor subscriptions, then subscribe POST-DEPLOYMENT.**

### Step 1: Deploy the Contract

```bash
cd reactive
forge script script/DeployRSC.s.sol \
  --rpc-url https://mainnet-rpc.rnk.dev \
  --private-key $REACTIVE_PRIVATE_KEY \
  --broadcast
```

**Note:** The constructor now takes only 3 parameters:
- `service_` - System contract address
- `sequencer_` - Sequencer address (optional, use address(0))
- `adapter_` - ReactiveAlphaAdapter address

### Step 2: Subscribe Post-Deployment

After deployment, update `.env` with the deployed contract address:

```bash
RSC_ADDRESS=0xYourDeployedContractAddress
```

Then run the subscription script:

```bash
node scripts/subscribePostDeployment.js
```

Or manually subscribe using `cast`:

```bash
# Subscribe to Aave V3
cast send $RSC_ADDRESS "subscribeToAave()" \
  --rpc-url https://mainnet-rpc.rnk.dev \
  --private-key $REACTIVE_PRIVATE_KEY \
  --gas-limit 1000000

# Subscribe to Compound V3
cast send $RSC_ADDRESS "subscribeToCompound()" \
  --rpc-url https://mainnet-rpc.rnk.dev \
  --private-key $REACTIVE_PRIVATE_KEY \
  --gas-limit 1000000
```

### Step 3: Verify Subscriptions

Check subscription status:

```bash
cast call $RSC_ADDRESS "aaveSubscribed()" --rpc-url https://mainnet-rpc.rnk.dev
cast call $RSC_ADDRESS "compoundSubscribed()" --rpc-url https://mainnet-rpc.rnk.dev
```

Both should return `true`.

### Step 4: Fund the Contract

Fund the contract with REACT for operations:

```bash
cast send $RSC_ADDRESS \
  --value 1ether \
  --rpc-url https://mainnet-rpc.rnk.dev \
  --private-key $REACTIVE_PRIVATE_KEY
```

## 📊 What Changed

### Before (Broken):
```solidity
constructor(address service_, address sequencer_, address adapter_) {
    // ...
    if (!vm) {
        service.subscribe(...); // ❌ Precompile 0x64 error
    }
}
```

### After (Working):
```solidity
constructor(address service_, address sequencer_, address adapter_) {
    // NO subscriptions - workaround for precompile bug
}

function subscribeToAave() external rnOnly onlyOwner {
    service.subscribe(...); // ✅ Works perfectly!
}
```

## 🔍 Why This Works

- **Constructor calls** → System contract uses precompile 0x64 → **FAILS**
- **Post-deployment calls** → System contract uses different code path → **WORKS**

## 📝 Contract Functions

### Subscription Functions:
- `subscribeToAave()` - Subscribe to Aave V3 ReserveDataUpdated
- `subscribeToCompound()` - Subscribe to Compound V3 AccrueInterest
- `subscribeTo(chainId, contract, topic0)` - Generic subscription

### Unsubscription Functions:
- `unsubscribeFromAave()` - Unsubscribe from Aave V3
- `unsubscribeFromCompound()` - Unsubscribe from Compound V3
- `unsubscribeFrom(chainId, contract, topic0)` - Generic unsubscription

### Status Functions:
- `aaveSubscribed()` - Check Aave subscription status
- `compoundSubscribed()` - Check Compound subscription status

## 🎯 Success Criteria

After running `subscribePostDeployment.js`, you should see:

1. ✅ **Transaction Status: 1** (success)
2. ✅ **Subscribed Event Emitted** in transaction logs
3. ✅ `aaveSubscribed()` returns `true`
4. ✅ `compoundSubscribed()` returns `true`
5. ✅ **Reactscan shows subscription** (may take a few minutes)

## 📚 References

This workaround is based on testing that discovered:
- Constructor subscriptions: ❌ Broken (precompile 0x64 bug)
- Post-deployment subscriptions: ✅ Working

The pattern matches the successful deployment at:
- `0xe26dE2d481d380e5Acc3a41Bfe458eA76eA72D17` (working example)

