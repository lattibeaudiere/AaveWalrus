const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function deployQueryHelper() {
    console.log("=".repeat(70));
    console.log("🚀 DEPLOYING UPDATED QUERYHELPER");
    console.log("=".repeat(70));
    console.log("");
    
    const ARBITRUM_RPC = process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc";
    const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.ARBITRUM_PRIVATE_KEY;
    
    if (!PRIVATE_KEY) {
        console.error("❌ ERROR: PRIVATE_KEY or ARBITRUM_PRIVATE_KEY must be set in .env");
        process.exit(1);
    }
    
    const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    console.log("Network: Arbitrum");
    console.log("Deployer:", wallet.address);
    console.log("");
    
    // Check balance
    const balance = await provider.getBalance(wallet.address);
    const balanceEth = ethers.utils.formatEther(balance);
    console.log(`Balance: ${balanceEth} ETH`);
    
    if (balance.lt(ethers.utils.parseEther("0.001"))) {
        console.error("❌ ERROR: Insufficient balance (need at least 0.001 ETH)");
        process.exit(1);
    }
    
    if (balance.lt(ethers.utils.parseEther("0.01"))) {
        console.log("⚠️  WARNING: Low balance - deployment may fail if gas is too high");
    }
    console.log("");
    
    // Compile and deploy
    const fs = require('fs');
    const path = require('path');
    const hre = require('hardhat');
    
    console.log("Deploying QueryHelper...");
    
    const QueryHelper = await hre.ethers.getContractFactory("QueryHelper");
    const deployTx = await QueryHelper.getDeployTransaction();
    
    console.log("Estimating gas...");
    const gasEstimate = await provider.estimateGas(deployTx);
    const gasPrice = await provider.getGasPrice();
    const deploymentCost = gasEstimate.mul(gasPrice);
    
    console.log(`   Gas estimate: ${gasEstimate.toString()}`);
    console.log(`   Estimated cost: ${ethers.utils.formatEther(deploymentCost)} ETH`);
    console.log("");
    
    if (balance.lt(deploymentCost.mul(110).div(100))) {
        console.error("❌ ERROR: Insufficient balance for deployment");
        console.error(`   Need: ${ethers.utils.formatEther(deploymentCost)} ETH`);
        console.error(`   Have: ${balanceEth} ETH`);
        process.exit(1);
    }
    
    const queryHelper = await QueryHelper.deploy();
    const deployTxHash = queryHelper.deployTransaction?.hash || queryHelper.deployTransaction;
    
    console.log("Transaction:", deployTxHash);
    console.log("Waiting for confirmation...");
    
    const receipt = await queryHelper.deployed();
    
    console.log("");
    console.log("✅ QUERYHELPER DEPLOYED!");
    console.log("   Address:", queryHelper.address);
    console.log("   Block:", receipt.deployTransaction?.blockNumber || 'pending');
    console.log("");
    
    // Verify functions
    console.log("Verifying functions...");
    const hasQueryBothApys = await queryHelper.queryBothApys(ethers.BigNumber.from("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")).catch(() => null);
    
    if (hasQueryBothApys !== null) {
        console.log("   ✅ queryBothApys() function verified");
    } else {
        console.log("   ⚠️  queryBothApys() may not be accessible yet");
    }
    
    // Save deployment info
    const deploymentsPath = path.join(__dirname, '..', 'deployment-addresses.json');
    let deployments = {};
    
    if (fs.existsSync(deploymentsPath)) {
        deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
    }
    
    deployments.queryHelper = {
        address: queryHelper.address,
        txHash: queryHelper.deployTransaction.hash,
        blockNumber: queryHelper.deployTransaction.blockNumber || 'pending',
        deployer: wallet.address,
        timestamp: new Date().toISOString(),
        chain: "Arbitrum",
        chainId: 42161,
        version: "with-initialization-support"
    };
    
    fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
    console.log("");
    console.log("📝 Deployment info saved to deployment-addresses.json");
    console.log("");
    console.log("=".repeat(70));
    console.log("📋 NEXT STEPS");
    console.log("=".repeat(70));
    console.log("");
    console.log("1. Update .env with new QueryHelper address:");
    console.log(`   QUERY_HELPER_ADDRESS=${queryHelper.address}`);
    console.log("");
    console.log("2. Deploy updated RSC");
    console.log("3. Subscribe to BothApysQueried events");
    console.log("4. Call initializeStrategy()");
    console.log("");
    
    return queryHelper.address;
}

deployQueryHelper().catch(console.error);

