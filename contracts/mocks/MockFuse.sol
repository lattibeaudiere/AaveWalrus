// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockFuse
 * @notice Mock implementation of IPOR Fusion Fuse for testing
 * @dev Simulates fuse behavior for Aave and Compound
 */
contract MockFuse {
    
    /// @notice Mock balance tracking
    mapping(address => uint256) public balances;
    
    /// @notice Mock asset address
    address public immutable asset;
    
    /// @notice Mock fuse type (1 = Aave, 2 = Compound)
    uint256 public immutable fuseType;
    
    /// @notice Emitted when assets are deposited
    event Deposited(address indexed asset, uint256 amount);
    
    /// @notice Emitted when assets are withdrawn
    event Withdrawn(address indexed asset, uint256 amount);
    
    constructor(address asset_, uint256 fuseType_) {
        asset = asset_;
        fuseType = fuseType_;
    }
    
    /**
     * @notice Mock enter function (deposit)
     * @param asset_ The asset address
     * @param amount The amount to deposit
     */
    function enter(address asset_, uint256 amount) external {
        require(asset_ == asset, "Invalid asset");
        balances[asset_] += amount;
        emit Deposited(asset_, amount);
    }
    
    /**
     * @notice Mock exit function (withdraw)
     * @param asset_ The asset address
     * @param amount The amount to withdraw
     */
    function exit(address asset_, uint256 amount) external {
        require(asset_ == asset, "Invalid asset");
        require(balances[asset_] >= amount, "Insufficient balance");
        balances[asset_] -= amount;
        emit Withdrawn(asset_, amount);
    }
    
    /**
     * @notice Get balance for an asset
     * @param asset_ The asset address
     * @return The balance
     */
    function getBalance(address asset_) external view returns (uint256) {
        return balances[asset_];
    }
    
    /**
     * @notice Set balance for testing
     * @param asset_ The asset address
     * @param balance The balance to set
     */
    function setBalance(address asset_, uint256 balance) external {
        balances[asset_] = balance;
    }
}
