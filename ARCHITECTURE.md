# Architecture: IPOR Fusion + Reactive Smart Contracts

## 📐 System Architecture Overview

This document provides a detailed technical explanation of how IPOR Fusion Vaults integrate with Reactive Smart Contracts (RSCs) to enable autonomous, event-driven yield optimization.

## 🏗️ Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     REACTIVE LAYER                               │
│  (Autonomous Execution & Decision Logic)                         │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐    │
│  │   Reactive Smart Contract (RSC)                        │    │
│  │   - Monitors on-chain events                          │    │
│  │   - Implements strategy logic                         │    │
│  │   - Triggers reactions when conditions met            │    │
│  └────────────────────────┬───────────────────────────────┘    │
└────────────────────────────┼─────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    INTEGRATION LAYER                              │
│  (Bridge Between RSC & Vault)                                    │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐    │
│  │   ReactiveAlphaAdapter                                 │    │
│  │   - Validates RSC permissions                          │    │
│  │   - Constructs FuseActions                            │    │
│  │   - Executes on vault via ALPHA_ROLE                  │    │
│  └────────────────────────┬───────────────────────────────┘    │
└────────────────────────────┼─────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FUSION LAYER                                 │
│  (Secure Asset Management & Protocol Integration)                │
│                                                                   │
│  ┌──────────────────┐      ┌──────────────────┐                │
│  │   Plasma Vault   │      │   Access         │                │
│  │   (ERC-4626)     │◄─────┤   Manager        │                │
│  └────────┬─────────┘      └──────────────────┘                │
│           │                                                     │
│           ├──────────────┬──────────────┬──────────────┐       │
│           ▼              ▼              ▼              ▼       │
│     ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐     │
│     │  Aave   │   │ Compound│   │  Curve  │   │  Other  │     │
│     │  Fuse   │   │  Fuse   │   │  Fuse   │   │  Fuses  │     │
│     └────┬────┘   └────┬────┘   └────┬────┘   └────┬────┘     │
│          │             │             │             │           │
│          ▼             ▼             ▼             ▼           │
│     ┌─────────┐   ┌─────────┐   venues                         │
│     │  Aave   │   │ Compound│                                 │
│     │  V3     │   │  V3     │                                 │
│     │  Protocol│   │  Protocol│                                │
│     └─────────┘   └─────────┘                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 Execution Flow

### Step-by-Step Breakdown

#### 1. Event Detection
**Layer**: Reactive Layer  
**Component**: Reactive Network Infrastructure

```solidity
// Aave V3 Pool emits ReserveDataUpdated event
event ReserveDataUpdated(
    address indexed reserve,
    uint256 liquidityRate,
    uint256 stableBorrowRate,
    uint256 variableBorrowRate,
    uint256 liquidityIndex,
    uint256 variableBorrowIndex
);
```

The Reactive Network monitors specified event sources and captures event logs in real-time.

#### 2. Decision Logic
**Layer**: Reactive Layer  
**Component**: RSC's `react()` function

```solidity
function react(bytes calldata eventData, address eventSource)
    external override returns (bool success, bytes memory data)
{
    // 1. Parse event data
    // 2. Fetch current APYs from both protocols
    // 3. Calculate spread
    // 4. Check if spread > threshold
    // 5. If yes, determine rebalance direction
    // 6. Return decision and execution data
}
```

**Logic Example**:
```javascript
Current State:
  - Aave APY: 3.0%
  - Compound APY: 3.8%
  - Vault has 100,000 USDC in Aave
  - MIN_SPREAD_BPS: 50 (0.5%)

Decision:
  - Spread: 3.8% - 3.0% = 0.8% = 80 bps > 50 bps ✅
  - Action: Move all USDC from Aave to Compound
```

#### 3. Adapter Execution
**Layer**: Integration Layer  
**Component**: ReactiveAlphaAdapter

