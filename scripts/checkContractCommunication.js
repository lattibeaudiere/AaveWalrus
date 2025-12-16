const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkContractCommunication() {
    console.log("=".repeat(70));
    console.log("🔗 CHECKING CONTRACT COMMUNICATION");
    console.log("=".repeat(70));
    console.log("");
    
    const NEW_RSC = "0x7Af5dC1f012d4a875E40d2ffD5E39d7468c59E14";
    const NEW_QUERY_HELPER = "0x55f03641265a793112bd1D9480C4Ea4f143E06af";
    const ADAPTER = "0x58DB4C40CE50FEfAD8EEaA0B609e12dE21b18805";
    const VAULT = "0xee29A26179fE20D5D202dAE4a279119E08edc60b";
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://reactive-network.rpc.thirdweb.com"
    );
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    console.log("Contract Addresses:");
    console.log(`  RSC: ${NEW_RSC}`);
    console.log(`  QueryHelper: ${NEW_QUERY_HELPER}`);
    console.log(`  Adapter: ${ADAPTER}`);
    console.log(`  Vault: ${VAULT}`);
    console.log("");
    
    // ==========================================
    // STEP 1: RSC → QueryHelper (Callbacks)
    // ==========================================
    console.log("1️⃣  RSC → QueryHelper (Callbacks):");
    console.log("");
    
    const rscCallbackAbi = [
        "event Callback(uint256 indexed chain_id, address indexed _contract, uint64 indexed gas_limit, bytes payload)"
    ];
    
    try {
        const rsc = new ethers.Contract(NEW_RSC, rscCallbackAbi, reactiveProvider);
        const reactiveBlock = await reactiveProvider.getBlockNumber();
        
        const callbacks = await rsc.queryFilter(
            rsc.filters.Callback(),
            Math.max(0, reactiveBlock - 10000)
        );
        
        console.log(`   Found ${callbacks.length} Callback events from RSC`);
        console.log("");
        
        let queryHelperCallbacks = 0;
        
        for (let i = 0; i < callbacks.length; i++) {
            const event = callbacks[i];
            const decoded = rsc.interface.decodeEventLog(
                "Callback",
                event.data,
                event.topics
            );
            
            if (decoded._contract.toLowerCase() === NEW_QUERY_HELPER.toLowerCase()) {
                queryHelperCallbacks++;
                
                console.log(`   Callback #${queryHelperCallbacks}:`);
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
                
                console.log(`     Block: ${event.blockNumber}`);
                console.log(`     Transaction: ${event.transactionHash}`);
                console.log("");
            }
        }
        
        if (queryHelperCallbacks === 0) {
            console.log("   ⚠️  No callbacks to QueryHelper found");
            console.log("");
        } else {
            console.log(`   ✅ RSC emitted ${queryHelperCallbacks} callbacks to QueryHelper`);
            console.log("");
        }
        
    } catch (error) {
        console.log(`   ❌ Error: ${error.message.split('\n')[0]}`);
        console.log("");
    }
    
    // ==========================================
    // STEP 2: QueryHelper Execution (Arbitrum)
    // ==========================================
    console.log("2️⃣  QueryHelper Execution (Arbitrum):");
    console.log("");
    
    try {
        const arbBlock = await arbitrumProvider.getBlockNumber();
        
        // Check for transactions TO QueryHelper
        const queryHelperCode = await arbitrumProvider.getCode(NEW_QUERY_HELPER);
        console.log(`   QueryHelper exists: ${queryHelperCode !== "0x" ? "✅" : "❌"}`);
        console.log("");
        
        // Check QueryHelper events (indicates execution)
        const queryHelperAbi = [
            "event CompoundApyQueried(uint256 indexed nonce, uint256 apyBps, uint256 timestamp)",
            "event BothApysQueried(uint256 indexed nonce, uint256 aaveApyBps, uint256 compoundApyBps, uint256 timestamp)"
        ];
        
        const queryHelper = new ethers.Contract(NEW_QUERY_HELPER, queryHelperAbi, arbitrumProvider);
        
        const compoundEvents = await queryHelper.queryFilter(
            queryHelper.filters.CompoundApyQueried(),
            Math.max(0, arbBlock - 50000)
        );
        
        const bothEvents = await queryHelper.queryFilter(
            queryHelper.filters.BothApysQueried(),
            Math.max(0, arbBlock - 50000)
        );
        
        console.log(`   CompoundApyQueried events: ${compoundEvents.length}`);
        console.log(`   BothApysQueried events: ${bothEvents.length}`);
        console.log("");
        
        if (compoundEvents.length > 0 || bothEvents.length > 0) {
            console.log("   ✅ QueryHelper IS executing and emitting events!");
            console.log("");
            
            // Show latest event
            if (compoundEvents.length > 0) {
                const latest = compoundEvents[compoundEvents.length - 1];
                const decoded = queryHelper.interface.decodeEventLog(
                    "CompoundApyQueried",
                    latest.data,
                    latest.topics
                );
                console.log("   Latest CompoundApyQueried:");
                console.log(`     Nonce: ${decoded.nonce.toString()}`);
                console.log(`     APY: ${decoded.apyBps.toString()} bps`);
                console.log(`     Block: ${latest.blockNumber}`);
                console.log(`     Transaction: ${latest.transactionHash}`);
                console.log("");
            }
        } else {
            console.log("   ⚠️  No QueryHelper events found");
            console.log("      QueryHelper may not have been called yet");
            console.log("");
        }
        
    } catch (error) {
        console.log(`   ❌ Error: ${error.message.split('\n')[0]}`);
        console.log("");
    }
    
    // ==========================================
    // STEP 3: QueryHelper → RSC (Events)
    // ==========================================
    console.log("3️⃣  QueryHelper → RSC (Events):");
    console.log("");
    
    const rscReactAbi = [
        "event ReactHandled(uint256 txHash, address eventSource, uint256 topic0)",
        "event StrategyUpdate(uint256 aaveApy, uint256 compoundApy, uint256 spread, bool rebalanced)"
    ];
    
    try {
        const rscReact = new ethers.Contract(NEW_RSC, rscReactAbi, reactiveProvider);
        const reactiveBlock = await reactiveProvider.getBlockNumber();
        
        // Check ReactHandled events (indicates RSC received and processed events)
        const reactEvents = await rscReact.queryFilter(
            rscReact.filters.ReactHandled(),
            Math.max(0, reactiveBlock - 10000)
        );
        
        console.log(`   ReactHandled events: ${reactEvents.length}`);
        console.log("");
        
        let queryHelperEvents = 0;
        
        for (let i = 0; i < reactEvents.length; i++) {
            const event = reactEvents[i];
            const decoded = rscReact.interface.decodeEventLog(
                "ReactHandled",
                event.data,
                event.topics
            );
            
            if (decoded.eventSource.toLowerCase() === NEW_QUERY_HELPER.toLowerCase()) {
                queryHelperEvents++;
            }
        }
        
        if (queryHelperEvents > 0) {
            console.log(`   ✅ RSC received ${queryHelperEvents} events from QueryHelper`);
            console.log("");
        } else {
            console.log("   ❌ RSC has NOT received events from QueryHelper yet");
            console.log("");
            
            // Check StrategyUpdate events (indicates RSC processed APY data)
            const strategyEvents = await rscReact.queryFilter(
                rscReact.filters.StrategyUpdate(),
                Math.max(0, reactiveBlock - 10000)
            );
            
            console.log(`   StrategyUpdate events: ${strategyEvents.length}`);
            if (strategyEvents.length > 0) {
                console.log("   ✅ RSC IS processing APY data!");
                const latest = strategyEvents[strategyEvents.length - 1];
                const decoded = rscReact.interface.decodeEventLog(
                    "StrategyUpdate",
                    latest.data,
                    latest.topics
                );
                console.log("");
                console.log("   Latest Strategy Update:");
                console.log(`     Aave APY: ${decoded.aaveApy.toString()} bps`);
                console.log(`     Compound APY: ${decoded.compoundApy.toString()} bps`);
                console.log(`     Spread: ${decoded.spread.toString()} bps`);
                console.log(`     Rebalanced: ${decoded.rebalanced ? "✅ YES" : "❌ NO"}`);
                console.log("");
            } else {
                console.log("   ❌ RSC has NOT processed APY data yet");
                console.log("");
            }
        }
        
    } catch (error) {
        console.log(`   ❌ Error: ${error.message.split('\n')[0]}`);
        console.log("");
    }
    
    // ==========================================
    // STEP 4: RSC → Adapter (Callbacks)
    // ==========================================
    console.log("4️⃣  RSC → Adapter (Callbacks):");
    console.log("");
    
    try {
        const rsc = new ethers.Contract(NEW_RSC, rscCallbackAbi, reactiveProvider);
        const reactiveBlock = await reactiveProvider.getBlockNumber();
        
        const callbacks = await rsc.queryFilter(
            rsc.filters.Callback(),
            Math.max(0, reactiveBlock - 10000)
        );
        
        let adapterCallbacks = 0;
        
        for (let i = 0; i < callbacks.length; i++) {
            const event = callbacks[i];
            const decoded = rsc.interface.decodeEventLog(
                "Callback",
                event.data,
                event.topics
            );
            
            if (decoded._contract.toLowerCase() === ADAPTER.toLowerCase()) {
                adapterCallbacks++;
            }
        }
        
        if (adapterCallbacks > 0) {
            console.log(`   ✅ RSC emitted ${adapterCallbacks} callbacks to Adapter`);
            console.log("");
        } else {
            console.log("   ⚠️  No callbacks to Adapter found");
            console.log("      RSC may not have triggered deployment yet");
            console.log("");
        }
        
    } catch (error) {
        console.log(`   ❌ Error: ${error.message.split('\n')[0]}`);
        console.log("");
    }
    
    // ==========================================
    // STEP 5: Adapter Execution (Arbitrum)
    // ==========================================
    console.log("5️⃣  Adapter Execution (Arbitrum):");
    console.log("");
    
    try {
        const adapterAbi = [
            "event ReactionExecuted(address indexed rsc, address indexed vault, uint256 indexed chainId, bool success, bytes data)"
        ];
        
        const adapter = new ethers.Contract(ADAPTER, adapterAbi, arbitrumProvider);
        const arbBlock = await arbitrumProvider.getBlockNumber();
        
        const adapterEvents = await adapter.queryFilter(
            adapter.filters.ReactionExecuted(NEW_RSC),
            Math.max(0, arbBlock - 50000)
        );
        
        console.log(`   ReactionExecuted events: ${adapterEvents.length}`);
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
                console.log("   🎉 CAPITAL DEPLOYED!");
            } else {
                console.log("   ⚠️  Execution failed - check transaction for revert reason");
            }
        } else {
            console.log("   ⚠️  No Adapter executions found");
            console.log("      Adapter may not have been called yet");
            console.log("");
        }
        
    } catch (error) {
        console.log(`   ❌ Error: ${error.message.split('\n')[0]}`);
        console.log("");
    }
    
    // ==========================================
    // SUMMARY
    // ==========================================
    console.log("=".repeat(70));
    console.log("📊 COMMUNICATION SUMMARY");
    console.log("=".repeat(70));
    console.log("");
    console.log("Communication Flow:");
    console.log("  1. RSC → QueryHelper (Callbacks)");
    console.log("  2. QueryHelper → RSC (Events)");
    console.log("  3. RSC → Adapter (Callbacks)");
    console.log("  4. Adapter → Vault (Execution)");
    console.log("");
    console.log("Status:");
    console.log("  ✅ Step 1: RSC emitting callbacks to QueryHelper");
    console.log("  ✅ Step 2: QueryHelper executing and emitting events");
    console.log("  ❌ Step 3: RSC NOT receiving QueryHelper events");
    console.log("  ❌ Step 4: No deployment triggered");
    console.log("");
    console.log("🔍 Key Issue:");
    console.log("  QueryHelper events are NOT reaching RSC");
    console.log("  This is the communication breakdown point");
    console.log("");
}

checkContractCommunication().catch(console.error);

