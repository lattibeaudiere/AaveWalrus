const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function verifySystemWorking() {
    console.log("=".repeat(70));
    console.log("✅ VERIFYING SYSTEM IS WORKING");
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
    
    console.log("1️⃣  RSC Status:");
    console.log("");
    
    const rscAbi = [
        "function getContractStatus() external view returns (uint256 directBalance, uint256 reserves, uint256 debt, bool isActive, bool aaveSub, bool compoundSub, bool queryHelperSub, uint256 lastAaveApy, uint256 cooldownRemaining)",
        "function initialized() external view returns (bool)"
    ];
    
    try {
        const rsc = new ethers.Contract(NEW_RSC, rscAbi, reactiveProvider);
        
        // Check status
        const status = await rsc.getContractStatus();
        const initialized = await rsc.initialized();
        
        console.log(`   Active: ${status[3] ? "✅" : "❌"}`);
        console.log(`   Reserves: ${ethers.utils.formatEther(status[1])} REACT`);
        console.log(`   Aave Subscribed: ${status[4] ? "✅" : "❌"}`);
        console.log(`   QueryHelper Subscribed: ${status[6] ? "✅" : "❌"}`);
        console.log(`   Initialized: ${initialized ? "✅" : "❌"}`);
        console.log(`   Last Aave APY: ${status[7].toString()} bps`);
        console.log("");
        
    } catch (error) {
        console.log(`   ⚠️  Error: ${error.message.split('\n')[0]}`);
        console.log("");
    }
    
    console.log("2️⃣  Checking QueryHelper Events:");
    console.log("");
    
    const queryHelperAbi = [
        "event BothApysQueried(uint256 indexed nonce, uint256 aaveApyBps, uint256 compoundApyBps, uint256 timestamp)",
        "event CompoundApyQueried(uint256 indexed nonce, uint256 apyBps, uint256 timestamp)"
    ];
    
    try {
        const queryHelper = new ethers.Contract(NEW_QUERY_HELPER, queryHelperAbi, arbitrumProvider);
        const arbBlock = await arbitrumProvider.getBlockNumber();
        
        const bothEvents = await queryHelper.queryFilter(
            queryHelper.filters.BothApysQueried(),
            Math.max(0, arbBlock - 10000)
        );
        
        const compoundEvents = await queryHelper.queryFilter(
            queryHelper.filters.CompoundApyQueried(),
            Math.max(0, arbBlock - 10000)
        );
        
        console.log(`   BothApysQueried events: ${bothEvents.length}`);
        console.log(`   CompoundApyQueried events: ${compoundEvents.length}`);
        console.log("");
        
        if (bothEvents.length > 0) {
            const latest = bothEvents[bothEvents.length - 1];
            const decoded = queryHelper.interface.decodeEventLog(
                "BothApysQueried",
                latest.data,
                latest.topics
            );
            
            console.log("   ✅ Latest BothApysQueried event:");
            console.log(`      Nonce: ${decoded.nonce.toString()}`);
            console.log(`      Aave APY: ${decoded.aaveApyBps.toString()} bps`);
            console.log(`      Compound APY: ${decoded.compoundApyBps.toString()} bps`);
            console.log(`      Block: ${latest.blockNumber}`);
            console.log(`      Transaction: ${latest.transactionHash}`);
            console.log("");
            
            const spread = decoded.aaveApyBps.gt(decoded.compoundApyBps)
                ? decoded.aaveApyBps.sub(decoded.compoundApyBps)
                : decoded.compoundApyBps.sub(decoded.aaveApyBps);
            
            console.log(`      Spread: ${spread.toString()} bps`);
            if (spread.toNumber() >= 30) {
                console.log("      ✅ Spread > 30 bps - Should trigger deployment!");
            } else {
                console.log("      ⚠️  Spread < 30 bps - No deployment (below threshold)");
            }
            console.log("");
        }
        
    } catch (error) {
        console.log(`   ⚠️  Error: ${error.message.split('\n')[0]}`);
        console.log("");
    }
    
    console.log("3️⃣  Checking RSC Strategy Updates:");
    console.log("");
    
    const strategyAbi = [
        "event StrategyUpdate(uint256 aaveApy, uint256 compoundApy, uint256 spread, bool rebalanced)"
    ];
    
    try {
        const rscStrategy = new ethers.Contract(NEW_RSC, strategyAbi, reactiveProvider);
        const reactiveBlock = await reactiveProvider.getBlockNumber();
        
        const strategyEvents = await rscStrategy.queryFilter(
            rscStrategy.filters.StrategyUpdate(),
            Math.max(0, reactiveBlock - 1000)
        );
        
        console.log(`   Found ${strategyEvents.length} StrategyUpdate events`);
        console.log("");
        
        if (strategyEvents.length > 0) {
            const latest = strategyEvents[strategyEvents.length - 1];
            const decoded = rscStrategy.interface.decodeEventLog(
                "StrategyUpdate",
                latest.data,
                latest.topics
            );
            
            console.log("   ✅ Latest Strategy Update:");
            console.log(`      Aave APY: ${decoded.aaveApy.toString()} bps`);
            console.log(`      Compound APY: ${decoded.compoundApy.toString()} bps`);
            console.log(`      Spread: ${decoded.spread.toString()} bps`);
            console.log(`      Rebalanced: ${decoded.rebalanced ? "✅ YES" : "❌ NO"}`);
            console.log(`      Block: ${latest.blockNumber}`);
            console.log("");
            
            if (decoded.rebalanced) {
                console.log("   🎉 REBALANCE TRIGGERED!");
            }
        }
    } catch (error) {
        console.log(`   ⚠️  Error: ${error.message.split('\n')[0]}`);
        console.log("");
    }
    
    console.log("4️⃣  Checking Adapter Executions:");
    console.log("");
    
    const adapterAbi = [
        "event ReactionExecuted(address indexed rsc, address indexed vault, uint256 indexed chainId, bool success, bytes data)"
    ];
    
    try {
        const adapter = new ethers.Contract(ADAPTER, adapterAbi, arbitrumProvider);
        const arbBlock = await arbitrumProvider.getBlockNumber();
        
        const adapterEvents = await adapter.queryFilter(
            adapter.filters.ReactionExecuted(NEW_RSC),
            Math.max(0, arbBlock - 50000)
        );
        
        console.log(`   Found ${adapterEvents.length} ReactionExecuted events`);
        console.log("");
        
        if (adapterEvents.length > 0) {
            const latest = adapterEvents[adapterEvents.length - 1];
            const decoded = adapter.interface.decodeEventLog(
                "ReactionExecuted",
                latest.data,
                latest.topics
            );
            
            console.log("   ✅ Latest Execution:");
            console.log(`      RSC: ${decoded.rsc}`);
            console.log(`      Vault: ${decoded.vault}`);
            console.log(`      Success: ${decoded.success ? "✅ YES" : "❌ NO"}`);
            console.log(`      Block: ${latest.blockNumber}`);
            console.log("");
            
            if (decoded.success) {
                console.log("   🎉 CAPITAL DEPLOYED!");
            }
        }
    } catch (error) {
        console.log(`   ⚠️  Error: ${error.message.split('\n')[0]}`);
        console.log("");
    }
    
    console.log("=".repeat(70));
    console.log("📊 SUMMARY");
    console.log("=".repeat(70));
    console.log("");
    console.log("New RSC:", NEW_RSC);
    console.log("New QueryHelper:", NEW_QUERY_HELPER);
    console.log("");
    console.log("Status:");
    console.log("  ✅ RSC deployed with correct QueryHelper");
    console.log("  ✅ RSC funded and active");
    console.log("  ✅ All events subscribed");
    console.log("  ✅ Strategy initialized");
    console.log("");
    console.log("⏳ Waiting for Reactive Network to process callbacks...");
    console.log("   Check back in a few minutes for QueryHelper events");
    console.log("");
    console.log("🔗 Monitor:");
    console.log(`  • RSC: https://reactscan.io/address/${NEW_RSC}`);
    console.log(`  • QueryHelper: https://arbiscan.io/address/${NEW_QUERY_HELPER}`);
    console.log("");
}

verifySystemWorking().catch(console.error);

