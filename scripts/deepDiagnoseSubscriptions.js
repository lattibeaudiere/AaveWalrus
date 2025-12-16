const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function deepDiagnoseSubscriptions() {
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0x5eBe4dB39B498511c871DCdF3f5D3afD707228c2";
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    const ARBITRUM_RPC = "https://arb1.arbitrum.io/rpc";
    
    console.log("=".repeat(60));
    console.log("🔬 DEEP DIAGNOSIS: Why Events Aren't Processing");
    console.log("=".repeat(60));
    console.log(`Contract: ${RSC_ADDRESS}`);
    console.log("");
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);
    
    // 1. Check what we're subscribed to
    console.log("1. OUR SUBSCRIPTION PARAMETERS");
    console.log("-".repeat(60));
    
    const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
    const RESERVE_DATA_UPDATED = "0x804c9b842b2748a22bb64b345453a3de7ca54a6ca45ce00d415894979e22897a";
    const REACTIVE_IGNORE = "0xa65f96fc951c35ead38878e0f0b7a3c744a6f5ccc1476b313353ce31712313ad";
    
    console.log("   Chain ID: 42161");
    console.log(`   Contract: ${AAVE_POOL}`);
    console.log(`   Topic0: ${RESERVE_DATA_UPDATED}`);
    console.log(`   Topic1: ${REACTIVE_IGNORE} (matches ANY)`);
    console.log(`   Topic2: ${REACTIVE_IGNORE} (matches ANY)`);
    console.log(`   Topic3: ${REACTIVE_IGNORE} (matches ANY)`);
    console.log("");
    
    // 2. Get a recent Aave event and check its exact structure
    console.log("2. RECENT AAVE EVENT STRUCTURE");
    console.log("-".repeat(60));
    
    try {
        const currentBlock = await arbitrumProvider.getBlockNumber();
        const fromBlock = currentBlock - 5000;
        
        const aaveFilter = {
            address: AAVE_POOL,
            topics: [RESERVE_DATA_UPDATED],
            fromBlock: fromBlock,
            toBlock: currentBlock
        };
        
        const events = await arbitrumProvider.getLogs(aaveFilter);
        
        if (events.length > 0) {
            const event = events[events.length - 1];
            console.log(`   ✅ Found event at block ${event.blockNumber}`);
            console.log(`   TX: ${event.transactionHash}`);
            console.log(`   Log Index: ${event.logIndex}`);
            console.log("");
            console.log("   Event Topics:");
            console.log(`     Topic0: ${event.topics[0]}`);
            console.log(`     Topic1: ${event.topics[1] || "None"}`);
            console.log(`     Topic2: ${event.topics[2] || "None"}`);
            console.log(`     Topic3: ${event.topics[3] || "None"}`);
            console.log(`     Data: ${event.data}`);
            console.log("");
            
            // Check if topic0 matches exactly
            if (event.topics[0].toLowerCase() === RESERVE_DATA_UPDATED.toLowerCase()) {
                console.log("   ✅ Topic0 MATCHES our subscription");
            } else {
                console.log("   ❌ Topic0 DOES NOT MATCH!");
                console.log(`      Expected: ${RESERVE_DATA_UPDATED}`);
                console.log(`      Got: ${event.topics[0]}`);
            }
            
            // Parse the event to see what reserve it's for
            const aaveInterface = new ethers.utils.Interface([
                "event ReserveDataUpdated(address indexed reserve, uint256 liquidityRate, uint256 stableBorrowRate, uint256 variableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex)"
            ]);
            
            try {
                const parsed = aaveInterface.parseLog(event);
                console.log(`\n   Parsed Event:`);
                console.log(`     Reserve: ${parsed.args.reserve}`);
                console.log(`     Liquidity Rate: ${parsed.args.liquidityRate.toString()}`);
                
                // Check if it's USDC
                const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
                if (parsed.args.reserve.toLowerCase() === USDC.toLowerCase()) {
                    console.log("     ✅ This is a USDC event!");
                } else {
                    console.log(`     ⚠️  This is NOT USDC - it's for ${parsed.args.reserve}`);
                    console.log(`     💡 Our subscription uses REACTIVE_IGNORE, so it should match ALL reserves`);
                }
            } catch (e) {
                console.log(`   ⚠️  Could not parse event: ${e.message}`);
            }
            
        } else {
            console.log("   ❌ No events found in last 5000 blocks");
        }
        
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }
    console.log("");
    
    // 3. Check subscription events from our contract
    console.log("3. VERIFYING SUBSCRIPTION WAS CREATED");
    console.log("-".repeat(60));
    
    const RSC_ABI = [
        "event Subscribed(uint256 chainId, address target, uint256 topic0)"
    ];
    
    const rscContract = new ethers.Contract(RSC_ADDRESS, RSC_ABI, reactiveProvider);
    
    try {
        const currentBlock = await reactiveProvider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 100000);
        
        const filter = rscContract.filters.Subscribed();
        const events = await rscContract.queryFilter(filter, fromBlock, currentBlock);
        
        console.log(`   Found ${events.length} Subscribed events`);
        
        if (events.length > 0) {
            console.log("\n   Subscription Events:");
            events.forEach((event, i) => {
                console.log(`\n   ${i + 1}. Block ${event.blockNumber}`);
                console.log(`      Chain ID: ${event.args.chainId.toString()}`);
                console.log(`      Target: ${event.args.target}`);
                console.log(`      Topic0: ${event.args.topic0.toString()}`);
                
                // Check if it matches
                if (event.args.chainId.toString() === "42161" &&
                    event.args.target.toLowerCase() === AAVE_POOL.toLowerCase() &&
                    event.args.topic0.toString().toLowerCase() === RESERVE_DATA_UPDATED.toLowerCase()) {
                    console.log(`      ✅ MATCHES our Aave subscription!`);
                } else {
                    console.log(`      ⚠️  Does not match our expected subscription`);
                }
            });
        } else {
            console.log("   ❌ NO Subscribed events found!");
            console.log("   This means subscriptions were NOT created properly");
        }
        
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }
    console.log("");
    
    // 4. Critical check: Verify the exact subscription format
    console.log("4. CRITICAL: VERIFYING SUBSCRIPTION FORMAT");
    console.log("-".repeat(60));
    console.log("");
    console.log("According to Reactive Network docs:");
    console.log("  - Subscriptions match events based on exact topic matching");
    console.log("  - REACTIVE_IGNORE = wildcard (matches any)");
    console.log("  - Events are forwarded when ALL topics match");
    console.log("");
    console.log("Our subscription:");
    console.log(`  Chain: 42161`);
    console.log(`  Address: ${AAVE_POOL}`);
    console.log(`  Topic0: ${RESERVE_DATA_UPDATED}`);
    console.log(`  Topic1-3: ${REACTIVE_IGNORE} (any)`);
    console.log("");
    console.log("💡 This should match ALL ReserveDataUpdated events from Aave Pool");
    console.log("   If events aren't being forwarded, possible issues:");
    console.log("   1. Subscription not actually active on Reactive Network");
    console.log("   2. Reactive Network requires exact topic matching (no wildcards?)");
    console.log("   3. System contract subscription failed silently");
    console.log("   4. Event signature doesn't match exactly");
    console.log("");
    
    // 5. Check if we can query Reactive Network directly
    console.log("5. NEXT STEPS TO RESOLVE");
    console.log("-".repeat(60));
    console.log("");
    console.log("1. Check Reactscan (most important):");
    console.log(`   https://reactscan.io/address/${RSC_ADDRESS}`);
    console.log("   Look for:");
    console.log("   - Active subscriptions listed");
    console.log("   - Recent event processing");
    console.log("   - Any error messages");
    console.log("");
    console.log("2. Try resubscribing with USDC-specific filter:");
    console.log("   This would filter to only USDC events");
    console.log("");
    console.log("3. Verify system contract subscription succeeded:");
    console.log("   Check transaction receipts for system contract interactions");
    console.log("");
}

deepDiagnoseSubscriptions().catch(console.error);

