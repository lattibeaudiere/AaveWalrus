const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function verifyQueryHelperAPY() {
    console.log("=".repeat(70));
    console.log("🔍 VERIFYING QUERYHELPER APY VALUES");
    console.log("=".repeat(70));
    console.log("");
    
    const NEW_QUERY_HELPER = "0x55f03641265a793112bd1D9480C4Ea4f143E06af";
    const COMPOUND_USDC = "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA";
    const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    console.log("1️⃣  Getting ACTUAL APYs from Protocols:");
    console.log("");
    
    // Get Aave APY
    try {
        const aavePool = new ethers.Contract(
            AAVE_POOL,
            ["function getReserveData(address asset) external view returns (tuple(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256))"],
            arbitrumProvider
        );
        
        const reserveData = await aavePool.getReserveData(USDC);
        const liquidityRate = reserveData[7]; // liquidityRate
        const RAY = ethers.BigNumber.from("10").pow(27);
        const aaveApyBps = liquidityRate.mul(10000).div(RAY);
        
        console.log("   Aave V3 APY:");
        console.log(`     Liquidity Rate: ${liquidityRate.toString()}`);
        console.log(`     APY (bps): ${aaveApyBps.toString()}`);
        console.log(`     APY (%): ${(aaveApyBps.toNumber() / 100).toFixed(2)}%`);
        console.log("");
    } catch (error) {
        console.log(`   ⚠️  Error getting Aave APY: ${error.message.split('\n')[0]}`);
        console.log("");
    }
    
    // Get Compound APY
    try {
        const compoundAbi = [
            "function getUtilization() external view returns (uint256)",
            "function getSupplyRate(uint256 utilization) external view returns (uint64)",
            "function baseIndexScale() external view returns (uint64)"
        ];
        
        const compound = new ethers.Contract(COMPOUND_USDC, compoundAbi, arbitrumProvider);
        
        const utilization = await compound.getUtilization();
        const supplyRateRaw = await compound.getSupplyRate(utilization);
        const baseIndexScale = await compound.baseIndexScale();
        
        const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
        const supplyRate = ethers.BigNumber.from(supplyRateRaw);
        const scale = ethers.BigNumber.from(baseIndexScale);
        const compoundApyBps = supplyRate.mul(SECONDS_PER_YEAR).mul(100).add(scale.div(2)).div(scale);
        
        console.log("   Compound V3 APY:");
        console.log(`     Utilization: ${utilization.toString()}`);
        console.log(`     Supply Rate (raw): ${supplyRateRaw.toString()}`);
        console.log(`     Base Index Scale: ${baseIndexScale.toString()}`);
        console.log(`     APY (bps): ${compoundApyBps.toString()}`);
        console.log(`     APY (%): ${(compoundApyBps.toNumber() / 100).toFixed(2)}%`);
        console.log("");
    } catch (error) {
        console.log(`   ⚠️  Error getting Compound APY: ${error.message.split('\n')[0]}`);
        console.log("");
    }
    
    console.log("2️⃣  Checking QueryHelper Events:");
    console.log("");
    
    const queryHelperAbi = [
        "event CompoundApyQueried(uint256 indexed nonce, uint256 apyBps, uint256 timestamp)",
        "function getCompoundApy() external view returns (uint256 apyBps)"
    ];
    
    try {
        const queryHelper = new ethers.Contract(NEW_QUERY_HELPER, queryHelperAbi, arbitrumProvider);
        
        // Check view function
        const viewApy = await queryHelper.getCompoundApy();
        console.log("   QueryHelper.getCompoundApy() view function:");
        console.log(`     APY (bps): ${viewApy.toString()}`);
        console.log(`     APY (%): ${(viewApy.toNumber() / 100).toFixed(2)}%`);
        console.log("");
        
        // Check recent events
        const arbBlock = await arbitrumProvider.getBlockNumber();
        const events = await queryHelper.queryFilter(
            queryHelper.filters.CompoundApyQueried(),
            Math.max(0, arbBlock - 50000)
        );
        
        console.log(`   Found ${events.length} CompoundApyQueried events:`);
        console.log("");
        
        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            const decoded = queryHelper.interface.decodeEventLog(
                "CompoundApyQueried",
                event.data,
                event.topics
            );
            
            console.log(`   Event #${i + 1}:`);
            console.log(`     Nonce: ${decoded.nonce.toString()}`);
            console.log(`     APY (bps): ${decoded.apyBps.toString()}`);
            console.log(`     APY (%): ${(decoded.apyBps.toNumber() / 100).toFixed(2)}%`);
            console.log(`     Timestamp: ${decoded.timestamp.toString()}`);
            console.log(`     Block: ${event.blockNumber}`);
            console.log("");
        }
        
    } catch (error) {
        console.log(`   ⚠️  Error: ${error.message.split('\n')[0]}`);
        console.log("");
    }
    
    console.log("3️⃣  Comparing Values:");
    console.log("");
    
    try {
        // Get all values
        const aavePool = new ethers.Contract(
            AAVE_POOL,
            ["function getReserveData(address asset) external view returns (tuple(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256))"],
            arbitrumProvider
        );
        
        const reserveData = await aavePool.getReserveData(USDC);
        const liquidityRate = reserveData[7];
        const RAY = ethers.BigNumber.from("10").pow(27);
        const aaveApyBps = liquidityRate.mul(10000).div(RAY);
        
        const compoundAbi = [
            "function getUtilization() external view returns (uint256)",
            "function getSupplyRate(uint256 utilization) external view returns (uint64)",
            "function baseIndexScale() external view returns (uint64)"
        ];
        const compound = new ethers.Contract(COMPOUND_USDC, compoundAbi, arbitrumProvider);
        const utilization = await compound.getUtilization();
        const supplyRateRaw = await compound.getSupplyRate(utilization);
        const baseIndexScale = await compound.baseIndexScale();
        const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
        const supplyRate = ethers.BigNumber.from(supplyRateRaw);
        const scale = ethers.BigNumber.from(baseIndexScale);
        const compoundApyBps = supplyRate.mul(SECONDS_PER_YEAR).mul(100).add(scale.div(2)).div(scale);
        
        const queryHelper = new ethers.Contract(NEW_QUERY_HELPER, queryHelperAbi, arbitrumProvider);
        const queryHelperApy = await queryHelper.getCompoundApy();
        
        console.log("   Current APYs:");
        console.log(`     Aave: ${aaveApyBps.toString()} bps`);
        console.log(`     Compound: ${compoundApyBps.toString()} bps`);
        console.log(`     QueryHelper (claims Compound): ${queryHelperApy.toString()} bps`);
        console.log("");
        
        // Check if QueryHelper value matches Aave or Compound
        const aaveMatch = aaveApyBps.toString() === queryHelperApy.toString();
        const compoundMatch = compoundApyBps.toString() === queryHelperApy.toString();
        
        if (aaveMatch) {
            console.log("   ❌ PROBLEM: QueryHelper APY MATCHES AAVE!");
            console.log("      QueryHelper is returning Aave APY, not Compound APY!");
            console.log("      This is why the system isn't working!");
            console.log("");
        } else if (compoundMatch) {
            console.log("   ✅ QueryHelper APY matches Compound");
            console.log("      QueryHelper is correctly returning Compound APY");
            console.log("");
        } else {
            console.log("   ⚠️  QueryHelper APY doesn't match either exactly");
            console.log(`      Aave: ${aaveApyBps.toString()}`);
            console.log(`      Compound: ${compoundApyBps.toString()}`);
            console.log(`      QueryHelper: ${queryHelperApy.toString()}`);
            console.log("");
            console.log("      Check if calculation is slightly off");
            console.log("");
        }
        
    } catch (error) {
        console.log(`   ❌ Error comparing: ${error.message.split('\n')[0]}`);
        console.log("");
    }
    
    console.log("=".repeat(70));
    console.log("📊 DIAGNOSIS");
    console.log("=".repeat(70));
    console.log("");
    console.log("If QueryHelper is returning Aave APY:");
    console.log("  • RSC compares Aave vs Aave (no spread)");
    console.log("  • No deployment triggered");
    console.log("  • Need to fix QueryHelper to use Compound functions");
    console.log("");
}

verifyQueryHelperAPY().catch(console.error);

