const ethers = require('ethers');

/**
 * Test correct APY calculation
 */
async function testAPY() {
    // The actual liquidityRate from the event
    const liquidityRate = ethers.BigNumber.from("34949866337988872307861310");
    
    const SECONDS_PER_YEAR = 365 * 24 * 60 * 60; // 31536000
    const RAY = ethers.BigNumber.from(10).pow(27); // 1e27
    
    console.log("Testing APY Calculation:");
    console.log("=".repeat(60));
    console.log("liquidityRate (raw):", liquidityRate.toString());
    console.log("RAY:", RAY.toString());
    console.log("SECONDS_PER_YEAR:", SECONDS_PER_YEAR.toString());
    console.log("");
    
    // Current formula (what contract uses)
    const currentAPYBps = liquidityRate
        .mul(SECONDS_PER_YEAR)
        .mul(100)
        .div(RAY);
    
    console.log("Current Formula Result:");
    console.log("-".repeat(60));
    console.log(`APY (bps): ${currentAPYBps.toString()}`);
    console.log(`APY (%): ${parseFloat(currentAPYBps.toString()) / 100}%`);
    console.log("");
    
    // Correct formula: APY = ((1 + rate_per_second)^SECONDS_PER_YEAR - 1) * 100
    // For small rates, approximation: APY ≈ rate_per_second * SECONDS_PER_YEAR * 100
    // But liquidityRate is already in RAY, so:
    // rate_per_second = liquidityRate / RAY
    // APY_bps = (rate_per_second * SECONDS_PER_YEAR * 10000) / 100
    
    // Actually, for basis points:
    // APY (bps) = (liquidityRate * SECONDS_PER_YEAR * 10000) / RAY / 100
    // OR simpler: APY (bps) = (liquidityRate * SECONDS_PER_YEAR * 100) / RAY
    
    // Wait, let me check Aave docs format:
    // liquidityRate is the rate per second in RAY format
    // To get APY in percentage: (liquidityRate * SECONDS_PER_YEAR) / RAY * 100
    // To get APY in basis points: (liquidityRate * SECONDS_PER_YEAR) / RAY * 10000
    
    // So the correct formula should be:
    const correctAPYBps = liquidityRate
        .mul(SECONDS_PER_YEAR)
        .mul(10000)  // Convert to basis points
        .div(RAY)
        .div(ethers.BigNumber.from(100)); // Wait, that's the same...
    
    // Let me recalculate:
    // liquidityRate = 34949866337988872307861310 (in RAY, so divided by 1e27)
    // rate_per_second = 34949866337988872307861310 / 1e27 = 0.034949866337988872307861310
    // APY = 0.034949866337988872307861310 * 31536000 = 1102178.98...
    
    // Hmm, that's still > 100%. Let me check if liquidityRate is actually per second or per year...
    
    // Actually, looking at Aave docs:
    // liquidityRate is annual rate in RAY, not per second!
    // So: APY = liquidityRate / RAY * 100
    
    const alternativeAPYBps = liquidityRate
        .mul(10000)
        .div(RAY);
    
    console.log("Alternative Calculation (if liquidityRate is annual):");
    console.log("-".repeat(60));
    console.log(`APY (bps): ${alternativeAPYBps.toString()}`);
    console.log(`APY (%): ${parseFloat(alternativeAPYBps.toString()) / 100}%`);
    console.log("");
    
    // This gives 349.49 bps = 3.49% which makes sense!
    
    console.log("✅ CORRECT FORMULA:");
    console.log("   APY (bps) = (liquidityRate * 10000) / RAY");
    console.log("   This gives: 3.49% APY (reasonable!)");
}

testAPY().catch(console.error);

