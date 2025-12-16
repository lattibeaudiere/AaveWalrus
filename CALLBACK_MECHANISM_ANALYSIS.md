# Reactive Network Callback Mechanism - Analysis

## Key Finding from Documentation

**Critical Authorization Detail:**

> "For security and authorization purposes, the Reactive Network automatically replaces the **first 160 bits of the call arguments within the payload** with the RVM ID (equivalent to the ReactVM address) of the calling reactive contract. **This RVM ID is identical to the contract deployer's address.**"

## What This Means

### When RSC Emits Callback

```solidity
// RSC emits:
emit Callback(
    ARBITRUM_CHAIN_ID,
    adapter,
    uint64(1000000),
    abi.encodeWithSignature("executeReaction((address,bytes)[])", actions)
);
```

### Reactive Network Processing

1. Reactive Network detects Callback event
2. Prepares transaction for Arbitrum
3. **Replaces first 160 bits with RVM ID** (RSC deployer address)
4. Submits transaction to adapter

### Current Adapter Code Issue

```solidity
function executeReaction(FuseAction[] calldata actions) external {
    address rsc = msg.sender;  // ← This is Reactive Network executor!
    
    if (!isRSCRegistered[rsc]) {  // ← Will FAIL!
        revert RSCNotRegistered();
    }
    // ...
}
```

**Problem:**
- `msg.sender` = Reactive Network executor (not RSC!)
- We registered RSC address, not executor
- Registration check fails

## Solutions

### Option 1: Pass RSC Address as First Parameter (Recommended)

Modify RSC to include RSC address as first parameter in payload:

```solidity
// In FusionReactiveRSC.sol
bytes memory execPayload = abi.encodeWithSignature(
    "executeReaction(address,(address,bytes)[])",  // Add address as first param
    address(this),  // RSC address - will be replaced with RVM ID anyway
    actions
);
```

Then Reactive Network will replace it with RVM ID (which = RSC deployer address).

Then adapter receives:
```solidity
function executeReaction(address rsc, FuseAction[] calldata actions) external {
    // Reactive Network replaces first param with RVM ID
    // RVM ID = RSC deployer address = RSC address
    // So rsc parameter = RSC address ✅
    
    if (!isRSCRegistered[rsc]) {
        revert RSCNotRegistered();
    }
    // ...
}
```

### Option 2: Register Reactive Network Executor

If Reactive Network uses a consistent executor address, we could register that instead.

### Option 3: Remove Registration Check (Less Secure)

Allow any caller, but this reduces security.

## Recommendation

**Use Option 1** - Modify RSC to pass its address as first parameter, which Reactive Network will replace with RVM ID. This way:
- ✅ We get the RSC address in the function
- ✅ Reactive Network automatically validates it (RVM ID = deployer)
- ✅ Registration check works correctly
- ✅ Maintains security

## Next Steps

1. Grant Alpha role to adapter (via Builder) ✅
2. Modify RSC to pass address as first parameter
3. Modify adapter to accept address as first parameter
4. Redeploy both contracts

