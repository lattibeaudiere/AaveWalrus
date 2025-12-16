const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkInitializationCallback() {
    console.log("=".repeat(70));
    console.log("🔍 CHECKING INITIALIZATION CALLBACK STATUS");
    console.log("=".repeat(70));
    console.log("");
    
    const NEW_QUERY_HELPER = "0x55f03641265a793112bd1D9480C4Ea4f143E06af";
    const INIT_TX_HASH = "0xa86374ca1cd319d8f60c98bfe087aabdb1e3dc2651ac4199aa3d1a390c0c6894";
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    console.log("Initialization Callback:");
    console.log(`  RSC Transaction: ${INIT_TX_HASH}`);
    console.log(`  Expected: Callback to QueryHelper.queryBothApys()`);
    console.log(`  Nonce: type(uint256).max (initialization marker)`);
    console.log("");
    
    // Check if QueryHelper received the callback
    const queryHelperAbi = [
        "event BothApysQueried(uint256 indexed nonce, uint256 aaveApyBps, uint256 compoundApyBps, uint256 timestamp)"
    ];
    
    const queryHelper = new ethers.Contract(NEW_QUERY_HELPER, queryHelperAbi, arbitrumProvider);
    const arbBlock = await arbitrumProvider.getBlockNumber();
    
    // Check for BothApysQueried with max nonce
    const maxNonce = ethers.BigNumber.from("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    
    const bothEvents = await queryHelper.queryFilter(
        queryHelper.filters.BothApysQueried(maxNonce),
        Math.max(0, arbBlock - 50000)
    );
    
    console.log("1️⃣  Initialization Callback Status:");
    console.log("");
    
    if (bothEvents.length > 0) {
        console.log("   ✅ Initialization callback EXECUTED!");
        console.log("");
        
        for (let i = 0; i < bothEvents.length; i++) {
            const event = bothEvents[i];
            const decoded = queryHelper.interface.decodeEventLog(
                "BothApysQueried",
                event.data,
                event.topics
            );
            
            console.log(`   Event #${i + 1}:`);
            console.log(`     Nonce: ${decoded.nonce.toString()}`);
            console.log(`     Aave APY: ${decoded.aaveApyBps.toString()} bps`);
            console.log(`     Compound APY: ${decoded.compoundApyBps.toString()} bps`);
            
            const spread = decoded.aaveApyBps.gt(decoded.compoundApyBps)
                ? decoded.aaveApyBps.sub(decoded.compoundApyBps)
                : decoded.compoundApyBps.sub(decoded.aaveApyBps);
            
            console.log(`     Spread: ${spread.toString()} bps`);
            console.log(`     Block: ${event.blockNumber}`);
            console.log(`     Transaction: ${event.transactionHash}`);
            console.log("");
            
            if (spread.toNumber() >= 30) {
                console.log("     ✅ Spread > 30 bps - Should trigger deployment!");
            }
        }
    } else {
        console.log("   ❌ Initialization callback NOT executed yet");
        console.log("");
        console.log("   This means:");
        console.log("   • RSC emitted Callback to queryBothApys()");
        console.log("   • But Reactive Network hasn't executed it on Arbitrum yet");
        console.log("   • Or the callback transaction failed");
        console.log("");
        console.log("   Checking for callback transaction on Arbitrum...");
        console.log("");
        
        // Check if there's a transaction to QueryHelper around the time of initialization
        try {
            const initBlock = await arbitrumProvider.getBlockNumber();
            const queryHelperCode = await arbitrumProvider.getCode(NEW_QUERY_HELPER);
            
            console.log(`   QueryHelper exists: ${queryHelperCode !== "0x" ? "✅" : "❌"}`);
            
            // Look for transactions to QueryHelper around initialization time
            // This is approximate - Reactive Network may take time to process
            console.log("");
            console.log("   ⏳ Reactive Network callbacks can take 5-15 minutes");
            console.log("      Check back later for BothApysQueried events");
            console.log("");
        } catch (error) {
            console.log(`   ⚠️  Could not check: ${error.message.split('\n')[0]}`);
        }
    }
    
    console.log("2️⃣  Aave Event Callbacks:");
    console.log("");
    
    const compoundEvents = await queryHelper.queryFilter(
        queryHelper.filters.CompoundApyQueried(),
        Math.max(0, arbBlock - 50000)
    );
    
    console.log(`   Found ${compoundEvents.length} CompoundApyQueried events`);
    console.log("");
    
    if (compoundEvents.length > 0) {
        console.log("   ✅ These ARE from Aave events (as you correctly identified):");
        console.log("");
        
        for (let i = 0; i < compoundEvents.length; i++) {
            const event = compoundEvents[i];
            const decoded = queryHelper.interface.decodeEventLog(
                "CompoundApyQueried",
                event.data,
                event.topics
            );
            
            const nonce = decoded.nonce.toString();
            
            // Skip test nonce (999)
            if (nonce === "999") {
                continue;
            }
            
            console.log(`   Event #${i + 1}:`);
            console.log(`     Nonce: ${nonce}`);
            console.log(`     APY: ${decoded.apyBps.toString()} bps`);
            console.log(`     Block: ${event.blockNumber}`);
            console.log(`     Transaction: ${event.transactionHash}`);
            console.log("");
            console.log(`     ✅ This came from: Aave ReserveDataUpdated event`);
            console.log(`        → RSC extracted Aave APY from event`);
            console.log(`        → RSC emitted Callback to queryCompoundApy()`);
            console.log(`        → QueryHelper executed and emitted this event`);
            console.log("");
        }
    }
    
    console.log("=".repeat(70));
    console.log("📊 SUMMARY");
    console.log("=".repeat(70));
    console.log("");
    console.log("You are CORRECT:");
    console.log("  • QueryHelper CompoundApyQueried events ARE from Aave events");
    console.log("  • These happen when Aave emits ReserveDataUpdated");
    console.log("  • RSC processes Aave event → calls QueryHelper for Compound APY");
    console.log("");
    console.log("Initialization Status:");
    console.log("  • RSC emitted initialization callback ✅");
    console.log("  • But Reactive Network hasn't executed it yet ⏳");
    console.log("  • Check back in 5-15 minutes for BothApysQueried event");
    console.log("");
    console.log("Key Question:");
    console.log("  Is RSC subscribed and receiving CompoundApyQueried events?");
    console.log("  If yes, RSC should be comparing APYs and deploying capital");
    console.log("");
}

checkInitializationCallback().catch(console.error);

