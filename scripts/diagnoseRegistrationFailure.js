const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Diagnose why RSC registration failed
 */
async function diagnoseRegistrationFailure() {
    console.log("=".repeat(60));
    console.log("🔍 DIAGNOSING REGISTRATION FAILURE");
    console.log("=".repeat(60));
    console.log("");
    
    const ARBITRUM_RPC = process.env.ARBITRUM_RPC || process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
    const ADAPTER_ADDRESS = process.env.ADAPTER_ADDRESS || "0xdBfd1ea4387352f2b98bC2d08B4Cd4B668C0860D";
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0x15725e58A3199122FcBb4d6F20573EEFd730781A";
    const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.ARBITRUM_PRIVATE_KEY;
    
    const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    console.log("Configuration:");
    console.log(`  Adapter: ${ADAPTER_ADDRESS}`);
    console.log(`  RSC: ${RSC_ADDRESS}`);
    console.log(`  Signer: ${wallet.address}`);
    console.log("");
    
    // Adapter ABI
    const adapterABI = [
        "function MANAGER_ROLE() view returns (bytes32)",
        "function hasRole(bytes32 role, address account) view returns (bool)",
        "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
        "function isRSCRegistered(address) view returns (bool)",
        "function registerRSC(address rsc, string calldata description) external"
    ];
    
    // RSC ABI (to test if we can call it from Arbitrum)
    const rscABI = [
        "function getTargetVault() view returns (address)",
        "function getTargetChainId() view returns (uint256)"
    ];
    
    const adapter = new ethers.Contract(ADAPTER_ADDRESS, adapterABI, provider);
    
    try {
        console.log("=".repeat(60));
        console.log("1. CHECKING PERMISSIONS");
        console.log("=".repeat(60));
        console.log("");
        
        // Check MANAGER_ROLE
        const managerRole = await adapter.MANAGER_ROLE();
        const hasManagerRole = await adapter.hasRole(managerRole, wallet.address);
        
        console.log(`MANAGER_ROLE: ${managerRole}`);
        console.log(`Has MANAGER_ROLE: ${hasManagerRole ? '✅ Yes' : '❌ No'}`);
        console.log("");
        
        if (!hasManagerRole) {
            console.log("❌ ISSUE FOUND: Signer does not have MANAGER_ROLE!");
            console.log("");
            console.log("Who has MANAGER_ROLE?");
            console.log("  The adapter was deployed with a manager address.");
            console.log("  Only that manager can register RSCs.");
            console.log("");
            
            // Check DEFAULT_ADMIN_ROLE
            const adminRole = await adapter.DEFAULT_ADMIN_ROLE();
            const hasAdminRole = await adapter.hasRole(adminRole, wallet.address);
            
            console.log(`DEFAULT_ADMIN_ROLE: ${adminRole}`);
            console.log(`Has DEFAULT_ADMIN_ROLE: ${hasAdminRole ? '✅ Yes' : '❌ No'}`);
            console.log("");
            
            if (hasAdminRole) {
                console.log("✅ You have ADMIN role - can grant MANAGER_ROLE to yourself");
                console.log("");
            } else {
                console.log("❌ You don't have ADMIN role either");
                console.log("   Need to get MANAGER_ROLE from the deployer/admin");
            }
        }
        
        console.log("");
        console.log("=".repeat(60));
        console.log("2. CHECKING RSC ACCESSIBILITY");
        console.log("=".repeat(60));
        console.log("");
        
        // Try to call RSC functions (this won't work from Arbitrum, but let's see the error)
        try {
            const rsc = new ethers.Contract(RSC_ADDRESS, rscABI, provider);
            const targetVault = await rsc.getTargetVault();
            const targetChainId = await rsc.getTargetChainId();
            
            console.log("✅ RSC is accessible from Arbitrum");
            console.log(`  Target Vault: ${targetVault}`);
            console.log(`  Target Chain ID: ${targetChainId}`);
        } catch (error) {
            console.log("⚠️  RSC is on Reactive Network, not Arbitrum");
            console.log("   This is expected - adapter will call it via cross-chain");
            console.log(`   Error: ${error.message}`);
        }
        
        console.log("");
        console.log("=".repeat(60));
        console.log("3. CHECKING IF ALREADY REGISTERED");
        console.log("=".repeat(60));
        console.log("");
        
        const isRegistered = await adapter.isRSCRegistered(RSC_ADDRESS);
        console.log(`Is Registered: ${isRegistered ? '✅ Yes' : '❌ No'}`);
        
        console.log("");
        console.log("=".repeat(60));
        console.log("💡 SOLUTION");
        console.log("=".repeat(60));
        console.log("");
        
        if (!hasManagerRole) {
            console.log("Option 1: Grant MANAGER_ROLE to your wallet");
            console.log("  (If you have ADMIN role, you can do this)");
            console.log("");
            console.log("Option 2: Use the original manager address");
            console.log("  (Whoever deployed the adapter has MANAGER_ROLE)");
            console.log("");
            console.log("Option 3: Check adapter deployment");
            console.log("  Who deployed the adapter? That address has MANAGER_ROLE");
            console.log("");
        } else {
            console.log("You have MANAGER_ROLE - registration should work.");
            console.log("The failure might be due to:");
            console.log("  • RSC contract issue (can't call getTargetVault)");
            console.log("  • Vault address mismatch");
            console.log("  • Gas estimation issue");
        }
        
        console.log("");
        
    } catch (error) {
        console.log("❌ Error during diagnosis:", error.message);
    }
}

diagnoseRegistrationFailure().catch(console.error);

