const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function calculateCompoundAPYCorrectly() {
    console.log("=".repeat(70));
    console.log("🔍 FINDING CORRECT COMPOUND APY CALCULATION");
    console.log("=".repeat(70));
    console.log("");
    
    const COMPOUND_USDC = "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA";
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    const compoundAbi = [
        "function getUtilization() external view returns (uint256)",
        "function getSupplyRate(uint256 utilization) external view returns (uint64)",
        "function getBorrowRate(uint256 utilization) external view returns (uint64)",
        "function baseScale() external view returns (uint256)",
        "function baseIndexScale() external view returns (uint64)"
    ];
    
    try {
        const compound = new ethers.Contract(COMPOUND_USDC, compoundAbi, arbitrumProvider);
        
        const utilization = await compound.getUtilization();
        const supplyRateRaw = await compound.getSupplyRate(utilization);
        const borrowRateRaw = await compound.getBorrowRate(utilization);
        
        console.log("Raw Values:");
        console.log(`  Utilization: ${utilization.toString()}`);
        console.log(`  Supply Rate (raw): ${supplyRateRaw.toString()}`);
        console.log(`  Borrow Rate (raw): ${borrowRateRaw.toString()}`);
        console.log("");
        
        // Try different calculation methods
        const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
        const SECONDS_PER_YEAR_BN = ethers.BigNumber.from(SECONDS_PER_YEAR);
        
        console.log("Testing Different Calculation Methods:");
        console.log("");
        
        // Method 1: Assume rate is per second, scaled by 1e18 (like Aave)
        const rate1 = ethers.BigNumber.from(supplyRateRaw);
        const apy1 = rate1.mul(SECONDS_PER_YEAR_BN).mul(100).div(ethers.BigNumber.from(10).pow(18));
        console.log(`Method 1 (rate * seconds_per_year * 100 / 1e18): ${apy1.toString()} bps`);
        
        // Method 2: Assume rate is already annual, scaled by 1e18
        const apy2 = rate1.mul(100).div(ethers.BigNumber.from(10).pow(18));
        console.log(`Method 2 (rate * 100 / 1e18, already annual): ${apy2.toString()} bps`);
        
        // Method 3: Assume rate is per second, scaled by 1e6 (baseScale)
        const baseScale = await compound.baseScale();
        const apy3 = rate1.mul(SECONDS_PER_YEAR_BN).mul(100).div(baseScale);
        console.log(`Method 3 (rate * seconds_per_year * 100 / baseScale): ${apy3.toString()} bps`);
        
        // Method 4: Assume rate is per second, no scaling (raw rate)
        const apy4 = rate1.mul(SECONDS_PER_YEAR_BN).mul(100);
        console.log(`Method 4 (rate * seconds_per_year * 100, no scaling): ${apy4.toString()} bps`);
        
        // Method 5: Assume rate needs to be scaled up to match borrow rate scale
        // Borrow rate is typically higher, so let's see the ratio
        const borrowRateBN = ethers.BigNumber.from(borrowRateRaw);
        const rateRatio = borrowRateBN.mul(10000).div(rate1);
        console.log(`  Borrow/Supply ratio: ${rateRatio.toString()} (shows scale difference)`);
        console.log("");
        
        // Check what makes sense
        console.log("Expected APY range: 100-1000 bps (1-10%)");
        console.log("");
        
        // Method 6: Try with baseIndexScale if available
        try {
            const baseIndexScale = await compound.baseIndexScale();
            console.log(`  baseIndexScale: ${baseIndexScale.toString()}`);
            const apy6 = rate1.mul(SECONDS_PER_YEAR_BN).mul(100).div(ethers.BigNumber.from(baseIndexScale));
            console.log(`Method 6 (rate * seconds_per_year * 100 / baseIndexScale): ${apy6.toString()} bps`);
        } catch (error) {
            // Not available
        }
        
        console.log("");
        console.log("=".repeat(70));
        console.log("💡 RECOMMENDATION");
        console.log("=".repeat(70));
        console.log("");
        console.log("Check which method gives a reasonable APY (1-10%)");
        console.log("Then use that formula in QueryHelper");
        console.log("");
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
}

calculateCompoundAPYCorrectly().catch(console.error);

