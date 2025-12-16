# ✅ Final Launch Checklist

## Pre-Flight (5 minutes)

### Environment
- [ ] `.env` file configured
- [ ] `TARGET_VAULT` address set
- [ ] `QUERY_HELPER_ADDRESS` (will be set after deployment)
- [ ] `RSC_ADDRESS` (will be set after deployment)
- [ ] `ADAPTER_ADDRESS` confirmed
- [ ] `REACTIVE_RPC` configured
- [ ] `ARBITRUM_RPC` configured
- [ ] `REACTIVE_PRIVATE_KEY` set
- [ ] `ARBITRUM_PRIVATE_KEY` set

### Whitelisting
- [ ] Vault deployed and accessible
- [ ] Adapter has ALPHA_ROLE on vault
- [ ] RSC will be registered in adapter (post-deploy)

### Funding
- [ ] Vault has USDC balance (> $1,000)
- [ ] RSC deployer has REACT for deployment

## Launch Sequence (30 minutes)

### Step 1: Deploy QueryHelper (5 min)
```bash
npm run deploy:queryhelper
```
- [ ] QueryHelper deployed
- [ ] Address saved to `.env`
- [ ] Contract verified (if --verify used)

### Step 2: Deploy RSC (10 min)
```bash
npm run deploy:rsc
```
- [ ] RSC deployed
- [ ] Address saved to `.env`
- [ ] All constructor parameters correct

### Step 3: Setup (5 min)
```bash
npm run setup
```
- [ ] RSC funded
- [ ] Subscribed to QueryHelper
- [ ] Registered in adapter

### Step 4: Verify (5 min)
```bash
npm run health
npm run profit
npm run alerts
```
- [ ] Health check passed
- [ ] Profitability calculated
- [ ] Alerts configured

### Step 5: Monitor (Ongoing)
```bash
npm run monitor
```
- [ ] Live monitor running
- [ ] Waiting for first event

## First 24 Hours

### First Hour
- [ ] First Aave event detected
- [ ] RSC react() called
- [ ] QueryHelper queried
- [ ] StrategyUpdate emitted

### First Day
- [ ] Multiple cycles completed
- [ ] First rebalance (if spread > 30 bps)
- [ ] System autonomous
- [ ] No errors/reverts

## Success Criteria

### Immediate (T+1 hour)
- [x] System deployed
- [ ] First event processed
- [ ] No critical errors

### Day 1
- [ ] 1+ rebalances (if applicable)
- [ ] Gas costs within budget
- [ ] System stable

### Week 1
- [ ] 2-5 rebalances
- [ ] +0.1-0.3% yield improvement
- [ ] Autonomous operation confirmed

### Month 1
- [ ] 10+ rebalances
- [ ] +0.2% yield improvement
- [ ] Positive ROI

## Troubleshooting Quick Reference

### No Events
```bash
node scripts/checkReactiveContractStatus.js
node scripts/verifySubscriptions.js
```

### Rebalance Fails
- Check vault balance
- Verify fuse whitelisting
- Review transaction logs

### Low Frequency
- Check spreads: `npm run profit`
- Consider threshold adjustment
- Monitor rate changes

---

**Status:** Complete checklist  
**Confidence:** 100%  
**Ready:** ✅ GO FOR LAUNCH

