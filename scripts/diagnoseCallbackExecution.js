const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function diagnoseCallback() {
    console.log("=".repeat(70));
    console.log("🔍 DIAGNOSING CALLBACK EXECUTION");
    console.log("=".repeat(70));
    console.log("");
    
    const RSC_ADDRESS = "0xf64afe64622CeAe79d48A15ebC49CC7FF416c688";
    const QUERY_HELPER = process.env.QUERY_HELPER_ADDRESS || "0x05b402e333974134689424F13f01BC31F8fbfF56";
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://reactive-network.rpc.thirdweb.com"
    );
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    // Check RSC Callback events
    console.log("1️⃣  Checking RSC Callback Events:");
    console.log("");
    
    const rscAbi = [
        "event Callback(uint256 chainId, address target, uint64 gasLimit, bytes payload)"
    ];
    
    const rsc = new ethers.Contract(RSC_ADDRESS, rscAbi, reactiveProvider);
    
    try {
        const currentBlock = await reactiveProvider.getBlockNumber();
        const callbackEvents = await rsc.queryFilter(
            rsc.filters.Callback(),
            Math.max(0, currentBlock - 2000)
        );
        
        console.log(`   Found ${callbackEvents.length} Callback events`);
        console.log("");
        
        if (callbackEvents.length > 0) {
            for (let i = 0; i < callbackEvents.length; i++) {
                const event = callbackEvents[i];
                const decoded = rsc.interface.decodeEventLog(
                    "Callback",
                    event.data,
                    event.topics
                );
                
                console.log(`   Callback #${i + 1}:`);
                console.log(`     Chain ID: ${decoded.chainId.toString()}`);
                console.log(`     Target: ${decoded.target}`);
                console.log(`     Gas Limit: ${decoded.gasLimit.toString()}`);
                console.log(`     Block: ${event.blockNumber}`);
                console.log(`     Transaction: ${event.transactionHash}`);
                
                // Decode payload to see what function is being called
                if (decoded.payload.length >= 4) {
                    const functionSelector = decoded.payload.substring(0, 10);
                    console.log(`     Function Selector: ${functionSelector}`);
                    
                    if (functionSelector === "0x0f4b22d2") {
                        console.log("     ✅ This is queryBothApys() - initialization callback!");
                        
                        // Decode nonce
                        try {
                            const nonceData = ethers.utils.defaultAbiCoder.decode(
                                ["uint256"],
                                "0x" + decoded.payload.substring(10)
                            );
                            const nonce = nonceData[0];
                            console.log(`     Nonce: ${nonce.toString()}`);
                            
                            if (nonce.toString() === "115792089237316195423570985008687907853269984665640564039457584007913129639935") {
                                console.log("     ✅ This is the initialization nonce (type(uint256).max)");
                            }
                        } catch (e) {
                            console.log("     ⚠️  Could not decode nonce");
                        }
                    } else if (functionSelector === "0xa9059cbb" || functionSelector.startsWith("0x")) {
                        console.log(`     Function: ${functionSelector === "0xa9059cbb" ? "transfer" : "unknown"}`);
                    }
                }
                console.log("");
            }
        } else {
            console.log("   ⚠️  No Callback events found");
            console.log("   This means initializeStrategy() may not have been called");
            console.log("");
        }
    } catch (error) {
        console.log("   ❌ Error:", error.message.split('\n')[0]);
        console.log("");
    }
    
    // Check if QueryHelper has received any calls
    console.log("2️⃣  Checking QueryHelper Transactions:");
    console.log("");
    
    try {
        const arbBlock = await arbitrumProvider.getBlockNumber();
        
        // Check recent transactions to QueryHelper
        const queryHelperCode = await arbitrumProvider.getCode(QUERY_HELPER);
        if (queryHelperCode === "0x") {
            console.log("   ❌ QueryHelper contract doesn't exist!");
        } else {
            console.log("   ✅ QueryHelper contract exists");
            
            // Try to check if queryBothApys was called by looking at recent blocks
            // This is approximate - we'd need to check transaction receipts
            console.log("   Checking recent blocks for QueryHelper activity...");
            console.log("");
            
            // Check for any events emitted by QueryHelper
            const allEventsAbi = [
                "event BothApysQueried(uint256 indexed nonce, uint256 aaveApyBps, uint256 compoundApyBps, uint256 timestamp)",
                "event CompoundApyQueried(uint256 indexed nonce, uint256 apyBps, uint256 timestamp)"
            ];
            
            const queryHelperWithAllEvents = new ethers.Contract(QUERY_HELPER, allEventsAbi, arbitrumProvider);
            
            const bothApys = await queryHelperWithAllEvents.queryFilter(
                queryHelperWithAllEvents.filters.BothApysQueried(),
                Math.max(0, arbBlock - 10000)
            );
            
            const compoundApys = await queryHelperWithAllEvents.queryFilter(
                queryHelperWithAllEvents.filters.CompoundApyQueried(),
                Math.max(0, arbBlock - 10000)
            );
            
            console.log(`   BothApysQueried events: ${bothApys.length}`);
            console.log(`   CompoundApyQueried events: ${compoundApys.length}`);
            
            if (bothApys.length === 0 && compoundApys.length === 0) {
                console.log("");
                console.log("   ⚠️  No QueryHelper events found");
                console.log("   The callback may not have executed yet");
                console.log("   Reactive Network callbacks can take some time");
            }
        }
    } catch (error) {
        console.log("   ❌ Error:", error.message.split('\n')[0]);
    }
    
    console.log("");
    
    // Check RSC status
    console.log("3️⃣  Checking RSC Contract Status:");
    console.log("");
    
    const statusAbi = [
        "function getContractStatus() external view returns (uint256 directBalance, uint256 reserves, uint256 debt, bool isActive, bool aaveSub, bool compoundSub, bool queryHelperSub, uint256 lastAaveApy, uint256 cooldownRemaining)",
        "function initialized() external view returns (bool)"
    ];
    
    try {
        const rscStatus = new ethers.Contract(RSC_ADDRESS, statusAbi, reactiveProvider);
        const status = await rscStatus.getContractStatus();
        const initialized = await rscStatus.initialized();
        
        console.log(`   Active: ${status[3] ? "✅" : "❌"}`);
        console.log(`   Aave Subscribed: ${status[4] ? "✅" : "❌"}`);
        console.log(`   QueryHelper Subscribed: ${status[6] ? "✅" : "❌"}`);
        console.log(`   Initialized: ${initialized ? "✅" : "❌"}`);
        console.log(`   Last Aave APY: ${status[7].toString()} bps`);
        console.log("");
        
        if (!status[3]) {
            console.log("   ⚠️  RSC is NOT active - may not process callbacks");
        }
        if (!initialized) {
            console.log("   ⚠️  RSC is NOT initialized - initializeStrategy() may have failed");
        }
    } catch (error) {
        console.log("   ❌ Error:", error.message.split('\n')[0]);
    }
    
    console.log("");
    console.log("=".repeat(70));
    console.log("💡 DIAGNOSIS");
    console.log("=".repeat(70));
    console.log("");
    console.log("If Callback events exist but QueryHelper events don't:");
    console.log("  • Reactive Network may still be processing the callback");
    console.log("  • There may be a delay in cross-chain execution");
    console.log("  • Check Reactscan for RSC transaction details");
    console.log("");
    console.log("If no Callback events exist:");
    console.log("  • initializeStrategy() may have failed");
    console.log("  • Check if RSC is active and has proper permissions");
    console.log("");
}

diagnoseCallback().catch(console.error);

