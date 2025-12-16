# Complete Reactive Network Setup Guide

## ✅ **WHAT EVENTS TO SUBSCRIBE TO & WHY**

---

## 🎯 **EVENTS TO MONITOR**

### 1. **Aave V3: ReserveDataUpdated Event** (PRIMARY)

**Event Signature:**
```solidity
ReserveDataUpdated(
    address indexed reserve,      // USDC address
    uint256 liquidityRate,        // Supply APY (what we care about!)
    uint256 stableBorrowRate,
    uint256 variableBorrowRate,
    uint256 liquidityIndex,
    uint256 variableBorrowIndex
)
```

**Event Topic:**
```
0xb2a02bf1a92354a66946e3533277a66dd13726c1695e5ac302d1c1fcb97d2200
```

**Contract Address (Arbitrum):**
```
0x794a61358D6845594F94dc1DB02A252b5b4814aD
```

**Why This Event:**
- ✅ **Direct APY indicator**: `liquidityRate` is the supply APY
- ✅ **Fires frequently**: Every time reserve parameters update
- ✅ **Captures all rate changes**: Large deposits, withdrawals, utilization changes
- ✅ **Well-documented**: Standard Aave V3 event

**When It Fires:**
- Large deposits/withdrawals change utilization
- Borrow rates adjust
- Governance updates rates
- Utilization crosses thresholds (80%, 90%, etc.)

---

### 2. **Compound V3: AccrueInterest Event** (RECOMMENDED)

**Event Signature:**
```solidity
AccrueInterest(
    uint256 timeStamp,
    uint256 baseSupplyIndex,
    uint256 baseBorrowIndex,
    uint256 totalSupplyBase,
    uint256 totalBorrowBase
)
```

**Event Topic:**
```bash
# Calculate with:
cast sig-event "AccrueInterest(uint256,uint256,uint256,uint256,uint256)"
```

**Contract Address (Arbitrum):**
```
0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA
```

**Why This Event:**
- ✅ **Rate indicator**: Fires when interest accrues (rate updates)
- ✅ **Market state**: Contains supply/borrow indices that affect APY
- ✅ **Frequency**: Fires periodically as interest compounds

**Alternative Events (if AccrueInterest not found):**
- `Supply(address,address,uint256)` - Fires on deposits (indirect indicator)
- `Withdraw(address,address,uint256)` - Fires on withdrawals (indirect indicator)
- `MarketUpdate(...)` - If Compound V3 has this event

**Verification Needed:**
Before subscribing, run:
```bash
node scripts/checkCompoundEvents.js
```
This will show you which events actually exist on Compound V3.

---

## 📋 **COMPLETE SETUP PROCESS**

### **Option A: Step-by-Step (Recommended for First Time)**

1. **Fund the Contract:**
   ```bash
   node scripts/fundContract.js
   ```

2. **Subscribe to Aave V3:**
   ```bash
   node scripts/subscribeToAave.js
   ```

3. **Find Compound V3 Event:**
   ```bash
   node scripts/checkCompoundEvents.js
   ```

4. **Subscribe to Compound V3:**
   ```bash
   node scripts/subscribeToCompound.js
   ```

5. **Verify Setup:**
   ```bash
   node scripts/verifySubscriptions.js
   ```

### **Option B: Complete Setup (All-in-One)**

Run the complete setup script:
```bash
node scripts/completeSetup.js
```

This does everything automatically:
- ✅ Checks your balance
- ✅ Funds the RSC contract
- ✅ Subscribes to Aave V3
- ✅ Verifies and subscribes to Compound V3
- ✅ Provides final status

---

## 🔍 **HOW IT WORKS**

### Event Flow:

```
1. Aave V3 emits ReserveDataUpdated event on Arbitrum
   ↓
2. Reactive Network Sequencer detects the event
   ↓
3. Reactive Network calls react() on your RSC (on chain 1597)
   ↓
4. Your RSC:
   - Identifies eventSource = Aave Pool
   - Fetches current Aave APY
   - Fetches current Compound APY
   - Calculates spread
   - If spread > threshold:
     - Constructs FuseAction[]
     - Calls adapter.executeReaction()
   ↓
5. ReactiveAlphaAdapter (on Arbitrum):
   - Validates RSC is registered
   - Calls vault.execute(actions)
   ↓
6. IPOR Fusion Vault executes rebalance:
   - Withdraws from lower-yielding protocol
   - Deposits to higher-yielding protocol
```

