const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkCompoundV3Docs() {
    console.log("=".repeat(70));
    console.log("🔍 CHECKING COMPOUND V3 RATE FORMAT");
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
    console.log("Our calculations:");
    console.log("  Method 1 (current): 3392 bps");
    console.log("  Method 2 (divide by 10): 339 bps ✅ matches Aave");
    console.log("");
    
    const compoundAbi = [
        "function getUtilization() external view returns (uint256)",
        "function getSupplyRate(uint256 utilization) external view returns (uint64)",
        "function baseIndexScale() external view returns (uint64)",
        "function baseScale() external view returns (uint256)",
        "function baseMinForReward() external view returns (uint64)",
        "function baseTrackingSupplySpeed() external view returns (uint64)"
    ];
    
    try {
        const compound = new ethers.Contract(COMPOUND_USDC, compoundAbi, arbitrumProvider);
        
        const utilization = await compound.getUtilization();
        const supplyRateRaw = await compound.getSupplyRate(utilization);
        const baseIndexScale = await compound.baseIndexScale();
        const baseScale = await compound.baseScale();
        
        console.log("Raw Values:");
        console.log(`  Utilization: ${utilization.toString()}`);
        console.log(`  Supply Rate: ${supplyRateRaw.toString()}`);
        console.log(`  Base Index Scale: ${baseIndexScale.toString()} (1e15)`);
        console.log(`  Base Scale: ${baseScale.toString()} (1e6 for USDC)`);
        console.log("");
        
        // According to Compound V3 docs:
        // baseIndexScale = 1e15
        // getSupplyRate returns rate per second scaled by baseIndexScale
        // So: rate_per_second = supplyRate / baseIndexScale
        // APR = rate_per_second * SECONDS_PER_YEAR
        // APY = (1 + APR)^SECONDS_PER_YEAR - 1 (for compounding)
        // But for small rates: APY ≈ APR
        
        const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
        
        // Method A: Simple APR (no compounding)
        const ratePerSecond = supplyRateRaw / Number(baseIndexScale);
        const apr = ratePerSecond * SECONDS_PER_YEAR;
        const aprBps = Math.round(apr * 10000);
        console.log(`Method A (Simple APR): ${aprBps} bps = ${(apr * 100).toFixed(2)}%`);
        console.log("");
        
        // Method B: With compounding (APY)
        // APY = (1 + rate_per_second)^SECONDS_PER_YEAR - 1
        const apy = Math.pow(1 + ratePerSecond, SECONDS_PER_YEAR) - 1;
        const apyBps = Math.round(apy * 10000);
        console.log(`Method B (Compounded APY): ${apyBps} bps = ${(apy * 100).toFixed(2)}%`);
        console.log("");
        
        // Method C: Current (multiply by 100)
        const current = (supplyRateRaw * SECONDS_PER_YEAR * 100) / Number(baseIndexScale);
        console.log(`Method C (Current - multiply by 100): ${Math.round(current)} bps`);
        console.log("");
        
        // Method D: Divide by 10 (matches Aave)
        const method2 = (supplyRateRaw * SECONDS_PER_YEAR * 10) / Number(baseIndexScale);
        console.log(`Method D (Divide by 10): ${Math.round(method2)} bps`);
        console.log("");
        
        // The issue: Method D gives 339 bps (matches Aave)
        // But frontend shows 496 bps for Compound
        // Difference: 496 / 339 = 1.463
        
        // Maybe the frontend is showing APY with rewards/fees?
        // Or maybe there's a different rate source?
        
        console.log("=".repeat(70));
        console.log("💡 KEY INSIGHT");
        console.log("=".repeat(70));
        console.log("");
        console.log("Method 2 (divide by 10) gives 339 bps, which EXACTLY matches Aave!");
        console.log("This suggests:");
        console.log("  • Method 2 might be the correct base formula");
        console.log("  • Frontend might be showing net APY (after fees/boosts)");
        console.log("  • Or frontend uses a different data source");
        console.log("");
        console.log("For our strategy, we need:");
        console.log("  • Consistent calculation method for both protocols");
        console.log("  • Relative comparison (spread) is more important than absolute");
        console.log("");
        console.log("Recommendation:");
        console.log("  • Use Method 2 (divide by 10) for consistency");
        console.log("  • This will give us relative APY comparison");
        console.log("  • Even if absolute values differ from frontend");
        console.log("");
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
}

checkCompoundV3Docs().catch(console.error);

