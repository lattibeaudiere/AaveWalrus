const ethers = require('ethers');

/**
 * Decode the failed event to see what APY was extracted
 */
async function decodeEvent() {
    // Event data from the transaction
    const eventData = "0x0000000000000000000000000000000000000000001ce8ec0cf338e49959e73e00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002a167c2ddf88f93f4b4b4c000000000000000000000000000000000000000003b8b13d8167b1c94c32124d000000000000000000000000000000000000000003e18f078a2fa5529105a3bc";
    
    // Decode as 5 uint256s (as per ReserveDataUpdated event)
    const decoded = ethers.utils.defaultAbiCoder.decode(
        ['uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
        eventData
    );
    
    console.log("Decoded Event Data:");
    console.log("=".repeat(60));
    console.log("liquidityRate:", decoded[0].toString());
    console.log("stableBorrowRate:", decoded[1].toString());
    console.log("variableBorrowRate:", decoded[2].toString());
    console.log("liquidityIndex:", decoded[3].toString());
    console.log("variableBorrowIndex:", decoded[4].toString());
    console.log("");
    
    // Calculate APY from liquidityRate (rate per second in RAY format)
    const liquidityRate = decoded[0];
    const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
    const RAY = ethers.BigNumber.from(10).pow(27); // 1e27
    
    // APY = (liquidityRate * SECONDS_PER_YEAR * 100) / RAY
    const apyBps = liquidityRate
        .mul(SECONDS_PER_YEAR)
        .mul(100)
        .div(RAY);
    
    const apyPercent = parseFloat(apyBps.toString()) / 100;
    
    console.log("Calculated APY:");
    console.log("-".repeat(60));
    console.log(`APY: ${apyBps.toString()} basis points`);
    console.log(`APY: ${apyPercent.toFixed(4)}%`);
    console.log("");
    
    // Check anomaly threshold (from contract: 0-2000 bps = 0-20%)
    const MAX_APY_BPS = 2000; // 20%
    const isAnomaly = apyBps.gt(MAX_APY_BPS) || apyBps.lt(0);
    
    console.log("Anomaly Check:");
    console.log("-".repeat(60));
    console.log(`Max allowed: ${MAX_APY_BPS} bps (20%)`);
    console.log(`Extracted: ${apyBps.toString()} bps`);
    console.log(`Is Anomaly: ${isAnomaly ? "❌ YES" : "✅ NO"}`);
    
    if (isAnomaly) {
        console.log("");
        console.log("⚠️  APY exceeds anomaly threshold!");
        if (apyBps.gt(MAX_APY_BPS)) {
            console.log(`   APY (${apyPercent.toFixed(2)}%) > 20% threshold`);
        }
    }
}

decodeEvent().catch(console.error);

