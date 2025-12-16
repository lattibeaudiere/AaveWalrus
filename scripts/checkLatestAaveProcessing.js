const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkLatestAaveProcessing() {
    console.log("=".repeat(70));
    console.log("🔍 CHECKING LATEST AAVE EVENT PROCESSING");
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
    
    // Check the very latest blocks
    const reactiveBlock = await reactiveProvider.getBlockNumber();
    
    console.log("Checking LAST 100 blocks for recent activity...");
    console.log(`Current Reactive Network block: ${reactiveBlock}`);
    console.log("");
    
    const rscAbi = [
        "event Callback(uint256 indexed chain_id, address indexed _contract, uint64 indexed gas_limit, bytes payload)",
        "event StrategyUpdate(uint256 aaveApy, uint256 compoundApy, uint256 spread, bool rebalanced)"
    ];
    
    try {
        const rsc = new ethers.Contract(NEW_RSC, rscAbi, reactiveProvider);
        
        // Check last 100 blocks (very recent)
        const callbacks = await rsc.queryFilter(
            rsc.filters.Callback(),
            Math.max(0, reactiveBlock - 100)
        );
        
        console.log(`Found ${callbacks.length} Callback events in last 100 blocks`);
        console.log("");
        
        if (callbacks.length > 0) {
            for (let i = 0; i < callbacks.length; i++) {
                const event = callbacks[i];
                const decoded = rsc.interface.decodeEventLog(
                    "Callback",
                    event.data,
                    event.topics
                );
                
                const block = await reactiveProvider.getBlock(event.blockNumber);
                const timeAgo = Math.floor((Date.now() / 1000) - block.timestamp);
                
                console.log(`Callback #${i + 1}:`);
                console.log(`  Target: ${decoded._contract}`);
                console.log(`  Function: ${decoded.payload.substring(0, 10)}`);
                console.log(`  Block: ${event.blockNumber}`);
                console.log(`  Time: ${timeAgo} seconds ago`);
                console.log(`  TX: ${event.transactionHash}`);
                console.log("");
                
                // Decode if it's QueryHelper
                if (decoded._contract.toLowerCase() === NEW_QUERY_HELPER.toLowerCase()) {
                    try {
                        const iface = new ethers.utils.Interface([
                            "function queryCompoundApy(uint256 nonce)",
                            "function queryBothApys(uint256 nonce)"
                        ]);
                        const decodedPayload = iface.parseTransaction({ data: decoded.payload });
                        console.log(`  ✅ Function: ${decodedPayload.name}`);
                        console.log(`  ✅ Nonce: ${decodedPayload.args[0].toString()}`);
                        console.log("");
                    } catch (e) {
                        // Not a standard function call
                    }
                }
            }
        } else {
            console.log("No recent callbacks found");
            console.log("Checking if events are being processed differently...");
            console.log("");
        }
        
        // Check StrategyUpdate
        const strategyEvents = await rsc.queryFilter(
            rsc.filters.StrategyUpdate(),
            Math.max(0, reactiveBlock - 100)
        );
        
        console.log(`Found ${strategyEvents.length} StrategyUpdate events in last 100 blocks`);
        console.log("");
        
        if (strategyEvents.length > 0) {
            const latest = strategyEvents[strategyEvents.length - 1];
            const decoded = rsc.interface.decodeEventLog(
                "StrategyUpdate",
                latest.data,
                latest.topics
            );
            
            const block = await reactiveProvider.getBlock(latest.blockNumber);
            const timeAgo = Math.floor((Date.now() / 1000) - block.timestamp);
            
            console.log("Latest Strategy Update:");
            console.log(`  Aave APY: ${decoded.aaveApy.toString()} bps`);
            console.log(`  Compound APY: ${decoded.compoundApy.toString()} bps`);
            console.log(`  Spread: ${decoded.spread.toString()} bps`);
            console.log(`  Rebalanced: ${decoded.rebalanced ? "✅ YES" : "❌ NO"}`);
            console.log(`  Block: ${latest.blockNumber}`);
            console.log(`  Time: ${timeAgo} seconds ago`);
            console.log(`  TX: ${latest.transactionHash}`);
            console.log("");
        }
        
    } catch (error) {
        console.log(`Error: ${error.message.split('\n')[0]}`);
    }
    
    // Also check Arbitrum for QueryHelper executions
    console.log("Checking QueryHelper for recent executions...");
    console.log("");
    
    try {
        const queryHelperAbi = [
            "event CompoundApyQueried(uint256 indexed nonce, uint256 apyBps, uint256 timestamp)"
        ];
        
        const queryHelper = new ethers.Contract(NEW_QUERY_HELPER, queryHelperAbi, arbitrumProvider);
        const arbBlock = await arbitrumProvider.getBlockNumber();
        
        const events = await queryHelper.queryFilter(
            queryHelper.filters.CompoundApyQueried(),
            Math.max(0, arbBlock - 1000)
        );
        
        console.log(`Found ${events.length} QueryHelper events in last 1000 blocks`);
        console.log("");
        
        if (events.length > 0) {
            const latest = events[events.length - 1];
            const decoded = queryHelper.interface.decodeEventLog(
                "CompoundApyQueried",
                latest.data,
                latest.topics
            );
            
            const block = await arbitrumProvider.getBlock(latest.blockNumber);
            const timeAgo = Math.floor((Date.now() / 1000) - block.timestamp);
            
            console.log("Latest QueryHelper Event:");
            console.log(`  Nonce: ${decoded.nonce.toString()}`);
            console.log(`  APY: ${decoded.apyBps.toString()} bps`);
            console.log(`  Block: ${latest.blockNumber}`);
            console.log(`  Time: ${timeAgo} seconds ago`);
            console.log(`  TX: ${latest.transactionHash}`);
            console.log("");
        }
        
    } catch (error) {
        console.log(`Error: ${error.message.split('\n')[0]}`);
    }
    
    console.log("=".repeat(70));
    console.log("💡 IF YOU SAW AN EVENT PROCESSED 11 SECONDS AGO:");
    console.log("=".repeat(70));
    console.log("");
    console.log("This means:");
    console.log("  ✅ RSC is receiving Aave events");
    console.log("  ✅ RSC is processing them");
    console.log("  ✅ Callbacks are being sent");
    console.log("");
    console.log("Next steps:");
    console.log("  1. Check if QueryHelper executed the callback");
    console.log("  2. Check if RSC received the CompoundApyQueried event");
    console.log("  3. Check if StrategyUpdate was emitted");
    console.log("  4. Check if capital was deployed");
    console.log("");
}

checkLatestAaveProcessing().catch(console.error);

