const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function findCompoundFunction() {
    console.log("=".repeat(70));
    console.log("🔍 FINDING CORRECT COMPOUND V3 FUNCTION");
    console.log("=".repeat(70));
    console.log("");
    
    const COMPOUND_USDC = "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA";
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    console.log("Compound Contract:", COMPOUND_USDC);
    console.log("Contract Name: Compound USDCe (from previous test)");
    console.log("");
    
    console.log("Trying Compound V3 function signatures:");
    console.log("");
    
    // Common Compound V3 functions
    const functionsToTest = [
        "function getSupplyRate(uint256 utilization) external view returns (uint64)",
        "function getBorrowRate(uint256 utilization) external view returns (uint64)",
        "function getUtilization() external view returns (uint256)",
        "function baseSupplyIndex() external view returns (uint64)",
        "function baseBorrowIndex() external view returns (uint64)",
        "function baseIndexScale() external view returns (uint64)",
        "function baseScale() external view returns (uint256)",
        "function baseMinForReward() external view returns (uint64)",
        "function baseTrackingSupplySpeed() external view returns (uint64)",
        "function baseTrackingBorrowSpeed() external view returns (uint64)",
        "function baseBorrowMin() external view returns (uint256)",
        "function baseTargetReserves() external view returns (uint256)",
    ];
    
    for (const funcSig of functionsToTest) {
        try {
            const iface = new ethers.utils.Interface([funcSig]);
            const funcName = funcSig.split("(")[0].replace("function ", "");
            const contract = new ethers.Contract(COMPOUND_USDC, iface, arbitrumProvider);
            
            try {
                let result;
                if (funcName === "getSupplyRate" || funcName === "getBorrowRate") {
                    // These need utilization parameter
                    const utilization = await contract.getUtilization();
                    result = await contract[funcName](utilization);
                } else {
                    result = await contract[funcName]();
                }
                console.log(`   ✅ ${funcName}(): ${result.toString()}`);
            } catch (error) {
                console.log(`   ❌ ${funcName}(): ${error.message.split('\n')[0]}`);
            }
        } catch (error) {
            // Function doesn't exist
        }
    }
    
    console.log("");
    console.log("=".repeat(70));
    console.log("💡 SOLUTION");
    console.log("=".repeat(70));
    console.log("");
    console.log("If getSupplyRate(utilization) works:");
    console.log("  1. Get utilization: getUtilization() ✅ (we know this works)");
    console.log("  2. Get supply rate: getSupplyRate(utilization)");
    console.log("  3. Calculate APY from rate");
    console.log("");
    console.log("Update QueryHelper to:");
    console.log("  - Call getUtilization()");
    console.log("  - Call getSupplyRate(utilization)");
    console.log("  - Convert to APY");
    console.log("");
    console.log("🔗 Check contract on Arbiscan:");
    console.log(`   https://arbiscan.io/address/${COMPOUND_USDC}#code`);
    console.log("");
}

findCompoundFunction().catch(console.error);

