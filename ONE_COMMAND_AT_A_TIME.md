# Walrus Setup - One Command at a Time

## ⚠️ IMPORTANT: Run These in Ubuntu Terminal

**First, open Ubuntu:**
```powershell
wsl -d Ubuntu
```

**Then run each command below, one at a time. Wait for each to finish before running the next.**

---

## COMMAND 1: Install suiup

```bash
curl -sSfL https://raw.githubusercontent.com/Mystenlabs/suiup/main/install.sh | sh
```

**Wait for:** "Installation complete" or similar message

---

## COMMAND 2: Reload Environment

```bash
source $HOME/.cargo/env
```

**Wait for:** Command prompt to return (no output is normal)

---

## COMMAND 3: Install Sui CLI

```bash
suiup install sui
```

**Wait for:** This takes 10-30 minutes! You'll see compilation output. Don't interrupt it!

---

## COMMAND 4: Verify Sui Installed

```bash
sui --version
```

**Wait for:** Should show version like "sui 1.x.x"

---

## COMMAND 5: Install Walrus CLI

```bash
suiup install walrus
```

**Wait for:** Installation to complete (usually quick, ~1 minute)

---

## COMMAND 6: Verify Walrus Installed

```bash
walrus --version
```

**Wait for:** Should show version like "walrus 0.x.x"

---

## COMMAND 7: Download Walrus Config

```bash
curl --create-dirs https://docs.wal.app/setup/client_config.yaml -o ~/.config/walrus/client_config.yaml
```

**Wait for:** Download to complete

---

## COMMAND 8: Initialize Sui Client (INTERACTIVE)

```bash
sui client
```

**When prompted, type:**
- `y` (then press Enter)
- `https://fullnode.testnet.sui.io:443` (then press Enter)
- `testnet` (then press Enter)
- `0` (then press Enter)

**Wait for:** Configuration to complete

---

## COMMAND 9: Get Your Address

```bash
sui client active-address
```

**Wait for:** Address like `0xabc123...` - **COPY THIS!**

---

## COMMAND 10: Verify Walrus Config

```bash
walrus info
```

**Wait for:** Should show "Epoch duration: 1day" (means Testnet is working)

---

## COMMAND 11: Check Balance (Before Faucet)

```bash
sui client balance
```

**Wait for:** Will show 0 or empty (that's OK, you'll get tokens next)

---

## COMMAND 12: Get Free Tokens

**NOT A COMMAND - DO THIS IN BROWSER:**
1. Go to: https://faucet.sui.io/
2. Select: **Testnet**
3. Paste: Your address from Command 9
4. Click: Get tokens
5. Wait: A few seconds

---

## COMMAND 13: Check Balance (After Faucet)

```bash
sui client balance
```

**Wait for:** Should show SUI tokens (like 0.49 SUI)

---

## COMMAND 14: Convert SUI to WAL

```bash
walrus get-wal --context testnet
```

**Wait for:** Conversion to complete

---

## COMMAND 15: Check Balance Again

```bash
sui client balance
```

**Wait for:** Should show both SUI and WAL tokens

---

## COMMAND 16: Create Test File

```bash
echo "Hello Walrus Testnet!" > ~/test_walrus.txt
```

**Wait for:** File created (no output is normal)

---

## COMMAND 17: Store File on Walrus

```bash
walrus store ~/test_walrus.txt --epochs 2 --context testnet
```

**Wait for:** Blob ID and Sui object ID - **COPY THE BLOB ID!**

---

## COMMAND 18: Retrieve File from Walrus

```bash
walrus read YOUR_BLOB_ID_HERE --out ~/retrieved.txt --context testnet
```

**Replace `YOUR_BLOB_ID_HERE` with the Blob ID from Command 17**

**Wait for:** File to be retrieved

---

## COMMAND 19: Verify Retrieved File

```bash
cat ~/retrieved.txt
```

**Wait for:** Should show "Hello Walrus Testnet!"

---

## ✅ DONE!

If Command 19 shows your test message, everything is working!

---

## Notes

- **Command 3 takes 10-30 minutes** - be patient!
- **Command 8 is interactive** - answer the prompts
- **Command 12 is in browser** - not a terminal command
- **Wait for each command to finish** before running the next
- **If any command fails**, let me know which one and the error message

---

## Quick Reference

**Most Important Commands:**
- Command 3: Install Sui (longest, 10-30 min)
- Command 8: Configure Sui (interactive)
- Command 9: Get address (copy it!)
- Command 12: Get tokens (in browser)
- Command 17: Store blob (copy Blob ID!)

**Run them one at a time, wait for each to finish!**

