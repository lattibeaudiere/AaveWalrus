# 🛡️ Guardian Wallet Setup - Digital Only

## Step-by-Step Guide (No Paper, All Digital)

---

## Step 1: Create New MetaMask Account

### In MetaMask Extension:

1. **Open MetaMask**
   - Click the MetaMask extension icon in your browser

2. **Open Account Menu**
   - Click your account name/icon (top right)
   - Or click the circle icon next to your address

3. **Create New Account**
   - Click "Create account" or "Add account"
   - MetaMask will ask: "Create a new account"
   - Click "Create"

4. **Name Your Account**
   - Enter name: `Guardian Wallet` or `IPOR Guardian`
   - Click "Create"

5. **Account Created!**
   - You'll see your new account with address starting with `0x...`
   - This is your Guardian address

---

## Step 2: Copy Guardian Address

### In MetaMask:

1. **Switch to Guardian Account**
   - Click on the "Guardian Wallet" account (left sidebar)

2. **Copy Address**
   - Click on the address (it will copy automatically)
   - Or click the copy icon next to the address
   - Format: `0xYourGuardianAddress123...`

3. **Save for Later**
   - Paste it somewhere temporarily (we'll store it properly next)

---

## Step 3: Export Seed Phrase (Encrypted Storage)

### ⚠️ Important Security Step:

**DO THIS BEFORE FUNDING THE WALLET** (in case something goes wrong)

### In MetaMask:

1. **Account Menu**
   - Click the three dots (⋮) next to "Guardian Wallet" account
   - Or go to Settings → Security & Privacy

2. **Reveal Seed Phrase**
   - Click "Show Secret Recovery Phrase"
   - Enter your MetaMask password (main account password)
   - MetaMask will show your 12-word seed phrase

3. **Copy Seed Phrase**
   - Select all 12 words
   - Copy to clipboard
   - Format: `word1 word2 word3 ... word12`

---

## Step 4: Store in Encrypted Password Manager

### Option A: 1Password (Recommended)

1. **Open 1Password** (or install from 1password.com)

2. **Create New Item**
   - Click "+" → "Password" or "Secure Note"

3. **Fill Details:**
   - **Title:** `IPOR Fusion Guardian Wallet`
   - **Category:** Secure Note
   - **Fields:**
     - **Address:** `0xYourGuardianAddress123...` (from Step 2)
     - **Seed Phrase:** `word1 word2 ... word12` (from Step 3)
     - **Network:** Arbitrum One
     - **Purpose:** Guardian role for Fusion Vault

4. **Save**
   - Click "Save"
   - Encrypted and stored securely

**Security:** 1Password encrypts with your master password - no one can access without it.

### Option B: Bitwarden (Free Alternative)

1. **Open Bitwarden** (or install from bitwarden.com)

2. **Create New Item**
   - Click "+" → "Secure Note"

3. **Fill Details:**
   - **Name:** `IPOR Fusion Guardian Wallet`
   - **Notes Field:**
     ```
     Address: 0xYourGuardianAddress123...
     Seed Phrase: word1 word2 ... word12
     Network: Arbitrum One
     Purpose: Guardian role for Fusion Vault
     ```

4. **Save**
   - Click "Save"
   - Fully encrypted

**Security:** Bitwarden uses end-to-end encryption - your data is encrypted before it leaves your device.

---

## Step 5: Fund Guardian Wallet

### From Your Main Wallet (0x3737...):

1. **Switch to Main Wallet in MetaMask**
   - Select your deployer account (the one with funds)

2. **Send ETH to Guardian**
   - Click "Send"
   - **To:** Paste Guardian address (from Step 2)
   - **Amount:** `0.01 ETH` (or 0.02 ETH for buffer)
   - **Network:** Arbitrum One

3. **Confirm Transaction**
   - Review details
   - Click "Confirm"
   - Wait for confirmation (~2 minutes on Arbitrum)

4. **Verify**
   - Switch to Guardian Wallet
   - Check balance shows the ETH you sent

---

## Step 6: Verify Address in Password Manager

### Check Your Storage:

1. **Open Your Password Manager** (1Password or Bitwarden)

2. **Verify Entry:**
   - ✅ Address matches MetaMask
   - ✅ Seed phrase is complete (12 words)
   - ✅ All details saved

3. **Test Recovery (Optional but Recommended):**
   - **Import Test:** Create a new MetaMask account
   - Use "Import account" → Enter seed phrase
   - Verify it matches your Guardian address
   - **Delete test account** after verification

---

## Step 7: Use in Vault Builder

### Assign Guardian Role:

1. **Open IPOR Fusion Vault Builder**
   - Navigate to your vault management page

2. **Go to Roles Section**
   - Find "Guardian" role section

3. **Add Guardian Address**
   - Paste Guardian address: `0xYourGuardianAddress123...`
   - Click "Add" or "Assign"

4. **Sign Transaction**
   - MetaMask will prompt (use your main wallet/owner account)
   - Review transaction
   - Confirm

5. **Verify Assignment**
   - UI should show Guardian address listed
   - Status: Active/Assigned

---

## ✅ Security Checklist

### What You've Done:

- ✅ **Separate Address:** Guardian ≠ Owner (different addresses)
- ✅ **Encrypted Storage:** Seed phrase in password manager (1Password/Bitwarden)
- ✅ **Digital Only:** No paper, all encrypted
- ✅ **Accessible:** Password manager syncs across devices
- ✅ **Backed Up:** Password manager has cloud backup (encrypted)

### Security Features:

- **Encryption:** Password manager encrypts all data
- **Master Password:** Only you know the master password
- **Cloud Sync:** Encrypted sync across devices
- **Zero-Knowledge:** Even password manager company can't read your data

---

## 🔐 Password Manager Setup (If Not Installed)

### 1Password Setup:

1. **Sign Up:** Go to 1password.com
2. **Create Account:** Email + Master Password
3. **Install Extension:** Browser extension + desktop app
4. **Enable Sync:** Cloud sync (all encrypted)

### Bitwarden Setup:

1. **Sign Up:** Go to bitwarden.com (free tier available)
2. **Create Account:** Email + Master Password
3. **Install Extension:** Browser extension
4. **Enable Sync:** Cloud sync (all encrypted, free tier)

---

## 📋 Quick Reference Card

### Guardian Wallet Info:
- **Address:** `0xYourGuardianAddress123...` (stored in password manager)
- **Seed Phrase:** 12 words (stored in password manager)
- **Network:** Arbitrum One
- **Purpose:** Guardian role for IPOR Fusion Vault
- **Balance:** 0.01-0.02 ETH (for gas)

### Password Manager:
- **Service:** 1Password or Bitwarden
- **Item Name:** "IPOR Fusion Guardian Wallet"
- **Access:** Master password only

---

## 🎯 You're Done!

**Guardian wallet created, encrypted, and ready to use!**

**Next Steps:**
1. Assign Guardian address in Vault Builder (Step 7)
2. Test Guardian functions (optional)
3. Keep password manager secure and backed up

**Security Status:**
- ✅ Encrypted digital storage
- ✅ No paper records
- ✅ Accessible across devices
- ✅ Zero-knowledge encryption

---

## 🆘 Emergency Recovery

### If You Lose Access:

1. **From Password Manager:**
   - Open password manager
   - Access "IPOR Fusion Guardian Wallet" entry
   - Copy seed phrase
   - Import in MetaMask

2. **Recovery Steps:**
   - MetaMask → Import Account
   - Paste seed phrase
   - Account restored instantly

---

**Status:** ✅ Complete digital setup  
**Security:** ✅ Encrypted password manager  
**Access:** ✅ Cross-device via password manager

No paper, all digital, fully encrypted! 🔐

