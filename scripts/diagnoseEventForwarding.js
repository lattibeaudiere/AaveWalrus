const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function diagnoseEventForwarding() {
    console.log("=".repeat(70));
    console.log("🔍 DIAGNOSING EVENT FORWARDING ISSUE");
    console.log("=".repeat(70));
    console.log("");
    
    const NEW_RSC = "0x7Af5dC1f012d4a875E40d2ffD5E39d7468c59E14";
    const NEW_QUERY_HELPER = "0x55f03641265a793112bd1D9480C4Ea4f143E06af";
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    console.log("1️⃣  Checking QueryHelper Events (Arbitrum):");
    console.log("");
    
    const queryHelperAbi = [
        "event CompoundApyQueried(uint256 indexed nonce, uint256 apyBps, uint256 timestamp)",
        "event BothApysQueried(uint256 indexed nonce, uint256 aaveApyBps, uint256 compoundApyBps, uint256 timestamp)"
    ];
    
    const queryHelper = new ethers.Contract(NEW_QUERY_HELPER, queryHelperAbi, arbitrumProvider);
    const arbBlock = await arbitrumProvider.getBlockNumber();
    
    const compoundEvents = await queryHelper.queryFilter(
        queryHelper.filters.CompoundApyQueried(),
        Math.max(0, arbBlock - 50000)
    );
    
    console.log(`   Found ${compoundEvents.length} CompoundApyQueried events`);
    console.log("");
    
    // Analyze each event
    for (let i = 0; i < compoundEvents.length; i++) {
        const event = compoundEvents[i];
        const decoded = queryHelper.interface.decodeEventLog(
            "CompoundApyQueried",
            event.data,
            event.topics
        );
        
        console.log(`   Event #${i + 1}:`);
        console.log(`     Topic0: ${event.topics[0]}`);
        console.log(`     Topic1 (nonce): ${event.topics[1]}`);
        console.log(`     Nonce: ${decoded.nonce.toString()}`);
        console.log(`     APY: ${decoded.apyBps.toString()} bps`);
        console.log(`     Block: ${event.blockNumber}`);
        console.log(`     Transaction: ${event.transactionHash}`);
        console.log(`     Log Index: ${event.logIndex}`);
        console.log("");
        
        // Check if this matches subscription
        const expectedTopic = ethers.utils.keccak256(
            ethers.utils.toUtf8Bytes("CompoundApyQueried(uint256,uint256,uint256)")
        );
        
        if (event.topics[0] === expectedTopic) {
            console.log(`     ✅ Topic0 matches subscription`);
        } else {
            console.log(`     ❌ Topic0 does NOT match subscription!`);
            console.log(`        Expected: ${expectedTopic}`);
            console.log(`        Got: ${event.topics[0]}`);
        }
        console.log("");
    }
    
    console.log("2️⃣  Checking RSC Subscription Details:");
    console.log("");
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://reactive-network.rpc.thirdweb.com"
    );
    
    const rscAbi = [
        "event Subscribed(uint256 chainId, address target, uint256 topic0)"
    ];
    
    try {
        const rsc = new ethers.Contract(NEW_RSC, rscAbi, reactiveProvider);
        const reactiveBlock = await reactiveProvider.getBlockNumber();
        
        const subscribedEvents = await rsc.queryFilter(
            rsc.filters.Subscribed(),
            Math.max(0, reactiveBlock - 10000)
        );
        
        // Find QueryHelper subscription
        const expectedTopic = ethers.utils.keccak256(
            ethers.utils.toUtf8Bytes("CompoundApyQueried(uint256,uint256,uint256)")
        );
        
        for (const event of subscribedEvents) {
            const decoded = rsc.interface.decodeEventLog(
                "Subscribed",
                event.data,
                event.topics
            );
            
            if (decoded.target.toLowerCase() === NEW_QUERY_HELPER.toLowerCase()) {
                console.log("   QueryHelper Subscription:");
                console.log(`     Chain ID: ${decoded.chainId.toString()}`);
                console.log(`     Target: ${decoded.target}`);
                console.log(`     Topic0: ${decoded.topic0.toString()}`);
                console.log(`     Topic0 (hex): ${decoded.topic0.toHexString()}`);
                console.log(`     Expected: ${expectedTopic}`);
                console.log(`     Match: ${decoded.topic0.toHexString() === expectedTopic ? "✅" : "❌"}`);
                console.log(`     Block: ${event.blockNumber}`);
                console.log(`     Transaction: ${event.transactionHash}`);
                console.log("");
                console.log("   Subscription Filters:");
                console.log(`     Topic0: ${decoded.topic0.toHexString()}`);
                console.log(`     Topic1: REACTIVE_IGNORE (any nonce)`);
                console.log(`     Topic2: REACTIVE_IGNORE`);
                console.log(`     Topic3: REACTIVE_IGNORE`);
                console.log("");
            }
        }
        
    } catch (error) {
        console.log(`   ❌ Error: ${error.message.split('\n')[0]}`);
        console.log("");
    }
    
    console.log("3️⃣  Potential Issues:");
    console.log("");
    console.log("   Issue #1: Reactive Network Processing Delay");
    console.log("     • Subscription created ✅");
    console.log("     • But Reactive Network may need time to activate");
    console.log("     • Or events may be processed in batches");
    console.log("");
    console.log("   Issue #2: Event Block Number");
    console.log("     • QueryHelper events may have been emitted");
    console.log("     • Before subscription was active");
    console.log("     • Reactive Network only monitors forward from subscription time");
    console.log("");
    console.log("   Issue #3: Subscription Not Active");
    console.log("     • Subscription transaction succeeded ✅");
    console.log("     • But Reactive Network may not have activated it");
    console.log("     • Or subscription may need confirmation");
    console.log("");
    console.log("   Issue #4: Event Topic Mismatch (unlikely)");
    console.log("     • Topics appear to match ✅");
    console.log("     • But Reactive Network may check additional filters");
    console.log("");
    
    console.log("=".repeat(70));
    console.log("💡 RECOMMENDATION");
    console.log("=".repeat(70));
    console.log("");
    console.log("1. Wait for next QueryHelper event (from next Aave event)");
    console.log("   • This will test if subscription is active");
    console.log("   • Previous events may have been before subscription");
    console.log("");
    console.log("2. Check Reactive Network status/dashboard");
    console.log("   • Verify subscription is active");
    console.log("   • Check if events are being monitored");
    console.log("");
    console.log("3. Resubscribe if needed");
    console.log("   • Unsubscribe and resubscribe");
    console.log("   • Ensure subscription is created after QueryHelper events");
    console.log("");
}

diagnoseEventForwarding().catch(console.error);

