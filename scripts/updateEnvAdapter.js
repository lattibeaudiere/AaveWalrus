const fs = require('fs');
const path = require('path');

const newAdapterAddress = process.argv[2];

if (!newAdapterAddress) {
    console.error("Usage: node scripts/updateEnvAdapter.js <ADAPTER_ADDRESS>");
    process.exit(1);
}

const envPath = path.join(__dirname, '..', '.env');

if (!fs.existsSync(envPath)) {
    console.error("❌ .env file not found");
    process.exit(1);
}

let envContent = fs.readFileSync(envPath, 'utf8');

// Update ADAPTER_ADDRESS
if (envContent.includes('ADAPTER_ADDRESS=')) {
    envContent = envContent.replace(/ADAPTER_ADDRESS=.*/g, `ADAPTER_ADDRESS=${newAdapterAddress}`);
} else {
    envContent += `\nADAPTER_ADDRESS=${newAdapterAddress}\n`;
}

fs.writeFileSync(envPath, envContent);
console.log(`✅ Updated ADAPTER_ADDRESS to ${newAdapterAddress}`);
