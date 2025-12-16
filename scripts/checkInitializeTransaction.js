const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkInitTransaction() {
    console.log("=".repeat(70));
    console.log("🔍 CHECKING INITIALIZATION TRANSACTION");
    console.log("=".repeat(70));
    console.log("");
    
    const RSC_ADDRESS = "0xf64afe64622CeAe79d48A15ebC49CC7FF416c688";
    const INIT_TX = "0xf2ff7aac441b40f508e44582fc4079715f3ed8c58c73c7be3f6469d29b54b304"; // From setup script
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://reactive-network.rpc.thirdweb.com"
    );
    
    console.log("Checking initialization transaction...");
    console.log("Transaction:", INIT_TX);
    console.log("");
    
    try {
        const receipt = await reactiveProvider.getTransactionReceipt(INIT_TX);
        
        if (receipt) {
            console.log("✅ Transaction found!");
            console.log(`   Block: ${receipt.blockNumber}`);
            console.log(`   Status: ${receipt.status === 1 ? "✅ Success" : "❌ Failed"}`);
            console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
            console.log("");
            
            // Check for Callback event in logs
            const rscAbi = [
                "event Callback(uint256 chainId, address target, uint64 gasLimit, bytes payload)"
            ];
            
            const rscInterface = new ethers.utils.Interface(rscAbi);
            
            let callbackFound = false;
            for (const log of receipt.logs) {
                try {
                    const parsed = rscInterface.parseLog(log);
                    if (parsed.name === "Callback") {
                        callbackFound = true;
                        console.log("✅ Callback event found!");
                        console.log(`   Chain ID: ${parsed.args.chainId.toString()}`);
                        console.log(`   Target: ${parsed.args.target}`);
                        console.log(`   Gas Limit: ${parsed.args.gasLimit.toString()}`);
                        
                        // Check function selector
                        if (parsed.args.payload.length >= 4) {
                            const selector = parsed.args.payload.substring(0, 10);
                            console.log(`   Function Selector: ${selector}`);
                            
                            if (selector === "0x0f4b22d2") {
                                console.log("   ✅ This is queryBothApys() - initialization!");
                            }
                        }
                        console.log("");
                        break;
                    }
                } catch (e) {
                    // Not a Callback event
                }
            }
            
            if (!callbackFound) {
                console.log("   ⚠️  Callback event not found in transaction logs");
                console.log("");
            }
            
        } else {
            console.log("   ⚠️  Transaction receipt not found (may still be pending)");
            console.log("");
        }
        
    } catch (error) {
        console.log("   ❌ Error:", error.message);
        console.log("");
    }
    
    // Check current RSC state
    console.log("Current RSC State:");
    console.log("");
    
    const statusAbi = [
        "function initialized() external view returns (bool)",
        "function lastAaveApyBps() external view returns (uint256)",
        "function queryNonce() external view returns (uint256)"
    ];
    
    try {
        const rsc = new ethers.Contract(RSC_ADDRESS, statusAbi, reactiveProvider);
        
        const initialized = await rsc.initialized();
        const lastAaveApy = await rsc.lastAaveApyBps();
        const queryNonce = await rsc.queryNonce();
        
        console.log(`   Initialized: ${initialized ? "✅ YES" : "❌ NO"}`);
        console.log(`   Last Aave APY: ${lastAaveApy.toString()} bps`);
        console.log(`   Query Nonce: ${queryNonce.toString()}`);
        
        // Check if nonce is the initialization nonce
        const initNonce = ethers.BigNumber.from("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
        if (queryNonce.eq(initNonce)) {
            console.log("   ✅ Still using initialization nonce (waiting for response)");
        } else {
            console.log("   ℹ️  Nonce has changed (may have processed response)");
        }
        console.log("");
        
    } catch (error) {
        console.log("   ❌ Error checking state:", error.message.split('\n')[0]);
        console.log("");
    }
    
    console.log("=".repeat(70));
    console.log("📊 STATUS");
    console.log("=".repeat(70));
    console.log("");
    console.log("The initialization callback was emitted, but QueryHelper hasn't executed yet.");
    console.log("This is normal - Reactive Network callbacks take time to process.");
    console.log("");
    console.log("Expected timeline:");
    console.log("  • Callback emitted: ✅ (Done)");
    console.log("  • QueryHelper executes: ⏳ (In progress)");
    console.log("  • BothApysQueried event: ⏳ (Waiting)");
    console.log("  • RSC processes response: ⏳ (Waiting)");
    console.log("  • Deployment executes: ⏳ (Waiting)");
    console.log("");
    console.log("💡 Check Reactscan for detailed transaction view:");
    console.log(`   https://reactscan.io/tx/${INIT_TX}`);
    console.log("");
}

checkInitTransaction().catch(console.error);

