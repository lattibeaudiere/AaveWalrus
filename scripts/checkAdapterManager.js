const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkAdapterManager() {
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
            "function hasRole(bytes32 role, address account) external view returns (bool)",
            "function DEFAULT_ADMIN_ROLE() external view returns (bytes32)"
        ],
        provider
    );
    
    console.log("Checking roles for:", wallet.address);
    console.log("");
    
    const managerRole = await adapter.MANAGER_ROLE();
    const adminRole = await adapter.DEFAULT_ADMIN_ROLE();
    
    const hasManager = await adapter.hasRole(managerRole, wallet.address);
    const hasAdmin = await adapter.hasRole(adminRole, wallet.address);
    
    console.log("Manager Role:", hasManager ? "✅" : "❌");
    console.log("Admin Role:", hasAdmin ? "✅" : "❌");
    console.log("");
    
    if (!hasManager && !hasAdmin) {
        console.log("⚠️  Wallet does not have MANAGER_ROLE or ADMIN_ROLE!");
        console.log("This is why registration is failing.");
        console.log("");
        console.log("Solution: Grant MANAGER_ROLE to wallet address");
    }
}

checkAdapterManager().catch(console.error);

