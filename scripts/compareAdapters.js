const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function compareAdapters() {
    console.log("=".repeat(70));
    console.log("🔍 COMPARING OLD vs NEW ADAPTER");
    console.log("=".repeat(70));
    console.log("");
    
    const OLD_ADAPTER = "0xdBfd1ea4387352f2b98bC2d08B4Cd4B668C0860D";
    const NEW_ADAPTER = process.env.ADAPTER_ADDRESS || "0x58DB4C40CE50FEfAD8EEaA0B609e12dE21b18805";
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0xAC66a994B8BB8b4a9aC90830Ac72207Cd22e7f21";
    const TARGET_VAULT = process.env.TARGET_VAULT;
    const ARBITRUM_CHAIN_ID = process.env.ARBITRUM_CHAIN_ID || "42161";
    
    const provider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    const wallet = new ethers.Wallet(
        process.env.PRIVATE_KEY || process.env.ARBITRUM_PRIVATE_KEY,
        provider
    );
    
    // Try both function signatures
    const signatures = {
        "3 params (no description)": {
            selector: "0xef39a278",
            abi: "function registerCrossChainRSC(address rsc, address vault, uint256 targetChainId) external"
        },
        "4 params (with description)": {
            selector: "0x4f92037c",
            abi: "function registerCrossChainRSC(address rsc, address vault, uint256 targetChainId, string calldata description) external"
        }
    };
    
    console.log("1️⃣  Testing OLD Adapter Registration:");
    console.log("");
    
    for (const [name, sig] of Object.entries(signatures)) {
        console.log(`   Trying ${name}...`);
        try {
            const oldAdapter = new ethers.Contract(
                OLD_ADAPTER,
                [sig.abi, "function MANAGER_ROLE() external view returns (bytes32)", "function hasRole(bytes32 role, address account) external view returns (bool)"],
                wallet
            );
            
            const managerRole = await oldAdapter.MANAGER_ROLE();
            const hasRole = await oldAdapter.hasRole(managerRole, wallet.address);
            
            if (!hasRole) {
                console.log(`     ❌ No MANAGER_ROLE`);
                continue;
            }
            
            // Try static call
            const testParams = name.includes("4 params") 
                ? [RSC_ADDRESS, TARGET_VAULT, ARBITRUM_CHAIN_ID, "test"]
                : [RSC_ADDRESS, TARGET_VAULT, ARBITRUM_CHAIN_ID];
            
            await oldAdapter.callStatic['registerCrossChainRSC'](...testParams);
            console.log(`     ✅ Static call succeeded!`);
            console.log(`     ✅ OLD adapter supports: ${name}`);
            console.log("");
            
            // Try actual registration
            console.log(`     Attempting registration with ${name}...`);
            const tx = await oldAdapter['registerCrossChainRSC'](...testParams, { gasLimit: 300000 });
            console.log(`     Transaction: ${tx.hash}`);
            const receipt = await tx.wait();
            
            if (receipt.status === 1) {
                console.log(`     ✅ REGISTRATION SUCCESSFUL with ${name}!`);
                console.log(`     Gas used: ${receipt.gasUsed.toString()}`);
                console.log("");
                return; // Success!
            } else {
                console.log(`     ❌ Transaction failed`);
            }
            
        } catch (error) {
            if (error.message.includes('function') || error.message.includes('not found')) {
                console.log(`     ❌ Function not found`);
            } else {
                console.log(`     ❌ Error: ${error.message.split('\n')[0]}`);
            }
        }
    }
    
    console.log("");
    console.log("2️⃣  Testing NEW Adapter Registration:");
    console.log("");
    
    for (const [name, sig] of Object.entries(signatures)) {
        console.log(`   Trying ${name}...`);
        try {
            const newAdapter = new ethers.Contract(
                NEW_ADAPTER,
                [sig.abi, "function MANAGER_ROLE() external view returns (bytes32)", "function hasRole(bytes32 role, address account) external view returns (bool)"],
                wallet
            );
            
            const managerRole = await newAdapter.MANAGER_ROLE();
            const hasRole = await newAdapter.hasRole(managerRole, wallet.address);
            
            if (!hasRole) {
                console.log(`     ❌ No MANAGER_ROLE`);
                continue;
            }
            
            // Try static call
            const testParams = name.includes("4 params") 
                ? [RSC_ADDRESS, TARGET_VAULT, ARBITRUM_CHAIN_ID, "test"]
                : [RSC_ADDRESS, TARGET_VAULT, ARBITRUM_CHAIN_ID];
            
            await newAdapter.callStatic['registerCrossChainRSC'](...testParams);
            console.log(`     ✅ Static call succeeded!`);
            console.log(`     ✅ NEW adapter supports: ${name}`);
            console.log("");
            
        } catch (error) {
            if (error.message.includes('function') || error.message.includes('not found')) {
                console.log(`     ❌ Function not found`);
            } else {
                console.log(`     ❌ Error: ${error.message.split('\n')[0]}`);
            }
        }
    }
    
    console.log("");
    console.log("=".repeat(70));
    console.log("💡 SUMMARY");
    console.log("=".repeat(70));
    console.log("");
    console.log("Check which signature each adapter actually supports");
    console.log("and whether registration works on the OLD adapter");
}

compareAdapters().catch(console.error);

