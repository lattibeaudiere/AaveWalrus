const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkAdapterSignature() {
    const ADAPTER_ADDRESS = process.env.ADAPTER_ADDRESS;
    
    const provider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    console.log("Checking adapter function signatures...");
    console.log("Adapter:", ADAPTER_ADDRESS);
    console.log("");
    
    // Try different function selectors
    const selectors = {
        "registerCrossChainRSC(address,address,uint256)": "0xef39a278",
        "registerCrossChainRSC(address,address,uint256,string)": "0x..." // would need to calculate
    };
    
    // Get the function selector from the failed transaction data
    const failedTxData = "0xef39a278000000000000000000000000e39c19a077e33d1145f8cc78d4235ae8114c640a000000000000000000000000ee29a26179fe20d5d202dae4a279119e08edc60b000000000000000000000000000000000000000000000000000000000000a4b1";
    
    const selector = failedTxData.substring(0, 10);
    console.log("Selector used:", selector);
    console.log("Expected (3 params):", "0xef39a278");
    
    // Check if selector matches
    const expected3 = ethers.utils.id("registerCrossChainRSC(address,address,uint256)").substring(0, 10);
    const expected4 = ethers.utils.id("registerCrossChainRSC(address,address,uint256,string)").substring(0, 10);
    
    console.log("Expected 3 params:", expected3);
    console.log("Expected 4 params:", expected4);
    console.log("");
    
    if (selector.toLowerCase() === expected3.toLowerCase()) {
        console.log("✅ Selector matches 3-parameter version");
        console.log("");
        console.log("The function signature is:");
        console.log("  registerCrossChainRSC(address rsc, address vault, uint256 targetChainId)");
        console.log("");
        console.log("So the deployed adapter does NOT have the description parameter.");
    } else if (selector.toLowerCase() === expected4.toLowerCase()) {
        console.log("✅ Selector matches 4-parameter version");
        console.log("The function requires a description parameter.");
    } else {
        console.log("⚠️  Selector doesn't match either expected version");
        console.log("Deployed adapter may have different signature");
    }
    
    console.log("");
    console.log("⚠️  The transaction is reverting early (low gas used)");
    console.log("This suggests:");
    console.log("  1. Access control check failing (but we confirmed MANAGER_ROLE exists)");
    console.log("  2. OR deployed adapter has different access control");
    console.log("  3. OR there's a modifier issue");
    console.log("");
    console.log("Solution: Check the actual deployed bytecode or try:");
    console.log("  1. Grant MANAGER_ROLE again (maybe deployment issue)");
    console.log("  2. Check if adapter was deployed with different manager address");
    console.log("  3. Redeploy adapter if necessary");
}

checkAdapterSignature().catch(console.error);

