// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IReactiveAlpha
 * @notice Interface for Reactive Smart Contract Alpha that autonomously executes strategies on IPOR Fusion Vaults
 * @dev RSCs replace traditional off-chain Alpha agents with on-chain, event-driven automation
 * 
 * Architecture:
 * - RSCs monitor on-chain events and data sources
 * - They execute the react() function when triggered conditions are met
 * - They interact with Plasma Vaults through the ReactiveAlphaAdapter
 * - The ATOMIST_ROLE grants them ALPHA_ROLE on the target vault
 */
interface IReactiveAlpha {
    /**
     * @notice The core reactive function that executes when conditions are met
     * @dev This is called automatically by the Reactive Network when subscribed events occur
     * 
     * Execution Flow:
     * 1. Event is detected on the target chain
     * 2. Reactive Network triggers this function
     * 3. RSC evaluates conditions and makes a decision
     * 4. RSC constructs FuseActions for the target vault
     * 5. RSC calls vault.execute() via ReactiveAlphaAdapter
     * 
     * @param eventData Encoded data from the triggering event
     * @param eventSource Address of the contract that emitted the triggering event
     * @return success Whether the reaction was successfully executed
     * @return data Additional execution data for logging/monitoring
     */
    function react(bytes calldata eventData, address eventSource) external returns (bool success, bytes memory data);

    /**
     * @notice Returns the address of the target Plasma Vault this RSC manages
     * @return The Plasma Vault address
     */
    function getTargetVault() external view returns (address);

    /**
     * @notice Returns a human-readable description of the strategy
     * @return Strategy description
     */
    function getStrategyDescription() external pure returns (string memory);

    /**
     * @notice Returns the chain ID where this RSC should monitor events
     * @return The chain ID to monitor
     */
    function getMonitoringChainId() external view returns (uint256);

    /**
     * @notice Returns the chain ID where the target vault is deployed
     * @return The chain ID of the vault
     */
    function getTargetChainId() external view returns (uint256);
}

