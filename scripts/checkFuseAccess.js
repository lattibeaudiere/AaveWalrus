const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkFuseAccess() {
    console.log("=".repeat(70));
    console.log("🔍 CHECKING FUSE ACCESS & WHITELISTING");
    console.log("=".repeat(70));
    console.log("");
    
    const VAULT = process.env.TARGET_VAULT || "0xee29A26179fE20D5D202dAE4a279119E08edc60b";
    const ADAPTER = process.env.ADAPTER_ADDRESS || "0x58DB4C40CE50FEfAD8EEaA0B609e12dE21b18805";
    const RSC_ADDRESS = "0xf64afe64622CeAe79d48A15ebC49CC7FF416c688";
    
    // Known fuse addresses from documentation
    const AAVE_SUPPLY_FUSE = "0x304756cD719382281fBD640f5F7932465eD663D6";
    const AAVE_BALANCE_FUSE = "0x4CB1c4774BA1B65802c68Adb33DE99ABf8B21228";
    const COMPOUND_SUPPLY_FUSE = "0xB0b3dc1B27C6c8007c9B01a768d6717f6813fE94";
    const COMPOUND_BALANCE_FUSE = "0xCF730BAA5542DC7570907696271bA96019FcD10C";
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://reactive-network.rpc.thirdweb.com"
    );
    
    console.log("1️⃣  Checking Fuse Addresses in RSC:");
    console.log("");
    
    const rscAbi = [
        "function AAVE_SUPPLY_FUSE() external view returns (address)",
        "function COMPOUND_SUPPLY_FUSE() external view returns (address)"
    ];
    
    try {
        const rsc = new ethers.Contract(RSC_ADDRESS, rscAbi, reactiveProvider);
        
        const rscAaveFuse = await rsc.AAVE_SUPPLY_FUSE();
        const rscCompoundFuse = await rsc.COMPOUND_SUPPLY_FUSE();
        
        console.log(`   RSC Aave Fuse: ${rscAaveFuse}`);
        console.log(`   Expected: ${AAVE_SUPPLY_FUSE}`);
        console.log(`   Match: ${rscAaveFuse.toLowerCase() === AAVE_SUPPLY_FUSE.toLowerCase() ? "✅" : "❌"}`);
        console.log("");
        
        console.log(`   RSC Compound Fuse: ${rscCompoundFuse}`);
        console.log(`   Expected: ${COMPOUND_SUPPLY_FUSE}`);
        console.log(`   Match: ${rscCompoundFuse.toLowerCase() === COMPOUND_SUPPLY_FUSE.toLowerCase() ? "✅" : "❌"}`);
        console.log("");
        
    } catch (error) {
        console.log("   ❌ Error checking RSC:", error.message.split('\n')[0]);
        console.log("");
    }
    
    console.log("2️⃣  Verifying Fuse Contracts Exist:");
    console.log("");
    
    const fuses = [
        ["Aave Supply", AAVE_SUPPLY_FUSE],
        ["Aave Balance", AAVE_BALANCE_FUSE],
        ["Compound Supply", COMPOUND_SUPPLY_FUSE],
        ["Compound Balance", COMPOUND_BALANCE_FUSE]
    ];
    
    for (const [name, address] of fuses) {
        try {
            const code = await arbitrumProvider.getCode(address);
            const exists = code !== "0x";
            console.log(`   ${name}: ${exists ? "✅ Exists" : "❌ Not found"}`);
            if (exists) {
                console.log(`     Code size: ${code.length / 2 - 1} bytes`);
            }
        } catch (error) {
            console.log(`   ${name}: ❌ Error checking`);
        }
    }
    console.log("");
    
    console.log("3️⃣  Checking Vault Access:");
    console.log("");
    
    // Try to get vault's access manager interface
    const vaultAbi = [
        "function hasRole(bytes32 role, address account) external view returns (bool)",
        "function ALPHA_ROLE() external view returns (bytes32)"
    ];
    
    try {
        const vault = new ethers.Contract(VAULT, vaultAbi, arbitrumProvider);
        
        const alphaRole = await vault.ALPHA_ROLE();
        const adapterHasAlpha = await vault.hasRole(alphaRole, ADAPTER);
        
        console.log(`   Adapter: ${ADAPTER}`);
        console.log(`   Has ALPHA_ROLE: ${adapterHasAlpha ? "✅ YES" : "❌ NO"}`);
        console.log("");
        
        if (!adapterHasAlpha) {
            console.log("   ⚠️  CRITICAL: Adapter doesn't have ALPHA_ROLE!");
            console.log("   Funds cannot be deployed without this role");
            console.log("");
        }
        
    } catch (error) {
        console.log("   ⚠️  Could not check vault roles:", error.message.split('\n')[0]);
        console.log("");
    }
    
    console.log("4️⃣  Checking Fuse Whitelisting (if vault exposes fuse list):");
    console.log("");
    
    // Some vaults expose fuse whitelist - try common patterns
    const whitelistAbis = [
        "function isFuseWhitelisted(address fuse) external view returns (bool)",
        "function getFuseList() external view returns (address[] memory)",
        "function whitelistedFuses(address fuse) external view returns (bool)"
    ];
    
    for (const abi of whitelistAbis) {
        try {
            const testContract = new ethers.Contract(VAULT, [abi], arbitrumProvider);
            
            if (abi.includes("isFuseWhitelisted")) {
                const aaveWhitelisted = await testContract.isFuseWhitelisted(AAVE_SUPPLY_FUSE);
                const compoundWhitelisted = await testContract.isFuseWhitelisted(COMPOUND_SUPPLY_FUSE);
                
                console.log(`   Aave Supply Fuse whitelisted: ${aaveWhitelisted ? "✅" : "❌"}`);
                console.log(`   Compound Supply Fuse whitelisted: ${compoundWhitelisted ? "✅" : "❌"}`);
                console.log("");
                break;
            } else if (abi.includes("getFuseList")) {
                const fuseList = await testContract.getFuseList();
                console.log(`   Found ${fuseList.length} whitelisted fuses`);
                const aaveInList = fuseList.some(f => f.toLowerCase() === AAVE_SUPPLY_FUSE.toLowerCase());
                const compoundInList = fuseList.some(f => f.toLowerCase() === COMPOUND_SUPPLY_FUSE.toLowerCase());
                console.log(`   Aave Supply Fuse: ${aaveInList ? "✅" : "❌"}`);
                console.log(`   Compound Supply Fuse: ${compoundInList ? "✅" : "❌"}`);
                console.log("");
                break;
            }
        } catch (error) {
            // Try next ABI
        }
    }
    
    console.log("=".repeat(70));
    console.log("📊 SUMMARY");
    console.log("=".repeat(70));
    console.log("");
    console.log("Fuse Addresses (from docs):");
    console.log(`  Aave Supply: ${AAVE_SUPPLY_FUSE}`);
    console.log(`  Compound Supply: ${COMPOUND_SUPPLY_FUSE}`);
    console.log("");
    console.log("⚠️  IMPORTANT:");
    console.log("  1. Fuses must be whitelisted on your vault");
    console.log("  2. Adapter must have ALPHA_ROLE");
    console.log("  3. Fuse addresses in RSC must match whitelisted fuses");
    console.log("");
    console.log("If fuses are NOT whitelisted, capital cannot be deployed!");
    console.log("Check vault UI or contact IPOR support to whitelist fuses.");
    console.log("");
}

checkFuseAccess().catch(console.error);

