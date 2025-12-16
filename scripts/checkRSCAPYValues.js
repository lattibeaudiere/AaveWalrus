const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkRSCAPYValues() {
    console.log("=".repeat(70));
    console.log("🔍 CHECKING RSC APY VALUES");
    console.log("=".repeat(70));
    console.log("");
    
    const NEW_RSC = "0x7Af5dC1f012d4a875E40d2ffD5E39d7468c59E14";
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://reactive-network.rpc.thirdweb.com"
    );
    
    const rscAbi = [
        "function lastAaveApyBps() external view returns (uint256)",
        "function getContractStatus() external view returns (uint256 directBalance, uint256 reserves, uint256 debt, bool isActive, bool aaveSub, bool compoundSub, bool queryHelperSub, uint256 lastAaveApy, uint256 cooldownRemaining)"
    ];
    
    try {
        const rsc = new ethers.Contract(NEW_RSC, rscAbi, reactiveProvider);
        
        const lastAaveApy = await rsc.lastAaveApyBps();
        const status = await rsc.getContractStatus();
        
        console.log("RSC Stored Values:");
        console.log(`   lastAaveApyBps: ${lastAaveApy.toString()} bps`);
        console.log(`   From getContractStatus: ${status[7].toString()} bps`);
        console.log("");
        
        if (lastAaveApy.toString() === "0") {
            console.log("   ⚠️  RSC has NO Aave APY stored!");
            console.log("      This means RSC has never processed an Aave event");
            console.log("      Or Aave events are not being processed");
            console.log("");
        } else {
            console.log(`   ✅ RSC has Aave APY: ${(lastAaveApy.toNumber() / 100).toFixed(2)}%`);
            console.log("");
        }
        
        // Check StrategyUpdate events to see what APYs were compared
        const strategyAbi = [
            "event StrategyUpdate(uint256 aaveApy, uint256 compoundApy, uint256 spread, bool rebalanced)"
        ];
        
        const rscStrategy = new ethers.Contract(NEW_RSC, strategyAbi, reactiveProvider);
        const reactiveBlock = await reactiveProvider.getBlockNumber();
        
        const strategyEvents = await rscStrategy.queryFilter(
            rscStrategy.filters.StrategyUpdate(),
            Math.max(0, reactiveBlock - 10000)
        );
        
        console.log(`Found ${strategyEvents.length} StrategyUpdate events:`);
        console.log("");
        
        if (strategyEvents.length > 0) {
            console.log("   Recent Strategy Updates:");
            console.log("");
            
            for (let i = 0; i < Math.min(strategyEvents.length, 5); i++) {
                const event = strategyEvents[i];
                const decoded = rscStrategy.interface.decodeEventLog(
                    "StrategyUpdate",
                    event.data,
                    event.topics
                );
                
                console.log(`   Update #${i + 1}:`);
                console.log(`     Aave APY: ${decoded.aaveApy.toString()} bps (${(decoded.aaveApy.toNumber() / 100).toFixed(2)}%)`);
                console.log(`     Compound APY: ${decoded.compoundApy.toString()} bps (${(decoded.compoundApy.toNumber() / 100).toFixed(2)}%)`);
                console.log(`     Spread: ${decoded.spread.toString()} bps`);
                console.log(`     Rebalanced: ${decoded.rebalanced ? "✅ YES" : "❌ NO"}`);
                console.log(`     Block: ${event.blockNumber}`);
                console.log("");
                
                // Check if values match
                if (decoded.aaveApy.toString() === decoded.compoundApy.toString()) {
                    console.log(`     ⚠️  WARNING: Aave and Compound APYs are the SAME!`);
                    console.log(`        This suggests QueryHelper is returning Aave APY, not Compound!`);
                    console.log("");
                }
            }
        } else {
            console.log("   ⚠️  No StrategyUpdate events found");
            console.log("      RSC has never compared APYs");
            console.log("      This means RSC hasn't received both APY values");
            console.log("");
        }
        
        // Check ReactHandled events to see what events RSC processed
        const reactAbi = [
            "event ReactHandled(uint256 txHash, address eventSource, uint256 topic0)"
        ];
        
        const rscReact = new ethers.Contract(NEW_RSC, reactAbi, reactiveProvider);
        const reactEvents = await rscReact.queryFilter(
            rscReact.filters.ReactHandled(),
            Math.max(0, reactiveBlock - 10000)
        );
        
        console.log(`ReactHandled events: ${reactEvents.length}`);
        console.log("");
        
        if (reactEvents.length > 0) {
            console.log("   Recent events processed by RSC:");
            for (let i = 0; i < Math.min(reactEvents.length, 5); i++) {
                const event = reactEvents[i];
                const decoded = rscReact.interface.decodeEventLog(
                    "ReactHandled",
                    event.data,
                    event.topics
                );
                
                console.log(`     Event Source: ${decoded.eventSource}`);
                console.log(`     Topic0: ${decoded.topic0.toString()}`);
                console.log(`     Block: ${event.blockNumber}`);
                console.log("");
            }
        }
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
    
    console.log("=".repeat(70));
    console.log("📊 ANALYSIS");
    console.log("=".repeat(70));
    console.log("");
    console.log("If you see 3392 bps shown as 'APY':");
    console.log("  • This is Compound APY (33.92%)");
    console.log("  • QueryHelper is correctly returning Compound");
    console.log("");
    console.log("If RSC has lastAaveApyBps = 0:");
    console.log("  • RSC hasn't received/processed Aave events");
    console.log("  • Need to check Aave event processing");
    console.log("");
    console.log("If StrategyUpdate shows same APY for both:");
    console.log("  • QueryHelper might be returning wrong value");
    console.log("  • Or RSC is using wrong APY source");
    console.log("");
}

checkRSCAPYValues().catch(console.error);

