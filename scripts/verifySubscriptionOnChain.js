const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function verifySubscriptionOnChain() {
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0x5eBe4dB39B498511c871DCdF3f5D3afD707228c2";
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    const SYSTEM_CONTRACT = "0x0000000000000000000000000000000000fffFfF";
    
    console.log("=".repeat(60));
    console.log("🔍 VERIFYING SUBSCRIPTIONS ON-CHAIN");
    console.log("=".repeat(60));
    console.log("");
    
    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    
    // Check our contract's subscription events
    console.log("1. CHECKING SUBSCRIPTION EVENTS FROM OUR CONTRACT");
    console.log("-".repeat(60));
    
    const RSC_ABI = [
        "event Subscribed(uint256 chainId, address target, uint256 topic0)"
    ];
    
    const rscContract = new ethers.Contract(RSC_ADDRESS, RSC_ABI, provider);
    
    try {
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 50000);
        
        const filter = rscContract.filters.Subscribed();
        const events = await rscContract.queryFilter(filter, fromBlock, currentBlock);
        
        console.log(`   Found ${events.length} Subscribed events`);
        
        if (events.length > 0) {
            events.forEach((event, i) => {
                console.log(`\n   Event ${i + 1}:`);
                console.log(`     Chain ID: ${event.args.chainId.toString()}`);
                console.log(`     Target: ${event.args.target}`);
                console.log(`     Topic0: ${event.args.topic0.toString()}`);
                console.log(`     Block: ${event.blockNumber}`);
            });
        } else {
            console.log("   ❌ No Subscribed events found!");
            console.log("   This means subscriptions might not have been created properly");
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }
    console.log("");
    
    // Check system contract logs
    console.log("2. CHECKING SYSTEM CONTRACT LOGS");
    console.log("-".repeat(60));
    
    try {
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 50000);
        
        // System contract might emit subscription events
        // Check for logs from system contract involving our contract
        const systemLogs = await provider.getLogs({
            address: SYSTEM_CONTRACT,
            fromBlock: fromBlock,
            toBlock: currentBlock,
            topics: [
                null, // any topic0
                ethers.utils.hexZeroPad(RSC_ADDRESS, 32) // topic1 = our contract
            ]
        });
        
        console.log(`   System contract logs involving our contract: ${systemLogs.length}`);
        
        if (systemLogs.length > 0) {
            console.log("\n   Recent system contract interactions:");
            systemLogs.slice(-5).forEach((log, i) => {
                console.log(`\n   ${i + 1}. Block ${log.blockNumber}`);
                console.log(`      TX: ${log.transactionHash}`);
                console.log(`      Topic0: ${log.topics[0]}`);
            });
        }
        
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }
    console.log("");
    
    // Check transaction history
    console.log("3. CHECKING SUBSCRIPTION TRANSACTION HISTORY");
    console.log("-".repeat(60));
    
    try {
        // Get recent transactions to our contract
        const currentBlock = await provider.getBlockNumber();
        
        // We know these transaction hashes from our subscription commands
        const subscriptionTxs = [
            "0xb2338c86b582508fbb95fd6608c12d75c3fb6d1c1a7921e707dab3d77eb6f364", // Aave subscription
            "0x08f5eabd9909bd8c90600e090e6240ec41d04add4f5bc951254abee1007fd30f"  // Compound subscription
        ];
        
        console.log("   Checking subscription transactions...");
        
        for (const txHash of subscriptionTxs) {
            try {
                const receipt = await provider.getTransactionReceipt(txHash);
                if (receipt) {
                    console.log(`\n   ✅ TX: ${txHash}`);
                    console.log(`      Block: ${receipt.blockNumber}`);
                    console.log(`      Status: ${receipt.status === 1 ? "Success" : "Failed"}`);
                    console.log(`      Logs: ${receipt.logs.length}`);
                    
                    // Check for system contract logs in receipt
                    const systemLogs = receipt.logs.filter(log => 
                        log.address.toLowerCase() === SYSTEM_CONTRACT.toLowerCase()
                    );
                    
                    if (systemLogs.length > 0) {
                        console.log(`      System contract logs: ${systemLogs.length} ✅`);
                    } else {
                        console.log(`      System contract logs: 0 ⚠️`);
                    }
                }
            } catch (e) {
                console.log(`   ⚠️  Could not fetch TX: ${txHash}`);
            }
        }
        
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }
    console.log("");
    
    console.log("=".repeat(60));
    console.log("💡 KEY FINDINGS");
    console.log("=".repeat(60));
    console.log("");
    console.log("If Subscribed events exist:");
    console.log("  ✅ Subscriptions were created");
    console.log("  ⚠️  But events still not processed - check Reactscan");
    console.log("");
    console.log("If NO Subscribed events:");
    console.log("  ❌ Subscriptions were NOT created properly");
    console.log("  💡 Need to resubscribe");
    console.log("");
}

verifySubscriptionOnChain().catch(console.error);

