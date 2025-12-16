// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IFuse
 * @notice Base interface for all Fuses in the IPOR Fusion Vault system
 * @dev Fuses are modular, stateless interface layers that translate vault commands
 *      into protocol-specific interactions. They are immutable and hold no assets.
 */
interface IFuse {
    /**
     * @notice Returns the protocol this Fuse is designed to interact with
     * @return The name of the target protocol (e.g., "Aave", "Compound")
     */
    function getProtocol() external pure returns (string memory);

    /**
     * @notice Returns the Fuse type
     * @return 0 for Balance Fuse (read-only state tracking)
     *         1 for Functional Fuse (action execution)
     */
    function getFuseType() external pure returns (uint8);

    /**
     * @notice Returns the version of the Fuse implementation
     * @return Semver version string
     */
    function getVersion() external pure returns (string memory);

    /**
     * @notice Validates if the Fuse can be used by a specific vault
     * @param vault The address of the Fusion Vault
     * @return True if the Fuse is compatible with the vault
     */
    function validateVault(address vault) external view returns (bool);
}

