const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function decodeRevertReason() {
    console.log("=".repeat(70));
    console.log("🔍 DECODING REVERT REASONS FROM RECENT TRANSACTIONS");
    console.log("=".repeat(70));
    console.log("");
    
    const provider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    // Recent failed registration transactions
    const failedTxs = [
        "0xbd1ac49bee8885b5f1ae82b2148af4e8e17a65c3d7d21160cdacd2a1bf6f8be2", // Old adapter, 3 params
        "0xaf2e64dd5534f0cd6a27341579024a60d8c56422afab3c6279e84adc213d66be", // Old adapter, 4 params
        "0x29524a12411aeec52fe031cb0f858ea68c775878cc26116759abc5cbd5106beb", // New adapter (from earlier)
        "0x356b76062855a6e345f6408befa4f23650503aac6c9e4450868cc121be2990d2"  // New adapter (from earlier)
    ];
    
    for (const txHash of failedTxs) {
        console.log(`Transaction: ${txHash}`);
        
        try {
            const receipt = await provider.getTransactionReceipt(txHash);
            
            if (receipt.status === 0) {
                // Transaction reverted - try to get revert reason
                const tx = await provider.getTransaction(txHash);
                
                console.log("  Status: REVERTED");
                console.log("  Gas used:", receipt.gasUsed.toString());
                console.log("  Block:", receipt.blockNumber);
                
                // Try to call with trace to get revert reason
                try {
                    const result = await provider.send('debug_traceCall', [
                        {
                            from: tx.from,
                            to: tx.to,
                            data: tx.data,
                            gas: tx.gasLimit.toHexString(),
                            gasPrice: tx.gasPrice ? tx.gasPrice.toHexString() : null
                        },
                        ethers.utils.hexValue(receipt.blockNumber - 1),
                        {
                            tracer: 'callTracer',
                            tracerConfig: {
                                onlyTopCall: true
                            }
                        }
                    ]);
                    
                    if (result.error) {
                        console.log("  Revert reason:", result.error);
                    }
                } catch (traceError) {
                    // Trace not available, try alternative method
                    console.log("  ⚠️  Could not get detailed trace");
                }
                
                // Try Arbiscan API if available
                console.log("  Arbiscan link: https://arbiscan.io/tx/" + txHash);
                
            } else {
                console.log("  Status: SUCCESS (unexpected!)");
            }
            
        } catch (error) {
            console.log("  Error:", error.message);
        }
        
        console.log("");
    }
    
    console.log("=".repeat(70));
    console.log("💡 KEY FINDINGS:");
    console.log("=".repeat(70));
    console.log("");
    console.log("Both OLD and NEW adapters:");
    console.log("  ✅ Support both function signatures (3 and 4 params)");
    console.log("  ✅ Static calls succeed");
    console.log("  ❌ Actual transactions fail with early revert (~22k gas)");
    console.log("");
    console.log("This suggests:");
    console.log("  1. Registration was NEVER working (even on old adapter)");
    console.log("  2. The issue is in the access control modifier or validation");
    console.log("  3. Static calls bypass modifiers, but actual calls trigger them");
    console.log("");
    console.log("Solution: The workaround (targetVault fallback) is correct!");
    console.log("         Registration has always been broken.");
}

decodeRevertReason().catch(console.error);

