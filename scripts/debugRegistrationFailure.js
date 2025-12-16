const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function debugRegistration() {
    console.log("=".repeat(70));
    console.log("🔍 DEBUGGING REGISTRATION FAILURE");
    console.log("=".repeat(70));
    console.log("");
    
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
            "function isRSCRegistered(address rsc) external view returns (bool)",
            "function rscConfigs(address rsc) external view returns (address vault, uint256 targetChainId, bool isActive, uint256 lastExecution, uint256 executionCount)",
            "function MANAGER_ROLE() external view returns (bytes32)",
            "function hasRole(bytes32 role, address account) external view returns (bool)"
        ],
        wallet
    );
    
    console.log("1️⃣  Checking Prerequisites:");
    console.log("   RSC:", RSC_ADDRESS);
    console.log("   Vault:", TARGET_VAULT);
    console.log("   Chain ID:", ARBITRUM_CHAIN_ID);
    console.log("");
    
    // Check if already registered
    const isRegistered = await adapter.isRSCRegistered(RSC_ADDRESS);
    console.log("   Already registered:", isRegistered ? "✅ Yes" : "❌ No");
    
    if (isRegistered) {
        const config = await adapter.rscConfigs(RSC_ADDRESS);
        console.log("   Current config:");
        console.log("     Vault:", config.vault);
        console.log("     Chain ID:", config.targetChainId.toString());
        console.log("     Active:", config.isActive);
        return;
    }
    
    // Check roles
    const managerRole = await adapter.MANAGER_ROLE();
    const hasRole = await adapter.hasRole(managerRole, wallet.address);
    console.log("   Has MANAGER_ROLE:", hasRole ? "✅ Yes" : "❌ No");
    console.log("");
    
    if (!hasRole) {
        console.log("   ❌ Wallet does not have MANAGER_ROLE!");
        console.log("   This is why registration is failing.");
        return;
    }
    
    // Try static call to see what happens
    console.log("2️⃣  Testing Static Call:");
    try {
        await adapter.callStatic.registerCrossChainRSC(
            RSC_ADDRESS,
            TARGET_VAULT,
            ARBITRUM_CHAIN_ID
        );
        console.log("   ✅ Static call succeeded - should work!");
    } catch (error) {
        console.log("   ❌ Static call failed:");
        console.log("   Error:", error.message.split('\n')[0]);
        
        // Try to extract revert reason
        if (error.reason) {
            console.log("   Reason:", error.reason);
        }
        
        // Check for specific error messages
        if (error.message.includes("RSCAlreadyRegistered")) {
            console.log("   ⚠️  RSC is already registered (but isRSCRegistered says no?)");
        } else if (error.message.includes("InvalidVaultAddress")) {
            console.log("   ⚠️  Invalid vault address");
            console.log("   Vault:", TARGET_VAULT);
            console.log("   Is zero address:", TARGET_VAULT === ethers.constants.AddressZero);
        } else if (error.message.includes("AccessControl")) {
            console.log("   ⚠️  Access control issue");
        }
    }
    console.log("");
    
    // Check if there's a different function signature
    console.log("3️⃣  Checking Function Signature:");
    const iface = adapter.interface;
    const funcFragment = iface.getFunction("registerCrossChainRSC");
    console.log("   Function:", funcFragment.format());
    console.log("   Inputs:", funcFragment.inputs.length);
    
    console.log("");
    console.log("4️⃣  Trying Registration with Different Approach:");
    
    // Try with encoded data directly
    try {
        const data = iface.encodeFunctionData("registerCrossChainRSC", [
            RSC_ADDRESS,
            TARGET_VAULT,
            ARBITRUM_CHAIN_ID
        ]);
        
        console.log("   Encoded data:", data.substring(0, 66) + "...");
        
        // Estimate gas
        const gasEstimate = await wallet.estimateGas({
            to: ADAPTER_ADDRESS,
            data: data
        });
        
        console.log("   Gas estimate:", gasEstimate.toString());
        console.log("   ✅ Gas estimation succeeded!");
        
    } catch (error) {
        console.log("   ❌ Gas estimation failed:");
        console.log("   Error:", error.message.split('\n')[0]);
    }
    
    console.log("");
    console.log("=".repeat(70));
    console.log("📋 RECOMMENDATION");
    console.log("=".repeat(70));
    console.log("");
    console.log("If registration continues to fail:");
    console.log("  1. Check transaction on Arbiscan for exact revert reason");
    console.log("  2. Verify adapter bytecode matches source code");
    console.log("  3. Check if adapter was deployed with different constructor");
    console.log("");
}

debugRegistration().catch(console.error);

