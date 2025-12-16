const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function testSubscription() {
    const CONTRACT = process.env.RSC_ADDRESS || "0x02c904E571749c61bdd05e58FbF91F7921594186";
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    
    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    
    if (!process.env.REACTIVE_PRIVATE_KEY) {
        console.error("❌ REACTIVE_PRIVATE_KEY not set");
        process.exit(1);
    }
    
    const signer = new ethers.Wallet(process.env.REACTIVE_PRIVATE_KEY, provider);
    
    console.log("🧪 Testing Subscription Functionality...\n");
    
    const CONTRACT_ABI = [
        "function checkVM() external pure returns (bool)",
        "function subscribeTo(uint256 chainId, address contractAddress, uint256 topic0) external payable",
        "event Subscribed(uint256 chainId, address target, uint256 topic0)"
    ];
    
    const contract = new ethers.Contract(CONTRACT, CONTRACT_ABI, signer);
    
    // Test 1: Check VM status
    console.log("TEST 1: Checking VM detection...");
    try {
        const isVM = await contract.checkVM();
        console.log(`   checkVM() returns: ${isVM}`);
        if (isVM) {
            console.log("   ⚠️  Contract thinks it's in VM - subscriptions may not work!");
        } else {
            console.log("   ✅ Contract knows it's on Reactive Network");
        }
    } catch (error) {
        console.log("   ⚠️  Could not call checkVM():", error.message);
    }
    console.log("");
    
    // Test 2: Try a test subscription to see if it emits an event
    console.log("TEST 2: Testing subscription with a dummy address...");
    const TEST_CHAIN_ID = 42161;
    const TEST_CONTRACT = "0x0000000000000000000000000000000000000001"; // Dummy address
    const TEST_TOPIC = "0x0000000000000000000000000000000000000000000000000000000000000001"; // Dummy topic
    
    try {
        console.log("   Attempting test subscription...");
        const tx = await contract.subscribeTo(TEST_CHAIN_ID, TEST_CONTRACT, TEST_TOPIC, {
            gasLimit: 100000
        });
        
        console.log("   Transaction hash:", tx.hash);
        console.log("   Waiting for confirmation...");
        
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
            console.log("   ✅ Transaction succeeded");
            console.log("   Block:", receipt.blockNumber);
            console.log("   Gas used:", receipt.gasUsed.toString());
            
            // Check for Subscribed event
            const iface = new ethers.utils.Interface([
                "event Subscribed(uint256 chainId, address target, uint256 topic0)"
            ]);
            
            let eventFound = false;
            for (const log of receipt.logs) {
                try {
                    const parsed = iface.parseLog(log);
                    if (parsed.name === 'Subscribed') {
                        console.log("   ✅ Subscribed event emitted!");
                        console.log("      Chain ID:", parsed.args.chainId.toString());
                        console.log("      Target:", parsed.args.target);
                        console.log("      Topic:", parsed.args.topic0);
                        eventFound = true;
                        break;
                    }
                } catch (e) {
                    // Not the event
                }
            }
            
            if (!eventFound) {
                console.log("   ⚠️  Subscribed event NOT found in receipt");
                console.log("   This suggests _isVM() returned true, preventing subscription");
            }
            
        } else {
            console.log("   ❌ Transaction failed");
        }
        
    } catch (error) {
        console.log("   ❌ Error:", error.message);
    }
    
    console.log("\n💡 Analysis:");
    console.log("   - If Subscribed event is emitted: subscription works correctly");
    console.log("   - If Subscribed event is NOT emitted: _isVM() check is preventing subscription");
    console.log("   - Even if event not emitted, subscription may still work if system contract was called");
}

testSubscription().catch(console.error);

