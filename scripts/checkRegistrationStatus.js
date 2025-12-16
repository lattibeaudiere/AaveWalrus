const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkRegistration() {
    console.log("=".repeat(70));
    console.log("🔍 CHECKING REGISTRATION STATUS");
    console.log("=".repeat(70));
    console.log("");
    
    const NEW_ADAPTER = process.env.ADAPTER_ADDRESS || "0x58DB4C40CE50FEfAD8EEaA0B609e12dE21b18805";
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0xAC66a994B8BB8b4a9aC90830Ac72207Cd22e7f21"; // New RSC with new adapter
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
        NEW_ADAPTER,
        [
            "function registerCrossChainRSC(address rsc, address vault, uint256 targetChainId) external",
            "function isRSCRegistered(address rsc) external view returns (bool)",
            "function rscConfigs(address rsc) external view returns (address vault, uint256 targetChainId, bool isActive, uint256 lastExecution, uint256 executionCount)",
            "function targetVault() external view returns (address)",
            "function MANAGER_ROLE() external view returns (bytes32)",
            "function hasRole(bytes32 role, address account) external view returns (bool)"
        ],
        wallet
    );
    
    console.log("Adapter:", NEW_ADAPTER);
    console.log("RSC:", RSC_ADDRESS);
    console.log("");
    
    // Check if registered
    console.log("1️⃣  Registration Status:");
    const isRegistered = await adapter.isRSCRegistered(RSC_ADDRESS);
    console.log("   Registered:", isRegistered ? "✅ YES" : "❌ NO");
    
    if (isRegistered) {
        const config = await adapter.rscConfigs(RSC_ADDRESS);
        console.log("   Vault:", config.vault);
        console.log("   Chain ID:", config.targetChainId.toString());
        console.log("   Active:", config.isActive ? "✅" : "❌");
        console.log("");
        console.log("   ✅ Registration is working!");
        return;
    }
    
    console.log("");
    
    // Check roles
    console.log("2️⃣  Access Control:");
    const managerRole = await adapter.MANAGER_ROLE();
    const hasManager = await adapter.hasRole(managerRole, wallet.address);
    console.log("   MANAGER_ROLE:", hasManager ? "✅ Has role" : "❌ No role");
    console.log("");
    
    if (!hasManager) {
        console.log("   ⚠️  Wallet doesn't have MANAGER_ROLE");
        console.log("   Cannot register without role");
        return;
    }
    
    // Try registration
    console.log("3️⃣  Attempting Registration:");
    try {
        // Try static call first
        await adapter.callStatic.registerCrossChainRSC(
            RSC_ADDRESS,
            TARGET_VAULT,
            ARBITRUM_CHAIN_ID
        );
        console.log("   ✅ Static call succeeded");
        console.log("");
        
        // Try actual transaction
        console.log("   Sending transaction...");
        const tx = await adapter.registerCrossChainRSC(
            RSC_ADDRESS,
            TARGET_VAULT,
            ARBITRUM_CHAIN_ID,
            { gasLimit: 300000 }
        );
        
        console.log("   Transaction:", tx.hash);
        console.log("   Waiting for confirmation...");
        
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
            console.log("   ✅ Registration successful!");
            console.log("");
            
            // Verify
            const nowRegistered = await adapter.isRSCRegistered(RSC_ADDRESS);
            if (nowRegistered) {
                console.log("   ✅ Verified: RSC is now registered!");
            }
        } else {
            console.log("   ❌ Transaction failed");
        }
        
    } catch (error) {
        console.log("   ❌ Registration failed!");
        console.log("   Error:", error.message.split('\n')[0]);
        
        if (error.transactionHash) {
            console.log("   Transaction:", error.transactionHash);
        }
    }
    
    console.log("");
    
    // Check adapter workaround
    console.log("4️⃣  Adapter Workaround Status:");
    const targetVault = await adapter.targetVault();
    console.log("   Target Vault:", targetVault);
    
    if (targetVault !== ethers.constants.AddressZero) {
        console.log("   ✅ Workaround is active!");
        console.log("   System can execute even without registration");
        console.log("   (Uses targetVault as fallback)");
    } else {
        console.log("   ❌ Workaround not configured");
        console.log("   System requires registration to work");
    }
    
    console.log("");
    console.log("=".repeat(70));
    console.log("📊 SUMMARY");
    console.log("=".repeat(70));
    console.log("");
    
    const finalRegistered = await adapter.isRSCRegistered(RSC_ADDRESS);
    const finalTargetVault = await adapter.targetVault();
    
    if (finalRegistered) {
        console.log("✅ Registration: WORKING");
        console.log("✅ System: FULLY OPERATIONAL");
    } else if (finalTargetVault !== ethers.constants.AddressZero) {
        console.log("⚠️  Registration: NOT WORKING");
        console.log("✅ Workaround: ACTIVE");
        console.log("✅ System: CAN EXECUTE (using workaround)");
        console.log("");
        console.log("Note: System will work, but registration should be fixed");
    } else {
        console.log("❌ Registration: NOT WORKING");
        console.log("❌ Workaround: NOT CONFIGURED");
        console.log("❌ System: BLOCKED");
    }
    console.log("");
}

checkRegistration().catch(console.error);

