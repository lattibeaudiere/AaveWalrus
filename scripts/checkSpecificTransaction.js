const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Check a specific Reactive Network transaction to see what happened
 * Use this with a transaction hash from Reactscan
 */

async function checkTransaction(txHash) {
    if (!txHash) {
        console.log("Usage: node scripts/checkSpecificTransaction.js <TX_HASH>");
        console.log("\nExample transaction from Reactscan:");
        console.log("  0x03ad8a...4788cd30");
        process.exit(1);
    }
    
    console.log("=".repeat(70));
    console.log("🔍 ANALYZING SPECIFIC TRANSACTION");
    console.log("=".repeat(70));
    console.log("");
    console.log("Transaction:", txHash);
    console.log("");
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev"
    );
    
    try {
        const tx = await reactiveProvider.getTransaction(txHash);
        const receipt = await reactiveProvider.getTransactionReceipt(txHash);
        
        console.log("Transaction Details:");
        console.log("  From:", tx.from);
        console.log("  To:", tx.to);
        console.log("  Status:", receipt.status === 1 ? "✅ Success" : "❌ Failed");
        console.log("  Gas Used:", receipt.gasUsed.toString());
        console.log("  Block:", receipt.blockNumber);
        console.log("");
        
        console.log("Logs:", receipt.logs.length);
        
        // Parse logs
        const RSC_ADDRESS = process.env.RSC_ADDRESS || "0x64030389Fb91D86F92314503aAe57827826c8F4e";
        
        for (let i = 0; i < receipt.logs.length; i++) {
            const log = receipt.logs[i];
            if (log.address.toLowerCase() === RSC_ADDRESS.toLowerCase()) {
                console.log(`\n  Log ${i + 1} (from RSC):`);
                console.log("    Topics:", log.topics.length);
                console.log("    Data length:", log.data.length, "bytes");
                
                // Try to identify event
                if (log.topics.length > 0) {
                    const topic0 = log.topics[0];
                    console.log("    Topic0:", topic0);
                    
                    // Check for known events
                    const ReactHandled = ethers.utils.id("ReactHandled(uint256,address,uint256,uint256)");
                    const Callback = ethers.utils.id("Callback(uint256,address,uint64,bytes)");
                    const StrategyUpdate = ethers.utils.id("StrategyUpdate(uint256,uint256,uint256,bool)");
                    
                    if (topic0.toLowerCase() === ReactHandled.toLowerCase()) {
                        console.log("    ✅ ReactHandled event");
                    } else if (topic0.toLowerCase() === Callback.toLowerCase()) {
                        console.log("    ✅ Callback event");
                    } else if (topic0.toLowerCase() === StrategyUpdate.toLowerCase()) {
                        console.log("    ✅ StrategyUpdate event");
                    }
                }
            }
        }
        
        if (receipt.status === 0) {
            console.log("\n⚠️  TRANSACTION REVERTED!");
            console.log("   Check revert reason in transaction trace");
            console.log("\n   To debug:");
            console.log("   1. Go to Reactscan");
            console.log("   2. View transaction:", txHash);
            console.log("   3. Check transaction trace for revert reason");
        }
        
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

const txHash = process.argv[2];
checkTransaction(txHash).catch(console.error);

