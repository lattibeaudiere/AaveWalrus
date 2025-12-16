const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function testGetSupplyRate() {
    console.log("=".repeat(70));
    console.log("🔍 TESTING getSupplyRate(utilization)");
    console.log("=".repeat(70));
    console.log("");
    
    const COMPOUND_USDC = "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA";
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    // Try the two-step approach
    const compoundAbi = [
        "function getUtilization() external view returns (uint256)",
        "function getSupplyRate(uint256 utilization) external view returns (uint64)",
        "function getBorrowRate(uint256 utilization) external view returns (uint64)"
    ];
    
    try {
        const compound = new ethers.Contract(COMPOUND_USDC, compoundAbi, arbitrumProvider);
        
        console.log("Step 1: Get utilization...");
        const utilization = await compound.getUtilization();
        console.log(`   ✅ Utilization: ${utilization.toString()}`);
        console.log("");
        
        console.log("Step 2: Get supply rate with utilization...");
        try {
            const supplyRate = await compound.getSupplyRate(utilization);
            console.log(`   ✅ Supply Rate: ${supplyRate.toString()}`);
            console.log("");
            
            // Calculate APY
            // Compound V3 returns rates in a specific format
            // Need to check the scale and format
            const baseScale = await compound.baseScale(); // This worked before
            console.log(`   Base Scale: ${baseScale.toString()}`);
            console.log("");
            
            console.log("✅ THIS WORKS! Update QueryHelper to use:");
            console.log("   1. getUtilization()");
            console.log("   2. getSupplyRate(utilization)");
            console.log("   3. Convert to APY using baseScale and time");
            console.log("");
            
        } catch (error) {
            console.log(`   ❌ getSupplyRate() failed: ${error.message.split('\n')[0]}`);
            console.log("");
            
            // Try alternative
            console.log("Trying alternative: getBorrowRate()...");
            try {
                const borrowRate = await compound.getBorrowRate(utilization);
                console.log(`   ✅ Borrow Rate: ${borrowRate.toString()}`);
                console.log("   (May need to calculate supply rate from borrow rate)");
            } catch (error2) {
                console.log(`   ❌ getBorrowRate() also failed: ${error2.message.split('\n')[0]}`);
            }
        }
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
    
    console.log("");
    console.log("=".repeat(70));
    console.log("💡 NEXT STEPS");
    console.log("=".repeat(70));
    console.log("");
    console.log("If getSupplyRate(utilization) works:");
    console.log("  1. Update QueryHelper.sol");
    console.log("  2. Change from supplyRatePerSecond() to getSupplyRate(utilization)");
    console.log("  3. Redeploy QueryHelper");
    console.log("  4. Test callbacks again");
    console.log("");
}

testGetSupplyRate().catch(console.error);

