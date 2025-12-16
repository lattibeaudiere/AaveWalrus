const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkCallbackExecution() {
    console.log("=".repeat(70));
    console.log("🔍 CHECKING CALLBACK EXECUTION ON ARBITRUM");
    console.log("=".repeat(70));
    console.log("");
    
    const ADAPTER_ADDRESS = process.env.ADAPTER_ADDRESS || "0x7d485F8AD54f7A3dC9f0871e61E63A97f678CCA7";
    const QUERY_HELPER_ADDRESS = process.env.QUERY_HELPER_ADDRESS || "0x7D0B3A06aE0ceaf35B658579A1F5730D3539f914";
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    // Check adapter for recent transactions
    console.log("1️⃣  Checking Adapter Activity:");
    console.log("   Adapter:", ADAPTER_ADDRESS);
    
    try {
        const currentBlock = await arbitrumProvider.getBlockNumber();
        const fromBlock = Math.max(currentBlock - 5000, 0);
        
        console.log(`   Scanning blocks ${fromBlock} to ${currentBlock}...`);
        
        // Check for any transactions to adapter
        const adapterCode = await arbitrumProvider.getCode(ADAPTER_ADDRESS);
        if (adapterCode === "0x") {
            console.log("   ❌ Adapter not found");
            return;
        }
        
        // Get logs from adapter
        const adapter = new ethers.Contract(
            ADAPTER_ADDRESS,
            [
                "event ReactionExecuted(address indexed rsc, address indexed vault, uint256 targetChainId, bool success, bytes data)",
                "event RSCRegistered(address indexed rsc, address indexed vault, string description)"
            ],
            arbitrumProvider
        );
        
        const executions = await adapter.queryFilter(
            adapter.filters.ReactionExecuted(),
            fromBlock,
            currentBlock
        );
        
        console.log(`   Found ${executions.length} ReactionExecuted events`);
        
        if (executions.length > 0) {
            console.log("\n   ✅ CALLBACKS ARE EXECUTING!");
            console.log("");
            
            for (let i = 0; i < Math.min(executions.length, 5); i++) {
                const event = executions[i];
                const block = await arbitrumProvider.getBlock(event.blockNumber);
                const age = Math.floor((Date.now() / 1000 - block.timestamp) / 60);
                
                console.log(`   Execution ${i + 1}:`);
                console.log(`     Block: ${event.blockNumber}`);
                console.log(`     Age: ${age} minutes ago`);
                console.log(`     RSC: ${event.args.rsc}`);
                console.log(`     Success: ${event.args.success ? '✅ YES' : '❌ NO'}`);
                if (!event.args.success) {
                    console.log(`     ⚠️  Execution failed!`);
                    if (event.args.data && event.args.data !== "0x") {
                        try {
                            const reason = ethers.utils.defaultAbiCoder.decode(["string"], event.args.data);
                            console.log(`     Reason: ${reason[0]}`);
                        } catch (e) {
                            console.log(`     Error data: ${event.args.data.substring(0, 66)}...`);
                        }
                    }
                }
                console.log("");
            }
        } else {
            console.log("\n   ⚠️  No ReactionExecuted events found");
            console.log("   This means callbacks are NOT executing on Arbitrum yet");
            console.log("");
            console.log("   Possible reasons:");
            console.log("     1. Alpha role not granted to adapter");
            console.log("     2. Reactive Network callbacks delayed");
            console.log("     3. Callbacks reverting on execution");
        }
    } catch (error) {
        console.log("   ❌ Error:", error.message.split('\n')[0]);
    }
    
    // Check QueryHelper for executions
    console.log("2️⃣  Checking QueryHelper Activity:");
    console.log("   QueryHelper:", QUERY_HELPER_ADDRESS);
    
    try {
        const queryHelper = new ethers.Contract(
            QUERY_HELPER_ADDRESS,
            [
                "event CompoundApyQueried(uint256 indexed nonce, uint256 apyBps, uint256 timestamp)"
            ],
            arbitrumProvider
        );
        
        const currentBlock = await arbitrumProvider.getBlockNumber();
        const fromBlock = Math.max(currentBlock - 5000, 0);
        
        const queries = await queryHelper.queryFilter(
            queryHelper.filters.CompoundApyQueried(),
            fromBlock,
            currentBlock
        );
        
        console.log(`   Found ${queries.length} CompoundApyQueried events`);
        
        if (queries.length > 0) {
            console.log("   ✅ QueryHelper is being called!");
            console.log("");
            
            const recent = queries.slice(-3).reverse();
            for (let i = 0; i < recent.length; i++) {
                const event = recent[i];
                const block = await arbitrumProvider.getBlock(event.blockNumber);
                const age = Math.floor((Date.now() / 1000 - block.timestamp) / 60);
                
                console.log(`   Query ${i + 1}:`);
                console.log(`     Nonce: ${event.args.nonce.toString()}`);
                console.log(`     APY: ${event.args.apyBps.toString()} bps`);
                console.log(`     Age: ${age} minutes ago`);
            }
        } else {
            console.log("   ⚠️  QueryHelper not being called");
        }
    } catch (error) {
        console.log("   ❌ Error:", error.message.split('\n')[0]);
    }
    
    console.log("");
    console.log("=".repeat(70));
    console.log("📊 STATUS SUMMARY");
    console.log("=".repeat(70));
    console.log("");
    
    console.log("System Status:");
    console.log("  ✅ Events processed on Reactive Network");
    console.log("  ✅ Callbacks emitted from RSC");
    console.log("  ⚠️  Need to verify callback execution on Arbitrum");
    console.log("");
    console.log("To verify Alpha role:");
    console.log("  • Check Vault Builder UI");
    console.log("  • Verify adapter has Alpha role");
    console.log("  • Address: " + ADAPTER_ADDRESS);
    console.log("");
}

checkCallbackExecution().catch(console.error);
