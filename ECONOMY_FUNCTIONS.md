# RSC Economy Management Functions

## Overview

The updated RSC contract includes comprehensive economy management functions to monitor and control the contract's financial status on Reactive Network.

## New Functions

### 1. `getEconomyStatus()`

Get comprehensive economy status including balances, reserves, debt, and activation status.

**Returns:**
- `directBalance`: Contract's direct REACT balance (wei)
- `reserves`: Reserves held by system contract (wei)
- `debt`: Outstanding debt to system contract (wei)
- `netBalance`: `reserves - debt` (can be negative)
- `isActive`: Whether contract has sufficient reserves to operate (bool)

**Usage:**
```solidity
(uint256 balance, uint256 reserves, uint256 debt, int256 net, bool active) = rsc.getEconomyStatus();
```

### 2. `fundReserves(bool useDirectBalance)`

Fund reserves via system contract. Automatically settles any outstanding debt.

**Parameters:**
- `useDirectBalance`: If true, uses contract's direct balance first, then adds msg.value

**Note:** Can be called with REACT value attached or without (if using direct balance)

**Usage:**
```solidity
// Fund with attached value
rsc.fundReserves{value: 0.1 ether}(false);

// Fund using contract's direct balance + attached value
rsc.fundReserves{value: 0.05 ether}(true);
```

**Events:**
- `ReservesFunded(uint256 amount, uint256 newReserves)`

### 3. `getSubscriptionStatus()`

Get subscription status for all monitored events.

**Returns:**
- `aaveActive`: Subscribed to Aave events
- `compoundActive`: Subscribed to Compound events  
- `queryHelperActive`: Subscribed to QueryHelper events

**Usage:**
```solidity
(bool aave, bool compound, bool queryHelper) = rsc.getSubscriptionStatus();
```

### 4. `getContractStatus()`

Get comprehensive contract status combining economy, subscriptions, and strategy state.

**Returns:**
- `directBalance`: Direct REACT balance
- `reserves`: System contract reserves
- `debt`: Outstanding debt
- `isActive`: Active status
- `aaveSub`: Aave subscription status
- `compoundSub`: Compound subscription status
- `queryHelperSub`: QueryHelper subscription status
- `lastAaveApy`: Last known Aave APY (basis points)
- `cooldownRemaining`: Time until next rebalance allowed (seconds)

**Usage:**
```solidity
(uint256 balance, uint256 reserves, uint256 debt, bool active,
 bool aave, bool compound, bool queryHelper,
 uint256 apy, uint256 cooldown) = rsc.getContractStatus();
```

### 5. `canProcessEvents()`

Check if contract can process events (health check).

**Returns:**
- `canProcess`: True if ready to process events
- `reason`: Human-readable reason if false

**Usage:**
```solidity
(bool ready, string memory reason) = rsc.canProcessEvents();
```

**Possible reasons:**
- `"Contract inactive: insufficient reserves or debt"`
- `"Not subscribed to Aave events"`
- `"Not subscribed to QueryHelper events"`
- `"Ready to process events"`

### 6. `emergencyWithdraw(address token, uint256 amount, address to)`

Emergency withdraw function for owner. Allows withdrawal of tokens accidentally sent to contract.

**Parameters:**
- `token`: Token address (address(0) for native REACT)
- `amount`: Amount to withdraw (0 = all)
- `to`: Recipient address

**Usage:**
```solidity
// Withdraw all REACT
rsc.emergencyWithdraw(address(0), 0, ownerAddress);

// Withdraw specific amount
rsc.emergencyWithdraw(address(0), 0.1 ether, ownerAddress);

// Withdraw ERC20 token
rsc.emergencyWithdraw(tokenAddress, amount, ownerAddress);
```

**Events:**
- `EmergencyWithdraw(address token, uint256 amount)`

**Security:** Owner only, Reactive Network only

---

## Helper Scripts

Use these Node.js scripts to interact with economy functions:

### Check Economy Status
```bash
node scripts/checkRSCEconomy.js
```

### Fund Reserves
```bash
node scripts/fundReserves.js
```

### Get Full Status
```bash
node scripts/getRSCStatus.js
```

---

## Example: Monitoring Contract Health

```javascript
const ethers = require('ethers');
const rsc = new ethers.Contract(RSC_ADDRESS, RSC_ABI, provider);

// Check if contract can process events
const [canProcess, reason] = await rsc.canProcessEvents();
if (!canProcess) {
    console.log(`⚠️  Contract not ready: ${reason}`);
}

// Get full status
const status = await rsc.getContractStatus();
console.log({
    balance: ethers.utils.formatEther(status.directBalance),
    reserves: ethers.utils.formatEther(status.reserves),
    debt: ethers.utils.formatEther(status.debt),
    active: status.isActive,
    subscriptions: {
        aave: status.aaveSub,
        compound: status.compoundSub,
        queryHelper: status.queryHelperSub
    },
    lastApy: `${status.lastAaveApy / 100}%`,
    cooldownRemaining: `${status.cooldownRemaining} seconds`
});
```

---

## Benefits

1. **Visibility**: Clear view of contract financial status
2. **Control**: Easy funding and management
3. **Safety**: Emergency withdraw for accidental deposits
4. **Monitoring**: Health checks for operations
5. **Debugging**: Detailed status for troubleshooting

---

**Status**: All economy functions are implemented and ready to use!

