# ✅ Guardian Wallet Created via CLI

## 📋 Wallet Information

**Address:** `0xd176EE757f1cA33fa7b720DCf16715b84E85A90A`  
**Network:** Arbitrum One (Chain ID: 42161)  
**Purpose:** Guardian role for IPOR Fusion Vault

## 🔐 Security Files Created

All files are in `.wallets/` directory:

1. **Encrypted Keystore:**
   - File: `.wallets/guardian-d176EE75.json`
   - Format: Encrypted JSON (password-protected)
   - Safe to backup/store in password manager

2. **Mnemonic (Recovery Phrase):**
   - File: `.wallets/.guardian-mnemonic.txt`
   - **⚠️ COPY THIS TO PASSWORD MANAGER NOW**
   - Then delete the file (optional, for security)

3. **Encryption Password:**
   - File: `.wallets/.guardian-password.txt`
   - **⚠️ COPY THIS TO PASSWORD MANAGER NOW**
   - Needed to unlock keystore file

## 📝 Storage Instructions

### Save to Password Manager (1Password/Bitwarden):

**Create new entry: "IPOR Fusion Guardian Wallet"**

**Fields:**
- **Address:** `0xd176EE757f1cA33fa7b720DCf16715b84E85A90A`
- **Network:** Arbitrum One
- **Purpose:** Guardian role
- **Mnemonic:** (from `.guardian-mnemonic.txt` file)
- **Keystore Password:** (from `.guardian-password.txt` file)
- **Keystore File:** `.wallets/guardian-d176EE75.json` (backup location)

**After saving to password manager:**
- ✅ Your secrets are encrypted and safe
- ✅ Accessible across all devices
- ✅ Can safely delete `.txt` files if desired (keystore JSON is enough)

## 💰 Funding the Wallet

**Option 1: CLI Script (Recommended)**
```bash
node scripts/fundGuardianWallet.js
```

This will:
- Send 0.01 ETH from your main wallet
- Confirm the transaction
- Show balance update

**Option 2: Manual**
- Send 0.01 ETH to: `0xd176EE757f1cA33fa7b720DCf16715b84E85A90A`
- Network: Arbitrum One
- From: Your main wallet (0x3737...)

## 🎯 Using in Vault Builder

1. **Go to IPOR Fusion Vault Builder**
   - Navigate to your vault
   - Find "Guardian" role section

2. **Add Guardian Address**
   - Paste: `0xd176EE757f1cA33fa7b720DCf16715b84E85A90A`
   - Click "Add" or "Assign"

3. **Sign Transaction**
   - MetaMask will prompt (use your Owner wallet)
   - Confirm transaction

4. **Verify**
   - Guardian address should appear in roles list
   - Status: Active

## 🔄 Unlocking Wallet Later

If you need to use this wallet (for Guardian actions):

```javascript
const ethers = require('ethers');
const fs = require('fs');

const keystoreJson = fs.readFileSync('.wallets/guardian-d176EE75.json', 'utf8');
const password = 'YOUR_PASSWORD_FROM_PASSWORD_MANAGER';

const wallet = await ethers.Wallet.fromEncryptedJson(keystoreJson, password);
console.log('Wallet unlocked:', wallet.address);
```

## ✅ Status

- ✅ Wallet created
- ✅ Address generated
- ✅ Encrypted keystore saved
- ✅ .env updated
- ⏳ **PENDING:** Save mnemonic/password to password manager
- ⏳ **PENDING:** Fund wallet (0.01 ETH)
- ⏳ **PENDING:** Assign in Vault Builder

## 🆘 Recovery

If you lose access:

1. **From Password Manager:**
   - Get mnemonic phrase
   - Import in MetaMask: "Import account" → Paste mnemonic
   - Or use in any wallet software

2. **From Keystore:**
   - Get keystore JSON file
   - Get password from password manager
   - Use `ethers.Wallet.fromEncryptedJson()` to unlock

## 🔒 Security Notes

- ✅ All files in `.wallets/` are in `.gitignore`
- ✅ Keystore is password-encrypted
- ✅ Mnemonic stored separately
- ✅ No plain-text private keys in files
- ⚠️ Remember to save mnemonic/password to password manager!

---

**Next:** Save secrets to password manager, then fund the wallet!

