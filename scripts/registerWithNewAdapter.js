const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function registerWithNewAdapter() {
    console.log("=".repeat(70));
    console.log("📝 REGISTERING RSC IN NEW ADAPTER");
    console.log("=".repeat(70));
    console.log("");
    
    const NEW_ADAPTER = "0xA7a71255FfBE943b6107354684b78C26bF0cf161"; // Fresh deployment
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
    
    console.log("Using NEW adapter:", NEW_ADAPTER);
    console.log("RSC:", RSC_ADDRESS);
    console.log("Vault:", TARGET_VAULT);
    console.log("");
    
    const adapter = new ethers.Contract(
        NEW_ADAPTER,
        [
            "function registerCrossChainRSC(address rsc, address vault, uint256 targetChainId) external",
            "function isRSCRegistered(address rsc) external view returns (bool)",
            "function rscConfigs(address rsc) external view returns (address vault, uint256 targetChainId, bool isActive, uint256 lastExecution, uint256 executionCount)"
        ],
        wallet
    );
    
    // Check if already registered
    const isRegistered = await adapter.isRSCRegistered(RSC_ADDRESS);
    if (isRegistered) {
        console.log("✅ Already registered!");
        const config = await adapter.rscConfigs(RSC_ADDRESS);
        console.log("   Vault:", config.vault);
        console.log("   Active:", config.isActive);
        return;
    }
    
    console.log("Registering RSC...");
    try {
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
        const nowRegistered = await adapter.isRSCRegistered(RSC_ADDRESS);
        if (nowRegistered) {
            const config = await adapter.rscConfigs(RSC_ADDRESS);
            console.log("   ✅ Verified:");
            console.log("     Vault:", config.vault);
            console.log("     Chain ID:", config.targetChainId.toString());
            console.log("     Active:", config.isActive ? "✅" : "❌");
        }
        
    } catch (error) {
        console.log("   ❌ Registration failed!");
        console.log("   Error:", error.message.split('\n')[0]);
        
        if (error.transactionHash) {
            console.log("   Transaction:", error.transactionHash);
            console.log("   Check on Arbiscan: https://arbiscan.io/tx/" + error.transactionHash);
        }
        throw error;
    }
    
    console.log("");
    console.log("=".repeat(70));
}

registerWithNewAdapter().catch(console.error);

