const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function testNewContractSubscription() {
    // NEWEST CONTRACT
    const CONTRACT = "0x0443d566433992B0C298ebD68768E7921cbC0BDF";
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    
    if (!process.env.REACTIVE_PRIVATE_KEY) {
        console.error("❌ REACTIVE_PRIVATE_KEY not set");
        process.exit(1);
    }
    
    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    const signer = new ethers.Wallet(process.env.REACTIVE_PRIVATE_KEY, provider);
    
    console.log("🧪 Testing Subscription on New Contract...\n");
    console.log("Contract:", CONTRACT);
    console.log("Signer:", signer.address);
    console.log("");
    
    // Check contract state first
    const ABI = [
        "function owner() view returns (address)",
        "function aavePool() view returns (address)",
        "function compoundUsdc() view returns (address)",
        "function subscribeTo(uint256 chainId, address contractAddress, uint256 topic0) external payable"
    ];
    
    const contract = new ethers.Contract(CONTRACT, ABI, provider);
    
    const owner = await contract.owner();
    const aavePool = await contract.aavePool();
    
    console.log("Contract State:");
    console.log("  Owner:", owner);
    console.log("  Aave Pool:", aavePool);
    
    if (owner.toLowerCase() !== signer.address.toLowerCase()) {
        console.error("❌ Signer is not the owner!");
        process.exit(1);
    }
    
    // Check if contract is funded
    const balance = await provider.getBalance(CONTRACT);
    console.log("  Balance:", ethers.utils.formatEther(balance), "REACT");
    console.log("");
    
    // Try to estimate gas for subscription
    console.log("📊 Estimating gas for subscription...");
    const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
    const RESERVE_DATA_UPDATED = "0xb2a02bf1a92354a66946e3533277a66dd13726c1695e5ac302d1c1fcb97d2200";
    const ARBITRUM_CHAIN_ID = 42161;
    
    try {
        // Try static call first to see what happens
        console.log("  Trying static call...");
        const subscribeContract = new ethers.Contract(CONTRACT, ABI, signer);
        
        const result = await subscribeContract.callStatic.subscribeTo(
            ARBITRUM_CHAIN_ID,
            AAVE_POOL,
            RESERVE_DATA_UPDATED
        );
        
        console.log("  ✅ Static call succeeded:", result);
        
    } catch (error) {
        console.log("  ❌ Static call failed:", error.message);
        
        // Check if it's a revert with a reason
        if (error.reason) {
            console.log("  Reason:", error.reason);
        }
        
        // Try to decode the error
        if (error.data && error.data !== "0x") {
            console.log("  Error data:", error.data);
            try {
                // Try to decode common errors
                const commonErrors = [
                    "execution reverted: insufficient funds",
                    "execution reverted: not authorized",
                    "execution reverted: invalid subscription"
                ];
                console.log("  Possible error:", error.data);
            } catch (e) {
                console.log("  Could not decode error");
            }
        }
    }
    
    console.log("");
    console.log("=".repeat(60));
    console.log("💡 DIAGNOSIS");
    console.log("=".repeat(60));
    console.log("");
    console.log("The system contract subscribe() is reverting.");
    console.log("Possible causes:");
    console.log("");
    console.log("1. Contract needs funding BEFORE subscribing");
    console.log("   → Fund first, then subscribe (not in constructor)");
    console.log("");
    console.log("2. System contract requires value with subscribe()");
    console.log("   → subscribe() is payable - may need REACT sent");
    console.log("");
    console.log("3. Subscription validation in system contract");
    console.log("   → Parameters might not meet system requirements");
    console.log("");
    console.log("4. Contract needs to be 'registered' first");
    console.log("   → May need initialization or registration step");
    console.log("");
    console.log("📝 Recommendation:");
    console.log("   - Fund contract first");
    console.log("   - Try subscribing with value attached");
    console.log("   - Check Reactive Network docs for requirements");
    console.log("");
}

testNewContractSubscription().catch(console.error);

