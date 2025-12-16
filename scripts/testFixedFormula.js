const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function testFixedFormula() {
    console.log("=".repeat(70));
    console.log("🧪 TESTING FIXED FORMULA");
    console.log("=".repeat(70));
    console.log("");
    
    const COMPOUND_USDC = "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA";
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    console.log("Expected from IPOR Frontend:");
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
        
        const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
        const supplyRate = ethers.BigNumber.from(supplyRateRaw);
        const scale = ethers.BigNumber.from(baseIndexScale);
        
        // NEW FORMULA: * 10 instead of * 100
        const apyBps = supplyRate.mul(SECONDS_PER_YEAR).mul(10).add(scale.div(2)).div(scale);
        
        console.log("New Formula Result:");
        console.log(`  APY (bps): ${apyBps.toString()}`);
        console.log(`  APY (%): ${(apyBps.toNumber() / 100).toFixed(2)}%`);
        console.log("");
        
        console.log("Comparison:");
        console.log(`  Expected: 496 bps (4.96%)`);
        console.log(`  Calculated: ${apyBps.toString()} bps`);
        console.log(`  Difference: ${Math.abs(apyBps.toNumber() - 496)} bps`);
        console.log("");
        
        if (apyBps.toNumber() === 339) {
            console.log("  ✅ Matches Aave (339 bps)");
            console.log("  ⚠️  But frontend shows 496 bps for Compound");
            console.log("  This suggests frontend may include rewards/boosts");
            console.log("");
        } else if (Math.abs(apyBps.toNumber() - 496) < 200) {
            console.log("  ✅ Close to expected (within 200 bps)");
        } else {
            console.log("  ⚠️  Still not matching exactly");
        }
        
        console.log("");
        console.log("For strategy purposes:");
        console.log("  • Relative comparison (spread) is most important");
        console.log("  • Using consistent formula for both protocols");
        console.log("  • Absolute values may differ from frontend");
        console.log("");
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
}

testFixedFormula().catch(console.error);

