const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Deploy RSC to Reactive Network with all required addresses
 * 
 * NOTE: This is a helper script. Actual deployment should use Foundry
 * since RSC deploys to Reactive Network (chain 1597), not Arbitrum.
 * 
 * This script prepares the deployment parameters.
 */
async function main() {
    console.log("=".repeat(60));
    console.log("RSC DEPLOYMENT PREPARATION");
    console.log("=".repeat(60));
    console.log("");
    
    const VAULT_ADDRESS = process.env.TARGET_VAULT;
    const ADAPTER_ADDRESS = process.env.ADAPTER_ADDRESS;
    const QUERY_HELPER_ADDRESS = process.env.QUERY_HELPER_ADDRESS;
    const REACTIVE_SERVICE = process.env.REACTIVE_SERVICE || "0x0000000000000000000000000000000000fffFfF";
    
    if (!VAULT_ADDRESS || VAULT_ADDRESS === "0x0000000000000000000000000000000000000000") {
        throw new Error("TARGET_VAULT must be set in .env");
    }
    
    if (!ADAPTER_ADDRESS || ADAPTER_ADDRESS === "0x0000000000000000000000000000000000000000") {
        throw new Error("ADAPTER_ADDRESS must be set in .env");
    }
    
    if (!QUERY_HELPER_ADDRESS || QUERY_HELPER_ADDRESS === "0x0000000000000000000000000000000000000000") {
        throw new Error("QUERY_HELPER_ADDRESS must be set in .env (deploy QueryHelper first)");
    }
    
    console.log("Deployment Parameters:");
    console.log(`  Vault: ${VAULT_ADDRESS}`);
    console.log(`  Adapter: ${ADAPTER_ADDRESS}`);
    console.log(`  QueryHelper: ${QUERY_HELPER_ADDRESS}`);
    console.log(`  Reactive Service: ${REACTIVE_SERVICE}`);
    console.log(`  Sequencer: address(0) (open)`);
    console.log("");
    
    console.log("=".repeat(60));
    console.log("DEPLOYMENT COMMAND");
    console.log("=".repeat(60));
    console.log("");
    console.log("Deploy using Foundry (Reactive Network):");
    console.log("");
    console.log(`cd reactive`);
    console.log(`forge script script/DeployRSC.s.sol:DeployRSC \\`);
    console.log(`  --rpc-url \$REACTIVE_RPC \\`);
    console.log(`  --broadcast \\`);
    console.log(`  --private-key \$REACTIVE_PRIVATE_KEY \\`);
    console.log(`  --constructor-args \\`);
    console.log(`    ${REACTIVE_SERVICE} \\`);
    console.log(`    address(0) \\`);
    console.log(`    ${ADAPTER_ADDRESS} \\`);
    console.log(`    ${QUERY_HELPER_ADDRESS} \\`);
    console.log(`    ${VAULT_ADDRESS}`);
    console.log("");
    console.log("Or update reactive/script/DeployRSC.s.sol with:");
    console.log(`  - adapter: ${ADAPTER_ADDRESS}`);
    console.log(`  - queryHelper: ${QUERY_HELPER_ADDRESS}`);
    console.log(`  - vault: ${VAULT_ADDRESS}`);
    console.log("");
    
    // Save to deployment config
    const config = {
        vault: VAULT_ADDRESS,
        adapter: ADAPTER_ADDRESS,
        queryHelper: QUERY_HELPER_ADDRESS,
        reactiveService: REACTIVE_SERVICE,
        sequencer: "0x0000000000000000000000000000000000000000",
        timestamp: new Date().toISOString()
    };
    
    const configPath = path.join(__dirname, '..', 'rsc-deployment-config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    console.log(`✅ Configuration saved to: ${configPath}`);
    console.log("");
    console.log("=".repeat(60));
    console.log("NEXT STEPS");
    console.log("=".repeat(60));
    console.log("");
    console.log("1. Update reactive/script/DeployRSC.s.sol with these addresses");
    console.log("2. Run Foundry deployment script");
    console.log("3. Fund RSC after deployment");
    console.log("4. Subscribe to QueryHelper events");
    console.log("");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

