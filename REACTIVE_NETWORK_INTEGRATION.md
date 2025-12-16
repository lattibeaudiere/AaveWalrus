# Reactive Network Integration Guide

This guide shows how to integrate IPOR Fusion Vaults with **Reactive Network** to enable cross-chain event-driven yield optimization.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  EXTERNAL CHAINS (Ethereum, Base, etc.)                     │
│  Aave V3 / Compound V3 emit ReserveDataUpdated events       │
│                                                              │
│  Event: ReserveDataUpdated(usdc, newAPY, timestamp)         │
│  Chain: 1 (Ethereum)                                         │
│  Contract: 0x794a61358D6845594F94dc1DB02A252b5b4814aD       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  REACTIVE NETWORK (Chain ID: 1597)                          │
│  Monitors specified events across chains                     │
│  Calls react() on registered contracts                       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  YieldOptimizerRSC (Deployed on Reactive Network)           │
│  Implements react() function                                 │
│  - Decodes event data                                        │
│  - Fetches current APYs                                      │
│  - Calculates spread                                         │
│  - Triggers rebalancing if threshold exceeded               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  ReactiveAlphaAdapter                                        │
│  Bridges RSC → IPOR Fusion Vault                            │
│  Validates permissions & executes actions                    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  IPOR Fusion Plasma Vault (Arbitrum)                         │
│  - Receives FuseActions from RSC                             │
│  - Executes via Aave/Compound Fuses                          │
│  - Rebalances assets atomically                              │
└─────────────────────────────────────────────────────────────┘
```

## Setup Requirements

### 1. Install Foundry (for Reactive Network deployments)

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### 2. Add Reactive Network Libraries

Create a new Foundry project or add to existing one:

```bash
# Initialize Foundry if not already done
forge init --no-git

# Add Reactive Network library
forge install ReactiveNetwork/reactive-lib
```

Update `foundry.toml`:
```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.20"

remappings = [
    "reactive-lib/=lib/reactive-lib/src/",
    "@openzeppelin/=node_modules/@openzeppelin/",
]
```

## Refactored Contract Structure

### YieldOptimizerRSC with Reactive Network Integration

**Location**: Create `src/YieldOptimizerRSC.sol` in a Foundry project

Key changes from our previous version:
1. Inherits from `AbstractReactive` 
2. Implements `react()` with proper signature
3. Adds subscription management
4. Includes tx hash deduplication
5. Works with Reactive Network's event system

### Confidence Chain IDs and USDC Addresses

```solidity
uint256 public constant ETHEREUM_CHAIN_ID = 1;
uint256 public constant BASE_CHAIN_ID = 8453;
uint256 public constant ARBITRUM_CHAIN_ID = 42161;

address public constant USDC_ETHEREUM = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
address public constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
address public constant USDC_ARBITRUM = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
```

### Event Signatures to Monitor

```solidity
// Aave V3 ReserveDataUpdated event
// keccak256("ReserveDataUpdated(address indexed reserve, uint256 liquidityRate, uint256 stableBorrowRate, uint256 variableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex)")
bytes32 public constant RESERVE_DATA_UPDATED_TOPIC = 
    0x4a504a94899432a9846e1aa406dceb1bcfd538bb839071d49d1e5e23f5be30ef;

// Compound V3 Supply event  
// keccak256("Supply(address indexed supplier, address indexed onBehalfOf, uint256 amount, uint256 balance)")
bytes32 public constant COMPOUND_SUPPLY_TOPIC = 
    0x...; // Add actual signature
```

## Deployment Steps

### Step 1: Deploy on Reactive Network

```bash
# Compile
forge build

# Deploy with Foundry
forge create YieldOptimizerRSC \
  --rpc-url https://mainnet-rpc.rnk.dev \
  --private-key $REACTIVE_PRIVATE_KEY \
  --constructor-args $TARGET_VAULT $ADAPTER_ADDRESS $AAVE_POOL $COMPOUND_MARKET $MIN_SPREAD \
  --value 0.1ether \
  --verify \
  -vvvv
```

### Step 2: Fund the Contract

The contract needs REACT tokens for gas:

```bash
cast send $RSC_ADDRESS \
  --value 1ether \
  --rpc-url https://mainnet-rpc.rnk.dev \
  --private-key $REACTIVE_PRIVATE_KEY
```

### Step 3: Subscribe to Events

Create a subscription script:

```javascript
// scripts/subscribe.js
const { ethers } = require("ethers");

