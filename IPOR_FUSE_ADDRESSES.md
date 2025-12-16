# IPOR Fusion Fuse Addresses on Arbitrum

## How to Find Deployed Fuse Addresses

IPOR maintains fuse deployments on their [ipor-abi repository](https://github.com/IPOR-Labs/ipor-abi).

### Method 1: Check IPOR Documentation

1. Visit: https://docs.ipor.io/ipor-fusion/fuses
2. Look for the list of deployed fuses per chain
3. Find Arbitrum network section

### Method 2: Use IPOR's ABI Repository

The [ipor-abi repo](https://github.com/IPOR-Labs/ipor-abi) contains:
- Fuse deployment addresses
- ABI interfaces
- Configuration examples

### Method 3: Query On-Chain

If you know IPOR's factory contract addresses, you can query deployed fuse instances.

## Known Arbitrum Protocol Addresses

From IPOR's test files, these are the real Arbitrum mainnet addresses:

### Aave V3 on Arbitrum

```solidity
AAVE_V3_POOL: 0x794a61358D6845594F94dc1DB02A252b5b4814aD
AAVE_POOL_ADDRESSES_PROVIDER: 0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb
AAVE_POOL_DATA_PROVIDER: 0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654
AAVE_PRICE_ORACLE: 0xb56c2F0B653B2e0b10C9b928C8580Ac5Df02C7C7
```

### Compound V3 on Arbitrum

```solidity
COMPOUND_COMET: 0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf  // USDC market
COMPOUND_REWARDS: 0x88730d254A2f7e6AC8388c3198aFd694bA9f7fae
```

### USDC on Arbitrum

```solidity
USDC: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831
```

## Getting Fuse Addresses

### Step 1: Deploy Your Own Fuses

IPOR allows you to deploy fuses yourself using their factory contracts.

**Aave V3 Fuses:**

```solidity
// Supply Fuse Constructor
constructor(uint256 marketId_, address aaveV3PoolAddressesProvider_)
```

```solidity
// Balance Fuse Constructor  
constructor(uint256 marketId_, address aaveV3PoolAddressesProvider_, address priceOracleMiddleware_)
```

**Compound V3 Fuses:**

```solidity
// Supply Fuse Constructor
constructor(uint256 marketId_, address comet_)
```

```solidity
// Balance Fuse Constructor
constructor(uint256 marketId_, address comet_)
```

### Step 2: Or Request from IPOR

Contact IPOR Labs:
- Discord: IPOR Protocol server
- Email: support@ipor.io
- Docs: https://docs.ipor.io

Request fuse addresses for:
- Aave V3 Supply Fuse
- Aave V3 Balance Fuse
- Compound V3 Supply Fuse
- Compound V3 Balance Fuse

### Step 3: Whitelist on Your Vault

Once you have addresses, whitelist them:

```javascript
// Via IPOR Fusion Factory
await fuseManager.addFuse(AAVE_SUPPLY_FUSE, 1); // 1 = Functional Fuse
await fuseManager.addFuse(AAVE_BALANCE_FUSE, 0); // 0 = Balance Fuse
await fuseManager.addFuse(COMPOUND_SUPPLY_FUSE, 1);
await fuseManager.addFuse(COMPOUND_BALANCE_FUSE, 0);
```

## Example Fuse Deployment

If deploying your own:

```solidity
// 1. Deploy Aave Supply Fuse
AaveV3SupplyFuse aaveSupply = new AaveV3SupplyFuse(
    1, // Market ID
    0xa97684ead0e402dC232d5A榨977953DF7ECBaB3CDb // Aave Pool Addresses Provider
);

// 2. Deploy Aave Balance Fuse
AaveV3BalanceFuse aaveBalance = new AaveV3BalanceFuse(
    1, // Market ID
    0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb, // Pool Addresses Provider
    PRICE_ORACLE_MIDDLEWARE_ADDRESS
);

// 3. Deploy Compound Supply Fuse
CompoundV3SupplyFuse compoundSupply = new CompoundV3SupplyFuse(
    2, // Market ID
    0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf // Comet address
);

// 4. Deploy Compound Balance Fuse
CompoundV3BalanceFuse compoundBalance = new CompoundV3BalanceFuse(
    2, // Market ID
    0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf // Comet address
);
```

## Configuration for This Project

Update your `.env` file:

```bash
# Aave V3 Fuses (replace with actual IPOR fuse addresses)
AAVE_SUPPLY_FUSE=0x...
AAVE_BALANCE_FUSE=0x...

# Compound V3 Fuses (replace with actual IPOR fuse addresses)
COMPOUND_SUPPLY_FUSE=0x...
COMPOUND_BALANCE_FUSE=0x...
```

## Market IDs

When configuring your vault, use these market IDs:

```solidity
uint256 public constant AAVE_MARKET_ID = 1;
uint256 public constant COMPOUND_MARKET_ID = 2;
```

These market IDs will be used in your vault's `MarketBalanceFuseConfig`:

```solidity
MarketBalanceFuseConfig({
    marketId: 1, // Aave
    fuse: AAVE_BALANCE_FUSE
})

MarketBalanceFuseConfig({
    marketId: 2, // Compound
    fuse: COMPOUND_BALANCE_FUSE
})
```

## Helpful Links

- [IPOR Fusion Docs](https://docs.ipor.io/ipor-fusion)
- [IPOR ABIs](https://github.com/IPOR-Labs/ipor-abi)
- [Aave V3 Docs](https://docs.aave.com/developers/v/3.0/)
- [Compound V3 Docs](https://docs.compound.finance/)

## Contact IPOR for Support

If you need help finding or deploying fuses:
- Discord: Join IPOR Protocol server
- GitHub: Open an issue on ipor-fusion repo
- Email: support@ipor.io

