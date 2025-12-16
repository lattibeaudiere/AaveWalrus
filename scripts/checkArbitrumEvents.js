const { ethers } = require('ethers');

async function checkArbitrumEvents() {
    const ARBITRUM_RPC = "https://arb1.arbitrum.io/rpc";
    const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);
    
    const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
    const COMPOUND_USDC = "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA";
    const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // Arbitrum USDC
    
    console.log("=".repeat(60));
    console.log("🔍 CHECKING ARBITRUM EVENTS (WITH USDC FILTER)");
    console.log("=".repeat(60));
    console.log("");
    
    // Check Aave V3 with USDC filter
    console.log("1. AAVE V3 ReserveDataUpdated (Filtered by USDC)");
    console.log("-".repeat(60));
    
    const RESERVE_DATA_UPDATED = "0xb2a02bf1a92354a66946e3533277a66dd13726c1695e5ac302d1c1fcb97d2200";
    
    try {
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = currentBlock - 5000; // Check last 5000 blocks
        
        // Filter by topic1 = USDC address (padded to 32 bytes)
        const usdcTopic1 = ethers.utils.hexZeroPad(USDC_ADDRESS, 32);
        
        const aaveFilter = {
            address: AAVE_POOL,
            topics: [
                RESERVE_DATA_UPDATED,  // topic0: event signature
                usdcTopic1             // topic1: USDC address (indexed reserve)
            ],
            fromBlock: fromBlock,
            toBlock: currentBlock
        };
        
        const aaveEvents = await provider.getLogs(aaveFilter);
        
        if (aaveEvents.length === 0) {
            console.log(`   ❌ NO USDC-specific ReserveDataUpdated events`);
            console.log(`   Checked blocks: ${fromBlock} to ${currentBlock}`);
            
            // Try without USDC filter
            console.log("\n   Trying without USDC filter (any reserve)...");
            const aaveFilterAny = {
                address: AAVE_POOL,
                topics: [RESERVE_DATA_UPDATED],
                fromBlock: fromBlock,
                toBlock: currentBlock
            };
            const aaveEventsAny = await provider.getLogs(aaveFilterAny);
            console.log(`   Found ${aaveEventsAny.length} ReserveDataUpdated events (any reserve)`);
            
            if (aaveEventsAny.length > 0) {
                console.log("\n   💡 ISSUE: We need to filter by USDC address (topic1)!");
                console.log("   Current subscription uses REACTIVE_IGNORE for topic1");
                console.log("   This means we're subscribed to ALL reserves, not just USDC");
                console.log("   But Reactive Network might not be forwarding all events");
            }
        } else {
            console.log(`   ✅ Found ${aaveEvents.length} USDC-specific events`);
            console.log("\n   Recent events:");
            aaveEvents.slice(-3).forEach((event, i) => {
                console.log(`\n   Event ${i + 1}:`);
                console.log(`     Block: ${event.blockNumber}`);
                console.log(`     TX: ${event.transactionHash}`);
                console.log(`     Block Time: ~${Math.floor((Date.now() / 1000 - (currentBlock - event.blockNumber) * 2))}s ago`);
            });
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }
    console.log("");
    
    // Check Compound V3
    console.log("2. COMPOUND V3 AccrueInterest");
    console.log("-".repeat(60));
    
    const ACCRUE_INTEREST = "0x717fee053884ab1935ba6d0140f6ed225371439611d9674ff445419d6a0fa1b7";
    
    try {
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = currentBlock - 5000;
        
        const compoundFilter = {
            address: COMPOUND_USDC,
            topics: [ACCRUE_INTEREST],
            fromBlock: fromBlock,
            toBlock: currentBlock
        };
        
        const compoundEvents = await provider.getLogs(compoundFilter);
        
        if (compoundEvents.length === 0) {
            console.log(`   ❌ NO AccrueInterest events found`);
            console.log(`   Checked blocks: ${fromBlock} to ${currentBlock}`);
            
            // Check what events ARE being emitted
            console.log("\n   Checking what events ARE being emitted...");
            const allLogs = await provider.getLogs({
                address: COMPOUND_USDC,
                fromBlock: fromBlock,
                toBlock: currentBlock
            });
            
            // Count events by topic0
            const eventCounts = {};
            allLogs.forEach(log => {
                const topic0 = log.topics[0];
                eventCounts[topic0] = (eventCounts[topic0] || 0) + 1;
            });
            
            console.log(`   Found ${allLogs.length} total events`);
            console.log("\n   Event breakdown:");
            Object.entries(eventCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .forEach(([topic, count]) => {
                    console.log(`     ${topic}: ${count} events`);
                });
            
            console.log("\n   💡 Try identifying the correct event signature");
        } else {
            console.log(`   ✅ Found ${compoundEvents.length} AccrueInterest events`);
            console.log("\n   Recent events:");
            compoundEvents.slice(-3).forEach((event, i) => {
                console.log(`\n   Event ${i + 1}:`);
                console.log(`     Block: ${event.blockNumber}`);
                console.log(`     TX: ${event.transactionHash}`);
            });
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }
    console.log("");
    
    console.log("=".repeat(60));
    console.log("💡 RECOMMENDATIONS");
    console.log("=".repeat(60));
    console.log("");
    console.log("1. For Aave V3:");
    console.log("   - We might need to subscribe with topic1 = USDC address");
    console.log("   - Current: REACTIVE_IGNORE (matches any reserve)");
    console.log("   - Better: Specific USDC address filter");
    console.log("");
    console.log("2. For Compound V3:");
    console.log("   - Verify AccrueInterest is the correct event");
    console.log("   - Check if different event signature is used");
    console.log("");
    console.log("3. Check Reactscan:");
    console.log("   - Verify subscriptions are actually active");
    console.log("   - Check if Reactive Network is indexing these events");
}

checkArbitrumEvents().catch(console.error);

