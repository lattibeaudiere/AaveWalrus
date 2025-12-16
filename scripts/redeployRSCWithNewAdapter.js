const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function redeployRSC() {
    console.log("=".repeat(70));
    console.log("🔄 REDEPLOYING RSC WITH NEW ADAPTER");
    console.log("=".repeat(70));
    console.log("");
    
    const NEW_ADAPTER = process.env.ADAPTER_ADDRESS || "0x58DB4C40CE50FEfAD8EEaA0B609e12dE21b18805";
    const NEW_QUERY_HELPER = process.env.QUERY_HELPER_ADDRESS || "0x809bCab55D850CF2380d074c9b962f0F1D447a97";
    const TARGET_VAULT = process.env.TARGET_VAULT;
    
    console.log("New Adapter:", NEW_ADAPTER);
    console.log("New QueryHelper:", NEW_QUERY_HELPER);
    console.log("Vault:", TARGET_VAULT);
    console.log("");
    console.log("⚠️  Since registration is failing,");
    console.log("   the NEW adapter allows execution without registration");
    console.log("   (uses targetVault as fallback)");
    console.log("");
    
    // Update .env first
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '..', '.env');
    
    if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        envContent = envContent.replace(/ADAPTER_ADDRESS=.*/, `ADAPTER_ADDRESS=${NEW_ADAPTER}`);
        fs.writeFileSync(envPath, envContent);
        console.log("✅ Updated .env with new adapter");
    }
    
    console.log("");
    console.log("Now deploy RSC using:");
    console.log("  cd reactive");
    console.log(`  forge script script/DeployRSC.s.sol:DeployRSC --rpc-url $env:REACTIVE_RPC --broadcast --private-key $env:REACTIVE_PRIVATE_KEY`);
    console.log("");
    console.log("The RSC will be deployed with:");
    console.log("  • New adapter (with workaround)");
    console.log("  • Fixed QueryHelper");
    console.log("  • Correct vault address");
    console.log("");
    console.log("After deployment:");
    console.log("  1. Fund RSC");
    console.log("  2. Subscribe to events");
    console.log("  3. Set targetVault on adapter (already done)");
    console.log("  4. Grant Alpha role to adapter");
    console.log("  5. System will work!");
    console.log("");
}

redeployRSC().catch(console.error);

