# Final RSC Implementation - Complete Strategy Logic

## Implementation Status

Based on developer feedback, here's the complete implementation needed for `react()` function:

## Constants Needed

```solidity
address public constant USDC_ADDRESS = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
address public constant AAVE_SUPPLY_FUSE = 0x304756cD719382281fBD640f5F7932465eD663D6;
address public constant COMPOUND_SUPPLY_FUSE = 0xB0b3dc1B27C6c8007c9B01a768d6717f6813fE94;
address public constant AAVE_BALANCE_FUSE = 0x4CB1c4774BA1B65802c68Adb33DE99ABf8B21228;
address public constant COMPOUND_BALANCE_FUSE = 0xCF730BAA5542DC7570907696271bA96019FcD10C;

// Vault address - to be set from .env or constructor
address public immutable VAULT_ADDRESS;
```

## Helper Functions

### 1. Extract Aave APY (CRITICAL FIX)
```solidity
function _extractAaveApy(IReactive.LogRecord calldata log) internal pure returns (uint256 apyBps) {
    // CRITICAL FIX: Reserve address is in topic1 (indexed), NOT in data
    // Data only contains: (liquidityRate, stableBorrowRate, variableBorrowRate, liquidityIndex, variableBorrowIndex)
    require(log.topic_1 == uint256(uint160(USDC_ADDRESS)), "Not USDC reserve");
    
    // Decode 5 uint256s only (NO address in data)
    (uint256 liquidityRate, , , , ) = abi.decode(
        log.data, 
        (uint256, uint256, uint256, uint256, uint256)
    );
    
    // Convert RAY to basis points
    // APY (bps) = (liquidityRate * SECONDS_PER_YEAR * 100) / RAY
    apyBps = (liquidityRate * SECONDS_PER_YEAR * 100) / RAY;
    
    // Validate range (0-20% = 0-2000 bps)
    require(apyBps <= 2000, "Aave APY anomaly");
    
    return apyBps;
}
```

### 2. Extract Compound APY
```solidity
function _extractCompoundApy(bytes calldata eventData) internal view returns (uint256 apyBps, uint256 timestamp) {
    (apyBps, timestamp) = abi.decode(eventData, (uint256, uint256));
    
    // Validate range
    require(apyBps <= 2000, "Compound APY anomaly");
    
    // Check timeout (1 minute)
    require(block.timestamp <= timestamp + 60, "Query expired");
    
    return (apyBps, timestamp);
}
```

### 3. Calculate Spread
```solidity
function _calculateSpread(uint256 aaveApyBps, uint256 compoundApyBps) 
    internal 
    pure 
    returns (uint256 spreadBps) 
{
    if (aaveApyBps > compoundApyBps) {
        return aaveApyBps - compoundApyBps;
    } else {
        return compoundApyBps - aaveApyBps;
    }
}
```

### 4. Check Cooldown
```solidity
modifier checkCooldown() {
    require(
        block.timestamp >= lastRebalanceTime + MIN_REBALANCE_COOLDOWN,
        "Cooldown active"
    );
    _;
}

// Or inline check:
function _checkCooldown() internal view {
    require(
        block.timestamp >= lastRebalanceTime + MIN_REBALANCE_COOLDOWN,
        "Cooldown active"
    );
}
```

### 5. Build Rebalance Actions
```solidity
function _buildRebalanceActions(
    bool aaveToCompound,  // true = move from Aave to Compound
    uint256 amount
) internal pure returns (IAdapterDispatcher.FuseAction[] memory actions) {
    actions = new IAdapterDispatcher.FuseAction[](2);
    
    // Define structs for encoding
    struct AaveV3SupplyFuseExitData {
        address asset;
        uint256 amount;
    }
    
    struct AaveV3SupplyFuseEnterData {
        address asset;
        uint256 amount;
        uint256 userEModeCategoryId;
    }
    
    struct CompoundV3SupplyFuseExitData {
        address asset;
        uint256 amount;
    }
    
    struct CompoundV3SupplyFuseEnterData {
        address asset;
        uint256 amount;
    }
    
    if (aaveToCompound) {
        // Withdraw from Aave
        actions[0] = IAdapterDispatcher.FuseAction({
            fuse: AAVE_SUPPLY_FUSE,
            data: abi.encodeWithSelector(
                bytes4(keccak256("exit((address,uint256))")),
                AaveV3SupplyFuseExitData(USDC_ADDRESS, amount)
            )
        });
        
        // Deposit to Compound
        actions[1] = IAdapterDispatcher.FuseAction({
            fuse: COMPOUND_SUPPLY_FUSE,
            data: abi.encodeWithSelector(
                bytes4(keccak256("enter((address,uint256))")),
                CompoundV3SupplyFuseEnterData(USDC_ADDRESS, amount)
            )
        });
    } else {
        // Withdraw from Compound
        actions[0] = IAdapterDispatcher.FuseAction({
            fuse: COMPOUND_SUPPLY_FUSE,
            data: abi.encodeWithSelector(
                bytes4(keccak256("exit((address,uint256))")),
                CompoundV3SupplyFuseExitData(USDC_ADDRESS, amount)
            )
        });
        
        // Deposit to Aave
        actions[1] = IAdapterDispatcher.FuseAction({
            fuse: AAVE_SUPPLY_FUSE,
            data: abi.encodeWithSelector(
                bytes4(keccak256("enter((address,uint256,uint256))")),
                AaveV3SupplyFuseEnterData(USDC_ADDRESS, amount, 0) // eMode = 0
            )
        });
    }
    
    return actions;
}
```

