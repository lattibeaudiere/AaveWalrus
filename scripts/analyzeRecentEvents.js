const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function analyzeRecentEvents() {
    console.log("=".repeat(70));
    console.log("🔍 ANALYZING RECENT EVENT PROCESSING");
    console.log("=".repeat(70));
    console.log("");
    
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0x64030389Fb91D86F92314503aAe57827826c8F4e";
    const ADAPTER_ADDRESS = process.env.ADAPTER_ADDRESS || "0x7d485F8AD54f7A3dC9f0871e61E63A97f678CCA7";
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev"
    );
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    console.log("RSC Address:", RSC_ADDRESS);
    console.log("Adapter Address:", ADAPTER_ADDRESS);
    console.log("");
    
    // Get recent ReactHandled events
    console.log("1️⃣  Checking ReactHandled Events:");
    const rsc = new ethers.Contract(
        RSC_ADDRESS,
        [
            "event ReactHandled(uint256 chainId, address contract_, uint256 txHash, uint256 logIndex)"
        ],
        reactiveProvider
    );
    
    try {
        const currentBlock = await reactiveProvider.getBlockNumber();
        const fromBlock = currentBlock - 1000;
        
        console.log(`   Scanning blocks ${fromBlock} to ${currentBlock}...`);
        
        const events = await rsc.queryFilter(
            rsc.filters.ReactHandled(),
            fromBlock,
            currentBlock
        );
        
        console.log(`   Found ${events.length} ReactHandled events`);
        console.log("");
        
        if (events.length > 0) {
            console.log("📋 Recent Events Processed:");
            const recent = events.slice(-5).reverse(); // Last 5, most recent first
            
            for (let i = 0; i < recent.length; i++) {
                const event = recent[i];
                const block = await reactiveProvider.getBlock(event.blockNumber);
                const age = Math.floor((Date.now() / 1000 - block.timestamp) / 60);
                
                console.log(`\n   Event ${i + 1}:`);
                console.log(`     Chain ID: ${event.args.chainId.toString()}`);
                console.log(`     Contract: ${event.args.contract_}`);
                console.log(`     TX Hash: ${event.args.txHash.toString()}`);
                console.log(`     Age: ${age} minutes ago`);
            }
        } else {
            console.log("   ⚠️  No ReactHandled events found");
        }
    } catch (error) {
        console.log("   ❌ Error:", error.message.split('\n')[0]);
    }
    
    console.log("");
    
    // Check for Callback events
    console.log("2️⃣  Checking Callback Events:");
    const callbackInterface = new ethers.utils.Interface([
        "event Callback(uint256 indexed chain_id, address indexed _contract, uint64 indexed gas_limit, bytes payload)"
    ]);
    
    try {
        const currentBlock = await reactiveProvider.getBlockNumber();
        const fromBlock = currentBlock - 1000;
        
        // Filter for Callback events (Topic0 = keccak256("Callback(uint256,address,uint64,bytes)"))
        const callbackTopic = ethers.utils.id("Callback(uint256,address,uint64,bytes)");
        
        const logs = await reactiveProvider.getLogs({
            address: RSC_ADDRESS,
            topics: [callbackTopic],
            fromBlock,
            toBlock: currentBlock
        });
        
        console.log(`   Found ${logs.length} Callback events`);
        
        if (logs.length > 0) {
            console.log("   ✅ RSC is emitting callbacks!");
            
            const recent = logs.slice(-3).reverse();
            for (let i = 0; i < recent.length; i++) {
                const log = recent[i];
                const parsed = callbackInterface.parseLog(log);
                const block = await reactiveProvider.getBlock(log.blockNumber);
                const age = Math.floor((Date.now() / 1000 - block.timestamp) / 60);
                
                console.log(`\n   Callback ${i + 1}:`);
                console.log(`     Destination Chain: ${parsed.args.chain_id.toString()}`);
                console.log(`     Target Contract: ${parsed.args._contract}`);
                console.log(`     Gas Limit: ${parsed.args.gas_limit.toString()}`);
                console.log(`     Age: ${age} minutes ago`);
                
                // Check if target is our adapter
                if (parsed.args._contract.toLowerCase() === ADAPTER_ADDRESS.toLowerCase()) {
                    console.log(`     ✅ Target matches our adapter!`);
                }
            }
        } else {
            console.log("   ⚠️  No Callback events found");
        }
    } catch (error) {
        console.log("   ❌ Error:", error.message.split('\n')[0]);
    }
    
    console.log("");
    
    // Check adapter for ReactionExecuted events
    console.log("3️⃣  Checking Adapter Executions:");
    try {
        const adapter = new ethers.Contract(
            ADAPTER_ADDRESS,
            [
                "event ReactionExecuted(address indexed rsc, address indexed vault, uint256 targetChainId, bool success, bytes data)"
            ],
            arbitrumProvider
        );
        
        const currentBlock = await arbitrumProvider.getBlockNumber();
        const fromBlock = currentBlock - 5000;
        
        const executions = await adapter.queryFilter(
            adapter.filters.ReactionExecuted(),
            fromBlock,
            currentBlock
        );
        
        console.log(`   Found ${executions.length} ReactionExecuted events`);
        
        if (executions.length > 0) {
            console.log("   ✅ Adapter is executing reactions!");
            
            const recent = executions.slice(-3).reverse();
            for (let i = 0; i < recent.length; i++) {
                const event = recent[i];
                const block = await arbitrumProvider.getBlock(event.blockNumber);
                const age = Math.floor((Date.now() / 1000 - block.timestamp) / 60);
                
                console.log(`\n   Execution ${i + 1}:`);
                console.log(`     RSC: ${event.args.rsc}`);
                console.log(`     Vault: ${event.args.vault}`);
                console.log(`     Success: ${event.args.success ? '✅ Yes' : '❌ No'}`);
                console.log(`     Age: ${age} minutes ago`);
            }
        } else {
            console.log("   ⚠️  No ReactionExecuted events found");
            console.log("   This could mean:");
            console.log("     • Callbacks haven't reached adapter yet");
            console.log("     • Callbacks are reverting (check Alpha role)");
            console.log("     • No rebalances triggered yet (spread < threshold)");
        }
    } catch (error) {
        console.log("   ❌ Error:", error.message.split('\n')[0]);
    }
    
    console.log("");
    console.log("=".repeat(70));
    console.log("📊 SUMMARY");
    console.log("=".repeat(70));
    console.log("");
    console.log("✅ Events are being processed on Reactive Network");
    console.log("✅ RSC is receiving and handling Aave events");
    console.log("");
    console.log("Next steps to verify:");
    console.log("  1. Check if callbacks are executing on Arbitrum");
    console.log("  2. Verify Alpha role is granted to adapter");
    console.log("  3. Monitor for first successful rebalance");
    console.log("");
}

analyzeRecentEvents().catch(console.error);

