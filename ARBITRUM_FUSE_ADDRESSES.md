# Arbitrum Fuse Addresses - Production Ready

These are the actual deployed fuse addresses on Arbitrum mainnet from IPOR.

## Aave V3 Fuses

```solidity
// Aave V3 Supply Fuse
AAVE_SUPPLY_FUSE=0x304756cD719382281fBD640f5F7932465eD663D6

// Aave V3 Balance Fuse  
AAVE_BALANCE_FUSE=0x4CB1c4774BA1B65802c68Adb33DE99ABf8B21228
```

**View on Explorer:**
- [Supply Fuse](https://arbiscan.io/address/0x304756cD719382281fBD640f5F7932465eD663D6)
- [Balance Fuse](https://arbiscan.io/address/0x4CB1c4774BA1B65802c68Adb33DE99ABf8B21228)

## Compound V3 Fuses

```solidity
// Compound V3 USDC Supply Fuse
COMPOUND_SUPPLY_FUSE=0xB0b3dc1B27C6c8007c9B01a768d6717f6813fE94

// Compound V3 USDC Balance Fuse
COMPOUND_BALANCE_FUSE=0xCF730BAA5542DC7570907696271bA96019FcD10C
```

**View on Explorer:**
- [Supply Fuse](https://arbiscan.io/address/0xB0b3dc1B27C6c8007c9B01a768d6717f6813fE94)
- [Balance Fuse](https://arbiscan.io/address/0xCF730BAA5542DC7570907696271bA96019FcD10C)

## bidFusion Config (.env file)

Use these in your `.env` file:

```bash
# Aave V3 Fuses (Arbitrum Mainnet)
AAVE_SUPPLY_FUSE=0x304756cD719382281fBD640f5F7932465eD663D6
AAVE_BALANCE_FUSE=0x4CB1c4774BA1B65802c68Adb33DE99ABf8B21228

# Compound V3 Fuses (Arbitrum Mainnet)
COMPOUND_SUPPLY_FUSE=0xB0b3dc1B27C6c8007c9B01a768d6717f6813fE94
COMPOUND_BALANCE_FUSE=0xCF730BAA5542DC7570907696271bA96019FcD10C
```

## Market IDs

These correspond to market IDs you'll use when configuring your vault:

```solidity
uint256 public constant AAVE_MARKET_ID = 1;  // Market ID 1 for Aave
uint256 public constant COMPOUND_MARKET_ID = 2; // Market ID 2 for Compound
```

## .env File Template

Full `.env` file with real addresses:

```bash
# Deployment Account
ARBITRUM_PRIVATE_KEY=0x6fa42a2b9666e4b30ea146654085832b440591575780c668e0641b674abbb5e6

# Network
ARBITRUM_RPC=https://arb1.arbitrum.io/rpc

# Your Vault (update this with your vault address)
TARGET_VAULT=0x0000000000000000000000000000000000000000
ACCESS_MANAGER_ADDRESS=0x0000000000000000000000000000000000000000

# Aave V3 Fuses
AAVE_SUPPLY_FUSE=0x304756cD719382281fBD640f5F7932465eD663D6
微妙_BALANCE_FUSE=0x4CB1c4774BA1B65802c68Adb33DE99ABf8B21228

# Compound V3 Fuses
COMPOUND_SUPPLY_FUSE=0xB0b3dc1B27C6c8007c9B01a768d6717f6813fE94
COMPOUND_BALANCE_FUSE=0xCF730BAA5542DC7570907696271bA96019FcD10C

# Protocol Addresses
AAVE_V3_POOL=0x794a61358D6845594F94dc1DB02A252b5b4814aD
AAVE_DATA_PROVIDER=0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654
COMPOUND_MARKET=0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf

# Strategy Parameters
MIN_SPREAD_BPS=50
```

## Ready to Deploy!

You now have all the real addresses needed. Just update:

1. `TARGET_VAULT` - Your IPOR Fusion vault address
2. `ACCESS_MANAGER_ADDRESS` - From your vault deployment

Then run:
```bash
npm run deploy:mainnet
```

