const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function triggerInitialDeployment() {
    console.log("=".repeat(70));
    console.log("🚀 TRIGGERING INITIAL DEPLOYMENT");
    console.log("=".repeat(70));
    console.log("");
    
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0xAC66a994B8BB8b4a9aC90830Ac72207Cd22e7f21";
    const QUERY_HELPER = process.env.QUERY_HELPER_ADDRESS || "0x809bCab55D850CF2380d074c9b962f0F1D447a97";
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://reactive-network.rpc.thirdweb.com"
    );
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    console.log("Problem: RSC only reacts to EVENTS, not current state");
    console.log("Solution: We need to manually trigger the strategy cycle");
    console.log("");
    
    // Check current APYs first
    console.log("1️⃣  Checking Current APYs:");
    console.log("");
    
    try {
        // Aave V3
        const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
        const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
        
        const aavePool = new ethers.Contract(
            AAVE_POOL,
            ["function getReserveData(address asset) external view returns (tuple(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256))"],
            arbitrumProvider
        );
        
        const reserveData = await aavePool.getReserveData(USDC);
        const aaveLiquidityRate = reserveData[7]; // liquidityRate
        const aaveApyBps = (aaveLiquidityRate.mul(10000)).div(ethers.BigNumber.from(10).pow(27));
        
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
        console.log(`   Should deploy: ${spread.toNumber() >= 30 ? "✅ YES" : "❌ NO (spread too small)"}`);
        console.log("");
        
        if (spread.toNumber() < 30) {
            console.log("⚠️  Spread is below threshold (30 bps)");
            console.log("   System will not deploy until spread increases");
            return;
        }
        
    } catch (error) {
        console.log("   ❌ Error checking APYs:", error.message);
        console.log("");
    }
    
    console.log("2️⃣  Checking RSC Interface:");
    console.log("");
    
    // Check if RSC has a manual trigger function
    const rscAbi = [
        "function queryCompoundApyManually() external",
        "function triggerInitialDeployment() external",
        "function executeStrategy() external"
    ];
    
    try {
        const rsc = new ethers.Contract(RSC_ADDRESS, rscAbi, reactiveProvider);
        // Try calling a manual trigger function if it exists
        console.log("   ⚠️  RSC doesn't have manual trigger function");
        console.log("   It only reacts to events");
        console.log("");
    } catch (error) {
        console.log("   ❌ RSC doesn't have manual trigger");
        console.log("");
    }
    
    console.log("3️⃣  Solution: Trigger via QueryHelper Callback");
    console.log("");
    console.log("Since RSC is event-driven, we need to:");
    console.log("  1. Manually call QueryHelper.queryCompoundApy()");
    console.log("  2. This emits CompoundApyQueried event");
    console.log("  3. RSC will process the event and deploy if spread > 30 bps");
    console.log("");
    console.log("However, this only works if RSC has lastAaveApyBps set");
    console.log("");
    
    // Check if RSC has lastAaveApyBps set
    try {
        const statusAbi = ["function lastAaveApyBps() external view returns (uint256)"];
        const rsc = new ethers.Contract(RSC_ADDRESS, statusAbi, reactiveProvider);
        const lastAaveApy = await rsc.lastAaveApyBps();
        
        if (lastAaveApy.toString() === "0") {
            console.log("   ❌ RSC has no last Aave APY (lastAaveApyBps = 0)");
            console.log("   Need an Aave event first to set the baseline");
            console.log("");
            console.log("   ⚠️  System is waiting for first Aave event");
            console.log("   Once an Aave ReserveDataUpdated event occurs:");
            console.log("     1. RSC will extract Aave APY");
            console.log("     2. RSC will query Compound APY");
            console.log("     3. If spread > 30 bps, deploy to highest yield");
            console.log("");
        } else {
            console.log(`   ✅ RSC has last Aave APY: ${lastAaveApy.toString()} bps`);
            console.log("   Can trigger QueryHelper now!");
            console.log("");
            
            // Trigger QueryHelper
            const wallet = new ethers.Wallet(
                process.env.PRIVATE_KEY || process.env.ARBITRUM_PRIVATE_KEY,
                arbitrumProvider
            );
            
            const queryHelper = new ethers.Contract(
                QUERY_HELPER,
                ["function queryCompoundApy(uint256 nonce) external returns (uint256 apyBps)"],
                wallet
            );
            
            // Get current nonce from RSC
            const nonceAbi = ["function queryNonce() external view returns (uint256)"];
            const rscNonce = new ethers.Contract(RSC_ADDRESS, nonceAbi, reactiveProvider);
            const nonce = await rscNonce.queryNonce();
            
            console.log(`   Triggering QueryHelper with nonce: ${nonce.toString()}`);
            
            const tx = await queryHelper.queryCompoundApy(nonce.add(1), { gasLimit: 200000 });
            console.log(`   Transaction: ${tx.hash}`);
            console.log("   Waiting...");
            
            await tx.wait();
            console.log("   ✅ QueryHelper triggered!");
            console.log("   RSC should process the event and deploy if spread > 30 bps");
        }
        
    } catch (error) {
        console.log("   ❌ Error:", error.message);
    }
    
    console.log("");
    console.log("=".repeat(70));
    console.log("📊 SUMMARY");
    console.log("=".repeat(70));
    console.log("");
    console.log("The RSC is EVENT-DRIVEN:");
    console.log("  • Only reacts to events, not current state");
    console.log("  • Needs Aave event to set baseline APY");
    console.log("  • Then queries Compound and deploys if spread > 30 bps");
    console.log("");
    console.log("Solution: Add initial deployment trigger OR wait for first Aave event");
    console.log("");
}

triggerInitialDeployment().catch(console.error);

