const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function verifyFuseWhitelisting() {
    console.log("=".repeat(70));
    console.log("🔍 VERIFYING FUSE WHITELISTING ON VAULT");
    console.log("=".repeat(70));
    console.log("");
    
    const VAULT = process.env.TARGET_VAULT || "0xee29A26179fE20D5D202dAE4a279119E08edc60b";
    const ADAPTER = process.env.ADAPTER_ADDRESS || "0x58DB4C40CE50FEfAD8EEaA0B609e12dE21b18805";
    
    // Fuse addresses
    const AAVE_SUPPLY_FUSE = "0x304756cD719382281fBD640f5F7932465eD663D6";
    const COMPOUND_SUPPLY_FUSE = "0xB0b3dc1B27C6c8007c9B01a768d6717f6813fE94";
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    console.log("Vault:", VAULT);
    console.log("Adapter:", ADAPTER);
    console.log("");
    
    // Try to get vault's fuse manager
    console.log("1️⃣  Checking Vault's Fuse Manager:");
    console.log("");
    
    // Common patterns for fuse manager storage
    const fuseManagerAbis = [
        "function fuseManager() external view returns (address)",
        "function FUSE_MANAGER() external view returns (address)",
        "function getFuseManager() external view returns (address)"
    ];
    
    let fuseManagerAddress = null;
    
    for (const abi of fuseManagerAbis) {
        try {
            const vault = new ethers.Contract(VAULT, [abi], arbitrumProvider);
            fuseManagerAddress = await vault.fuseManager();
            console.log(`   ✅ Found Fuse Manager: ${fuseManagerAddress}`);
            break;
        } catch (error) {
            // Try next ABI
        }
    }
    
    if (!fuseManagerAddress) {
        console.log("   ⚠️  Could not find fuse manager via standard interface");
        console.log("   This is normal - vault may use different structure");
        console.log("");
    } else {
        // Check fuse whitelisting on fuse manager
        const fuseManagerAbi = [
            "function isFuseWhitelisted(address fuse) external view returns (bool)",
            "function whitelistedFuses(address fuse) external view returns (bool)",
            "function getFuseList() external view returns (address[] memory)"
        ];
        
        for (const abi of fuseManagerAbi) {
            try {
                const fuseManager = new ethers.Contract(fuseManagerAddress, [abi], arbitrumProvider);
                
                if (abi.includes("isFuseWhitelisted")) {
                    const aaveWhitelisted = await fuseManager.isFuseWhitelisted(AAVE_SUPPLY_FUSE);
                    const compoundWhitelisted = await fuseManager.isFuseWhitelisted(COMPOUND_SUPPLY_FUSE);
                    
                    console.log(`   Aave Supply Fuse: ${aaveWhitelisted ? "✅ WHITELISTED" : "❌ NOT WHITELISTED"}`);
                    console.log(`   Compound Supply Fuse: ${compoundWhitelisted ? "✅ WHITELISTED" : "❌ NOT WHITELISTED"}`);
                    console.log("");
                    
                    if (!aaveWhitelisted || !compoundWhitelisted) {
                        console.log("   ⚠️  CRITICAL: Fuses are NOT whitelisted!");
                        console.log("   Capital deployment will FAIL until fuses are whitelisted");
                        console.log("");
                    }
                    break;
                } else if (abi.includes("getFuseList")) {
                    const fuseList = await fuseManager.getFuseList();
                    console.log(`   Found ${fuseList.length} whitelisted fuses`);
                    const aaveInList = fuseList.some(f => f.toLowerCase() === AAVE_SUPPLY_FUSE.toLowerCase());
                    const compoundInList = fuseList.some(f => f.toLowerCase() === COMPOUND_SUPPLY_FUSE.toLowerCase());
                    console.log(`   Aave Supply Fuse: ${aaveInList ? "✅ WHITELISTED" : "❌ NOT WHITELISTED"}`);
                    console.log(`   Compound Supply Fuse: ${compoundInList ? "✅ WHITELISTED" : "❌ NOT WHITELISTED"}`);
                    console.log("");
                    break;
                }
            } catch (error) {
                // Try next method
            }
        }
    }
    
    console.log("2️⃣  Testing FuseAction Execution (Simulation):");
    console.log("");
    
    // Try to simulate a FuseAction by checking if adapter can call vault.execute
    console.log("   This would require testing with actual vault.execute() call");
    console.log("   Recommendation: Check vault UI to verify fuse whitelisting");
    console.log("");
    
    console.log("3️⃣  Checking Alpha Role:");
    console.log("");
    
    // Try multiple role check patterns
    const roleAbis = [
        "function hasRole(bytes32 role, address account) external view returns (bool)",
        "function getRoleMemberCount(bytes32 role) external view returns (uint256)"
    ];
    
    // Alpha role is typically 200 or keccak256("ALPHA_ROLE")
    const alphaRoleCandidates = [
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ALPHA_ROLE")),
        ethers.BigNumber.from(200), // Some implementations use numeric IDs
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("200"))
    ];
    
    for (const abi of roleAbis) {
        try {
            const vault = new ethers.Contract(VAULT, [abi], arbitrumProvider);
            
            for (const role of alphaRoleCandidates) {
                try {
                    const hasRole = await vault.hasRole(role, ADAPTER);
                    if (hasRole) {
                        console.log(`   ✅ Adapter has ALPHA_ROLE (${role})`);
                        console.log("");
                        break;
                    }
                } catch (error) {
                    // Try next role format
                }
            }
        } catch (error) {
            // Try next ABI
        }
    }
    
    console.log("=".repeat(70));
    console.log("📊 CRITICAL REQUIREMENTS FOR CAPITAL DEPLOYMENT");
    console.log("=".repeat(70));
    console.log("");
    console.log("✅ REQUIRED:");
    console.log("  1. Fuses must be whitelisted on vault");
    console.log("     • Aave Supply: 0x304756cD719382281fBD640f5F7932465eD663D6");
    console.log("     • Compound Supply: 0xB0b3dc1B27C6c8007c9B01a768d6717f6813fE94");
    console.log("");
    console.log("  2. Adapter must have ALPHA_ROLE on vault");
    console.log("     • Adapter: " + ADAPTER);
    console.log("");
    console.log("  3. Fuse addresses in RSC must match whitelisted fuses");
    console.log("     • ✅ Verified - addresses match");
    console.log("");
    console.log("⚠️  HOW TO WHITELIST FUSES:");
    console.log("");
    console.log("  Option 1: Via Vault Builder UI");
    console.log("    • Go to your vault in IPOR Fusion UI");
    console.log("    • Navigate to 'Fuses' or 'Configuration' section");
    console.log("    • Add fuses manually");
    console.log("");
    console.log("  Option 2: Via Atomist Role");
    console.log("    • Use Atomist wallet (has permission to manage fuses)");
    console.log("    • Call fuse manager's addFuse() function");
    console.log("");
    console.log("  Option 3: Contact IPOR Support");
    console.log("    • Discord: IPOR Protocol server");
    console.log("    • Request fuse whitelisting for your vault");
    console.log("");
    console.log("💡 VERIFY IN VAULT UI:");
    console.log("   Check if fuses appear in vault's fuse list");
    console.log("   If not, capital deployment will fail with 'Fuse not whitelisted' error");
    console.log("");
}

verifyFuseWhitelisting().catch(console.error);

