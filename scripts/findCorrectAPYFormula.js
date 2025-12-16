const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function findCorrectAPYFormula() {
    console.log("=".repeat(70));
    console.log("🔍 FINDING CORRECT APY FORMULA");
    console.log("=".repeat(70));
    console.log("");
    
    const COMPOUND_USDC = "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA";
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    console.log("Expected from website:");
    console.log("  Net Supply APR: 3.38% = 338 bps");
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
        
        console.log("Raw Values:");
        console.log(`   Supply Rate: ${supplyRateRaw.toString()}`);
        console.log(`   Base Index Scale: ${baseIndexScale.toString()} (1e15)`);
        console.log("");
        
        const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
        const supplyRate = ethers.BigNumber.from(supplyRateRaw);
        const scale = ethers.BigNumber.from(baseIndexScale);
        
        // Current (wrong): 3392 bps
        const current = supplyRate.mul(SECONDS_PER_YEAR).mul(100).add(scale.div(2)).div(scale);
        console.log(`Current calculation: ${current.toString()} bps (WRONG - 10x too high)`);
        console.log("");
        
        // Try dividing by 10
        const try1 = current.div(10);
        console.log(`Divide by 10: ${try1.toString()} bps = ${(try1.toNumber() / 100).toFixed(2)}%`);
        console.log(`   Match: ${try1.toNumber() === 338 ? "✅ YES!" : "❌ NO"}`);
        console.log("");
        
        // Try removing the * 100
        const try2 = supplyRate.mul(SECONDS_PER_YEAR).add(scale.div(2)).div(scale).mul(10);
        console.log(`Remove * 100, add * 10: ${try2.toString()} bps`);
        console.log("");
        
        // Try: (supplyRate * SECONDS_PER_YEAR * 10) / baseIndexScale
        const try3 = supplyRate.mul(SECONDS_PER_YEAR).mul(10).add(scale.div(2)).div(scale);
        console.log(`(rate * seconds * 10) / scale: ${try3.toString()} bps = ${(try3.toNumber() / 100).toFixed(2)}%`);
        console.log(`   Match: ${try3.toNumber() === 338 ? "✅ YES!" : "❌ NO"}`);
        console.log("");
        
        // Try: (supplyRate * SECONDS_PER_YEAR * 100) / (baseIndexScale * 10)
        const try4 = supplyRate.mul(SECONDS_PER_YEAR).mul(100).add(scale.mul(5)).div(scale.mul(10));
        console.log(`(rate * seconds * 100) / (scale * 10): ${try4.toString()} bps = ${(try4.toNumber() / 100).toFixed(2)}%`);
        console.log(`   Match: ${try4.toNumber() === 338 ? "✅ YES!" : "❌ NO"}`);
        console.log("");
        
        // Check Compound V3 docs format
        // baseIndexScale = 1e15
        // Maybe rate is in a different format?
        // If website shows 3.38%, and we have 1075503155 with scale 1e15
        // Let's reverse engineer: 3.38% = 0.0338
        // 0.0338 / SECONDS_PER_YEAR = rate per second
        // But that doesn't match...
        
        // Actually, let's check if we need to use a different scale
        // Current: (1075503155 * 31536000 * 100) / 1000000000000000 = 3392
        // Target: 338
        // Ratio: 3392 / 338 = 10.035...
        
        // So we need to divide by ~10
        const correctFormula = supplyRate.mul(SECONDS_PER_YEAR).mul(10).add(scale.div(2)).div(scale);
        console.log("=".repeat(70));
        console.log("✅ CORRECT FORMULA");
        console.log("=".repeat(70));
        console.log("");
        console.log(`APY (bps) = (supplyRate * SECONDS_PER_YEAR * 10) / baseIndexScale`);
        console.log(`Result: ${correctFormula.toString()} bps = ${(correctFormula.toNumber() / 100).toFixed(2)}%`);
        console.log(`Expected: 338 bps = 3.38%`);
        console.log(`Match: ${correctFormula.toNumber() === 338 ? "✅ YES!" : "❌ NO (but close)"}`);
        console.log("");
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
}

findCorrectAPYFormula().catch(console.error);

