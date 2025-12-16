// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockAaveDataProvider
 * @notice Mock implementation of Aave V3 Data Provider for testing APY reading
 * @dev Simulates Aave V3 APY data
 */
contract MockAaveDataProvider {
    
    /// @notice Mock APY data
    struct ReserveData {
        uint256 currentLiquidityRate; // APY in ray (1e27)
        uint256 currentStableBorrowRate;
        uint256 currentVariableBorrowRate;
        uint256 liquidityIndex;
        uint256 variableBorrowIndex;
        uint40 lastUpdateTimestamp;
    }
    
    /// @notice Mock reserve data
    mapping(address => ReserveData) public reservesData;
    
    /// @notice USDC address on Arbitrum
    address public constant USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    
    /// @notice Ray precision (1e27)
    uint256 public constant RAY = 1e27;
    
    /// @notice Seconds per year
    uint256 public constant SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
    
    constructor() {
        // Initialize with default APY (3.5%)
        _setAPY(USDC, 350); // 3.5% in basis points
    }
    
    /**
     * @notice Set APY for a reserve
     * @param asset The asset address
     * @param apyBps APY in basis points (e.g., 350 = 3.5%)
     */
    function setAPY(address asset, uint256 apyBps) external {
        _setAPY(asset, apyBps);
    }
    
    /**
     * @notice Internal function to set APY
     * @param asset The asset address
     * @param apyBps APY in basis points
     */
    function _setAPY(address asset, uint256 apyBps) internal {
        // Convert basis points to ray
        uint256 apyRay = (apyBps * RAY) / 10000;
        
        reservesData[asset] = ReserveData({
            currentLiquidityRate: apyRay,
            currentStableBorrowRate: apyRay,
            currentVariableBorrowRate: apyRay,
            liquidityIndex: RAY,
            variableBorrowIndex: RAY,
            lastUpdateTimestamp: uint40(block.timestamp)
        });
    }
    
    /**
     * @notice Get reserve data (matching Aave V3 interface)
     * @param asset The asset address
     * @return The reserve data
     */
    function getReserveData(address asset) external view returns (ReserveData memory) {
        return reservesData[asset];
    }
    
    /**
     * @notice Get APY in basis points
     * @param asset The asset address
     * @return APY in basis points
     */
    function getAPY(address asset) external view returns (uint256) {
        ReserveData memory data = reservesData[asset];
        // Convert ray to basis points
        return (data.currentLiquidityRate * 10000) / RAY;
    }
    
    /**
     * @notice Simulate APY change event
     * @param asset The asset address
     * @param newAPYBps New APY in basis points
     */
    function simulateAPYChange(address asset, uint256 newAPYBps) external {
        _setAPY(asset, newAPYBps);
    }
}
