const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function deployQueryHelper() {
    console.log("=".repeat(60));
    console.log("🚀 DEPLOYING QUERYHELPER CONTRACT TO ARBITRUM");
    console.log("=".repeat(60));
    console.log("");
    
    const ARBITRUM_RPC = process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc";
    const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.ARBITRUM_PRIVATE_KEY;
    
    if (!PRIVATE_KEY) {
        throw new Error("PRIVATE_KEY or ARBITRUM_PRIVATE_KEY must be set in .env");
    }
    
    const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    console.log("Configuration:");
    console.log(`  Deployer: ${wallet.address}`);
    console.log(`  Network: Arbitrum (42161)`);
    console.log("");
    
    // Check balance
    const balance = await provider.getBalance(wallet.address);
    const balanceEth = ethers.utils.formatEther(balance);
    console.log(`  Balance: ${balanceEth} ETH`);
    
    if (parseFloat(balanceEth) < 0.001) {
        console.log("\n  ⚠️  WARNING: Low balance! Need at least 0.001 ETH for deployment");
    }
    console.log("");
    
    // Load contract bytecode and ABI
    const contractPath = path.join(__dirname, '..', 'artifacts', 'contracts', 'QueryHelper.sol', 'QueryHelper.json');
    
    if (!fs.existsSync(contractPath)) {
        console.log("❌ Contract not compiled! Please run:");
        console.log("   npx hardhat compile");
        return;
    }
    
    const contractArtifact = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    const bytecode = contractArtifact.bytecode;
    const abi = contractArtifact.abi;
    
    console.log("=".repeat(60));
    console.log("📋 DEPLOYMENT DETAILS");
    console.log("=".repeat(60));
    console.log("");
    console.log("Contract: QueryHelper");
    console.log("Purpose: Query Compound V3 APY and emit response events");
    console.log("Constructor: No parameters (uses constant COMPOUND_USDC)");
    console.log("");
    
    // Create contract factory
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    
    console.log("Deploying contract...");
    console.log("-".repeat(60));
    
    try {
        // Deploy contract (no constructor parameters)
        const contract = await factory.deploy();
        
        console.log(`\n  Transaction hash: ${contract.deployTransaction.hash}`);
        console.log(`  Waiting for deployment...`);
        
        await contract.deployed();
        
        const deployAddress = contract.address;
        const txReceipt = await contract.deployTransaction.wait();
        
        console.log("\n" + "=".repeat(60));
        console.log("✅ DEPLOYMENT SUCCESSFUL");
        console.log("=".repeat(60));
        console.log(`\nContract Address: ${deployAddress}`);
        console.log(`Transaction Hash: ${contract.deployTransaction.hash}`);
        console.log(`Block: ${txReceipt.blockNumber}`);
        console.log(`Gas Used: ${txReceipt.gasUsed.toString()}`);
        console.log("");
        
        // Compute event topic
        const eventSignature = "CompoundApyQueried(uint256,uint256,uint256)";
        const topic0 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(eventSignature));
        
        console.log("📋 EVENT INFORMATION");
        console.log("-".repeat(60));
        console.log(`Event: CompoundApyQueried(uint256 indexed nonce, uint256 apyBps, uint256 timestamp)`);
        console.log(`Topic0: ${topic0}`);
        console.log("");
        console.log("💡 Use this topic0 to subscribe the RSC to QueryHelper events");
        console.log("");
        
        // Save deployment info
        try {
            const deploymentFile = path.join(__dirname, '..', 'deployment-addresses.json');
            let deployments = {};
            
            if (fs.existsSync(deploymentFile)) {
                deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
            }
            
            deployments.queryHelper = {
                address: deployAddress,
                txHash: contract.deployTransaction.hash,
                blockNumber: txReceipt.blockNumber,
                deployer: wallet.address,
                timestamp: new Date().toISOString(),
                eventTopic0: topic0,
                chain: "Arbitrum",
                chainId: 42161
            };
            
            fs.writeFileSync(deploymentFile, JSON.stringify(deployments, null, 2));
            console.log("📝 Deployment info saved to deployment-addresses.json");
        } catch (e) {
            console.log("⚠️  Could not save deployment info:", e.message);
        }
        console.log("");
        
        // Update .env file
        try {
            const envPath = path.join(__dirname, '..', '.env');
            if (fs.existsSync(envPath)) {
                let envContent = fs.readFileSync(envPath, 'utf8');
                
                // Update or add QUERY_HELPER_ADDRESS
                if (envContent.includes('QUERY_HELPER_ADDRESS=')) {
                    envContent = envContent.replace(
                        /QUERY_HELPER_ADDRESS=.*/,
                        `QUERY_HELPER_ADDRESS=${deployAddress}`
                    );
                } else {
                    envContent += `\nQUERY_HELPER_ADDRESS=${deployAddress}\n`;
                }
                
                // Add event topic
                if (envContent.includes('COMPOUND_APY_QUERIED_TOPIC=')) {
                    envContent = envContent.replace(
                        /COMPOUND_APY_QUERIED_TOPIC=.*/,
                        `COMPOUND_APY_QUERIED_TOPIC=${topic0}`
                    );
                } else {
                    envContent += `\nCOMPOUND_APY_QUERIED_TOPIC=${topic0}\n`;
                }
                
                fs.writeFileSync(envPath, envContent);
                console.log("✅ Updated .env with QUERY_HELPER_ADDRESS and COMPOUND_APY_QUERIED_TOPIC");
            } else {
                console.log("⚠️  .env file not found - please manually set:");
                console.log(`   QUERY_HELPER_ADDRESS=${deployAddress}`);
                console.log(`   COMPOUND_APY_QUERIED_TOPIC=${topic0}`);
            }
        } catch (e) {
            console.log("⚠️  Could not update .env:", e.message);
        }
        console.log("");
        
        // Test the contract
        console.log("=".repeat(60));
        console.log("🧪 TESTING CONTRACT");
        console.log("=".repeat(60));
        console.log("");
        
        try {
            const testContract = new ethers.Contract(deployAddress, abi, provider);
            const compoundApy = await testContract.getCompoundApy();
            const apyPercent = parseFloat(compoundApy.toString()) / 100;
            
            console.log(`✅ Contract working!`);
            console.log(`   Current Compound APY: ${apyPercent.toFixed(4)}%`);
            console.log(`   APY (bps): ${compoundApy.toString()}`);
        } catch (error) {
            console.log(`⚠️  Could not test contract: ${error.message}`);
            console.log(`   Contract deployed but test failed`);
        }
        console.log("");
        
        console.log("=".repeat(60));
        console.log("📋 NEXT STEPS");
        console.log("=".repeat(60));
        console.log("");
        console.log("1. Update RSC contract with QueryHelper address:");
        console.log(`   queryHelper = ${deployAddress}`);
        console.log("");
        console.log("2. Redeploy RSC with QueryHelper in constructor:");
        console.log(`   node scripts/deployFixedRSC.js`);
        console.log("");
        console.log("3. Subscribe RSC to QueryHelper events:");
        console.log(`   Topic0: ${topic0}`);
        console.log(`   node scripts/subscribeToQueryHelper.js`);
        console.log("");
        console.log("4. Unsubscribe from Compound AccrueInterest (per recommendation):");
        console.log(`   node scripts/unsubscribeFromCompound.js`);
        console.log("");
        console.log("🔗 View on Arbiscan:");
        console.log(`   https://arbiscan.io/address/${deployAddress}`);
        console.log("");
        console.log("=".repeat(60));
        
        return deployAddress;
        
    } catch (error) {
        console.log("\n❌ Deployment failed!");
        console.log(`Error: ${error.message}`);
        
        if (error.transaction) {
            console.log(`Transaction hash: ${error.transaction.hash}`);
        }
        
        throw error;
    }
}

deployQueryHelper().catch(console.error);

