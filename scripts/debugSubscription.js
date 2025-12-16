const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function debugSubscription() {
    const CONTRACT = process.env.RSC_ADDRESS || "0x02c904E571749c61bdd05e58FbF91F7921594186";
    const SYSTEM_CONTRACT = "0x0000000000000000000000000000000000fffFfF";
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    
    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    
    if (!process.env.REACTIVE_PRIVATE_KEY) {
        console.error("❌ REACTIVE_PRIVATE_KEY not set");
        process.exit(1);
    }
    
    const signer = new ethers.Wallet(process.env.REACTIVE_PRIVATE_KEY, provider);
    
    console.log("🔍 Debugging Subscription...\n");
    console.log("RSC:", CONTRACT);
    console.log("System Contract:", SYSTEM_CONTRACT);
    console.log("Signer:", signer.address);
    console.log("");
    
    // Check if we can call the system contract directly
    console.log("TEST 1: Calling System Contract directly...");
    const SYSTEM_ABI = [
        "function subscribe(uint256 chainId, address contractAddress, uint256 topic0, bytes32 topic1, bytes32 topic2, bytes32 topic3) external payable"
    ];
    
    const REACTIVE_IGNORE = "0xa65f96fc951c35ead38878e0f0b7a3c744a6f5ccc1476b313353ce31712313ad";
    const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
    const RESERVE_DATA_UPDATED = "0xb2a02bf1a92354a66946e3533277a66dd13726c1695e5ac302d1c1fcb97d2200";
    
    try {
        const systemContract = new ethers.Contract(SYSTEM_CONTRACT, SYSTEM_ABI, signer);
        
        // Try to call subscribe directly on system contract
        console.log("   Attempting direct subscription to system contract...");
        const tx = await systemContract.subscribe(
            42161,
            AAVE_POOL,
            RESERVE_DATA_UPDATED,
            REACTIVE_IGNORE,
            REACTIVE_IGNORE,
            REACTIVE_IGNORE,
            { value: 0, gasLimit: 100000 }
        );
        
        console.log("   ✅ Direct subscription sent:", tx.hash);
        const receipt = await tx.wait();
        console.log("   ✅ Direct subscription confirmed:", receipt.status === 1 ? "Success" : "Failed");
        
    } catch (error) {
        console.log("   ❌ Error calling system contract directly:", error.message);
        
        // Check if it's a revert reason
        if (error.reason) {
            console.log("   Reason:", error.reason);
        }
        if (error.data) {
            console.log("   Data:", error.data);
        }
    }
    
    console.log("");
    
    // Check what the RSC contract is actually doing
    console.log("TEST 2: Checking RSC contract subscription function...");
    const RSC_ABI = [
        "function subscribeTo(uint256 chainId, address contractAddress, uint256 topic0) external payable",
        "function service() view returns (address)",
        "function owner() view returns (address)"
    ];
    
    try {
        const rscContract = new ethers.Contract(CONTRACT, RSC_ABI, provider);
        
        const serviceAddr = await rscContract.service();
        const ownerAddr = await rscContract.owner();
        
        console.log("   Service:", serviceAddr);
        console.log("   Owner:", ownerAddr);
        console.log("   Signer:", signer.address);
        
        if (ownerAddr.toLowerCase() !== signer.address.toLowerCase()) {
            console.log("   ⚠️  Signer is not the owner!");
        } else {
            console.log("   ✅ Signer is the owner");
        }
        
        // Try to estimate gas for subscription
        console.log("   Estimating gas for subscription...");
        try {
            const estimatedGas = await rscContract.estimateGas.subscribeTo(
                42161,
                AAVE_POOL,
                RESERVE_DATA_UPDATED
            );
            console.log("   ✅ Gas estimate:", estimatedGas.toString());
        } catch (error) {
            console.log("   ❌ Gas estimation failed:", error.message);
        }
        
    } catch (error) {
        console.log("   ❌ Error checking RSC:", error.message);
    }
    
    console.log("");
    
    // Try subscription through RSC
    console.log("TEST 3: Subscribing through RSC contract...");
    try {
        const rscContract = new ethers.Contract(CONTRACT, RSC_ABI, signer);
        
        // Use callStatic to see what would happen without sending tx
        try {
            const result = await rscContract.callStatic.subscribeTo(
                42161,
                AAVE_POOL,
                RESERVE_DATA_UPDATED
            );
            console.log("   ✅ Static call succeeded:", result);
        } catch (error) {
            console.log("   ❌ Static call failed:", error.message);
            if (error.reason) console.log("   Reason:", error.reason);
        }
        
        // Now try actual transaction
        console.log("   Sending subscription transaction...");
        const tx = await rscContract.subscribeTo(
            42161,
            AAVE_POOL,
            RESERVE_DATA_UPDATED,
            { gasLimit: 200000 }
        );
        
        console.log("   Transaction sent:", tx.hash);
        const receipt = await tx.wait();
        
        console.log("   Status:", receipt.status === 1 ? "Success" : "Failed");
        console.log("   Gas Used:", receipt.gasUsed.toString());
        console.log("   Logs:", receipt.logs.length);
        
        if (receipt.logs.length > 0) {
            console.log("   ✅ Events were emitted!");
        } else {
            console.log("   ⚠️  No events emitted - subscription may have failed silently");
        }
        
    } catch (error) {
        console.log("   ❌ Error subscribing:", error.message);
        if (error.reason) console.log("   Reason:", error.reason);
        if (error.data) console.log("   Data:", error.data);
    }
}

debugSubscription().catch(console.error);

