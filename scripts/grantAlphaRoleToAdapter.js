const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Grant Alpha role to ADAPTER (not RSC) on the vault
 * The adapter is what actually calls vault.execute()
 */
async function grantAlphaRoleToAdapter() {
    console.log("=".repeat(70));
    console.log("🔐 GRANTING ALPHA ROLE TO ADAPTER");
    console.log("=".repeat(70));
    console.log("");
    
    const ARBITRUM_RPC = process.env.ARBITRUM_RPC || process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
    const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.ARBITRUM_PRIVATE_KEY;
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
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    console.log("Configuration:");
    console.log(`  Vault: ${VAULT_ADDRESS}`);
    console.log(`  Adapter: ${adapterAddress}`);
    console.log(`  Signer: ${wallet.address}`);
    console.log("");
    
    // Vault ABI - need to check what interface the vault uses
    // IPOR Fusion vaults use AccessManager
    const vaultABI = [
        "function grantRole(bytes32 role, address account) external",
        "function hasRole(bytes32 role, address account) view returns (bool)",
        "function ALPHA_ROLE() view returns (bytes32)",
        "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
        "function getRoleAdmin(bytes32 role) view returns (bytes32)"
    ];
    
    try {
        const vault = new ethers.Contract(VAULT_ADDRESS, vaultABI, wallet);
        
        // Try to get ALPHA_ROLE
        let alphaRole;
        try {
            alphaRole = await vault.ALPHA_ROLE();
            console.log(`✅ Found ALPHA_ROLE: ${alphaRole}`);
        } catch (e) {
            // Compute it
            alphaRole = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ALPHA_ROLE"));
            console.log(`📋 Computed ALPHA_ROLE: ${alphaRole}`);
        }
        
        console.log("");
        
        // Check current status
        const hasRole = await vault.hasRole(alphaRole, adapterAddress);
        
        console.log(`Current Status:`);
        console.log(`  Adapter has Alpha Role: ${hasRole ? '✅ Yes' : '❌ No'}`);
        console.log("");
        
        if (hasRole) {
            console.log("✅ Adapter already has Alpha role!");
            console.log("   No action needed.");
            return;
        }
        
        // Check if signer has permission to grant role
        let adminRole;
        try {
            adminRole = await vault.getRoleAdmin(alphaRole);
            const hasAdminRole = await vault.hasRole(adminRole, wallet.address);
            
            console.log(`Permission Check:`);
            console.log(`  Role Admin: ${adminRole}`);
            console.log(`  Signer has Admin Role: ${hasAdminRole ? '✅ Yes' : '❌ No'}`);
            console.log("");
            
            if (!hasAdminRole) {
                console.log("❌ ERROR: Signer does not have permission to grant Alpha role");
                console.log("");
                console.log("💡 Solutions:");
                console.log("  1. Use Vault Builder UI to grant role");
                console.log("  2. Use the account that has ATOMIST_ROLE or higher");
                console.log("  3. Check who has the admin role and use that account");
                return;
            }
        } catch (e) {
            console.log("⚠️  Could not check permissions, attempting grant anyway...");
            console.log("");
        }
        
        // Grant the role
        console.log("📤 Granting Alpha role to adapter...");
        console.log("");
        
        const tx = await vault.grantRole(alphaRole, adapterAddress, { gasLimit: 200000 });
        console.log(`Transaction hash: ${tx.hash}`);
        console.log("Waiting for confirmation...");
        
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
            console.log("");
            console.log("✅ ALPHA ROLE GRANTED SUCCESSFULLY!");
            console.log(`Block: ${receipt.blockNumber}`);
            console.log(`Gas used: ${receipt.gasUsed.toString()}`);
            console.log("");
            
            // Verify
            const verified = await vault.hasRole(alphaRole, adapterAddress);
            if (verified) {
                console.log("✅ Verified: Adapter now has Alpha role");
                console.log("");
                console.log("🎉 The adapter can now execute on the vault!");
                console.log("   RSC callbacks will now be able to rebalance funds.");
            }
        } else {
            console.error("❌ Transaction failed");
        }
        
    } catch (error) {
        console.error("❌ Error granting role:", error.message);
        
        if (error.code === 'CALL_EXCEPTION') {
            console.log("");
            console.log("💡 Possible Issues:");
            console.log("  1. Vault contract might use different interface");
            console.log("  2. Signer doesn't have permission");
            console.log("  3. Vault might use AccessManager contract");
            console.log("");
            console.log("💡 Alternative: Use Vault Builder UI to grant Alpha role");
            console.log("   https://app.ipor.io/fusion/vaults");
        }
    }
}

grantAlphaRoleToAdapter().catch(console.error);

