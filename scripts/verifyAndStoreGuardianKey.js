const ethers = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Verify Guardian wallet private key and store in .env
 */
async function verifyAndStoreGuardianKey() {
    console.log("=".repeat(60));
    console.log("🔐 VERIFYING GUARDIAN WALLET PRIVATE KEY");
    console.log("=".repeat(60));
    console.log("");
    
    const walletDir = path.join(__dirname, '..', '.wallets');
    const mnemonicPath = path.join(walletDir, '.guardian-mnemonic.txt');
    const passwordPath = path.join(walletDir, '.guardian-password.txt');
    const keystorePath = path.join(walletDir, 'guardian-d176EE75.json');
    
    // Expected Guardian address from .env
    const expectedAddress = process.env.GUARDIAN_ADDRESS;
    
    if (!expectedAddress) {
        throw new Error("GUARDIAN_ADDRESS not found in .env");
    }
    
    console.log("Expected Guardian Address:", expectedAddress);
    console.log("");
    
    // Method 1: Try to read mnemonic and derive wallet
    let wallet;
    let privateKey;
    
    if (fs.existsSync(mnemonicPath)) {
        console.log("Method 1: Deriving from mnemonic...");
        console.log("-".repeat(60));
        
        const mnemonicContent = fs.readFileSync(mnemonicPath, 'utf8');
        // Extract mnemonic phrase (12 words)
        const mnemonicMatch = mnemonicContent.match(/\b\w+(?:\s+\w+){11}\b/);
        
        if (!mnemonicMatch) {
            throw new Error("Could not extract mnemonic from file");
        }
        
        const mnemonic = mnemonicMatch[0].trim();
        console.log("Mnemonic extracted (first/last words):", 
            mnemonic.split(' ')[0], "...", mnemonic.split(' ')[11]);
        console.log("");
        
        // Derive wallet from mnemonic
        wallet = ethers.Wallet.fromMnemonic(mnemonic);
        privateKey = wallet.privateKey;
        
        console.log("✅ Wallet derived from mnemonic");
        console.log(`   Address: ${wallet.address}`);
        
    } else if (fs.existsSync(keystorePath) && fs.existsSync(passwordPath)) {
        console.log("Method 2: Decrypting keystore...");
        console.log("-".repeat(60));
        
        const keystoreJson = fs.readFileSync(keystorePath, 'utf8');
        const passwordContent = fs.readFileSync(passwordPath, 'utf8');
        
        // Extract password from file
        const passwordMatch = passwordContent.match(/Password for.*:\n([a-f0-9]+)/i);
        if (!passwordMatch) {
            // Try simpler pattern
            const lines = passwordContent.split('\n');
            const password = lines.find(line => /^[a-f0-9]{64}$/i.test(line.trim()));
            
            if (!password) {
                throw new Error("Could not extract password from file");
            }
            
            wallet = await ethers.Wallet.fromEncryptedJson(keystoreJson, password.trim());
        } else {
            wallet = await ethers.Wallet.fromEncryptedJson(keystoreJson, passwordMatch[1]);
        }
        
        privateKey = wallet.privateKey;
        
        console.log("✅ Wallet decrypted from keystore");
        console.log(`   Address: ${wallet.address}`);
        
    } else {
        throw new Error("Neither mnemonic nor keystore files found in .wallets/");
    }
    
    console.log("");
    
    // Verify address matches
    console.log("=".repeat(60));
    console.log("✅ VERIFICATION");
    console.log("=".repeat(60));
    console.log("");
    
    if (wallet.address.toLowerCase() !== expectedAddress.toLowerCase()) {
        console.log("❌ ADDRESS MISMATCH!");
        console.log(`   Expected: ${expectedAddress}`);
        console.log(`   Derived:  ${wallet.address}`);
        console.log("");
        throw new Error("Private key does not match expected Guardian address!");
    }
    
    console.log("✅ Address verification: PASSED");
    console.log(`   ${wallet.address} matches expected Guardian address`);
    console.log("");
    
    // Verify private key format
    if (!privateKey || !privateKey.startsWith('0x') || privateKey.length !== 66) {
        throw new Error("Invalid private key format");
    }
    
    console.log("✅ Private key format: VALID");
    console.log("   Length: 66 characters (0x + 64 hex)");
    console.log("   Starts with: 0x");
    console.log("");
    
    // Show first/last chars for confirmation (not full key)
    const keyPreview = `${privateKey.substring(0, 10)}...${privateKey.substring(62)}`;
    console.log("Private Key Preview:", keyPreview);
    console.log("   (Full key will be stored in .env)");
    console.log("");
    
    // Test wallet functionality
    console.log("=".repeat(60));
    console.log("🧪 TESTING WALLET FUNCTIONALITY");
    console.log("=".repeat(60));
    console.log("");
    
    try {
        // Create wallet instance to test
        const testWallet = new ethers.Wallet(privateKey);
        
        if (testWallet.address.toLowerCase() !== expectedAddress.toLowerCase()) {
            throw new Error("Wallet instantiation test failed");
        }
        
        // Sign a test message
        const testMessage = "Guardian wallet verification";
        const signature = await testWallet.signMessage(testMessage);
        
        // Recover address from signature
        const recoveredAddress = ethers.utils.verifyMessage(testMessage, signature);
        
        if (recoveredAddress.toLowerCase() !== expectedAddress.toLowerCase()) {
            throw new Error("Signature recovery test failed");
        }
        
        console.log("✅ Wallet instantiation: PASSED");
        console.log("✅ Message signing: PASSED");
        console.log("✅ Signature recovery: PASSED");
        console.log("");
        
    } catch (error) {
        console.log("❌ Wallet functionality test failed!");
        console.log(`   Error: ${error.message}`);
        throw error;
    }
    
    // Store in .env
    console.log("=".repeat(60));
    console.log("📝 STORING IN .ENV FILE");
    console.log("=".repeat(60));
    console.log("");
    
    const envPath = path.join(__dirname, '..', '.env');
    
    if (!fs.existsSync(envPath)) {
        throw new Error(".env file not found!");
    }
    
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Add or update GUARDIAN_PRIVATE_KEY
    if (envContent.includes('GUARDIAN_PRIVATE_KEY=')) {
        envContent = envContent.replace(
            /GUARDIAN_PRIVATE_KEY=.*/,
            `GUARDIAN_PRIVATE_KEY=${privateKey}`
        );
        console.log("✅ Updated existing GUARDIAN_PRIVATE_KEY in .env");
    } else {
        // Add at end of file
        if (!envContent.endsWith('\n')) {
            envContent += '\n';
        }
        envContent += `GUARDIAN_PRIVATE_KEY=${privateKey}\n`;
        console.log("✅ Added GUARDIAN_PRIVATE_KEY to .env");
    }
    
    // Write back to file
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
    
    // Verify it's in .gitignore
    const gitignorePath = path.join(__dirname, '..', '.gitignore');
    if (fs.existsSync(gitignorePath)) {
        const gitignore = fs.readFileSync(gitignorePath, 'utf8');
        if (gitignore.includes('.env')) {
            console.log("✅ .env is in .gitignore (safe from accidental commits)");
        } else {
            console.log("⚠️  WARNING: .env is NOT in .gitignore!");
            console.log("   Add .env to .gitignore to protect secrets");
        }
    }
    
    console.log("");
}

verifyAndStoreGuardianKey().catch(console.error);

