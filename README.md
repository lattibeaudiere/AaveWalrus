# IPOR Fusion + Reactive Smart Contracts (RSC) Integration

## 🎯 Project Overview

This project demonstrates how to combine **IPOR Fusion's modular vault infrastructure** with **Reactive Smart Contract (RSC) automation** to create an autonomous, on-chain yield optimization strategy.

### Architecture

- **Fusion Layer (IPOR)**: Handles secure asset management, modular protocol integration, and vault operations
- **Reactive Layer (RSC)**: Provides autonomous, event-driven execution of strategies  
- **Integration Layer**: The `ReactiveAlphaAdapter` bridges RSCs with Plasma Vaults

## 📁 Project Structure

```
fusion-vault/
├── contracts/
│   ├── rsc/
│   │   ├── IReactiveAlpha.sol              # RSC interface
│   │   ├── ReactiveAlphaAdapter.sol         # Adapter between RSCs and Vaults
│   │   └── examples/
│   │       └── YieldOptimizerRSC.sol        # Example: USDC yield optimizer
│   └── interfaces/                          # Base interfaces matching IPOR Fusion
├── scripts/
│   ├── deployMainnet.js                     # Mainnet deployment
│   ├── grantAlphaRole.js                    # Grant permissions
│   └── checkStatus.js                       # Check contract status
├── ipor-fusion/                             # IPOR Fusion reference contracts
└── docs/
    ├── README.md                            # This file
    ├── ARCHITECTURE.md                      # Technical architecture
    ├── REACTIVE_NETWORK_INTEGRATION.md      # Reactive Network setup
    ├── MAINNET_DEPLOYMENT.md                # Deployment guide
    ├── IPOR_FUSE_ADDRESSES.md               # Getting fuse addresses
    └── QUICK_START.md                       # Quick reference
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Private key with ETH on Arbitrum
- IPOR Fusion Vault deployed on Arbitrum
- Fuse addresses from IPOR (see `IPOR_FUSE_ADDRESSES.md`)

### 1. Setup

```bash
# Install dependencies
npm install

# Create .env file (use your private key)
cp .env.mainnet.example .env
# Edit .env with your values
```

### 2. Deploy

```bash
# Compile contracts
npm run compile

# Deploy to Arbitrum mainnet
npm run deploy:mainnet

# Grant permissions
npm run grant:role

# Check status
npm run check:status
```

## 📚 Documentation

### Core Documentation

- **`QUICK_START.md`** - Get up and running in 5 minutes
- **`MAINNET_DEPLOYMENT.md`** - Complete deployment guide
- **`ARCHITECTURE.md`** - Deep dive into system architecture

### Integration Guides

- **`REACTIVE_NETWORK_INTEGRATION.md`** - Cross-chain event monitoring setup
- **`IPOR_FUSE_ADDRESSES.md`** - How to get IPOR fuse addresses

### Contract Reference

- **`contracts/rsc/ReactiveAlphaAdapter.sol`** - Main integration contract
- **`contracts/rsc/examples/YieldOptimizerRSC.sol`** - Example strategy

## 🔧 Key Components

### 1. ReactiveAlphaAdapter

**File**: `contracts/rsc/ReactiveAlphaAdapter.sol`

The adapter contract that enables RSCs to execute strategies on IPOR Fusion Vaults:

- **Registers RSCs**: Manager role can whitelist RSCs
- **Executes Reactions**: Called by RSCs to perform vault operations
- **Manages Permissions**: Ensures only registered RSCs can execute
- **Tracks Metrics**: Records execution count and timestamps

### 2. YieldOptimizerRSC

**File**: `contracts/rsc/examples/YieldOptimizerRSC.sol`

An example RSC that autonomously optimizes USDC yield between Aave V3 and Compound V3:

**Strategy**: Move USDC to whichever protocol offers higher APY

**Features**:
- Monitors APY rates on both protocols
- Rebalances when spread exceeds threshold
- Cooldown period between rebalances
- Pausable by owner
- Manual trigger for testing

## 📊 How It Works

### Execution Flow

1. **Strategy Decision**: RSC compares APYs between Aave and Compound
2. **Threshold Check**: If spread > 50 bps (0.5%), proceed
3. **Action Construction**: RSC builds FuseActions for rebalancing
4. **Adapter Execution**: RSC calls `adapter.executeReaction()`
5. **Vault Execution**: Vault executes actions through fuses
6. **Balance Update**: Vault updates market balances atomically

### Example Scenario

```
Initial State: 100,000 USDC in Aave @ 3.0% APY
Compound offers: 3.8% APY

