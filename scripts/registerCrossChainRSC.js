const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Register RSC with explicit parameters (for cross-chain RSCs)
 */
async function registerCrossChainRSC() {
    console.log("=".repeat(60));
    console.log("🔧 REGISTERING CROSS-CHAIN RSC");
    console.log("=".repeat(60));
    console.log("");
    
    const ARBITRUM_RPC = process.env.ARBITRUM_RPC || process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
    const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.ARBITRUM_PRIVATE_KEY;
    // Use deployment-addresses.json if available, otherwise .env
    const fs = require('fs');
    const path = require('path');
    const deploymentsPath = path.join(__dirname, '../deployment-addresses.json');
    let adapterAddress = process.env.ADAPTER_ADDRESS || "0xdBfd1ea4387352f2b98bC2d08B4Cd4B668C0860D";
    
    if (fs.existsSync(deploymentsPath)) {
        const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
        if (deployments.ReactiveAlphaAdapter) {
            adapterAddress = deployments.ReactiveAlphaAdapter;
            console.log("📋 Using adapter from deployment-addresses.json");
        }
    }
    
    const ADAPTER_ADDRESS = adapterAddress;
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0x15725e58A3199122FcBb4d6F20573EEFd730781A";
    const VAULT_ADDRESS = process.env.TARGET_VAULT || "0xee29A26179fE20D5D202dAE4a279119E08edc60b";
    const ARBITRUM_CHAIN_ID = process.env.ARBITRUM_CHAIN_ID ? parseInt(process.env.ARBITRUM_CHAIN_ID) : 42161;
    
    const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    console.log("Configuration:");
    console.log(`  Adapter: ${ADAPTER_ADDRESS}`);
    console.log(`  RSC (Reactive Network): ${RSC_ADDRESS}`);
    console.log(`  Vault (Arbitrum): ${VAULT_ADDRESS}`);
    console.log(`  Target Chain ID: ${ARBITRUM_CHAIN_ID}`);
    console.log(`  Signer: ${wallet.address}`);
    console.log("");
    
    const adapterABI = [
        "function registerCrossChainRSC(address rsc, address vault, uint256 targetChainId, string calldata description) external",
        "function isRSCRegistered(address) view returns (bool)",
        "function getRSCConfig(address) view returns (tuple(address vault, uint256 targetChainId, bool isActive, uint256 lastExecution, uint256 executionCount))",
        "function MANAGER_ROLE() view returns (bytes32)",
        "function hasRole(bytes32 role, address account) view returns (bool)",
        "event RSCRegistered(address indexed rsc, address indexed vault, string description)"
    ];
    
    const adapter = new ethers.Contract(ADAPTER_ADDRESS, adapterABI, wallet);
    
    try {
        // Check permissions
        const managerRole = await adapter.MANAGER_ROLE();
        const hasManagerRole = await adapter.hasRole(managerRole, wallet.address);
        
        if (!hasManagerRole) {
            console.error("❌ ERROR: Signer does not have MANAGER_ROLE");
            console.error("   Cannot register RSC");
            process.exit(1);
        }
        
        console.log("✅ Signer has MANAGER_ROLE");
        console.log("");
        
        // Check if already registered
        const isRegistered = await adapter.isRSCRegistered(RSC_ADDRESS);
        if (isRegistered) {
            console.log("⚠️  RSC is already registered");
            console.log("");
            
            // Show current config
            const config = await adapter.getRSCConfig(RSC_ADDRESS);
            console.log("Current Configuration:");
            console.log(`  Vault: ${config.vault}`);
            console.log(`  Chain ID: ${config.targetChainId.toString()}`);
            console.log(`  Active: ${config.isActive}`);
            console.log(`  Executions: ${config.executionCount.toString()}`);
            console.log("");
            
            console.log("✅ RSC is already registered - no action needed");
            return;
        }
        
        console.log("Registering RSC with explicit parameters...");
        console.log("");
        
        const description = "IPOR Fusion Yield Optimizer - Autonomous Aave/Compound APY Optimizer";
        
        const tx = await adapter.registerCrossChainRSC(
            RSC_ADDRESS,
            VAULT_ADDRESS,
            ARBITRUM_CHAIN_ID,
            description,
            { gasLimit: 300000 }
        );
        
        console.log(`Transaction hash: ${tx.hash}`);
        console.log("Waiting for confirmation...");
        console.log("");
        
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
            console.log("✅ REGISTRATION SUCCESSFUL!");
            console.log(`Block: ${receipt.blockNumber}`);
            console.log(`Gas used: ${receipt.gasUsed.toString()}`);
            console.log("");
            
            // Check for RSCRegistered event
            const event = receipt.logs.find(log => {
                try {
                    const parsed = adapter.interface.parseLog(log);
                    return parsed.name === 'RSCRegistered';
                } catch {
                    return false;
                }
            });
            
            if (event) {
                const parsed = adapter.interface.parseLog(event);
                console.log("📋 RSCRegistered Event:");
                console.log(`  RSC: ${parsed.args.rsc}`);
                console.log(`  Vault: ${parsed.args.vault}`);
                console.log(`  Description: ${parsed.args.description}`);
            }
            
            console.log("");
            console.log("=".repeat(60));
            console.log("✅ VERIFICATION");
            console.log("=".repeat(60));
            console.log("");
            
            // Verify registration
            const config = await adapter.getRSCConfig(RSC_ADDRESS);
            console.log("Registered Configuration:");
            console.log(`  Vault: ${config.vault}`);
            console.log(`  Chain ID: ${config.targetChainId.toString()}`);
            console.log(`  Active: ${config.isActive ? '✅ Yes' : '❌ No'}`);
            console.log(`  Executions: ${config.executionCount.toString()}`);
            console.log("");
            
            const verified = await adapter.isRSCRegistered(RSC_ADDRESS);
            console.log(`Is Registered: ${verified ? '✅ Yes' : '❌ No'}`);
            console.log("");
            
            if (verified && config.vault.toLowerCase() === VAULT_ADDRESS.toLowerCase()) {
                console.log("🎉 RSC successfully registered!");
                console.log("   The adapter will now accept callbacks from this RSC");
                console.log("");
            }
            
        } else {
            console.error("❌ Registration failed (transaction reverted)");
            process.exit(1);
        }
        
    } catch (error) {
        console.error("❌ Error during registration:", error.message);
        
        if (error.reason) {
            console.error("   Reason:", error.reason);
        }
        
        if (error.code === 'CALL_EXCEPTION' && error.data) {
            console.error("   Error data:", error.data);
        }
        
        // Check if function exists
        if (error.message.includes('function') && error.message.includes('not found')) {
            console.error("");
            console.error("⚠️  The adapter contract doesn't have registerCrossChainRSC()");
            console.error("   The adapter needs to be updated with the new function");
            console.error("   Or the adapter needs to be redeployed with cross-chain support");
        }
        
        process.exit(1);
    }
}

registerCrossChainRSC().catch(console.error);

