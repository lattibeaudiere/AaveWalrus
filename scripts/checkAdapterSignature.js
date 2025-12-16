const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkAdapterSignature() {
    const ADAPTER_ADDRESS = process.env.ADAPTER_ADDRESS || "0xa60c91Aa6E0e203De3a6692a82eE65884B3B2D09";
    
    console.log("🔍 Checking Adapter Function Signature...\n");
    console.log("Adapter:", ADAPTER_ADDRESS);
    console.log("");
    
    const provider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    // Get contract code
    const code = await provider.getCode(ADAPTER_ADDRESS);
    
    if (code === "0x") {
        console.log("❌ Contract not found at this address!");
        return;
    }
    
    console.log("✅ Contract found");
    
    // Function selectors:
    // OLD: executeReaction((address,bytes)[]) = keccak256("executeReaction((address,bytes)[])")[:4]
    // NEW: executeReaction(address,(address,bytes)[]) = keccak256("executeReaction(address,(address,bytes)[])")[:4]
    
    const OLD_SIGNATURE = "executeReaction((address,bytes)[])";
    const NEW_SIGNATURE = "executeReaction(address,(address,bytes)[])";
    
    const oldSelector = ethers.utils.id(OLD_SIGNATURE).slice(0, 10);
    const newSelector = ethers.utils.id(NEW_SIGNATURE).slice(0, 10);
    
    console.log("\nFunction Selectors:");
    console.log("  OLD:", oldSelector, `(${OLD_SIGNATURE})`);
    console.log("  NEW:", newSelector, `(${NEW_SIGNATURE})`);
    
    // Check which selector exists in the code
    const hasOld = code.toLowerCase().includes(oldSelector.toLowerCase());
    const hasNew = code.toLowerCase().includes(newSelector.toLowerCase());
    
    console.log("\n📋 Results:");
    
    if (hasNew && !hasOld) {
        console.log("✅ Adapter has NEW signature");
        console.log("   No redeployment needed!");
        console.log("   Just re-register RSC if needed");
    } else if (hasOld && !hasNew) {
        console.log("❌ Adapter has OLD signature");
        console.log("   REDEPLOYMENT REQUIRED!");
        console.log("   New RSC will emit callbacks that old adapter can't handle");
    } else if (hasOld && hasNew) {
        console.log("⚠️  Both signatures found (unlikely)");
        console.log("   Check contract manually");
    } else {
        console.log("⚠️  Neither signature found");
        console.log("   Contract may have different function names");
        console.log("   Check contract source code");
    }
    
    // Also check RSC status
    console.log("\n📋 RSC Status:");
    const RSC_ADDRESS = process.env.RSC_ADDRESS;
    
    if (RSC_ADDRESS) {
        try {
            const adapter = new ethers.Contract(
                ADAPTER_ADDRESS,
                [
                    "function isRSCRegistered(address rsc) external view returns (bool)",
                    "function getRSCConfig(address rsc) external view returns (tuple(address vault, uint256 targetChainId, bool isActive, uint256 lastExecution, uint256 executionCount))"
                ],
                provider
            );
            
            const isRegistered = await adapter.isRSCRegistered(RSC_ADDRESS);
            console.log("  RSC Address:", RSC_ADDRESS);
            console.log("  Registered:", isRegistered ? "✅ Yes" : "❌ No");
            
            if (isRegistered) {
                const config = await adapter.getRSCConfig(RSC_ADDRESS);
                console.log("  Active:", config.isActive ? "✅ Yes" : "❌ No");
                console.log("  Vault:", config.vault);
            }
        } catch (error) {
            console.log("  Error checking RSC:", error.message);
        }
    } else {
        console.log("  RSC_ADDRESS not set in .env");
    }
}

checkAdapterSignature().catch(console.error);

