const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkAllMethods() {
    const ADAPTER_ADDRESS = process.env.ADAPTER_ADDRESS;
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0xe39c19A077e33d1145F8Cc78d4235aE8114C640a";
    const TARGET_VAULT = process.env.TARGET_VAULT;
    const ARBITRUM_CHAIN_ID = process.env.ARBITRUM_CHAIN_ID || "42161";
    
    const provider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    const wallet = new ethers.Wallet(
        process.env.PRIVATE_KEY || process.env.ARBITRUM_PRIVATE_KEY,
        provider
    );
    
    const adapter = new ethers.Contract(
        ADAPTER_ADDRESS,
        [
            "function registerCrossChainRSC(address rsc, address vault, uint256 targetChainId) external",
            "function registerRSC(address rsc, string calldata description) external",
            "function isRSCRegistered(address rsc) external view returns (bool)",
            "function rscConfigs(address rsc) external view returns (address vault, uint256 targetChainId, bool isActive, uint256 lastExecution, uint256 executionCount)",
            "function getRSCConfig(address rsc) external view returns (tuple(address vault, uint256 targetChainId, bool isActive, uint256 lastExecution, uint256 executionCount))"
        ],
        wallet
    );
    
    console.log("=".repeat(70));
    console.log("🔍 COMPREHENSIVE REGISTRATION CHECK");
    console.log("=".repeat(70));
    console.log("");
    
    // Check 1: Is it already registered?
    console.log("1️⃣  Checking Current Registration Status:");
    try {
        const isRegistered = await adapter.isRSCRegistered(RSC_ADDRESS);
        console.log("   Registered:", isRegistered ? "✅ YES" : "❌ NO");
        
        if (isRegistered) {
            console.log("   🎉 RSC IS ALREADY REGISTERED!");
            console.log("");
            
            try {
                const config = await adapter.getRSCConfig(RSC_ADDRESS);
                console.log("   Configuration:");
                console.log("     Vault:", config.vault);
                console.log("     Target Chain ID:", config.targetChainId.toString());
                console.log("     Active:", config.isActive ? "✅" : "❌");
                console.log("     Last Execution:", config.lastExecution.toString());
                console.log("     Execution Count:", config.executionCount.toString());
                console.log("");
                console.log("   ✅ System is ready to execute!");
                return;
            } catch (e) {
                console.log("   ⚠️  Could not fetch config");
            }
        }
    } catch (error) {
        console.log("   ❌ Error checking:", error.message.split('\n')[0]);
    }
    
    console.log("");
    
    // Check 2: Try alternative registration method
    if (!(await adapter.isRSCRegistered(RSC_ADDRESS))) {
        console.log("2️⃣  Attempting Alternative: registerRSC (not registerCrossChainRSC)");
        console.log("   (This tries to call RSC.getTargetVault() - might fail if RSC on different chain)");
        try {
            const tx = await adapter.registerRSC(
                RSC_ADDRESS,
                "Fusion Reactive RSC - Yield Optimizer",
                { gasLimit: 500000 }
            );
            console.log("   Transaction:", tx.hash);
            await tx.wait();
            console.log("   ✅ Alternative method succeeded!");
            return;
        } catch (error) {
            console.log("   ❌ Alternative method failed (expected if RSC on different chain)");
            console.log("   Error:", error.message.split('\n')[0]);
        }
    }
    
    console.log("");
    console.log("=".repeat(70));
    console.log("📊 SUMMARY");
    console.log("=".repeat(70));
    console.log("");
    
    const finalStatus = await adapter.isRSCRegistered(RSC_ADDRESS);
    if (finalStatus) {
        console.log("✅ RSC IS REGISTERED - System ready!");
    } else {
        console.log("❌ RSC NOT REGISTERED - System cannot execute");
        console.log("");
        console.log("Next Steps:");
        console.log("  1. Check transaction revert reasons on Arbiscan");
        console.log("  2. Consider redeploying adapter if bytecode mismatch");
        console.log("  3. Or manually modify adapter to allow registration");
    }
    console.log("");
}

checkAllMethods().catch(console.error);

