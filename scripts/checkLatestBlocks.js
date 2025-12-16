const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkLatestBlocks() {
    console.log("=".repeat(70));
    console.log("🔍 CHECKING LATEST BLOCKS FOR RSC ACTIVITY");
    console.log("=".repeat(70));
    console.log("");
    
    const NEW_RSC = "0x7Af5dC1f012d4a875E40d2ffD5E39d7468c59E14";
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://reactive-network.rpc.thirdweb.com"
    );
    
    const currentBlock = await reactiveProvider.getBlockNumber();
    console.log(`Current Block: ${currentBlock}`);
    console.log("");
    
    console.log("Checking last 50 blocks for any transactions to RSC...");
    console.log("");
    
    let found = [];
    
    for (let i = 0; i < 50; i++) {
        try {
            const blockNum = currentBlock - i;
            const block = await reactiveProvider.getBlockWithTransactions(blockNum);
            
            for (const tx of block.transactions) {
                if (tx.to && tx.to.toLowerCase() === NEW_RSC.toLowerCase()) {
                    found.push({
                        block: blockNum,
                        tx: tx,
                        timestamp: block.timestamp
                    });
                }
            }
        } catch (e) {
            // Continue
        }
    }
    
    if (found.length === 0) {
        console.log("⚠️  No transactions found in last 50 blocks");
        console.log("");
        console.log("If you saw a transaction on Reactscan, please provide:");
        console.log("  • Transaction hash");
        console.log("  • Block number");
        console.log("  • Or the exact URL");
        return;
    }
    
    // Sort by block (most recent first)
    found.sort((a, b) => b.block - a.block);
    
    console.log(`Found ${found.length} transactions:`);
    console.log("");
    
    const latest = found[0];
    const tx = latest.tx;
    const timeAgo = Math.floor((Date.now() / 1000) - latest.timestamp);
    
    console.log("=".repeat(70));
    console.log("🎯 MOST RECENT TRANSACTION");
    console.log("=".repeat(70));
    console.log("");
    console.log(`Hash: ${tx.hash}`);
    console.log(`Block: ${latest.block}`);
    console.log(`Time: ${timeAgo} seconds ago`);
    console.log(`From: ${tx.from}`);
    console.log(`To: ${tx.to}`);
    console.log(`Value: ${ethers.utils.formatEther(tx.value)} ETH`);
    console.log("");
    
    console.log("=".repeat(70));
    console.log("📊 RAW TRANSACTION DATA");
    console.log("=".repeat(70));
    console.log("");
    console.log(`Data (hex): ${tx.data}`);
    console.log(`Data length: ${tx.data.length} characters`);
    console.log(`Data bytes: ${(tx.data.length - 2) / 2} bytes`);
    console.log("");
    
    if (tx.data && tx.data !== "0x" && tx.data.length >= 10) {
        const functionSelector = tx.data.substring(0, 10);
        const params = tx.data.substring(10);
        
        console.log("Function Breakdown:");
        console.log(`  Selector: ${functionSelector}`);
        console.log(`  Parameters: ${params || "(none)"}`);
        console.log("");
        
        // Decode function selector
        const commonFunctions = {
            "0xab54a967": "initializeStrategy()",
            "0x": "react() - called by Reactive Network (no data)"
        };
        
        if (functionSelector in commonFunctions) {
            console.log(`  ✅ Function: ${commonFunctions[functionSelector]}`);
        } else {
            console.log(`  ⚠️  Unknown function: ${functionSelector}`);
        }
        
        // Decode parameters if present
        if (params && params.length >= 64) {
            try {
                const param1 = ethers.BigNumber.from("0x" + params.substring(0, 64));
                console.log(`  Parameter 1: ${param1.toString()}`);
                
                if (params.length >= 128) {
                    const param2 = ethers.BigNumber.from("0x" + params.substring(64, 128));
                    console.log(`  Parameter 2: ${param2.toString()}`);
                }
            } catch (e) {
                // Not a number
            }
        }
        console.log("");
    }
    
    // Get receipt
    console.log("=".repeat(70));
    console.log("📋 TRANSACTION RECEIPT & LOGS");
    console.log("=".repeat(70));
    console.log("");
    
    try {
        const receipt = await reactiveProvider.getTransactionReceipt(tx.hash);
        
        console.log(`Status: ${receipt.status === 1 ? "✅ Success" : "❌ Failed"}`);
        console.log(`Gas Used: ${receipt.gasUsed.toString()}`);
        console.log(`Logs: ${receipt.logs.length}`);
        console.log("");
        
        if (receipt.logs.length > 0) {
            const rscAbi = [
                "event Callback(uint256 indexed chain_id, address indexed _contract, uint64 indexed gas_limit, bytes payload)",
                "event StrategyUpdate(uint256 aaveApy, uint256 compoundApy, uint256 spread, bool rebalanced)"
            ];
            
            const rsc = new ethers.Contract(NEW_RSC, rscAbi, reactiveProvider);
            
            for (let i = 0; i < receipt.logs.length; i++) {
                const log = receipt.logs[i];
                
                console.log(`Log #${i + 1}:`);
                console.log(`  Address: ${log.address}`);
                console.log(`  Topics: ${log.topics.length}`);
                console.log(`  Topic0: ${log.topics[0]}`);
                console.log(`  Data (full): ${log.data}`);
                console.log("");
                
                // Try to decode
                try {
                    const decoded = rsc.interface.parseLog(log);
                    console.log(`  ✅ Decoded Event: ${decoded.name}`);
                    
                    // Format args
                    const formatted = {};
                    for (const key in decoded.args) {
                        if (isNaN(key)) {
                            const val = decoded.args[key];
                            if (ethers.BigNumber.isBigNumber(val)) {
                                formatted[key] = val.toString();
                            } else if (typeof val === 'string' && val.startsWith('0x')) {
                                formatted[key] = val;
                            } else {
                                formatted[key] = val;
                            }
                        }
                    }
                    
                    console.log(`  Args:`, JSON.stringify(formatted, null, 2));
                    console.log("");
                    
                    // Special handling
                    if (decoded.name === "Callback") {
                        console.log(`  📤 Callback Details:`);
                        console.log(`     Chain ID: ${decoded.args.chain_id.toString()}`);
                        console.log(`     Target Contract: ${decoded.args._contract}`);
                        console.log(`     Gas Limit: ${decoded.args.gas_limit.toString()}`);
                        console.log(`     Payload: ${decoded.args.payload}`);
                        console.log("");
                        
                        // Decode payload
                        try {
                            const payloadIface = new ethers.utils.Interface([
                                "function queryCompoundApy(uint256 nonce)",
                                "function queryBothApys(uint256 nonce)"
                            ]);
                            const decodedPayload = payloadIface.parseTransaction({ data: decoded.args.payload });
                            console.log(`     ✅ Payload Function: ${decodedPayload.name}`);
                            console.log(`     ✅ Payload Nonce: ${decodedPayload.args[0].toString()}`);
                            console.log("");
                        } catch (e) {
                            console.log(`     ⚠️  Payload: ${decoded.args.payload.substring(0, 50)}...`);
                            console.log("");
                        }
                    }
                    
                } catch (e) {
                    console.log(`  ⚠️  Could not decode: ${e.message.split('\n')[0]}`);
                    console.log("");
                }
            }
        }
        
    } catch (error) {
        console.log(`⚠️  Could not get receipt: ${error.message.split('\n')[0]}`);
        console.log("");
    }
    
    console.log("=".repeat(70));
    console.log("💡 SUMMARY");
    console.log("=".repeat(70));
    console.log("");
    console.log("This transaction shows:");
    console.log(`  • Function: ${tx.data.substring(0, 10)}`);
    console.log(`  • Time: ${timeAgo} seconds ago`);
    console.log(`  • Status: ${receipt ? (receipt.status === 1 ? "Success" : "Failed") : "Unknown"}`);
    console.log("");
}

checkLatestBlocks().catch(console.error);

