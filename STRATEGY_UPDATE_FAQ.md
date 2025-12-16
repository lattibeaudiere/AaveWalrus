# Quick Answer: Can You Update Strategy?

## ✅ YES! Strategy Updates Are Fully Supported

**TL;DR:** 
- Your vault is **immutable** (can't change owner, base contract)
- Your **strategy (RSC) is completely updatable** ✅
- You can deploy new RSC versions anytime
- Grant ALPHA_ROLE to new RSC
- Old RSC can be kept or disabled

## How Strategy Updates Work

```
Current Setup:
Vault → RSC v1 (has ALPHA_ROLE) → Executes strategy

Update Process:
1. Deploy RSC v2 with improved logic
2. Grant ALPHA_ROLE to RSC v2
3. (Optional) Revoke ALPHA_ROLE from RSC v1
4. Done! Vault now uses new strategy
```

## Perfect for POC

You can iterate through:
- ✅ v1: Basic Aave/Compound strategy
- ✅ v2: Improved thresholds, better logic
- ✅ v3: More protocols, risk management
- ✅ v4: Production-ready version

All using the **same vault**! Just swap the RSC.

## What You Control

| Component | Can Update? | How |
|-----------|-------------|-----|
| **RSC Strategy** | ✅ **YES** | Deploy new RSC, grant ALPHA_ROLE |
| **Protocols (Fuses)** | ✅ **YES** | Add/remove via FuseManager |
| **Parameters** | ✅ **YES** | In new RSC deployment |
| **Asset Limits** | ✅ **YES** | Via Atomist configuration |
| **Vault Owner** | ❌ NO | Set once at deployment |
| **Base Vault Contract** | ❌ NO | Immutable |

**Bottom Line:** You have full flexibility to update your strategy during the POC phase! 🎉
