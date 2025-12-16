const ethers = require('ethers');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Create a new Guardian wallet using ethers.js
 * Stores encrypted JSON keystore and plain address for easy access
 */
async function createGuardianWallet() {
    console.log("=".repeat(60));
    console.log("🛡️  CREATING GUARDIAN WALLET (CLI)");
    console.log("=".repeat(60));
    console.log("");
    
    // Generate new wallet
    console.log("Generating new wallet...");
    const wallet = ethers.Wallet.createRandom();
    
    const address = wallet.address;
    const privateKey = wallet.privateKey;
    const mnemonic = wallet.mnemonic;
    
    console.log("✅ Wallet generated!");
    console.log("");
    
    console.log("=".repeat(60));
    console.log("📋 WALLET INFORMATION");
    console.log("=".repeat(60));
    console.log("");
    console.log("Address:", address);
    console.log("Mnemonic:", mnemonic.phrase);
    console.log("");
    
    // Create encrypted keystore
    console.log("Creating encrypted keystore...");
    const password = crypto.randomBytes(32).toString('hex');
    const encryptedJson = await wallet.encrypt(password);
    
    // Save to file
    const walletDir = path.join(__dirname, '..', '.wallets');
    if (!fs.existsSync(walletDir)) {
        fs.mkdirSync(walletDir, { recursive: true });
    }
    
    const keystorePath = path.join(walletDir, `guardian-${address.slice(2, 10)}.json`);
    fs.writeFileSync(keystorePath, encryptedJson);
    
    // Save address and info separately (for quick reference)
    const infoPath = path.join(walletDir, `guardian-info.json`);
    const walletInfo = {
        address: address,
        network: "Arbitrum One",
        chainId: 42161,
        purpose: "Guardian role for IPOR Fusion Vault",
        createdAt: new Date().toISOString(),
        keystoreFile: path.basename(keystorePath),
        // DO NOT store private key or mnemonic in plain text file
        // They are in the encrypted keystore only
    };
    
    fs.writeFileSync(infoPath, JSON.stringify(walletInfo, null, 2));
    
    console.log("✅ Encrypted keystore saved!");
    console.log(`   Path: ${keystorePath}`);
    console.log("");
    
    // Generate password for keystore (user needs to save this)
    console.log("=".repeat(60));
    console.log("🔐 ENCRYPTION PASSWORD");
    console.log("=".repeat(60));
    console.log("");
    console.log("Password:", password);
    console.log("");
    console.log("⚠️  IMPORTANT: Save this password!");
    console.log("   You'll need it to unlock the keystore file.");
    console.log("   Store it in your password manager (1Password/Bitwarden).");
    console.log("");
    
    // Save password hint separately (encrypted)
    const passwordHintPath = path.join(walletDir, `.guardian-password.txt`);
    fs.writeFileSync(passwordHintPath, `Password for ${keystorePath}:\n${password}\n\nDO NOT COMMIT THIS FILE TO GIT!\n`);
    console.log(`⚠️  Password also saved to: ${passwordHintPath}`);
    console.log("   (For local reference - add to .gitignore)");
    console.log("");
    
    // Display mnemonic (user must save securely)
    console.log("=".repeat(60));
    console.log("📝 MNEMONIC SEED PHRASE");
    console.log("=".repeat(60));
    console.log("");
    console.log(mnemonic.phrase);
    console.log("");
    console.log("⚠️  CRITICAL: Save this mnemonic securely!");
    console.log("   This is your wallet recovery phrase.");
    console.log("   Store in encrypted password manager.");
    console.log("   Never share or commit to git.");
    console.log("");
    
    // Save mnemonic to file (for import to password manager)
    const mnemonicPath = path.join(walletDir, `.guardian-mnemonic.txt`);
    fs.writeFileSync(mnemonicPath, `Guardian Wallet Recovery Phrase:\n\n${mnemonic.phrase}\n\nAddress: ${address}\nNetwork: Arbitrum One\nCreated: ${walletInfo.createdAt}\n\n⚠️ SECRET - Store in encrypted password manager!\n`);
    console.log(`📄 Mnemonic saved to: ${mnemonicPath}`);
    console.log("   Copy this to your password manager, then delete the file.");
    console.log("");
    
    // Update .env
    console.log("=".repeat(60));
    console.log("📝 UPDATING .ENV FILE");
    console.log("=".repeat(60));
    console.log("");
    
    try {
        const envPath = path.join(__dirname, '..', '.env');
        if (fs.existsSync(envPath)) {
            let envContent = fs.readFileSync(envPath, 'utf8');
            
            // Add or update GUARDIAN_ADDRESS
            if (envContent.includes('GUARDIAN_ADDRESS=')) {
                envContent = envContent.replace(
                    /GUARDIAN_ADDRESS=.*/,
                    `GUARDIAN_ADDRESS=${address}`
                );
            } else {
                envContent += `\nGUARDIAN_ADDRESS=${address}\n`;
            }
            
            // Add keystore path
            if (envContent.includes('GUARDIAN_KEYSTORE=')) {
                envContent = envContent.replace(
                    /GUARDIAN_KEYSTORE=.*/,
                    `GUARDIAN_KEYSTORE=${keystorePath}`
                );
            } else {
                envContent += `\nGUARDIAN_KEYSTORE=${keystorePath}\n`;
            }
            
            fs.writeFileSync(envPath, envContent);
            console.log("✅ .env file updated with GUARDIAN_ADDRESS and GUARDIAN_KEYSTORE");
        } else {
            console.log("⚠️  .env file not found - creating new one");
            fs.writeFileSync(envPath, `GUARDIAN_ADDRESS=${address}\nGUARDIAN_KEYSTORE=${keystorePath}\n`);
        }
    } catch (error) {
        console.log("⚠️  Could not update .env:", error.message);
    }
    
    console.log("");
    
    // Display summary
    console.log("=".repeat(60));
    console.log("✅ GUARDIAN WALLET CREATED");
    console.log("=".repeat(60));
    console.log("");
    console.log("📋 Summary:");
    console.log(`   Address: ${address}`);
    console.log(`   Keystore: ${keystorePath}`);
    console.log(`   Mnemonic: ${mnemonicPath} (copy to password manager)`);
    console.log(`   Password: ${passwordHintPath} (save securely)`);
    console.log("");
    
    console.log("📋 Next Steps:");
    console.log("   1. Copy mnemonic to password manager (1Password/Bitwarden)");
    console.log("   2. Save encryption password to password manager");
    console.log("   3. Fund wallet with 0.01 ETH (from your main wallet)");
    console.log("   4. Use address in Vault Builder: " + address);
    console.log("");
    
    console.log("💰 To fund the wallet:");
    console.log(`   Send 0.01 ETH to: ${address}`);
    console.log(`   Network: Arbitrum One (Chain ID: 42161)`);
    console.log("");
    
    console.log("🔐 To unlock wallet later:");
    console.log(`   const wallet = await ethers.Wallet.fromEncryptedJson(keystoreJson, password);`);
    console.log("");
    
    // Add to .gitignore
    const gitignorePath = path.join(__dirname, '..', '.gitignore');
    if (fs.existsSync(gitignorePath)) {
        const gitignore = fs.readFileSync(gitignorePath, 'utf8');
        if (!gitignore.includes('.wallets/')) {
            fs.appendFileSync(gitignorePath, '\n# Guardian wallet files\n.wallets/\n*.mnemonic.txt\n*.password.txt\n');
        }
    } else {
        fs.writeFileSync(gitignorePath, '# Guardian wallet files\n.wallets/\n*.mnemonic.txt\n*.password.txt\n');
    }
    console.log("✅ Added .wallets/ to .gitignore (keeps secrets out of git)");
    console.log("");
    
    return {
        address,
        keystorePath,
        mnemonicPath,
        passwordHintPath
    };
}

createGuardianWallet().catch(console.error);

