const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function subscribeWithValue() {
    // NEWEST CONTRACT
    const CONTRACT = "0x0443d566433992B0C298ebD68768E7921cbC0BDF";
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    
    if (!process.env.REACTIVE_PRIVATE_KEY) {
        console.error("❌ REACTIVE_PRIVATE_KEY not set");
        process.exit(1);
    }
    
    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    const signer = new ethers.Wallet(process.env.REACTIVE_PRIVATE_KEY, provider);
    
    console.log("🔗 Subscribing with Value...\n");
    console.log("Contract:", CONTRACT);
    console.log("Signer:", signer.address);
    console.log("");
    
    const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
    const RESERVE_DATA_UPDATED = "0xb2a02bf1a92354a66946e3533277a66dd13726c1695e5ac302d1c1fcb97d2200";
    const ARBITRUM_CHAIN_ID = 42161;
    
    const SUBSCRIBE_ABI = [
        "function subscribeTo(uint256 chainId, address contractAddress, uint256 topic0) external payable",
        "function owner() view returns (address)",
        "event Subscribed(uint256 chainId, address target, uint256 topic0)"
    ];
    
    const contract = new ethers.Contract(CONTRACT, SUBSCRIBE_ABI, signer);
    
    // Check owner
    try {
        const owner = await contract.owner();
        if (owner.toLowerCase() !== signer.address.toLowerCase()) {
            console.error("❌ Signer is not the owner!");
            process.exit(1);
        }
        console.log("✅ Owner verified\n");
    } catch (error) {
        console.log("⚠️  Could not verify owner, continuing...\n");
    }
    
    // Try subscribing with different value amounts
    const values = [
        { name: "0 REACT", value: ethers.utils.parseEther("0") },
        { name: "0.001 REACT", value: ethers.utils.parseEther("0.001") },
        { name: "0.01 REACT", value: ethers.utils.parseEther("0.01") }
    ];
    
    for (const val of values) {
        console.log(`\n${"=".repeat(60)}`);
        console.log(`TEST: Subscribing with ${val.name}`);
        console.log("=".repeat(60));
        
        try {
            console.log(`  Sending subscription with ${val.name}...`);
            const tx = await contract.subscribeTo(
                ARBITRUM_CHAIN_ID,
                AAVE_POOL,
                RESERVE_DATA_UPDATED,
                {
                    value: val.value,
                    gasLimit: 500000
                }
            );
            
            console.log(`  Transaction hash: ${tx.hash}`);
            console.log(`  Waiting for confirmation...`);
            
            const receipt = await tx.wait();
            
            if (receipt.status === 1) {
                console.log(`  ✅ SUCCESS with ${val.name}!`);
                console.log(`  Block: ${receipt.blockNumber}`);
                console.log(`  Gas Used: ${receipt.gasUsed.toString()}`);
                
                // Check for Subscribed event
                const iface = new ethers.utils.Interface(SUBSCRIBE_ABI);
                let eventFound = false;
                
                for (const log of receipt.logs) {
                    try {
                        const parsed = iface.parseLog(log);
                        if (parsed.name === 'Subscribed') {
                            console.log(`  ✅ Subscribed event emitted!`);
                            console.log(`     Chain ID: ${parsed.args.chainId.toString()}`);
                            console.log(`     Target: ${parsed.args.target}`);
                            console.log(`     Topic: ${parsed.args.topic0}`);
                            eventFound = true;
                            break;
                        }
                    } catch (e) {
                        // Not our event
                    }
                }
                
                if (!eventFound) {
                    console.log(`  ⚠️  Subscribed event not found`);
                }
                
                // Success - stop here
                console.log(`\n✅ SUBSCRIPTION WORKED with ${val.name}!`);
                console.log(`\n💡 This proves subscriptions need value: ${val.name}`);
                return;
                
            } else {
                console.log(`  ❌ Transaction failed with ${val.name}`);
            }
            
        } catch (error) {
            console.log(`  ❌ Error with ${val.name}:`, error.message);
            if (error.reason) {
                console.log(`     Reason: ${error.reason}`);
            }
        }
    }
    
    console.log("\n" + "=".repeat(60));
    console.log("📊 SUMMARY");
    console.log("=".repeat(60));
    console.log("All subscription attempts failed.");
    console.log("The system contract subscribe() is reverting regardless of value.");
    console.log("");
    console.log("💡 Next steps:");
    console.log("1. Check Reactive Network docs for subscription requirements");
    console.log("2. Contact Reactive Network support");
    console.log("3. Verify subscription parameters are correct");
}

subscribeWithValue().catch(console.error);

