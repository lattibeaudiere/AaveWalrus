const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkMostRecentReact() {
    console.log("=".repeat(70));
    console.log("🔍 CHECKING MOST RECENT react() CALL");
    console.log("=".repeat(70));
    console.log("");
    
    const NEW_RSC = "0x7Af5dC1f012d4a875E40d2ffD5E39d7468c59E14";
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://reactive-network.rpc.thirdweb.com"
    );
    
    const rscAbi = [
        "event Callback(uint256 indexed chain_id, address indexed _contract, uint64 indexed gas_limit, bytes payload)",
        "event StrategyUpdate(uint256 aaveApy, uint256 compoundApy, uint256 spread, bool rebalanced)",
        "event ReactHandled(uint256 txHash, address eventSource, uint256 topic0)"
    ];
    
    try {
        const rsc = new ethers.Contract(NEW_RSC, rscAbi, reactiveProvider);
        const currentBlock = await reactiveProvider.getBlockNumber();
        
        console.log("Checking for ReactHandled events (these show when react() was called)...");
        console.log("");
        
        // Get ReactHandled events - these show when react() executes
        const reactEvents = await rsc.queryFilter(
            rsc.filters.ReactHandled(),
            Math.max(0, currentBlock - 2000)
        );
        
        if (reactEvents.length === 0) {
            console.log("⚠️  No ReactHandled events found");
            console.log("   Checking all transaction types...");
            console.log("");
            
            // Try to get any transaction to the contract
            const block = await reactiveProvider.getBlock(currentBlock);
            console.log(`Current block: ${currentBlock}`);
            console.log(`Current block time: ${new Date(block.timestamp * 1000).toISOString()}`);
            console.log("");
            
            return;
        }
        
        // Sort by block number (most recent first)
        reactEvents.sort((a, b) => b.blockNumber - a.blockNumber);
        
        const latest = reactEvents[0];
        const txHash = latest.transactionHash;
        
        console.log(`Found ${reactEvents.length} ReactHandled events`);
        console.log(`Most recent: Block ${latest.blockNumber}`);
        console.log("");
        
        // Get block timestamp
        const block = await reactiveProvider.getBlock(latest.blockNumber);
        const timeAgo = Math.floor((Date.now() / 1000) - block.timestamp);
        
        console.log("1️⃣  Most Recent react() Call:");
        console.log("");
        console.log(`   Transaction: ${txHash}`);
        console.log(`   Block: ${latest.blockNumber}`);
        console.log(`   Time: ${timeAgo} seconds ago`);
        console.log(`   Block Time: ${new Date(block.timestamp * 1000).toISOString()}`);
        console.log("");
        
        // Decode the event
        const decoded = rsc.interface.decodeEventLog(
            "ReactHandled",
            latest.data,
            latest.topics
        );
        
        console.log("2️⃣  Event Details:");
        console.log("");
        console.log(`   Origin TX Hash: ${ethers.utils.hexZeroPad(decoded.txHash.toHexString(), 32)}`);
        console.log(`   Event Source: ${decoded.eventSource}`);
        console.log(`   Topic0: ${decoded.topic0}`);
        console.log("");
        
        // Get the transaction
        console.log("3️⃣  Transaction Data:");
        console.log("");
        
        const tx = await reactiveProvider.getTransaction(txHash);
        const receipt = await reactiveProvider.getTransactionReceipt(txHash);
        
        console.log(`   Hash: ${tx.hash}`);
        console.log(`   From: ${tx.from}`);
        console.log(`   To: ${tx.to}`);
        console.log(`   Status: ${receipt.status === 1 ? "✅ Success" : "❌ Failed"}`);
        console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
        console.log("");
        
        console.log("4️⃣  Raw Transaction Data:");
        console.log("");
        console.log(`   Data (hex): ${tx.data}`);
        console.log(`   Function: ${tx.data.substring(0, 10)}`);
        console.log("");
        
        // Decode function
        if (tx.data === "0x" || tx.data.length < 10) {
            console.log("   No function call (plain transfer)");
        } else {
            const functionSelector = tx.data.substring(0, 10);
            
            // Common functions
            const functions = {
                "0xab54a967": "initializeStrategy()",
                "0x": "react() - called by Reactive Network VM"
            };
            
            if (functionSelector in functions) {
                console.log(`   ✅ Function: ${functions[functionSelector]}`);
            } else {
                console.log(`   Function selector: ${functionSelector}`);
            }
            
            if (tx.data.length > 10) {
                const params = tx.data.substring(10);
                console.log(`   Parameters: ${params}`);
            }
        }
        console.log("");
        
        console.log("5️⃣  All Logs from This Transaction:");
        console.log("");
        
        for (let i = 0; i < receipt.logs.length; i++) {
            const log = receipt.logs[i];
            
            console.log(`   Log #${i + 1}:`);
            console.log(`     Address: ${log.address}`);
            console.log(`     Topic0: ${log.topics[0]}`);
            console.log(`     Data: ${log.data.substring(0, 100)}${log.data.length > 100 ? '...' : ''}`);
            console.log("");
            
            // Try to decode
            try {
                const decoded = rsc.interface.parseLog(log);
                console.log(`     ✅ Decoded: ${decoded.name}`);
                
                if (decoded.name === "Callback") {
                    console.log(`        Chain ID: ${decoded.args.chain_id.toString()}`);
                    console.log(`        Target: ${decoded.args._contract}`);
                    console.log(`        Payload: ${decoded.args.payload.substring(0, 50)}...`);
                    
                    // Try to decode payload
                    try {
                        const payloadIface = new ethers.utils.Interface([
                            "function queryCompoundApy(uint256 nonce)",
                            "function queryBothApys(uint256 nonce)"
                        ]);
                        const decodedPayload = payloadIface.parseTransaction({ data: decoded.args.payload });
                        console.log(`        ✅ Payload calls: ${decodedPayload.name}(${decodedPayload.args[0].toString()})`);
                    } catch (e) {
                        // Not a standard function
                    }
                }
                
                if (decoded.name === "StrategyUpdate") {
                    console.log(`        Aave APY: ${decoded.args.aaveApy.toString()} bps`);
                    console.log(`        Compound APY: ${decoded.args.compoundApy.toString()} bps`);
                    console.log(`        Spread: ${decoded.args.spread.toString()} bps`);
                    console.log(`        Rebalanced: ${decoded.args.rebalanced}`);
                }
                
                console.log("");
            } catch (e) {
                // Not our event
            }
        }
        
        console.log("=".repeat(70));
        console.log("📊 WHAT THE RAW DATA SAYS");
        console.log("=".repeat(70));
        console.log("");
        console.log("This transaction shows:");
        console.log(`  • Function called: ${tx.data.substring(0, 10)}`);
        console.log(`  • Event source: ${decoded.eventSource}`);
        console.log(`  • Event topic: ${decoded.topic0}`);
        console.log(`  • Time: ${timeAgo} seconds ago`);
        console.log("");
        
        if (timeAgo <= 60) {
            console.log("✅ This is a VERY RECENT transaction!");
        }
        console.log("");
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        if (error.stack) {
            console.log(error.stack);
        }
    }
}

checkMostRecentReact().catch(console.error);

