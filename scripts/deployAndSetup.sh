#!/bin/bash
# Complete deployment and setup script for Fusion Reactive RSC
# This script deploys, funds, and subscribes to events in one go

set -e

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Defaults
REACTIVE_RPC=${REACTIVE_RPC:-"https://mainnet-rpc.rnk.dev"}
REACTIVE_SERVICE=${REACTIVE_SERVICE:-"0x0000000000000000000000000000000000fffFfF"}
ADAPTER_ADDRESS=${ADAPTER_ADDRESS:-""}

if [ -z "$REACTIVE_PRIVATE_KEY" ]; then
    echo "❌ REACTIVE_PRIVATE_KEY not set in .env"
    exit 1
fi

if [ -z "$ADAPTER_ADDRESS" ]; then
    echo "❌ ADAPTER_ADDRESS not set in .env"
    exit 1
fi

echo "🚀 Starting Complete Deployment and Setup..."
echo ""

# Step 1: Deploy
echo "STEP 1: Deploying FusionReactiveRSC..."
cd reactive

export REACTIVE_SERVICE REACTIVE_PRIVATE_KEY ADAPTER_ADDRESS

forge script script/DeployRSC.s.sol \
    --rpc-url "$REACTIVE_RPC" \
    --broadcast \
    -vvv

# Extract contract address from broadcast artifacts
CONTRACT_ADDR=$(grep -A 5 '"contractAddress"' broadcast/DeployRSC.s.sol/*/run-latest.json | head -1 | grep -o '0x[a-fA-F0-9]\{40\}' | head -1)

if [ -z "$CONTRACT_ADDR" ]; then
    echo "❌ Failed to extract contract address"
    exit 1
fi

echo "✅ Deployed at: $CONTRACT_ADDR"
echo ""

# Step 2: Fund
echo "STEP 2: Funding contract..."
cast send "$CONTRACT_ADDR" \
    --value 1ether \
    --rpc-url "$REACTIVE_RPC" \
    --private-key "$REACTIVE_PRIVATE_KEY"

echo "✅ Funded"
echo ""

# Step 3: Subscribe to Aave
echo "STEP 3: Subscribing to Aave V3..."
AAVE_POOL="0x794a61358D6845594F94dc1DB02A252b5b4814aD"
RESERVE_DATA_UPDATED="0xb2a02bf1a92354a66946e3533277a66dd13726c1695e5ac302d1c1fcb97d2200"

cast send "$CONTRACT_ADDR" \
    "subscribeTo(uint256,address,uint256)" \
    42161 \
    "$AAVE_POOL" \
    "$RESERVE_DATA_UPDATED" \
    --rpc-url "$REACTIVE_RPC" \
    --private-key "$REACTIVE_PRIVATE_KEY"

echo "✅ Subscribed to Aave V3"
echo ""

# Step 4: Check Compound events
echo "STEP 4: Checking Compound V3 events..."
cd ..
node scripts/checkCompoundEvents.js
echo ""

# Step 5: Subscribe to Compound (if event found)
echo "STEP 5: Subscribe to Compound V3 manually after verifying event"
echo "Run: node scripts/subscribeToCompound.js"
echo ""

echo "🎉 Setup Complete!"
echo "Contract: $CONTRACT_ADDR"
echo "Network: Reactive Network (Chain 1597)"

