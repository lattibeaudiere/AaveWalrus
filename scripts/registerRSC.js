const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Register RSC in Adapter
 * This should be done after RSC is deployed
 */
async function main() {
    console.log("=".repeat(60));
    console.log("REGISTERING RSC IN ADAPTER");
    console.log("=".repeat(60));
    console.log("");
    
    const ARBITRUM_RPC = process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc";
    const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.ARBITRUM_PRIVATE_KEY;
    const ADAPTER_ADDRESS = process.env.ADAPTER_ADDRESS;
    const RSC_ADDRESS = process.env.RSC_ADDRESS;
    
    if (!PRIVATE_KEY) {
        throw new Error("PRIVATE_KEY or ARBITRUM_PRIVATE_KEY must be set");
    }
    
    if (!ADAPTER_ADDRESS) {
        throw new Error("ADAPTER_ADDRESS must be set in .env");
    }
    
    if (!RSC_ADDRESS) {
        throw new Error("RSC_ADDRESS must be set in .env (deploy RSC first)");
    }
    
    const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    console.log("Configuration:");
    console.log(`  Adapter: ${ADAPTER_ADDRESS}`);
    console.log(`  RSC: ${RSC_ADDRESS}`);
    console.log(`  Signer: ${wallet.address}`);
    console.log("");
    
    // Adapter ABI
    const adapterABI = [
        "function registerRSC(address rsc, string calldata description) external",
        "function isRSCRegistered(address rsc) external view returns (bool)",
        "function rscConfigs(address rsc) external view returns (address vault, uint256 targetChainId, bool isActive, uint256 lastExecution, uint256 executionCount)"
    ];
    
    const adapter = new ethers.Contract(ADAPTER_ADDRESS, adapterABI, wallet);
    
    // Check if already registered
    try {
        const isRegistered = await adapter.isRSCRegistered(RSC_ADDRESS);
        if (isRegistered) {
            console.log("✅ RSC already registered in adapter");
            
            const config = await adapter.rscConfigs(RSC_ADDRESS);
            console.log("\nCurrent Configuration:");
            console.log(`  Vault: ${config.vault}`);
            console.log(`  Target Chain: ${config.targetChainId}`);
            console.log(`  Active: ${config.isActive ? "Yes" : "No"}`);
            console.log(`  Last Execution: ${config.lastExecution.toString()}`);
            console.log(`  Execution Count: ${config.executionCount.toString()}`);
            return;
        }
    } catch (error) {
        console.log(`⚠️  Could not check registration: ${error.message}`);
    }
    
    console.log("Registering RSC in adapter...");
    console.log("-".repeat(60));
    
    try {
        const description = "IPOR Fusion Yield Optimizer - Autonomous Aave/Compound APY Optimizer";
        const tx = await adapter.registerRSC(RSC_ADDRESS, description, {
            gasLimit: 500000
        });
        
        console.log(`\n  Transaction hash: ${tx.hash}`);
        console.log(`  Waiting for confirmation...`);
        
        const receipt = await tx.wait();
        
        console.log("\n" + "=".repeat(60));
        console.log("✅ REGISTRATION SUCCESSFUL");
        console.log("=".repeat(60));
        console.log(`\nTransaction Hash: ${tx.hash}`);
        console.log(`Block: ${receipt.blockNumber}`);
        console.log(`Gas Used: ${receipt.gasUsed.toString()}`);
        console.log("");
        console.log("RSC is now registered and active in adapter");
        console.log("");
        console.log("🔗 View on Arbiscan:");
        console.log(`   https://arbiscan.io/address/${ADAPTER_ADDRESS}`);
        console.log("");
        
    } catch (error) {
        console.log("\n❌ Registration failed!");
        console.log(`Error: ${error.message}`);
        
        if (error.reason) {
            console.log(`Reason: ${error.reason}`);
        }
        
        if (error.transaction) {
            console.log(`Transaction hash: ${error.transaction.hash}`);
        }
        
        throw error;
    }
}

main().catch(console.error);

