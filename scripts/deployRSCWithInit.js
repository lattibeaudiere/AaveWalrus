const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Deploy RSC using Foundry via command line
 * This script prepares the environment and calls forge script
 */
async function deployRSC() {
    console.log("=".repeat(70));
    console.log("🚀 DEPLOYING UPDATED RSC TO REACTIVE NETWORK");
    console.log("=".repeat(70));
    console.log("");
    
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://reactive-network.rpc.thirdweb.com";
    const REACTIVE_PRIVATE_KEY = process.env.REACTIVE_PRIVATE_KEY;
    const ADAPTER_ADDRESS = process.env.ADAPTER_ADDRESS;
    const QUERY_HELPER_ADDRESS = process.env.QUERY_HELPER_ADDRESS;
    const TARGET_VAULT = process.env.TARGET_VAULT;
    const REACTIVE_SERVICE = process.env.REACTIVE_SERVICE || "0x0000000000000000000000000000000000fffFfF";
    
    if (!REACTIVE_PRIVATE_KEY || !ADAPTER_ADDRESS || !QUERY_HELPER_ADDRESS || !TARGET_VAULT) {
        console.error("❌ ERROR: Missing required environment variables");
        console.error("   Required: REACTIVE_PRIVATE_KEY, ADAPTER_ADDRESS, QUERY_HELPER_ADDRESS, TARGET_VAULT");
        process.exit(1);
    }
    
    // Convert private key to uint256 format for Foundry (remove 0x if present)
    const privateKeyUint = REACTIVE_PRIVATE_KEY.startsWith('0x') 
        ? REACTIVE_PRIVATE_KEY.substring(2) 
        : REACTIVE_PRIVATE_KEY;
    
    console.log("Configuration:");
    console.log(`  Adapter: ${ADAPTER_ADDRESS}`);
    console.log(`  QueryHelper: ${QUERY_HELPER_ADDRESS}`);
    console.log(`  Vault: ${TARGET_VAULT}`);
    console.log(`  Service: ${REACTIVE_SERVICE}`);
    console.log("");
    
    console.log("⚠️  NOTE: Deployment will be done via Foundry forge script");
    console.log("   This requires Foundry to be installed");
    console.log("");
    
    // Build forge command
    const path = require('path');
    const { execSync } = require('child_process');
    
    const reactiveDir = path.join(__dirname, '..', 'reactive');
    
    // Set environment variables for forge
    process.env.REACTIVE_SERVICE = REACTIVE_SERVICE;
    process.env.ADAPTER_ADDRESS = ADAPTER_ADDRESS;
    process.env.QUERY_HELPER_ADDRESS = QUERY_HELPER_ADDRESS;
    process.env.TARGET_VAULT = TARGET_VAULT;
    
    console.log("Running forge script...");
    console.log("");
    
    try {
        const command = `forge script script/DeployRSC.s.sol:DeployRSC --rpc-url ${REACTIVE_RPC} --broadcast --private-key ${privateKeyUint}`;
        
        console.log("Command:", command.replace(privateKeyUint, '[PRIVATE_KEY]'));
        console.log("");
        
        const output = execSync(command, {
            cwd: reactiveDir,
            env: { ...process.env },
            encoding: 'utf8',
            stdio: 'inherit'
        });
        
        console.log(output);
        console.log("✅ RSC deployed successfully!");
        
    } catch (error) {
        console.error("❌ Deployment failed!");
        console.error(error.message);
        
        if (error.stdout) console.log("STDOUT:", error.stdout);
        if (error.stderr) console.log("STDERR:", error.stderr);
        
        process.exit(1);
    }
    
    console.log("");
    console.log("=".repeat(70));
}

deployRSC().catch(console.error);

