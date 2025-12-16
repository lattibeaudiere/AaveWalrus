# Deploy IPOR Fusion Vault First

## Current Situation

You need to deploy an IPOR Fusion Plasma Vault before deploying the RSC integration.

## Two Options

### Option A: Use IPOR's Lorem Ipsum Factory (Recommended)

IPOR provides deployed factory contracts. Find them at:
- https://docs.ipor.io/ipor-fusion
- https://github.com/IPOR-Labs/ipor-abi

**Steps:**
1. Look for "FusionFactory" deployed on Arbitrum
2. Use the factory to create your vault
3. Follow IPOR's official deployment docs

### Option B: Manual Deployment (Complex)

The vault requires many components and proper initialization. It's recommended to use IPOR's factory.

## What You Actually Need

Since this is a **proof-of-concept**, you might want to:

1. **Deploy to Testnet First**
   - Use Arbitrum Goerli
   - Test the full integration
   - Then deploy to mainnet

2. **Or Use Mock/Simplified Version**
   - Create a minimal vault for testing
   - Focus on the RSC integration first
   - Upgrade to full IPOR vault later

## Recommended Next Steps

1. **Contact IPOR** for help deploying a vault:
   - Discord: IPOR Protocol
   - Docs: https://docs.ipor.io

2. **Or Test Locally First**:
   ```bash
   npm run node  # Start local blockchain
   # Deploy simplified version for testing
   ```

3. **Check IPOR GitHub**:
   - https://github.com/IPOR-Labs/ipor-fusion
   - Look for deployment examples
   - Check the `test/` folder for deployment helpers

## For Now

Until you have a vault deployed, you can:

- Review all the code
- Test the RSC logic
- Prepare deployment configuration
- Set up monitoring

Once you have the vault address, the RSC deployment is just one command away!

