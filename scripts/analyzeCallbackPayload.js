const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function analyzeCallbackPayload() {
    console.log("=".repeat(70));
    console.log("🔍 ANALYZING CALLBACK PAYLOAD");
    console.log("=".repeat(70));
    console.log("");
    
    const QUERY_HELPER = "0x05b402e333974134689424F13f01BC31F8fbfF56";
    
    // From the user's message - the callback payload
    const payload = "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000024cb3dd0fd00000000000000000000000000000000000000000000000000000000000000ab00000000000000000000000000000000000000000000000000000000";
    
    console.log("Payload:", payload);
    console.log("");
    
    // Decode the payload
    const queryHelperAbi = [
        "function queryCompoundApy(uint256 nonce) external returns (uint256 apyBps)",
        "function queryBothApys(uint256 nonce) external returns (uint256 aaveApyBps, uint256 compoundApyBps)"
    ];
    
    try {
        const iface = new ethers.utils.Interface(queryHelperAbi);
        
        // The payload appears to be ABI-encoded function call data
        // Try to extract the function selector and parameters
        const functionSelector = payload.substring(0, 10);
        console.log("Function Selector:", functionSelector);
        console.log("");
        
        // 0xcb3dd0fd = queryCompoundApy(uint256)
        if (functionSelector === "0xcb3dd0fd") {
            console.log("✅ Function: queryCompoundApy(uint256)");
            
            // Extract the nonce parameter
            const nonceData = "0x" + payload.substring(10);
            const nonce = ethers.BigNumber.from(nonceData);
            
            console.log("Nonce:", nonce.toString());
            console.log("");
            
            // Now test if this call would work
            console.log("Testing QueryHelper call...");
            console.log("");
            
            const arbitrumProvider = new ethers.providers.JsonRpcProvider(
                process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
            );
            
            try {
                const queryHelper = new ethers.Contract(QUERY_HELPER, queryHelperAbi, arbitrumProvider);
                
                // Try to call it (read-only via callStatic)
                console.log("Attempting static call...");
                const result = await queryHelper.callStatic.queryCompoundApy(nonce);
                console.log("✅ Call succeeded!");
                console.log("APY:", result.toString(), "bps");
                console.log("");
                
            } catch (error) {
                console.log("❌ Call failed!");
                console.log("Error:", error.message);
                console.log("");
                
                // Check if contract exists
                const code = await arbitrumProvider.getCode(QUERY_HELPER);
                if (code === "0x") {
                    console.log("❌ QueryHelper contract doesn't exist!");
                } else {
                    console.log("✅ QueryHelper contract exists");
                    console.log("");
                    
                    // Try to call the view function
                    try {
                        const queryHelper = new ethers.Contract(QUERY_HELPER, queryHelperAbi, arbitrumProvider);
                        const viewResult = await queryHelper.getCompoundApy();
                        console.log("✅ View function works!");
                        console.log("APY:", viewResult.toString(), "bps");
                        console.log("");
                        
                        console.log("💡 The issue might be:");
                        console.log("   • queryCompoundApy() requires state changes (emits event)");
                        console.log("   • Reactive Network relayer may not have proper permissions");
                        console.log("   • Or there's a revert in the function");
                        console.log("");
                    } catch (viewError) {
                        console.log("❌ Even view function failed!");
                        console.log("Error:", viewError.message);
                        console.log("");
                    }
                }
            }
            
        } else {
            console.log("⚠️  Unknown function selector");
        }
        
    } catch (error) {
        console.log("Error decoding:", error.message);
    }
    
    console.log("=".repeat(70));
    console.log("💡 DIAGNOSIS");
    console.log("=".repeat(70));
    console.log("");
    console.log("The callback is calling queryCompoundApy() with nonce 171.");
    console.log("");
    console.log("Possible failure reasons:");
    console.log("  1. QueryHelper.queryCompoundApy() reverts");
    console.log("  2. Reactive Network relayer doesn't have proper setup");
    console.log("  3. Gas limit issue");
    console.log("  4. Contract state issue");
    console.log("");
    console.log("Next steps:");
    console.log("  1. Check QueryHelper contract source on Arbiscan");
    console.log("  2. Test queryCompoundApy() directly");
    console.log("  3. Check if Reactive Network relayer is configured correctly");
    console.log("");
}

analyzeCallbackPayload().catch(console.error);

