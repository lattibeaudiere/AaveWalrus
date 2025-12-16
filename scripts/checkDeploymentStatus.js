const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkDeploymentStatus() {
    console.log("=".repeat(70));
    console.log("🔍 CHECKING DEPLOYMENT STATUS");
    console.log("=".repeat(70));
    console.log("");
    
    const RSC_ADDRESS = "0xf64afe64622CeAe79d48A15ebC49CC7FF416c688";
    const QUERY_HELPER = process.env.QUERY_HELPER_ADDRESS || "0x05b402e333974134689424F13f01BC31F8fbfF56";
    const ADAPTER = process.env.ADAPTER_ADDRESS || "0x58DB4C40CE50FEfAD8EEaA0B609e12dE21b18805";
    const VAULT = process.env.TARGET_VAULT;
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://reactive-network.rpc.thirdweb.com"
    );
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    // Check 1: QueryHelper BothApysQueried events
    console.log("1️⃣  Checking QueryHelper BothApysQueried Events:");
    console.log("");
    
    const queryHelperAbi = [
        "event BothApysQueried(uint256 indexed nonce, uint256 aaveApyBps, uint256 compoundApyBps, uint256 timestamp)"
    ];
    
    const queryHelper = new ethers.Contract(QUERY_HELPER, queryHelperAbi, arbitrumProvider);
    
    try {
        const arbBlock = await arbitrumProvider.getBlockNumber();
        const bothApysEvents = await queryHelper.queryFilter(
            queryHelper.filters.BothApysQueried(),
            Math.max(0, arbBlock - 10000)
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
            console.log("   Latest Event:");
            console.log(`     Nonce: ${decoded.nonce.toString()}`);
            console.log(`     Aave APY: ${decoded.aaveApyBps.toString()} bps (${(parseFloat(decoded.aaveApyBps.toString()) / 100).toFixed(2)}%)`);
            console.log(`     Compound APY: ${decoded.compoundApyBps.toString()} bps (${(parseFloat(decoded.compoundApyBps.toString()) / 100).toFixed(2)}%)`);
            
            const spread = decoded.aaveApyBps.gt(decoded.compoundApyBps)
                ? decoded.aaveApyBps.sub(decoded.compoundApyBps)
                : decoded.compoundApyBps.sub(decoded.aaveApyBps);
            
            console.log(`     Spread: ${spread.toString()} bps`);
            console.log(`     Block: ${latest.blockNumber}`);
            console.log(`     Transaction: ${latest.transactionHash}`);
            console.log("");
            
            if (spread.toNumber() >= 30) {
                console.log("   ✅ Spread > 30 bps - Should trigger deployment!");
            } else {
                console.log("   ⚠️  Spread < 30 bps - No deployment (below threshold)");
            }
        } else {
            console.log("   ⚠️  No BothApysQueried events found");
            console.log("   Initialization may not have triggered QueryHelper yet");
        }
    } catch (error) {
        console.log("   ❌ Error:", error.message.split('\n')[0]);
    }
    
    console.log("");
    
    // Check 2: RSC StrategyUpdate events
    console.log("2️⃣  Checking RSC StrategyUpdate Events:");
    console.log("");
    
    const rscAbi = [
        "event StrategyUpdate(uint256 aaveApy, uint256 compoundApy, uint256 spread, bool rebalanced)"
    ];
    
    const rsc = new ethers.Contract(RSC_ADDRESS, rscAbi, reactiveProvider);
    
    try {
        const reactiveBlock = await reactiveProvider.getBlockNumber();
        const strategyEvents = await rsc.queryFilter(
            rsc.filters.StrategyUpdate(),
            Math.max(0, reactiveBlock - 5000)
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
            console.log(`     Aave APY: ${decoded.aaveApy.toString()} bps (${(parseFloat(decoded.aaveApy.toString()) / 100).toFixed(2)}%)`);
            console.log(`     Compound APY: ${decoded.compoundApy.toString()} bps (${(parseFloat(decoded.compoundApy.toString()) / 100).toFixed(2)}%)`);
            console.log(`     Spread: ${decoded.spread.toString()} bps`);
            console.log(`     Rebalanced: ${decoded.rebalanced ? "✅ YES" : "❌ NO"}`);
            console.log(`     Block: ${latest.blockNumber}`);
            console.log(`     Transaction: ${latest.transactionHash}`);
            console.log("");
            
            if (decoded.rebalanced) {
                console.log("   🎉 DEPLOYMENT TRIGGERED!");
            } else {
                console.log("   ⚠️  No deployment (spread too small or cooldown active)");
            }
        } else {
            console.log("   ⚠️  No StrategyUpdate events yet");
        }
    } catch (error) {
        console.log("   ❌ Error:", error.message.split('\n')[0]);
    }
    
    console.log("");
    
    // Check 3: Adapter ReactionExecuted events
    console.log("3️⃣  Checking Adapter Executions:");
    console.log("");
    
    const adapterAbi = [
        "event ReactionExecuted(address indexed rsc, address indexed vault, uint256 indexed chainId, bool success, bytes data)"
    ];
    
    const adapter = new ethers.Contract(ADAPTER, adapterAbi, arbitrumProvider);
    
    try {
        const arbBlock = await arbitrumProvider.getBlockNumber();
        const adapterEvents = await adapter.queryFilter(
            adapter.filters.ReactionExecuted(RSC_ADDRESS),
            Math.max(0, arbBlock - 50000)
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
            console.log(`     RSC: ${decoded.rsc}`);
            console.log(`     Vault: ${decoded.vault}`);
            console.log(`     Success: ${decoded.success ? "✅ YES" : "❌ NO"}`);
            console.log(`     Block: ${latest.blockNumber}`);
            console.log(`     Transaction: ${latest.transactionHash}`);
            console.log("");
            
            if (decoded.success) {
                console.log("   ✅ Strategy executed successfully!");
                console.log("   Funds should be deployed to vault");
            } else {
                console.log("   ❌ Execution failed");
                if (decoded.data && decoded.data !== "0x") {
                    console.log(`   Error data: ${decoded.data}`);
                }
            }
        } else {
            console.log("   ⚠️  No ReactionExecuted events yet");
        }
    } catch (error) {
        console.log("   ❌ Error:", error.message.split('\n')[0]);
    }
    
    console.log("");
    
    // Check 4: Vault state (if we can)
    if (VAULT) {
        console.log("4️⃣  Checking Vault State:");
        console.log("");
        
        try {
            // Try to get vault balance via provider
            const vaultCode = await arbitrumProvider.getCode(VAULT);
            if (vaultCode !== "0x") {
                console.log("   ✅ Vault exists");
                console.log(`   Address: ${VAULT}`);
                console.log("");
                console.log("   💡 Check vault UI to see if funds are deployed");
                console.log("   Expected: Funds should be in Aave or Compound if deployed");
            } else {
                console.log("   ⚠️  Vault not found");
            }
        } catch (error) {
            console.log("   ⚠️  Could not check vault");
        }
        console.log("");
    }
    
    console.log("=".repeat(70));
    console.log("📊 SUMMARY");
    console.log("=".repeat(70));
    console.log("");
    console.log("RSC Address:", RSC_ADDRESS);
    console.log("QueryHelper:", QUERY_HELPER);
    console.log("Adapter:", ADAPTER);
    console.log("");
    console.log("Monitor Reactscan for RSC activity:");
    console.log(`   https://reactscan.io/address/${RSC_ADDRESS}`);
    console.log("");
    console.log("Monitor Arbiscan for QueryHelper and Adapter:");
    console.log(`   QueryHelper: https://arbiscan.io/address/${QUERY_HELPER}`);
    console.log(`   Adapter: https://arbiscan.io/address/${ADAPTER}`);
    console.log("");
}

checkDeploymentStatus().catch(console.error);

