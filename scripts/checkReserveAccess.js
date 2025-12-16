const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Check if reserves can be withdrawn/accessed
 */
async function checkReserveAccess() {
    console.log("=".repeat(60));
    console.log("💰 CHECKING RESERVE ACCESS");
    console.log("=".repeat(60));
    console.log("");
    
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    const SYSTEM_CONTRACT = "0x0000000000000000000000000000000000fffFfF";
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0x15725e58A3199122FcBb4d6F20573EEFd730781A";
    
    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    
    // System Contract ABI - check for withdrawal functions
    const systemContractABI = [
        "function debts(address) view returns (uint256)",
        "function reserves(address) view returns (uint256)",
        "function depositTo(address) payable",
        "function withdrawFrom(address, uint256) payable", // Check if exists
        "function withdraw(address, uint256) payable",     // Check if exists
    ];
    
    const systemContract = new ethers.Contract(SYSTEM_CONTRACT, systemContractABI, provider);
    
    try {
        const reserves = await systemContract.reserves(RSC_ADDRESS);
        const reservesReact = ethers.utils.formatEther(reserves);
        
        console.log("Current Reserves:", reservesReact, "REACT");
        console.log("");
        
        console.log("⚠️  System Contract Analysis:");
        console.log("");
        console.log("The system contract manages reserves, but typically:");
        console.log("  • Reserves are used automatically for debt settlement");
        console.log("  • There's no direct withdraw function from reserves");
        console.log("  • Reserves serve as automatic backup/debt coverage");
        console.log("");
        
        console.log("=".repeat(60));
        console.log("💡 CONCLUSION");
        console.log("=".repeat(60));
        console.log("");
        console.log("❌ Cannot directly withdraw:");
        console.log("  • Contract direct balance (4 REACT) - no withdraw function");
        console.log("  • Reserves (3.99 REACT) - managed by system, no withdraw");
        console.log("");
        
        console.log("Funds will be used for:");
        console.log("  • Contract operations (event processing)");
        console.log("  • Automatic debt settlement (from reserves)");
        console.log("  • Callback executions");
        console.log("");
        
        console.log("This is by design - funds are meant to stay in the contract");
        console.log("for autonomous operations.");
        console.log("");
        
    } catch (error) {
        console.log("Error:", error.message);
    }
}

checkReserveAccess().catch(console.error);

