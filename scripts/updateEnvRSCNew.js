const fs = require('fs');
const path = require('path');

const NEW_RSC = "0xe39c19A077e33d1145F8Cc78d4235aE8114C640a";

const envPath = path.join(__dirname, '..', '.env');

if (!fs.existsSync(envPath)) {
    console.log("❌ .env file not found!");
    process.exit(1);
}

let envContent = fs.readFileSync(envPath, 'utf8');

// Update RSC_ADDRESS
if (envContent.includes('RSC_ADDRESS=')) {
    envContent = envContent.replace(
        /RSC_ADDRESS=.*/,
        `RSC_ADDRESS=${NEW_RSC}`
    );
    console.log("✅ Updated RSC_ADDRESS in .env");
} else {
    envContent += `\nRSC_ADDRESS=${NEW_RSC}\n`;
    console.log("✅ Added RSC_ADDRESS to .env");
}

fs.writeFileSync(envPath, envContent);

console.log(`New RSC: ${NEW_RSC}`);
console.log("✅ .env updated successfully");

