const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkQueryHelperCallback() {
    console.log("=".repeat(70));
    console.log("🔍 CHECKING QUERYHELPER CALLBACK FAILURE");
    console.log("=".repeat(70));
    console.log("");
    
    const QUERY_HELPER_ADDRESS = process.env.QUERY_HELPER_ADDRESS || "0x7D0B3A06aE0ceaf35B658579A1F5730D3539f914";
    const DEST_TX = "0xbc81613bc203be711611f3e4b93f557b52805189a79a2dd0838b5c5406f0b68f";
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    console.log("1️⃣  Analyzing Failed Transaction:");
    console.log("   Transaction:", DEST_TX);
    console.log("");
    
    try {
        const receipt = await arbitrumProvider.getTransactionReceipt(DEST_TX);
        
        if (!receipt) {
            console.log("   ⚠️  Transaction not found");
            return;
        }
        
        console.log("   Status:", receipt.status === 1 ? "✅ Success" : "❌ Failed");
        console.log("   Block:", receipt.blockNumber);
        console.log("   Gas Used:", receipt.gasUsed.toString());
        console.log("   From:", receipt.from);
        console.log("   To:", receipt.to);
        console.log("");
        
        // Check if it reached QueryHelper
        const queryHelperCode = await arbitrumProvider.getCode(QUERY_HELPER_ADDRESS);
        if (queryHelperCode === "0x") {
            console.log("   ❌ QueryHelper contract not found at this address!");
            return;
        }
        
        console.log("   ✅ QueryHelper contract exists");
        console.log("");
        
        // Get the transaction to see what was called
        const tx = await arbitrumProvider.getTransaction(DEST_TX);
        
        console.log("2️⃣  Transaction Details:");
        console.log("   To:", tx.to);
        console.log("   Data length:", tx.data.length, "bytes");
        console.log("   Data:", tx.data.substring(0, 66) + "...");
        console.log("");
        
        // Try to decode the function call
        const queryHelper = new ethers.Contract(
            QUERY_HELPER_ADDRESS,
            [
                "function queryCompoundApy(uint256 nonce) external returns (uint256 apyBps)"
            ],
            arbitrumProvider
        );
        
        try {
            // Try to decode the input
            const iface = queryHelper.interface;
            const decoded = iface.decodeFunctionData("queryCompoundApy", tx.data);
            console.log("   Function: queryCompoundApy");
            console.log("   Nonce:", decoded.nonce.toString());
            console.log("");
            
            // Try to call it manually to see what happens
            console.log("3️⃣  Testing QueryHelper Call:");
            try {
                const result = await queryHelper.callStatic.queryCompoundApy(decoded.nonce);
                console.log("   ✅ Call would succeed");
                console.log("   APY:", result.toString(), "bps");
            } catch (error) {
                console.log("   ❌ Call would fail:");
                console.log("   Error:", error.message.split('\n')[0]);
                
                // Check if it's a revert reason
                if (error.reason) {
                    console.log("   Revert Reason:", error.reason);
                }
                
                // Check if it's related to Compound
                if (error.message.includes("Compound") || error.message.includes("Comet")) {
                    console.log("   ⚠️  Compound contract issue");
                }
            }
        } catch (error) {
            console.log("   ⚠️  Could not decode function call");
            console.log("   Raw data:", tx.data);
        }
        
        // Check if it's a gas issue
        if (receipt.gasUsed.eq(receipt.cumulativeGasUsed)) {
            console.log("\n4️⃣  Gas Analysis:");
            console.log("   Gas Used:", receipt.gasUsed.toString());
            console.log("   ⚠️  Transaction used all available gas");
            console.log("   This suggests a revert or infinite loop");
        }
        
        // Check transaction trace if available
        console.log("\n5️⃣  Debugging Steps:");
        console.log("   To see exact revert reason:");
        console.log("   1. Go to Arbiscan:");
        console.log("      https://arbiscan.io/tx/" + DEST_TX);
        console.log("   2. Click 'Click to see More'");
        console.log("   3. Check 'Revert Reason' section");
        console.log("");
        
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
    
    // Also check QueryHelper contract code
    console.log("6️⃣  QueryHelper Contract Check:");
    try {
        const queryHelperCode = await arbitrumProvider.getCode(QUERY_HELPER_ADDRESS);
        console.log("   Code size:", queryHelperCode.length, "characters");
        
        if (queryHelperCode === "0x" || queryHelperCode.length < 100) {
            console.log("   ❌ QueryHelper appears to have no code!");
            console.log("   This would cause all calls to revert");
        } else {
            console.log("   ✅ QueryHelper has code");
        }
        
        // Check if QueryHelper can query Compound
        const queryHelper = new ethers.Contract(
            QUERY_HELPER_ADDRESS,
            [
                "function getCompoundApy() external view returns (uint256 apyBps)",
                "function COMPOUND_USDC() external view returns (address)"
            ],
            arbitrumProvider
        );
        
        try {
            const compoundAddr = await queryHelper.COMPOUND_USDC();
            console.log("   Compound USDC:", compoundAddr);
            
            // Try to get APY
            const apy = await queryHelper.getCompoundApy();
            console.log("   Current Compound APY:", apy.toString(), "bps");
            console.log("   ✅ QueryHelper can query Compound successfully");
        } catch (error) {
            console.log("   ❌ QueryHelper query failed:", error.message.split('\n')[0]);
            console.log("   This is likely why callbacks are reverting");
        }
    } catch (error) {
        console.log("   ❌ Error checking contract:", error.message.split('\n')[0]);
    }
    
    console.log("");
    console.log("=".repeat(70));
    console.log("📊 DIAGNOSIS");
    console.log("=".repeat(70));
    console.log("");
    console.log("Root Cause:");
    console.log("  QueryHelper callback is reverting on Arbitrum");
    console.log("");
    console.log("This prevents:");
    console.log("  • Compound APY queries");
    console.log("  • Strategy completion");
    console.log("  • Rebalance execution");
    console.log("  • Capital deployment");
    console.log("");
}

checkQueryHelperCallback().catch(console.error);

