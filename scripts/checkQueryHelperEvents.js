const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkQueryHelperEvents() {
    console.log("=".repeat(70));
    console.log("🔍 CHECKING QUERYHELPER EVENTS");
    console.log("=".repeat(70));
    console.log("");
    
    const NEW_QUERY_HELPER = "0x55f03641265a793112bd1D9480C4Ea4f143E06af";
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    const queryHelperAbi = [
        "event BothApysQueried(uint256 indexed nonce, uint256 aaveApyBps, uint256 compoundApyBps, uint256 timestamp)",
        "event CompoundApyQueried(uint256 indexed nonce, uint256 apyBps, uint256 timestamp)"
    ];
    
    const queryHelper = new ethers.Contract(NEW_QUERY_HELPER, queryHelperAbi, arbitrumProvider);
    const arbBlock = await arbitrumProvider.getBlockNumber();
    
    console.log("Checking last 20,000 blocks...");
    console.log("");
    
    // Check CompoundApyQueried events
    const compoundEvents = await queryHelper.queryFilter(
        queryHelper.filters.CompoundApyQueried(),
        Math.max(0, arbBlock - 20000)
    );
    
    console.log(`Found ${compoundEvents.length} CompoundApyQueried events:`);
    console.log("");
    
    for (let i = 0; i < compoundEvents.length; i++) {
        const event = compoundEvents[i];
        const decoded = queryHelper.interface.decodeEventLog(
            "CompoundApyQueried",
            event.data,
            event.topics
        );
        
        console.log(`Event #${i + 1}:`);
        console.log(`  Nonce: ${decoded.nonce.toString()}`);
        console.log(`  APY: ${decoded.apyBps.toString()} bps (${(parseFloat(decoded.apyBps.toString()) / 100).toFixed(2)}%)`);
        console.log(`  Timestamp: ${decoded.timestamp.toString()}`);
        console.log(`  Block: ${event.blockNumber}`);
        console.log(`  Transaction: ${event.transactionHash}`);
        console.log("");
    }
    
    // Check BothApysQueried events
    const bothEvents = await queryHelper.queryFilter(
        queryHelper.filters.BothApysQueried(),
        Math.max(0, arbBlock - 20000)
    );
    
    console.log(`Found ${bothEvents.length} BothApysQueried events:`);
    console.log("");
    
    for (let i = 0; i < bothEvents.length; i++) {
        const event = bothEvents[i];
        const decoded = queryHelper.interface.decodeEventLog(
            "BothApysQueried",
            event.data,
            event.topics
        );
        
        console.log(`Event #${i + 1}:`);
        console.log(`  Nonce: ${decoded.nonce.toString()}`);
        console.log(`  Aave APY: ${decoded.aaveApyBps.toString()} bps`);
        console.log(`  Compound APY: ${decoded.compoundApyBps.toString()} bps`);
        
        const spread = decoded.aaveApyBps.gt(decoded.compoundApyBps)
            ? decoded.aaveApyBps.sub(decoded.compoundApyBps)
            : decoded.compoundApyBps.sub(decoded.aaveApyBps);
        
        console.log(`  Spread: ${spread.toString()} bps`);
        console.log(`  Block: ${event.blockNumber}`);
        console.log(`  Transaction: ${event.transactionHash}`);
        console.log("");
    }
    
    console.log("=".repeat(70));
    console.log("💡 ANALYSIS");
    console.log("=".repeat(70));
    console.log("");
    
    if (compoundEvents.length > 0) {
        console.log("✅ QueryHelper IS working!");
        console.log("   Callbacks are executing successfully");
        console.log("   Compound APY is being queried correctly");
        console.log("");
        
        if (bothEvents.length === 0) {
            console.log("⚠️  No BothApysQueried events yet");
            console.log("   Initialization callback may still be processing");
            console.log("   Or RSC is using queryCompoundApy() instead of queryBothApys()");
            console.log("");
        }
    } else {
        console.log("⏳ No QueryHelper events yet");
        console.log("   Callbacks may still be processing");
        console.log("");
    }
    console.log("");
}

checkQueryHelperEvents().catch(console.error);

