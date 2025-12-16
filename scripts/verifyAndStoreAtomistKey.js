const ethers = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Verify Atomist wallet private key and store in .env
 */
async function verifyAndStoreAtomistKey() {
    console.log("=".repeat(60));
    console.log("🔐 VERIFYING ATOMIST WALLET PRIVATE KEY");
    console.log("=".repeat(60));
    console.log("");
    
    const walletDir = path.join(__dirname, '..', '.wallets');
    const mnemonicPath = path.join(walletDir, '.atomist-mnemonic.txt');
    const expectedAddress = process.env.ATOMIST_ADDRESS;
    
    if (!expectedAddress) {
        throw new Error("ATOMIST_ADDRESS not found in .env");
    }
    
    console.log("Expected Atomist Address:", expectedAddress);
    console.log("");
    
    // Derive wallet from mnemonic
    if (!fs.existsSync(mnemonicPath)) {
        throw new Error("Atomist mnemonic file not found in .wallets/");
    }
    
    console.log("Deriving wallet from mnemonic...");
    const mnemonicContent = fs.readFileSync(mnemonicPath, 'utf8');
    const mnemonicMatch = mnemonicContent.match(/\b\w+(?:\s+\w+){11}\b/);
    
    if (!mnemonicMatch) {
        throw new Error("Could not extract mnemonic from file");
    }
    
    const mnemonic = mnemonicMatch[0].trim();
    const wallet = ethers.Wallet.fromMnemonic(mnemonic);
    const privateKey = wallet.privateKey;
    
    console.log("✅ Wallet derived from mnemonic");
    console.log(`   Address: ${wallet.address}`);
    console.log("");
    
    // Verify address matches
    if (wallet.address.toLowerCase() !== expectedAddress.toLowerCase()) {
        console.log("❌ ADDRESS MISMATCH!");
        console.log(`   Expected: ${expectedAddress}`);
        console.log(`   Derived:  ${wallet.address}`);
        throw new Error("Private key does not match expected Atomist address!");
    }
    
    console.log("✅ Address verification: PASSED");
    console.log(`   ${wallet.address} matches expected Atomist address`);
    console.log("");
    
    // Verify private key format
    if (!privateKey || !privateKey.startsWith('0x') || privateKey.length !== 66) {
        throw new Error("Invalid private key format");
    }
    
    console.log("✅ Private key format: VALID");
    console.log("");
    
    // Test wallet functionality
    const testWallet = new ethers.Wallet(privateKey);
    const testMessage = "Atomist wallet verification";
    const signature = await testWallet.signMessage(testMessage);
    const recoveredAddress = ethers.utils.verifyMessage(testMessage, signature);
    
    if (recoveredAddress.toLowerCase() !== expectedAddress.toLowerCase()) {
        throw new Error("Signature recovery test failed");
    }
    
    console.log("✅ Wallet functionality: PASSED");
    console.log("");
    
    // Store in .env
    const envPath = path.join(__dirname, '..', '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    if (envContent.includes('ATOMIST_PRIVATE_KEY=')) {
        envContent = envContent.replace(
            /ATOMIST_PRIVATE_KEY=.*/,
            `ATOMIST_PRIVATE_KEY=${privateKey}`
        );
        console.log("✅ Updated existing ATOMIST_PRIVATE_KEY in .env");
    } else {
        if (!envContent.endsWith('\n')) {
            envContent += '\n';
        }
        envContent += `ATOMIST_PRIVATE_KEY=${privateKey}\n`;
        console.log("✅ Added ATOMIST_PRIVATE_KEY to .env");
    }
    
    fs.writeFileSync(envPath, envContent);
    
    console.log("");
    console.log("=".repeat(60));
    console.log("✅ VERIFICATION & STORAGE COMPLETE");
    console.log("=".repeat(60));
    console.log("");
    console.log("Summary:");
    console.log(`  Address: ${wallet.address}`);
    console.log(`  Verification: ✅ PASSED`);
    console.log(`  Private Key: ✅ Stored in .env`);
    console.log("");
    console.log("⚠️  SECURITY REMINDER:");
    console.log("  - .env file contains sensitive data");
    console.log("  - Never commit .env to git (should be in .gitignore)");
    console.log("  - Keep .env file secure and backed up");
    console.log("");
}

verifyAndStoreAtomistKey().catch(console.error);

