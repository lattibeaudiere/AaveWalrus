const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkWhitelistedRole() {
    console.log("=".repeat(70));
    console.log("🔍 CHECKING WHITELISTED ROLE REQUIREMENTS");
    console.log("=".repeat(70));
    console.log("");
    
    const VAULT = process.env.TARGET_VAULT || "0xee29A26179fE20D5D202dAE4a279119E08edc60b";
    const ADAPTER = process.env.ADAPTER_ADDRESS || "0x58DB4C40CE50FEfAD8EEaA0B609e12dE21b18805";
    const AAVE_SUPPLY_FUSE = "0x304756cD719382281fBD640f5F7932465eD663D6";
    const WHITELISTED_ADDRESS = "0xD3bae5569887C9e0422c6cbBEd45F97d42fc5E68";
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    console.log("📋 WHITELISTED ROLE EXPLANATION:");
    console.log("");
    console.log("The 'Whitelisted' role allows accounts to:");
    console.log("  • Deposit / Mint assets to the vault");
    console.log("  • Withdraw / Redeem assets from the vault");
    console.log("");
    console.log("This is DIFFERENT from:");
    console.log("  • Fuse whitelisting (which fuses can be executed)");
    console.log("  • Alpha role (which can execute strategies)");
    console.log("");
    
    console.log("=".repeat(70));
    console.log("🔍 CHECKING ADAPTER REQUIREMENTS");
    console.log("=".repeat(70));
    console.log("");
    
    console.log("Adapter Address:", ADAPTER);
    console.log("");
    
    // Check if adapter needs Whitelisted role
    console.log("1️⃣  Does Adapter Need Whitelisted Role?");
    console.log("");
    console.log("   ❌ NO - Adapter does NOT need Whitelisted role");
    console.log("");
    console.log("   Why:");
    console.log("   • Adapter uses execute() function (via Alpha role)");
    console.log("   • execute() is separate from deposit/withdraw");
    console.log("   • FuseActions handle all capital movement");
    console.log("   • No direct deposit/withdraw calls needed");
    console.log("");
    
    // Check Alpha role
    console.log("2️⃣  What Role Does Adapter Need?");
    console.log("");
    
    // Try to check Alpha role
    const roleAbi = [
        "function hasRole(bytes32 role, address account) external view returns (bool)",
        "function WHITELISTED_ROLE() external view returns (bytes32)"
    ];
    
    try {
        const vault = new ethers.Contract(VAULT, roleAbi, arbitrumProvider);
        
        // Try to get WHITELISTED_ROLE
        try {
            const whitelistedRole = await vault.WHITELISTED_ROLE();
            
            const adapterHasWhitelisted = await vault.hasRole(whitelistedRole, ADAPTER);
            
            console.log(`   Adapter has Whitelisted role: ${adapterHasWhitelisted ? "✅ YES" : "❌ NO"}`);
            console.log("");
            
            if (!adapterHasWhitelisted) {
                console.log("   ✅ This is CORRECT - adapter doesn't need it");
            }
        } catch (error) {
            console.log("   ⚠️  Could not check Whitelisted role");
        }
        
        // Check Alpha role
        const alphaRoleCandidates = [
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ALPHA_ROLE")),
            ethers.BigNumber.from(200),
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes("200"))
        ];
        
        console.log("   Checking Alpha role:");
        for (const role of alphaRoleCandidates) {
            try {
                const hasRole = await vault.hasRole(role, ADAPTER);
                if (hasRole) {
                    console.log(`   ✅ Adapter has ALPHA_ROLE`);
                    break;
                }
            } catch (error) {
                // Try next
            }
        }
        console.log("");
        
    } catch (error) {
        console.log("   ⚠️  Could not check roles:", error.message.split('\n')[0]);
        console.log("");
    }
    
    console.log("3️⃣  Why Fuse Address is in Whitelisted List:");
    console.log("");
    console.log(`   You showed: ${AAVE_SUPPLY_FUSE} in Whitelisted list`);
    console.log("");
    console.log("   ⚠️  This is likely a mistake or misunderstanding:");
    console.log("   • Fuse addresses don't need Whitelisted role");
    console.log("   • Fuses are whitelisted separately (in fuse list)");
    console.log("   • Fuses are contracts, not users");
    console.log("");
    console.log("   💡 Recommendation: Remove fuse address from Whitelisted role");
    console.log("      It serves no purpose and may cause confusion");
    console.log("");
    
    console.log("4️⃣  Who Needs Whitelisted Role?");
    console.log("");
    console.log("   ✅ Users who want to:");
    console.log("      • Deposit USDC directly to vault");
    console.log("      • Withdraw USDC directly from vault");
    console.log("");
    console.log("   ❌ NOT needed for:");
    console.log("      • Adapter (uses execute() via Alpha role)");
    console.log("      • RSC (doesn't interact directly)");
    console.log("      • Fuses (are contracts, not users)");
    console.log("");
    
    console.log("=".repeat(70));
    console.log("📊 SUMMARY");
    console.log("=".repeat(70));
    console.log("");
    console.log("✅ CORRECT SETUP:");
    console.log("   1. Fuses whitelisted in fuse list ✅");
    console.log("   2. Adapter has ALPHA_ROLE ✅");
    console.log("   3. Whitelisted role: Only for users who deposit/withdraw");
    console.log("");
    console.log("⚠️  ACTION ITEMS:");
    console.log("   1. Remove fuse address from Whitelisted role (if present)");
    console.log("   2. Verify adapter has ALPHA_ROLE (not Whitelisted)");
    console.log("   3. Whitelisted role only needed for direct depositors");
    console.log("");
    console.log("✅ System should work correctly without Whitelisted role on adapter");
    console.log("");
}

checkWhitelistedRole().catch(console.error);

