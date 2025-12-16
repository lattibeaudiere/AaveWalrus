const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Check if adapter has Alpha role on vault
 */
async function checkAlphaRole() {
    const ARBITRUM_RPC = process.env.ARBITRUM_RPC || process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
    const VAULT_ADDRESS = process.env.TARGET_VAULT || "0xee29A26179fE20D5D202dAE4a279119E08edc60b";
    
    // Get adapter from deployment or env
    const fs = require('fs');
    const path = require('path');
    const deploymentsPath = path.join(__dirname, '../deployment-addresses.json');
    let adapterAddress = process.env.ADAPTER_ADDRESS || "0xa60c91Aa6E0e203De3a6692a82eE65884B3B2D09";
    
    if (fs.existsSync(deploymentsPath)) {
        const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
        if (deployments.ReactiveAlphaAdapter) {
            adapterAddress = deployments.ReactiveAlphaAdapter;
        }
    }
    
    const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);
    
    // Try to get ALPHA_ROLE constant - vault might use different naming
    const vaultABI = [
        "function hasRole(bytes32 role, address account) view returns (bool)",
        "function ALPHA_ROLE() view returns (bytes32)",
        "function getRoleAdmin(bytes32 role) view returns (bytes32)"
    ];
    
    try {
        const vault = new ethers.Contract(VAULT_ADDRESS, vaultABI, provider);
        
        // Try to get ALPHA_ROLE
        let alphaRole;
        try {
            alphaRole = await vault.ALPHA_ROLE();
        } catch (e) {
            // If ALPHA_ROLE() doesn't exist, try computing it
            alphaRole = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ALPHA_ROLE"));
        }
        
        const hasRole = await vault.hasRole(alphaRole, adapterAddress);
        
        console.log("=".repeat(60));
        console.log("ALPHA ROLE CHECK");
        console.log("=".repeat(60));
        console.log("");
        console.log(`Vault: ${VAULT_ADDRESS}`);
        console.log(`Adapter: ${adapterAddress}`);
        console.log(`ALPHA_ROLE: ${alphaRole}`);
        console.log(`Has Role: ${hasRole ? '✅ Yes' : '❌ No'}`);
        console.log("");
        
        if (!hasRole) {
            console.log("⚠️  WARNING: Adapter does NOT have ALPHA_ROLE");
            console.log("   Need to grant role using Vault Builder or manually");
            console.log("");
        } else {
            console.log("✅ Adapter has ALPHA_ROLE - can execute on vault");
            console.log("");
        }
        
    } catch (error) {
        console.log(`❌ Error checking role: ${error.message}`);
    }
}

checkAlphaRole().catch(console.error);

