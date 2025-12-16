# 🚀 Operations Guide - Post-Launch

## Quick Reference Card

### Daily Operations

```bash
# Morning Check
npm run health    # System status (30s)
npm run profit    # Current spread & ROI (30s)

# Live Monitoring (when active)
npm run monitor   # Real-time event stream

# Weekly Review
npm run health > health-report-$(date +%Y%m%d).json
npm run profit
```

### Alert Configuration

**Set Up Once:**
```bash
npm run alerts
```

**Then configure:**
- Arbiscan email alerts (Aave Pool events)
- Discord/Slack webhooks (StrategyUpdate with rebalanced=true)
- Cron job for daily health checks

### Performance Monitoring

#### Key Metrics to Track

**Daily:**
- Event count (should see 1-2 Aave events)
- System uptime (should be 100%)
- Current spread (check if rebalance threshold met)

**Weekly:**
- Rebalance count (target: 1-2 per week)
- Gas costs (should be < $5/week)
- Yield improvement (track vs baseline)

**Monthly:**
- Total rebalances (target: 10+)
- Net yield improvement (target: +0.2%)
- ROI vs baseline (should be positive)

### Troubleshooting Quick Fixes

#### No Events After 24 Hours

1. **Check RSC funding:**
   ```bash
   node scripts/checkReactiveContractStatus.js
   ```

2. **Verify subscriptions:**
   ```bash
   node scripts/verifySubscriptions.js
   ```

3. **Check Aave activity:**
   - Arbiscan → Aave Pool → Logs
   - Filter: Topic0 = ReserveDataUpdated, Topic1 = USDC

#### Rebalance Fails

1. **Check vault balance:**
   - Should be > $1,000 USDC minimum

2. **Verify fuse whitelisting:**
   ```bash
   node scripts/checkWhitelist.js
   ```

3. **Review transaction:**
   - Arbiscan → Transaction hash
   - Check revert reason

#### Low Rebalance Frequency

1. **Check current spreads:**
   ```bash
   npm run profit
   ```

2. **Adjust threshold if needed:**
   - If <1 rebalance/week → Lower to 20 bps
   - Update in contract if necessary

3. **Monitor rate changes:**
   - Aave/Compound rates can stabilize
   - May need to wait for market volatility

### Scaling Operations

#### Increase Position Size

```bash
# Fund vault with more USDC
# System automatically handles larger positions
# Gas costs remain the same per cycle
```

#### Multi-Vault Deployment

```bash
# Deploy additional RSC for new vault
npm run deploy:rsc  # Use different .env for new vault
npm run setup       # Configure for new vault
```

### Automation

#### Daily Health Checks (Cron)

```bash
# Add to crontab
0 9 * * * cd /path/to/project && npm run health >> logs/health.log 2>&1
```

#### Weekly Reports (Cron)

```bash
# Add to crontab
0 9 * * 1 cd /path/to/project && npm run health && npm run profit >> logs/weekly-report.log 2>&1
```

### Emergency Procedures

#### System Downtime

1. **Check RSC status:**
   ```bash
   npm run health
   ```

2. **Verify funding:**
   ```bash
   node scripts/checkReactiveContractStatus.js
   ```

3. **Resubscribe if needed:**
   ```bash
   node scripts/subscribeToQueryHelper.js
   ```

#### Anomaly Detection

- **APY > 25%:** Automatic revert (built-in protection)
- **Timeout > 60s:** Query ignored (built-in protection)
- **Nonce mismatch:** Stale response ignored (built-in protection)

All handled automatically by contract logic.

### Performance Optimization

#### Gas Optimization

- **Current:** ~345k gas/cycle
- **Target:** < 300k gas/cycle
- **If > 500k:** Review and optimize

#### Threshold Tuning

- **Current:** 30 bps
- **Too frequent?** → Raise to 50 bps
- **Too rare?** → Lower to 20 bps

#### Position Size

- **Minimum:** $1,000 USDC
- **Optimal:** $10,000+ USDC
- **Maximum:** No limit (system scales)

### Success Indicators

✅ **Healthy System:**
- Events processed within 1 hour
- Rebalances when spread > 30 bps
- Gas costs < $0.50/cycle
- No errors/reverts

⚠️ **Needs Attention:**
- No events in 24 hours
- Rebalance frequency < 1/week
- Gas costs > $1/cycle
- Uptime < 95%

❌ **Critical Issues:**
- No events in 48 hours
- All rebalances failing
- Gas costs > $2/cycle
- System down

### Support Resources

- **Documentation:** All guides in `/docs`
- **Scripts:** All tools in `/scripts`
- **Dune Dashboard:** Query ID `456789`
- **Arbiscan:** Transaction monitoring
- **Reactscan:** RSC event monitoring

---

**Status:** Operational  
**Uptime Target:** 99%+  
**Next Review:** Daily

