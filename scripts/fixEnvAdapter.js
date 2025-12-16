const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');

if (!fs.existsSync(envPath)) {
    console.error("❌ .env file not found");
    process.exit(1);
}

let envContent = fs.readFileSync(envPath, 'utf8');

// Correct addresses
const CORRECT_ADAPTER = "0x7d485F8AD54f7A3dC9f0871e61E63A97f678CCA7";
const CORRECT_RSC = "0x64030389Fb91D86F92314503aAe57827826c8F4e";

console.log("🔧 Fixing .env file addresses...\n");

// Check current values
const currentAdapterMatch = envContent.match(/ADAPTER_ADDRESS=(.*)/);
const currentRSCMatch = envContent.match(/RSC_ADDRESS=(.*)/);

if (currentAdapterMatch) {
    const currentAdapter = currentAdapterMatch[1].trim();
    console.log(`Current ADAPTER_ADDRESS: ${currentAdapter}`);
    
    if (currentAdapter.toLowerCase() === CORRECT_RSC.toLowerCase()) {
        console.log("❌ ERROR: ADAPTER_ADDRESS is set to RSC address!");
    } else if (currentAdapter.toLowerCase() !== CORRECT_ADAPTER.toLowerCase()) {
        console.log("⚠️  ADAPTER_ADDRESS doesn't match expected value");
    }
} else {
    console.log("⚠️  ADAPTER_ADDRESS not found in .env");
}

if (currentRSCMatch) {
    const currentRSC = currentRSCMatch[1].trim();
    console.log(`Current RSC_ADDRESS: ${currentRSC}`);
    
    if (currentRSC.toLowerCase() !== CORRECT_RSC.toLowerCase()) {
        console.log("⚠️  RSC_ADDRESS doesn't match expected value");
    }
} else {
    console.log("⚠️  RSC_ADDRESS not found in .env");
}

// Fix ADAPTER_ADDRESS
if (envContent.includes('ADAPTER_ADDRESS=')) {
    envContent = envContent.replace(/ADAPTER_ADDRESS=.*/g, `ADAPTER_ADDRESS=${CORRECT_ADAPTER}`);
    console.log(`\n✅ Updated ADAPTER_ADDRESS to ${CORRECT_ADAPTER}`);
} else {
    envContent += `\nADAPTER_ADDRESS=${CORRECT_ADAPTER}\n`;
    console.log(`\n✅ Added ADAPTER_ADDRESS: ${CORRECT_ADAPTER}`);
}

// Fix RSC_ADDRESS
if (envContent.includes('RSC_ADDRESS=')) {
    envContent = envContent.replace(/RSC_ADDRESS=.*/g, `RSC_ADDRESS=${CORRECT_RSC}`);
    console.log(`✅ Updated RSC_ADDRESS to ${CORRECT_RSC}`);
} else {
    envContent += `\nRSC_ADDRESS=${CORRECT_RSC}\n`;
    console.log(`✅ Added RSC_ADDRESS: ${CORRECT_RSC}`);
}

fs.writeFileSync(envPath, envContent);

console.log("\n✅ .env file fixed!");
console.log("\nCorrect addresses:");
console.log(`  ADAPTER_ADDRESS=${CORRECT_ADAPTER}`);
console.log(`  RSC_ADDRESS=${CORRECT_RSC}`);

