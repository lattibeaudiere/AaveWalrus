const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkSpecificEvent() {
    console.log("=".repeat(70));
    console.log("🔍 CHECKING SPECIFIC EVENT PROCESSING");
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
    
    // Check recent blocks
    const reactiveBlock = await reactiveProvider.getBlockNumber();
    const arbBlock = await arbitrumProvider.getBlockNumber();
    
    console.log("Current Block Numbers:");
    console.log(`  Reactive Network: ${reactiveBlock}`);
    console.log(`  Arbitrum: ${arbBlock}`);
    console.log("");
    
    console.log("1️⃣  Checking RSC Callbacks (last 2000 blocks):");
    console.log("");
    
    const rscAbi = [
        "event Callback(uint256 indexed chain_id, address indexed _contract, uint64 indexed gas_limit, bytes payload)",
        "event StrategyUpdate(uint256 aaveApy, uint256 compoundApy, uint256 spread, bool rebalanced)",
        "event ReactHandled(uint256 txHash, address eventSource, uint256 topic0)"
    ];
    
    try {
        const rsc = new ethers.Contract(NEW_RSC, rscAbi, reactiveProvider);
        
        const callbacks = await rsc.queryFilter(
            rsc.filters.Callback(),
            Math.max(0, reactiveBlock - 2000)
        );
        
        console.log(`   Found ${callbacks.length} Callback events`);
        console.log("");
        
        if (callbacks.length > 0) {
            // Show most recent
            const recent = callbacks.slice(-5);
            console.log("   Most Recent Callbacks:");
            console.log("");
            
            for (let i = 0; i < recent.length; i++) {
                const event = recent[i];
                const decoded = rsc.interface.decodeEventLog(
                    "Callback",
                    event.data,
                    event.topics
                );
                
                const block = await reactiveProvider.getBlock(event.blockNumber);
                const timeAgo = Math.floor((Date.now() / 1000) - block.timestamp);
                
                console.log(`   Callback #${callbacks.length - recent.length + i + 1}:`);
                console.log(`     Chain ID: ${decoded.chain_id.toString()}`);
                console.log(`     Target: ${decoded._contract}`);
                console.log(`     Gas Limit: ${decoded.gas_limit.toString()}`);
                
                // Decode payload
                try {
                    const iface = new ethers.utils.Interface([
                        "function queryCompoundApy(uint256 nonce)",
                        "function queryBothApys(uint256 nonce)"
                    ]);
                    const decodedPayload = iface.parseTransaction({ data: decoded.payload });
                    console.log(`     Function: ${decodedPayload.name}`);
                    console.log(`     Nonce: ${decodedPayload.args[0].toString()}`);
                } catch (e) {
                    // Try to decode as just uint256
                    if (decoded.payload.length >= 66) {
                        const value = ethers.BigNumber.from(decoded.payload.substring(0, 66));
                        console.log(`     Value: ${value.toString()}`);
                    }
                }
                
                console.log(`     Block: ${event.blockNumber}`);
                console.log(`     Time: ${timeAgo} seconds ago`);
                console.log(`     Transaction: ${event.transactionHash}`);
                console.log("");
                
                if (decoded._contract.toLowerCase() === NEW_QUERY_HELPER.toLowerCase()) {
                    console.log("     ✅ This is a callback to QueryHelper!");
                    console.log("");
                }
            }
        }
        
        // Check StrategyUpdate
        const strategyEvents = await rsc.queryFilter(
            rsc.filters.StrategyUpdate(),
            Math.max(0, reactiveBlock - 2000)
        );
        
        console.log(`   Found ${strategyEvents.length} StrategyUpdate events`);
        console.log("");
        
        if (strategyEvents.length > 0) {
            console.log("   ✅ RSC IS PROCESSING APY DATA!");
            console.log("");
            
            const latest = strategyEvents[strategyEvents.length - 1];
            const decoded = rsc.interface.decodeEventLog(
                "StrategyUpdate",
                latest.data,
                latest.topics
            );
            
            const block = await reactiveProvider.getBlock(latest.blockNumber);
            const timeAgo = Math.floor((Date.now() / 1000) - block.timestamp);
            
            console.log("   Latest Strategy Update:");
            console.log(`     Aave APY: ${decoded.aaveApy.toString()} bps (${(decoded.aaveApy.toNumber() / 100).toFixed(2)}%)`);
            console.log(`     Compound APY: ${decoded.compoundApy.toString()} bps (${(decoded.compoundApy.toNumber() / 100).toFixed(2)}%)`);
            console.log(`     Spread: ${decoded.spread.toString()} bps`);
            console.log(`     Rebalanced: ${decoded.rebalanced ? "✅ YES" : "❌ NO"}`);
            console.log(`     Block: ${latest.blockNumber}`);
            console.log(`     Time: ${timeAgo} seconds ago`);
            console.log(`     Transaction: ${latest.transactionHash}`);
            console.log("");
            
            if (decoded.rebalanced) {
                console.log("     🎉 REBALANCE TRIGGERED!");
                console.log("");
            }
        }
        
    } catch (error) {
        console.log(`   ⚠️  Error: ${error.message.split('\n')[0]}`);
        console.log("");
    }
    
    console.log("2️⃣  Checking QueryHelper Events (last 5000 blocks):");
    console.log("");
    
    try {
        const queryHelperAbi = [
            "event CompoundApyQueried(uint256 indexed nonce, uint256 apyBps, uint256 timestamp)",
            "event BothApysQueried(uint256 indexed nonce, uint256 aaveApyBps, uint256 compoundApyBps, uint256 timestamp)"
        ];
        
        const queryHelper = new ethers.Contract(NEW_QUERY_HELPER, queryHelperAbi, arbitrumProvider);
        
        const compoundEvents = await queryHelper.queryFilter(
            queryHelper.filters.CompoundApyQueried(),
            Math.max(0, arbBlock - 5000)
        );
        
        console.log(`   Found ${compoundEvents.length} CompoundApyQueried events`);
        console.log("");
        
        if (compoundEvents.length > 0) {
            const latest = compoundEvents[compoundEvents.length - 1];
            const decoded = queryHelper.interface.decodeEventLog(
                "CompoundApyQueried",
                latest.data,
                latest.topics
            );
            
            const block = await arbitrumProvider.getBlock(latest.blockNumber);
            const timeAgo = Math.floor((Date.now() / 1000) - block.timestamp);
            
            console.log("   Latest Event:");
            console.log(`     Nonce: ${decoded.nonce.toString()}`);
            console.log(`     APY: ${decoded.apyBps.toString()} bps (${(decoded.apyBps.toNumber() / 100).toFixed(2)}%)`);
            console.log(`     Timestamp: ${decoded.timestamp.toString()}`);
            console.log(`     Block: ${latest.blockNumber}`);
            console.log(`     Time: ${timeAgo} seconds ago`);
            console.log(`     Transaction: ${latest.transactionHash}`);
            console.log("");
            
            // Check if this is using old or new formula
            if (decoded.apyBps.toNumber() > 3000) {
                console.log("     ⚠️  Using OLD formula (3392 bps) - need to redeploy QueryHelper");
            } else if (decoded.apyBps.toNumber() === 339 || Math.abs(decoded.apyBps.toNumber() - 339) < 10) {
                console.log("     ✅ Using NEW formula (~339 bps)");
            } else {
                console.log(`     APY: ${decoded.apyBps.toString()} bps`);
            }
            console.log("");
        }
        
    } catch (error) {
        console.log(`   ⚠️  Error: ${error.message.split('\n')[0]}`);
        console.log("");
    }
    
    console.log("=".repeat(70));
    console.log("📊 SUMMARY");
    console.log("=".repeat(70));
    console.log("");
    console.log("If events are processing:");
    console.log("  ✅ System is working!");
    console.log("  ⏳ Waiting for QueryHelper to execute callbacks");
    console.log("  ⏳ Waiting for RSC to receive Compound APY");
    console.log("  ⏳ Waiting for APY comparison and deployment");
    console.log("");
}

checkSpecificEvent().catch(console.error);

