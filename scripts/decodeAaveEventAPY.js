const { ethers } = require('ethers');

// Event data from the transaction
const eventData = "0x0000000000000000000000000000000000000000001e6fd042685637366ddfcb00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002b2f5c1b00881c02705929000000000000000000000000000000000000000003b88dc763e46561bd8ac966000000000000000000000000000000000000000003e159e781f6aeb5409d703d";

console.log("=".repeat(60));
console.log("🔍 DECODING AAVE V3 ReserveDataUpdated EVENT");
console.log("=".repeat(60));
console.log("");

// Aave V3 ReserveDataUpdated event structure
// event ReserveDataUpdated(
//     address indexed reserve,  // in topic1
//     uint256 liquidityRate,    // in data[0]
//     uint256 stableBorrowRate, // in data[1]
//     uint256 variableBorrowRate, // in data[2]
//     uint256 liquidityIndex,   // in data[3]
//     uint256 variableBorrowIndex // in data[4]
// )

const aaveInterface = new ethers.utils.Interface([
    "event ReserveDataUpdated(address indexed reserve, uint256 liquidityRate, uint256 stableBorrowRate, uint256 variableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex)"
]);

try {
    // Decode the data (topics are separate, data is just the non-indexed fields)
    // Since reserve is indexed (topic1), the data contains: liquidityRate, stableBorrowRate, variableBorrowRate, liquidityIndex, variableBorrowIndex
    
    // Parse data manually (ABI encoding)
    // Each uint256 is 32 bytes
    const liquidityRateHex = "0x" + eventData.slice(2, 66);
    const stableBorrowRateHex = "0x" + eventData.slice(66, 130);
    const variableBorrowRateHex = "0x" + eventData.slice(130, 194);
    const liquidityIndexHex = "0x" + eventData.slice(194, 258);
    const variableBorrowIndexHex = "0x" + eventData.slice(258, 322);
    
    const liquidityRate = ethers.BigNumber.from(liquidityRateHex);
    const stableBorrowRate = ethers.BigNumber.from(stableBorrowRateHex);
    const variableBorrowRate = ethers.BigNumber.from(variableBorrowRateHex);
    const liquidityIndex = ethers.BigNumber.from(liquidityIndexHex);
    const variableBorrowIndex = ethers.BigNumber.from(variableBorrowIndexHex);
    
    console.log("📊 EVENT DATA DECODED:");
    console.log("-".repeat(60));
    console.log(`Reserve: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 (USDC)`);
    console.log("");
    console.log(`Liquidity Rate (raw): ${liquidityRate.toString()}`);
    console.log(`Stable Borrow Rate (raw): ${stableBorrowRate.toString()}`);
    console.log(`Variable Borrow Rate (raw): ${variableBorrowRate.toString()}`);
    console.log(`Liquidity Index: ${liquidityIndex.toString()}`);
    console.log(`Variable Borrow Index: ${variableBorrowIndex.toString()}`);
    console.log("");
    
    // Convert to APY (Aave uses RAY - 1e27)
    const SECONDS_PER_YEAR = 365 * 24 * 3600;
    const RAY = ethers.BigNumber.from(10).pow(27);
    
    // For accurate APY calculation, we need to compound:
    // APY = ((1 + rate/1e27)^secondsPerYear - 1) * 100
    // But for small rates, we can approximate: APY ≈ (rate * secondsPerYear / 1e27) * 100
    
    // Calculate APY using BigNumber arithmetic to avoid overflow
    const SECONDS_PER_YEAR_BN = ethers.BigNumber.from(SECONDS_PER_YEAR);
    
    // Supply APY = (liquidityRate * SECONDS_PER_YEAR * 100) / RAY
    const supplyAPYBps = liquidityRate.mul(SECONDS_PER_YEAR_BN).mul(100).div(RAY);
    const supplyAPY = parseFloat(supplyAPYBps.toString()) / 10000;
    
    // Borrow APY = (variableBorrowRate * SECONDS_PER_YEAR * 100) / RAY
    const borrowAPYBps = variableBorrowRate.mul(SECONDS_PER_YEAR_BN).mul(100).div(RAY);
    const borrowAPY = parseFloat(borrowAPYBps.toString()) / 10000;
    
    console.log("=".repeat(60));
    console.log("💰 APY INFORMATION FROM EVENT");
    console.log("=".repeat(60));
    console.log("");
    console.log(`Supply APY (USDC on Aave V3): ${supplyAPY.toFixed(4)}%`);
    console.log(`Supply APY (basis points): ${supplyAPYBps.toString()} bps`);
    console.log("");
    console.log(`Borrow APY (Variable): ${borrowAPY.toFixed(4)}%`);
    console.log(`Borrow APY (basis points): ${borrowAPYBps.toString()} bps`);
    console.log("");
    
    // Also show the raw rate per second for reference
    const ratePerSecond = parseFloat(liquidityRate.toString()) / 1e27;
    const borrowRatePerSecond = parseFloat(variableBorrowRate.toString()) / 1e27;
    
    console.log("Rate Details:");
    console.log(`  Supply Rate per Second: ${ratePerSecond.toExponential(6)}`);
    console.log(`  Borrow Rate per Second: ${borrowRatePerSecond.toExponential(6)}`);
    console.log("");
    
    console.log("=".repeat(60));
    console.log("💡 KEY TAKEAWAYS");
    console.log("=".repeat(60));
    console.log("");
    console.log("✅ YES - The event contains APY information!");
    console.log("");
    console.log("The ReserveDataUpdated event includes:");
    console.log("  - liquidityRate: Current supply APY (in RAY format)");
    console.log("  - variableBorrowRate: Current variable borrow APY");
    console.log("  - stableBorrowRate: Current stable borrow APY");
    console.log("  - Indices: Cumulative interest tracking");
    console.log("");
    console.log("Your react() function receives this data in:");
    console.log("  log.data - Contains all the non-indexed fields");
    console.log("  log.topic_1 - Contains the reserve address (USDC)");
    console.log("");
    console.log("You can decode this in your react() function to:");
    console.log("  1. Get the new Aave APY from liquidityRate");
    console.log("  2. Fetch current Compound APY");
    console.log("  3. Calculate spread");
    console.log("  4. Execute rebalance if needed");
    console.log("");
    
} catch (error) {
    console.log(`❌ Error decoding: ${error.message}`);
}

