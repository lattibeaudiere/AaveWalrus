const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function verifyEventTopicMatch() {
    console.log("=".repeat(70));
    console.log("🔍 VERIFYING EVENT TOPIC MATCH");
    console.log("=".repeat(70));
    console.log("");
    
    const NEW_RSC = "0x7Af5dC1f012d4a875E40d2ffD5E39d7468c59E14";
    const NEW_QUERY_HELPER = "0x55f03641265a793112bd1D9480C4Ea4f143E06af";
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://reactive-network.rpc.thirdweb.com"
    );
    
    console.log("1️⃣  Calculating Expected Event Topics:");
    console.log("");
    
    // Calculate what QueryHelper actually emits
    const compoundApyQueriedSig = "CompoundApyQueried(uint256,uint256,uint256)";
    const bothApysQueriedSig = "BothApysQueried(uint256,uint256,uint256,uint256)";
    
    const expectedCompoundTopic = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(compoundApyQueriedSig)
    );
    
    const expectedBothTopic = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(bothApysQueriedSig)
    );
    
    console.log("QueryHelper Events:");
    console.log(`  CompoundApyQueried: ${expectedCompoundTopic}`);
    console.log(`  BothApysQueried: ${expectedBothTopic}`);
    console.log("");
    
    console.log("2️⃣  Checking RSC Contract Constants:");
    console.log("");
    
    const rscAbi = [
        "function COMPOUND_APY_QUERIED_TOPIC() external view returns (uint256)",
        "function BOTH_APYS_QUERIED_TOPIC() external view returns (uint256)",
        "function queryHelper() external view returns (address)",
        "function getSubscriptionStatus() external view returns (bool aaveSub, bool compoundSub, bool queryHelperSub)"
    ];
    
    try {
        const rsc = new ethers.Contract(NEW_RSC, rscAbi, reactiveProvider);
        
        const rscCompoundTopic = await rsc.COMPOUND_APY_QUERIED_TOPIC();
        const rscBothTopic = await rsc.BOTH_APYS_QUERIED_TOPIC();
        const queryHelper = await rsc.queryHelper();
        const status = await rsc.getSubscriptionStatus();
        
        console.log("RSC Event Topics:");
        console.log(`  COMPOUND_APY_QUERIED_TOPIC: ${rscCompoundTopic.toString()}`);
        console.log(`  BOTH_APYS_QUERIED_TOPIC: ${rscBothTopic.toString()}`);
        console.log("");
        
        console.log("3️⃣  Comparing Topics:");
        console.log("");
        
        const compoundMatch = rscCompoundTopic.toString() === expectedCompoundTopic;
        const bothMatch = rscBothTopic.toString() === expectedBothTopic;
        
        console.log(`CompoundApyQueried Match: ${compoundMatch ? "✅ YES" : "❌ NO"}`);
        if (!compoundMatch) {
            console.log(`  Expected: ${expectedCompoundTopic}`);
            console.log(`  Got:      ${rscCompoundTopic.toString()}`);
            console.log("");
        }
        
        console.log(`BothApysQueried Match: ${bothMatch ? "✅ YES" : "❌ NO"}`);
        if (!bothMatch) {
            console.log(`  Expected: ${expectedBothTopic}`);
            console.log(`  Got:      ${rscBothTopic.toString()}`);
            console.log("");
        }
        
        console.log("4️⃣  Subscription Status:");
        console.log("");
        console.log(`  QueryHelper Address: ${queryHelper}`);
        console.log(`  Expected: ${NEW_QUERY_HELPER}`);
        console.log(`  Match: ${queryHelper.toLowerCase() === NEW_QUERY_HELPER.toLowerCase() ? "✅" : "❌"}`);
        console.log("");
        console.log(`  QueryHelper Subscribed: ${status[2] ? "✅ YES" : "❌ NO"}`);
        console.log("");
        
        console.log("5️⃣  Checking Actual QueryHelper Events:");
        console.log("");
        
        const arbitrumProvider = new ethers.providers.JsonRpcProvider(
            process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
        );
        
        const queryHelperAbi = [
            "event CompoundApyQueried(uint256 indexed nonce, uint256 apyBps, uint256 timestamp)",
            "event BothApysQueried(uint256 indexed nonce, uint256 aaveApyBps, uint256 compoundApyBps, uint256 timestamp)"
        ];
        
        const queryHelperContract = new ethers.Contract(NEW_QUERY_HELPER, queryHelperAbi, arbitrumProvider);
        const arbBlock = await arbitrumProvider.getBlockNumber();
        
        // Get recent events
        const compoundEvents = await queryHelperContract.queryFilter(
            queryHelperContract.filters.CompoundApyQueried(),
            Math.max(0, arbBlock - 50000)
        );
        
        const bothEvents = await queryHelperContract.queryFilter(
            queryHelperContract.filters.BothApysQueried(),
            Math.max(0, arbBlock - 50000)
        );
        
        console.log(`  CompoundApyQueried events: ${compoundEvents.length}`);
        console.log(`  BothApysQueried events: ${bothEvents.length}`);
        console.log("");
        
        if (compoundEvents.length > 0) {
            const latest = compoundEvents[compoundEvents.length - 1];
            console.log("  Latest CompoundApyQueried event:");
            console.log(`    Topic0: ${latest.topics[0]}`);
            console.log(`    Expected: ${expectedCompoundTopic}`);
            console.log(`    Match: ${latest.topics[0] === expectedCompoundTopic ? "✅" : "❌"}`);
            console.log("");
        }
        
        console.log("=".repeat(70));
        console.log("📊 DIAGNOSIS");
        console.log("=".repeat(70));
        console.log("");
        
        if (!compoundMatch || !bothMatch) {
            console.log("❌ PROBLEM FOUND:");
            console.log("   RSC event topics DON'T MATCH QueryHelper events!");
            console.log("");
            console.log("   This means:");
            console.log("   • QueryHelper emits events with one topic");
            console.log("   • RSC is subscribed to a DIFFERENT topic");
            console.log("   • RSC never receives the events!");
            console.log("");
            console.log("   SOLUTION:");
            console.log("   • Fix RSC contract to use correct topic");
            console.log("   • Or fix QueryHelper to use correct event signature");
            console.log("");
        } else {
            console.log("✅ Topics match correctly!");
            console.log("");
            if (!status[2]) {
                console.log("⚠️  But RSC is NOT subscribed to QueryHelper");
                console.log("   Need to call subscribeToQueryHelper()");
            } else {
                console.log("✅ RSC is subscribed");
                console.log("");
                console.log("If RSC still not receiving events:");
                console.log("  • Check subscription was made correctly");
                console.log("  • Check Reactive Network is processing events");
                console.log("  • Verify QueryHelper address matches");
            }
        }
        console.log("");
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        console.log("");
    }
}

verifyEventTopicMatch().catch(console.error);

