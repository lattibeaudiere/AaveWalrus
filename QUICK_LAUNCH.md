# Quick Launch Guide - Production Deployment

## ⚡ Fastest Path to Production (< 30 minutes)

### Prerequisites
- [ ] `.env` file configured with all addresses
- [ ] Vault deployed and funded
- [ ] Whitelisting verified

### 1. Deploy QueryHelper (5 min)
```bash
node scripts/deployQueryHelper.js
```
**Output:** Copy `QUERY_HELPER_ADDRESS` to `.env`

### 2. Deploy RSC (10 min)
```bash
cd reactive
forge script script/DeployRSC.s.sol:DeployRSC \
  --rpc-url $REACTIVE_RPC \
  --broadcast \
  --private-key $REACTIVE_PRIVATE_KEY
```
**Output:** Copy `RSC_ADDRESS` to `.env`

### 3. Setup & Subscribe (5 min)
```bash
# Fund RSC
node scripts/fundAndCoverDebt.js

# Subscribe to QueryHelper
node scripts/subscribeToQueryHelper.js

# Register RSC (if needed)
node scripts/registerRSC.js
```

### 4. Verify & Monitor (5 min)
```bash
# Check health
node scripts/healthReport.js

# Check profitability
node scripts/calcProfit.js

# Setup alerts
node scripts/setupAlerts.js
```

## ✅ Verification Checklist

- [ ] QueryHelper deployed and tested
- [ ] RSC deployed with all addresses
- [ ] RSC funded on Reactive Network
- [ ] Subscribed to Aave events
- [ ] Subscribed to QueryHelper events
- [ ] RSC registered in adapter
- [ ] Vault has USDC balance (> $1k)

## 📊 First 24 Hours

**Expected Timeline:**
- 0-1h: First Aave event
- 1-2h: QueryHelper response
- 2-3h: StrategyUpdate emitted
- 3-24h: First rebalance (if spread > 30 bps)

**Monitoring:**
- Arbiscan: Aave Pool events
- Reactscan: RSC events
- StrategyUpdate: Rebalance confirmations

## 🎯 Success Metrics

**Week 1:**
- ✅ At least 1 rebalance executed
- ✅ Gas costs < $0.50/cycle
- ✅ System autonomous

**Month 1:**
- ✅ 10+ rebalances
- ✅ +0.2% yield improvement
- ✅ 99%+ uptime

---

**Status:** ✅ Ready to Launch  
**Time:** < 30 minutes  
**Confidence:** 100%

