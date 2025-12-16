const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function analyzeLatestRSCTransaction() {
    console.log("=".repeat(70));
    console.log("🔍 ANALYZING MOST RECENT RSC TRANSACTION");
    console.log("=".repeat(70));
    console.log("");
    
    const NEW_RSC = "0x7Af5dC1f012d4a875E40d2ffD5E39d7468c59E14";
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://reactive-network.rpc.thirdweb.com"
    );
    
    console.log("RSC Address:", NEW_RSC);
    console.log("");
    
    try {
        // Get recent transactions to this contract
        const currentBlock = await reactiveProvider.getBlockNumber();
        console.log(`Current Block: ${currentBlock}`);
        console.log("");
        
        // Try to get recent transactions
        // We'll check the last 1000 blocks for transactions to RSC
        console.log("1️⃣  Searching for Recent Transactions:");
        console.log("");
        
        // Get contract creation block to know where to start
        const code = await reactiveProvider.getCode(NEW_RSC);
        if (code === "0x") {
            console.log("❌ Contract not found or not deployed");
            return;
        }
        
        // Search backwards for transactions
        let foundTx = null;
        const searchBlocks = 2000;
        
        for (let blockNum = currentBlock; blockNum > Math.max(0, currentBlock - searchBlocks); blockNum--) {
            try {
                const block = await reactiveProvider.getBlockWithTransactions(blockNum);
                
                for (const tx of block.transactions) {
                    if (tx.to && tx.to.toLowerCase() === NEW_RSC.toLowerCase()) {
                        foundTx = tx;
                        break;
                    }
                }
                
                if (foundTx) break;
            } catch (e) {
                // Continue searching
            }
        }
        
        if (!foundTx) {
            console.log("⚠️  No recent transactions found");
            console.log("   Trying alternative method...");
            console.log("");
            
            // Try checking events instead
            const rscAbi = [
                "event Callback(uint256 indexed chain_id, address indexed _contract, uint64 indexed gas_limit, bytes payload)",
                "event StrategyUpdate(uint256 aaveApy, uint256 compoundApy, uint256 spread, bool rebalanced)",
                "event ReactHandled(uint256 txHash, address eventSource, uint256 topic0)"
            ];
            
            const rsc = new ethers.Contract(NEW_RSC, rscAbi, reactiveProvider);
            
            // Get all events
            const allCallbacks = await rsc.queryFilter(
                rsc.filters.Callback(),
                Math.max(0, currentBlock - 5000)
            );
            
            if (allCallbacks.length > 0) {
                const latest = allCallbacks[allCallbacks.length - 1];
                const receipt = await reactiveProvider.getTransactionReceipt(latest.transactionHash);
                
                foundTx = await reactiveProvider.getTransaction(latest.transactionHash);
                
                console.log("✅ Found transaction via event:");
                console.log(`   Transaction: ${foundTx.hash}`);
                console.log("");
            }
        }
        
        if (!foundTx) {
            console.log("❌ Could not find recent transaction");
            console.log("   Please provide transaction hash if you have it");
            return;
        }
        
        console.log("2️⃣  Transaction Details:");
        console.log("");
        console.log(`   Hash: ${foundTx.hash}`);
        console.log(`   From: ${foundTx.from}`);
        console.log(`   To: ${foundTx.to}`);
        console.log(`   Block Number: ${foundTx.blockNumber || "Pending"}`);
        console.log(`   Gas Limit: ${foundTx.gasLimit.toString()}`);
        console.log(`   Gas Price: ${foundTx.gasPrice ? foundTx.gasPrice.toString() : "N/A"}`);
        console.log(`   Value: ${ethers.utils.formatEther(foundTx.value)} ETH`);
        console.log("");
        
        console.log("3️⃣  Raw Transaction Data:");
        console.log("");
        console.log(`   Data (hex): ${foundTx.data}`);
        console.log(`   Data length: ${foundTx.data.length} characters`);
        console.log(`   Data bytes: ${(foundTx.data.length - 2) / 2} bytes`);
        console.log("");
        
        // Try to decode the data
        console.log("4️⃣  Decoding Transaction Data:");
        console.log("");
        
        if (foundTx.data === "0x" || foundTx.data.length < 10) {
            console.log("   No function call data (plain ETH transfer or contract creation)");
        } else {
            const functionSelector = foundTx.data.substring(0, 10);
            console.log(`   Function Selector: ${functionSelector}`);
            console.log("");
            
            // Try common function signatures
            const commonFunctions = {
                "0xcb3dd0fd": "queryCompoundApy(uint256)",
                "0x1249c58b": "queryBothApys(uint256)",
                "0x": "Unknown or no function call"
            };
            
            if (functionSelector in commonFunctions) {
                console.log(`   ✅ Function: ${commonFunctions[functionSelector]}`);
            } else {
                console.log(`   ⚠️  Unknown function selector`);
            }
            
            // Decode parameters
            if (foundTx.data.length > 10) {
                const params = foundTx.data.substring(10);
                console.log(`   Parameters (hex): ${params}`);
                
                // Try to decode as uint256
                if (params.length >= 64) {
                    const param1 = ethers.BigNumber.from("0x" + params.substring(0, 64));
                    console.log(`   Parameter 1 (uint256): ${param1.toString()}`);
                    
                    if (params.length >= 128) {
                        const param2 = ethers.BigNumber.from("0x" + params.substring(64, 128));
                        console.log(`   Parameter 2 (uint256): ${param2.toString()}`);
                    }
                }
            }
            console.log("");
        }
        
        // Get transaction receipt for logs
        console.log("5️⃣  Transaction Receipt & Logs:");
        console.log("");
        
        try {
            const receipt = await reactiveProvider.getTransactionReceipt(foundTx.hash);
            
            console.log(`   Status: ${receipt.status === 1 ? "✅ Success" : "❌ Failed"}`);
            console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
            console.log(`   Block: ${receipt.blockNumber}`);
            console.log(`   Logs: ${receipt.logs.length}`);
            console.log("");
            
            if (receipt.logs.length > 0) {
                console.log("   Event Logs:");
                console.log("");
                
                const rscAbi = [
                    "event Callback(uint256 indexed chain_id, address indexed _contract, uint64 indexed gas_limit, bytes payload)",
                    "event StrategyUpdate(uint256 aaveApy, uint256 compoundApy, uint256 spread, bool rebalanced)",
                    "event ReactHandled(uint256 txHash, address eventSource, uint256 topic0)",
                    "event Subscribed(uint256 chainId, address target, uint256 topic0)"
                ];
                
                const rsc = new ethers.Contract(NEW_RSC, rscAbi, reactiveProvider);
                
                for (let i = 0; i < receipt.logs.length; i++) {
                    const log = receipt.logs[i];
                    
                    console.log(`   Log #${i + 1}:`);
                    console.log(`     Address: ${log.address}`);
                    console.log(`     Topics: ${log.topics.length}`);
                    console.log(`     Topic0: ${log.topics[0]}`);
                    
                    if (log.topics.length > 1) {
                        console.log(`     Topic1: ${log.topics[1]}`);
                    }
                    if (log.topics.length > 2) {
                        console.log(`     Topic2: ${log.topics[2]}`);
                    }
                    
                    console.log(`     Data length: ${log.data.length} characters`);
                    console.log(`     Data (first 100 chars): ${log.data.substring(0, 100)}...`);
                    console.log("");
                    
                    // Try to decode
                    try {
                        const decoded = rsc.interface.parseLog(log);
                        console.log(`     ✅ Decoded Event: ${decoded.name}`);
                        console.log(`     Args:`, JSON.stringify(decoded.args, (key, value) => {
                            if (typeof value === 'object' && value.type === 'BigNumber') {
                                return value.toString();
                            }
                            return value;
                        }, 2));
                        console.log("");
                    } catch (e) {
                        // Not our event or can't decode
                        console.log(`     ⚠️  Could not decode as RSC event`);
                        console.log("");
                    }
                }
            }
            
        } catch (error) {
            console.log(`   ⚠️  Could not get receipt: ${error.message.split('\n')[0]}`);
            console.log("");
        }
        
        // Also check if this is a reactive call (from Reactive Network VM)
        console.log("6️⃣  Transaction Analysis:");
        console.log("");
        
        if (foundTx.from && foundTx.from.toLowerCase() === "0x0000000000000000000000000000000000000000".toLowerCase()) {
            console.log("   ✅ This is a Reactive Network VM call");
            console.log("      Reactive Network is executing react() function");
        } else {
            console.log(`   From: ${foundTx.from}`);
            console.log(`   This appears to be a direct transaction`);
        }
        console.log("");
        
        console.log("=".repeat(70));
        console.log("📊 SUMMARY");
        console.log("=".repeat(70));
        console.log("");
        console.log("Raw Data Breakdown:");
        console.log(`  Function: ${foundTx.data.substring(0, 10)}`);
        console.log(`  Parameters: ${foundTx.data.substring(10)}`);
        console.log("");
        console.log("This transaction shows:");
        console.log("  • What function was called");
        console.log("  • What parameters were passed");
        console.log("  • What events were emitted");
        console.log("  • What the RSC did in response");
        console.log("");
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        console.log(error.stack);
    }
}

analyzeLatestRSCTransaction().catch(console.error);

