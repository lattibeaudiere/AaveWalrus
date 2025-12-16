const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// Verify Guardian private key in .env
const guardianKey = process.env.GUARDIAN_PRIVATE_KEY;
const guardianAddress = process.env.GUARDIAN_ADDRESS;

console.log("=".repeat(60));
console.log("🔐 VERIFYING GUARDIAN KEY IN .ENV");
console.log("=".repeat(60));
console.log("");

if (!guardianKey) {
    console.log("❌ GUARDIAN_PRIVATE_KEY not found in .env!");
    process.exit(1);
}

if (!guardianAddress) {
    console.log("❌ GUARDIAN_ADDRESS not found in .env!");
    process.exit(1);
}

console.log("✅ GUARDIAN_PRIVATE_KEY found in .env");
console.log(`   Preview: ${guardianKey.substring(0, 10)}...${guardianKey.substring(62)}`);
console.log("");
console.log("✅ GUARDIAN_ADDRESS found in .env");
console.log(`   Address: ${guardianAddress}`);
console.log("");

// Verify key format
if (!guardianKey.startsWith('0x') || guardianKey.length !== 66) {
    console.log("❌ Invalid private key format!");
    process.exit(1);
}

// Verify key generates correct address
const ethers = require('ethers');
try {
    const wallet = new ethers.Wallet(guardianKey);
    
    if (wallet.address.toLowerCase() !== guardianAddress.toLowerCase()) {
        console.log("❌ Private key does not match Guardian address!");
        console.log(`   Key generates: ${wallet.address}`);
        console.log(`   Expected: ${guardianAddress}`);
        process.exit(1);
    }
    
    console.log("✅ Private key verification: PASSED");
    console.log(`   Key correctly generates Guardian address`);
    console.log("");
    console.log("=".repeat(60));
    console.log("✅ ALL CHECKS PASSED");
    console.log("=".repeat(60));
    console.log("");
    console.log("Guardian private key is correctly stored and verified in .env!");
    
} catch (error) {
    console.log("❌ Error verifying private key:", error.message);
    process.exit(1);
}