```solidity
function executeReaction(FuseAction[] calldata actions)
    external nonReentrant returns (bool success, bytes memory data)
{
    // Validate RSC is registered and active
    // Verify cooldown period
    // Call vault.execute(actions)
    // Update metrics
    // Emit events
}
```

**Validation**:
- ✓ RSC is registered in adapter
- ✓ RSC is active (not paused)
- ✓ Cooldown period has passed
- ✓ RSC has ALPHA_ROLE on vault

#### 4. Vault Execution
**Layer**: Fusion Layer  
**Component**: PlasmaVault.execute()

```solidity
function execute(FuseAction[] calldata calls_) 
    external override nonReentrant restricted
{
    // For each FuseAction:
    //   1. Validate fuse is whitelisted
    //   2. Get market ID from fuse
    //   3. Delegatecall to fuse
    //   4. Track affected markets
    // Update market balances
    // Calculate performance fees
}
```

**Execution**:
```solidity
FuseAction[] memory actions = new FuseAction[](2);

// Action 1: Withdraw from Aave
actions[0] = FuseAction({
    fuse: AAVE_WITHDRAW_FUSE,
    data: abi.encodeWithSelector(
        AaveV3SupplyFuse.exit.selector,
        AaveV3SupplyFuseExitData(USDC, 100_000 * 1e6)
    )
});

// Action 2: Deposit to Compound
actions[1] = FuseAction({
    fuse: COMPOUND_SUPPLY_FUSE,
 Anna: abi.encodeWithSelector(
        CompoundV3SupplyFuse.enter.selector,
        CompoundV3SupplyFuseEnterData(USDC, 100_784 * 1e6)
    )
});

vault.execute(actions);
```

#### 5. Fuse Execution
**Layer**: Fusion Layer  
**Component**: Protocol-specific fuses

```solidity
// Aave Supply Fuse
function exit(AaveV3SupplyFuseExitData memory data) external {
    // 1. Validate asset is whitelisted
    // 2. Get aToken balance
    // 3. Call Aave Pool.withdraw()
    // 4. Transfer tokens to vault
    // 5. Emit event
}

// Compound Supply Fuse
function enter(CompoundV3SupplyFuseEnterData memory data) external {
    // 1. Validate asset is whitelisted
    // 2. Approve Compound market
    // 3. Call Compound.supply()
    // 4. Emit event
}
```

## 🔐 Permission Model

### Role Hierarchy

```
ADMIN_ROLE (0)
  └─ OWNER_ROLE (1)
      └─ ATOMIST_ROLE (100)
          ├─ ALPHA_ROLE (200) ← Granted to RSC
          ├─ FUSE_MANAGER_ROLE (300)
          └─ UPDATE_MARKETS_BALANCES_ROLE (1000)
```

### Permission Flow

```
1. ATOMIST_ROLE deploys and configures Plasma Vault
   ↓
2. ATOMIST_ROLE whitelists fuses (Aave, Compound)
   ↓
3. ATOMIST_ROLE deploys RSC
   ↓
4. ATOMIST_ROLE grants ALPHA_ROLE to RSC address
   ↓
5. RSC can now call vault.execute()
   ↓
6. Vault validates RSC has ALPHA_ROLE
   ↓
7. Vault executes actions via fuses
```

## 📊 State Management

### Market Balance Tracking

The vault maintains a mapping of market balances:

```solidity
mapping(uint256 => uint256) private marketBalances;

// Market ID 1: Aave V3
// Market ID 2: Compound V3
// Market ID 3: Curve Pool
// etc.
```

**Balance Update Flow**:
1. Execute fuse actions
2. Collect affected market IDs
3. Query balance fuses for each market
4. Update `marketBalances[marketId]`
5. Validate asset distribution limits
6. Calculate performance fees based on total assets change

### Asset Distribution Protection

