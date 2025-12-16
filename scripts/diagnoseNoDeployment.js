const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function diagnoseNoDeployment() {
    console.log("=".repeat(70));
    console.log("🔍 DIAGNOSING WHY CAPITAL HASN'T BEEN DEPLOYED");
    console.log("=".repeat(70));
    console.log("");
    
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0xAC66a994B8BB8b4a9aC90830Ac72207Cd22e7f21";
    const ADAPTER_ADDRESS = process.env.ADAPTER_ADDRESS || "0x58DB4C40CE50FEfAD8EEaA0B609e12dE21b18805";
    const QUERY_HELPER = process.env.QUERY_HELPER_ADDRESS || "0x809bCab55D850CF2380d074c9b962f0F1D447a97";
    const VAULT = process.env.TARGET_VAULT;
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://reactive-network.rpc.thirdweb.com"
    );
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    console.log("1️⃣  Checking RSC Event Processing:");
    console.log("");
    
    // Check StrategyUpdate events on Reactive Network
    const rscAbi = [
        "event StrategyUpdate(uint256 aaveApyBps, uint256 compoundApyBps, int256 spreadBps, bool rebalanced)"
    ];
    
    const rsc = new ethers.Contract(RSC_ADDRESS, rscAbi, reactiveProvider);
    
    try {
        const currentBlock = await reactiveProvider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 10000); // Last ~10000 blocks
        
        const events = await rsc.queryFilter(
            rsc.filters.StrategyUpdate(),
            fromBlock
        );
        
        console.log(`   Found ${events.length} StrategyUpdate events`);
        console.log("");
        
        if (events.length > 0) {
            const latest = events[events.length - 1];
            const decoded = rsc.interface.decodeEventLog(
                "StrategyUpdate",
                latest.data,
                latest.topics
            );
            
            console.log("   Latest Strategy Update:");
            console.log(`     Aave APY: ${decoded.aaveApyBps.toString()} bps (${(decoded.aaveApyBps.toNumber() / 100).toFixed(2)}%)`);
            console.log(`     Compound APY: ${decoded.compoundApyBps.toString()} bps (${(decoded.compoundApyBps.toNumber() / 100).toFixed(2)}%)`);
            console.log(`     Spread: ${decoded.spreadBps.toString()} bps`);
            console.log(`     Rebalanced: ${decoded.rebalanced ? "✅ YES" : "❌ NO"}`);
            console.log(`     Block: ${latest.blockNumber}`);
            console.log(`     Timestamp: ${new Date((await reactiveProvider.getBlock(latest.blockNumber)).timestamp * 1000).toISOString()}`);
            console.log("");
            
            if (!decoded.rebalanced) {
                console.log("   ⚠️  Strategy updated but NO rebalance occurred!");
                console.log(`   Spread (${decoded.spreadBps.toString()} bps) may be below threshold (30 bps)`);
                console.log("");
            }
        } else {
            console.log("   ⚠️  No StrategyUpdate events found");
            console.log("   This means the RSC hasn't completed a full strategy cycle yet");
            console.log("");
        }
        
    } catch (error) {
        console.log("   ❌ Error checking RSC events:", error.message);
        console.log("");
    }
    
    console.log("2️⃣  Checking Callback Events:");
    console.log("");
    
    // Check for Callback events (RSC emitting callbacks to adapter)
    try {
        const callbackEvents = await rsc.queryFilter(
            rsc.filters.Callback ? rsc.filters.Callback() : "Callback",
            Math.max(0, await reactiveProvider.getBlockNumber() - 10000)
        );
        
        console.log(`   Found ${callbackEvents.length} Callback events`);
        if (callbackEvents.length > 0) {
            console.log("   ✅ RSC is emitting callbacks (trying to execute)");
        } else {
            console.log("   ⚠️  No Callback events - RSC not trying to execute");
        }
        console.log("");
    } catch (error) {
        console.log("   ⚠️  Could not check Callback events:", error.message.split('\n')[0]);
        console.log("");
    }
    
    console.log("3️⃣  Checking Adapter Execution:");
    console.log("");
    
    const adapterAbi = [
        "event ReactionExecuted(address indexed rsc, address indexed vault, uint256 indexed chainId, bool success, bytes data)"
    ];
    
    const adapter = new ethers.Contract(ADAPTER_ADDRESS, adapterAbi, arbitrumProvider);
    
    try {
        const currentBlock = await arbitrumProvider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 100000); // Last ~100k blocks
        
        const events = await adapter.queryFilter(
            adapter.filters.ReactionExecuted(),
            fromBlock
        );
        
        console.log(`   Found ${events.length} ReactionExecuted events`);
        console.log("");
        
        if (events.length > 0) {
            const latest = events[events.length - 1];
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
            console.log(`     Timestamp: ${new Date((await arbitrumProvider.getBlock(latest.blockNumber)).timestamp * 1000).toISOString()}`);
            console.log("");
            
            if (!decoded.success) {
                console.log("   ⚠️  Execution failed!");
                if (decoded.data && decoded.data !== "0x") {
                    console.log(`   Error data: ${decoded.data}`);
                }
            }
        } else {
            console.log("   ⚠️  No ReactionExecuted events");
            console.log("   This means the adapter hasn't executed any reactions yet");
            console.log("");
        }
        
    } catch (error) {
        console.log("   ❌ Error checking adapter events:", error.message);
        console.log("");
    }
    
    console.log("4️⃣  Checking Current APY Spread:");
    console.log("");
    
    // Check current Aave and Compound APYs
    try {
        // Aave V3 Data Provider on Arbitrum
        const AAVE_DATA_PROVIDER = "0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654";
        const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
        
        const aaveDataProvider = new ethers.Contract(
            AAVE_DATA_PROVIDER,
            ["function getReserveData(address asset) external view returns (tuple(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256))"],
            arbitrumProvider
        );
        
        const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
        const data = await aaveDataProvider.getReserveData(USDC);
        const liquidityRate = data.liquidityIndex; // This is actually the index, need liquidityRate
        
        // Get liquidityRate from the pool
        const aavePool = new ethers.Contract(
            AAVE_POOL,
            ["function getReserveData(address asset) external view returns (tuple(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256))"],
            arbitrumProvider
        );
        
        const reserveData = await aavePool.getReserveData(USDC);
        const aaveLiquidityRate = reserveData[7]; // liquidityRate is at index 7
        const aaveApyBps = (aaveLiquidityRate * 10000) / ethers.BigNumber.from(10).pow(27);
        
        console.log(`   Aave APY: ${aaveApyBps.toString()} bps (${(aaveApyBps.toNumber() / 100).toFixed(2)}%)`);
        
        // Compound V3
        const COMPOUND_USDC = "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA";
        const compound = new ethers.Contract(
            COMPOUND_USDC,
            ["function supplyRatePerSecond() external view returns (uint256)"],
            arbitrumProvider
        );
        
        const compoundRate = await compound.supplyRatePerSecond();
        const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
        const RAY = ethers.BigNumber.from(10).pow(27);
        const compoundApyBps = (compoundRate.mul(SECONDS_PER_YEAR).mul(100).add(RAY.div(2))).div(RAY);
        
        console.log(`   Compound APY: ${compoundApyBps.toString()} bps (${(compoundApyBps.toNumber() / 100).toFixed(2)}%)`);
        
        const spread = aaveApyBps.gt(compoundApyBps) 
            ? aaveApyBps.sub(compoundApyBps)
            : compoundApyBps.sub(aaveApyBps);
        
        console.log(`   Spread: ${spread.toString()} bps (${(spread.toNumber() / 100).toFixed(2)}%)`);
        console.log(`   Threshold: 30 bps`);
        console.log(`   Should rebalance: ${spread.toNumber() >= 30 ? "✅ YES" : "❌ NO (spread too small)"}`);
        console.log("");
        
    } catch (error) {
        console.log("   ❌ Error checking APYs:", error.message);
        console.log("");
    }
    
    console.log("5️⃣  Checking RSC Last Known State:");
    console.log("");
    
    // Try to call getContractStatus on RSC
    try {
        const statusAbi = [
            "function getContractStatus() external view returns (uint256 directBalance, uint256 reserves, uint256 debt, bool isActive, bool aaveSub, bool compoundSub, bool queryHelperSub, uint256 lastAaveApy, uint256 cooldownRemaining)"
        ];
        
        const rscStatus = new ethers.Contract(RSC_ADDRESS, statusAbi, reactiveProvider);
        const status = await rscStatus.getContractStatus();
        
        console.log("   RSC Status:");
        console.log(`     Active: ${status.isActive ? "✅" : "❌"}`);
        console.log(`     Aave Subscribed: ${status.aaveSub ? "✅" : "❌"}`);
        console.log(`     Compound Subscribed: ${status.compoundSub ? "❌" : "✅ QueryHelper Sub"}`);
        console.log(`     QueryHelper Subscribed: ${status.queryHelperSub ? "✅" : "❌"}`);
        console.log(`     Last Aave APY: ${status.lastAaveApy.toString()} bps`);
        console.log(`     Cooldown Remaining: ${status.cooldownRemaining.toString()} seconds`);
        console.log("");
        
        if (!status.isActive) {
            console.log("   ⚠️  RSC is NOT active (insufficient reserves)");
        }
        if (!status.queryHelperSub) {
            console.log("   ⚠️  RSC is NOT subscribed to QueryHelper (can't get Compound APY)");
        }
        
    } catch (error) {
        console.log("   ⚠️  Could not check RSC status:", error.message.split('\n')[0]);
        console.log("");
    }
    
    console.log("=".repeat(70));
    console.log("📊 SUMMARY");
    console.log("=".repeat(70));
    console.log("");
}

diagnoseNoDeployment().catch(console.error);
