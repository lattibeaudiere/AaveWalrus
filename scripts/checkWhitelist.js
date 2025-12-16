const { ethers } = require('hardhat');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkWhitelist() {
    console.log("=".repeat(60));
    console.log("CHECKING IPOR FUSION VAULT WHITELIST STATUS");
    console.log("=".repeat(60));
    console.log("");
    
    const ARBITRUM_RPC = process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc";
    const VAULT_ADDRESS = process.env.TARGET_VAULT;
    const ADAPTER_ADDRESS = process.env.ADAPTER_ADDRESS;
    const RSC_ADDRESS = process.env.RSC_ADDRESS;
    
    if (!VAULT_ADDRESS || VAULT_ADDRESS === "0x0000000000000000000000000000000000000000") {
        console.log("❌ TARGET_VAULT not set in .env");
        console.log("   Please set TARGET_VAULT to your IPOR Fusion Vault address");
        return;
    }
    
    if (!ADAPTER_ADDRESS || ADAPTER_ADDRESS === "0x0000000000000000000000000000000000000000") {
        console.log("⚠️  ADAPTER_ADDRESS not set - skipping adapter check");
    }
    
    const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);
    
    console.log("Configuration:");
    console.log(`  Vault: ${VAULT_ADDRESS}`);
    console.log(`  Adapter: ${ADAPTER_ADDRESS || "Not set"}`);
    console.log(`  RSC: ${RSC_ADDRESS || "Not set"}`);
    console.log("");
    
    // Check vault bytecode (verify it's deployed)
    try {
        const code = await provider.getCode(VAULT_ADDRESS);
        if (code === "0x") {
            console.log("❌ Vault not deployed at this address");
            return;
        }
        console.log("✅ Vault deployed (has bytecode)");
    } catch (error) {
        console.log(`⚠️  Could not check vault: ${error.message}`);
    }
    
    // Try to check if adapter is authorized
    if (ADAPTER_ADDRESS && ADAPTER_ADDRESS !== "0x0000000000000000000000000000000000000000") {
        try {
            // Common IPOR Fusion AccessManager interface
            const accessManagerABI = [
                "function isAuthorized(address account) external view returns (bool)",
                "function hasRole(bytes32 role, address account) external view returns (bool)",
                "function ALPHA_ROLE() external view returns (bytes32)"
            ];
            
            // Try to get access manager from vault (if it exposes it)
            // Or check if vault implements AccessControl directly
            const vaultABI = [
                "function getAccessManager() external view returns (address)",
                "function hasRole(bytes32 role, address account) external view returns (bool)"
            ];
            
            try {
                const vault = new ethers.Contract(VAULT_ADDRESS, vaultABI, provider);
                const accessManagerAddr = await vault.getAccessManager();
                console.log(`  Access Manager: ${accessManagerAddr}`);
                
                const accessManager = new ethers.Contract(accessManagerAddr, accessManagerABI, provider);
                const isAuth = await accessManager.isAuthorized(ADAPTER_ADDRESS);
                console.log(`  Adapter authorized: ${isAuth ? "✅ Yes" : "❌ No"}`);
            } catch (e) {
                // Try direct AccessControl check
                try {
                    const vault = new ethers.Contract(VAULT_ADDRESS, ["function hasRole(bytes32 role, address account) external view returns (bool)"], provider);
                    // ALPHA_ROLE = keccak256("ALPHA_ROLE") (common pattern)
                    const ALPHA_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ALPHA_ROLE"));
                    const hasRole = await vault.hasRole(ALPHA_ROLE, ADAPTER_ADDRESS);
                    console.log(`  Adapter has ALPHA_ROLE: ${hasRole ? "✅ Yes" : "❌ No"}`);
                } catch (e2) {
                    console.log(`  ⚠️  Could not check authorization: ${e2.message}`);
                    console.log("  Manual verification needed on Arbiscan");
                }
            }
        } catch (error) {
            console.log(`  ⚠️  Could not verify adapter authorization: ${error.message}`);
        }
    }
    
    // Check adapter registration
    if (ADAPTER_ADDRESS && ADAPTER_ADDRESS !== "0x0000000000000000000000000000000000000000") {
        try {
            const adapterABI = [
                "function isRSCRegistered(address rsc) external view returns (bool)",
                "function rscConfigs(address rsc) external view returns (address vault, uint256 targetChainId, bool isActive, uint256 lastExecution, uint256 executionCount)"
            ];
            
            const adapter = new ethers.Contract(ADAPTER_ADDRESS, adapterABI, provider);
            
            if (RSC_ADDRESS && RSC_ADDRESS !== "0x0000000000000000000000000000000000000000") {
                const isRegistered = await adapter.isRSCRegistered(RSC_ADDRESS);
                console.log(`  RSC registered in adapter: ${isRegistered ? "✅ Yes" : "❌ No"}`);
                
                if (isRegistered) {
                    const config = await adapter.rscConfigs(RSC_ADDRESS);
                    console.log(`  RSC active: ${config.isActive ? "✅ Yes" : "❌ No"}`);
                    console.log(`  Target vault: ${config.vault}`);
                    console.log(`  Target chain: ${config.targetChainId}`);
                }
            } else {
                console.log("  ⚠️  RSC_ADDRESS not set - cannot check registration");
            }
        } catch (error) {
            console.log(`  ⚠️  Could not check adapter: ${error.message}`);
        }
    }
    
    console.log("");
    console.log("=".repeat(60));
    console.log("RECOMMENDATIONS");
    console.log("=".repeat(60));
    console.log("");
    console.log("If adapter is not authorized:");
    console.log("  1. Call vault.addAuthorized(adapter) or grant ALPHA_ROLE");
    console.log("  2. Verify via vault owner/AccessManager");
    console.log("");
    console.log("If RSC is not registered:");
    console.log("  1. Call adapter.registerRSC(rscAddress, description)");
    console.log("  2. Verify RSC.getTargetVault() returns correct vault");
    console.log("");
}

checkWhitelist().catch(console.error);

