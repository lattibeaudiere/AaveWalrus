const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function testSubscriptionWithEvents() {
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0x5eBe4dB39B498511c871DCdF3f5D3afD707228c2";
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    const ARBITRUM_RPC = process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc";
    
    console.log("=".repeat(60));
    console.log("🧪 TESTING SUBSCRIPTIONS WITH REAL EVENTS");
    console.log("=".repeat(60));
    console.log("");
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);
    
    // Check if our contract has processed any events
    console.log("1. CHECKING IF CONTRACT HAS PROCESSED EVENTS");
    console.log("-".repeat(60));
    
    const RSC_ABI = [
        "event ReactHandled(uint256 chainId, address emitter, uint256 txHash, uint256 logIndex)",
        "function owner() view returns (address)"
    ];
    
    const rscContract = new ethers.Contract(RSC_ADDRESS, RSC_ABI, reactiveProvider);
    
    try {
        const currentBlock = await reactiveProvider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 20000);
        
        const filter = rscContract.filters.ReactHandled();
        const events = await rscContract.queryFilter(filter, fromBlock, currentBlock);
        
        if (events.length > 0) {
            console.log(`   ✅ Found ${events.length} ReactHandled event(s)!`);
            events.slice(-5).forEach((event, i) => {
                console.log(`\n   Event ${i + 1}:`);
                console.log(`     Block: ${event.blockNumber}`);
                console.log(`     Chain ID: ${event.args.chainId.toString()}`);
                console.log(`     Emitter: ${event.args.emitter}`);
                console.log(`     TX Hash: ${event.args.txHash.toString()}`);
            });
            console.log("\n   🎉 Subscriptions are working! Events are being processed!");
        } else {
            console.log(`   ❌ No ReactHandled events found (blocks ${fromBlock} to ${currentBlock})`);
            console.log("   This means events haven't been processed yet.");
        }
    } catch (error) {
        console.log(`   ❌ Error checking events: ${error.message}`);
    }
    console.log("");
    
    // Check recent events on Arbitrum
    console.log("2. RECENT EVENTS ON ARBITRUM");
    console.log("-".repeat(60));
    
    const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
    const COMPOUND_USDC = "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA";
    const RESERVE_DATA_UPDATED = "0x804c9b842b2748a22bb64b345453a3de7ca54a6ca45ce00d415894979e22897a";
    const ACCRUE_INTEREST = "0x717fee053884ab1935ba6d0140f6ed225371439611d9674ff445419d6a0fa1b7";
    
    let aaveEvents = [];
    let compoundEvents = [];
    
    try {
        const currentBlock = await arbitrumProvider.getBlockNumber();
        const fromBlock = currentBlock - 2000; // Last 2000 blocks
        
        // Aave events
        const aaveFilter = {
            address: AAVE_POOL,
            topics: [RESERVE_DATA_UPDATED],
            fromBlock: fromBlock,
            toBlock: currentBlock
        };
        
        aaveEvents = await arbitrumProvider.getLogs(aaveFilter);
        console.log(`   Aave V3 ReserveDataUpdated: ${aaveEvents.length} events`);
        
        if (aaveEvents.length > 0) {
            console.log("\n   Recent Aave events:");
            for (let i = 0; i < Math.min(3, aaveEvents.length); i++) {
                const event = aaveEvents[aaveEvents.length - 1 - i];
                try {
                    const block = await arbitrumProvider.getBlock(event.blockNumber);
                    const blockTime = new Date(block.timestamp * 1000);
                    console.log(`\n   ${i + 1}. Block ${event.blockNumber}`);
                    console.log(`      TX: ${event.transactionHash}`);
                    console.log(`      Time: ${blockTime.toISOString()}`);
                    console.log(`      Should trigger react() function!`);
                } catch (e) {
                    console.log(`\n   ${i + 1}. Block ${event.blockNumber}`);
                    console.log(`      TX: ${event.transactionHash}`);
                }
            }
        }
        
        // Compound events
        const compoundFilter = {
            address: COMPOUND_USDC,
            topics: [ACCRUE_INTEREST],
            fromBlock: fromBlock,
            toBlock: currentBlock
        };
        
        compoundEvents = await arbitrumProvider.getLogs(compoundFilter);
        console.log(`\n   Compound V3 AccrueInterest: ${compoundEvents.length} events`);
        
        if (compoundEvents.length === 0) {
            console.log("\n   ⚠️  No Compound events found - signature might be wrong");
            console.log("   Let's check what events ARE being emitted...");
            
            // Check all events from Compound contract
            const allCompoundLogs = await arbitrumProvider.getLogs({
                address: COMPOUND_USDC,
                fromBlock: fromBlock,
                toBlock: currentBlock
            });
            
            console.log(`   Total Compound events: ${allCompoundLogs.length}`);
            
            // Count by topic0
            const eventCounts = {};
            allCompoundLogs.forEach(log => {
                const topic0 = log.topics[0];
                eventCounts[topic0] = (eventCounts[topic0] || 0) + 1;
            });
            
            if (Object.keys(eventCounts).length > 0) {
                console.log("\n   Events found (by topic0):");
                Object.entries(eventCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .forEach(([topic, count]) => {
                        console.log(`     ${topic}: ${count} events`);
                    });
            }
        }
        
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }
    console.log("");
    
    // Summary
    console.log("3. DIAGNOSIS");
    console.log("-".repeat(60));
    console.log("");
    
    if (aaveEvents.length > 0) {
        console.log("✅ Aave V3 events ARE being emitted on Arbitrum");
        console.log("   If subscriptions are active, these should trigger react()");
        console.log("");
        console.log("💡 Possible reasons react() isn't being called:");
        console.log("   1. Reactive Network hasn't processed the subscriptions yet");
        console.log("   2. Subscriptions need time to sync (check Reactscan)");
        console.log("   3. Event filtering might not match (e.g., need USDC address filter)");
        console.log("   4. Contract needs more funding for execution");
        console.log("   5. Reactive Network indexing delay");
    } else {
        console.log("⚠️  No recent Aave events found");
        console.log("   Events will process when protocol activity occurs");
    }
    
    console.log("\n🔗 Check Reactscan:");
    console.log(`   https://reactscan.io/address/${RSC_ADDRESS}`);
}

testSubscriptionWithEvents().catch(console.error);

