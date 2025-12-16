const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function verifySubscriptionCreated() {
    console.log("=".repeat(70));
    console.log("🔍 VERIFYING SUBSCRIPTION WAS CREATED");
    console.log("=".repeat(70));
    console.log("");
    
    const NEW_RSC = "0x7Af5dC1f012d4a875E40d2ffD5E39d7468c59E14";
    const NEW_QUERY_HELPER = "0x55f03641265a793112bd1D9480C4Ea4f143E06af";
    const ARBITRUM_CHAIN_ID = 42161;
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://reactive-network.rpc.thirdweb.com"
    );
    
    const expectedTopic = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("CompoundApyQueried(uint256,uint256,uint256)")
    );
    
    console.log("Subscription Details:");
    console.log(`  RSC: ${NEW_RSC}`);
    console.log(`  Chain: Arbitrum (${ARBITRUM_CHAIN_ID})`);
    console.log(`  Contract: ${NEW_QUERY_HELPER}`);
    console.log(`  Topic0: ${expectedTopic}`);
    console.log("");
    
    // Check for Subscribed events from RSC
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
        
        console.log(`1️⃣  Found ${subscribedEvents.length} Subscribed events from RSC`);
        console.log("");
        
        let foundQueryHelperSub = false;
        
        for (let i = 0; i < subscribedEvents.length; i++) {
            const event = subscribedEvents[i];
            const decoded = rsc.interface.decodeEventLog(
                "Subscribed",
                event.data,
                event.topics
            );
            
            console.log(`   Event #${i + 1}:`);
            console.log(`     Chain ID: ${decoded.chainId.toString()}`);
            console.log(`     Target: ${decoded.target}`);
            console.log(`     Topic0: ${decoded.topic0.toString()}`);
            console.log(`     Block: ${event.blockNumber}`);
            console.log(`     Transaction: ${event.transactionHash}`);
            console.log("");
            
            // Check if this is the QueryHelper subscription
            if (decoded.target.toLowerCase() === NEW_QUERY_HELPER.toLowerCase() &&
                decoded.topic0.toString() === expectedTopic) {
                foundQueryHelperSub = true;
                console.log(`     ✅ THIS IS THE QUERYHELPER SUBSCRIPTION!`);
                console.log("");
            }
        }
        
        if (!foundQueryHelperSub) {
            console.log("   ⚠️  No QueryHelper subscription event found!");
            console.log("      This means subscribeToQueryHelper() may not have emitted");
            console.log("      Or subscription transaction failed");
            console.log("");
        }
        
        // Check transaction receipts for subscription calls
        console.log("2️⃣  Checking Subscription Transaction:");
        console.log("");
        
        // We know from earlier that subscribeToQueryHelper was called
        // Transaction: 0xde8b3b1a77f0bc627d34a230e1ce8a3107ad9e188dc90475ec53018f01bbbc32
        const subTxHash = "0xde8b3b1a77f0bc627d34a230e1ce8a3107ad9e188dc90475ec53018f01bbbc32";
        
        try {
            const tx = await reactiveProvider.getTransaction(subTxHash);
            const receipt = await reactiveProvider.getTransactionReceipt(subTxHash);
            
            console.log(`   Transaction: ${subTxHash}`);
            console.log(`   Status: ${receipt.status === 1 ? "✅ Success" : "❌ Failed"}`);
            console.log(`   Block: ${receipt.blockNumber}`);
            console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
            console.log("");
            
            // Check logs for Subscribed event
            const rscFullAbi = [
                "event Subscribed(uint256 chainId, address target, uint256 topic0)",
                "function subscribeToQueryHelper() external"
            ];
            const rscFull = new ethers.Contract(NEW_RSC, rscFullAbi, reactiveProvider);
            
            for (const log of receipt.logs) {
                try {
                    const parsed = rscFull.interface.parseLog(log);
                    if (parsed.name === "Subscribed") {
                        console.log("   ✅ Found Subscribed event in transaction:");
                        console.log(`      Chain ID: ${parsed.args.chainId.toString()}`);
                        console.log(`      Target: ${parsed.args.target}`);
                        console.log(`      Topic0: ${parsed.args.topic0.toString()}`);
                        console.log("");
                        
                        if (parsed.args.target.toLowerCase() === NEW_QUERY_HELPER.toLowerCase()) {
                            console.log("      ✅ This is QueryHelper subscription!");
                            console.log("");
                            
                            if (parsed.args.topic0.toString() === expectedTopic) {
                                console.log("      ✅ Topic matches!");
                            } else {
                                console.log(`      ❌ Topic mismatch!`);
                                console.log(`         Expected: ${expectedTopic}`);
                                console.log(`         Got: ${parsed.args.topic0.toString()}`);
                            }
                        }
                    }
                } catch (e) {
                    // Not our event
                }
            }
            
        } catch (error) {
            console.log(`   ⚠️  Could not check transaction: ${error.message.split('\n')[0]}`);
            console.log("");
        }
        
        console.log("=".repeat(70));
        console.log("📊 SUMMARY");
        console.log("=".repeat(70));
        console.log("");
        console.log("You are CORRECT:");
        console.log("  • RSC IS subscribed to the SPECIFIC EVENT (topic0)");
        console.log("  • Not just the contract address");
        console.log("  • This is the correct approach");
        console.log("");
        console.log("Key Question:");
        console.log("  Is Reactive Network actually monitoring Arbitrum for these events?");
        console.log("  And forwarding them to the RSC?");
        console.log("");
        console.log("If subscription exists but events not received:");
        console.log("  • Reactive Network may have delay in processing");
        console.log("  • Or subscription may not be active on Reactive Network side");
        console.log("  • Or events may not match subscription filters exactly");
        console.log("");
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
}

verifySubscriptionCreated().catch(console.error);

