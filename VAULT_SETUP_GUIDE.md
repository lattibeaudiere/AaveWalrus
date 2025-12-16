# IPOR Fusion Vault Setup Guide

Based on IPOR's official documentation, here's how to properly set up your vault before deploying the RSC.

## 🎯 Goal

Set up a functional IPOR Fusion Plasma Vault on Arbitrum configured for autonomous yield optimization between Aave V3 and Compound V3.

## 📋 Required Setup Steps

### Phase 1: Initial Vault Creation

**Option A: Use IPOR's Vault Builder (Recommended)**

IPOR provides a Vault Builder web application. Steps:

1. Go to IPOR Fusion interface
2. Create new vault
3. Configure:
   - Asset: USDC
   - Name: "USDC Yield Optimizer"
   - Symbol: "USDC-YO"

**Option B: Deploy via IPOR's Factory**

Contact IPOR for factory access and deployment instructions.

### Phase 2: Access Management Setup

Configure roles in this hierarchy:

```
Owner (Multisig)
  └─ Guardian (Multisig)
      └─ Atomist (Your admin wallet)
          └─ Alpha (Your RSC address - set after RSC deployment)
```

**Critical Role: ALPHA_ROLE**
- This is what we'll grant to your RSC after deployment
- Allows RSC to execute strategies
- Role ID: 200

### Phase 3: Fuse Configuration

#### Step 1: Whitelist Fuses

Add these fuses to your vault:

**Aave V3:**
- Balance Fuse: `0x4CB1c4774BA1B65802c68Adb33DE99ABf8B21228`
- Supply Fuse: `0x304756cD719382281fBD640f5F7932465eD663D6`

**Compound V3:**
- Balance Fuse: `0xCF730BAA5542DC7570907696271bA96019FcD10C`
- Supply Fuse: `0xB0b3dc1B27C6c8007c9B01a768d6717f6813fE94`

**ERC20:**
- Balance Fuse: `0x1a047137F2D4daE60853f87Dc13ae92C0dB2c123` (for tracking USDC in vault)

#### Step 2: Configure Market IDs

Assign market IDs:
- Market ID 1: Aave V3 USDC
- Market ID 2: Compound V3 USDC

#### Step 3: Configure Substrates

**Aave V3 Substrates:**
- Asset: `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` (USDC)

**Compound V3 Substrates:**
- Market: `0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf` (Comet USDC)

#### Step 4: Configure Price Feeds

Ensure price oracle has USDC feed configured:
- Chainlink USDC/USD on Arbitrum

### Phase 4: Withdrawal Configuration

**Option A: Scheduled Withdrawals**
- Set withdrawal window: 24-48 hours
- LP submits request, Alpha prepares assets, LP redeems

**Option B: Instant Withdrawals**  
- Configure order: ERC20 balance first, then protocols
- **CRITICAL**: Don't include markets with collateral risk

For this yield optimizer, **instant withdrawals** are recommended for simplicity.

### Phase 5: Fee Configuration

Default fees (can be adjusted):
- Management fee: 0.3% annually
- Performance fee: 2% on profits

Best practices:
- Use multisig for fee recipient
- Maximum: 5% management, 50% performance

### Phase 6: Whitelist Control

During testing:
- Keep whitelist enabled
- Add test addresses
- Only your wallet initially

When ready for production:
- Disable whitelist (irreversible)
- Open to all users

## 🔗 RSC Integration Point

After your vault is configured:

1. **Deploy RSC** (our script)
2. **Grant ALPHA_ROLE** to RSC address
3. **RSC can now execute** on your vault

## 📝 Configuration Checklist

```
□ Vault created and deployed
□ Owner role set (multisig)
□ Guardian role set (multisig)  
□ Atomist role assigned to admin wallet
□ Aave fuses whitelisted
□ Compound fuses whitelisted
□ ERC20 balance fuse whitelisted
□ Market IDs configured (Aave=1, Compound=2)
□ Substrates configured for each market
□ Price feeds configured for USDC
□ Withdrawal type selected (instant or scheduled)
□ Fees configured
□ Whitelist managed (disabled or addresses added)
□ RSC deployed
□ ALPHA_ROLE granted to RSC
□ Initial USDC deposited to vault
□ Monitoring set up
```

## 🚨 Important Warnings

### DO NOT:
- ❌ Include borrowing markets in instant withdrawals (liquidation risk)
- ❌ Open vault to public during testing
- ❌ Set instant withdrawal order with unsafe markets
- ❌ Skip pre-hooks if using scheduled withdrawals

### DO:
- ✅ Use multisig for all admin roles
- ✅ Start with whitelist enabled
- ✅ Test thoroughly before going public
- ✅ Monitor vault actively
- ✅ Use timelocks for critical roles

## 📊 Our RSC's Role

Once deployed, your RSC will:

1. Monitor APY rates on Aave and Compound
2. Calculate yield spread
3. When spread > threshold (50 bps = 0.5%):
   - Call vault with FuseActions
   - Withdraw from lower-yielding protocol
   - Deposit to higher-yielding protocol
4. Execute atomically via ALPHA_ROLE

## 🎯 Next Steps

1. **Deploy/Create IPOR Vault**
   - Use Vault Builder or contact IPOR
   - Get vault address and access manager address

2. **Configure Vault**
   - Follow steps above
   - Whitelist fuses
   - Set up markets

3. **Deploy RSC**
   ```bash
   npm run deploy:mainnet
   ```

4. **Grant Permission**
   ```bash
   npm run grant:role
   ```

5. **Test**
   ```bash
   npm run check:status
   ```

## 📞 Getting Help

- **IPOR Discord**: For vault deployment support
- **IPOR Docs**: https://docs.ipor.io/ipor-fusion
- **IPOR ABIs**: https://github.com/IPOR-Labs/ipor-abi

## 🔗 Key Resources

- [Vault Configuration](https://docs.ipor.io/ipor-fusion/vault-configuration-step-by-step)
- [Access Management](https://docs.ipor.io/ipor-fusion/vault-configuration-step-by-step/access-management)
- [Fuses List](https://docs.ipor.io/ipor-fusion/fuses)
- [Roles Reference](https://github.com/IPOR-Labs/ipor-fusion/blob/main/contracts/libraries/Roles.sol)

---

Once your vault is set up, come back here and we'll deploy the RSC! 🚀

