// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IFuse.sol";

/**
 * @title IFusionVault
 * @notice Interface for the IPOR Fusion Plasma Vault
 * @dev The Vault coordinates between Alpha (RSC) and Fuses to execute strategies
 */
interface IFusionVault {
    // Events
    event FuseWhitelisted(address indexed fuse, address indexed atomist);
    event FuseExecuted(address indexed fuse, address indexed alpha, bytes data);
    event AlphaRegistered(address indexed alpha, bool isActive);
    event AssetDeposited(address indexed user, address indexed asset, uint256 amount);
    event AssetWithdrawn(address indexed user, address indexed asset, uint256 amount);
    event EmergencyPause(bool isPaused);

    /**
     * @notice Registers or updates an Alpha (RSC) that can execute actions
     * @param alpha The address of the Alpha contract
     * @param isActive Whether the Alpha is active
     */
    function registerAlpha(address alpha, bool isActive) external;

    /**
     * @notice Whitelists a Fuse for use by this vault
     * @param fuse The address of the Fuse to whitelist
     * @param fuseType The type of Fuse (0=Balance, 1=Functional)
     */
    function whitelistFuse(address fuse, uint8 fuseType) external;

    /**
     * @notice Executes an action through a Functional Fuse
     * @dev Only callable by registered Alpha
     * @param fuse The address of the Functional Fuse to use
     * @param data The encoded function call data for the Fuse
     * @return success Whether the execution was successful
     * @return result Return data from the Fuse execution
     */
    function executeFuse(address fuse, bytes calldata data)
        external
        returns (bool success, bytes memory result);

    /**
     * @notice Gets the balance of an asset held by this vault in a protocol
     * @param fuse The Balance Fuse to query
     * @param asset The address of the asset
     * @return The balance of the asset
     */
    function getProtocolBalance(address fuse, address asset) external view returns (uint256);

    /**
     * @notice Gets the current APY for an asset in a protocol
     * @param fuse The Balance Fuse to query
     * @param asset The address of the asset
     * @return The current APY in basis points
     */
    function getProtocolAPY(address fuse, address asset) external view returns (uint256);

    /**
     * @notice Returns whether an Alpha is registered and active
     * @param alpha The address of the Alpha to check
     * @return True if the Alpha is registered and active
     */
    function isAlphaActive(address alpha) external view returns (bool);

    /**
     * @notice Returns whether a Fuse is whitelisted
     * @param fuse The address of the Fuse to check
     * @return True if the Fuse is whitelisted
     */
    function isFuseWhitelisted(address fuse) external view returns (bool);
}

