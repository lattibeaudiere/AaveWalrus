const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function getLatestRSCTransactionDirect() {
    console.log("=".repeat(70));
    console.log("🔍 GETTING LATEST RSC TRANSACTION");
    console.log("=".repeat(70));
    console.log("");
    
    const NEW_RSC = "0x7Af5dC1f012d4a875E40d2ffD5E39d7468c59E14";
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://reactive-network.rpc.thirdweb.com"
    );
    
    console.log("Method: Check events to find transaction hash");
    console.log("");
    
    const rscAbi = [
        "event Callback(uint256 indexed chain_id, address indexed _contract, uint64 indexed gas_limit, bytes payload)",
        "event StrategyUpdate(uint256 aaveApy, uint256 compoundApy, uint256 spread, bool rebalanced)",
        "event ReactHandled(uint256 txHash, address eventSource, uint256 topic0)"
    ];
    
    try {
        const rsc = new ethers.Contract(NEW_RSC, rscAbi, reactiveProvider);
        const currentBlock = await reactiveProvider.getBlockNumber();
        
        // Get all events from a wide range
        console.log("1️⃣  Finding Most Recent Events:");
        console.log("");
        
        const allCallbacks = await rsc.queryFilter(
            rsc.filters.Callback(),
            Math.max(0, currentBlock - 5000)
        );
        
        const allStrategy = await rsc.queryFilter(
            rsc.filters.StrategyUpdate(),
            Math.max(0, currentBlock - 5000)
        );
        
        const allReact = await rsc.queryFilter(
            rsc.filters.ReactHandled(),
            Math.max(0, currentBlock - 5000)
        );
        
        // Combine and sort by block number
        const allEvents = [
            ...allCallbacks.map(e => ({ type: 'Callback', event: e })),
            ...allStrategy.map(e => ({ type: 'StrategyUpdate', event: e })),
            ...allReact.map(e => ({ type: 'ReactHandled', event: e }))
        ].sort((a, b) => b.event.blockNumber - a.event.blockNumber);
        
        if (allEvents.length === 0) {
            console.log("   ⚠️  No events found");
            console.log("   Please provide the transaction hash you saw");
            return;
        }
        
        const latest = allEvents[0];
        const txHash = latest.event.transactionHash;
        
        console.log(`   Latest Event: ${latest.type}`);
        console.log(`   Transaction: ${txHash}`);
        console.log(`   Block: ${latest.event.blockNumber}`);
        console.log("");
        
        // Get the transaction
        console.log("2️⃣  Getting Transaction Details:");
        console.log("");
        
        const tx = await reactiveProvider.getTransaction(txHash);
        const receipt = await reactiveProvider.getTransactionReceipt(txHash);
        
        console.log(`   Hash: ${tx.hash}`);
        console.log(`   From: ${tx.from}`);
        console.log(`   To: ${tx.to}`);
        console.log(`   Block: ${tx.blockNumber}`);
        console.log(`   Status: ${receipt.status === 1 ? "✅ Success" : "❌ Failed"}`);
        console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
        console.log("");
        
        console.log("3️⃣  Raw Transaction Data:");
        console.log("");
        console.log(`   Data (hex): ${tx.data}`);
        console.log(`   Data length: ${tx.data.length} characters (${(tx.data.length - 2) / 2} bytes)`);
        console.log("");
        
        if (tx.data && tx.data !== "0x" && tx.data.length >= 10) {
            const functionSelector = tx.data.substring(0, 10);
            const params = tx.data.substring(10);
            
            console.log(`   Function Selector: ${functionSelector}`);
            console.log(`   Parameters: ${params}`);
            console.log("");
            
            // Decode parameters
            if (params.length >= 64) {
                const param1 = ethers.BigNumber.from("0x" + params.substring(0, 64));
                console.log(`   Parameter 1: ${param1.toString()}`);
                
                if (params.length >= 128) {
                    const param2 = ethers.BigNumber.from("0x" + params.substring(64, 128));
                    console.log(`   Parameter 2: ${param2.toString()}`);
                }
            }
            console.log("");
        }
        
        console.log("4️⃣  Decoding Event Logs:");
        console.log("");
        
        for (let i = 0; i < receipt.logs.length; i++) {
            const log = receipt.logs[i];
            
            console.log(`   Log #${i + 1}:`);
            console.log(`     Address: ${log.address}`);
            console.log(`     Topic0: ${log.topics[0]}`);
            
            if (log.topics.length > 1) {
                console.log(`     Topic1: ${log.topics[1]}`);
            }
            if (log.topics.length > 2) {
                console.log(`     Topic2: ${log.topics[2]}`);
            }
            
            console.log(`     Data (raw): ${log.data}`);
            console.log(`     Data length: ${log.data.length} characters`);
            console.log("");
            
            // Try to decode
            try {
                const decoded = rsc.interface.parseLog(log);
                console.log(`     ✅ Decoded: ${decoded.name}`);
                
                // Format args
                const args = {};
                for (const key in decoded.args) {
                    if (isNaN(key)) { // Skip array indices
                        const value = decoded.args[key];
                        if (ethers.BigNumber.isBigNumber(value)) {
                            args[key] = value.toString();
                        } else {
                            args[key] = value;
                        }
                    }
                }
                
                console.log(`     Args:`, JSON.stringify(args, null, 2));
                console.log("");
                
                // Special handling for Callback event
                if (decoded.name === "Callback") {
                    console.log(`     📤 Callback Details:`);
                    console.log(`        Chain ID: ${decoded.args.chain_id.toString()}`);
                    console.log(`        Target: ${decoded.args._contract}`);
                    console.log(`        Gas Limit: ${decoded.args.gas_limit.toString()}`);
                    console.log(`        Payload: ${decoded.args.payload}`);
                    console.log("");
                    
                    // Try to decode payload
                    try {
                        const payloadIface = new ethers.utils.Interface([
                            "function queryCompoundApy(uint256 nonce)",
                            "function queryBothApys(uint256 nonce)"
                        ]);
                        const decodedPayload = payloadIface.parseTransaction({ data: decoded.args.payload });
                        console.log(`        ✅ Payload Function: ${decodedPayload.name}`);
                        console.log(`        ✅ Payload Nonce: ${decodedPayload.args[0].toString()}`);
                        console.log("");
                    } catch (e) {
                        console.log(`        ⚠️  Could not decode payload: ${e.message.split('\n')[0]}`);
                        console.log("");
                    }
                }
                
                // Special handling for StrategyUpdate
                if (decoded.name === "StrategyUpdate") {
                    console.log(`     📊 Strategy Update:`);
                    console.log(`        Aave APY: ${decoded.args.aaveApy.toString()} bps`);
                    console.log(`        Compound APY: ${decoded.args.compoundApy.toString()} bps`);
                    console.log(`        Spread: ${decoded.args.spread.toString()} bps`);
                    console.log(`        Rebalanced: ${decoded.args.rebalanced}`);
                    console.log("");
                }
                
            } catch (e) {
                console.log(`     ⚠️  Could not decode: ${e.message.split('\n')[0]}`);
                console.log("");
            }
        }
        
        console.log("=".repeat(70));
        console.log("📊 WHAT THE RAW DATA SAYS");
        console.log("=".repeat(70));
        console.log("");
        console.log("Transaction Function:");
        console.log(`  ${tx.data.substring(0, 10)} - Function selector`);
        console.log(`  ${tx.data.substring(10)} - Parameters`);
        console.log("");
        console.log("Events Emitted:");
        for (const event of allEvents.slice(0, 3)) {
            console.log(`  • ${event.type} at block ${event.event.blockNumber}`);
        }
        console.log("");
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        if (error.stack) {
            console.log(error.stack);
        }
    }
}

getLatestRSCTransactionDirect().catch(console.error);