## Complete react() Implementation

```solidity
function react(IReactive.LogRecord calldata log) external vmOnly {
    // Additional sequencer check if configured
    if (sequencer != address(0)) {
        require(msg.sender == sequencer, "unauthorized");
    }
    
    require(log.chain_id == ARBITRUM_CHAIN_ID, "chain");
    
    // Handle Aave ReserveDataUpdated events
    if (log.topic_0 == RESERVE_DATA_UPDATED && log._contract == AAVE_POOL) {
        // Extract Aave APY (CRITICAL FIX: 5 uints only, no address)
        uint256 aaveApyBps = _extractAaveApy(log);
        lastAaveApyBps = aaveApyBps;
        queryNonce++;
        
        // Emit Callback to query Compound APY
        bytes memory queryPayload = abi.encodeWithSignature(
            "queryCompoundApy(uint256)",
            queryNonce
        );
        
        emit Callback(
            ARBITRUM_CHAIN_ID,
            queryHelper,
            uint64(300000), // Gas limit for query
            queryPayload
        );
        
        emit StrategyUpdate(aaveApyBps, 0, 0, false); // Compound APY not yet known
        
    } else if (log.topic_0 == COMPOUND_APY_QUERIED_TOPIC && log._contract == queryHelper) {
        // Verify nonce matches
        uint256 nonce = log.topic_1; // nonce is indexed
        if (nonce != queryNonce) {
            emit ReactHandled(log.chain_id, log._contract, log.tx_hash, log.log_index);
            return; // Ignore stale responses
        }
        
        // Extract Compound APY
        (uint256 compoundApyBps, uint256 timestamp) = _extractCompoundApy(log.data);
        
        // Verify timeout
        if (block.timestamp > timestamp + 60) {
            emit ReactHandled(log.chain_id, log._contract, log.tx_hash, log.log_index);
            return; // Query expired
        }
        
        // Calculate spread
        uint256 spreadBps = _calculateSpread(lastAaveApyBps, compoundApyBps);
        
        // Check threshold and cooldown
        bool shouldRebalance = spreadBps > THRESHOLD_BPS &&
            block.timestamp >= lastRebalanceTime + MIN_REBALANCE_COOLDOWN;
        
        if (shouldRebalance) {
            // Determine direction
            bool aaveToCompound = lastAaveApyBps > compoundApyBps;
            
            // TODO: Query vault balance via Balance Fuse first
            // For now, use type(uint256).max to rebalance full position
            uint256 amount = type(uint256).max; // Vault will handle max
            
            // Build rebalance actions
            IAdapterDispatcher.FuseAction[] memory actions = _buildRebalanceActions(
                aaveToCompound,
                amount
            );
            
            // Emit execution callback
            bytes memory execPayload = abi.encodeWithSignature(
                "executeReaction((address,bytes)[])",
                actions
            );
            
            emit Callback(
                ARBITRUM_CHAIN_ID,
                adapter,
                uint64(1000000), // Gas limit for rebalance
                execPayload
            );
            
            lastRebalanceTime = block.timestamp;
            
            emit StrategyUpdate(lastAaveApyBps, compoundApyBps, spreadBps, true);
        } else {
            emit StrategyUpdate(lastAaveApyBps, compoundApyBps, spreadBps, false);
        }
    }
    
    emit ReactHandled(log.chain_id, log._contract, log.tx_hash, log.log_index);
}
```

## QueryHelper Subscription Function

```solidity
/**
 * @notice Subscribe to QueryHelper CompoundApyQueried events
 * @dev Called after QueryHelper is deployed
 */
function subscribeToQueryHelper() external rnOnly onlyOwner {
    require(!queryHelperSubscribed, "Already subscribed to QueryHelper");
    
    service.subscribe(
        ARBITRUM_CHAIN_ID,
        queryHelper,
        COMPOUND_APY_QUERIED_TOPIC,
        REACTIVE_IGNORE, // nonce can vary
        REACTIVE_IGNORE,
        REACTIVE_IGNORE
    );
    
    queryHelperSubscribed = true;
    emit Subscribed(ARBITRUM_CHAIN_ID, queryHelper, COMPOUND_APY_QUERIED_TOPIC);
}
```

## Open Questions (From Developer Review)

1. **Vault Address:** Need from .env or constructor parameter
2. **Min Position Size:** For dust protection (e.g., $5k minimum)
3. **IPOR Whitelisting:** Confirm RSC/Adapter registered in Vault
4. **Aave eMode:** Using 0 (no eMode) for USDC - correct?
5. **Balance Query:** Should we query balance before rebalancing? (via Balance Fuse)

---

**Status:** Complete implementation plan ready  
**Next:** Integrate into RSC contract, test on fork, deploy

