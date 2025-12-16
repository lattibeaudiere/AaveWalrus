# 🚀 Mainnet Deployment Guide - Arbitrum

## ⚠️ CRITICAL WARNINGS

1. **You are deploying to MAINNET with REAL FUNDS**
2. **Private keys are sensitive** - Never commit them to git
3. **Verify all addresses** before deploying
4. **Test on testnet first**
5. **Start with small amounts** for testing

## 📋 Pre-Deployment Checklist

```
□ You have deployed an IPOR Fusion Plasma Vault on Arbitrum
□ You have obtained fuse addresses from IPOR
□ You have sufficient ETH on Arbitrum for gas (min 0.01 ETH)
□ You have saved your private key securely
□ You have reviewed all contract code
□ You have tested on Arbitrum Goerli testnet
□ You understand the risks
```

## 🛠️ Setup Steps

### 1. Create .env File

```bash
# Copy the example and fill in your values
cp .env.mainnet.example .env
```

Edit `.env` with your values:

```bash
# Your private key (use the provided one for this project)
ARBITRUM_PRIVATE_KEY=0x6fa42a2b9666e4b30ea146654085832b440591575780c668e0641b674abbb5e6

# Network config
ARBITRUM_RPC=https://arb1.arbitrum.io/rpc

# Contract addresses (fill after deployment or use existing vault)
TARGET_VAULT=0x... # Your IPOR Fusion vault address
ACCESS_MANAGER_ADDRESS=0x... # Vault's access manager

# Fuse addresses (get from IPOR)
AAVE_SUPPLY_FUSE=0x...
AAVE_BALANCE_FUSE=0x...
COMPOUND_SUPPLY_FUSE=0x...
COMPOUND_BALANCE_FUSE=0x...

# Protocol addresses (already correct for Arbitrum mainnet)
AAVE_V3_POOL=0x794a61358D6845594F94dc1DB02A252b5b4814aD
AAVE_DATA_PROVIDER=0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654
COMPOUND_MARKET=0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA

# Strategy parameters
MIN_SPREAD_BPS=50  # 0.5% minimum spread
```

### 2. Compile Contracts

```bash
npm run compile
```

### 3. Deploy to Mainnet

```bash
npm run deploy:mainnet
```

This will:
1. Deploy ReactiveAlphaAdapter
2. Deploy YieldOptimizerRSC
3. Register RSC with adapter
4. Save addresses to `deployment-addresses.json`

**Expected output:**
```
🚀 STARTING MAINNET DEPLOYMENT TO ARBITRUM
⚠️  WARNING: You are deploying to MAINNET!
📝 Deploying with account: 0x...
💰 Account balance: 0.123 ETH
📋 Deployment Configuration:
   Target Vault: 0x...
✅ ReactiveAlphaAdapter deployed at: 0x...
✅ YieldOptimizerRSC deployed at: 0x...
✅ RSC registered
🎉 DEPLOYMENT COMPLETE!
```

### 4. Grant ALPHA_ROLE

After deployment, grant the RSC permission to execute on the vault:

```bash
# First, set ACCESS_MANAGER_ADDRESS in .env
# Then run:
npm run grant:role
```

### 5. Check Status

```bash
npm run check:status
```

## 📊 Post-Deployment Tasks

### 1. Verify Contracts on Arbiscan

```bash
# Get your contract addresses from deployment-addresses.json
# Then verify on Arbiscan:
https://arbiscan.io/address/YOUR_CONTRACT_ADDRESS#code
```

### 2. Test the RSC

```javascript
// Check current strategy state
const rsc = await ethers.getContractAt("YieldOptimizerRSC", rscAddress);
const [aaveAPY, compoundAPY, spread] = await rsc.getStrategyState();
console.log("Aave APY:", aaveAPY);
console.log("Compound APY:", compoundAPY);
console.log("Spread:", spread);
```

### 3. Manual Test

```javascript
// Manually trigger rebalance (testing)
adierge rsc.manualTrigger();
```

### 4. Monitor

Set up monitoring for:
- RSC execution events
- Vault balance changes
- APY spreads
- Gas costs

## 🔐 Security Best Practices

1. **Keep .env file secure**
   - Never commit to git
   - Use `.gitignore`
   - Store backups securely encrypted

2. **Use multisig for owner roles**
   - Don't use single-sig wallets for production
   - IPOR recommends multisig for ATOMIST_ROLE

3. **Monitor actively**
   - Check contract status daily
   - Monitor for unexpected executions
   - Set up alerting

4. **Emergency procedures**
   - Know how to pause RSC
   - Know how to pause vault
   - Keep emergency contacts

## 📞 Support & Resources

- **IPOR Fusion Docs**: https://docs.ipor.io/ipor-fusion
- **Arbitrum Docs**: https://docs.arbitrum.io
- **Arbiscan**: https://arbiscan.io
- **IPOR Discord**: For technical support

## 🐛 Troubleshooting

### Deployment Failed

**Error**: Insufficient balance
- **Fix**: Add more ETH to your account

**Error**: Invalid address
- **Fix**: Check all addresses in .env are correct

### RSC Not Executing

**Check**:
1. Is RSC granted ALPHA_ROLE? (`npm run grant:role`)
2. Are fuse addresses set correctly?
3. Is spread above threshold?
4. Has cooldown period passed?

### Cannot Grant Role

**Error**: Access denied
- **Fix**: Ensure your account has ATOMIST_ROLE on the vault

## 🎯 Next Steps

1. ✅ Deploy contracts
2. ✅ Grant permissions
3. ✅ Verify on Arbiscan
4. ✅ Test manually
5. ⏳ Enable automation
6. ⏳ Monitor operations
7. ⏳ Optimize parameters

## 📝 Deployment Addresses Log

After deployment, your addresses will be saved in `deployment-addresses.json`:

```json
{
  "adapter": "0x...",
  "rsc": "0x...",
  "network": "arbitrum",
  "deployer": "0x...",
  "timestamp": "2024-01-15T..."
}
```

**Keep this file secure and backed up!**

---

🚨 **Remember**: This is mainnet. Always verify before executing. When in doubt, ask for help.

