const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function findCorrectCompoundFormula() {
    console.log("=".repeat(70));
    console.log("🔍 FINDING CORRECT COMPOUND FORMULA");
    console.log("=".repeat(70));
    console.log("");
    
    const COMPOUND_USDC = "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA";
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    console.log("IPOR Frontend shows:");
    console.log("  Compound Supply APY: 4.96% = 496 bps");
    console.log("  Aave Supply APY: 3.39% = 339 bps");
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
        console.log(`  Utilization: ${utilization.toString()}`);
        console.log(`  Supply Rate (raw): ${supplyRateRaw.toString()}`);
        console.log(`  Base Index Scale: ${baseIndexScale.toString()} (1e15)`);
        console.log("");
        
        const SECONDS_PER_YEAR = 365 * 24 * 60 * 60; // 31536000
        const supplyRate = ethers.BigNumber.from(supplyRateRaw);
        const scale = ethers.BigNumber.from(baseIndexScale);
        
        console.log("Testing Formulas:");
        console.log("");
        
        // Method 1: Current (wrong - 3392 bps)
        const m1 = supplyRate.mul(SECONDS_PER_YEAR).mul(100).add(scale.div(2)).div(scale);
        console.log(`Method 1 (current): ${m1.toString()} bps`);
        
        // Method 2: Divide by 10 (339 bps - too low)
        const m2 = supplyRate.mul(SECONDS_PER_YEAR).mul(10).add(scale.div(2)).div(scale);
        console.log(`Method 2 (divide by 10): ${m2.toString()} bps`);
        
        // Method 3: Maybe we need to multiply by a factor?
        // 496 / 339 = 1.463
        // So maybe: m2 * 1.463? Or maybe there's a different scale?
        
        // Method 4: Check if rate needs to be converted differently
        // Maybe: (rate * seconds_per_year * 10000) / baseIndexScale / 100
        const m4 = supplyRate.mul(SECONDS_PER_YEAR).mul(10000).div(scale).div(100);
        console.log(`Method 4 (multiply by 10000 then divide by 100): ${m4.toString()} bps`);
        
        // Method 5: Maybe baseIndexScale interpretation is wrong?
        // If baseIndexScale = 1e15, and we want percentage:
        // rate_per_second = supplyRate / baseIndexScale
        // annual_rate = rate_per_second * SECONDS_PER_YEAR
        // percentage = annual_rate * 100
        const ratePerSecond = supplyRate.mul(ethers.BigNumber.from("10").pow(18)).div(scale); // Scale to 1e18
        const annualRate = ratePerSecond.mul(SECONDS_PER_YEAR).div(ethers.BigNumber.from("10").pow(18));
        const m5 = annualRate.mul(100);
        console.log(`Method 5 (proper scaling): ${m5.toString()} bps`);
        
        // Method 6: Try with compounding (APY vs APR)
        // APR = (rate * SECONDS_PER_YEAR) / scale
        // APY = (1 + APR)^SECONDS_PER_YEAR - 1
        // But for small rates, APY ≈ APR
        const apr = supplyRate.mul(SECONDS_PER_YEAR).mul(100).div(scale);
        console.log(`Method 6 (APR, not APY): ${apr.toString()} bps`);
        
        // Method 7: Maybe the issue is we're using 100 instead of 10000?
        // Basis points = percentage * 100
        // So if we want bps, we multiply by 100, not 10000
        const m7 = supplyRate.mul(SECONDS_PER_YEAR).mul(10000).div(scale);
        console.log(`Method 7 (multiply by 10000 for bps): ${m7.toString()} bps`);
        
        // Method 8: Check if we need to account for baseIndexScale differently
        // baseIndexScale = 1e15
        // If rate is already scaled, maybe we divide by 1e15 * some factor?
        const m8 = supplyRate.mul(SECONDS_PER_YEAR).mul(100).div(scale.mul(10));
        console.log(`Method 8 (divide scale by 10): ${m8.toString()} bps`);
        
        console.log("");
        
        // Compare to expected
        const expected = 496;
        console.log(`Expected: ${expected} bps`);
        console.log("");
        
        const methods = [
            { name: "Method 1", value: m1.toNumber(), diff: Math.abs(m1.toNumber() - expected) },
            { name: "Method 2", value: m2.toNumber(), diff: Math.abs(m2.toNumber() - expected) },
            { name: "Method 4", value: m4.toNumber(), diff: Math.abs(m4.toNumber() - expected) },
            { name: "Method 5", value: m5.toNumber(), diff: Math.abs(m5.toNumber() - expected) },
            { name: "Method 6", value: apr.toNumber(), diff: Math.abs(apr.toNumber() - expected) },
            { name: "Method 7", value: m7.toNumber(), diff: Math.abs(m7.toNumber() - expected) },
            { name: "Method 8", value: m8.toNumber(), diff: Math.abs(m8.toNumber() - expected) }
        ];
        
        methods.sort((a, b) => a.diff - b.diff);
        
        console.log("Closest matches:");
        for (const method of methods) {
            const match = method.diff < 20 ? "✅" : method.diff < 100 ? "⚠️" : "❌";
            console.log(`  ${match} ${method.name}: ${method.value} bps (diff: ${method.diff} bps)`);
        }
        console.log("");
        
        // Check if there's a pattern
        // 496 / 339 = 1.463
        // 496 / 3392 = 0.146
        // Maybe we need to adjust the formula?
        
        // Actually, let me check Compound V3 docs format
        // baseIndexScale is typically 1e15
        // getSupplyRate returns rate per second in a specific format
        
        // Let's try: if the rate format is different
        // Maybe: (rate * SECONDS_PER_YEAR * 10000) / (baseIndexScale * some_factor)
        // Or: rate is already in a different unit
        
        // Method 9: Try with different interpretation
        // If baseIndexScale = 1e15, and rate is per second scaled by 1e15
        // Then: rate_per_second = rate / 1e15
        // annual = rate_per_second * SECONDS_PER_YEAR
        // But maybe we need to account for different units?
        const m9 = supplyRate.mul(SECONDS_PER_YEAR).mul(100).div(scale).mul(ethers.BigNumber.from(146)).div(100);
        console.log(`Method 9 (multiply by 1.46 factor): ${m9.toString()} bps`);
        
        // Actually, the real issue might be that Compound V3 uses a different rate format
        // Let me check if maybe the rate needs to be interpreted as already being in basis points per second?
        
        // Method 10: What if rate is already in basis points per second?
        const m10 = supplyRate.mul(SECONDS_PER_YEAR).div(scale);
        console.log(`Method 10 (if rate already in bps/sec): ${m10.toString()} bps`);
        
        console.log("");
        console.log("=".repeat(70));
        console.log("💡 ANALYSIS");
        console.log("=".repeat(70));
        console.log("");
        console.log("The website shows 4.96% (496 bps)");
        console.log("Our calculation gives 3392 bps (way too high)");
        console.log("Method 2 gives 339 bps (too low)");
        console.log("");
        console.log("The difference suggests:");
        console.log("  • Maybe we need to divide by ~6.84 (3392/496)");
        console.log("  • Or multiply Method 2 by ~1.46 (496/339)");
        console.log("");
        console.log("This might indicate:");
        console.log("  • Different rate format interpretation");
        console.log("  • Fee adjustment needed");
        console.log("  • Different scaling factor");
        console.log("");
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
}

findCorrectCompoundFormula().catch(console.error);

