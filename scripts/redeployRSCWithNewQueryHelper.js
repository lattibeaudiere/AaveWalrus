const { exec } = require('child_process');
const path = require('path');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function redeployRSC() {
    console.log("=".repeat(70));
    console.log("🚀 REDEPLOYING RSC WITH NEW QUERYHELPER");
    console.log("=".repeat(70));
    console.log("");
    
    const NEW_QUERY_HELPER = process.env.QUERY_HELPER_ADDRESS || "0x55f03641265a793112bd1D9480C4Ea4f143E06af";
    const ADAPTER = process.env.ADAPTER_ADDRESS;
    const VAULT = process.env.TARGET_VAULT;
    const REACTIVE_PRIVATE_KEY = process.env.REACTIVE_PRIVATE_KEY;
    
    console.log("Configuration:");
    console.log(`  New QueryHelper: ${NEW_QUERY_HELPER}`);
    console.log(`  Adapter: ${ADAPTER}`);
    console.log(`  Vault: ${VAULT}`);
    console.log("");
    
    if (!ADAPTER || !VAULT || !REACTIVE_PRIVATE_KEY) {
        console.log("❌ Missing required environment variables:");
        if (!ADAPTER) console.log("   - ADAPTER_ADDRESS");
        if (!VAULT) console.log("   - TARGET_VAULT");
        if (!REACTIVE_PRIVATE_KEY) console.log("   - REACTIVE_PRIVATE_KEY");
        return;
    }
    
    console.log("⚠️  IMPORTANT: Redeploying RSC will:");
    console.log("   1. Create a NEW RSC contract address");
    console.log("   2. Require funding with REACT tokens");
    console.log("   3. Require re-subscribing to all events");
    console.log("   4. Require re-initialization");
    console.log("");
    console.log("Continuing with deployment...");
    console.log("");
    
    // Deploy using Foundry
    const reactiveDir = path.join(__dirname, '..', 'reactive');
    const command = `cd "${reactiveDir}" && forge script script/DeployRSC.s.sol:DeployRSC --rpc-url ${process.env.REACTIVE_RPC || "https://reactive-network.rpc.thirdweb.com"} --broadcast --private-key ${REACTIVE_PRIVATE_KEY} -vvv`;
    
    console.log("Running deployment command...");
    console.log("");
    
    exec(command, { cwd: reactiveDir }, (error, stdout, stderr) => {
        if (error) {
            console.log(`❌ Deployment error: ${error.message}`);
            return;
        }
        
        console.log(stdout);
        if (stderr) {
            console.log("Errors/Warnings:");
            console.log(stderr);
        }
    });
}

redeployRSC().catch(console.error);

