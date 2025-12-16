const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function testAPYCalculation() {
    console.log("=".repeat(70));
    console.log("🔍 TESTING APY CALCULATION");
    console.log("=".repeat(70));
    console.log("");
    
    const COMPOUND_USDC = "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA";
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    console.log("Expected from website:");
    console.log("  Net Supply APR: 3.38% = 338 bps");
    console.log("");
    
    console.log("1️⃣  Getting Raw Values from Compound:");
    console.log("");
    
    const compoundAbi = [
        "function getUtilization() external view returns (uint256)",
        "function getSupplyRate(uint256 utilization) external view returns (uint64)",
        "function baseIndexScale() external view returns (uint64)"
    ];
    
    try {
        const compound = new ethers.Contract(COMPOUND_USDC, compoundAbi, arbitrumProvider);
        
        const utilization = await compound.getUtilization();
        const supplyRateRaw = await compound.getSupplyRate(utilization);
        const baseIndexScale = await compound.baseIndexScale();
        
        console.log(`   Utilization: ${utilization.toString()}`);
        console.log(`   Supply Rate (raw): ${supplyRateRaw.toString()}`);
        console.log(`   Base Index Scale: ${baseIndexScale.toString()}`);
        console.log("");
        
        // Test different calculation methods
        const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
        
        console.log("2️⃣  Testing Different Calculation Methods:");
        console.log("");
        
        // Method 1: Current (wrong) - off by 10x
        const supplyRate = ethers.BigNumber.from(supplyRateRaw);
        const scale = ethers.BigNumber.from(baseIndexScale);
        const apy1 = supplyRate.mul(SECONDS_PER_YEAR).mul(100).add(scale.div(2)).div(scale);
        console.log(`   Method 1 (current): ${apy1.toString()} bps = ${(apy1.toNumber() / 100).toFixed(2)}%`);
        console.log(`     Formula: (supplyRate * SECONDS_PER_YEAR * 100) / baseIndexScale`);
        console.log("");
        
        // Method 2: Remove the * 100
        const apy2 = supplyRate.mul(SECONDS_PER_YEAR).add(scale.div(2)).div(scale);
        console.log(`   Method 2: ${apy2.toString()} bps = ${(apy2.toNumber() / 100).toFixed(2)}%`);
        console.log(`     Formula: (supplyRate * SECONDS_PER_YEAR) / baseIndexScale * 100`);
        console.log("");
        
        // Method 3: Use baseIndexScale differently
        // baseIndexScale is 1e15, so we need to convert to percentage
        // If supplyRate is per second scaled by baseIndexScale, then:
        // APY = (supplyRate / baseIndexScale) * SECONDS_PER_YEAR * 100
        const apy3 = supplyRate.mul(SECONDS_PER_YEAR).mul(100).div(scale);
        console.log(`   Method 3: ${apy3.toString()} bps = ${(apy3.toNumber() / 100).toFixed(2)}%`);
        console.log(`     Formula: (supplyRate * SECONDS_PER_YEAR * 100) / baseIndexScale (no rounding)`);
        console.log("");
        
        // Method 4: Check if baseIndexScale is actually 1e18 not 1e15
        // baseIndexScale = 1000000000000000 = 1e15
        // But maybe we need 1e18?
        const scale18 = ethers.BigNumber.from("10").pow(18);
        const apy4 = supplyRate.mul(SECONDS_PER_YEAR).mul(100).div(scale18);
        console.log(`   Method 4 (using 1e18): ${apy4.toString()} bps = ${(apy4.toNumber() / 100).toFixed(2)}%`);
        console.log(`     Formula: (supplyRate * SECONDS_PER_YEAR * 100) / 1e18`);
        console.log("");
        
        // Method 5: Check if we need to divide by 1e15 instead
        // baseIndexScale = 1e15, so rate is already scaled
        // APY = (supplyRate / 1e15) * SECONDS_PER_YEAR * 100
        const scale15 = ethers.BigNumber.from("10").pow(15);
        const apy5 = supplyRate.mul(SECONDS_PER_YEAR).mul(100).div(scale15);
        console.log(`   Method 5 (using 1e15): ${apy5.toString()} bps = ${(apy5.toNumber() / 100).toFixed(2)}%`);
        console.log(`     Formula: (supplyRate * SECONDS_PER_YEAR * 100) / 1e15`);
        console.log("");
        
        // Method 6: Maybe the rate is already annualized?
        // If supplyRate is already an annual rate, we just need to convert to percentage
        const apy6 = supplyRate.mul(100).div(scale);
        console.log(`   Method 6 (if already annual): ${apy6.toString()} bps = ${(apy6.toNumber() / 100).toFixed(2)}%`);
        console.log(`     Formula: (supplyRate * 100) / baseIndexScale`);
        console.log("");
        
        // Find which one is closest to 338 bps
        console.log("3️⃣  Comparing to Expected (338 bps):");
        console.log("");
        
        const expected = 338;
        const methods = [
            { name: "Method 1 (current)", value: apy1.toNumber(), diff: Math.abs(apy1.toNumber() - expected) },
            { name: "Method 2", value: apy2.toNumber(), diff: Math.abs(apy2.toNumber() - expected) },
            { name: "Method 3", value: apy3.toNumber(), diff: Math.abs(apy3.toNumber() - expected) },
            { name: "Method 4 (1e18)", value: apy4.toNumber(), diff: Math.abs(apy4.toNumber() - expected) },
            { name: "Method 5 (1e15)", value: apy5.toNumber(), diff: Math.abs(apy5.toNumber() - expected) },
            { name: "Method 6 (annual)", value: apy6.toNumber(), diff: Math.abs(apy6.toNumber() - expected) }
        ];
        
        methods.sort((a, b) => a.diff - b.diff);
        
        for (const method of methods) {
            const match = method.diff < 10 ? "✅" : "❌";
            console.log(`   ${match} ${method.name}: ${method.value} bps (diff: ${method.diff} bps)`);
        }
        console.log("");
        
        const best = methods[0];
        console.log(`   Best match: ${best.name} with ${best.value} bps`);
        console.log("");
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
    
    console.log("=".repeat(70));
    console.log("💡 SOLUTION");
    console.log("=".repeat(70));
    console.log("");
    console.log("Once we find the correct calculation:");
    console.log("  1. Update QueryHelper.sol");
    console.log("  2. Redeploy QueryHelper");
    console.log("  3. Test with correct APY values");
    console.log("");
}

testAPYCalculation().catch(console.error);

