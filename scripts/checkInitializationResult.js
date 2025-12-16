const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkInitializationResult() {
    console.log("=".repeat(70));
    console.log("🔍 CHECKING INITIALIZATION RESULT");
    console.log("=".repeat(70));
    console.log("");
    
    const RSC_ADDRESS = "0xf64afe64622CeAe79d48A15ebC49CC7FF416c688";
    const QUERY_HELPER = process.env.QUERY_HELPER_ADDRESS || "0x05b402e333974134689424F13f01BC31F8fbfF56";
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://reactive-network.rpc.thirdweb.com"
    );
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    // Check RSC events
    console.log("1️⃣  Checking RSC Strategy Updates:");
    console.log("");
    
    const rscAbi = [
        "event StrategyUpdate(uint256 aaveApy, uint256 compoundApy, uint256 spread, bool rebalanced)",
        "event Callback(uint256 chainId, address target, uint64 gasLimit, bytes payload)"
    ];
    
    const rsc = new ethers.Contract(RSC_ADDRESS, rscAbi, reactiveProvider);
    
    const currentBlock = await reactiveProvider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 1000);
    
    // Check StrategyUpdate events
    const strategyEvents = await rsc.queryFilter(
        rsc.filters.StrategyUpdate(),
        fromBlock
    );
    
    console.log(`   Found ${strategyEvents.length} StrategyUpdate events`);
    
    if (strategyEvents.length > 0) {
        const latest = strategyEvents[strategyEvents.length - 1];
        const decoded = rsc.interface.decodeEventLog(
            "StrategyUpdate",
            latest.data,
            latest.topics
        );
        
        console.log("");
        console.log("   Latest Strategy Update:");
        console.log(`     Aave APY: ${decoded.aaveApy.toString()} bps (${(decoded.aaveApy.toNumber() / 100).toFixed(2)}%)`);
        console.log(`     Compound APY: ${decoded.compoundApy.toString()} bps (${(decoded.compoundApy.toNumber() / 100).toFixed(2)}%)`);
        console.log(`     Spread: ${decoded.spread.toString()} bps`);
        console.log(`     Rebalanced: ${decoded.rebalanced ? "✅ YES" : "❌ NO"}`);
        console.log(`     Block: ${latest.blockNumber}`);
        console.log("");
        
        if (decoded.rebalanced) {
            console.log("   🎉 DEPLOYMENT TRIGGERED!");
            console.log("   Funds should be deploying to highest yielding protocol");
            console.log("");
        } else {
            console.log("   ⚠️  Spread may be below threshold (30 bps)");
            console.log("");
        }
    } else {
        console.log("   ⚠️  No StrategyUpdate events yet");
        console.log("   Initialization callback may still be processing");
        console.log("");
    }
    
    // Check Callback events
    console.log("2️⃣  Checking Callback Events:");
    console.log("");
    
    const callbackEvents = await rsc.queryFilter(
        rsc.filters.Callback(),
        fromBlock
    );
    
    console.log(`   Found ${callbackEvents.length} Callback events`);
    
    if (callbackEvents.length > 0) {
        const latest = callbackEvents[callbackEvents.length - 1];
        const decoded = rsc.interface.decodeEventLog(
            "Callback",
            latest.data,
            latest.topics
        );
        
        console.log("");
        console.log("   Latest Callback:");
        console.log(`     Chain ID: ${decoded.chainId.toString()}`);
        console.log(`     Target: ${decoded.target}`);
        console.log(`     Gas Limit: ${decoded.gasLimit.toString()}`);
        console.log(`     Block: ${latest.blockNumber}`);
        
        if (decoded.target.toLowerCase() === QUERY_HELPER.toLowerCase()) {
            console.log("     Type: QueryHelper (APY query)");
        } else {
            console.log("     Type: Adapter (Strategy execution)");
        }
        console.log("");
    }
    
    // Check QueryHelper events
    console.log("3️⃣  Checking QueryHelper Events:");
    console.log("");
    
    const queryHelperAbi = [
        "event BothApysQueried(uint256 indexed nonce, uint256 aaveApyBps, uint256 compoundApyBps, uint256 timestamp)"
    ];
    
    const queryHelper = new ethers.Contract(QUERY_HELPER, queryHelperAbi, arbitrumProvider);
    
    const arbBlock = await arbitrumProvider.getBlockNumber();
    const arbFromBlock = Math.max(0, arbBlock - 10000);
    
    const bothApysEvents = await queryHelper.queryFilter(
        queryHelper.filters.BothApysQueried(),
        arbFromBlock
    );
    
    console.log(`   Found ${bothApysEvents.length} BothApysQueried events`);
    
    if (bothApysEvents.length > 0) {
        const latest = bothApysEvents[bothApysEvents.length - 1];
        const decoded = queryHelper.interface.decodeEventLog(
            "BothApysQueried",
            latest.data,
            latest.topics
        );
        
        console.log("");
        console.log("   Latest BothApysQueried:");
        console.log(`     Nonce: ${decoded.nonce.toString()}`);
        console.log(`     Aave APY: ${decoded.aaveApyBps.toString()} bps`);
        console.log(`     Compound APY: ${decoded.compoundApyBps.toString()} bps`);
        console.log(`     Block: ${latest.blockNumber}`);
        console.log("");
    }
    
    // Check adapter executions
    console.log("4️⃣  Checking Adapter Executions:");
    console.log("");
    
    const ADAPTER = process.env.ADAPTER_ADDRESS;
    if (ADAPTER) {
        const adapterAbi = [
            "event ReactionExecuted(address indexed rsc, address indexed vault, uint256 indexed chainId, bool success, bytes data)"
        ];
        
        const adapter = new ethers.Contract(ADAPTER, adapterAbi, arbitrumProvider);
        
        const adapterEvents = await adapter.queryFilter(
            adapter.filters.ReactionExecuted(RSC_ADDRESS),
            arbFromBlock
        );
        
        console.log(`   Found ${adapterEvents.length} ReactionExecuted events`);
        
        if (adapterEvents.length > 0) {
            const latest = adapterEvents[adapterEvents.length - 1];
            const decoded = adapter.interface.decodeEventLog(
                "ReactionExecuted",
                latest.data,
                latest.topics
            );
            
            console.log("");
            console.log("   Latest Execution:");
            console.log(`     Success: ${decoded.success ? "✅" : "❌"}`);
            console.log(`     Block: ${latest.blockNumber}`);
            console.log("");
        }
    }
    
    console.log("=".repeat(70));
    console.log("📊 SUMMARY");
    console.log("=".repeat(70));
    console.log("");
}

checkInitializationResult().catch(console.error);

