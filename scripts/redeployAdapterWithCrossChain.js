require("dotenv").config();
const { ethers } = require("hardhat");

async function main() {
    console.log("=".repeat(60));
    console.log("🔄 REDEPLOYING ADAPTER WITH CROSS-CHAIN SUPPORT");
    console.log("=".repeat(60));
    console.log("");

    const [deployer] = await ethers.getSigners();
    if (!deployer) {
        console.error("❌ No signer available. Check hardhat.config.js network settings.");
        process.exit(1);
    }

    console.log("Deployer:", deployer.address);
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Balance:", ethers.formatEther(balance), "ETH");
    console.log("Manager (will have MANAGER_ROLE):", deployer.address);
    console.log("");

    try {
        const FactoryTmp = await ethers.getContractFactory("ReactiveAlphaAdapter");
        const feeData = await ethers.provider.getFeeData();
        const deployTx = FactoryTmp.getDeployTransaction(deployer.address);
        console.log("FeeData maxFeePerGas:", feeData.maxFeePerGas?.toString() || "auto");
    } catch (e) {
        // ignore estimate errors; proceed with default deployment
    }

    const Factory = await ethers.getContractFactory("ReactiveAlphaAdapter", deployer);
    const adapter = await Factory.deploy(deployer.address);
    await adapter.waitForDeployment();
    const address = await adapter.getAddress();
    
    console.log("✅ Adapter deployed:", address);
    console.log("   Tx:", adapter.deploymentTransaction()?.hash || "");
    console.log("");

    // Save deployment info
    const fs = require('fs');
    const path = require('path');
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
    console.error("❌ Deployment failed:", e);
    process.exit(1);
});
