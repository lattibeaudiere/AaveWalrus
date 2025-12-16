# Final Implementation Checklist

## ✅ Completed

- [x] QueryHelper contract created with rounding fix
- [x] CompoundApyQueried event topic0 computed
- [x] Monitoring event (StrategyUpdate) added to RSC
- [x] QueryHelper deployment script created
- [x] Documentation created

## 🔧 Critical Fixes Applied

- [x] QueryHelper APY calculation rounding fix
- [x] Event topic0 computation
- [ ] **Aave APY extraction fix (CRITICAL - must fix before deployment)**
  - Remove address from decode
  - Only decode 5 uint256s

## 📋 Implementation To Do

### Phase 1: Contract Updates
- [ ] Add USDC address constant
- [ ] Add fuse address constants (Aave, Compound, Balance fuses)
- [ ] Add vault address (constructor parameter or constant)
- [ ] Implement `_extractAaveApy()` helper (with fix)
- [ ] Implement `_extractCompoundApy()` helper
- [ ] Implement `_calculateSpread()` helper
- [ ] Implement `_buildRebalanceActions()` helper
- [ ] Add `checkCooldown()` modifier or function
- [ ] Implement full `react()` function logic
- [ ] Add `subscribeToQueryHelper()` function

### Phase 2: Deployment
- [ ] Deploy QueryHelper to Arbitrum
- [ ] Update .env with QueryHelper address
- [ ] Redeploy RSC with QueryHelper address
- [ ] Subscribe RSC to Aave events (if not already)
- [ ] Subscribe RSC to QueryHelper events
- [ ] Unsubscribe from Compound AccrueInterest events

### Phase 3: Testing
- [ ] Test Aave event processing on fork
- [ ] Test Compound APY query flow
- [ ] Test spread calculation
- [ ] Test rebalance execution (with mock vault)
- [ ] Test cooldown mechanism
- [ ] Test edge cases (low liquidity, rate anomalies)
- [ ] End-to-end test: 3 successful rebalances

### Phase 4: Production
- [ ] Verify IPOR vault whitelisting (RSC/Adapter registered)
- [ ] Monitor first live Aave event
- [ ] Verify QueryHelper event received
- [ ] Verify rebalance executed (if threshold met)
- [ ] Set up off-chain monitoring (events)
- [ ] Track gas usage and profitability

## 🚨 Critical Before Deployment

1. **Fix Aave decode** - Remove address from abi.decode
2. **Test on fork** - Validate FuseAction encoding
3. **Verify vault address** - Confirm whitelisting
4. **Check gas estimates** - Ensure within limits
5. **Verify fuse addresses** - Confirm correct IPOR fuses

## 📝 Documentation Updates

- [ ] Update dates in docs (Nov 2025)
- [ ] Add version numbers (1.1 post-review)
- [ ] Update COMPLETE_STRATEGY_EXPLANATION.md with fixes
- [ ] Update FINAL_IMPLEMENTATION_SUMMARY.md with fixes
- [ ] Create deployment guide with all steps

## ❓ Open Questions (Answer Before Deployment)

1. **Vault Address:** What is the deployed vault address?
2. **Min Position Size:** Minimum USDC amount to trigger rebalance? (for dust protection)
3. **IPOR Whitelisting:** Are RSC/Adapter already registered in vault?
4. **Balance Queries:** Should we query balance before rebalancing?
5. **Partial Rebalancing:** Implement now or later?

---

**Priority:** Apply Aave decode fix immediately  
**Timeline:** Test on fork before mainnet deployment  
**Readiness:** 90% - Quick fixes, then deploy

