const fs = require('fs');
const path = require('path');

const NEW_ADAPTER = "0xA7a71255FfBE943b6107354684b78C26bF0cf161";

const envPath = path.join(__dirname, '..', '.env');

if (!fs.existsSync(envPath)) {
    console.log("❌ .env file not found!");
    process.exit(1);
}

let envContent = fs.readFileSync(envPath, 'utf8');

if (envContent.includes('ADAPTER_ADDRESS=')) {
    envContent = envContent.replace(
        /ADAPTER_ADDRESS=.*/,
        `ADAPTER_ADDRESS=${NEW_ADAPTER}`
    );
    console.log("✅ Updated ADAPTER_ADDRESS in .env");
} else {
    envContent += `\nADAPTER_ADDRESS=${NEW_ADAPTER}\n`;
    console.log("✅ Added ADAPTER_ADDRESS to .env");
}

fs.writeFileSync(envPath, envContent);

console.log(`New Adapter: ${NEW_ADAPTER}`);
console.log("✅ .env updated successfully");

