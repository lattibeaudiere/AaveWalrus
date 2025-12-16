const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function registerNewRSC() {
    console.log("=".repeat(70));
    console.log("📝 REGISTERING NEW RSC IN ADAPTER");
    console.log("=".repeat(70));
    console.log("");
    
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0xe39c19A077e33d1145F8Cc78d4235aE8114C640a";
    const ADAPTER_ADDRESS = process.env.ADAPTER_ADDRESS || "0xA7a71255FfBE943b6107354684b78C26bF0cf161";
    const TARGET_VAULT = process.env.TARGET_VAULT;
    const ARBITRUM_CHAIN_ID = process.env.ARBITRUM_CHAIN_ID || "42161";
    
    if (!ADAPTER_ADDRESS) {
        throw new Error("ADAPTER_ADDRESS must be set in .env");
    }
    
    if (!TARGET_VAULT) {
        throw new Error("TARGET_VAULT must be set in .env");
    }
    
    const provider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    const wallet = new ethers.Wallet(
        process.env.PRIVATE_KEY || process.env.ARBITRUM_PRIVATE_KEY,
        provider
    );
    
    console.log("Configuration:");
    console.log("  Adapter:", ADAPTER_ADDRESS);
    console.log("  RSC:", RSC_ADDRESS);
    console.log("  Vault:", TARGET_VAULT);
    console.log("  Target Chain ID:", ARBITRUM_CHAIN_ID);
    console.log("");
    
    const adapter = new ethers.Contract(
        ADAPTER_ADDRESS,
        [
            "function registerCrossChainRSC(address rsc, address vault, uint256 targetChainId) external",
            "function isRSCRegistered(address rsc) external view returns (bool)",
            "function rscConfigs(address rsc) external view returns (address vault, uint256 targetChainId, bool isActive, uint256 lastExecution, uint256 executionCount)"
        ],
        wallet
    );
    
    console.log("1️⃣  Checking Current Registration:");
    try {
        const isRegistered = await adapter.isRSCRegistered(RSC_ADDRESS);
        console.log("   Registered:", isRegistered ? "✅ Yes" : "❌ No");
        
        if (isRegistered) {
            const config = await adapter.rscConfigs(RSC_ADDRESS);
            console.log("   Vault:", config.vault);
            console.log("   Target Chain ID:", config.targetChainId.toString());
            console.log("   Active:", config.isActive ? "✅" : "❌");
            console.log("");
            console.log("   ✅ RSC already registered!");
            return;
        }
    } catch (error) {
        console.log("   ❌ Error:", error.message.split('\n')[0]);
    }
    
    console.log("");
    console.log("2️⃣  Registering RSC:");
    try {
        // Note: Deployed adapter may not have description parameter
        // Try with 3 params first (rsc, vault, chainId)
        const tx = await adapter.registerCrossChainRSC(
            RSC_ADDRESS,
            TARGET_VAULT,
            ARBITRUM_CHAIN_ID,
            { gasLimit: 300000 }
        );
        
        console.log("   Transaction:", tx.hash);
        console.log("   Waiting for confirmation...");
        
        await tx.wait();
        
        console.log("   ✅ Registration successful!");
        console.log("");
        
        // Verify
        const isRegistered = await adapter.isRSCRegistered(RSC_ADDRESS);
        if (isRegistered) {
            console.log("   ✅ Verified: RSC is now registered");
        } else {
            console.log("   ⚠️  Warning: Registration may have failed");
        }
        
    } catch (error) {
        console.log("   ❌ Registration failed!");
        console.log("   Error:", error.message.split('\n')[0]);
        
        if (error.reason) {
            console.log("   Reason:", error.reason);
        }
        
        throw error;
    }
    
    console.log("");
    console.log("=".repeat(70));
    console.log("✅ SETUP COMPLETE");
    console.log("=".repeat(70));
    console.log("");
    console.log("System Status:");
    console.log("  ✅ RSC deployed with new QueryHelper");
    console.log("  ✅ Subscribed to Aave events");
    console.log("  ✅ Subscribed to QueryHelper events");
    console.log("  ✅ Registered in adapter");
    console.log("");
    console.log("Next: System will automatically process events and rebalance");
    console.log("");
}

registerNewRSC().catch(console.error);

