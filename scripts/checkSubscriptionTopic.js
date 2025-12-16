const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkSubscriptionTopic() {
    console.log("=".repeat(70));
    console.log("🔍 CHECKING SUBSCRIPTION TOPIC");
    console.log("=".repeat(70));
    console.log("");
    
    const NEW_RSC = "0x7Af5dC1f012d4a875E40d2ffD5E39d7468c59E14";
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://reactive-network.rpc.thirdweb.com"
    );
    
    // Calculate expected topic
    const expectedTopic = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("CompoundApyQueried(uint256,uint256,uint256)")
    );
    
    console.log("Expected Topic (from QueryHelper):");
    console.log(`  ${expectedTopic}`);
    console.log("");
    
    // Check what RSC has stored
    const rscAbi = [
        "function COMPOUND_APY_QUERIED_TOPIC() external view returns (uint256)"
    ];
    
    try {
        const rsc = new ethers.Contract(NEW_RSC, rscAbi, reactiveProvider);
        const storedTopic = await rsc.COMPOUND_APY_QUERIED_TOPIC();
        
        console.log("RSC Stored Topic:");
        console.log(`  Decimal: ${storedTopic.toString()}`);
        console.log(`  Hex: ${storedTopic.toHexString()}`);
        console.log("");
        
        const match = storedTopic.toHexString() === expectedTopic;
        console.log(`Match: ${match ? "✅ YES" : "❌ NO"}`);
        console.log("");
        
        if (!match) {
            console.log("❌ PROBLEM:");
            console.log("   RSC contract has WRONG topic stored!");
            console.log("   This means the subscription was made with wrong topic");
            console.log("");
            console.log("   The RSC source code has the CORRECT topic:");
            console.log(`     ${expectedTopic}`);
            console.log("");
            console.log("   But the deployed contract has:");
            console.log(`     ${storedTopic.toHexString()}`);
            console.log("");
            console.log("   SOLUTION:");
            console.log("   1. Unsubscribe from old (wrong) topic");
            console.log("   2. Resubscribe with correct topic");
            console.log("   OR");
            console.log("   1. Redeploy RSC (ensure source has correct topic)");
            console.log("   2. Subscribe with correct topic");
            console.log("");
        } else {
            console.log("✅ Topics match!");
            console.log("");
            console.log("If RSC still not receiving events:");
            console.log("  • Check subscription was actually created");
            console.log("  • Verify Reactive Network is processing events");
            console.log("  • Check QueryHelper is emitting events with correct topic");
            console.log("");
        }
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
}

checkSubscriptionTopic().catch(console.error);

