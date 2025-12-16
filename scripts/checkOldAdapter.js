const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkOldAdapter() {
    console.log("=".repeat(70));
    console.log("🔍 ANALYZING OLD ADAPTER");
    console.log("=".repeat(70));
    console.log("");
    
    const OLD_ADAPTER = "0xdBfd1ea4387352f2b98bC2d08B4Cd4B668C0860D";
    const NEW_ADAPTER = "0x58DB4C40CE50FEfAD8EEaA0B609e12dE21b18805";
    
    const provider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    const wallet = new ethers.Wallet(
        process.env.PRIVATE_KEY || process.env.ARBITRUM_PRIVATE_KEY,
        provider
    );
    
    console.log("1️⃣  Checking OLD Adapter:");
    console.log("   Address:", OLD_ADAPTER);
    console.log("");
    
    // Check if old adapter exists and what functions it has
    const oldAdapterCode = await provider.getCode(OLD_ADAPTER);
    
    if (oldAdapterCode === "0x") {
        console.log("   ❌ Old adapter doesn't exist (no code)");
    } else {
        console.log("   ✅ Old adapter exists");
        console.log("   Code size:", oldAdapterCode.length / 2 - 1, "bytes");
        console.log("");
        
        // Try to call functions
        try {
            const oldAdapter = new ethers.Contract(
                OLD_ADAPTER,
                [
                    "function registerCrossChainRSC(address rsc, address vault, uint256 targetChainId, string calldata description) external",
                    "function registerCrossChainRSC(address rsc, address vault, uint256 targetChainId) external",
                    "function registerRSC(address rsc, string calldata description) external",
                    "function isRSCRegistered(address rsc) external view returns (bool)",
                    "function MANAGER_ROLE() external view returns (bytes32)",
                    "function hasRole(bytes32 role, address account) external view returns (bool)"
                ],
                wallet
            );
            
            const managerRole = await oldAdapter.MANAGER_ROLE();
            const hasRole = await oldAdapter.hasRole(managerRole, wallet.address);
            
            console.log("   MANAGER_ROLE check:");
            console.log("     Has role:", hasRole ? "✅" : "❌");
            console.log("");
            
            // Check if any RSCs are registered
            console.log("   Checking for registered RSCs...");
            // We can't easily iterate, but we can check known RSC addresses
            const knownRSCs = [
                "0xEFD20dC51F7c82B7430490Bf45767bA57F6819fc",
                "0x15725e58A3199122FcBb4d6F20573EEFd730781A",
                "0x64030389Fb91D86F92314503aAe57827826c8F4e"
            ];
            
            for (const rsc of knownRSCs) {
                try {
                    const isReg = await oldAdapter.isRSCRegistered(rsc);
                    if (isReg) {
                        console.log(`     ✅ ${rsc.substring(0, 10)}... is registered`);
                        const config = await oldAdapter.rscConfigs(rsc);
                        console.log(`        Vault: ${config.vault}`);
                        console.log(`        Active: ${config.isActive}`);
                    }
                } catch (e) {
                    // Skip if function doesn't exist or other error
                }
            }
            
        } catch (error) {
            console.log("   ⚠️  Could not interact with old adapter:");
            console.log("     Error:", error.message.split('\n')[0]);
        }
    }
    
    console.log("");
    console.log("2️⃣  Comparing OLD vs NEW Adapter Function Signatures:");
    console.log("");
    
    // Try to determine function signature
    const functionSelectors = {
        "registerCrossChainRSC(address,address,uint256)": "0xef39a278",
        "registerCrossChainRSC(address,address,uint256,string)": "0x4f92037c"
    };
    
    console.log("   Old adapter might use:");
    console.log("     • 3 params:", functionSelectors["registerCrossChainRSC(address,address,uint256)"]);
    console.log("     • 4 params:", functionSelectors["registerCrossChainRSC(address,address,uint256,string)"]);
    console.log("");
    
    console.log("3️⃣  Checking Registration Script:");
    const fs = require('fs');
    const path = require('path');
    const regScript = path.join(__dirname, 'registerCrossChainRSC.js');
    
    if (fs.existsSync(regScript)) {
        const scriptContent = fs.readFileSync(regScript, 'utf8');
        
        if (scriptContent.includes('registerCrossChainRSC(address rsc, address vault, uint256 targetChainId, string calldata description)')) {
            console.log("   ✅ Script uses 4-parameter version (with description)");
            console.log("   This matches the source code signature");
        } else if (scriptContent.includes('registerCrossChainRSC(address rsc, address vault, uint256 targetChainId)')) {
            console.log("   ⚠️  Script uses 3-parameter version (no description)");
            console.log("   This doesn't match source code");
        }
    }
    
    console.log("");
    console.log("=".repeat(70));
    console.log("💡 FINDINGS");
    console.log("=".repeat(70));
    console.log("");
    console.log("The old adapter may have:");
    console.log("  1. Different function signature (3 vs 4 params)");
    console.log("  2. Different access control implementation");
    console.log("  3. Different deployment configuration");
    console.log("");
    console.log("Next: Check if old adapter can actually register RSCs");
    console.log("      to understand what worked before");
}

checkOldAdapter().catch(console.error);

