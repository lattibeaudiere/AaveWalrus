const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function debugFailedCallback() {
    console.log("=".repeat(70));
    console.log("🔍 DEBUGGING FAILED CALLBACK TRANSACTION");
    console.log("=".repeat(70));
    console.log("");
    
    const CALLBACK_TX = "0x6ff14601f09916bd45c9c6fbda17cad86ba7d9dbac15dc22b1f071a68fadf1b1";
    const QUERY_HELPER = "0x05b402e333974134689424F13f01BC31F8fbfF56";
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    console.log("Transaction:", CALLBACK_TX);
    console.log("");
    
    try {
        // Get transaction receipt
        const receipt = await arbitrumProvider.getTransactionReceipt(CALLBACK_TX);
        
        if (!receipt) {
            console.log("⚠️  Transaction receipt not found (may be pending)");
            return;
        }
        
        console.log("Transaction Status:", receipt.status === 1 ? "✅ Success" : "❌ Failed");
        console.log("Block:", receipt.blockNumber);
        console.log("Gas Used:", receipt.gasUsed.toString());
        console.log("");
        
        if (receipt.status === 0) {
            console.log("❌ TRANSACTION FAILED");
            console.log("");
            
            // Try to get the transaction to see what was called
            const tx = await arbitrumProvider.getTransaction(CALLBACK_TX);
            console.log("From:", tx.from);
            console.log("To:", tx.to);
            console.log("Data:", tx.data);
            console.log("");
            
            // Try to decode the call
            if (tx.to && tx.to.toLowerCase() === QUERY_HELPER.toLowerCase()) {
                console.log("✅ Target is QueryHelper");
                console.log("");
                
                // Decode function call
                const queryHelperAbi = [
                    "function queryCompoundApy(uint256 nonce) external returns (uint256 apyBps)",
                    "function queryBothApys(uint256 nonce) external returns (uint256 aaveApyBps, uint256 compoundApyBps)"
                ];
                
                try {
                    const iface = new ethers.utils.Interface(queryHelperAbi);
                    const decoded = iface.parseTransaction({ data: tx.data });
                    
                    console.log("Function called:", decoded.name);
                    console.log("Parameters:", decoded.args);
                    console.log("");
                } catch (error) {
                    console.log("⚠️  Could not decode function call");
                    console.log("");
                }
            }
            
            // Try to get revert reason
            console.log("Attempting to get revert reason...");
            console.log("");
            
            try {
                // Try to call the transaction with trace
                const code = await arbitrumProvider.getCode(QUERY_HELPER);
                if (code === "0x") {
                    console.log("❌ QueryHelper contract doesn't exist!");
                } else {
                    console.log("✅ QueryHelper contract exists");
                }
                console.log("");
            } catch (error) {
                console.log("Error:", error.message);
            }
            
            // Check if it's a gas issue
            console.log("Possible failure reasons:");
            console.log("  1. Out of gas");
            console.log("  2. Function revert");
            console.log("  3. Contract call failed");
            console.log("  4. Invalid parameters");
            console.log("");
            
        } else {
            console.log("✅ Transaction succeeded!");
            console.log("");
            
            // Check for events
            const queryHelperAbi = [
                "event BothApysQueried(uint256 indexed nonce, uint256 aaveApyBps, uint256 compoundApyBps, uint256 timestamp)",
                "event CompoundApyQueried(uint256 indexed nonce, uint256 apyBps, uint256 timestamp)"
            ];
            
            const queryHelper = new ethers.Contract(QUERY_HELPER, queryHelperAbi, arbitrumProvider);
            
            for (const log of receipt.logs) {
                if (log.address.toLowerCase() === QUERY_HELPER.toLowerCase()) {
                    try {
                        const parsed = queryHelper.interface.parseLog(log);
                        console.log(`✅ Event: ${parsed.name}`);
                        console.log(`   Args:`, parsed.args);
                        console.log("");
                    } catch (error) {
                        // Not a QueryHelper event
                    }
                }
            }
        }
        
        // Check transaction trace if available
        console.log("Checking transaction trace...");
        console.log("");
        
        try {
            // Some RPCs support trace calls
            const trace = await arbitrumProvider.send("debug_traceTransaction", [CALLBACK_TX]);
            if (trace && trace.error) {
                console.log("Revert reason:", trace.error);
            }
        } catch (error) {
            console.log("⚠️  Could not get trace (RPC may not support it)");
            console.log("");
        }
        
    } catch (error) {
        console.log("❌ Error:", error.message);
        console.log("");
    }
    
    console.log("=".repeat(70));
    console.log("💡 DIAGNOSIS");
    console.log("=".repeat(70));
    console.log("");
    console.log("The callback transaction failed, which means:");
    console.log("  • QueryHelper was not successfully called");
    console.log("  • No APY data was queried");
    console.log("  • RSC never received the response");
    console.log("  • No deployment occurred");
    console.log("");
    console.log("This explains why capital hasn't been deployed.");
    console.log("");
    console.log("Next steps:");
    console.log("  1. Check Arbiscan for the failed transaction details");
    console.log("  2. Look for revert reason in transaction logs");
    console.log("  3. Verify QueryHelper contract is working");
    console.log("  4. Check if gas limit was sufficient");
    console.log("");
    console.log(`🔗 Transaction: https://arbiscan.io/tx/${CALLBACK_TX}`);
    console.log("");
}

debugFailedCallback().catch(console.error);

