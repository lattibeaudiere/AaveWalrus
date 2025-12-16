const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function testAdapterFunction() {
    const ADAPTER_ADDRESS = "0xa60c91Aa6E0e203De3a6692a82eE65884B3B2D09";
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0xEFD20dC51F7c82B7430490Bf45767bA57F6819fc";
    
    console.log("🧪 Testing Adapter Function Call...\n");
    console.log("Adapter:", ADAPTER_ADDRESS);
    console.log("RSC:", RSC_ADDRESS);
    console.log("");
    
    const provider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    // Try calling with NEW signature (address as first param)
    const adapterNew = new ethers.Contract(
        ADAPTER_ADDRESS,
        [
            "function executeReaction(address rsc, tuple(address fuse, bytes data)[] actions) external returns (bool success, bytes memory data)"
        ],
        provider
    );
    
    // Try calling with OLD signature (no address param)
    const adapterOld = new ethers.Contract(
        ADAPTER_ADDRESS,
        [
            "function executeReaction(tuple(address fuse, bytes data)[] actions) external returns (bool success, bytes memory data)"
        ],
        provider
    );
    
    // Empty actions array for testing
    const emptyActions = [];
    
    console.log("Testing NEW signature (with address parameter)...");
    try {
        // This is a static call to check if function exists
        // We're not actually executing, just checking if the function signature exists
        const result = await adapterNew.callStatic.executeReaction(
            RSC_ADDRESS,
            emptyActions
        );
        console.log("✅ NEW signature detected!");
        console.log("   Adapter accepts: executeReaction(address, actions[])");
    } catch (error) {
        if (error.message.includes("function") || error.message.includes("selector")) {
            console.log("❌ NEW signature NOT found");
        } else {
            console.log("⚠️  Function exists but call failed:", error.message.split('\n')[0]);
        }
    }
    
    console.log("\nTesting OLD signature (no address parameter)...");
    try {
        const result = await adapterOld.callStatic.executeReaction(emptyActions);
        console.log("✅ OLD signature detected!");
        console.log("   Adapter accepts: executeReaction(actions[])");
    } catch (error) {
        if (error.message.includes("function") || error.message.includes("selector")) {
            console.log("❌ OLD signature NOT found");
        } else {
            console.log("⚠️  Function exists but call failed:", error.message.split('\n')[0]);
        }
    }
    
    console.log("\n📋 Conclusion:");
    console.log("If OLD signature works → REDEPLOY adapter");
    console.log("If NEW signature works → No redeployment needed");
    console.log("If neither works → Check contract manually");
}

testAdapterFunction().catch(console.error);

