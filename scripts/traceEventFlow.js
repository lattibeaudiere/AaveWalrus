const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function traceEventFlow() {
    console.log("=".repeat(70));
    console.log("🔍 TRACING EVENT FLOW");
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
    
    console.log("1️⃣  Checking RSC Callback Events:");
    console.log("");
    
    const rscAbi = [
        "event Callback(uint256 indexed chain_id, address indexed _contract, uint64 indexed gas_limit, bytes payload)"
    ];
    
    try {
        const rsc = new ethers.Contract(NEW_RSC, rscAbi, reactiveProvider);
        const reactiveBlock = await reactiveProvider.getBlockNumber();
        
        const callbackEvents = await rsc.queryFilter(
            rsc.filters.Callback(),
            Math.max(0, reactiveBlock - 5000)
        );
        
        console.log(`   Found ${callbackEvents.length} Callback events`);
        console.log("");
        
        for (let i = 0; i < Math.min(callbackEvents.length, 5); i++) {
            const event = callbackEvents[i];
            const decoded = rsc.interface.decodeEventLog(
                "Callback",
                event.data,
                event.topics
            );
            
            console.log(`   Callback #${i + 1}:`);
            console.log(`     Chain ID: ${decoded.chain_id.toString()}`);
            console.log(`     Target: ${decoded._contract}`);
            console.log(`     Gas Limit: ${decoded.gas_limit.toString()}`);
            
            // Decode payload to see function signature
            try {
                const iface = new ethers.utils.Interface([
                    "function queryCompoundApy(uint256 nonce)",
                    "function queryBothApys(uint256 nonce)"
                ]);
                
                const decodedPayload = iface.parseTransaction({ data: decoded.payload });
                console.log(`     Function: ${decodedPayload.name}`);
                console.log(`     Nonce: ${decodedPayload.args[0].toString()}`);
                
                if (decodedPayload.name === "queryBothApys") {
                    console.log(`     ✅ This is from INITIALIZATION!`);
                } else {
                    console.log(`     ℹ️  This is from AAVE EVENT (normal flow)`);
                }
            } catch (e) {
                console.log(`     Payload: ${decoded.payload.substring(0, 20)}...`);
            }
            
            console.log(`     Block: ${event.blockNumber}`);
            console.log(`     Transaction: ${event.transactionHash}`);
            console.log("");
        }
        
    } catch (error) {
        console.log(`   ⚠️  Error: ${error.message.split('\n')[0]}`);
        console.log("");
    }
    
    console.log("2️⃣  Checking QueryHelper Events (from Arbitrum):");
    console.log("");
    
    const queryHelperAbi = [
        "event CompoundApyQueried(uint256 indexed nonce, uint256 apyBps, uint256 timestamp)",
        "event BothApysQueried(uint256 indexed nonce, uint256 aaveApyBps, uint256 compoundApyBps, uint256 timestamp)"
    ];
    
    try {
        const queryHelper = new ethers.Contract(NEW_QUERY_HELPER, queryHelperAbi, arbitrumProvider);
        const arbBlock = await arbitrumProvider.getBlockNumber();
        
        const compoundEvents = await queryHelper.queryFilter(
            queryHelper.filters.CompoundApyQueried(),
            Math.max(0, arbBlock - 20000)
        );
        
        const bothEvents = await queryHelper.queryFilter(
            queryHelper.filters.BothApysQueried(),
            Math.max(0, arbBlock - 20000)
        );
        
        console.log(`   CompoundApyQueried: ${compoundEvents.length} events`);
        console.log(`   BothApysQueried: ${bothEvents.length} events`);
        console.log("");
        
        // Check if any match the callbacks
        if (compoundEvents.length > 0) {
            console.log("   CompoundApyQueried events:");
            for (let i = 0; i < compoundEvents.length; i++) {
                const event = compoundEvents[i];
                const decoded = queryHelper.interface.decodeEventLog(
                    "CompoundApyQueried",
                    event.data,
                    event.topics
                );
                
                console.log(`     Event #${i + 1}:`);
                console.log(`       Nonce: ${decoded.nonce.toString()}`);
                console.log(`       APY: ${decoded.apyBps.toString()} bps`);
                console.log(`       Block: ${event.blockNumber}`);
                console.log(`       Transaction: ${event.transactionHash}`);
                
                // Check if this nonce matches a callback
                const nonceBN = ethers.BigNumber.from(decoded.nonce.toString());
                if (nonceBN.eq(ethers.BigNumber.from("999"))) {
                    console.log(`       ℹ️  This was from our TEST`);
                } else if (nonceBN.gt(ethers.BigNumber.from("1e18"))) {
                    console.log(`       ✅ This is from an AAVE EVENT callback`);
                }
                console.log("");
            }
        }
        
        if (bothEvents.length > 0) {
            console.log("   ✅ Found BothApysQueried events (from initialization):");
            for (let i = 0; i < bothEvents.length; i++) {
                const event = bothEvents[i];
                const decoded = queryHelper.interface.decodeEventLog(
                    "BothApysQueried",
                    event.data,
                    event.topics
                );
                
                console.log(`     Event #${i + 1}:`);
                console.log(`       Nonce: ${decoded.nonce.toString()}`);
                console.log(`       Aave APY: ${decoded.aaveApyBps.toString()} bps`);
                console.log(`       Compound APY: ${decoded.compoundApyBps.toString()} bps`);
                console.log(`       Block: ${event.blockNumber}`);
                console.log("");
            }
        } else {
            console.log("   ⚠️  No BothApysQueried events found");
            console.log("      Initialization callback may not have executed yet");
            console.log("");
        }
        
    } catch (error) {
        console.log(`   ⚠️  Error: ${error.message.split('\n')[0]}`);
        console.log("");
    }
    
    console.log("3️⃣  Checking RSC ReactHandled Events:");
    console.log("");
    
    const reactAbi = [
        "event ReactHandled(uint256 txHash, address eventSource, uint256 topic0)"
    ];
    
    try {
        const rscReact = new ethers.Contract(NEW_RSC, reactAbi, reactiveProvider);
        const reactiveBlock = await reactiveProvider.getBlockNumber();
        
        const reactEvents = await rscReact.queryFilter(
            rscReact.filters.ReactHandled(),
            Math.max(0, reactiveBlock - 5000)
        );
        
        console.log(`   Found ${reactEvents.length} ReactHandled events`);
        console.log("");
        
        if (reactEvents.length > 0) {
            console.log("   Recent ReactHandled events (shows RSC is processing events):");
            for (let i = Math.max(0, reactEvents.length - 5); i < reactEvents.length; i++) {
                const event = reactEvents[i];
                const decoded = rscReact.interface.decodeEventLog(
                    "ReactHandled",
                    event.data,
                    event.topics
                );
                
                console.log(`     Event #${i + 1}:`);
                console.log(`       Event Source: ${decoded.eventSource}`);
                console.log(`       Topic0: ${decoded.topic0.toString()}`);
                console.log(`       Block: ${event.blockNumber}`);
                console.log("");
            }
        }
        
    } catch (error) {
        console.log(`   ⚠️  Error: ${error.message.split('\n')[0]}`);
        console.log("");
    }
    
    console.log("4️⃣  Checking RSC Strategy Updates:");
    console.log("");
    
    const strategyAbi = [
        "event StrategyUpdate(uint256 aaveApy, uint256 compoundApy, uint256 spread, bool rebalanced)"
    ];
    
    try {
        const rscStrategy = new ethers.Contract(NEW_RSC, strategyAbi, reactiveProvider);
        const reactiveBlock = await reactiveProvider.getBlockNumber();
        
        const strategyEvents = await rscStrategy.queryFilter(
            rscStrategy.filters.StrategyUpdate(),
            Math.max(0, reactiveBlock - 5000)
        );
        
        console.log(`   Found ${strategyEvents.length} StrategyUpdate events`);
        console.log("");
        
        if (strategyEvents.length > 0) {
            console.log("   ✅ RSC is processing APY data and making decisions!");
            for (let i = 0; i < strategyEvents.length; i++) {
                const event = strategyEvents[i];
                const decoded = rscStrategy.interface.decodeEventLog(
                    "StrategyUpdate",
                    event.data,
                    event.topics
                );
                
                console.log(`     Strategy Update #${i + 1}:`);
                console.log(`       Aave APY: ${decoded.aaveApy.toString()} bps`);
                console.log(`       Compound APY: ${decoded.compoundApy.toString()} bps`);
                console.log(`       Spread: ${decoded.spread.toString()} bps`);
                console.log(`       Rebalanced: ${decoded.rebalanced ? "✅ YES" : "❌ NO"}`);
                console.log(`       Block: ${event.blockNumber}`);
                console.log("");
                
                if (decoded.rebalanced) {
                    console.log("       🎉 REBALANCE TRIGGERED!");
                }
            }
        } else {
            console.log("   ⚠️  No StrategyUpdate events yet");
            console.log("      RSC may not be receiving CompoundApyQueried events");
            console.log("      Or APY comparison is not triggering deployment");
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
    console.log("Flow Analysis:");
    console.log("  • Aave events → RSC processes → Extracts Aave APY");
    console.log("  • RSC emits Callback → QueryHelper.queryCompoundApy()");
    console.log("  • QueryHelper executes → Emits CompoundApyQueried event");
    console.log("  • RSC should receive CompoundApyQueried → Compare APYs → Deploy");
    console.log("");
    console.log("Key Question:");
    console.log("  Is RSC receiving and processing CompoundApyQueried events?");
    console.log("");
}

traceEventFlow().catch(console.error);
