const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Deploy adapter using standalone ethers (not Hardhat)
 */
async function main() {
    console.log("=".repeat(60));
    console.log("🔄 DEPLOYING ADAPTER WITH CROSS-CHAIN SUPPORT");
    console.log("=".repeat(60));
    console.log("");
    
    const ARBITRUM_RPC = process.env.ARBITRUM_RPC || process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
    const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.ARBITRUM_PRIVATE_KEY;
    
    if (!PRIVATE_KEY) {
        console.error("❌ PRIVATE_KEY not set in .env");
        process.exit(1);
    }
    
    const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    console.log("Deployer:", wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log("Balance:", ethers.utils.formatEther(balance), "ETH");
    console.log("");
    
    if (balance.lt(ethers.utils.parseEther("0.001"))) {
        console.error("❌ Insufficient balance for deployment");
        process.exit(1);
    }
    
    // Read compiled contract
    const fs = require('fs');
    const path = require('path');
    const artifactPath = path.join(__dirname, '..', 'artifacts', 'contracts', 'rsc', 'ReactiveAlphaAdapter.sol', 'ReactiveAlphaAdapter.json');
    
    if (!fs.existsSync(artifactPath)) {
        console.error("❌ Contract not compiled. Run: npx hardhat compile");
        process.exit(1);
    }
    
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    
    console.log("Deploying ReactiveAlphaAdapter...");
    console.log("Manager (will have MANAGER_ROLE):", wallet.address);
    console.log("");
    
    const adapter = await factory.deploy(wallet.address);
    console.log("Transaction hash:", adapter.deployTransaction.hash);
    console.log("Waiting for confirmation...");
    
    await adapter.deployed();
    const address = adapter.address;
    
    console.log("✅ Adapter deployed to:", address);
    console.log("");
    
    // Save deployment info
    const deploymentsPath = path.join(__dirname, '../deployment-addresses.json');
    let deployments = {};
    if (fs.existsSync(deploymentsPath)) {
        deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
    }
    deployments.ReactiveAlphaAdapter = address;
    fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
    
    console.log("📝 Deployment info saved to deployment-addresses.json");
    console.log("");
    
    console.log("=".repeat(60));
    console.log("✅ NEXT STEPS");
    console.log("=".repeat(60));
    console.log("");
    console.log("1. Update ADAPTER_ADDRESS in .env file:");
    console.log(`   ADAPTER_ADDRESS=${address}`);
    console.log("");
    console.log("2. Run registration:");
    console.log("   node scripts/registerCrossChainRSC.js");
    console.log("");
}

main().catch((e) => {
    console.error("❌ Deployment failed:", e.message);
    if (e.reason) console.error("   Reason:", e.reason);
    process.exit(1);
});

