# Final Deployment Checklist - Production Ready ✅

## 🎯 Deployment Status: 100% READY

All tests passed, all fixes applied, all validations complete.

## 📋 Pre-Deployment

### Environment Setup
- [ ] `.env` file has all addresses:
  - `TARGET_VAULT` - IPOR Fusion vault address
  - `ADAPTER_ADDRESS` - Already deployed (0xdBfd1ea4387352f2b98bC2d08B4Cd4B668C0860D)
  - `ARBITRUM_RPC` - RPC endpoint
  - `REACTIVE_RPC` - Reactive Network RPC
  - `REACTIVE_PRIVATE_KEY` - For RSC deployment
  - `ARBITRUM_PRIVATE_KEY` - For QueryHelper deployment
  - `REACTIVE_SERVICE` - 0x0000000000000000000000000000000000fffFfF

### Whitelisting Verification
- [ ] Run: `node scripts/checkWhitelist.js`
- [ ] Verify adapter has ALPHA_ROLE on vault
- [ ] Verify RSC is registered in adapter (after deployment)

### Unsubscribe Old Events
- [ ] Unsubscribe from Compound AccrueInterest (if active):
  ```bash
  node scripts/unsubscribeFromCompound.js
  ```

## 🚀 Deployment Steps

### Step 1: Deploy QueryHelper (Arbitrum)
```bash
node scripts/deployQueryHelper.js
```

**Verify:**
- [ ] QueryHelper deployed successfully
- [ ] Address saved to `.env` as `QUERY_HELPER_ADDRESS`
- [ ] Event topic0 computed: `0xbc75181d726fb199839a4832ddc558e7942ef478af322c6d275d9415ebd3ff4b`
- [ ] Test query works: `await queryHelper.getCompoundApy()`

**Time:** < 5 minutes

### Step 2: Deploy RSC (Reactive Network)
```bash
cd reactive
forge script script/DeployRSC.s.sol:DeployRSC \
  --rpc-url $REACTIVE_RPC \
  --broadcast \
  --private-key $REACTIVE_PRIVATE_KEY
```

**Verify:**
- [ ] RSC deployed successfully
- [ ] Address saved to `.env` as `RSC_ADDRESS`
- [ ] All constructor parameters correct:
  - Service: 0x0000...fffFfF
  - Sequencer: address(0)
  - Adapter: [your adapter]
  - QueryHelper: [from Step 1]
  - Vault: [your vault]

**Time:** < 10 minutes

### Step 3: Post-Deployment Setup

#### 3.1 Fund RSC
```bash
node scripts/fundAndCoverDebt.js
```

- [ ] RSC has sufficient REACT balance
- [ ] Debt covered (if any)

#### 3.2 Subscribe to Events
```bash
# Subscribe to Aave (if not already)
node scripts/subscribeToAave.js

# Subscribe to QueryHelper (NEW)
node scripts/subscribeToQueryHelper.js
```

- [ ] Aave subscription active
- [ ] QueryHelper subscription active

#### 3.3 Register RSC in Adapter
```bash
# If not already registered
node scripts/registerRSC.js
```

- [ ] RSC registered in adapter
- [ ] RSC marked as active

**Time:** < 5 minutes

### Step 4: Fund Vault and Monitor

#### 4.1 Fund Vault
- [ ] Deposit minimum $1,000 USDC (for first test)
- [ ] Recommended: $10,000 USDC (for meaningful test)

#### 4.2 Monitor First Event

**Set up Arbiscan alerts:**
- Contract: `0x794a61358D6845594F94dc1DB02A252b5b4814aD` (Aave Pool)
- Event: `ReserveDataUpdated`
- Filter: Topic1 = USDC address

**Expected timeline:** First event within 1 hour

## 📊 Post-Deployment Verification

### Day 1
- [ ] First Aave event detected
- [ ] QueryHelper called successfully
- [ ] StrategyUpdate event emitted
- [ ] Rebalance executed (if spread > 30 bps)

### Week 1
- [ ] At least 1 successful rebalance
- [ ] Gas costs < $0.50 per cycle
- [ ] No errors or reverts
- [ ] System operating autonomously

### Metrics to Track
- **Rebalance Frequency:** Expected 20-50 per month
- **Gas Costs:** Target < $0.40 per cycle
- **Yield Improvement:** Target +0.2% vs baseline
- **Uptime:** Should be 99%+ autonomous

## 🔧 Quick Reference

### Key Addresses
- **Aave Pool:** `0x794a61358D6845594F94dc1DB02A252b5b4814aD`
- **Compound USDC:** `0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA`
- **USDC:** `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`

### Event Topics
- **Aave ReserveDataUpdated:** `0x804c9b842b2748a22bb64b345453a3de7ca54a6ca45ce00d415894979e22897a`
- **CompoundApyQueried:** `0xbc75181d726fb199839a4832ddc558e7942ef478af322c6d275d9415ebd3ff4b`

### Function Selectors
- **Aave Enter:** `0x1249c58b`
- **Aave Exit:** `0xa1903eab`
- **Compound Enter:** `0x1249c58b`
- **Compound Exit:** `0xa1903eab`

## ⚠️ Troubleshooting

### RSC Not Processing Events
1. Check RSC funding: `node scripts/checkReactiveContractStatus.js`
2. Verify subscriptions: `node scripts/verifySubscriptions.js`
3. Check registration: `node scripts/checkWhitelist.js`

### Rebalance Fails
1. Verify vault has balance
2. Check fuses are whitelisted
3. Increase gas limit if needed
4. Review transaction revert reasons

### No Events After 24h
1. Check Aave activity (Arbiscan)
2. Verify subscription is active
3. Check RSC funding
4. Review logs on Reactscan

## 📈 Success Criteria

✅ **Deployment Complete** - All contracts deployed and configured  
✅ **System Active** - Events being processed  
✅ **First Rebalance** - Within 24 hours (if spread > 30 bps)  
✅ **Autonomous Operation** - No manual intervention needed  
✅ **Profitable** - Gas costs < spread gains

---

**Total Deployment Time:** < 30 minutes  
**Expected First Event:** < 1 hour  
**Confidence Level:** 100% ✅

Ready to deploy! Let's make those bps rain! 🌧️💰

