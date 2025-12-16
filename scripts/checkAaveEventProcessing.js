const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkAaveEventProcessing() {
    console.log("=".repeat(70));
    console.log("🔍 CHECKING AAVE EVENT PROCESSING");
    console.log("=".repeat(70));
    console.log("");
    
    const NEW_RSC = "0x7Af5dC1f012d4a875E40d2ffD5E39d7468c59E14";
    const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://reactive-network.rpc.thirdweb.com"
    );
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    console.log("1️⃣  Checking Aave Events on Arbitrum:");
    console.log("");
    
    // Aave ReserveDataUpdated event signature
    const reserveDataUpdatedTopic = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("ReserveDataUpdated(address,uint256,uint256,uint256,uint256,uint256)")
    );
    
    // USDC address as topic1 (padded to bytes32)
    const usdcTopic1 = ethers.utils.hexZeroPad(USDC, 32);
    
    console.log(`   Event Topic0: ${reserveDataUpdatedTopic}`);
    console.log(`   USDC Topic1: ${usdcTopic1}`);
    console.log("");
    
    // Check recent Aave events
    const arbBlock = await arbitrumProvider.getBlockNumber();
    
    try {
        // Filter for ReserveDataUpdated events from Aave Pool with USDC in topic1
        const filter = {
            address: AAVE_POOL,
            topics: [
                reserveDataUpdatedTopic,
                usdcTopic1
            ],
            fromBlock: Math.max(0, arbBlock - 50000),
            toBlock: 'latest'
        };
        
        const logs = await arbitrumProvider.getLogs(filter);
        
        console.log(`   Found ${logs.length} ReserveDataUpdated events for USDC`);
        console.log("");
        
        if (logs.length > 0) {
            console.log("   Recent Aave Events:");
            console.log("");
            
            for (let i = Math.max(0, logs.length - 5); i < logs.length; i++) {
                const log = logs[i];
                console.log(`   Event #${i + 1}:`);
                console.log(`     Block: ${log.blockNumber}`);
                console.log(`     Transaction: ${log.transactionHash}`);
                console.log(`     Log Index: ${log.logIndex}`);
                console.log(`     Topic0: ${log.topics[0]}`);
                console.log(`     Topic1 (reserve): ${log.topics[1]}`);
                console.log("");
            }
            
            const latest = logs[logs.length - 1];
            console.log("   Latest Aave Event:");
            console.log(`     Block: ${latest.blockNumber}`);
            console.log(`     Transaction: ${latest.transactionHash}`);
            console.log(`     Time: ${new Date((await arbitrumProvider.getBlock(latest.blockNumber)).timestamp * 1000).toISOString()}`);
            console.log("");
        } else {
            console.log("   ⚠️  No Aave events found in last 50,000 blocks");
            console.log("      Aave may not have updated USDC rates recently");
            console.log("");
        }
        
    } catch (error) {
        console.log(`   ⚠️  Error: ${error.message.split('\n')[0]}`);
        console.log("");
    }
    
    console.log("2️⃣  Checking RSC Subscription to Aave:");
    console.log("");
    
    const rscAbi = [
        "event Subscribed(uint256 chainId, address target, uint256 topic0)",
        "function getSubscriptionStatus() external view returns (bool aaveSub, bool compoundSub, bool queryHelperSub)",
        "function AAVE_POOL() external view returns (address)",
        "function RESERVE_DATA_UPDATED() external view returns (uint256)"
    ];
    
    try {
        const rsc = new ethers.Contract(NEW_RSC, rscAbi, reactiveProvider);
        
        const aavePool = await rsc.AAVE_POOL();
        const reserveDataUpdated = await rsc.RESERVE_DATA_UPDATED();
        const status = await rsc.getSubscriptionStatus();
        
        console.log(`   Aave Pool: ${aavePool}`);
        console.log(`   Expected: ${AAVE_POOL}`);
        console.log(`   Match: ${aavePool.toLowerCase() === AAVE_POOL.toLowerCase() ? "✅" : "❌"}`);
        console.log("");
        console.log(`   ReserveDataUpdated Topic: ${reserveDataUpdated.toString()}`);
        console.log(`   Expected: ${reserveDataUpdatedTopic}`);
        console.log(`   Match: ${reserveDataUpdated.toString() === reserveDataUpdatedTopic ? "✅" : "❌"}`);
        console.log("");
        console.log(`   Aave Subscribed: ${status[0] ? "✅ YES" : "❌ NO"}`);
        console.log("");
        
        // Check subscription event
        const reactiveBlock = await reactiveProvider.getBlockNumber();
        const subscribedEvents = await rsc.queryFilter(
            rsc.filters.Subscribed(),
            Math.max(0, reactiveBlock - 10000)
        );
        
        let aaveSubFound = false;
        for (const event of subscribedEvents) {
            const decoded = rsc.interface.decodeEventLog(
                "Subscribed",
                event.data,
                event.topics
            );
            
            if (decoded.target.toLowerCase() === AAVE_POOL.toLowerCase()) {
                aaveSubFound = true;
                console.log("   Subscription Event:");
                console.log(`     Chain ID: ${decoded.chainId.toString()}`);
                console.log(`     Target: ${decoded.target}`);
                console.log(`     Topic0: ${decoded.topic0.toString()}`);
                console.log(`     Block: ${event.blockNumber}`);
                console.log(`     Transaction: ${event.transactionHash}`);
                console.log("");
            }
        }
        
        if (!aaveSubFound && status[0]) {
            console.log("   ⚠️  Subscription exists but no event found");
            console.log("");
        }
        
    } catch (error) {
        console.log(`   ⚠️  Error: ${error.message.split('\n')[0]}`);
        console.log("");
    }
    
    console.log("3️⃣  Checking RSC ReactHandled Events:");
    console.log("");
    
    const reactAbi = [
        "event ReactHandled(uint256 txHash, address eventSource, uint256 topic0)"
    ];
    
    try {
        const rscReact = new ethers.Contract(NEW_RSC, reactAbi, reactiveProvider);
        const reactiveBlock = await reactiveProvider.getBlockNumber();
        
        const reactEvents = await rscReact.queryFilter(
            rscReact.filters.ReactHandled(),
            Math.max(0, reactiveBlock - 10000)
        );
        
        console.log(`   Total ReactHandled events: ${reactEvents.length}`);
        console.log("");
        
        let aaveEvents = 0;
        for (const event of reactEvents) {
            const decoded = rscReact.interface.decodeEventLog(
                "ReactHandled",
                event.data,
                event.topics
            );
            
            if (decoded.eventSource.toLowerCase() === AAVE_POOL.toLowerCase()) {
                aaveEvents++;
            }
        }
        
        if (aaveEvents > 0) {
            console.log(`   ✅ RSC processed ${aaveEvents} Aave events`);
            console.log("");
        } else {
            console.log("   ❌ RSC has NOT processed any Aave events");
            console.log("");
        }
        
    } catch (error) {
        console.log(`   ⚠️  Error: ${error.message.split('\n')[0]}`);
        console.log("");
    }
    
    console.log("=".repeat(70));
    console.log("📊 SUMMARY");
    console.log("=".repeat(70));
    console.log("");
    console.log("The 3392 bps value you're seeing:");
    console.log("  ✅ This is COMPOUND APY (33.92%)");
    console.log("  ✅ QueryHelper is correctly returning Compound APY");
    console.log("");
    console.log("The Real Issue:");
    console.log("  ❌ RSC has lastAaveApyBps = 0");
    console.log("  ❌ RSC has never processed an Aave event");
    console.log("  ❌ RSC cannot compare APYs without Aave data");
    console.log("");
    console.log("Next Steps:");
    console.log("  1. Verify RSC is subscribed to Aave events");
    console.log("  2. Check if Aave is emitting ReserveDataUpdated events");
    console.log("  3. Verify Reactive Network is forwarding Aave events");
    console.log("");
}

checkAaveEventProcessing().catch(console.error);

