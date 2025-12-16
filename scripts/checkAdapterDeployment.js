const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkAdapterDeployment() {
    const ADAPTER_ADDRESS = process.env.ADAPTER_ADDRESS;
    
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
            "function MANAGER_ROLE() external view returns (bytes32)",
            "function DEFAULT_ADMIN_ROLE() external view returns (bytes32)",
            "function hasRole(bytes32 role, address account) external view returns (bool)",
            "function getRoleAdmin(bytes32 role) external view returns (bytes32)"
        ],
        provider
    );
    
    console.log("=".repeat(70));
    console.log("🔍 CHECKING ADAPTER DEPLOYMENT");
    console.log("=".repeat(70));
    console.log("");
    console.log("Wallet:", wallet.address);
    console.log("Adapter:", ADAPTER_ADDRESS);
    console.log("");
    
    const managerRole = await adapter.MANAGER_ROLE();
    const adminRole = await adapter.DEFAULT_ADMIN_ROLE();
    
    const hasManager = await adapter.hasRole(managerRole, wallet.address);
    const hasAdmin = await adapter.hasRole(adminRole, wallet.address);
    
    console.log("Roles:");
    console.log("  MANAGER_ROLE:", hasManager ? "✅ Has role" : "❌ No role");
    console.log("  ADMIN_ROLE:", hasAdmin ? "✅ Has role" : "❌ No role");
    console.log("");
    
    // Check who the admin is
    const adminOfManager = await adapter.getRoleAdmin(managerRole);
    console.log("Admin of MANAGER_ROLE:", adminOfManager === adminRole ? "✅ DEFAULT_ADMIN_ROLE" : "❌ Different");
    console.log("");
    
    // If we're admin, we can grant MANAGER_ROLE
    if (hasAdmin) {
        console.log("✅ We have ADMIN_ROLE - we can grant MANAGER_ROLE!");
        console.log("");
        console.log("Solution: Grant MANAGER_ROLE to our wallet");
        console.log("");
        
        const grantAdapter = new ethers.Contract(
            ADAPTER_ADDRESS,
            [
                "function grantRole(bytes32 role, address account) external"
            ],
            wallet
        );
        
        console.log("Granting MANAGER_ROLE...");
        try {
            const tx = await grantAdapter.grantRole(managerRole, wallet.address);
            console.log("Transaction:", tx.hash);
            await tx.wait();
            console.log("✅ MANAGER_ROLE granted!");
            
            // Verify
            const nowHasManager = await adapter.hasRole(managerRole, wallet.address);
            console.log("Verification:", nowHasManager ? "✅ Now has role" : "❌ Still missing");
            
        } catch (error) {
            console.log("❌ Failed to grant role:", error.message.split('\n')[0]);
        }
    } else {
        console.log("❌ We don't have ADMIN_ROLE");
        console.log("Cannot grant MANAGER_ROLE ourselves");
        console.log("");
        console.log("Options:");
        console.log("  1. Contact the admin to grant MANAGER_ROLE");
        console.log("  2. Check if adapter was deployed by different wallet");
        console.log("  3. Redeploy adapter with correct manager");
    }
    
    console.log("");
    console.log("=".repeat(70));
}

checkAdapterDeployment().catch(console.error);

