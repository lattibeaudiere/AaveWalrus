const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkActualCompoundAPR() {
    console.log("=".repeat(70));
    console.log("🔍 CHECKING ACTUAL COMPOUND APR");
    console.log("=".repeat(70));
    console.log("");
    
    const COMPOUND_USDC = "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA";
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    console.log("Website shows:");
    console.log("  Net Supply APR: 4.89% = 489 bps");
    console.log("  Net Borrow APR: 4.22% = 422 bps");
    console.log("");
    
    console.log("1️⃣  Getting Raw Values from Compound:");
    console.log("");
    
    const compoundAbi = [
        "function getUtilization() external view returns (uint256)",
        "function getSupplyRate(uint256 utilization) external view returns (uint64)",
        "function getBorrowRate(uint256 utilization) external view returns (uint64)",
        "function baseIndexScale() external view returns (uint64)",
        "function baseScale() external view returns (uint256)"
    ];
    
    try {
        const compound = new ethers.Contract(COMPOUND_USDC, compoundAbi, arbitrumProvider);
        
        const utilization = await compound.getUtilization();
        const supplyRateRaw = await compound.getSupplyRate(utilization);
        const borrowRateRaw = await compound.getBorrowRate(utilization);
        const baseIndexScale = await compound.baseIndexScale();
        const baseScale = await compound.baseScale();
        
        console.log(`   Utilization: ${utilization.toString()}`);
        console.log(`   Supply Rate (raw): ${supplyRateRaw.toString()}`);
        console.log(`   Borrow Rate (raw): ${borrowRateRaw.toString()}`);
        console.log(`   Base Index Scale: ${baseIndexScale.toString()}`);
        console.log(`   Base Scale: ${baseScale.toString()}`);
        console.log("");
        
        console.log("2️⃣  Testing Different Calculation Methods:");
        console.log("");
        
        const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
        const supplyRate = ethers.BigNumber.from(supplyRateRaw);
        const borrowRate = ethers.BigNumber.from(borrowRateRaw);
        const scale = ethers.BigNumber.from(baseIndexScale);
        
        // Method 1: Current (gives 3392 bps)
        const apy1 = supplyRate.mul(SECONDS_PER_YEAR).mul(100).add(scale.div(2)).div(scale);
        console.log(`   Method 1 (current): ${apy1.toString()} bps = ${(apy1.toNumber() / 100).toFixed(2)}%`);
        
        // Method 2: Divide by 10 (maybe we're off by 10x?)
        const apy2 = supplyRate.mul(SECONDS_PER_YEAR).mul(10).add(scale.div(2)).div(scale);
        console.log(`   Method 2 (divide by 10): ${apy2.toString()} bps = ${(apy2.toNumber() / 100).toFixed(2)}%`);
        
        // Method 3: Use baseScale instead of baseIndexScale
        const apy3 = supplyRate.mul(SECONDS_PER_YEAR).mul(100).div(baseScale);
        console.log(`   Method 3 (use baseScale): ${apy3.toString()} bps = ${(apy3.toNumber() / 100).toFixed(2)}%`);
        
        // Method 4: Maybe rate is already annual, just need to convert scale
        const apy4 = supplyRate.mul(100).div(scale);
        console.log(`   Method 4 (if already annual): ${apy4.toString()} bps = ${(apy4.toNumber() / 100).toFixed(2)}%`);
        
        // Method 5: Try with baseIndexScale as 1e15, but maybe we need different conversion
        // baseIndexScale = 1e15, so rate * SECONDS_PER_YEAR * 100 / 1e15
        // But maybe we need to divide by 1000 or something?
        const apy5 = supplyRate.mul(SECONDS_PER_YEAR).mul(100).div(scale).div(ethers.BigNumber.from(10));
        console.log(`   Method 5 (divide by 10): ${apy5.toString()} bps = ${(apy5.toNumber() / 100).toFixed(2)}%`);
        
        // Method 6: Try dividing SECONDS_PER_YEAR by 100
        const apy6 = supplyRate.mul(SECONDS_PER_YEAR.div(100)).mul(100).add(scale.div(2)).div(scale);
        console.log(`   Method 6 (divide seconds by 100): ${apy6.toString()} bps = ${(apy6.toNumber() / 100).toFixed(2)}%`);
        
        // Method 7: Maybe we need to use a different scale factor
        // If baseIndexScale = 1e15, and we want percentage, maybe:
        const apy7 = supplyRate.mul(SECONDS_PER_YEAR).div(scale).mul(100);
        console.log(`   Method 7 (different order): ${apy7.toString()} bps = ${(apy7.toNumber() / 100).toFixed(2)}%`);
        
        console.log("");
        
        console.log("3️⃣  Comparing to Expected (489 bps for Supply):");
        console.log("");
        
        const expected = 489;
        const methods = [
            { name: "Method 1 (current)", value: apy1.toNumber(), diff: Math.abs(apy1.toNumber() - expected) },
            { name: "Method 2 (divide by 10)", value: apy2.toNumber(), diff: Math.abs(apy2.toNumber() - expected) },
            { name: "Method 3 (baseScale)", value: apy3.toNumber(), diff: Math.abs(apy3.toNumber() - expected) },
            { name: "Method 4 (annual)", value: apy4.toNumber(), diff: Math.abs(apy4.toNumber() - expected) },
            { name: "Method 5 (divide by 10)", value: apy5.toNumber(), diff: Math.abs(apy5.toNumber() - expected) },
            { name: "Method 6 (seconds/100)", value: apy6.toNumber(), diff: Math.abs(apy6.toNumber() - expected) },
            { name: "Method 7 (different order)", value: apy7.toNumber(), diff: Math.abs(apy7.toNumber() - expected) }
        ];
        
        methods.sort((a, b) => a.diff - b.diff);
        
        for (const method of methods) {
            const match = method.diff < 50 ? "✅" : "❌";
            console.log(`   ${match} ${method.name}: ${method.value} bps (diff: ${method.diff} bps)`);
        }
        console.log("");
        
        const best = methods[0];
        if (best.diff < 50) {
            console.log(`   ✅ Best match: ${best.name} with ${best.value} bps`);
            console.log(`      This is close to expected 489 bps`);
            console.log("");
        } else {
            console.log(`   ⚠️  No method matches closely`);
            console.log(`      Closest: ${best.name} with ${best.value} bps (diff: ${best.diff} bps)`);
            console.log("");
        }
        
        // Also check borrow rate
        console.log("4️⃣  Checking Borrow Rate (expected 422 bps):");
        console.log("");
        
        const borrowApy1 = borrowRate.mul(SECONDS_PER_YEAR).mul(100).add(scale.div(2)).div(scale);
        console.log(`   Current method: ${borrowApy1.toString()} bps`);
        
        // Try the best method for supply on borrow
        if (best.name.includes("divide by 10")) {
            const borrowApy2 = borrowRate.mul(SECONDS_PER_YEAR).mul(10).add(scale.div(2)).div(scale);
            console.log(`   Method 2 (divide by 10): ${borrowApy2.toString()} bps`);
        }
        
        console.log("");
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
    
    console.log("=".repeat(70));
    console.log("💡 NEXT STEPS");
    console.log("=".repeat(70));
    console.log("");
    console.log("Once we find the correct formula:");
    console.log("  1. Update QueryHelper.sol");
    console.log("  2. Redeploy QueryHelper");
    console.log("  3. Verify values match website");
    console.log("");
}

checkActualCompoundAPR().catch(console.error);

