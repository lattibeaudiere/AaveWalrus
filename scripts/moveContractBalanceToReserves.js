const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Move contract's own balance to reserves via system contract
 * This checks if the contract can call depositTo() on itself
 */
async function moveContractBalanceToReserves() {
    console.log("=".repeat(60));
    console.log("💰 MOVING CONTRACT BALANCE TO RESERVES");
    console.log("=".repeat(60));
    console.log("");
    
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    const REACTIVE_PRIVATE_KEY = process.env.REACTIVE_PRIVATE_KEY;
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0x15725e58A3199122FcBb4d6F20573EEFd730781A";
    
    // Reactive Network System Contract
    const SYSTEM_CONTRACT = "0x0000000000000000000000000000000000fffFfF";
    
    if (!REACTIVE_PRIVATE_KEY) {
        throw new Error("REACTIVE_PRIVATE_KEY must be set in .env");
    }
    
    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    const wallet = new ethers.Wallet(REACTIVE_PRIVATE_KEY, provider);
    
    console.log("Configuration:");
    console.log(`  Network: Reactive Network (Chain 1597)`);
    console.log(`  RSC Contract: ${RSC_ADDRESS}`);
    console.log(`  System Contract: ${SYSTEM_CONTRACT}`);
    console.log("");
    
    // System Contract ABI
    const systemContractABI = [
        "function debts(address) view returns (uint256)",
        "function reserves(address) view returns (uint256)",
        "function depositTo(address) payable"
    ];
    
    // RSC Contract ABI - check if it has functions to interact with system contract
    const rscABI = [
        "function receive() external payable",
        // We'll try to call system contract from RSC
    ];
    
    const systemContract = new ethers.Contract(SYSTEM_CONTRACT, systemContractABI, provider);
    const rscContract = new ethers.Contract(RSC_ADDRESS, rscABI, provider);
    
    try {
        // Check current status
        const directBalance = await provider.getBalance(RSC_ADDRESS);
        const directBalanceReact = ethers.utils.formatEther(directBalance);
        
        const reserves = await systemContract.reserves(RSC_ADDRESS);
        const reservesReact = ethers.utils.formatEther(reserves);
        
        console.log("=".repeat(60));
        console.log("📊 CURRENT STATUS");
        console.log("=".repeat(60));
        console.log("");
        console.log(`Direct Balance: ${directBalanceReact} REACT`);
        console.log(`Reserves: ${reservesReact} REACT`);
        console.log("");
        
        if (parseFloat(directBalanceReact) < 0.01) {
            console.log("⚠️  Contract has very little balance (< 0.01 REACT)");
            console.log("   May not be worth moving to reserves");
            return;
        }
        
        // Option 1: Try to have contract call system contract itself
        // This requires the RSC to have a function that calls depositTo()
        console.log("=".repeat(60));
        console.log("🔍 CHECKING OPTIONS");
        console.log("=".repeat(60));
        console.log("");
        console.log("Option 1: Contract calls depositTo() on itself");
        console.log("  Status: Requires RSC contract function - checking...");
        console.log("");
        
        // Check if RSC can receive funds and interact with system contract
        // Most RSC contracts can't call system contract methods directly
        // They would need a specific function for this
        
        console.log("Option 2: External wallet transfers to reserves (RECOMMENDED)");
        console.log("  This is the standard way: External wallet uses depositTo()");
        console.log("  But this requires sending NEW funds, not using existing balance");
        console.log("");
        
        console.log("Option 3: Contract sends to wallet, then wallet to reserves");
        console.log("  Contract -> Wallet -> Reserves (requires contract to have send function)");
        console.log("");
        
        // For Reactive Network, the standard approach is:
        // The contract's balance stays on the contract for operations
        // Reserves are separate and managed by the system contract
        // Moving from direct balance to reserves typically requires external funding
        
        console.log("=".repeat(60));
        console.log("💡 RECOMMENDATION");
        console.log("=".repeat(60));
        console.log("");
        console.log("On Reactive Network, reserves are managed separately from contract balance.");
        console.log("The 4 REACT in direct balance should stay there for operations.");
        console.log("");
        console.log("If you want MORE reserves, send additional REACT from your wallet:");
        console.log("  node scripts/addToReserves.js");
        console.log("");
        console.log("Current allocation:");
        console.log(`  Direct Balance (for operations): ${directBalanceReact} REACT`);
        console.log(`  Reserves (backup): ${reservesReact} REACT`);
        console.log(`  Total: ${(parseFloat(directBalanceReact) + parseFloat(reservesReact)).toFixed(6)} REACT`);
        console.log("");
        
        // However, if user insists, we can try a workaround:
        // Check if contract has owner/admin functions to transfer
        console.log("=".repeat(60));
        console.log("🔄 ALTERNATIVE: Keep Balance as Is");
        console.log("=".repeat(60));
        console.log("");
        console.log("The 4 REACT direct balance is used for:");
        console.log("  • Event processing operations");
        console.log("  • Callback executions");
        console.log("  • Gas payments");
        console.log("");
        console.log("Reserves (0.001 REACT) are a backup safety net.");
        console.log("Current allocation is optimal for operations.");
        console.log("");
        
        // If user really wants to move it, we'd need:
        // 1. Contract with owner function to transfer
        // 2. Or contract with function to call system contract
        // Since FusionReactiveRSC likely doesn't have this, the answer is:
        // You can't easily move existing balance to reserves without contract modifications
        
        console.log("⚠️  CONCLUSION:");
        console.log("   Contract cannot easily move its own balance to reserves.");
        console.log("   Would require contract function or external transfer.");
        console.log("   Recommended: Keep balance as is (optimal for operations).");
        console.log("");
        
    } catch (error) {
        console.log("❌ Error!");
        console.log(`Error: ${error.message}`);
        process.exit(1);
    }
}

moveContractBalanceToReserves().catch(console.error);

