const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkQueryHelperSubscription() {
    console.log("=".repeat(70));
    console.log("🔍 CHECKING QUERYHELPER SUBSCRIPTION STATUS");
    console.log("=".repeat(70));
    console.log("");
    
    const RSC_ADDRESS = "0xf64afe64622CeAe79d48A15ebC49CC7FF416c688";
    const QUERY_HELPER = "0x05b402e333974134689424F13f01BC31F8fbfF56";
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://reactive-network.rpc.thirdweb.com"
    );
    
    console.log("RSC Address:", RSC_ADDRESS);
    console.log("QueryHelper Address:", QUERY_HELPER);
    console.log("");
    
    // Check subscription status
    const rscAbi = [
        "function getSubscriptionStatus() external view returns (bool aaveSub, bool compoundSub, bool queryHelperSub)",
        "function queryHelperSubscribed() external view returns (bool)",
        "function COMPOUND_APY_QUERIED_TOPIC() external view returns (uint256)",
        "function BOTH_APYS_QUERIED_TOPIC() external view returns (uint256)"
    ];
    
    try {
        const rsc = new ethers.Contract(RSC_ADDRESS, rscAbi, reactiveProvider);
        
        console.log("1️⃣  Checking Subscription Status:");
        console.log("");
        
        try {
            const status = await rsc.getSubscriptionStatus();
            console.log(`   Aave Subscribed: ${status[0] ? "✅ YES" : "❌ NO"}`);
            console.log(`   Compound Subscribed: ${status[1] ? "✅ YES" : "❌ NO"}`);
            console.log(`   QueryHelper Subscribed: ${status[2] ? "✅ YES" : "❌ NO"}`);
            console.log("");
            
            if (!status[2]) {
                console.log("   ⚠️  CRITICAL: RSC is NOT subscribed to QueryHelper events!");
                console.log("");
                console.log("   This means:");
                console.log("   • QueryHelper emits CompoundApyQueried events");
                console.log("   • But RSC never receives them");
                console.log("   • RSC can't process the APY data");
                console.log("   • No deployment can occur");
                console.log("");
            }
        } catch (error) {
            console.log("   ⚠️  Could not check subscription status:", error.message.split('\n')[0]);
            console.log("");
            
            // Try alternative method
            try {
                const queryHelperSub = await rsc.queryHelperSubscribed();
                console.log(`   QueryHelper Subscribed (alternative): ${queryHelperSub ? "✅ YES" : "❌ NO"}`);
                console.log("");
            } catch (error2) {
                console.log("   ⚠️  Could not check via alternative method");
                console.log("");
            }
        }
        
        console.log("2️⃣  Checking Event Topics:");
        console.log("");
        
        try {
            const compoundTopic = await rsc.COMPOUND_APY_QUERIED_TOPIC();
            console.log(`   COMPOUND_APY_QUERIED_TOPIC: ${compoundTopic.toString()}`);
            
            // Calculate expected topic
            const expectedTopic = ethers.utils.keccak256(
                ethers.utils.toUtf8Bytes("CompoundApyQueried(uint256,uint256,uint256)")
            );
            console.log(`   Expected: ${expectedTopic}`);
            console.log(`   Match: ${compoundTopic.toString() === expectedTopic ? "✅" : "❌"}`);
            console.log("");
            
            const bothTopic = await rsc.BOTH_APYS_QUERIED_TOPIC();
            console.log(`   BOTH_APYS_QUERIED_TOPIC: ${bothTopic.toString()}`);
            
            const expectedBothTopic = ethers.utils.keccak256(
                ethers.utils.toUtf8Bytes("BothApysQueried(uint256,uint256,uint256,uint256)")
            );
            console.log(`   Expected: ${expectedBothTopic}`);
            console.log(`   Match: ${bothTopic.toString() === expectedBothTopic ? "✅" : "❌"}`);
            console.log("");
        } catch (error) {
            console.log("   ⚠️  Could not check topics:", error.message.split('\n')[0]);
            console.log("");
        }
        
        console.log("3️⃣  Verifying QueryHelper Events:");
        console.log("");
        
        const arbitrumProvider = new ethers.providers.JsonRpcProvider(
            process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
        );
        
        const queryHelperAbi = [
            "event CompoundApyQueried(uint256 indexed nonce, uint256 apyBps, uint256 timestamp)",
            "event BothApysQueried(uint256 indexed nonce, uint256 aaveApyBps, uint256 compoundApyBps, uint256 timestamp)"
        ];
        
        try {
            const queryHelper = new ethers.Contract(QUERY_HELPER, queryHelperAbi, arbitrumProvider);
            const arbBlock = await arbitrumProvider.getBlockNumber();
            
            const compoundEvents = await queryHelper.queryFilter(
                queryHelper.filters.CompoundApyQueried(),
                Math.max(0, arbBlock - 100000)
            );
            
            const bothEvents = await queryHelper.queryFilter(
                queryHelper.filters.BothApysQueried(),
                Math.max(0, arbBlock - 100000)
            );
            
            console.log(`   CompoundApyQueried events: ${compoundEvents.length}`);
            console.log(`   BothApysQueried events: ${bothEvents.length}`);
            console.log("");
            
            if (compoundEvents.length > 0 || bothEvents.length > 0) {
                console.log("   ✅ QueryHelper IS emitting events!");
                console.log("   But RSC may not be subscribed to receive them");
                console.log("");
            } else {
                console.log("   ⚠️  No QueryHelper events found");
                console.log("   This could mean:");
                console.log("   • QueryHelper hasn't been called successfully");
                console.log("   • Or events haven't been emitted yet");
                console.log("");
            }
        } catch (error) {
            console.log("   ⚠️  Error checking events:", error.message.split('\n')[0]);
            console.log("");
        }
        
    } catch (error) {
        console.log("❌ Error:", error.message);
        console.log("");
    }
    
    console.log("=".repeat(70));
    console.log("📊 SUMMARY");
    console.log("=".repeat(70));
    console.log("");
    console.log("YES - The RSC MUST subscribe to QueryHelper events!");
    console.log("");
    console.log("Flow:");
    console.log("  1. RSC emits Callback → QueryHelper.queryCompoundApy()");
    console.log("  2. QueryHelper executes and emits CompoundApyQueried event");
    console.log("  3. ⚠️  RSC must be SUBSCRIBED to receive this event");
    console.log("  4. RSC processes event and extracts Compound APY");
    console.log("  5. RSC compares APYs and deploys if spread > threshold");
    console.log("");
    console.log("If RSC is NOT subscribed:");
    console.log("  • QueryHelper emits events ✅");
    console.log("  • But RSC never receives them ❌");
    console.log("  • RSC can't process APY data ❌");
    console.log("  • No deployment occurs ❌");
    console.log("");
    console.log("💡 Solution:");
    console.log("  Call subscribeToQueryHelper() or subscribeToBothApys() on the RSC");
    console.log("");
}

checkQueryHelperSubscription().catch(console.error);

