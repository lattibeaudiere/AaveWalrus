// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title MockPlasmaVault
 * @notice Mock implementation of IPOR Fusion Plasma Vault for testing strategy execution
 * @dev Simulates the execute function and tracks FuseAction calls
 */
contract MockPlasmaVault is AccessControl {
    
    /// @notice Role that can execute strategies (ALPHA_ROLE)
    bytes32 public constant ALPHA_ROLE = keccak256("ALPHA_ROLE");
    
    /// @notice Structure matching IPOR Fusion's FuseAction
    struct FuseAction {
        address fuse;
        bytes data;
    }
    
    /// @notice Emitted when execute is called
    event ExecuteCalled(
        address indexed caller,
        uint256 actionCount,
        address[] fuses,
        bytes[] data
    );
    
    /// @notice Emitted when a fuse action is processed
    event FuseActionProcessed(
        address indexed fuse,
        bytes data,
        bool success
    );
    
    /// @notice Track execution history
    struct ExecutionRecord {
        address caller;
        uint256 timestamp;
        uint256 actionCount;
        bool success;
    }
    
    /// @notice Execution history
    ExecutionRecord[] public executionHistory;
    
    /// @notice Mock balances for different fuses
    mapping(address => uint256) public fuseBalances;
    
    /// @notice Mock USDC balance
    uint256 public usdcBalance;
    
    /// @notice Whether to simulate execution failures
    bool public shouldFail;
    
    constructor(address owner) {
        _grantRole(DEFAULT_ADMIN_ROLE, owner);
        _grantRole(ALPHA_ROLE, owner);
        
        // Initialize mock balances
        usdcBalance = 1000000 * 1e6; // 1M USDC
    }
    
    /**
     * @notice Mock execute function that simulates IPOR Fusion vault execution
     * @param calls_ Array of FuseActions to execute
     */
    function execute(FuseAction[] calldata calls_) external onlyRole(ALPHA_ROLE) {
        if (shouldFail) {
            revert("Mock execution failure");
        }
        
        uint256 actionCount = calls_.length;
        address[] memory fuses = new address[](actionCount);
        bytes[] memory data = new bytes[](actionCount);
        
        for (uint256 i = 0; i < actionCount; i++) {
            fuses[i] = calls_[i].fuse;
            data[i] = calls_[i].data;
            
            // Process the fuse action
            bool success = _processFuseAction(calls_[i].fuse, calls_[i].data);
            emit FuseActionProcessed(calls_[i].fuse, calls_[i].data, success);
        }
        
        // Record execution
        executionHistory.push(ExecutionRecord({
            caller: msg.sender,
            timestamp: block.timestamp,
            actionCount: actionCount,
            success: true
        }));
        
        emit ExecuteCalled(msg.sender, actionCount, fuses, data);
    }
    
    /**
     * @notice Process a single fuse action (mock implementation)
     * @param fuse The fuse address
     * @param data The action data
     * @return success Whether the action succeeded
     */
    function _processFuseAction(address fuse, bytes calldata data) internal returns (bool success) {
        // Mock fuse processing logic
        // In reality, this would call the actual fuse contract
        
        // Simulate withdraw action (exit)
        if (data.length >= 4) {
            bytes4 selector = bytes4(data[0:4]);
            
            // Mock withdraw (exit) action
            if (selector == bytes4(keccak256("exit(address,uint256)"))) {
                (address asset, uint256 amount) = abi.decode(data[4:], (address, uint256));
                if (fuseBalances[fuse] >= amount) {
                    fuseBalances[fuse] -= amount;
                    return true;
                }
            }
            
            // Mock deposit (enter) action
            if (selector == bytes4(keccak256("enter(address,uint256)"))) {
                (address asset, uint256 amount) = abi.decode(data[4:], (address, uint256));
                fuseBalances[fuse] += amount;
                return true;
            }
        }
        
        return true; // Default to success for other actions
    }
    
    /**
     * @notice Set mock balance for a fuse
     * @param fuse The fuse address
     * @param balance The balance to set
     */
    function setFuseBalance(address fuse, uint256 balance) external onlyRole(DEFAULT_ADMIN_ROLE) {
        fuseBalances[fuse] = balance;
    }
    
    /**
     * @notice Set whether executions should fail
     * @param fail Whether to simulate failures
     */
    function setShouldFail(bool fail) external onlyRole(DEFAULT_ADMIN_ROLE) {
        shouldFail = fail;
    }
    
    /**
     * @notice Get execution history count
     * @return The number of executions recorded
     */
    function getExecutionCount() external view returns (uint256) {
        return executionHistory.length;
    }
    
    /**
     * @notice Get the last execution record
     * @return The last execution record
     */
    function getLastExecution() external view returns (ExecutionRecord memory) {
        require(executionHistory.length > 0, "No executions");
        return executionHistory[executionHistory.length - 1];
    }
}
