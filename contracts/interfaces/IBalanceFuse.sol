// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IFuse.sol";

/**
 * @title IBalanceFuse
 * @notice Interface for Balance Fuses - state tracking fuses that report asset balances
 * @dev Balance Fuses are read-only and used for accounting and risk management
 */
interface IBalanceFuse is IFuse {
    /**
     * @notice Returns the balance of a specific asset held by the vault in the protocol
     * @param asset The address of the asset token
     * @param vault The address of the Fusion Vault
     * @return The balance of the asset in the protocol
     */
    function getBalance(address asset, address vault) external view returns (uint256);

    /**
     * @notice Returns the total assets the vault has in this protocol
     * @param vault The address of the Fusion Vault
     * @return An array of asset addresses
     * @return An array of corresponding balances
     */
    function getAllBalances(address vault)
        external
        view
        returns (address[] memory, uint256[] memory);

    /**
     * @notice Gets the yield/APY rate for a specific asset
     * @param asset The address of the asset token
     * @param vault The address of the Fusion Vault
     * @return The current APY rate (in basis points, e.g., 500 = 5%)
     */
    function getAPY(address asset, address vault) external view returns (uint256);
}

