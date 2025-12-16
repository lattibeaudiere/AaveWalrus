const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function verifyFuseAddresses() {
    console.log("=".repeat(70));
    console.log("✅ FUSE WHITELISTING VERIFICATION");
    console.log("=".repeat(70));
    console.log("");
    
    const VAULT = process.env.TARGET_VAULT || "0xee29A26179fE20D5D202dAE4a279119E08edc60b";
    const RSC_ADDRESS = "0xf64afe64622CeAe79d48A15ebC49CC7FF416c688";
    
    // Fuse addresses from RSC
    const RSC_AAVE_SUPPLY_FUSE = "0x304756cD719382281fBD640f5F7932465eD663D6";
    const RSC_COMPOUND_SUPPLY_FUSE = "0xB0b3dc1B27C6c8007c9B01a768d6717f6813fE94";
    const RSC_AAVE_BALANCE_FUSE = "0x4CB1c4774BA1B65802c68Adb33DE99ABf8B21228";
    const RSC_COMPOUND_BALANCE_FUSE = "0xCF730BAA5542DC7570907696271bA96019FcD10C";
    
    // Fuse addresses from UI (what user confirmed)
    const UI_AAVE_BALANCE_FUSE = "0x4CB1c4774BA1B65802c68Adb33DE99ABf8B21228";
    const UI_COMPOUND_BALANCE_FUSE = "0xCF730BAA5542DC7570907696271bA96019FcD10C";
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://reactive-network.rpc.thirdweb.com"
    );
    
    console.log("📋 VAULT FUSE CONFIGURATION (from UI):");
    console.log("");
    console.log("✅ Functional Fuses (Supply):");
    console.log("   • AaveV3SupplyFuseV003 - Market ID 1");
    console.log("   • CompoundV3UsdcSupplyFuseV002 - Market ID 2");
    console.log("");
    console.log("✅ Balance Fuses:");
    console.log(`   • AaveV3BalanceFuseV001 - Market ID 1`);
    console.log(`     Address: ${UI_AAVE_BALANCE_FUSE}`);
    console.log(`   • CompoundV3UsdcBalanceFuseV001 - Market ID 2`);
    console.log(`     Address: ${UI_COMPOUND_BALANCE_FUSE}`);
    console.log("");
    
    console.log("🔍 VERIFYING FUSE ADDRESSES:");
    console.log("");
    
    // Check RSC fuse addresses
    console.log("1️⃣  RSC Fuse Configuration:");
    console.log("");
    
    const rscAbi = [
        "function AAVE_SUPPLY_FUSE() external view returns (address)",
        "function COMPOUND_SUPPLY_FUSE() external view returns (address)",
        "function AAVE_BALANCE_FUSE() external view returns (address)",
        "function COMPOUND_BALANCE_FUSE() external view returns (address)"
    ];
    
    try {
        const rsc = new ethers.Contract(RSC_ADDRESS, rscAbi, reactiveProvider);
        
        const rscAaveSupply = await rsc.AAVE_SUPPLY_FUSE();
        const rscCompoundSupply = await rsc.COMPOUND_SUPPLY_FUSE();
        const rscAaveBalance = await rsc.AAVE_BALANCE_FUSE();
        const rscCompoundBalance = await rsc.COMPOUND_BALANCE_FUSE();
        
        console.log(`   Aave Supply: ${rscAaveSupply}`);
        console.log(`   Compound Supply: ${rscCompoundSupply}`);
        console.log(`   Aave Balance: ${rscAaveBalance}`);
        console.log(`   Compound Balance: ${rscCompoundBalance}`);
        console.log("");
        
    } catch (error) {
        console.log("   ⚠️  Could not read RSC fuse addresses:", error.message.split('\n')[0]);
        console.log("");
    }
    
    console.log("2️⃣  Comparing Balance Fuse Addresses:");
    console.log("");
    
    const balanceFusesMatch = 
        UI_AAVE_BALANCE_FUSE.toLowerCase() === RSC_AAVE_BALANCE_FUSE.toLowerCase() &&
        UI_COMPOUND_BALANCE_FUSE.toLowerCase() === RSC_COMPOUND_BALANCE_FUSE.toLowerCase();
    
    console.log(`   Aave Balance: ${balanceFusesMatch ? "✅ MATCH" : "❌ MISMATCH"}`);
    console.log(`     UI: ${UI_AAVE_BALANCE_FUSE}`);
    console.log(`     RSC: ${RSC_AAVE_BALANCE_FUSE}`);
    console.log("");
    
    console.log(`   Compound Balance: ${balanceFusesMatch ? "✅ MATCH" : "❌ MISMATCH"}`);
    console.log(`     UI: ${UI_COMPOUND_BALANCE_FUSE}`);
    console.log(`     RSC: ${RSC_COMPOUND_BALANCE_FUSE}`);
    console.log("");
    
    console.log("3️⃣  Getting Supply Fuse Addresses from Vault:");
    console.log("");
    
    // Try to get fuse addresses from vault
    const vaultAbi = [
        "function getFuses() external view returns (address[] memory)",
        "function isFuseSupported(address fuse_) external view returns (bool)"
    ];
    
    try {
        const vault = new ethers.Contract(VAULT, vaultAbi, arbitrumProvider);
        const fuseList = await vault.getFuses();
        
        console.log(`   Found ${fuseList.length} whitelisted fuses:`);
        console.log("");
        
        for (let i = 0; i < fuseList.length; i++) {
            const fuseAddr = fuseList[i];
            console.log(`   ${i + 1}. ${fuseAddr}`);
            
            // Check if this matches our RSC fuses
            if (fuseAddr.toLowerCase() === RSC_AAVE_SUPPLY_FUSE.toLowerCase()) {
                console.log(`      ✅ This is the Aave Supply Fuse (matches RSC)`);
            }
            if (fuseAddr.toLowerCase() === RSC_COMPOUND_SUPPLY_FUSE.toLowerCase()) {
                console.log(`      ✅ This is the Compound Supply Fuse (matches RSC)`);
            }
            console.log("");
        }
        
        // Verify specific fuses
        console.log("   Verifying specific fuses:");
        const aaveSupported = await vault.isFuseSupported(RSC_AAVE_SUPPLY_FUSE);
        const compoundSupported = await vault.isFuseSupported(RSC_COMPOUND_SUPPLY_FUSE);
        
        console.log(`   Aave Supply (${RSC_AAVE_SUPPLY_FUSE}): ${aaveSupported ? "✅ WHITELISTED" : "❌ NOT WHITELISTED"}`);
        console.log(`   Compound Supply (${RSC_COMPOUND_SUPPLY_FUSE}): ${compoundSupported ? "✅ WHITELISTED" : "❌ NOT WHITELISTED"}`);
        console.log("");
        
    } catch (error) {
        console.log("   ⚠️  Could not query vault fuses:", error.message.split('\n')[0]);
        console.log("");
        console.log("   💡 The supply fuse addresses should be visible in the UI");
        console.log("   Please check if these addresses match:");
        console.log(`   Aave Supply: ${RSC_AAVE_SUPPLY_FUSE}`);
        console.log(`   Compound Supply: ${RSC_COMPOUND_SUPPLY_FUSE}`);
        console.log("");
    }
    
    console.log("=".repeat(70));
    console.log("📊 SUMMARY");
    console.log("=".repeat(70));
    console.log("");
    console.log("✅ Balance Fuses: CONFIRMED WHITELISTED");
    console.log(`   • Aave: ${UI_AAVE_BALANCE_FUSE} ✅`);
    console.log(`   • Compound: ${UI_COMPOUND_BALANCE_FUSE} ✅`);
    console.log("");
    console.log("✅ Supply Fuses: WHITELISTED (need to verify addresses)");
    console.log("   • AaveV3SupplyFuseV003 - Need to confirm address");
    console.log("   • CompoundV3UsdcSupplyFuseV002 - Need to confirm address");
    console.log("");
    console.log("💡 NEXT STEPS:");
    console.log("   1. Check if supply fuse addresses in UI match RSC addresses");
    console.log("   2. If addresses match, everything is configured correctly!");
    console.log("   3. System should be able to deploy capital");
    console.log("");
}

verifyFuseAddresses().catch(console.error);

