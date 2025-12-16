const fs = require('fs');
const path = require('path');

const NEW_QUERY_HELPER = "0x809bCab55D850CF2380d074c9b962f0F1D447a97";

const envPath = path.join(__dirname, '..', '.env');

if (!fs.existsSync(envPath)) {
    console.log("❌ .env file not found!");
    process.exit(1);
}

let envContent = fs.readFileSync(envPath, 'utf8');

// Update QUERY_HELPER_ADDRESS
if (envContent.includes('QUERY_HELPER_ADDRESS=')) {
    envContent = envContent.replace(
        /QUERY_HELPER_ADDRESS=.*/,
        `QUERY_HELPER_ADDRESS=${NEW_QUERY_HELPER}`
    );
    console.log("✅ Updated QUERY_HELPER_ADDRESS in .env");
} else {
    envContent += `\nQUERY_HELPER_ADDRESS=${NEW_QUERY_HELPER}\n`;
    console.log("✅ Added QUERY_HELPER_ADDRESS to .env");
}

fs.writeFileSync(envPath, envContent);

console.log(`New QueryHelper: ${NEW_QUERY_HELPER}`);
console.log("✅ .env updated successfully");

