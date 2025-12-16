const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function fixSubscriptions() {
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0x5eBe4dB39B498511c871DCdF3f5D3afD707228c2";
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    
    if (!process.env.REACTIVE_PRIVATE_KEY) {
        console.error("❌ REACTIVE_PRIVATE_KEY not set");
        process.exit(1);
    }
    
    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    const signer = new ethers.Wallet(process.env.REACTIVE_PRIVATE_KEY, provider);
    
    console.log("=".repeat(60));
    console.log("🔧 FIXING SUBSCRIPTIONS");
    console.log("=".repeat(60));
    console.log(`Contract: ${RSC_ADDRESS}`);
    console.log("");
    
    const ABI = [
        "function unsubscribeFromAave() external",
        "function unsubscribeFromCompound() external",
        "function subscribeToAave() external",
        "function subscribeToCompound() external",
        "function aaveSubscribed() view returns (bool)",
        "function compoundSubscribed() view returns (bool)"
    ];
    
    const contract = new ethers.Contract(RSC_ADDRESS, ABI, signer);
    
    // Step 1: Unsubscribe from wrong events
    console.log("STEP 1: Unsubscribing from incorrect events...");
    console.log("-".repeat(60));
    
    try {
        const aaveSub = await contract.aaveSubscribed();
        const compoundSub = await contract.compoundSubscribed();
        
        if (aaveSub) {
            console.log("   Unsubscribing from Aave (wrong signature)...");
            const tx = await contract.unsubscribeFromAave({ gasLimit: 500000 });
            await tx.wait();
            console.log("   ✅ Unsubscribed from Aave");
        } else {
            console.log("   ⏭️  Not subscribed to Aave");
        }
        
        if (compoundSub) {
            console.log("   Unsubscribing from Compound...");
            const tx = await contract.unsubscribeFromCompound({ gasLimit: 500000 });
            await tx.wait();
            console.log("   ✅ Unsubscribed from Compound");
        } else {
            console.log("   ⏭️  Not subscribed to Compound");
        }
    } catch (error) {
        console.log(`   ⚠️  Error unsubscribing: ${error.message}`);
        console.log("   Continuing to subscribe step...");
    }
    
    console.log("");
    
    // Step 2: Wait a moment for unsubscriptions to process
    console.log("Waiting 3 seconds for unsubscriptions to process...");
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 3: Resubscribe with correct signatures
    console.log("\nSTEP 2: Resubscribing with CORRECT event signatures...");
    console.log("-".repeat(60));
    
    // Note: You'll need to deploy a new contract with the corrected signature
    // OR manually call subscribeTo() with the correct topic0
    
    console.log("⚠️  IMPORTANT: The contract needs to be updated with the correct event signature");
    console.log("");
    console.log("Correct Aave V3 ReserveDataUpdated signature:");
    console.log("  0x804c9b842b2748a22bb64b345453a3de7ca54a6ca45ce00d415894979e22897a");
    console.log("");
    console.log("Options:");
    console.log("  1. Deploy new contract with corrected signature");
    console.log("  2. Manually subscribe using cast with correct topic0");
    console.log("");
    
    // Try to resubscribe (will fail if contract hasn't been updated)
    try {
        console.log("   Attempting to resubscribe to Aave...");
        const tx = await contract.subscribeToAave({ gasLimit: 1000000 });
        await tx.wait();
        console.log("   ✅ Resubscribed to Aave with correct signature");
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        console.log("   💡 Need to deploy updated contract first");
    }
    
    try {
        console.log("   Attempting to resubscribe to Compound...");
        const tx = await contract.subscribeToCompound({ gasLimit: 1000000 });
        await tx.wait();
        console.log("   ✅ Resubscribed to Compound");
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log("");
    console.log("=".repeat(60));
    console.log("📝 NEXT STEPS");
    console.log("=".repeat(60));
    console.log("");
    console.log("1. Deploy updated contract with correct event signature");
    console.log("2. Subscribe using the new contract");
    console.log("3. Or manually subscribe using:");
    console.log(`   cast send ${RSC_ADDRESS} "subscribeTo(uint256,address,uint256)" \\`);
    console.log(`     42161 0x794a61358D6845594F94dc1DB02A252b5b4814aD \\`);
    console.log(`     0x804c9b842b2748a22bb64b345453a3de7ca54a6ca45ce00d415894979e22897a \\`);
    console.log(`     --rpc-url $REACTIVE_RPC --private-key $REACTIVE_PRIVATE_KEY`);
}

fixSubscriptions().catch(console.error);

