const fs = require('fs');
const path = require('path');

const newRSCAddress = process.argv[2];

if (!newRSCAddress) {
    console.error("Usage: node scripts/updateEnvRSC.js <RSC_ADDRESS>");
    process.exit(1);
}

const envPath = path.join(__dirname, '..', '.env');

if (!fs.existsSync(envPath)) {
    console.error("❌ .env file not found");
    process.exit(1);
}

let envContent = fs.readFileSync(envPath, 'utf8');

// Update RSC_ADDRESS
if (envContent.includes('RSC_ADDRESS=')) {
    envContent = envContent.replace(/RSC_ADDRESS=.*/g, `RSC_ADDRESS=${newRSCAddress}`);
} else {
    envContent += `\nRSC_ADDRESS=${newRSCAddress}\n`;
}

fs.writeFileSync(envPath, envContent);
console.log(`✅ Updated RSC_ADDRESS to ${newRSCAddress}`);

