const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function debugEventMatching() {
    console.log("=".repeat(70));
    console.log("🔍 DEBUGGING EVENT MATCHING");
    console.log("=".repeat(70));
    console.log("");
    
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0x64030389Fb91D86F92314503aAe57827826c8F4e";
    const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
    const RESERVE_DATA_UPDATED = "0x804c9b842b2748a22bb64b345453a3de7ca54a6ca45ce00d415894979e22897a";
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev"
    );
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    // Check what topic0 the RSC is subscribed to
    console.log("1️⃣  Subscription Parameters:");
    console.log("   Topic0 (expected):", RESERVE_DATA_UPDATED);
    console.log("   Contract (expected):", AAVE_POOL);
    console.log("   Topic1 (expected):", ethers.utils.hexZeroPad(USDC, 32));
    console.log("");
    
    // Verify the topic0 calculation
    const calculatedTopic0 = ethers.utils.id("ReserveDataUpdated(address,uint256,uint256,uint256,uint256,uint256)");
    console.log("   Calculated Topic0:", calculatedTopic0);
    console.log("   Match:", calculatedTopic0.toLowerCase() === RESERVE_DATA_UPDATED.toLowerCase() ? "✅ Yes" : "❌ No");
    console.log("");
    
    // Check recent Aave events and what topic0 they actually have
    console.log("2️⃣  Recent Aave Events Analysis:");
    try {
        const currentBlock = await arbitrumProvider.getBlockNumber();
        const fromBlock = Math.max(currentBlock - 1000, 0);
        
        // Get ALL ReserveDataUpdated events (not filtered by USDC)
        const allEvents = await arbitrumProvider.getLogs({
            address: AAVE_POOL,
            topics: [calculatedTopic0],
            fromBlock,
            toBlock: currentBlock
        });
        
        console.log(`   Total ReserveDataUpdated events: ${allEvents.length}`);
        
        // Filter for USDC
        const usdcEvents = allEvents.filter(log => {
            return log.topics[1] && 
                   log.topics[1].toLowerCase() === ethers.utils.hexZeroPad(USDC, 32).toLowerCase();
        });
        
        console.log(`   USDC-specific events: ${usdcEvents.length}`);
        
        if (usdcEvents.length > 0) {
            const recent = usdcEvents[0];
            console.log("\n   Most recent USDC event:");
            console.log(`     Block: ${recent.blockNumber}`);
            console.log(`     TX: ${recent.transactionHash}`);
            console.log(`     Topic0: ${recent.topics[0]}`);
            console.log(`     Topic1 (reserve): ${recent.topics[1]}`);
            
            // Check if this matches what RSC expects
            if (recent.topics[0].toLowerCase() === RESERVE_DATA_UPDATED.toLowerCase()) {
                console.log("     ✅ Topic0 matches subscription");
            } else {
                console.log("     ❌ Topic0 MISMATCH!");
                console.log("     This is why events aren't being processed!");
            }
            
            if (recent.topics[1] && recent.topics[1].toLowerCase() === ethers.utils.hexZeroPad(USDC, 32).toLowerCase()) {
                console.log("     ✅ Topic1 matches USDC");
            } else {
                console.log("     ❌ Topic1 doesn't match USDC");
            }
        }
    } catch (error) {
        console.log("   ❌ Error:", error.message.split('\n')[0]);
    }
    
    console.log("");
    
    // Check RSC subscription status
    console.log("3️⃣  RSC Subscription Status:");
    try {
        const rsc = new ethers.Contract(
            RSC_ADDRESS,
            [
                "function aaveSubscribed() external view returns (bool)",
                "function getSubscriptionStatus() external view returns (bool aaveActive, bool compoundActive, bool queryHelperActive)"
            ],
            reactiveProvider
        );
        
        const aaveSub = await rsc.aaveSubscribed();
        const status = await rsc.getSubscriptionStatus();
        
        console.log("   Aave Subscribed:", aaveSub ? "✅ Yes" : "❌ No");
        console.log("   Full Status:", {
            aave: status.aaveActive ? "✅" : "❌",
            compound: status.compoundActive ? "✅" : "❌",
            queryHelper: status.queryHelperActive ? "✅" : "❌"
        });
    } catch (error) {
        console.log("   ❌ Error:", error.message.split('\n')[0]);
    }
    
    console.log("");
    console.log("=".repeat(70));
    console.log("💡 DIAGNOSIS");
    console.log("=".repeat(70));
    console.log("");
    console.log("Possible Issues:");
    console.log("  1. Event topic0 mismatch (subscription vs actual)");
    console.log("  2. Contract address mismatch");
    console.log("  3. Topic1 (USDC) filtering issue");
    console.log("  4. react() function reverting silently");
    console.log("");
    console.log("If react() is being called but not completing:");
    console.log("  → Check Reactive Network transaction traces");
    console.log("  → Look for revert reasons");
    console.log("  → Verify event data structure");
    console.log("");
}

debugEventMatching().catch(console.error);