async function subscribe() {
    const provider = new ethers.JsonRpcProvider("https://mainnet-rpc.rnk.dev");
    const signer = new ethers.Wallet(process.env.REACTIVE_PRIVATE_KEY, provider);
    
    const contract = new ethers.Contract(
        process.env.RSC_ADDRESS,
        [
            "function subscribeToAave(uint256 chainId, address pool) external payable",
            "function subscribeToCompound(uint256 chainId, address market) external payable"
        ],
        signer
    );
    
    console.log("🔗 Subscribing to Aave V3 on Arbitrum...");
    await contract.subscribeToAave(
        42161, // Arbitrum
        "0x794a61358D6845594F94dc1DB02A252b5b4814aD" // Aave Pool
    );
    
    console.log("🔗 Subscribing to Compound V3 on Arbitrum...");
    await contract.subscribeToCompound(
        42161, // Arbitrum
        "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA" // Compound Market
    );
    
    console.log("✅ Subscriptions complete!");
}

subscribe();
```

### Step 4: Grant ALPHA_ROLE

```solidity
// On Arbitrum, call the vault's access manager
accessManager.grantRole(Roles.ALPHA_ROLE, $RSC_ADDRESS);
```

## Monitoring

### Check Contract Status

```javascript
zig contracts/rsc/YieldOptimizerRSC.sol
const { ethers } = require("ethers");

async function checkStatus() {
    const provider = new ethers.JsonRpcProvider("https://mainnet-rpc.rnk.dev");
    const rsc = new ethers.Contract(process.env.RSC_ADDRESS, RSC_ABI, provider);
    
    console.log("📊 Yield Optimizer Status");
    console.log("Balance:", await provider.getBalance(process.env.RSC_ADDRESS), "REACT");
    console.log("Last Rebalance:", await rsc.lastRebalance());
    
    const [aaveAPY, compoundAPY, spread, lastRebalance] = await rsc.getStrategyState();
    console.log("Aave APY:", aaveAPY, "bps");
    console.log("Compound APY:", compoundAPY, "bps");
    console.log("Spread:", spread, "bps");
}
```

## Key Differences from Our Previous Implementation

| Aspect | Previous (Hardhat) | Reactive Network (Foundry) |
|--------|-------------------|---------------------------|
| Contract Base | Custom interface | `AbstractReactive` |
| react() signature | `react(bytes, address)` | `react(IReactive.LogRecord calldata)` |
| Event monitoring | Manual | Automatic via subscriptions |
| Deployment | Hardhat on target chain | Foundry on Reactive Network |
| Gas payment | ETH on target chain | REACT on Reactive Network |
| Access control | Direct ALPHA_ROLE | Via ReactiveAlphaAdapter |

## Migration Path

To migrate our existing setup to Reactive Network:

1. **Keep our ReactiveAlphaAdapter** - it's still needed to bridge RSC → Vault
2. **Refactor YieldOptimizerRSC** - inherit from AbstractReactive
3. **Update deployment** - deploy to Reactive Network instead of Arbitrum
4. **Add subscriptions** - register event sources post-deployment
5. **Keep vault deployment** - Plasma Vault still deployed on Arbitrum

## Benefits of Reactive Network Integration

### ✅ Advantages

- **Cross-Chain Monitoring**: Monitor Ethereum, Base, Arbitrum from one contract
- **Lower Latency**: ~10-30s vs 45-120s for traditional bots
- **No Private Keys**: Fully on-chain, no server infrastructure
- **Composability**: One RSC can trigger actions on multiple chains
- **Cost Efficiency**: One deployment for all monitored chains

### ⚠️ Considerations

- **Reactive Network Dependency**: Requires Reactive Network to be operational
- **REACT Token**: Need to maintain balance for gas
- **Initial Setup**: More complex deployment process
- **Testing**: Requires Reactive Network testnet for proper testing

## Example Workflow

```
1. Event Occurs on Ethereum:
   - Aave V3 emits ReserveDataUpdated
   - Chain ID: 1
   
2. Reactive Network Detects Event:
   - Matches subscription for RSC
   - Calls react() on RSC
   
3. RSC Decision Logic:
   - Fetches current APY from Aave (3.0%)
   - Fetches current APY from Compound (3.8%)
   - Calculates spread: 80 bps
   - Threshold: 50 bps ✓
   
4. RSC Triggers Action:
   - Calls adapter.executeReaction()
   - Sends FuseActions to vault
   
5. Vault Executes (on Arbitrum):
   - Withdraws from Compound
   - Deposits to Aave
   - Updates balances
   
6. Result:
   - Vault now earning 3.8% APY
   - Transaction complete in ~15 seconds
```

## Next Steps

1. Set up Foundry project
2. Add reactive-lib dependency
3. Implement refactored YieldOptimizerRSC
4. Deploy to Reactive Network testnet
5. Test subscription and event processing
6. Deploy to production
7. Monitor and optimize

## Resources

- [Reactive Network Docs](https://reactive.network)
- [Foundry Book](https://book.getfoundry.sh)
- [IPOR Fusion Docs](https://docs.ipor.io/ipor-fusion)

