const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function testSubscriptionActive() {
    console.log("=".repeat(70));
    console.log("🧪 TESTING IF SUBSCRIPTION IS ACTIVE");
    console.log("=".repeat(70));
    console.log("");
    
    const NEW_RSC = "0x7Af5dC1f012d4a875E40d2ffD5E39d7468c59E14";
    const NEW_QUERY_HELPER = "0x55f03641265a793112bd1D9480C4Ea4f143E06af";
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://reactive-network.rpc.thirdweb.com"
    );
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.ARBITRUM_PRIVATE_KEY;
    const wallet = new ethers.Wallet(PRIVATE_KEY, arbitrumProvider);
    
    console.log("Test Plan:");
    console.log("  1. Trigger QueryHelper to emit a new event");
    console.log("  2. Wait for Reactive Network to process");
    console.log("  3. Check if RSC receives the event");
    console.log("");
    
    // Step 1: Trigger QueryHelper
    console.log("1️⃣  Triggering QueryHelper Event:");
    console.log("");
    
    const queryHelperAbi = [
        "function queryCompoundApy(uint256 nonce) external returns (uint256 apyBps)"
    ];
    
    const queryHelper = new ethers.Contract(NEW_QUERY_HELPER, queryHelperAbi, wallet);
    
    // Use a unique nonce for this test
    const testNonce = Date.now();
    
    try {
        console.log(`   Calling queryCompoundApy(${testNonce})...`);
        const tx = await queryHelper.queryCompoundApy(testNonce, { gasLimit: 500000 });
        console.log(`   Transaction: ${tx.hash}`);
        console.log(`   Waiting for confirmation...`);
        
        const receipt = await tx.wait();
        console.log(`   ✅ Transaction confirmed!`);
        console.log(`   Block: ${receipt.blockNumber}`);
        console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
        console.log("");
        
        // Check for event in transaction
        const eventAbi = [
            "event CompoundApyQueried(uint256 indexed nonce, uint256 apyBps, uint256 timestamp)"
        ];
        const eventInterface = new ethers.utils.Interface(eventAbi);
        
        let eventEmitted = false;
        for (const log of receipt.logs) {
            try {
                const parsed = eventInterface.parseLog(log);
                if (parsed.name === "CompoundApyQueried") {
                    eventEmitted = true;
                    console.log("   ✅ Event emitted in transaction:");
                    console.log(`      Nonce: ${parsed.args.nonce.toString()}`);
                    console.log(`      APY: ${parsed.args.apyBps.toString()} bps`);
                    console.log(`      Timestamp: ${parsed.args.timestamp.toString()}`);
                    console.log(`      Topic0: ${log.topics[0]}`);
                    console.log("");
                }
            } catch (e) {
                // Not our event
            }
        }
        
        if (!eventEmitted) {
            console.log("   ⚠️  Event not found in transaction logs");
            console.log("");
        }
        
    } catch (error) {
        console.log(`   ❌ Error: ${error.message.split('\n')[0]}`);
        console.log("");
        return;
    }
    
    // Step 2: Wait and check RSC
    console.log("2️⃣  Waiting for Reactive Network to process...");
    console.log("   (This may take 1-5 minutes)");
    console.log("");
    
    const rscAbi = [
        "event ReactHandled(uint256 txHash, address eventSource, uint256 topic0)",
        "event StrategyUpdate(uint256 aaveApy, uint256 compoundApy, uint256 spread, bool rebalanced)"
    ];
    
    const rsc = new ethers.Contract(NEW_RSC, rscAbi, reactiveProvider);
    
    // Get initial state
    const initialBlock = await reactiveProvider.getBlockNumber();
    console.log(`   Starting from Reactive Network block: ${initialBlock}`);
    console.log("");
    
    // Poll for events
    console.log("3️⃣  Monitoring for RSC to receive event...");
    console.log("");
    
    let found = false;
    const maxAttempts = 30; // 5 minutes max
    const delay = 10000; // 10 seconds
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, delay));
        
        const currentBlock = await reactiveProvider.getBlockNumber();
        
        // Check ReactHandled events
        const reactEvents = await rsc.queryFilter(
            rsc.filters.ReactHandled(),
            initialBlock,
            currentBlock
        );
        
        // Check for QueryHelper events
        for (const event of reactEvents) {
            const decoded = rsc.interface.decodeEventLog(
                "ReactHandled",
                event.data,
                event.topics
            );
            
            if (decoded.eventSource.toLowerCase() === NEW_QUERY_HELPER.toLowerCase()) {
                found = true;
                console.log("   ✅ RSC RECEIVED THE EVENT!");
                console.log("");
                console.log("   Event Details:");
                console.log(`     Event Source: ${decoded.eventSource}`);
                console.log(`     Topic0: ${decoded.topic0.toString()}`);
                console.log(`     Block: ${event.blockNumber}`);
                console.log(`     Transaction: ${event.transactionHash}`);
                console.log("");
                break;
            }
        }
        
        if (found) break;
        
        // Check StrategyUpdate events (RSC processed the event)
        const strategyEvents = await rsc.queryFilter(
            rsc.filters.StrategyUpdate(),
            initialBlock,
            currentBlock
        );
        
        if (strategyEvents.length > 0) {
            found = true;
            console.log("   ✅ RSC PROCESSED THE EVENT!");
            console.log("");
            
            const latest = strategyEvents[strategyEvents.length - 1];
            const decoded = rsc.interface.decodeEventLog(
                "StrategyUpdate",
                latest.data,
                latest.topics
            );
            
            console.log("   Strategy Update:");
            console.log(`     Aave APY: ${decoded.aaveApy.toString()} bps`);
            console.log(`     Compound APY: ${decoded.compoundApy.toString()} bps`);
            console.log(`     Spread: ${decoded.spread.toString()} bps`);
            console.log(`     Rebalanced: ${decoded.rebalanced ? "✅ YES" : "❌ NO"}`);
            console.log(`     Block: ${latest.blockNumber}`);
            console.log("");
            break;
        }
        
        if (attempt % 3 === 0) {
            console.log(`   ⏳ Still waiting... (${attempt * 10} seconds elapsed)`);
            console.log(`      Checked blocks ${initialBlock} to ${currentBlock}`);
            console.log("");
        }
    }
    
    console.log("=".repeat(70));
    console.log("📊 TEST RESULTS");
    console.log("=".repeat(70));
    console.log("");
    
    if (found) {
        console.log("✅ SUBSCRIPTION IS ACTIVE!");
        console.log("");
        console.log("   RSC successfully received QueryHelper event");
        console.log("   Events are being forwarded by Reactive Network");
        console.log("   System is working correctly!");
        console.log("");
    } else {
        console.log("❌ SUBSCRIPTION NOT ACTIVE (or delayed)");
        console.log("");
        console.log("   RSC did not receive the event after 5 minutes");
        console.log("   Possible reasons:");
        console.log("     • Subscription not active on Reactive Network");
        console.log("     • Reactive Network processing delay (longer than expected)");
        console.log("     • Subscription filters may not match exactly");
        console.log("");
        console.log("   Next steps:");
        console.log("     • Check Reactive Network dashboard/status");
        console.log("     • Try resubscribing");
        console.log("     • Wait longer (some networks have 10-15 minute delays)");
        console.log("");
    }
    
    // Final check - show current status
    console.log("4️⃣  Final Status Check:");
    console.log("");
    
    try {
        const finalBlock = await reactiveProvider.getBlockNumber();
        const finalReactEvents = await rsc.queryFilter(
            rsc.filters.ReactHandled(),
            Math.max(0, finalBlock - 1000)
        );
        
        const queryHelperEvents = finalReactEvents.filter(e => {
            try {
                const decoded = rsc.interface.decodeEventLog(
                    "ReactHandled",
                    e.data,
                    e.topics
                );
                return decoded.eventSource.toLowerCase() === NEW_QUERY_HELPER.toLowerCase();
            } catch {
                return false;
            }
        });
        
        console.log(`   Total ReactHandled events from QueryHelper: ${queryHelperEvents.length}`);
        console.log("");
        
        if (queryHelperEvents.length > 0) {
            console.log("   ✅ RSC has received QueryHelper events!");
        } else {
            console.log("   ❌ RSC has NOT received QueryHelper events");
        }
        
    } catch (error) {
        console.log(`   ⚠️  Could not check final status: ${error.message.split('\n')[0]}`);
    }
    
    console.log("");
}

testSubscriptionActive().catch(console.error);