```solidity
// Example limits configured by Atomist
uint256 public maxAssetInMarket = 60; // 60% max per market

// Before execution
totalAssets: 100,000 USDC
  - Aave: 60,000 (60%) ✓
  - Compound: 40,000 (40%) ✓

// After withdrawing from Aave
  - Aave: 0 (0%) ✓
  
// Can now deposit 100,000 to Compound
  - Compound: 100,000 (100%) ✗
  
// Validation fails if Compound limit = 60%
// Triggers revert
```

## ⚡ Performance Considerations

### Gas Optimization

1. **Batch Operations**: Execute multiple actions in single transaction
   ```solidity
   FuseAction[] memory actions = [withdraw, deposit, swap];
   vault.execute(actions); // Single transaction
   ```

2. **Storage Caching**: Reuse storage reads
   ```solidity
   uint256 marketId = IFuseCommon(fuse).MARKET_ID();
   ```

3. **Early Returns**: Skip operations when amounts are zero
   ```solidity
   if (data.amount == 0) return;
   ```

### Execution Latency

**Traditional Off-Chain Alpha**:
```
Event Detected → Bot Polls → Strategy Execution → On-chain TX
                  (~5-60s)      (~30s)              (~10-30s)
Total: ~45-120 seconds
```

**Reactive Smart Contract**:
```
Event Detected → RSC Execution → On-chain TX
                   (~instant)      (~10-30s)
Total: ~10-30 seconds
```

## 🔍 Monitoring & Debugging

### Key Metrics to Track

1. **RSC Metrics** (via Adapter):
   - `executionCount`: Total successful executions
   - `lastExecution`: Timestamp of last execution
   - `isActive`: Current RSC status

2. **Strategy State** (via RSC):
   ```solidity
   (uint256 aaveAPY, uint256 compoundAPY, uint256 spread, uint256 lastRebalance) 
       = rsc.getStrategyState();
   ```

3. **Vault Metrics** (via Vault):
   - `totalAssets()`: Total value in vault
   - `totalAssetsInMarket(marketId)`: Per-protocol allocation
   - `getUnrealizedManagementFee()`: Fee accrual

### Event Logging

**Adapter Events**:
```solidity
event ReactionExecuted(
    address indexed rsc,
    address indexed vault,
    uint256 indexed chainId,
    bool success,
    bytes data
);
```

**RSC Events**:
```solidity
event APYComparison(uint256 aaveAPY, uint256 compoundAPY, uint256 spread);
event RebalanceExecuted(address fromProtocol, address toProtocol, uint256 amount);
event RebalanceSkipped(string reason);
```

## 🚨 Error Handling

### Recovery Mechanisms

1. **Pause Mechanism**: RSC has `paused` flag
   ```solidity
   if (paused) revert("RSC is paused");
   ```

2. **Cooldown Period**: Prevent excessive rebalancing
   ```solidity
   if (block.timestamp < lastRebalance + COOLDOWN_SECONDS) {
       revert InsufficientCooldown();
   }
   ```

3. **Try-Catch in Fuses**: Wrap protocol calls
   ```solidity
   try pool.withdraw(asset, amount) {
       // Success
   } catch {
       emit WithdrawFailed();
   }
   ```

4. **Guardian Role**: Emergency pause on vault
   ```solidity
   // Guardian can pause vault operations
   accessManager.pause(address(vault));
   ```

## 🎯 Future Enhancements

### Potential Extensions

1. **Multi-Asset Strategies**: Support ETH, WBTC, etc.
2. **Cross-Chain RSC**: Monitor mainnet events, execute on Arbitrum
3. **Dynamic Thresholds**: Adjust spread threshold based on gas prices
4. **Risk Parameters**: Add debt limits, health factor checks
5. **Governance**: Allow strategy parameter updates via DAO

## 📚 References

- [IPOR Fusion Documentation](https://docs.ipor.io/ipor-fusion)
- [IPOR Fusion Contracts](https://github.com/IPOR-Labs/ipor-fusion)
- [ERC-4626 Standard](https://eips.ethereum.org/EIPS/eip-4626)
- [Reactive Network Documentation](https://reactive.network) (when available)

