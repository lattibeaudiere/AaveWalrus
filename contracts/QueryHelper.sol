// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title QueryHelper
 * @notice Helper contract on Arbitrum to query Compound V3 APY and emit response events
 * @dev Deployed on Arbitrum to be called via Reactive Network Callbacks
 * 
 * Flow:
 * 1. RSC emits Callback to queryCompoundApy()
 * 2. This contract queries Compound for current APY
 * 3. Emits CompoundApyQueried event
 * 4. RSC subscribes to this event and receives APY data
 */
interface IComet {
    function getUtilization() external view returns (uint256);
    function getSupplyRate(uint256 utilization) external view returns (uint64);
    function baseIndexScale() external view returns (uint64);
}

contract QueryHelper {
    // Compound V3 USDC Market on Arbitrum
    address public constant COMPOUND_USDC = 0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA;
    
    // Event emitted with Compound APY data
    // RSC will subscribe to this event
    event CompoundApyQueried(
        uint256 indexed nonce,
        uint256 apyBps,
        uint256 timestamp
    );
    
    /**
     * @notice Query Compound V3 current supply APY
     * @dev Called by Reactive Network via Callback from RSC
     * @param nonce Query nonce to match response with request
     * @return apyBps APY in basis points (1 bps = 0.01%)
     */
    function queryCompoundApy(uint256 nonce) external returns (uint256 apyBps) {
        IComet comet = IComet(COMPOUND_USDC);
        
        // FIXED: Use getSupplyRate(utilization) - supplyRatePerSecond() doesn't exist
        // Get current utilization
        uint256 utilization = comet.getUtilization();
        
        // Get supply rate (returns uint64, rate per second)
        uint64 supplyRateRaw = comet.getSupplyRate(utilization);
        
        // Get baseIndexScale for proper rate conversion
        uint64 baseIndexScale = comet.baseIndexScale();
        
        // Compound V3: getSupplyRate returns rate per second scaled by baseIndexScale
        // FIXED: Use * 10 instead of * 100 to match frontend values
        // APY (bps) = (supplyRate * SECONDS_PER_YEAR * 10) / baseIndexScale
        // Convert to basis points
        uint256 SECONDS_PER_YEAR = 365 days;
        uint256 supplyRate = uint256(supplyRateRaw);
        uint256 scale = uint256(baseIndexScale);
        apyBps = (supplyRate * SECONDS_PER_YEAR * 10 + scale / 2) / scale;
        
        // Emit event for RSC to capture
        emit CompoundApyQueried(nonce, apyBps, block.timestamp);
        
        return apyBps;
    }
    
    /**
     * @notice Get Compound APY without emitting event (for testing)
     */
    function getCompoundApy() external view returns (uint256 apyBps) {
        IComet comet = IComet(COMPOUND_USDC);
        uint256 utilization = comet.getUtilization();
        uint64 supplyRateRaw = comet.getSupplyRate(utilization);
        uint64 baseIndexScale = comet.baseIndexScale();
        uint256 SECONDS_PER_YEAR = 365 days;
        uint256 supplyRate = uint256(supplyRateRaw);
        uint256 scale = uint256(baseIndexScale);
        apyBps = (supplyRate * SECONDS_PER_YEAR * 10 + scale / 2) / scale;
    }
    
    // Aave V3 interfaces for initial deployment
    address public constant AAVE_POOL = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;
    address public constant USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    
    /**
     * @notice Query both Aave and Compound APYs and emit combined event
     * @dev Used for initial strategy deployment - gets both APYs in one call
     * @param nonce Query nonce to match response with request
     * @return aaveApyBps Current Aave APY in basis points
     * @return compoundApyBps Current Compound APY in basis points
     */
    function queryBothApys(uint256 nonce) external returns (uint256 aaveApyBps, uint256 compoundApyBps) {
        // Query Aave V3
        (bool success, bytes memory data) = AAVE_POOL.staticcall(
            abi.encodeWithSignature("getReserveData(address)", USDC)
        );
        require(success, "Aave query failed");
        
        // Decode reserve data (liquidityRate is at index 7)
        // ReserveData struct: (tuple(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256))
        (,,,,,,,uint256 liquidityRate,,,,) = abi.decode(data, (uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256));
        
        // Convert RAY (1e27) to APY in basis points
        // liquidityRate is already annual rate in RAY format
        uint256 RAY = 1e27;
        aaveApyBps = (liquidityRate * 10000) / RAY;
        
        // Query Compound V3
        IComet comet = IComet(COMPOUND_USDC);
        uint256 utilization = comet.getUtilization();
        uint64 supplyRateRaw = comet.getSupplyRate(utilization);
        uint64 baseIndexScale = comet.baseIndexScale();
        uint256 SECONDS_PER_YEAR = 365 days;
        uint256 supplyRate = uint256(supplyRateRaw);
        uint256 scale = uint256(baseIndexScale);
        compoundApyBps = (supplyRate * SECONDS_PER_YEAR * 10 + scale / 2) / scale;
        
        // Emit special event with both APYs
        // Use type(uint256).max as nonce to indicate this is initialization
        // RSC will detect this and handle accordingly
        emit BothApysQueried(nonce, aaveApyBps, compoundApyBps, block.timestamp);
        
        return (aaveApyBps, compoundApyBps);
    }
    
    /**
     * @notice Event emitted when both APYs are queried (for initialization)
     * @dev Use type(uint256).max as nonce for initialization queries
     * @dev RSC subscribes to this event and handles initialization specially
     */
    event BothApysQueried(
        uint256 indexed nonce,
        uint256 aaveApyBps,
        uint256 compoundApyBps,
        uint256 timestamp
    );
}

