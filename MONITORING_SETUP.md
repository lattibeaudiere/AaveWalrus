# Monitoring & Alerts Setup

## 📊 Dashboard Setup

### Dune Analytics Query

**File:** `dune/apy_optimizer_dashboard.sql`

**Setup:**
1. Go to https://dune.com
2. Create new query
3. Paste SQL from `dune/apy_optimizer_dashboard.sql`
4. Update RSC address and StrategyUpdate topic0
5. Save and create dashboard

**Metrics Tracked:**
- Daily rebalance count
- Average spread
- APY comparisons
- Rebalance rate

### StrategyUpdate Event

**Event Signature:**
```solidity
event StrategyUpdate(
    uint256 aaveApy,      // Aave APY in basis points
    uint256 compoundApy,  // Compound APY in basis points
    uint256 spread,       // Spread in basis points
    bool rebalanced       // Whether rebalance was executed
);
```

**Topic0:** `keccak256("StrategyUpdate(uint256,uint256,uint256,bool)")`

**Monitor On:**
- Reactscan.io (Reactive Network)
- Dune Analytics (via custom query)
- Tenderly (for debugging)

## 🔔 Alert Configuration

### Arbiscan Alerts

**For Aave Events:**
- Contract: `0x794a61358D6845594F94dc1DB02A252b5b4814aD`
- Event: `ReserveDataUpdated`
- Filter: Topic1 = USDC address

**Setup:**
1. Go to: https://arbiscan.io/address/0x794a61358D6845594F94dc1DB02A252b5b4814aD
2. Click "Logs" → Create Alert
3. Configure filters → Email/Slack notification

### Discord/Slack Integration

**Use StrategyUpdate Events:**
- Filter: `rebalanced = true`
- Message: "🔄 Rebalance executed! Spread: X bps"

**Tools:**
- Gelato Automation
- Chainlink Automation
- Custom webhook

## 📈 Health Checks

### Daily Checks

```bash
# Generate health report
node scripts/healthReport.js

# Calculate profitability
node scripts/calcProfit.js
```

### Weekly Review

- Check rebalance frequency
- Review gas costs
- Analyze yield improvement
- Adjust threshold if needed

## 🎯 Target Metrics

| Metric | Target | Alert If |
|--------|--------|----------|
| Event Processing | 100% | No events in 24h |
| Gas per Cycle | < 300k | > 500k |
| Rebalance Frequency | 20-50/month | < 5/month or > 100/month |
| Spread Profit | > 30 bps net | < 20 bps avg |
| System Uptime | 99%+ | < 95% |

---

**Status:** Monitoring tools ready  
**Next:** Configure alerts post-deployment

