// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IFuse.sol";

/**
 * @title IFunctionalFuse
 * @notice Interface for Functional Fuses - action execution fuses that perform operations
 * @dev Functional Fuses execute state-changing operations on external protocols
 */
interface IFunctionalFuse is IFuse {
    /**
     * @notice Executes a supply/deposit operation in the target protocol
     * @param asset The address of the asset to supply
     * @param amount The amount to supply
     * @param vault The address of the Fusion Vault calling this function
     * @return success Whether the operation was successful
     * @return data Additional return data from the operation
     */
    function supply(address asset, uint256 amount, address vault)
        external
        returns (bool success, bytes memory data);

    /**
     * @notice Executes a withdraw operation from the target protocol
     * @param asset The address of the asset to withdraw
     * @param amount The amount to withdraw
     * @param vault The address of the Fusion Vault calling this function
     * @return success Whether the operation was successful
     * @return data Additional return data from the operation
     */
    function withdraw(address asset, uint256 amount, address vault)
        external
        returns (bool success, bytes memory data);

    /**
     * @notice Executes a swap operation (if the fuse supports it)
     * @param assetIn The address of the input asset
     * @param assetOut The address of the output asset
     * @param amountIn The amount of input asset
     * @param vault The address of the Fusion Vault calling this function
     * @return success Whether the operation was successful
     * @return data Additional return data including amountOut
     */
    function swap(address assetIn, address assetOut, uint256 amountIn, address vault)
        external
        returns (bool success, bytes memory data);
}