---

## ⚙️ **ENVIRONMENT VARIABLES**

Add these to your `.env` file:

```bash
# Reactive Network Configuration
REACTIVE_RPC=https://mainnet-rpc.rnk.dev
REACTIVE_PRIVATE_KEY=0x...  # Your private key (with 0x prefix)

# RSC Contract Address (deployed)
RSC_ADDRESS=0x510682F3bd0F8ACB51C40CDE60132c52420Efc3F

# Funding Amount (optional, defaults to 1 REACT)
FUND_AMOUNT=1.0

# Compound Event Override (optional)
COMPOUND_EVENT_TOPIC=0x...  # If you found a different event
COMPOUND_EVENT_NAME=AccrueInterest  # For reference
```

---

## 🔧 **AVAILABLE SCRIPTS**

All scripts are in `scripts/` directory:

| Script | Purpose |
|--------|---------|
| `fundContract.js` | Fund the RSC with REACT tokens |
| `subscribeToAave.js` | Subscribe to Aave V3 ReserveDataUpdated |
| `checkCompoundEvents.js` | Find Compound V3 event signatures |
| `subscribeToCompound.js` | Subscribe to Compound V3 event |
| `verifySubscriptions.js` | Verify RSC status and subscriptions |
| `completeSetup.js` | Complete setup (all-in-one) |

---

## ✅ **VERIFICATION CHECKLIST**

After setup, verify:

- [ ] RSC contract is deployed
- [ ] Contract has REACT balance (>0.1 REACT)
- [ ] You are the contract owner
- [ ] Subscribed to Aave V3 ReserveDataUpdated
- [ ] Subscribed to Compound V3 event (AccrueInterest or alternative)
- [ ] Adapter address is configured correctly
- [ ] Adapter has ALPHA_ROLE on vault

---

## 🐛 **TROUBLESHOOTING**

### Issue: "Insufficient balance"
- **Solution**: Fund your wallet with REACT tokens first
- **Check**: `cast balance <YOUR_ADDRESS> --rpc-url $REACTIVE_RPC`

### Issue: "Not the owner"
- **Solution**: Use the private key that deployed the contract
- **Check**: `cast call $CONTRACT "owner()(address)" --rpc-url $REACTIVE_RPC`

### Issue: "Compound event not found"
- **Solution**: Run `node scripts/checkCompoundEvents.js` to find actual events
- **Alternative**: Check Compound V3 documentation for event signatures

### Issue: "Transaction reverted"
- **Possible causes**:
  - Contract has `require(!vm)` check preventing local calls
  - Not enough gas
  - Event signature doesn't exist on target contract
- **Solution**: Check error message and verify event signature

### Issue: "No events being processed"
- **Possible causes**:
  - No actual events emitted on Arbitrum yet (wait for activity)
  - Event filters too strict in `react()` function
  - Contract balance too low for callbacks
- **Solution**: Monitor with `node scripts/monitorEvents.js` (if available)

---

## 📚 **RESOURCES**

- **Aave V3 Docs**: [docs.aave.com](https://docs.aave.com)
- **Compound V3 Docs**: [docs.compound.finance](https://docs.compound.finance)
- **Reactive Network**: [reactive.network](https://reactive.network)
- **IPOR Fusion**: [docs.ipor.io/ipor-fusion](https://docs.ipor.io/ipor-fusion)

---

## 🎯 **SUMMARY**

**Events to Subscribe:**
1. ✅ **Aave V3 ReserveDataUpdated** - Confirmed, subscribe now
2. ⚠️ **Compound V3 AccrueInterest** - Verify first, then subscribe

**Why These Events:**
- Direct indicators of APY changes
- Fire when rate updates occur
- Enable instant rebalancing opportunities

**Next Steps:**
1. Fund the contract: `node scripts/fundContract.js`
2. Subscribe to Aave: `node scripts/subscribeToAave.js`
3. Verify Compound: `node scripts/checkCompoundEvents.js`
4. Subscribe to Compound: `node scripts/subscribeToCompound.js`
5. Monitor: Watch for events triggering your `react()` function

Your RSC is now ready to autonomously optimize yield between Aave V3 and Compound V3! 🚀

