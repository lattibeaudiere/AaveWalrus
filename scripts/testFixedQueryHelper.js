const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function testFixedQueryHelper() {
    console.log("=".repeat(70));
    console.log("🧪 TESTING FIXED QUERYHELPER LOGIC");
    console.log("=".repeat(70));
    console.log("");
    
    const COMPOUND_USDC = "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA";
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    // Test the new logic
    const compoundAbi = [
        "function getUtilization() external view returns (uint256)",
        "function getSupplyRate(uint256 utilization) external view returns (uint64)",
        "function baseScale() external view returns (uint256)"
    ];
    
    try {
        const compound = new ethers.Contract(COMPOUND_USDC, compoundAbi, arbitrumProvider);
        
        console.log("Testing new QueryHelper logic:");
        console.log("");
        
        // Step 1: Get utilization
        const utilization = await compound.getUtilization();
        console.log(`1. Utilization: ${utilization.toString()}`);
        
        // Step 2: Get supply rate
        const supplyRateRaw = await compound.getSupplyRate(utilization);
        console.log(`2. Supply Rate (raw): ${supplyRateRaw.toString()}`);
        
        // Step 3: Get baseScale
        const baseScale = await compound.baseScale();
        console.log(`3. Base Scale: ${baseScale.toString()}`);
        
        // Step 4: Calculate APY (using QueryHelper logic)
        const SECONDS_PER_YEAR = 365 * 24 * 60 * 60; // 31536000
        const supplyRateScaled = ethers.BigNumber.from(supplyRateRaw).mul(ethers.BigNumber.from(10).pow(18));
        const numerator = supplyRateScaled.mul(SECONDS_PER_YEAR).mul(100);
        const denominator = baseScale;
        const apyBps = numerator.add(denominator.div(2)).div(denominator);
        
        console.log("");
        console.log(`4. Calculated APY: ${apyBps.toString()} bps`);
        console.log(`   = ${(apyBps.toNumber() / 100).toFixed(2)}%`);
        console.log("");
        
        // Verify it's reasonable
        if (apyBps.toNumber() > 0 && apyBps.toNumber() < 10000) {
            console.log("✅ APY calculation looks reasonable!");
        } else {
            console.log("⚠️  APY seems unusual - may need to adjust calculation");
        }
        console.log("");
        
        console.log("✅ This logic should work in QueryHelper!");
        console.log("");
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
    
    console.log("=".repeat(70));
    console.log("📋 NEXT STEPS");
    console.log("=".repeat(70));
    console.log("");
    console.log("1. Compile QueryHelper.sol (check for errors)");
    console.log("2. Deploy updated QueryHelper to Arbitrum");
    console.log("3. Test queryCompoundApy() directly");
    console.log("4. Verify Reactive Network callbacks succeed");
    console.log("5. Monitor for events and deployment");
    console.log("");
}

testFixedQueryHelper().catch(console.error);