Event: Compound rate increases to 4.0%

RSC Logic:
  - Detect APY change
  - Fetch APYs: Aave 3.0%, Compound 4.0%
  - Spread: 100 bps > 50 bps threshold ✓
  - Decision: Move to Compound

Execution:
  - FuseAction 1: Withdraw 100,000 from Aave
  - FuseAction 2: Deposit to Compound
  - Result: Now earning 4.0% APY on Compound
```

## 🔐 Security Model

### Role Hierarchy

```
ADMIN_ROLE (IPOR DAO Multisig)
  └─ OWNER_ROLE
      └─ ATOMIST_ROLE
          └─ ALPHA_ROLE ← Granted to RSC address
```

### Safety Features

1. **Asset Distribution Limits**: Max 60% per protocol
2. **Cooldown Period**: 1 hour between rebalances
3. **Pause Mechanism**: RSC can be paused by owner
4. **Guardian Role**: Can pause vault in emergencies
5. **Reentrancy Protection**: All state changes protected
6. **Fuse Whitelisting**: Only pre-approved protocols

## 📋 Deployment Checklist

```
□ You have deployed IPOR Fusion Plasma Vault on Arbitrum
□ You have obtained fuse addresses from IPOR (see IPOR_FUSE_ADDRESSES.md)
□ You have sufficient ETH on Arbitrum for gas (min 0.01 ETH)
□ You have saved your private key securely
□ You have reviewed all contract code
□ You understand the risks
```

## 🛠️ Available Commands

```bash
npm run compile        # Compile contracts
npm run deploy:mainnet # Deploy to Arbitrum mainnet
npm run grant:role     # Grant ALPHA_ROLE to RSC
npm run check:status   # Check contract status
npm run test          # Run tests (coming soon)
```

## 📊 Next Steps After Deployment

1. ✅ Deploy contracts
2. ✅ Grant permissions
3. ✅ Verify on Arbiscan
4. ✅ Test manually with `rsc.manualTrigger()`
5. ⏳ Enable automation
6. ⏳ Monitor operations
7. ⏳ Optimize parameters

## 🤝 Resources

- [IPOR Fusion Documentation](https://docs.ipor.io/ipor-fusion)
- [IPOR Fusion GitHub](https://github.com/IPOR-Labs/ipor-fusion)
- [IPOR ABIs](https://github.com/IPOR-Labs/ipor-abi)
- [ERC-4626 Standard](https://eips.ethereum.org/EIPS/eip-4626)

## ⚠️ Important Notes

### Security

- **Never commit `.env` file** - Private keys are sensitive
- **Use multisig** for owner roles in production
- **Audit code** before deploying with real funds
- **Test thoroughly** on testnet first

### Getting Fuse Addresses

IPOR maintains fuse deployments in their [ipor-abi repository](https://github.com/IPOR-Labs/ipor-abi). See `IPOR_FUSE_ADDRESSES.md` for instructions on obtaining these addresses.

## 📞 Support

- IPOR Fusion: [Discord](https://discord.gg/ipor) | [Docs](https://docs.ipor.io)
- This Project: Open an issue on GitHub

## 📝 License

MIT

## ⚠️ Disclaimer

This is a proof-of-concept demonstration. Use at your own risk. Always audit smart contracts before deploying with real funds.

---

**Built to demonstrate the future of autonomous DeFi strategies** 🚀
