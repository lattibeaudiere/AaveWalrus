const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function deployFixedRSC() {
    console.log("=".repeat(60));
    console.log("🚀 DEPLOYING FIXED RSC CONTRACT");
    console.log("=".repeat(60));
    console.log("");
    
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    const REACTIVE_PRIVATE_KEY = process.env.REACTIVE_PRIVATE_KEY || process.env.PRIVATE_KEY;
    const ADAPTER_ADDRESS = process.env.ADAPTER_ADDRESS;
    const SYSTEM_CONTRACT = "0x0000000000000000000000000000000000fffFfF";
    
    if (!REACTIVE_PRIVATE_KEY) {
        throw new Error("REACTIVE_PRIVATE_KEY must be set in .env");
    }
    
    if (!ADAPTER_ADDRESS) {
        throw new Error("ADAPTER_ADDRESS must be set in .env");
    }
    
    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    const wallet = new ethers.Wallet(REACTIVE_PRIVATE_KEY, provider);
    
    console.log("Configuration:");
    console.log(`  Deployer: ${wallet.address}`);
    console.log(`  Adapter: ${ADAPTER_ADDRESS}`);
    console.log(`  System Contract: ${SYSTEM_CONTRACT}`);
    console.log("");
    
    // Check balance
    const balance = await provider.getBalance(wallet.address);
    const balanceEth = ethers.utils.formatEther(balance);
    console.log(`  Balance: ${balanceEth} REACT`);
    
    if (parseFloat(balanceEth) < 0.01) {
        console.log("\n  ⚠️  WARNING: Low balance! Need at least 0.01 REACT for deployment");
    }
    console.log("");
    
    // Load contract bytecode and ABI
    const contractPath = path.join(__dirname, '..', 'reactive', 'out', 'FusionReactiveRSC.sol', 'FusionReactiveRSC.json');
    
    if (!fs.existsSync(contractPath)) {
        console.log("❌ Contract not compiled! Please run:");
        console.log("   cd reactive && forge build");
        return;
    }
    
    const contractArtifact = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    const bytecode = contractArtifact.bytecode.object;
    const abi = contractArtifact.abi;
    
    console.log("=".repeat(60));
    console.log("📋 DEPLOYMENT DETAILS");
    console.log("=".repeat(60));
    console.log("");
    console.log("Key Changes in This Version:");
    console.log("  ✅ Uses Callback event pattern for cross-chain execution");
    console.log("  ✅ Cannot directly call Arbitrum contracts - emits Callback instead");
    console.log("  ✅ Reactive Network will execute Callback on Arbitrum");
    console.log("");
    console.log("Constructor Parameters:");
    console.log(`  service: ${SYSTEM_CONTRACT}`);
    console.log(`  sequencer: 0x0000000000000000000000000000000000000000 (no restriction)`);
    console.log(`  adapter: ${ADAPTER_ADDRESS}`);
    console.log("");
    
    // Create contract factory
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    
    console.log("Deploying contract...");
    console.log("-".repeat(60));
    
    try {
        // Deploy contract
        const contract = await factory.deploy(
            SYSTEM_CONTRACT,     // service
            ethers.constants.AddressZero, // sequencer (no restriction)
            ADAPTER_ADDRESS     // adapter
        );
        
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
        
        // Save deployment info
        try {
            const deploymentInfo = {
                address: deployAddress,
                txHash: contract.deployTransaction.hash,
                blockNumber: txReceipt.blockNumber,
                deployer: wallet.address,
                adapter: ADAPTER_ADDRESS,
                timestamp: new Date().toISOString(),
                version: "fixed-callback-pattern",
                notes: "Fixed to use Callback event pattern for cross-chain execution"
            };
            
            const deploymentFile = path.join(__dirname, '..', 'deployment-addresses.json');
            let deployments = {};
            
            if (fs.existsSync(deploymentFile)) {
                try {
                    deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
                } catch (e) {
                    // File exists but is invalid JSON - create new
                    console.log("⚠️  Existing deployment file is invalid, creating new one");
                }
            }
            
            deployments.fusionReactiveRSC = deploymentInfo;
            if (deployments.fusionReactiveRSCPrevious) {
                // Keep previous for reference
            } else {
                deployments.fusionReactiveRSCPrevious = null;
            }
            
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
                
                // Update or add RSC_ADDRESS
                if (envContent.includes('RSC_ADDRESS=')) {
                    envContent = envContent.replace(
                        /RSC_ADDRESS=.*/,
                        `RSC_ADDRESS=${deployAddress}`
                    );
                } else {
                    envContent += `\nRSC_ADDRESS=${deployAddress}\n`;
                }
                
                fs.writeFileSync(envPath, envContent);
                console.log("✅ Updated .env with RSC_ADDRESS");
            } else {
                console.log("⚠️  .env file not found - please manually set:");
                console.log(`   RSC_ADDRESS=${deployAddress}`);
            }
        } catch (e) {
            console.log("⚠️  Could not update .env:", e.message);
            console.log("   Please manually set:");
            console.log(`   RSC_ADDRESS=${deployAddress}`);
        }
        console.log("");
        
        console.log("=".repeat(60));
        console.log("📋 NEXT STEPS");
        console.log("=".repeat(60));
        console.log("");
        console.log("1. Fund the contract:");
        console.log(`   node scripts/fundContract.js`);
        console.log("");
        console.log("2. Subscribe to Aave V3 events:");
        console.log(`   node scripts/subscribePostDeployment.js`);
        console.log("");
        console.log("3. Verify subscriptions:");
        console.log(`   node scripts/verifyNewRSCSubscriptions.js`);
        console.log("");
        console.log("4. Monitor for Callback events:");
        console.log(`   node scripts/testSubscriptionWithEvents.js`);
        console.log("");
        console.log("🔗 Reactscan:");
        console.log(`   https://reactscan.io/address/${deployAddress}`);
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

deployFixedRSC().catch(console.error);

