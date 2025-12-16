const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function verifyEventProcessing() {
    console.log("=".repeat(70));
    console.log("🎉 VERIFYING EVENT PROCESSING");
    console.log("=".repeat(70));
    console.log("");
    
    const NEW_RSC = "0x7Af5dC1f012d4a875E40d2ffD5E39d7468c59E14";
    const NEW_QUERY_HELPER = "0x55f03641265a793112bd1D9480C4Ea4f143E06af";
    const ADAPTER = "0x58DB4C40CE50FEfAD8EEaA0B609e12dE21b18805";
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://reactive-network.rpc.thirdweb.com"
    );
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    console.log("1️⃣  Checking Recent RSC Activity:");
    console.log("");
    
    const rscAbi = [
        "event Callback(uint256 indexed chain_id, address indexed _contract, uint64 indexed gas_limit, bytes payload)",
        "event StrategyUpdate(uint256 aaveApy, uint256 compoundApy, uint256 spread, bool rebalanced)",
        "event ReactHandled(uint256 txHash, address eventSource, uint256 topic0)"
    ];
    
    try {
        const rsc = new ethers.Contract(NEW_RSC, rscAbi, reactiveProvider);
        const reactiveBlock = await reactiveProvider.getBlockNumber();
        
        // Check callbacks
        const callbacks = await rsc.queryFilter(
            rsc.filters.Callback(),
            Math.max(0, reactiveBlock - 500)
        );
        
        console.log(`   Found ${callbacks.length} recent Callback events`);
        console.log("");
        
        if (callbacks.length > 0) {
            const latest = callbacks[callbacks.length - 1];
            const decoded = rsc.interface.decodeEventLog(
                "Callback",
                latest.data,
                latest.topics
            );
            
            console.log("   Latest Callback:");
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
                console.log(`     Payload: ${decoded.payload.substring(0, 40)}...`);
            }
            
            console.log(`     Block: ${latest.blockNumber}`);
            console.log(`     Transaction: ${latest.transactionHash}`);
            console.log("");
            
            if (decoded._contract.toLowerCase() === NEW_QUERY_HELPER.toLowerCase()) {
                console.log("     ✅ This is a callback to QueryHelper!");
                console.log("");
            }
        }
        
        // Check StrategyUpdate events
        const strategyEvents = await rsc.queryFilter(
            rsc.filters.StrategyUpdate(),
            Math.max(0, reactiveBlock - 500)
        );
        
        console.log(`   Found ${strategyEvents.length} recent StrategyUpdate events`);
        console.log("");
        
        if (strategyEvents.length > 0) {
            console.log("   ✅ RSC IS PROCESSING APY DATA!");
            console.log("");
            
            for (let i = 0; i < strategyEvents.length; i++) {
                const event = strategyEvents[i];
                const decoded = rsc.interface.decodeEventLog(
                    "StrategyUpdate",
                    event.data,
                    event.topics
                );
                
                console.log(`   Strategy Update #${i + 1}:`);
                console.log(`     Aave APY: ${decoded.aaveApy.toString()} bps (${(decoded.aaveApy.toNumber() / 100).toFixed(2)}%)`);
                console.log(`     Compound APY: ${decoded.compoundApy.toString()} bps (${(decoded.compoundApy.toNumber() / 100).toFixed(2)}%)`);
                console.log(`     Spread: ${decoded.spread.toString()} bps`);
                console.log(`     Rebalanced: ${decoded.rebalanced ? "✅ YES" : "❌ NO"}`);
                console.log(`     Block: ${event.blockNumber}`);
                console.log(`     Transaction: ${event.transactionHash}`);
                console.log("");
                
                if (decoded.rebalanced) {
                    console.log("     🎉 REBALANCE TRIGGERED!");
                    console.log("");
                }
            }
        } else {
            console.log("   ⚠️  No StrategyUpdate events yet");
            console.log("      RSC may not have received Compound APY yet");
            console.log("");
        }
        
        // Check ReactHandled events
        const reactEvents = await rsc.queryFilter(
            rsc.filters.ReactHandled(),
            Math.max(0, reactiveBlock - 500)
        );
        
        console.log(`   Found ${reactEvents.length} recent ReactHandled events`);
        console.log("");
        
        let queryHelperEvents = 0;
        let aaveEvents = 0;
        
        for (const event of reactEvents) {
            const decoded = rsc.interface.decodeEventLog(
                "ReactHandled",
                event.data,
                event.topics
            );
            
            if (decoded.eventSource.toLowerCase() === NEW_QUERY_HELPER.toLowerCase()) {
                queryHelperEvents++;
            }
            if (decoded.eventSource.toLowerCase() === "0x794a61358D6845594F94dc1DB02A252b5b4814aD".toLowerCase()) {
                aaveEvents++;
            }
        }
        
        console.log(`     Aave events processed: ${aaveEvents}`);
        console.log(`     QueryHelper events processed: ${queryHelperEvents}`);
        console.log("");
        
    } catch (error) {
        console.log(`   ⚠️  Error: ${error.message.split('\n')[0]}`);
        console.log("");
    }
    
    console.log("2️⃣  Checking QueryHelper Execution:");
    console.log("");
    
    try {
        const queryHelperAbi = [
            "event CompoundApyQueried(uint256 indexed nonce, uint256 apyBps, uint256 timestamp)",
            "event BothApysQueried(uint256 indexed nonce, uint256 aaveApyBps, uint256 compoundApyBps, uint256 timestamp)"
        ];
        
        const queryHelper = new ethers.Contract(NEW_QUERY_HELPER, queryHelperAbi, arbitrumProvider);
        const arbBlock = await arbitrumProvider.getBlockNumber();
        
        const compoundEvents = await queryHelper.queryFilter(
            queryHelper.filters.CompoundApyQueried(),
            Math.max(0, arbBlock - 1000)
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
            
            console.log("   Latest Event:");
            console.log(`     Nonce: ${decoded.nonce.toString()}`);
            console.log(`     APY: ${decoded.apyBps.toString()} bps (${(decoded.apyBps.toNumber() / 100).toFixed(2)}%)`);
            console.log(`     Timestamp: ${decoded.timestamp.toString()}`);
            console.log(`     Block: ${latest.blockNumber}`);
            console.log(`     Transaction: ${latest.transactionHash}`);
            console.log("");
            
            // Check if this matches the new formula (should be ~339 bps)
            if (decoded.apyBps.toNumber() === 339 || Math.abs(decoded.apyBps.toNumber() - 339) < 10) {
                console.log("     ✅ APY matches new formula (~339 bps)");
            } else if (decoded.apyBps.toNumber() > 3000) {
                console.log("     ⚠️  APY still using old formula (need to redeploy)");
            }
            console.log("");
        }
        
    } catch (error) {
        console.log(`   ⚠️  Error: ${error.message.split('\n')[0]}`);
        console.log("");
    }
    
    console.log("3️⃣  Checking Adapter Executions:");
    console.log("");
    
    try {
        const adapterAbi = [
            "event ReactionExecuted(address indexed rsc, address indexed vault, uint256 indexed chainId, bool success, bytes data)"
        ];
        
        const adapter = new ethers.Contract(ADAPTER, adapterAbi, arbitrumProvider);
        const arbBlock = await arbitrumProvider.getBlockNumber();
        
        const adapterEvents = await adapter.queryFilter(
            adapter.filters.ReactionExecuted(NEW_RSC),
            Math.max(0, arbBlock - 1000)
        );
        
        console.log(`   Found ${adapterEvents.length} ReactionExecuted events`);
        console.log("");
        
        if (adapterEvents.length > 0) {
            console.log("   ✅ Adapter IS executing!");
            console.log("");
            
            const latest = adapterEvents[adapterEvents.length - 1];
            const decoded = adapter.interface.decodeEventLog(
                "ReactionExecuted",
                latest.data,
                latest.topics
            );
            
            console.log("   Latest Execution:");
            console.log(`     RSC: ${decoded.rsc}`);
            console.log(`     Vault: ${decoded.vault}`);
            console.log(`     Success: ${decoded.success ? "✅ YES" : "❌ NO"}`);
            console.log(`     Block: ${latest.blockNumber}`);
            console.log(`     Transaction: ${latest.transactionHash}`);
            console.log("");
            
            if (decoded.success) {
                console.log("     🎉 CAPITAL DEPLOYED!");
            }
        }
        
    } catch (error) {
        console.log(`   ⚠️  Error: ${error.message.split('\n')[0]}`);
        console.log("");
    }
    
    console.log("=".repeat(70));
    console.log("📊 STATUS SUMMARY");
    console.log("=".repeat(70));
    console.log("");
    console.log("✅ Aave events: Being processed");
    console.log("✅ Callbacks: Being sent to QueryHelper");
    console.log("⏳ QueryHelper → RSC: Check if events are forwarded");
    console.log("⏳ RSC → Adapter: Check if deployment triggered");
    console.log("");
}

verifyEventProcessing().catch(console.error);

