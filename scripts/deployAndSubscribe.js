const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function deployAndSubscribe() {
    console.log("🚀 Deploying Fixed RSC Contract and Subscribing...\n");
    console.log("This will:");
    console.log("1. Deploy the fixed contract (without try-catch)");
    console.log("2. Fund it");
    console.log("3. Subscribe to Aave V3");
    console.log("4. Subscribe to Compound V3");
    console.log("");
    
    // You'll need to manually deploy first, then update the script with the address
    console.log("⚠️  Please deploy the contract first using:");
    console.log("   cd reactive");
    console.log("   forge script script/DeployRSC.s.sol --rpc-url https://mainnet-rpc.rnk.dev --private-key $env:REACTIVE_PRIVATE_KEY --broadcast");
    console.log("");
    console.log("Then update this script with the new contract address and run it again.");
}

deployAndSubscribe().catch(console.error);

