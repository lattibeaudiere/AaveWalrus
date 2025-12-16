const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const TX_HASH = "0xdbc44ed9cf96feecf06fa36bb11daeb34291d6297d0a58d6a42388ac25ef945f";

async function checkTransaction() {
    const provider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    console.log("Checking transaction:", TX_HASH);
    console.log("");
    
    try {
        const receipt = await provider.getTransactionReceipt(TX_HASH);
        
        console.log("Transaction Status:", receipt.status === 1 ? "✅ Success" : "❌ Failed");
        console.log("Gas Used:", receipt.gasUsed.toString());
        console.log("Block:", receipt.blockNumber);
        
        if (receipt.status === 0) {
            console.log("");
            console.log("⚠️  Transaction Reverted");
            console.log("");
            console.log("To see the revert reason:");
            console.log("1. Go to: https://arbiscan.io/tx/" + TX_HASH);
            console.log("2. Click 'Click to see More'");
            console.log("3. Check the 'Revert Reason' section");
            console.log("");
        }
        
        // Try to decode revert reason using trace
        console.log("Attempting to get revert reason...");
        try {
            // Use debug_traceTransaction if available
            const trace = await provider.send("debug_traceTransaction", [TX_HASH, {
                tracer: "callTracer",
                tracerConfig: {
                    onlyTopCall: false
                }
            }]);
            
            console.log("Trace received - checking for revert...");
            if (trace.error) {
                console.log("Error in trace:", trace.error);
            }
        } catch (e) {
            console.log("Could not get trace (may require archive node)");
        }
        
    } catch (error) {
        console.log("Error:", error.message);
    }
    
    console.log("");
    console.log("Arbiscan Link:");
    console.log("https://arbiscan.io/tx/" + TX_HASH);
    console.log("");
}

checkTransaction().catch(console.error);

